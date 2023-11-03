// crawlerRunner.js
import { RequestQueue } from "crawlee";

const timestampRQ = false;

class CrawlerRunner {
  constructor(project, routerFactory, crawlerFactory, handlerLoader) {
    this.project = project;
    this.routerFactory = routerFactory;
    this.crawlerFactory = crawlerFactory;
    this.handlerLoader = handlerLoader; // This will be used to load handlers
    this.handlers = null;
  }

  async run() {
    if (!this.project) {
      console.log("No project provided.");
      return;
    }

    this.handlers = await this.handlerLoader.load(this.project.key);

    if (
      !this.project.databee_orchestrations ||
      this.project.databee_orchestrations.length === 0
    ) {
      console.log("No orchestrations found for the project.");
      return;
    }

    for (const sequence of this.project.databee_orchestrations) {
      if (sequence.isActive) {
        await this.runHandler(sequence);
      }
    }
  }

  async runHandler(sequence) {
    console.log("LOG HANDLER FACTORY", this.routerFactory);
    const handlerFunction =
      this.handlers[sequence.handler_label] || this.handlers["DEFAULT"];
    if (!handlerFunction) {
      console.log(`No handler found for sequence: ${sequence.handler_label}`);
      return;
    }

    const params = createParams(sequence);
    const router = this.routerFactory.getRouterByCrawlerType(
      sequence.crawler_type
    );

    if (!router) {
      console.error(
        `Unknown crawler type for label ${sequence.name}: ${sequence.crawler_type}`
      );
      return;
    }

    await this.runCrawler(sequence, params, handlerFunction, router);
  }

  async runCrawler(sequence, params, handlerFunction, router) {
    console.log(
      `RUNNING ${
        params.requestQueueLabel
      } CRAWLER WITH ${sequence.crawler_type.toUpperCase()}`
    );

    this.routerFactory.addHandler(sequence, handlerFunction, router);

    const queueName =
      params.requestQueueLabel + (timestampRQ ? `-${Date.now()}` : "");
    const requestQueue = await RequestQueue.open(queueName);

    const commonCrawlerOptions = { requestHandler: router, requestQueue };
    const crawler = this.crawlerFactory.createCrawler(
      sequence.crawler_type,
      commonCrawlerOptions,
      params,
      this.handlers
    );

    if (!crawler) {
      console.log(
        `Failed to create crawler for type: ${sequence.crawler_type}`
      );
      return;
    }

    try {
      await crawler.run(params.urls);
      console.log(`CRAWL ${params.requestQueueLabel} ENDED`);
    } catch (e) {
      console.error(`${params.requestQueueLabel} CRAWLER RUN FAILED`, e);
    }
  }

  async loadHandlers() {
    this.handlers = await loadProjectHandlers(this.project.key);
  }
}

export default CrawlerRunner;

export async function loadProjectHandlers(projectName) {
  try {
    const module = await import(`../projects/${projectName}.js`);
    return module.handlers;
  } catch (error) {
    console.error(`Failed to load project handlers for ${projectName}`, error);
    throw error;
  }
}

function createParams(sequence) {
  return {
    requestQueueLabel: sequence.request_queue,
    urls: sequence.start_urls?.length > 0 ? sequence.start_urls : [],
    login: sequence.require_login,
  };
}

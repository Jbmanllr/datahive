import { RequestQueue } from "crawlee";

const timestampRQ = false;

class CrawlerRunner {
  private databee: any;
  private routerFactory: any;
  private crawlerFactory: any;
  private handlerLoader: any;
  private handlers: any | null;

  constructor(
    databee: any,
    routerFactory: any,
    crawlerFactory: any,
    handlerLoader: any
  ) {
    this.databee = databee;
    this.routerFactory = routerFactory;
    this.crawlerFactory = crawlerFactory;
    this.handlerLoader = handlerLoader; // This will be used to load handlers
    this.handlers = null;
  }

  async run(): Promise<void> {
    if (!this.databee) {
      console.log("No Databee provided.");
      return;
    }
    if (!this.databee.project) {
      console.log("No project provided.");
      return;
    }

    this.handlers = await this.handlerLoader.load(
      this.databee.project.data.key
    );

    if (
      !this.databee.project.data.databee_orchestrations ||
      this.databee.project.data.databee_orchestrations.length === 0
    ) {
      console.log("No orchestrations found for the project.");
      return;
    }

    for (const sequence of this.databee.project.data.databee_orchestrations) {
      if (sequence.isActive) {
        await this.runHandler(sequence);
      }
    }
  }

  private async runHandler(sequence: any): Promise<void> {
    //console.log("LOG HANDLER FACTORY", this.routerFactory);
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

  private async runCrawler(
    sequence: any,
    params: any,
    handlerFunction: any,
    router: any
  ): Promise<void> {
    //console.log(`RUNNING ${params.requestQueueLabel} CRAWLER WITH ${sequence.crawler_type.toUpperCase()}`);

    this.routerFactory.addHandler(
      sequence,
      handlerFunction,
      router,
      this.databee.project.data,
      this.databee.run.data
    );

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
}

export default CrawlerRunner;

export async function loadProjectHandlers(projectName: string): Promise<any> {
  try {
    const module = await import(`../projects/${projectName}.js`);
    return module.handlers;
  } catch (error) {
    console.error(`Failed to load project handlers for ${projectName}`, error);
    throw error;
  }
}

function createParams(sequence: any): any {
  return {
    requestQueueLabel: sequence.request_queue,
    urls: sequence.start_urls?.length > 0 ? sequence.start_urls : [],
    login: sequence.require_login,
  };
}

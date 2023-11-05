// RouterFactory.js
import {
  createCheerioRouter,
  createPlaywrightRouter,
  createPuppeteerRouter,
} from "crawlee";

class RouterFactory {
  constructor() {
    this.playwrightRouter = createPlaywrightRouter();
    this.cheerioRouter = createCheerioRouter();
    this.puppeteerRouter = createPuppeteerRouter();
  }

  getRouterByCrawlerType(crawlerType) {
    switch (crawlerType) {
      case "playwright":
        return this.playwrightRouter;
      case "cheerio":
        return this.cheerioRouter;
      case "puppeteer":
        return this.puppeteerRouter;
      default:
        return this.cheerioRouter;
    }
  }

  addHandler(sequence, handlerFunction, router) {
    if (handlerFunction.name === "DEFAULT") {
      router.addDefaultHandler(async (context) => handlerFunction(context));
    } else {
      router.addHandler(sequence.handler_label, async (context) =>
        handlerFunction(context)
      );
    }
  }
}

export default RouterFactory;

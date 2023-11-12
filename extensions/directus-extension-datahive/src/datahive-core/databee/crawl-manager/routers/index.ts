import {
  createCheerioRouter,
  createPlaywrightRouter,
  createPuppeteerRouter,
} from "crawlee";

class RouterFactory {
  private playwrightRouter: any;
  private cheerioRouter: any;
  private puppeteerRouter: any;

  constructor() {
    this.playwrightRouter = createPlaywrightRouter();
    this.cheerioRouter = createCheerioRouter();
    this.puppeteerRouter = createPuppeteerRouter();
  }

  getRouterByCrawlerType(crawlerType: string): any {
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

  addHandler(sequence: any, handlerFunction: any, router: any): void {
    if (handlerFunction.name === "DEFAULT") {
      router.addDefaultHandler(async (context: any) => handlerFunction(context));
    } else {
      router.addHandler(sequence.handler_label, async (context: any) => handlerFunction(context));
    }
  }
}

export default RouterFactory;

import {
  CheerioCrawler,
  PlaywrightCrawler,
  CheerioCrawlerOptions,
  PlaywrightCrawlerOptions
} from "crawlee";

type CrawlerType = 'playwright' | 'cheerio';

interface CrawlerParams {
  requestQueueLabel: string;
  login?: any; // Replace 'any' with the actual type if known
}

interface Handlers {
  PRE_NAVIGATION_PREPARATION: (context: any) => Promise<void>; // Replace 'any' with the actual type if known
  LOGIN?: (context: any) => Promise<void>; // Replace 'any' with the actual type if known
}

class CrawlerFactory {
  private crawlerCache: Map<string, CheerioCrawler | PlaywrightCrawler>;

  constructor() {
    this.crawlerCache = new Map();
  }

  createCrawler(
    crawlerType: CrawlerType,
    commonCrawlerOptions: CheerioCrawlerOptions | PlaywrightCrawlerOptions,
    params: CrawlerParams,
    handlers: Handlers
  ): CheerioCrawler | PlaywrightCrawler {
    // Check if the crawler is already created and cached
    const cacheKey = `${crawlerType}-${params.requestQueueLabel}`;
    if (this.crawlerCache.has(cacheKey)) {
      return this.crawlerCache.get(cacheKey)!;
    }

    let crawler: CheerioCrawler | PlaywrightCrawler;
    switch (crawlerType) {
      case "playwright":
        crawler = new PlaywrightCrawler({
          ...commonCrawlerOptions as PlaywrightCrawlerOptions,
          headless: true,
          requestHandlerTimeoutSecs: 800,
          minConcurrency: 1,
          maxConcurrency: 1,
          retryOnBlocked: true,
          keepAlive: false,
          preNavigationHooks: [
            async (context) => handlers.PRE_NAVIGATION_PREPARATION(context),
            async (context) => {
              if (params.login && handlers.LOGIN) await handlers.LOGIN(context);
            },
          ],
        });
        break;
      case "cheerio":
        crawler = new CheerioCrawler({
          ...commonCrawlerOptions as CheerioCrawlerOptions,
          minConcurrency: 4,
          maxConcurrency: 8,
          preNavigationHooks: [],
        });
        break;
      default:
        throw new Error(`Unknown crawler type: ${crawlerType}`);
    }

    // Cache the newly created crawler
    this.crawlerCache.set(cacheKey, crawler);
    return crawler;
  }

  // Optionally, a method to clear the cache
  clearCrawlerCache(): void {
    this.crawlerCache.clear();
  }
}

export default CrawlerFactory;

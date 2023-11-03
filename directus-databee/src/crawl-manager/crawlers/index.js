// Crawlers.js
import { CheerioCrawler, PlaywrightCrawler } from "crawlee";

class CrawlerFactory {
  constructor() {
    this.crawlerCache = new Map();
  }

  createCrawler(crawlerType, commonCrawlerOptions, params, handlers) {
    // Check if the crawler is already created and cached
    const cacheKey = `${crawlerType}-${params.requestQueueLabel}`;
    if (this.crawlerCache.has(cacheKey)) {
      return this.crawlerCache.get(cacheKey);
    }

    let crawler;
    switch (crawlerType) {
      case "playwright":
        crawler = new PlaywrightCrawler({
          ...commonCrawlerOptions,
          headless: true,
          requestHandlerTimeoutSecs: 800,
          minConcurrency: 2,
          maxConcurrency: 3,
          preNavigationHooks: [
            async (context) => handlers.PRE_NAVIGATION_PREPARATION(context),
            async (context) => {
              if (params.login) await handlers.LOGIN(context);
            },
          ],
        });
        break;
      case "cheerio":
        crawler = new CheerioCrawler({
          ...commonCrawlerOptions,
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
  clearCrawlerCache() {
    this.crawlerCache.clear();
  }
}

export default CrawlerFactory;

// main.js
import dotenv from "dotenv";
import { dropQueues, loadApify } from "./src/utils/index.js";
import databee from "./src/run-manager/index.js";
import CrawlerRunner from "./src/crawl-manager/index.js";
import RouterFactory from "./src/crawl-manager/routers/index.js";
import CrawlerFactory from "./src/crawl-manager/crawlers/index.js";
import { loadProjectHandlers } from "./src/crawl-manager/index.js";
dotenv.config();
console.log("DOTENV", process.env);
let Actor;

// Initialize your dependencies
const routerFactory = new RouterFactory();
const crawlerFactory = new CrawlerFactory();
const handlerLoader = { load: loadProjectHandlers };

async function GoGather() {
  let project, run, runSession, isNewRun;

  if (process.env.APIFY_IS_AT_HOME) {
    await loadApify();
  }

  // START RUN
  if (true) {
    try {
      await databee.init(process);
    } catch (error) {
      console.error("An error occurred initiating run manager:", error);
    }

    console.log("Databee", databee);

    project = databee.runManager.project.data;
    run = databee.runManager.run.data;
    runSession = databee.runManager.run.runSession.data;
    isNewRun = databee.runManager.isNewRun;

    if (isNewRun) {
      await dropQueues(project);
      //await dropData(LABEL_NAMES);
    }
  }

  if (project) {
    const runner = new CrawlerRunner(
      project,
      routerFactory,
      crawlerFactory,
      handlerLoader
    );
    await runner.run().catch(console.error);
  }

  // END RUN
  if (databee && databee.runManager && databee.runManager.run) {
    await databee.runManager.run.end("finished", databee.runManager.runSession);
  } else {
    console.error("RunManager or Run is not initialized.");
  }

  if (process.env.APIFY_IS_AT_HOME && Actor) {
    await Actor.exit();
  }
}

// Handle process exit signals
/*process.on("SIGINT", async () => {
  console.log("Caught interrupt signal. Cleaning up...");
  await runManager.run.end(runManager.run, runManager.runSession, "paused");
  process.exit(0);
});

process.on("uncaughtException", async (error) => {
  console.error("Uncaught exception:", error);
  await runManager.run.end(runManager.run, runManager.runSession, "aborted");
  process.exit(1);
});

process.on("unhandledRejection", async (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
  await runManager.run.end(runManager.run, runManager.runSession, "aborted");
  process.exit(1);
});*/

//await GoGather();

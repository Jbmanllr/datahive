import dotenv from "dotenv";
import { dropQueues } from "./utils/index.js";
// import { loadApify } from "./utils/index";
import databee from "./run-manager/index.js";
import CrawlerRunner from "./crawl-manager/index.js";
import RouterFactory from "./crawl-manager/routers/index.js";
import CrawlerFactory from "./crawl-manager/crawlers/index.js";
import { loadProjectHandlers } from "./crawl-manager/index.js";

dotenv.config();

interface IRunSession {
  data: any;
}

interface IRun {
  data: any;
  runSession: IRunSession;
  end: (status: string, session: IRunSession) => Promise<void>;
}

interface IRunManager {
  project: {
    data: any;
  };
  run: IRun;
  isNewRun: boolean;
}

interface IDataBee {
  init: (process: NodeJS.Process) => Promise<void>;
  runManager: IRunManager;
}

//@ts-ignore
export default async function GoGather(projectId, runId): Promise<void> {

  let Actor: any;

  // Initialize your dependencies
  const routerFactory = new RouterFactory();
  const crawlerFactory = new CrawlerFactory();
  const handlerLoader = { load: loadProjectHandlers };
  let project: any, run: IRun, isNewRun: boolean;

  if (process.env.APIFY_IS_AT_HOME) {
    // await loadApify();
  }

  // START RUN
  if (true) {
    try {
      //@ts-ignore
      await (databee as IDataBee).init(projectId, runId);
    } catch (error) {
      console.error("An error occurred initiating run manager:", error);
    }

    console.log("Databee", databee);
    //@ts-ignore
    project = (databee as IDataBee).runManager.project.data;
    //@ts-ignore
    run = (databee as IDataBee).runManager.run;
    //@ts-ignore
    isNewRun = (databee as IDataBee).runManager.isNewRun;

    if (isNewRun) {
      await dropQueues(project);
      // await dropData(LABEL_NAMES);
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
  //@ts-ignore
  if (databee && (databee as IDataBee).runManager && (databee as IDataBee).runManager.run) {
    //@ts-ignore
    await (databee as IDataBee).runManager.run.end("finished", (databee as IDataBee).runManager.run.runSession);
  } else {
    console.error("RunManager or Run is not initialized.");
  }

  if (process.env.APIFY_IS_AT_HOME && Actor) {
    await Actor.exit();
  }
  //@ts-ignore
  return "Run ended successsss"
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

export { apiRequest } from './connectors/index.js';
export * from './run-manager/index.js'; 
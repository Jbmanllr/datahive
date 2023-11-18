//databee index.js
import dotenv from "dotenv";
import { dropQueues } from "./utils/index";
import { Run } from "../run-manager";
import CrawlerRunner from "./crawl-manager/index";
import RouterFactory from "./crawl-manager/routers/index";
import CrawlerFactory from "./crawl-manager/crawlers/index";
import { loadProjectHandlers } from "./crawl-manager/index";
import { apiRequest } from "../connectors/index";
import { Logger } from "../logger";
import { DatabeeProjectData, DatabeeConfig } from "./types";
import { Configuration } from "crawlee";

dotenv.config();

export class Databee {
  config: DatabeeConfig | null;
  project: DatabeeProject;
  run: Run;

  constructor() {
    this.config = null;
    this.project = new DatabeeProject();
    this.run = new Run();
  }

  async init(
    projectId: any,
    runId: any,
    config: DatabeeConfig
  ): Promise<Databee> {
    try {
      this.validateConfig(config);
      this.config = config;
      this.project = await this.project.init(projectId, this.config);
      this.run = await this.run.create(projectId, runId, this.config);
    } catch (error) {
      handleError("Failed to initialize Databee:", error, true);
    } finally {
      return this;
    }
  }

  private validateConfig(config: DatabeeConfig): void {
    if (
      !config.runs_collection ||
      !config.run_sessions_collection ||
      !config.project_collection ||
      !config.raw_data_collection
    ) {
      throw new Error("Invalid configuration: Missing required fields.");
    }
  }
}
export class DatabeeProject {
  data: DatabeeProjectData | null;
  constructor() {
    this.data = null;
  }

  async init(projectId: string, config: any): Promise<DatabeeProject> {
    try {
      const response = await apiRequest({
        method: "GET",
        collection: config.project_collection,
        id: projectId,
        fields:
          "/?fields=*,databee_orchestrations.*,databee_runs.*&deep[databee_orchestrations][_sort]=sort&deep[databee_runs][_filter][status][_neq]=running&deep[databee_runs][_filter][date_end][_nnull]=true&deep[databee_runs][_filter][isTestRun][_eq]=false&deep[databee_runs][_limit]=1&deep[databee_runs][_sort]=-date_end",
      });
      this.data = response.data;
      //Logger.info("Project fetched successfully", { name: this.data?.name });
    } catch (error) {
      handleError("Failed to fetch project:", error, true);
    } finally {
      return this;
    }
  }
}

export default async function GoGather(
  projectId: string | null,
  runId: string | null,
  config: DatabeeConfig
): Promise<void> {
  console.log("config", config);

  const crawleeconfig = Configuration.getGlobalConfig();

  console.log("Crawlee Config", crawleeconfig, process.env.CRAWLEE_STORAGE_DIR);

  const databee = new Databee();
  const routerFactory = new RouterFactory();
  const crawlerFactory = new CrawlerFactory();
  const handlerLoader = { load: loadProjectHandlers };
  let project: any, run: Run, isNewRun: boolean;

  // START RUN
  await databee.init(projectId, runId, config);

  console.log("Databee", databee);
  function timeout(ms: any) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Async function that waits for a specified time
  async function waitForSeconds(seconds: any) {
    console.log("Waiting...");

    // Wait for the specified number of seconds
    await timeout(seconds * 1000);

    // Continue with the rest of the function
    console.log(`${seconds} seconds have passed!`);
  }

  // Example usage
  //await waitForSeconds(5); // Waits for 3 seconds

  project = databee.project.data;
  run = databee.run;
  //@ts-ignore
  isNewRun = databee.run.isNewRun;

  if (true) {
    await dropQueues(project);
    // await dropData(LABEL_NAMES);
  }

  if (project) {
    const runner = new CrawlerRunner(
      databee,
      routerFactory,
      crawlerFactory,
      handlerLoader
    );
    await runner.run().catch(console.error);
  }

  // END RUN
  if (databee && databee.run && databee.run.data) {
    await databee.run.end("finished", databee.run.data?.id, databee.config);
  } else {
    console.error("RunManager or Run is not initialized.");
  }

  process.on("uncaughtException", async (error) => {
    console.error("Uncaught exception:", error);
    // @ts-ignore
    await databee.run.end("aborted", databee.run.data.id, databee.config);
  });

  process.on("unhandledRejection", async (reason, promise) => {
    console.error("Unhandled rejection at:", promise, "reason:", reason);
    // @ts-ignore
    await databee.run.end("aborted", databee.run.data.id, databee.config);
  });

  //process.on("SIGINT", async () => {
  //  console.log("Received SIGINT. Shutting down gracefully.");
  //  await databee.run.end("terminated", databee.run.data.id, databee.config);
  //});

  //process.on("SIGTERM", async () => {
  //  console.log("Received SIGTERM. Shutting down gracefully.");
  //  await databee.run.end("terminated", databee.run.data.id, databee.config);
  //});

  //process.on("exit", (code) => {
  //  console.log(`About to exit with code: ${code}`);
  // Note: It's not safe to call async functions within the 'exit' event listener.
  // });

  //@ts-ignore
  return "Run ended successsss";
}

// Handle process exit signals
/*process.on("SIGINT", async () => {
  console.log("Caught interrupt signal. Cleaning up...");
  await runManager.run.end(runManager.run, runManager.runSession, "paused");
  process.exit(0);
});

process.on("uncaughtException", async (error) => {
  console.error("Uncaught exception:", error);
  await databee.run.end("aborted", databee.run.data?.id, databee.config);
});

process.on("unhandledRejection", async (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
   await databee.run.end("aborted", databee.run.data?.id, databee.config);
});*/

function handleError(
  message: string,
  error: any = null,
  shouldExit: boolean = false
): void {
  Logger.error(message);
  if (error) Logger.error(error);
  if (shouldExit) process.exit(1);
}

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

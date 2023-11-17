//databee index.js
import dotenv from "dotenv";
import { dropQueues } from "./utils/index";
import { Run } from "../run-manager";
import CrawlerRunner from "./crawl-manager/index";
import RouterFactory from "./crawl-manager/routers/index";
import CrawlerFactory from "./crawl-manager/crawlers/index";
import { loadProjectHandlers } from "./crawl-manager/index";
import { apiRequest } from "../connectors/index";
import { Logger } from "../logger"
import { DatabeeProjectData, DatabeeConfig } from "./types";
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

  static async getConfig(): Promise<DatabeeConfig> {
    try {
      const response = await apiRequest({
        method: "GET",
        collection: "databee",
        id: "config",
      });
      return response.data;
    } catch (error :any) {
      // Handle error
      handleError("Failed to fetch Databee configuration: ", error, true);
      throw new Error("Failed to fetch config: " + error.message);
    }
  }

  async init(projectId: any, runId: any, config: DatabeeConfig): Promise<Databee> {
    try {
      this.config = config;
      //if (!this.config) {
      //   this.config = await this.getConfig();
      // }
      this.project = await this.project.init(projectId, this.config);
      this.run = await this.run.create(projectId, runId, this.config);
    } catch (error) {
      handleError("Failed to initialize Databee:", error, true);
    } finally {
      return this
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

//@ts-ignore
export default async function GoGather(projectId, runId, config): Promise<void> {

  //let Actor: any;
  //if (process.env.APIFY_IS_AT_HOME) { await loadApify();}

  const databee = new Databee();
  const routerFactory = new RouterFactory();
  const crawlerFactory = new CrawlerFactory();
  const handlerLoader = { load: loadProjectHandlers };
  let project: any, run: IRun, isNewRun: boolean;

  // START RUN
  await databee.init(projectId, runId, config);

  console.log("Databee", databee);

  project = databee.project.data;
  //@ts-ignore
  run = databee.run;
  //@ts-ignore
  isNewRun = databee.run.isNewRun;

  if (isNewRun) {
    await dropQueues(project);
    // await dropData(LABEL_NAMES);
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
  if (databee && databee.run && databee.run.data) {
    await databee.run.end("finished", databee.run.data?.id, databee.config);
  } else {
    console.error("RunManager or Run is not initialized.");
  }

  //if (process.env.APIFY_IS_AT_HOME && Actor) { await Actor.exit(); }
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

//export { apiRequest } from './connectors/index.js';
//export * from './run-manager/index.js'; 

function handleError(message: string, error: any = null, shouldExit: boolean = false): void {
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
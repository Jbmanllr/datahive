// All related Databee integration
import { apiRequest } from "../connectors/index.js";
import { createLogger, format, transports, Logger } from "winston";

const RUN_STATUS_RUNNING = "running";

const { combine, timestamp, printf } = format;
// Configure Winston logger
const myFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level}: ${message}`;
});

const logger: Logger = createLogger({
  level: "info",
  format: combine(timestamp(), myFormat),
  transports: [
    new transports.Console({ level: "info" }),
    // Add other transports like file, database, etc. as needed
  ],
});

interface Config {
  [key: string]: any;
}

interface ProjectData {
  [key: string]: any;
}

interface RunData {
  [key: string]: any;
}

interface RunSessionData {
  [key: string]: any;
}

class Databee {
  config: Config | null;
  runManager: RunManager;

  constructor() {
    this.config = null;
    this.runManager = new RunManager();
  }

  async init(projectId: any, runId: any): Promise<void> {
    console.log("INIT THE RUUUUN", process.env)
    console.log("CHECK ARGUMENTS", projectId, runId)
    try {
      const response = await apiRequest({
        method: "GET",
        collection: "databee",
        id: "config",
      });
      this.config = response.data;
      logger.info("Databee config fetched successfully");
      await this.runManager.init(projectId, runId);
    } catch (error) {
      handleError("Failed to fetch project:", error, true);
    }
  }
}

class RunManager {
  project: Project;
  run: Run;
  runSession: RunSession;
  isNewRun: boolean | null;

  constructor() {
    this.project = new Project();
    this.run = new Run();
    this.runSession = new RunSession();
    this.isNewRun = null;
  }

  async init(projectId: any, runId: any): Promise<void> {

    const args = process.argv.slice(2);
    console.log("args", args);
    const resumeFlagIndex = args.indexOf("--resume");

    console.log("WATCH ARG FOR RUNS", projectId, runId)
    if (runId || resumeFlagIndex !== -1) {
      // Ensure that the argument after "--resume" exists before calling `this.resume`

      if (!runId) {
        runId = args[resumeFlagIndex + 1];
      }
      if (runId) {
        await this.resume(runId);
      } else {
        // Handle the error case where the runId is not provided
        throw new Error("Run ID must be provided after '--resume' flag.");
      }
    } else {
      // Ensure that the first argument exists before calling `this.startNew`
      if (!projectId) {
        projectId = args[0];
      }

      if (projectId) {
        await this.startNew(projectId);
      } else {
        // Handle the error case where the projectId is not provided
        throw new Error("Project ID must be provided to start a new run.");
      }
    }
  }


  async resume(runId: string): Promise<void> {
    if (!runId) {
      console.error("Run ID is required after --resume flag.");
      //process.exit(1);
    }

    await this.run.resume(runId, this.project, this.runSession);
    this.isNewRun = false;
  }

  async startNew(projectId: string): Promise<void> {
    console.log("START NEW RUN", projectId)
    if (!projectId) {
      console.error(
        "Project ID is required to start a new run. Usage: npm start <PROJECT_ID>"
      );
      //process.exit(1);
    }

    await this.project.init(projectId);
    await this.run.create(projectId);
    await this.runSession.create(this.run.data!.id);

    this.run.setRunSession(this.runSession);
    this.isNewRun = true;
  }
}

class Project {
  data: ProjectData | undefined;

  async init(projectId: string): Promise<ProjectData | undefined> {

    console.log("GET PROJECT", projectId, databee.config!.project_collection)
    try {
      const response = await apiRequest({
        method: "GET",
        collection: databee.config!.project_collection,
        id: projectId,
        fields:
          "/?fields=*,databee_orchestrations.*,databee_runs.*&deep[databee_orchestrations][_sort]=sort&deep[databee_runs][_filter][status][_neq]=running&deep[databee_runs][_filter][date_end][_nnull]=true&deep[databee_runs][_filter][isTestRun][_eq]=false&deep[databee_runs][_limit]=1&deep[databee_runs][_sort]=-date_end",
      });

      // Assuming the response.data is of type ProjectData | null
      if (response.data === null) {
        // Handle the null case, perhaps by logging an error or throwing an exception
        logger.error("Project data is null");
        return undefined;
      }

      this.data = response.data;
      // @ts-ignore
      logger.info("Project fetched successfully", { name: this.data.name });
      return this.data;
    } catch (error) {
      handleError("Failed to fetch project:", error, true);
      return undefined; // Explicitly return undefined here
    }
  }
}

export class Run {
  data: RunData | null;
  runSession: RunSession | null;

  constructor() {
    this.data = null;
    this.runSession = null;
  }

  setRunSession(runSession: RunSession): void {
    this.runSession = runSession;
  }

  async create(projectId: string): Promise<void> {
    try {
      const response = await apiRequest({
        method: "POST",
        collection: databee.config!.runs_collection,
        data: {
          date_start: new Date(),
          status: RUN_STATUS_RUNNING,
          project_id: projectId,
          time_elapsed: 0,
        },
      });
      this.data = response.data;
      // @ts-ignore
      logger.info("New run created successfully", { runId: this.data.id });
      console.log("CREATE RUN AND EXIT TEST CHANGES", process.pid, process.ppid)
      // @ts-ignore
      io
    } catch (error) {
      handleError("Failed to create a new run:", error, true);
    }
  }

  async resume(runId: string, projectInstance: Project, runSessionInstance: RunSession): Promise<void> {
    if (!runId) {
      console.error("Run ID is required after --resume flag.");
      //process.exit(1);
    }
    try {
      this.data = await this.init(runId);
      await projectInstance.init(this.data.project_id);
      await runSessionInstance.create(this.data.id);
      logger.info("Run resumed successfully", { runId: this.data.id });
    } catch (error) {
      handleError("Failed to resume run:", error, true);
    }
  }

  // @ts-ignore
  async init(runId: string): Promise<RunData> {
    try {
      const response = await apiRequest({
        method: "GET",
        collection: databee.config!.runs_collection,
        id: runId,
      });
      this.data = response.data;

      if (!this.data) {
        console.error("Run not found or invalid response.");
        //process.exit(1);
      }
      //@ts-ignore
      if (this.data.status !== RUN_STATUS_RUNNING) {
        //@ts-ignore
        this.data = await this.update(this.data.id, {
          status: RUN_STATUS_RUNNING,
        });
      }
      //@ts-ignore
      return this.data;
    } catch (error) {
      handleError("Failed to retrieve or update the run by ID:", error, true);
    }
  }
  //@ts-ignore
  async update(runId: string, data: Partial<RunData>): Promise<RunData> {
    try {
      const response = await apiRequest({
        method: "PATCH",
        collection: databee.config!.runs_collection,
        id: runId,
        data,
      });
      this.data = response.data;
      //@ts-ignore
      logger.info("Run updated successfully", { status: this.data.status });
      //@ts-ignore
      return this.data;
    } catch (error) {
      handleError("Failed to update the run:", error, true);
    }
  }

  async end(status: string, runSession: RunSession): Promise<RunData | undefined> {
    if (!this.data) {
      console.error("Run not found or invalid response.");
      return;
    }

    const runId = this.data.id;

    if (!runId) {
      console.error("Invalid run ID provided.");
      return;
    }

    try {
      const updatedRunSession = await runSession.end(status);
      if (!updatedRunSession) {
        console.error("Failed to update the run session.");
        return;
      }

      const runSessionElapsedTime = parseInt(updatedRunSession.time_elapsed.toString()) || 0;
      const previousRunElapsedTime = parseInt(this.data.time_elapsed.toString()) || 0;
      const newRunElapsedTime = previousRunElapsedTime + runSessionElapsedTime;

      const currentDate = new Date();
      const updatedRun = await this.update(runId, {
        status,
        date_end: currentDate,
        time_elapsed: newRunElapsedTime,
      });

      logger.info(`Run ${status}. Total time elapsed: ${newRunElapsedTime}ms`);
      return updatedRun;
    } catch (error) {
      handleError("Failed to end run:", error);
    }
  }
}

class RunSession {
  data: RunSessionData | null;

  constructor() {
    this.data = null;
  }

  async create(runId: string): Promise<void> {
    try {
      const response = await apiRequest({
        method: "POST",
        collection: databee.config!.run_sessions_collection,
        data: {
          date_start: new Date(),
          status: RUN_STATUS_RUNNING,
          run_id: runId,
          time_elapsed: 0,
        },
      });
      this.data = response.data;
      //@ts-ignore
      logger.info("New run session created successfully", { runSessionId: this.data.id });
    } catch (error) {
      handleError("Failed to create a new run session:", error, true);
    }
  }
  //@ts-ignore
  async update(runSessionId: string, data: Partial<RunSessionData>): Promise<RunSessionData> {
    try {
      const response = await apiRequest({
        method: "PATCH",
        collection: databee.config!.run_sessions_collection,
        id: runSessionId,
        data,
      });
      this.data = response.data;
      //@ts-ignore
      logger.info("Run session updated successfully", { status: this.data.status });
      //@ts-ignore
      return this.data;
    } catch (error) {
      handleError("Failed to update the run session:", error, true);
    }
  }

  async end(status: string): Promise<RunSessionData | undefined> {
    if (!this.data) {
      console.error("Run session not found or invalid response.");
      return;
    }

    const runSessionId = this.data.id;
    if (!runSessionId) {
      console.error("Invalid run session ID provided.");
      return;
    }

    try {
      const startDate = new Date(this.data.date_start);
      const currentDate = new Date();
      const elapsedTime = currentDate.getTime() - startDate.getTime();

      const updatedRunSession = await this.update(runSessionId, {
        status,
        date_end: currentDate,
        time_elapsed: elapsedTime,
      });

      logger.info(`Run session ${status}. Time elapsed: ${elapsedTime}ms`);
      return updatedRunSession;
    } catch (error) {
      handleError("Failed to end run session:", error, false);
    }
  }
}

function handleError(message: string, error: any = null, shouldExit: boolean = false): void {
  logger.error(message);
  if (error) logger.error(error);
  if (shouldExit) process.exit(1);
}

const databee = new Databee();
export default databee;

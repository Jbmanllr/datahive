import { apiRequest } from "./connectors/index";
import { Logger } from "./logger";
import { Run, RunSession } from "./types";
import { generateStorageName, cleanRunStorage } from "./databee/utils";

const RUN_STATUS_RUNNING = "running";

export class Module {
  public static async fetchConfig(caller: string): Promise<any> {
    try {
      const config = await apiRequest({
        method: "GET",
        collection: caller,
        id: "config",
      });

      return config.data;
    } catch (error: any) {
      throw new Error("Failed to fetch config: " + error.message);
    }
  }

  private static validateConfig(config: any): void {
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
export class ProjectInstance {
  data: any | null;
  constructor() {
    this.data = null;
  }

  public static async getProjectById(
    projectId: string,
    config: any
  ): Promise<any> {
    let project;
    try {
      project = await apiRequest({
        method: "GET",
        collection: config.project_collection,
        id: projectId,
        fields:
          "/?fields=*,databee_orchestrations.*,databee_runs.*&deep[databee_orchestrations][_sort]=sort&deep[databee_runs][_filter][status][_neq]=running&deep[databee_runs][_filter][date_end][_nnull]=true&deep[databee_runs][_filter][isTestRun][_eq]=false&deep[databee_runs][_limit]=1&deep[databee_runs][_sort]=-date_end",
      });
    } catch (error: any) {
      throw new Error("Failed to fetch project: " + error.message);
    }
    return project;
  }

  public async init(projectId: string, config: any): Promise<ProjectInstance> {
    const project = await ProjectInstance.getProjectById(projectId, config);
    this.data = project.data;
    return this;
  }
}
export class RunInstance {
  data: Run | null | undefined;
  runSession: RunSessionInstance;
  config: any | null;
  project: any;
  storageName: string | null;
  process_id: number | null | undefined;

  constructor() {
    this.data = null;
    this.runSession = new RunSessionInstance();
    this.config = null;
    this.project = new ProjectInstance();
    this.storageName = null;
    this.process_id = null;
  }

  public static async getRunById(runId: string, config: any): Promise<Run> {
    let run;
    try {
      run = await apiRequest({
        method: "GET",
        collection: config.runs_collection,
        id: runId,
        fields: "/?fields=*",
        //,databee_run_sessions.*
      });
    } catch (error: any) {
      throw new Error("Failed to fetch run: " + error.message);
    }
    return run;
  }

  async resume(runId: any, caller: any): Promise<RunInstance> {
    let config = await Module.fetchConfig(caller);
    this.config = config;

    try {
      const run = await RunInstance.getRunById(runId, config);

      if (run)
        if (run.status === "completed") {
          throw new Error("Run already completed");
        }

      await this.update(
        runId,
        {
          status: RUN_STATUS_RUNNING,
          date_end: null,
        },
        config
      );

      if (this.data) {
        this.runSession = await this.runSession.create(this.data.id, config);
        this.project = await this.project.init(
          this.data?.project_id,
          this.config
        );
        if (this.project.data && this.data) {
          this.storageName = generateStorageName(
            this.project.data.id,
            this.data.id
          );
        }
      }

      return this;
    } catch (error) {
      throw error;
    }
  }

  async initNew(projectId: any, caller: any): Promise<RunInstance> {
    let config = await Module.fetchConfig(caller);
    this.config = config;

    if (!this.config) {
      throw new Error("Config is not initialized");
    }
    try {
      this.project = await this.project.init(projectId, this.config);
      await this.create(projectId, this.config);
      if (this.project.data && this.data) {
        this.storageName = generateStorageName(
          this.project.data.id,
          this.data.id
        );
      }
      return this;
    } catch (error: any) {
      throw new Error("Failed to initialize Databee: " + error);
    }
  }

  async create(projectId: string, config: any): Promise<RunInstance> {
    try {
      const response = await apiRequest({
        method: "POST",
        collection: config.runs_collection,
        data: {
          date_start: new Date(),
          status: RUN_STATUS_RUNNING,
          project_id: projectId,
          time_elapsed: 0,
        },
      });
      this.data = response.data;
      this.runSession = await this.runSession.create(this.data!.id, config);
      return this;
    } catch (error: any) {
      throw new Error("Failed to create run: " + error.message);
    }
  }

  async update(runId: string, data: Partial<Run>, config: any): Promise<void> {
    try {
      const response = await apiRequest({
        method: "PATCH",
        collection: config.runs_collection,
        id: runId,
        data,
      });
      this.data = response.data;
    } catch (error: any) {
      throw new Error("Failed to update run: " + error.message);
    }
  }

  async end(
    status: string = "aborted",
    runId: string,
    config: any
  ): Promise<Run | undefined> {
    if (!this.data) {
      console.error("Run not found or invalid response.");
      return;
    }
    if (!runId) {
      console.error("You must specify a run ID to end.");
      return;
    }

    let endedRunSession;
    try {
      if (this.runSession && this.runSession.data) {
        endedRunSession = await this.runSession.end(
          this.runSession.data.id,
          status,
          config
        );
        if (!endedRunSession) {
          console.error("Failed to update the run session.");
          return;
        }
      }

      if (endedRunSession) {
        const runSessionElapsedTime = endedRunSession.time_elapsed
          ? parseInt(endedRunSession.time_elapsed.toString())
          : 0;
        const previousRunElapsedTime = this.data.time_elapsed
          ? parseInt(this.data.time_elapsed.toString())
          : 0;
        const newRunElapsedTime =
          previousRunElapsedTime + runSessionElapsedTime;

        const currentDate = new Date();
        await this.update(
          runId,
          {
            status,
            date_end: currentDate,
            time_elapsed: newRunElapsedTime,
          },
          config
        );
      }
      return this.data;
    } catch (error) {
      throw new Error("Failed to end run: " + error);
    }
  }
}

class RunSessionInstance {
  data: RunSession | null | undefined;

  constructor() {
    this.data = null;
  }

  async create(runId: string, config: any): Promise<RunSessionInstance> {
    try {
      const response = await apiRequest({
        method: "POST",
        collection: config.run_sessions_collection,
        data: {
          date_start: new Date(),
          status: RUN_STATUS_RUNNING,
          run_id: runId,
          time_elapsed: 0,
          config: config,
          env: process.env,
        },
      });
      this.data = response.data;
      return this;
    } catch (error: any) {
      throw new Error("Error creating run session:" + error);
    }
  }

  async update(
    runSessionId: string,
    data: Partial<RunSession>,
    config: any
  ): Promise<void> {
    try {
      const response = await apiRequest({
        method: "PATCH",
        collection: config.run_sessions_collection,
        id: runSessionId,
        data,
      });
      this.data = response.data;
    } catch (error) {
      throw new Error("Failed to update the run session:" + error);
    }
  }

  async end(
    runSessionId: string,
    status: string,
    config: any
  ): Promise<RunSession | undefined | null> {
    if (!this.data) {
      throw new Error("Run session not found or invalid response.");
    }

    if (!runSessionId) {
      throw new Error(" y ou must specify a run session ID to end.");
    }

    try {
      const startDate = new Date(this.data.date_start);
      const currentDate = new Date();
      const elapsedTime = currentDate.getTime() - startDate.getTime();

      await this.update(
        runSessionId,
        {
          status,
          date_end: currentDate,
          time_elapsed: elapsedTime,
        },
        config
      );
      return this.data;
    } catch (error) {
      throw new Error("Error ending run session: " + error);
    }
  }
}

function handleError(
  message: string,
  error: any = null,
  shouldExit: boolean = false
): void {
  Logger.error(message);
  if (error) Logger.error(error);
  if (shouldExit) process.exit(1);
}

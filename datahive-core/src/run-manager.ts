import { apiRequest } from "./connectors/index";
import { Logger } from "./logger"
import { RunData, RunSessionData } from "./types";

const RUN_STATUS_RUNNING = "running";

export class Run {
  data: RunData | null | undefined;
  runSession: RunSession;

  constructor() {
    this.data = null;
    this.runSession = new RunSession();
  }

  async create(projectId: string, runId: string, config: any): Promise<Run> {
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
    } catch (error) {
      handleError("Failed to create a new run:", error, true);
    } finally {
      return this
    }
  }

  async resume(runId: string, project: any, runSession: RunSession, config: any): Promise<Run> {
    if (!runId) {
      console.error("Run ID is required after --resume flag.");
      //process.exit(1);
    }
    try {
      const response = await apiRequest({
        method: "GET",
        collection: config.runs_collection,
        id: runId,
      });
      this.data = response.data;

      if (this.data && this.data.status !== RUN_STATUS_RUNNING) {
        this.data = await this.update(this.data.id, {
          status: RUN_STATUS_RUNNING,
        }, config);
      }

      if (this.data) {
        await project.init(this.data.project_id, config);
        await runSession.create(this.data.id, config);
        //Logger.info("Run resumed successfully", { runId: this.data.id });
      }
    } catch (error) {
      handleError("Failed to resume run:", error, true);
    } finally {
      return this
    }
  }

  async update(runId: string, data: Partial<RunData>, config: any): Promise<RunData | undefined> {
    try {
      const response = await apiRequest({
        method: "PATCH",
        collection: config.runs_collection,
        id: runId,
        data,
      });
      this.data = response.data;
    } catch (error) {
      handleError("Failed to update the run:", error, true);
    } finally {
      if (this.data)
        return this.data
    }
  }

  async end(status: string = "aborted", runId: string, config: any): Promise<RunData | undefined> {
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
        endedRunSession = await this.runSession.end(this.runSession.data.id, status, config);
        if (!endedRunSession) {
          console.error("Failed to update the run session.");
          return;
        }
      }

      if (endedRunSession) {
        const runSessionElapsedTime = endedRunSession.time_elapsed ? parseInt(endedRunSession.time_elapsed.toString()) : 0;
        const previousRunElapsedTime = this.data.time_elapsed ? parseInt(this.data.time_elapsed.toString()) : 0;
        const newRunElapsedTime = previousRunElapsedTime + runSessionElapsedTime;

        const currentDate = new Date();
        const updatedRun = await this.update(runId, {
          status,
          date_end: currentDate,
          time_elapsed: newRunElapsedTime,
        }, config);

        this.data = updatedRun
        console.log("UPDATED RUN", this.data)
        //Logger.info(`Run ${status}. Total time elapsed: ${newRunElapsedTime}ms`);
      }
    } catch (error) {
      handleError("Failed to end run: ", error);
    } finally {
      return this.data
    }
  }
}

class RunSession {
  data: RunSessionData | null | undefined;

  constructor() {
    this.data = null;
  }

  async create(runId: string, config: any): Promise<RunSession> {
    try {
      const response = await apiRequest({
        method: "POST",
        collection: config.run_sessions_collection,
        data: {
          date_start: new Date(),
          status: RUN_STATUS_RUNNING,
          run_id: runId,
          time_elapsed: 0,
          config : config,
          env : process.env
        },
      });
      this.data = response.data;
    } catch (error) {
      handleError("Failed to create a new run session:", error, true);
    } finally {
      return this
    }
  }

  async update(runSessionId: string, data: Partial<RunSessionData>, config: any): Promise<RunSessionData | undefined | null> {
    try {
      const response = await apiRequest({
        method: "PATCH",
        collection: config.run_sessions_collection,
        id: runSessionId,
        data,
      });
      this.data = response.data;
    } catch (error) {
      handleError("Failed to update the run session:", error, true);
    } finally {
      return this.data
    }
  }

  async end(runSessionId: string, status: string, config: any): Promise<RunSessionData | undefined | null> {
    if (!this.data) {
      console.error("Run session not found or invalid response.");
      return;
    }

    if (!runSessionId) {
      console.error("ou must specify a run session ID to end.");
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
      }, config);

      //Logger.info(`Run session ${status}. Time elapsed: ${elapsedTime}ms`);
      return updatedRunSession;
    } catch (error) {
      handleError("Failed to end run session:", error, false);
    } finally {
      return this.data
    }
  }
}

function handleError(message: string, error: any = null, shouldExit: boolean = false): void {
  Logger.error(message);
  if (error) Logger.error(error);
  if (shouldExit) process.exit(1);
}

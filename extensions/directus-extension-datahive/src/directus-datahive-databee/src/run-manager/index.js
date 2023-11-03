// databee.js
// All related Databee integration

import { apiRequest } from "../connectors/index.js";
import { createLogger, format, transports } from "winston";

const RUN_STATUS_RUNNING = "running";

const { combine, timestamp, printf } = format;
// Configure Winston logger
const myFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level}: ${message}`;
});

const logger = createLogger({
  level: "info",
  format: combine(timestamp(), myFormat),
  transports: [
    new transports.Console({ level: "info" }),
    // Add other transports like file, database, etc. as needed
  ],
});

class Databee {
  constructor() {
    this.config = null;
    this.runManager = new RunManager();
  }
  async init(process) {
    try {
      this.config = (
        await apiRequest({
          method: "GET",
          collection: "databee",
          id: "config",
        })
      ).data;
      logger.info("Databee config fetched successfully");
      await this.runManager.init(process);
    } catch (error) {
      handleError("Failed to fetch project:", error, true);
    }
  }
}

class RunManager {
  constructor() {
    this.project = new Project();
    this.run = new Run();
    this.runSession = new RunSession();
    this.isNewRun = null;
  }

  async init(process) {
    const args = process.argv.slice(2);
    console.log("args", args);
    const resumeFlagIndex = args.indexOf("--resume");

    if (resumeFlagIndex !== -1) {
      await this.resume(args[resumeFlagIndex + 1]);
    } else {
      await this.startNew(args[0]);
    }
  }

  async resume(runId) {
    if (!runId) {
      console.error("Run ID is required after --resume flag.");
      process.exit(1);
    }

    await this.run.resume(runId, this.project, this.runSession);
    this.isNewRun = false;
  }

  async startNew(projectId) {
    if (!projectId) {
      console.error(
        "Project ID is required to start a new run. Usage: npm start <PROJECT_ID>"
      );
      process.exit(1);
    }

    await this.project.init(projectId);
    await this.run.create(projectId);
    await this.runSession.create(this.run.data.id);

    this.run.setRunSession(this.runSession);
    this.isNewRun = true;
  }
}

class Project {
  constructor() {
    this.data = null;
  }

  async init(projectId) {
    try {
      this.data = (
        await apiRequest({
          method: "GET",
          collection: databee.config.project_collection,
          id: projectId,
          fields:
            "/?fields=*,databee_orchestrations.*,databee_runs.*&deep[databee_orchestrations][_sort]=sort&deep[databee_runs][_filter][status][_neq]=running&deep[databee_runs][_filter][date_end][_nnull]=true&deep[databee_runs][_filter][isTestRun][_eq]=false&deep[databee_runs][_limit]=1&deep[databee_runs][_sort]=-date_end",
        })
      ).data;
      logger.info("Project fetched successfully", { name: this.data.name });
      return this.data;
    } catch (error) {
      handleError("Failed to fetch project:", error, true);
    }
  }
}

export class Run {
  constructor() {
    this.data = null;
    this.runSession = null;
  }

  setRunSession(runSession) {
    this.runSession = runSession;
  }

  async create(projectId) {
    try {
      this.data = (
        await apiRequest({
          method: "POST",
          collection: databee.config.runs_collection,
          data: {
            date_start: new Date(),
            status: RUN_STATUS_RUNNING,
            project_id: projectId,
            time_elapsed: 0,
          },
        })
      ).data;
      console.log("New run created successfully:", this.data.id);
    } catch (error) {
      handleError("Failed to create a new run:", error, true);
    }
  }

  async resume(runId, projectInstance, runSessionInstance) {
    if (!runId) {
      console.error("Run ID is required after --resume flag.");
      process.exit(1);
    }
    try {
      this.data = await this.init(runId);
      await projectInstance.init(this.data.project_id);
      await runSessionInstance.create(this.data.id);
      console.log("Run resumed successfully", this.data.id);
    } catch (error) {
      handleError("Failed to resume run:", error, true);
    }
  }

  async init(runId) {
    try {
      this.data = (
        await apiRequest({
          method: "GET",
          collection: databee.config.runs_collection,
          id: runId,
        })
      ).data;

      if (!this.data) {
        console.error("Run not found or invalid response.");
        process.exit(1);
      }

      if (this.data.status !== RUN_STATUS_RUNNING) {
        this.data = await this.update(this.data.id, {
          status: RUN_STATUS_RUNNING,
        });
      }

      return this.data;
    } catch (error) {
      handleError("Failed to retrieve or update the run by ID:", error, true);
    }
  }

  async update(runId, data) {
    try {
      this.data = (
        await apiRequest({
          method: "PATCH",
          collection: databee.config.runs_collection,
          id: runId,
          data,
        })
      ).data;
      console.log("Run updated successfully: ", this.data.status);
      return this.data;
    } catch (error) {
      console.error("Failed to update the run:", error);
      process.exit(1);
    }
  }

  async end(status, runSession) {
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

      const runSessionElapsedTime =
        parseInt(updatedRunSession.time_elapsed) || 0;
      const previousRunElapsedTime = parseInt(this.data.time_elapsed) || 0;
      const newRunElapsedTime = previousRunElapsedTime + runSessionElapsedTime;

      const currentDate = new Date();
      const updatedRun = await this.update(runId, {
        status,
        date_end: currentDate,
        time_elapsed: newRunElapsedTime,
      });

      console.log(`Run ${status}. Total time elapsed: ${newRunElapsedTime}ms`);
      return updatedRun;
    } catch (error) {
      handleError("Failed to end run:", error);
    }
  }
}

class RunSession {
  constructor() {
    this.data = null;
  }

  async create(runId) {
    try {
      this.data = (
        await apiRequest({
          method: "POST",
          collection: databee.config.run_sessions_collection,
          data: {
            date_start: new Date(),
            status: RUN_STATUS_RUNNING,
            run_id: runId,
            time_elapsed: 0,
          },
        })
      ).data;
      console.log("New run session created successfully:", this.data.id);
    } catch (error) {
      handleError("Failed to create a new run session:", error, true);
    }
  }

  async update(runSessionId, data) {
    try {
      this.data = (
        await apiRequest({
          method: "PATCH",
          collection: databee.config.run_sessions_collection,
          id: runSessionId,
          data,
        })
      ).data;
      console.log("Run session updated successfully:", this.data.status);
      return this.data;
    } catch (error) {
      handleError("Failed to update the run session:", error, true);
    }
  }

  async end(status) {
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
      const elapsedTime = currentDate - startDate;

      const updatedRunSession = await this.update(runSessionId, {
        status,
        date_end: currentDate,
        time_elapsed: elapsedTime,
      });

      console.log(`Run session ${status}. Time elapsed: ${elapsedTime}ms`);
      return updatedRunSession;
    } catch (error) {
      handleError("Failed to end run session:", error, false);
    }
  }
}

function handleError(message, error = null, shouldExit = false) {
  logger.error(message);
  if (error) logger.error(error);
  if (shouldExit) process.exit(1);
}

const databee = new Databee();
export default databee;

// Datahive > index.ts
import { isMainThread, parentPort } from "worker_threads";
import ProcessManager from "./process-manager";
import WorkerManager from "./worker-manager";
import goGather from "./databee/index";
import { pollinaGo } from "./pollinator/index";
import { RunManager, RunInstance } from "./run-manager";

const defaultConfig: any = {
  workerManager: {
    type: "process",
    options: {
      maxWorkers: 10,
      maxQueueSize: 1000,
      maxConcurrentWorkers: 10,
      maxConcurrentQueueSize: 1000,
    },
  },
  processManager: {
    type: "process",
    options: {
      maxWorkers: 10,
      maxQueueSize: 1000,
      maxConcurrentWorkers: 10,
      maxConcurrentQueueSize: 1000,
    },
  },
};

const defaultModuleConfig: any = {
  multiprocess: true,
  multithread: true,
  child_process_type: "fork",
};

class Datahive {
  private static instance: Datahive;

  private runManager: RunManager;
  private processManager: ProcessManager;
  private workerManager: WorkerManager;
  private processPath: string;

  private constructor() {
    this.runManager = new RunManager();
    this.processManager = new ProcessManager();
    this.workerManager = new WorkerManager();
    this.processPath =
      "/directus/extensions/directus-extension-datahive/dist/api.js";
  }

  public static getInstance(): Datahive {
    if (!Datahive.instance) {
      Datahive.instance = new Datahive();
    }
    return Datahive.instance;
  }

  public async startProcess(
    caller: string,
    projectId: string | null,
    runId: string | null,
    operation: "start" | "resume"
  ): Promise<RunInstance> {
    const run = await this.runManager.startRun(
      caller,
      projectId,
      runId,
      operation
    );
    let config = run.config;

    config ? config : defaultModuleConfig;

    let multiprocess = true; //config.multiprocess;

    try {
      let childProcess = null;

      if (multiprocess) {
        childProcess = await this.processManager.createProcess({
          caller,
          projectId: run.project.data.id,
          runId: run.data?.id,
          processPath: this.processPath,
          config,
        });
        run.process_id = childProcess.pid;
        console.log("Datahive Instance after start", Datahive.getInstance());
        childProcess.send({ command: "start", run, caller });
        childProcess.on("message", async (message: any) => {
          console.log("Message from child:", message);
          if (["completed", "aborted", "stopped"].includes(message.command)) {
            await this.runManager.endRun(caller, run.data!.id, message.command);
            await this.processManager.terminateProcess(run.process_id);
            //console.log("Datahive Instance after end", Datahive.getInstance());
          }
        });
        //childProcess.on("error", (error: any) => {});
      } else {
        childProcess = await this.processManager.getOrCreateActiveProcess(
          caller,
          run.project.data.id,
          run.data!.id,
          this.processPath,
          config
        );
        childProcess.send({ command: "startWorker", run, caller });
        childProcess.on("message", async (message: any) => {
          if (message.status === "completed") {
            await this.runManager.endRun(caller, run.data!.id, "completed");
          }
        });
      }
      return run;
    } catch (error: any) {
      throw new Error("Error starting process: " + error.message);
    }
  }

  public async endRun(
    caller: string,
    runId: string,
    status: string = "aborted"
  ): Promise<void> {
    const run = this.runManager.activeRuns.get(runId);

    if (run) {
      this.runManager.endRun(caller, run.data!.id, status);
      this.processManager.terminateProcess(run.process_id);
      console.log(`Run ${runId} ended with status: ${status}`);
    } else {
      console.error(`Run ${runId} not found.`);
    }
  }

  public async manageThreads(): Promise<void> {
    if (isMainThread) {
      this.handleChildProcessLogic();
    } else {
      this.handleWorkerLogic();
    }
  }

  private async handleChildProcessLogic(): Promise<void> {
    process.on("message", async (message: any) => {
      if (message.command === "start") {
        let result;
        if (message.caller === "databee") {
          result = await goGather(message.run);
        } else if (message.caller === "pollinator") {
          result = await pollinaGo(message.run);
        } else if (message.caller === "honeycomb") {
          //result = await honeycomb(message.run);
        }
        //parentPort?.postMessage({ command: "completed", result });
      }

      if (message.command === "startWorker") {
        const worker = await this.workerManager.createWorker(this.processPath, {
          projectId: message.run.project.data.id,
        });
        const workerId = worker.threadId;

        worker.on("message", async (message) => {
          if (message.status === "completed" || message.status === "error") {
            console.log(
              `Worker ${workerId} ${
                message.status === "completed"
                  ? "completed its task"
                  : "encountered an error"
              }.`
            );

            //this.runManager.endRun(message.caller, message.runId, "completed");
            await this.workerManager.terminateWorker(workerId);
          }
        });

        worker.on("exit", async (code) => {
          console.log(`Worker ${workerId} stopped with exit code ${code}`);
          await this.workerManager.terminateWorker(workerId);
        });

        worker.postMessage({ run: message.run, workerId });
      } else if (message.command === "heartbeat") {
        if (typeof process.send === "function") {
          process.send("alive");
        }
      }
    });
  }

  private handleWorkerLogic(): void {
    if (parentPort) {
      parentPort.on("message", async (message) => {
        const workerId = message.workerId;

        const originalConsoleLog = console.log;
        const originalConsoleWarn = console.warn;
        const originalConsoleError = console.error;

        console.log = (...args) =>
          originalConsoleLog(`[W-${workerId}]`, ...args);
        console.warn = (...args) =>
          originalConsoleWarn(`[W-${workerId}]`, ...args);
        console.error = (...args) =>
          originalConsoleError(`[W-${workerId}]`, ...args);

        try {
          const result = await goGather(message.run);
          parentPort?.postMessage({ status: "completed", result });
        } catch (error) {
          console.error(`Error in worker:`, error);
          parentPort?.postMessage({ status: "error", error });
        }
      });
    }
  }
}

const datahive = Datahive.getInstance();

export async function relay(
  caller: string,
  type: string,
  projectId: string | undefined,
  runId: string | undefined
): Promise<any> {
  let response;
  try {
    if (type === "start" && projectId) {
      response = datahive.startProcess(caller, projectId, null, "start");
    }
    if (type === "stop" && runId) {
      response = datahive.endRun(caller, runId, "stopped");
    }
    if (type === "resume" && runId) {
      response = datahive.startProcess(caller, null, runId, "resume");
    }
    return response;
  } catch (error: any) {
    throw new Error("Error in relay: " + error);
  }
}

(async () => {
  if (process.env.IS_CHILD_PROCESS) {
    const processName = process.env.PROCESS_NAME;
    process.title = processName ? processName : "Datahive";
  }

  await datahive.manageThreads();
})();

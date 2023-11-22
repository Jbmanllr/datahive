// Datahive>index.js
import { isMainThread, parentPort } from "worker_threads";
import ProcessManager from "./process-manager";
import WorkerManager from "./worker-manager";
import { Mutex } from "async-mutex";
import goGather from "./databee/index"; // Ensure this path is correct
import { RunManager, RunInstance } from "./run-manager";
//import { fileURLToPath } from 'url';

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
  public activeRuns: Map<string, RunInstance>;
  public runManager: RunManager;

  private processManager: ProcessManager;
  private workerManager: WorkerManager;
  private processPath: string;
  private mutex: Mutex;

  private constructor() {
    this.activeRuns = new Map();
    this.runManager = new RunManager();
    this.processManager = new ProcessManager();
    this.workerManager = new WorkerManager();
    this.processPath =
      "/directus/extensions/directus-extension-datahive/dist/api.js";
    this.mutex = new Mutex();
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
  ): Promise<void> {
    const run = await this.runManager.startRun(
      caller,
      projectId,
      runId,
      operation
    );
    let config = run.config;

    config ? config : defaultModuleConfig;

    let multiprocess = config.multiprocess;
    let multithread = config.multithread;
    let child_process_type = config.child_process_type;

    try {
      let activeProcess = null;

      if (multiprocess) {
        activeProcess = await this.processManager.createProcess({
          caller,
          projectId: run.project.data.id,
          runId: run.data?.id,
          processPath: this.processPath,
          config,
        });
        run.process_id = activeProcess.pid;
        activeProcess.send({ command: "start", run });
        activeProcess.on("message", (message) => {
          console.log("Message from child:", message);
          if (
            //@ts-ignore
            message.command === "completed" ||
            //@ts-ignore
            message.command === "aborted" ||
            //@ts-ignore
            message.command === "stopped"
          ) {
            //@ts-ignore
            const status = message.command;
            this.processManager.terminateProcess(run.process_id);
            this.runManager.endRun(caller, run.data!.id, status);
          }
        });
      } else {
        activeProcess = await this.processManager.getOrCreateActiveProcess(
          caller,
          run.project.data.id,
          run.data!.id,
          this.processPath,
          config
        );
        activeProcess.send({ command: "startWorker", run });
      }

      console.log("Datahive Instance", Datahive.getInstance());
    } catch (error) {
      console.error("Error in starting process:", error);
      throw error;
    }
  }

  public async initRun(
    caller: string,
    projectId: string | null,
    runId: string | null,
    operation: "start" | "resume"
  ): Promise<RunInstance> {
    if (!caller) {
      throw new Error("Caller name is required.");
    }

    if (
      (operation === "start" && !projectId) ||
      (operation === "resume" && !runId)
    ) {
      throw new Error(
        `Both Project ID and Run ID are required for ${operation}.`
      );
    }

    let run: RunInstance;
    const release = await this.mutex.acquire();

    try {
      run = new RunInstance();

      if (operation === "start") {
        run = await run.startNew(projectId!, caller);
      } else {
        run = await run.resume(runId!, caller);
      }

      if (run && run.data) {
        this.activeRuns.set(run.data.id, run);
      }
    } catch (error) {
      throw error;
    } finally {
      release();
    }

    console.log("Active Runs", this.activeRuns);
    //await this.startProcess(caller, run);
    return run;
  }

  public async endRun(
    caller: string,
    runId: string,
    status: string = "aborted"
  ): Promise<void> {
    const run = this.activeRuns.get(runId);

    if (run) {
      //await run.end(status, run.config);
      this.runManager.endRun(caller, run.data!.id, status);
      this.processManager.terminateProcess(run.process_id);
      this.activeRuns.delete(runId);
      console.log(`Run ${runId} ended with status: ${status}`);
    } else {
      console.error(`Run ${runId} not found.`);
    }
  }

  // Method to manage worker threads
  public async manageThreads(): Promise<void> {
    if (isMainThread) {
      this.handleMainThreadMessages();
    } else {
      this.handleWorkerThreadLogic();
    }
  }

  // Handle main thread messages
  private async handleMainThreadMessages(): Promise<void> {
    console.log("handle Main ThreadMessages", process.pid, process.ppid);

    process.on("message", async (message: any) => {
      if (message.command === "start") {
        try {
          const result = await goGather(message.run);
          console.log(
            `goGather completed for project ID: ${message.run.project.id}`,
            result
          );
          //this.processManager.terminateProcess(process);
          //parentPort?.postMessage({ status: 'completed', result });
        } catch (error) {
          console.error(
            `Error in goGather for project ID: ${message.run.project.id}:`,
            error
          );
          //this.processManager.terminateProcess(process);
          //parentPort?.postMessage({ status: 'error', error });
        }
      }
      if (message.command === "startWorker") {
        const worker = await this.workerManager.createWorker(this.processPath, {
          projectId: message.projectId,
        });
        const workerId = worker.threadId;

        console.log(`Worker created with ID !!: ${workerId}`);

        worker.on("message", async (message) => {
          console.log("RECEIVED MESSAGE???");
          if (message.status === "completed" || message.status === "error") {
            console.log(
              `Worker ${workerId} ${
                message.status === "completed"
                  ? "completed its task"
                  : "encountered an error"
              }.`
            );
            await this.workerManager.terminateWorker(workerId);
          }
        });

        worker.on("exit", async (code) => {
          console.log(`Worker ${workerId} stopped with exit code ${code}`);
          await this.workerManager.terminateWorker(workerId);
        });

        worker.postMessage({
          projectId: message.projectId,
          workerId,
          config: message.config,
        });
      } else if (message.command === "heartbeat") {
        if (typeof process.send === "function") {
          process.send("alive");
        }
      }
    });
  }

  // Handle worker thread logic
  private handleWorkerThreadLogic(): void {
    console.log("Handling worker thread logic"); 
    if (parentPort) {
      parentPort.on("message", async (message) => {
        const workerId = message.workerId;
        console.log("message", message);
        // Override console functions
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
): Promise<RunInstance> {
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
    //@ts-ignore
    return response;
  } catch (error: any) {
    throw new Error("GNEGNEGNEG" + error);
  }
}

(async () => {
  if (process.env.IS_CHILD_PROCESS) {
    const processName = process.env.PROCESS_NAME;
    process.title = processName ? processName : "Datahive";
  }

  await datahive.manageThreads();
})();

// Datahive>index.js
import { isMainThread, parentPort } from "worker_threads";
import ProcessManager, { IProcessManager } from "./process-manager";
import WorkerManager, { IWorkerManager } from "./worker-manager";
import { Mutex } from "async-mutex";
import goGather from "./databee/index"; // Ensure this path is correct
import { DatabeeProjectData, DatabeeConfig } from "./databee/types";
import { apiRequest } from "./connectors/index";
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

export class ConfigService {
  static async fetchConfig(caller: string): Promise<DatabeeConfig> {
    try {
      const response = await apiRequest({
        method: "GET",
        collection: caller,
        id: "config",
      });
      return response.data;
    } catch (error: any) {
      throw new Error("Failed to fetch config: " + error.message);
    }
  }
}

class Datahive {
  private static instance: Datahive;

  //private activeRuns: Map<string, Run>;
  private processManager: ProcessManager;
  private workerManager: WorkerManager;
  private mutex: Mutex;
  private currentFilePath: string;
  private processPath: string;

  private constructor() {
    this.processManager = new ProcessManager();
    this.workerManager = new WorkerManager();
    this.mutex = new Mutex();
    this.currentFilePath =
      "/directus/extensions/directus-extension-datahive/dist/api.js";
    this.processPath = this.currentFilePath;
  }

  public static getInstance(): Datahive {
    if (!Datahive.instance) {
      Datahive.instance = new Datahive();
    }
    return Datahive.instance;
  }

  public async start(
    caller: string,
    projectId: string,
    runId: string
  ): Promise<void> {
    if (!projectId || !caller) {
      throw new Error("Both Project ID and caller name are required.");
    }

    const release = await this.mutex.acquire();
    let config = await ConfigService.fetchConfig(caller);

    config ? config : defaultModuleConfig;

    let multiprocess = config.multiprocess;
    let multithread = config.multithread;
    let child_process_type = config.child_process_type;

    try {
      let activeProcess = null;

      if (multiprocess) {
        activeProcess = await this.processManager.createProcess({
          caller,
          projectId,
          runId,
          processPath: this.processPath,
          config,
        });
        activeProcess.send({ command: "start", projectId, config });
      } else {
        activeProcess = await this.processManager.getOrCreateActiveProcess(
          caller,
          projectId,
          runId,
          this.processPath,
          config
        );
        activeProcess.send({ command: "startWorker", projectId, config });
      }

      console.log("Datahive STATUS", Datahive.getInstance());
    } catch (error) {
      console.error("Error in starting process:", error);
      throw error;
    } finally {
      release();
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
    console.log("handleMainThreadMessages", process.pid, process.ppid);

    process.on("message", async (message: any) => {
      if (message.command === "start") {
        try {
          const result = await goGather(
            message.projectId,
            null,
            message.config
          );
          console.log(
            `goGather completed for project ID: ${message.projectId}`,
            result
          );
          this.processManager.terminateProcess(process);
          //parentPort?.postMessage({ status: 'completed', result });
        } catch (error) {
          console.error(
            `Error in goGather for project ID: ${message.projectId}:`,
            error
          );
          this.processManager.terminateProcess(process);
          //parentPort?.postMessage({ status: 'error', error });
        }
      }
      if (message.command === "startWorker") {
        const worker = await this.workerManager.createWorker(
          this.currentFilePath,
          { projectId: message.projectId }
        );
        const workerId = worker.threadId;

        console.log(`Worker created with ID !!: ${workerId}`);

        worker.on("message", async (message) => {
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

        worker.postMessage({ projectId: message.projectId, workerId });
      } else if (message.command === "heartbeat") {
        if (typeof process.send === "function") {
          process.send("alive");
        }
      }
    });
  }

  // Handle worker thread logic
  private handleWorkerThreadLogic(): void {
    console.log("handleWorkerThreadLogic ");
    if (parentPort) {
      parentPort.on("message", async (message) => {
        const workerId = message.workerId;

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
          const result = await goGather(
            message.projectId,
            null,
            message.config
          );
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
  projectId: string,
  runId: string
): Promise<void> {
  if (type === "start") {
    datahive.start(caller, projectId, runId);
  }
  if (type === "pause") {
    console.log("PAUSE NOT IMPLEMENTED");
  }
  if (type === "resume") {
    console.log("RESUME NOT IMPLEMENTED");
  }
}

(async () => {
  if (process.env.IS_CHILD_PROCESS) {
    const processName = process.env.PROCESS_NAME;
    process.title = processName ? processName : "Datahive";
  }

  await datahive.manageThreads();
})();

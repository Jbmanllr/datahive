// Orchestrator>index.js
import { isMainThread, parentPort } from 'worker_threads';
import ProcessManager, { IProcessManager } from './process-manager';
import WorkerManager, { IWorkerManager } from './worker-manager';
import { Mutex } from 'async-mutex';
import goGather from '../databee/index'; // Ensure this path is correct
import { Databee } from '../databee/index';
//import { fileURLToPath } from 'url';

const MULTIPROCESS: boolean = true;

class Orchestrator {
  private static instance: Orchestrator;

  //private activeRuns: Map<string, Run>;
  private processManager: ProcessManager;
  private workerManager: WorkerManager;
  private mutex: Mutex;
  private multiprocess: boolean;
  private multithread: boolean;
  private child_process_type: "fork" | "spawn";
  private currentFilePath: string;
  private processPath: string;

  private constructor() {
    this.processManager = new ProcessManager();
    this.workerManager = new WorkerManager();
    this.mutex = new Mutex();
    this.multiprocess = true;
    this.multithread = true;
    this.child_process_type = "fork";
    this.currentFilePath = '/directus/extensions/directus-extension-datahive/dist/api.js';
    this.processPath = this.currentFilePath;
  }

  public static getInstance(): Orchestrator {
    if (!Orchestrator.instance) {
      Orchestrator.instance = new Orchestrator();
    }
    return Orchestrator.instance;
  }

  public async start(caller: string, projectId: string): Promise<void> {

    if (!projectId || !caller) {
      throw new Error('Both Project ID and caller name are required.');
    }

    const release = await this.mutex.acquire();

    let config;
    if (caller === 'databee') {
      config = await Databee.getConfig()
    }

    this.multiprocess = config ? config.multiprocess : this.multiprocess;
    this.multithread = config ? config.multithread : this.multithread;
    this.child_process_type = config ? config.child_process_type : this.child_process_type;

    console.log(
      "multiprocess", this.multiprocess,
      "multithread", this.multithread,
      "child_process_type", this.child_process_type,
      "config", config
    );

    try {
      let activeProcess = null;

      if (this.multiprocess) {
        activeProcess = await this.processManager.createProcess({
          caller,
          projectId,
          runId: null,
          processPath: this.processPath,
          config
        });
        activeProcess.send({ command: 'start', projectId });
      } else {
        activeProcess = await this.processManager.getOrCreateActiveProcess(caller, projectId, this.processPath);
        activeProcess.send({ command: 'startWorker', projectId });
      }

      console.log('ORCHESTRATOR STATUS', Orchestrator.getInstance());
    } catch (error) {
      console.error('Error in starting process:', error);
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
    console.log('handleMainThreadMessages', process.pid, process.ppid)

    process.on('message', async (message: any) => {
      if (message.command === 'start') {
        try {
          //console.log('DATABEE LOG 2', instance);
          const result = await goGather(message.projectId, null, config);
          console.log(`goGather completed for project ID: ${message.projectId}`, result);
          this.processManager.terminateProcess(process)
          //parentPort?.postMessage({ status: 'completed', result });
        } catch (error) {
          console.error(`Error in goGather for project ID: ${message.projectId}:`, error);
          this.processManager.terminateProcess(process)
          //parentPort?.postMessage({ status: 'error', error });
        }
      }
      if (message.command === 'startWorker') {
        const worker = await this.workerManager.createWorker(this.currentFilePath, { projectId: message.projectId });
        const workerId = worker.threadId;

        console.log(`Worker created with ID !!: ${workerId}`);

        worker.on('message', async (message) => {
          if (message.status === 'completed' || message.status === 'error') {
            console.log(`Worker ${workerId} ${message.status === 'completed' ? 'completed its task' : 'encountered an error'}.`);
            await this.workerManager.terminateWorker(workerId);
          }
        });

        worker.on('exit', async (code) => {
          console.log(`Worker ${workerId} stopped with exit code ${code}`);
          await this.workerManager.terminateWorker(workerId);
        });

        worker.postMessage({ projectId: message.projectId, workerId });
      } else if (message.command === 'heartbeat') {
        if (typeof process.send === 'function') {
          process.send('alive');
        }
      }
    });
  }

  // Handle worker thread logic
  private handleWorkerThreadLogic(): void {
    console.log('handleWorkerThreadLogic ')
    if (parentPort) {
      parentPort.on('message', async (message) => {
        const workerId = message.workerId;

        // Override console functions
        const originalConsoleLog = console.log;
        const originalConsoleWarn = console.warn;
        const originalConsoleError = console.error;

        console.log = (...args) => originalConsoleLog(`[W-${workerId}]`, ...args);
        console.warn = (...args) => originalConsoleWarn(`[W-${workerId}]`, ...args);
        console.error = (...args) => originalConsoleError(`[W-${workerId}]`, ...args);

        try {
          //console.log('DATABEE LOG 3', instance);
          const result = await goGather(message.projectId, null, config);
          parentPort?.postMessage({ status: 'completed', result });
        } catch (error) {
          console.error(`Error in worker:`, error);
          parentPort?.postMessage({ status: 'error', error });
        }
      });
    }
  }
}

(async () => {
  const orchestrator = Orchestrator.getInstance();
  if (process.env.IS_CHILD_PROCESS) {
    const processName = process.env.PROCESS_NAME
    process.title = processName ? processName : "Datahive";
  }

  await orchestrator.manageThreads();
})();

export async function relay(caller: string, type: string, projectId: string) {
  const orchestrator = Orchestrator.getInstance();
  if (type === 'start') {
    orchestrator.start(caller, projectId);
  }
  if (type === 'pause') {
    console.log("PAUSE NOT IMPLEMENTED");
  }
  if (type === 'resume') {
    console.log("RESUME NOT IMPLEMENTED");
  }
}



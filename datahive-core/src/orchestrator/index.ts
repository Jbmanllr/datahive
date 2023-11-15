// Import necessary modules and functions
import { isMainThread, parentPort } from 'worker_threads';
import ProcessManager from './process-manager';
import WorkerManager from './worker-manager';
import { Mutex } from 'async-mutex';
import goGather from '../databee/index'; // Ensure this path is correct
//import { fileURLToPath } from 'url';

const MULTIPROCESS = true;

class Orchestrator {
  processManager = new ProcessManager();
  workerManager = new WorkerManager();
  mutex = new Mutex();
  multiprocess = MULTIPROCESS;
  currentFilePath = '/directus/extensions/directus-extension-datahive/dist/api.js';
  processPath = this.currentFilePath;

  // Method to start a process
  async startProcess(caller: string, projectId: string) {

    if (!projectId || !caller) {
      throw new Error('Both Project ID and caller name are required.');
    }
    const release = await this.mutex.acquire();
    console.log(`Starting new ${caller} run for project ID ${projectId}`);
    let activeProcess = null;
    try {
      if (this.multiprocess) {

        activeProcess = await this.processManager.createProcess({
          caller,
          projectId,
          runId: null,
          processPath: this.processPath
        });
        activeProcess.send({ command: 'start', projectId });
        console.log('ORCHESTRATOR STATUS', orchestrator);
      } else {

        let latestProcessStartTime = 0;
        for (let [pid, processInfo] of this.processManager.getActiveProcesses()) {
          const isAlive = await this.processManager.checkProcessHealth(processInfo.process);
          if (isAlive && processInfo.startTime > latestProcessStartTime) {
            activeProcess = processInfo.process;
            latestProcessStartTime = processInfo.startTime;
          }
        }

        if (!activeProcess) {
          activeProcess = await this.processManager.createProcess({
            caller,
            projectId,
            runId: null,
            processPath: this.processPath
          });
        }
        activeProcess.send({ command: 'startWorker', projectId });
        console.log('ORCHESTRATOR STATUS', orchestrator);
      }
    } catch (error) {
      console.error('Error in starting Databee process:', error);
      throw error;
    } finally {
      release();
    }
  }

  // Method to manage worker threads
  async manageThreads() {
    if (isMainThread) {
      this.handleMainThreadMessages();
    } else {
      this.handleWorkerThreadLogic();
    }
  }

  // Handle main thread messages
  private async handleMainThreadMessages() {
    console.log('handleMainThreadMessages', process.pid, process.ppid)

    process.on('message', async (message: any) => {
      if (message.command === 'start') {
        try {
          const result = await goGather(message.projectId, null);
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
  private handleWorkerThreadLogic() {
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
          const result = await goGather(message.projectId, null);
          parentPort?.postMessage({ status: 'completed', result });
        } catch (error) {
          console.error(`Error in worker:`, error);
          parentPort?.postMessage({ status: 'error', error });
        }
      });
    }
  }
}

const orchestrator = new Orchestrator();

(async () => {
  if (process.env.IS_CHILD_PROCESS) {
    const processName = process.env.PROCESS_NAME
    process.title = processName ? processName : "Datahive";
  }

  await orchestrator.manageThreads();
})();

export async function relay(caller: string, type: string, projectId: string) {
  if (type === 'start') {
    orchestrator.startProcess(caller, projectId);
  }
  if (type === 'pause') {
    console.log("PAUSE NOT IMPLEMENTED");
  }
  if (type === 'resume') {
    console.log("RESUME NOT IMPLEMENTED");
  }
}



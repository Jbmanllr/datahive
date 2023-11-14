// Import necessary modules and functions
import { isMainThread, parentPort, Worker } from 'worker_threads';
import ProcessManager from './process-manager.js';
import WorkerManager from './worker-manager.js';
import { Mutex } from 'async-mutex';
import goGather from './index.js'; // Ensure this path is correct
import { fileURLToPath } from 'url';

// Define the Orchestrator class
export default class Orchestrator {
  processManager = new ProcessManager();
  workerManager = new WorkerManager();
  mutex = new Mutex();
  differentProcessForEachRun = false;
  
  currentFilePath = fileURLToPath(import.meta.url);
  processPath = this.currentFilePath;

  // Method to start a process
  async startProcess(caller: string, projectId: string) {
    console.log("ORCHESTRATOR TEST UPDATE I BEG YOUuuuuuuu");

    if (!projectId || !caller) {
      throw new Error('Both Project ID and caller name are required.');
    }

    const release = await this.mutex.acquire();
    try {
      if (this.differentProcessForEachRun) {
        await this.processManager.createProcess({
          projectId,
          runId: null,
          processPath: this.processPath
        });
      } else {
        let activeProcess = null;
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
            projectId,
            runId: null,
            processPath: this.processPath
          });
        }

        activeProcess.send({ command: 'startWorker', projectId });
      }
    } catch (error) {
      console.error('Error in starting Databee process:', error);
      throw error;
    } finally {
      release();
    }
  }

  // Method to manage worker threads
  async manageWorkerThreads() {
    if (isMainThread) {
      this.handleMainThreadMessages();
    } else {
      this.handleWorkerThreadLogic();
    }
  }

  // Handle main thread messages
  private handleMainThreadMessages() {
    process.on('message', async (message: any) => {
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

// Execute the orchestrator logic
(async () => {
  const orchestrator = new Orchestrator();
  await orchestrator.manageWorkerThreads();
})();



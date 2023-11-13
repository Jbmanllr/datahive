//process.ts
import { isMainThread, parentPort } from 'worker_threads';
import goGather from './index.js'; // Ensure this path is correct
import { fileURLToPath } from 'url';
import WorkerManager from './worker-manager.js';

const workerManager = new WorkerManager();
const currentFilePath = fileURLToPath(import.meta.url);
const differentProcessForEachRun = false;

(async () => {
  process.title = 'Databee';

  console.log("Process go okkkkked", process.title);
  if (differentProcessForEachRun) {
    const projectId = process.env.PROJECT_ID;
    const runId = process.env.RUN_ID;

    console.log("Project ID, Run ID", projectId, runId);

    try {
      const result = await goGather(projectId, null);
      console.log(`goGather completed for project ID: ${projectId}`, result);
      process.exit(0); // Exit the process after completion
    } catch (error) {
      console.error(`Error in goGather for project ID: ${projectId}:`, error);
      process.exit(1); // Exit with error code
    }
  } else if (isMainThread) {
    process.on('message', async (message: any) => {
      if (message.command === 'startWorker') {
        const worker = await workerManager.createWorker(currentFilePath, { projectId: message.projectId });
        const workerId = worker.threadId;

        console.log(`Worker created with ID !!: ${workerId}`);

        worker.on('message', async (message) => {
          if (message.status === 'completed' || message.status === 'error') {
            console.log(`Worker ${workerId} ${message.status === 'completed' ? 'completed its task' : 'encountered an error'}.`);
            await workerManager.terminateWorker(workerId);
          }
        });

        worker.on('exit', async (code) => {
          console.log(`Worker ${workerId} stopped with exit code ${code}`);
          await workerManager.terminateWorker(workerId);
        });

        worker.postMessage({ projectId: message.projectId, workerId });
      } else if (message.command === 'heartbeat') {
        // Respond to heartbeat check
        if (typeof process.send === 'function') {
          process.send('alive');
        }
      }
    });
  } else {
    // Worker thread logic
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
          // Notify main thread that the task is complete
          parentPort?.postMessage({ status: 'completed', result });
        } catch (error) {
          console.error(`Error in worker:`, error);
          // Notify main thread that there is an error
          parentPort?.postMessage({ status: 'error', error });
        }
      });
    }
  }
}
)();
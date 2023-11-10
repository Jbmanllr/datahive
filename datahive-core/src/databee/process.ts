import { Worker, isMainThread, parentPort } from 'worker_threads';
import goGather from './main.js'; // Ensure this path is correct
import { fileURLToPath } from 'url';

const currentFilePath = fileURLToPath(import.meta.url);
const projectId = process.argv[2]; // Get the projectId from the command line arguments
const workers = new Map();

function generateWorkerId(worker: Worker) {
  return `${process.pid}-${worker.threadId}`;
}

// Function to handle worker termination
function terminateWorker(workerId: string) {
  const worker = workers.get(workerId);
  if (worker) {
    worker.terminate().then(() => {
      console.log(`Worker ${workerId} terminated.`);
    }).catch((error: any) => {
      console.error(`Error terminating worker ${workerId}:`, error);
    });

    // Remove the worker from the map
    workers.delete(workerId);

    // Check if there are no more active workers
    if (workers.size === 0) {
      console.log('No active workers left. Terminating the process.');
      process.exit(0); // or use a different exit code if needed
    }
  }
}

(async () => {
  process.title = 'databee';

  console.log("Process", projectId, process.title);

  if (isMainThread) {
    process.on('message', (message: any) => {
      if (message.command === 'startWorker') {
        const worker = new Worker(currentFilePath);
        const workerId = generateWorkerId(worker);
        workers.set(workerId, worker);
        console.log(`Worker created with ID !!: ${workerId}`);

        worker.on('message', (message) => {
          if (message.status === 'completed' || message.status === 'error') {
            console.log(`Worker ${workerId} ${message.status === 'completed' ? 'completed its task' : 'encountered an error'}.`);
            terminateWorker(workerId);
          }
        });

        worker.on('exit', (code) => {
          console.log(`Worker ${workerId} stopped with exit code ${code}`);
          terminateWorker(workerId);
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
      let workerId = '';

      parentPort.on('message', async (message) => {
        if (message.workerId) {
          workerId = message.workerId;

          // Override console functions
          const originalConsoleLog = console.log;
          const originalConsoleWarn = console.warn;
          const originalConsoleError = console.error;

          console.log = (...args) => originalConsoleLog(`[${workerId}]`, ...args);
          console.warn = (...args) => originalConsoleWarn(`[${workerId}]`, ...args);
          console.error = (...args) => originalConsoleError(`[${workerId}]`, ...args);
        }

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
})();

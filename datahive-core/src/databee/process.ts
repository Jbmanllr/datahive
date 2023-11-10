import { Worker, isMainThread, parentPort } from 'worker_threads';
import goGather from './main.js'; // Ensure this path is correct
import { fileURLToPath } from 'url';

const currentFilePath = fileURLToPath(import.meta.url);
const projectId = process.argv[2]; // Get the projectId from the command line arguments
const workers = new Map();

function generateWorkerId(worker: Worker) {
  return `${process.pid}/${worker.threadId}`;
}

(async () => {
  process.title = 'databee';

  console.log("Process", projectId, process.title);

  if (isMainThread) {
    // Main thread logic
    process.on('message', (message: any) => {
      if (message.command === 'startWorker') {
        const worker = new Worker(currentFilePath);
        const workerId = generateWorkerId(worker);
        workers.set(workerId, worker);
        console.log(`Worker created with ID: ${workerId}`);

        worker.on('message', (message) => {
          console.log(`Message from worker ${workerId}:`, message);
        });

        worker.on('exit', (code) => {
          console.log(`Worker ${workerId} stopped with exit code ${code}`);
          workers.delete(workerId);
        });

        worker.postMessage({ projectId: message.projectId, workerId });
      }
    });
  } else {
    // Worker thread logic
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
          parentPort?.postMessage(result);
        } catch (error) {
          console.error(`[${workerId}] Error in worker:`, error);
          process.exit(1);
        }
      });
    }

  }
})();

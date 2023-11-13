// processOrchestrator.js
import ProcessManager from './process-manager.js';
import { Mutex } from 'async-mutex';

const processManager = new ProcessManager();
const mutex = new Mutex();
const differentProcessForEachRun = false;
const processPath = 'datahive-core/dist/databee/process.js';

async function startProcess(caller: string, projectId: string): Promise<void> {
console.log("ORCHESTRATOR TEST UPDATEx")
  if (!projectId || !caller) {
    throw new Error('Both Project ID and caller name are required.');
  }

  const release = await mutex.acquire();
  try {
    if (differentProcessForEachRun) {
      await processManager.createProcess({
        projectId,
        runId: null,
        processPath: processPath
      });
    } else {
      let activeProcess = null;
      let latestProcessStartTime = 0;
      for (let [pid, processInfo] of processManager.getActiveProcesses()) {
        const isAlive = await processManager.checkProcessHealth(processInfo.process);
        if (isAlive && processInfo.startTime > latestProcessStartTime) {
          activeProcess = processInfo.process;
          latestProcessStartTime = processInfo.startTime;
        }
      }

      if (!activeProcess) {
        activeProcess = await processManager.createProcess({
          projectId,
          runId: null,
          processPath: processPath
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

export { startProcess };

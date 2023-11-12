// processOrchestrator.js
import ProcessManager from './process-manager.js';
import { Mutex } from 'async-mutex';

const processManager = new ProcessManager();
const mutex = new Mutex();
const differentProcessForEachRun = false;

async function startProcess(projectId: string) {
  console.log('startProcess', projectId)
  const release = await mutex.acquire();
  try {
    if (differentProcessForEachRun) {
      await processManager.createProcess({
        projectId,
        //@ts-ignore
        runId: null,
        differentProcessForEachRun
      });
    } else {
      let activeProcess = null;
      let latestProcessStartTime = 0;
console.log('PROCESS AND WORKERS MODE')
      //@ts-ignore
      for (let [pid, processInfo] of processManager.getActiveProcesses()) {
        console.log('ACTIVE PROCESSES')
        const isAlive = await processManager.checkProcessHealth(processInfo.process);
        if (isAlive && processInfo.startTime > latestProcessStartTime) {
          activeProcess = processInfo.process;
          latestProcessStartTime = processInfo.startTime;
        }
      }

      if (!activeProcess) {
        activeProcess = await processManager.createProcess({
          projectId,
          //@ts-ignore
          runId: null,
          differentProcessForEachRun
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

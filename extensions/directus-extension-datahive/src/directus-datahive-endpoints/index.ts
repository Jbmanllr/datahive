//import { defineEndpoint } from '@directus/extensions-sdk';
//import goGather from 'datahive-core/dist/databee/main.js'
import { testFC, runPollinator } from '../datahive-core/pollinator/index.js'
import { fork, ChildProcess } from 'child_process';
import { Mutex } from 'async-mutex';
import ps from 'ps-node'

const databeeProcessPath = '/datahive-core/databee/process.js' 
 
const mutex = new Mutex();
const differentProcessForEachRun = true;
const activeDatabeeProcesses = new Map();

interface DatabeeProcessInfo {
  process: ChildProcess;
  startTime: number;
}

function checkForExistingProcesses(title: string, args: any) {
  return new Promise((resolve, reject) => {
    ps.lookup({
      command: title,
      psargs: 'ux'
    }, function (err, resultList) {
      if (err) {
        reject(err);
        return;
      }

      console.log("Existing Databee Process(es): ", resultList);
      const foundProcess = resultList.find(p => p.command === title);

      resolve(foundProcess); // Resolve with the found process or `undefined` if not found
    });
  });
}


function logWithPrefix(prefix: any, message: any) {
  const yellow = '\x1b[33m';
  const reset = '\x1b[0m';
  console.log(`${yellow}${prefix} ${message}${reset}`);
}

function checkProcessHealth(process: ChildProcess) {
  return new Promise((resolve) => {
    if (process && !process.killed && process.connected) {
      const timeout = setTimeout(() => {
        resolve(false); // No response within timeout, process is not healthy
      }, 5000); // Set an appropriate timeout duration

      process.once('message', (message: any) => {
        if (message === 'alive') {
          console.log(`Process  ${process.pid} exist and is alive !`);
          clearTimeout(timeout);
          resolve(true); // Process responded, it's alive
        }
      });

      // Send a heartbeat message here
      try {
        process.send({ command: 'heartbeat' });
      } catch (error) {
        console.error('Error sending heartbeat:', error);
        clearTimeout(timeout);
        resolve(false); // Error occurred, process is not healthy
      }
    } else {
      console.log(`Process ${process.pid} doesn't exist !`);
      resolve(false); // Process is not alive or not connected
    }
  });
}


async function createDatabeeProcess({
  projectId,
  runId,
  differentProcessForEachRun
}: any) {
  try {
    console.log('Starting a new Databee process...');
    const databeeProcess = fork(databeeProcessPath, [projectId, '--name=Databee'], {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      detached: false,
      env: {
        ...process.env,
        PROJECT_ID: projectId,
        RUN_ID: runId,
        PROCESS_NAME: 'Databee',
        DPFER: differentProcessForEachRun
      }
    });

    databeeProcess.stdout?.on('data', (data) => {
      logWithPrefix(`[Databee (${databeeProcess.pid})]: `, data.toString());
    });

    databeeProcess.stderr?.on('data', (data) => {
      logWithPrefix(`[Databee (${databeeProcess.pid})]: `, data.toString());
    });

    databeeProcess.on('exit', () => {
      activeDatabeeProcesses.delete(databeeProcess.pid);
      console.log(` Exited & Removed process ${databeeProcess.pid} from active processes.`);
    });

    // Add the new process to the map
    const processInfo = {
      process: databeeProcess,
      startTime: Date.now() // Current timestamp
    };

    activeDatabeeProcesses.set(databeeProcess.pid, processInfo);

    console.log("ACTIVE DATABEE PROCESS(ES)", activeDatabeeProcesses.size)

    return databeeProcess;
  } catch (error) {
    console.error('Error creating Databee process:', error);
    throw error; // Rethrow the error to be handled by the caller 
  }
}

async function terminateProcess(process: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    if (process && !process.killed) {
      process.kill();
      process.on('exit', () => {
        console.log(`Terminated process with PID: ${process.pid}`);
        activeDatabeeProcesses.delete(process.pid);
        resolve();
      });
    } else {
      resolve();
    }
  });
}

export default {
  id: "datahive",
  handler: (router: any) => {
    // Pollinator routes

    router.get("/pollinator/info/runs/:projectId", async (req: any, res: any) => {
      const message = `POLLINATOR GET RUNNING RUNS INFO - PROJECT ID: ${req.params.projectId}, Query: ${JSON.stringify(req.query)}`;
      console.log(message);
      res.send(message);
    });

    router.get("/pollinator/info/run/:runId", async (req: any, res: any) => {
      const message = `POLLINATOR GET RUN INFO - RUN ID: ${req.params.runId}, Query: ${JSON.stringify(req.query)}`;
      console.log(message);
      res.send(message);
    });

    router.get("/pollinator/start/:projectId", async (req: any, res: any) => {
      try {
        const message = `POLLINATOR START NEW RUN - PROJECT ID: ${req.params.projectId}, Query: ${JSON.stringify(req.query)}`;
        console.log(message);
        await runPollinator();
        await testFC();

        res.send(message);
      } catch (error) {
        console.error("Error running pollinator:", error);
        res.status(500).send("Error running pollinator");
      }
    });

    router.get("/pollinator/pause/:runId", (req: any, res: any) => {
      const message = `POLLINATOR PAUSE - RUN ID: ${req.params.runId}`;
      console.log(message);
      res.send(message);
    });

    router.get("/pollinator/resume/:runId", (req: any, res: any) => {
      const message = `POLLINATOR RESUME - RUN ID: ${req.params.runId}`;
      console.log(message);
      res.send(message);
    });

    router.get("/pollinator/finish/:runId", (req: any, res: any) => {
      const message = `POLLINATOR FINISH - RUN ID: ${req.params.runId}`;
      console.log(message);
      res.send(message);
    });

    // Databee routes
    router.get("/databee/info/runs/:projectId", async (req: any, res: any) => {
      const message = `DATABEE GET RUNNING RUNS INFO - PROJECT ID: ${req.params.projectId}, Query: ${JSON.stringify(req.query)}`;
      console.log(message);
      res.send(message);
    });

    router.get("/databee/info/run/:runId", async (req: any, res: any) => {
      const message = `DATABEE GET RUN INFO - RUN ID: ${req.params.runId}, Query: ${JSON.stringify(req.query)}`;
      console.log(message);
      res.send(message);
    });

    router.get("/databee/start/:projectId", async (req: any, res: any) => {
      const release = await mutex.acquire();
      try {
        const projectId = req.params.projectId;
        logWithPrefix('DATABEE', `START NEW RUN - PROJECT ID: ${projectId}`);

        if (differentProcessForEachRun) {
          // Always create a new process for each run
          await createDatabeeProcess({
            projectId: projectId,
            runId: null,
            differentProcessForEachRun: differentProcessForEachRun
          });
        } else {
          let activeProcess = null;
          let latestProcessStartTime = 0;

          for (let [processInfo] of activeDatabeeProcesses) {
            const isAlive = await checkProcessHealth(processInfo.process);
            if (isAlive && processInfo.startTime > latestProcessStartTime) {
              activeProcess = processInfo.process;
              latestProcessStartTime = processInfo.startTime;
            }
          }

          if (!activeProcess) {
            //const existingProcesses = await checkForExistingProcesses("Databee", null)
            activeProcess = await createDatabeeProcess({ projectId: projectId });
          }

          // Send a message to the databee process to start a new worker
          activeProcess.send({ command: 'startWorker', projectId }, (error: any) => {
            if (error) {
              console.error('Error sending message to Databee process:', error);
            }
          });
        }

        res.send(`Databee process started for project ID: ${projectId}`);
      } catch (error) {
        console.error("Error in starting Databee process:", error);
        res.status(500).send("Error in starting Databee process");
      } finally {
        release();
      }
    });


    router.get("/databee/pause/:runId", (req: any, res: any) => {
      const message = `DATABEE PAUSE - RUN ID: ${req.params.runId}`;
      console.log(message);
      res.send(message);
    });

    router.get("/databee/resume/:runId", (req: any, res: any) => {
      const message = `DATABEE RESUME - RUN ID: ${req.params.runId}`;
      console.log(message);
      res.send(message);
    });

    router.get("/databee/finish/:runId", (req: any, res: any) => {
      const message = `DATABEE FINISH - RUN ID: ${req.params.runId}`;
      console.log(message);
      res.send(message);
    });

    // Honeycomb routes

    router.get("/honeycomb/info/runs/:projectId", async (req: any, res: any) => {
      const message = `HONEYCOMB GET RUNNING RUNS INFO - PROJECT ID: ${req.params.projectId}, Query: ${JSON.stringify(req.query)}`;
      console.log(message);
      res.send(message);
    });

    router.get("/honeycomb/info/run/:runId", async (req: any, res: any) => {
      const message = `HONEYCOMB GET RUN INFO - RUN ID: ${req.params.runId}, Query: ${JSON.stringify(req.query)}`;
      console.log(message);
      res.send(message);
    });

    router.get("/honeycomb/start/:projectId", async (req: any, res: any) => {
      const message = `HONEYCOMB START NEW RUN - PROJECT ID: ${req.params.projectId}, Query: ${JSON.stringify(req.query)}`;
      console.log(message);
      res.send(message);
    });

    router.get("/honeycomb/pause/:runId", (req: any, res: any) => {
      const message = `HONEYCOMB PAUSE - RUN ID: ${req.params.runId}`;
      console.log(message);
      res.send(message);
    });

    router.get("/honeycomb/resume/:runId", (req: any, res: any) => {
      const message = `HONEYCOMB RESUME - RUN ID: ${req.params.runId}`;
      console.log(message);
      res.send(message);
    });

    router.get("/honeycomb/finish/:runId", (req: any, res: any) => {
      const message = `HONEYCOMB FINISH - RUN ID: ${req.params.runId}`;
      console.log(message);
      res.send(message);
    });

    // Add more routes for each service as needed
  },
};

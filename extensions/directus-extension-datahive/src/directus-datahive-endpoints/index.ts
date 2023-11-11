//import { defineEndpoint } from '@directus/extensions-sdk';
//import goGather from 'datahive-core/dist/databee/main.js'
import { testFC, runPollinator } from 'datahive-core/dist/pollinator/index.js'
import { fork, ChildProcess } from 'child_process';
import { Mutex } from 'async-mutex';
import ps from 'ps-node'

const mutex = new Mutex();
const differentProcessForEachRun = true;
const activeDatabeeProcesses = new Map();

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

const databeeProcessPath = 'datahive-core/dist/databee/process.js'
let activeDatabeeProcess: ChildProcess | null = null;

// Define the checkProcessHealth function
function checkProcessHealth(process: ChildProcess) {
  console.log("CHECK PROCESS HEALTH")
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(false); // No response within timeout, process is not healthy
    }, 5000); // Set an appropriate timeout duration

    process.once('message', (message: any) => {
      if (message === 'alive') {
        console.log("PROCESS IS ALIVE")
        clearTimeout(timeout);
        resolve(true); // Process responded, it's alive
      }
    });
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
      console.log(`Databee process (${databeeProcess.pid}) exited`);
      activeDatabeeProcesses.delete(databeeProcess.pid);
      console.log(`Removed process ${databeeProcess.pid} from active processes.`);
    });

    // Add the new process to the map
    activeDatabeeProcesses.set(databeeProcess.pid, databeeProcess);

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
          // Handle the case where differentProcessForEachRun is false
          if (activeDatabeeProcess && !activeDatabeeProcess.killed) {
            activeDatabeeProcess.send({ command: 'heartbeat' });
            const isAlive = await checkProcessHealth(activeDatabeeProcess);

            if (!isAlive) {
              await terminateProcess(activeDatabeeProcess);
              activeDatabeeProcess = null;
            }
          }

          if (!activeDatabeeProcess) {
            const existingProcesses = await checkForExistingProcesses("Databee", null)
            activeDatabeeProcess = await createDatabeeProcess({ projectId: projectId });
          }

          // Send a message to the databee process to start a new worker
          activeDatabeeProcess.send({ command: 'startWorker', projectId }, (error) => {
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

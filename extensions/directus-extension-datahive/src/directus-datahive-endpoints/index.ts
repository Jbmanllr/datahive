import { testFC, runPollinator } from 'datahive-core/dist/pollinator/index.js'
import { Mutex } from 'async-mutex';
import ProcessManager from 'datahive-core/dist/databee/process-manager.js';

const mutex = new Mutex();
const differentProcessForEachRun = true;
const processManager = new ProcessManager();

function logWithPrefix(prefix: any, message: any) {
  const yellow = '\x1b[33m';
  const reset = '\x1b[0m';
  console.log(`${yellow}${prefix} ${message}${reset}`);
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
          await processManager.createProcess({
            projectId: projectId,
            //@ts-ignore
            runId: null,
            differentProcessForEachRun: differentProcessForEachRun
          });
        } else {
          let activeProcess = null;
          let latestProcessStartTime = 0;

          for (let [processInfo] of processManager.activeProcesses) {
            //@ts-ignore
            const isAlive = await processManager.checkProcessHealth(processInfo.process);
            //@ts-ignore
            if (isAlive && processInfo.startTime > latestProcessStartTime) {
              //@ts-ignore
              activeProcess = processInfo.process;
              //@ts-ignore
              latestProcessStartTime = processInfo.startTime;
            }
          }

          if (!activeProcess) {
            //const existingProcesses = await checkForExistingProcesses("Databee", null)
            activeProcess = await processManager.createProcess({
              projectId: projectId,
              //@ts-ignore
              runId: null,
              differentProcessForEachRun: differentProcessForEachRun
            });
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

//import { defineEndpoint } from '@directus/extensions-sdk';
//import goGather from 'datahive-core/dist/databee/main.js'
import { testFC, runPollinator } from 'datahive-core/dist/pollinator/index.js'
import { fork, ChildProcess } from 'child_process';

function logWithPrefix(prefix: any, message: any) {
  const yellow = '\x1b[33m';
  const reset = '\x1b[0m';
  console.log(`${yellow}${prefix} ${message}${reset}`);
}

const databeeProcessPath = 'datahive-core/dist/databee/process.js'
let activeDatabeeProcess: ChildProcess | null = null;

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

      const projectId = req.params.projectId;
      console.log(`DATABEE START NEW RUN TESTME - PROJECT ID: ${projectId}`);

      const children = {};

      if (!activeDatabeeProcess) {
        // Fork a new process if there isn't an active one
        activeDatabeeProcess = fork(databeeProcessPath, [projectId, '--name=databee'], {
          stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
          detached: true,
          env: { ...process.env, PROJECT_ID: projectId, PROCESS_NAME: 'databee' }
        });

        //@ts-ignore
        children[activeDatabeeProcess?.pid] = 'databee';

        if (activeDatabeeProcess?.stdout) {
          activeDatabeeProcess.stdout.on('data', (data) => {
            logWithPrefix(`[Databee (${activeDatabeeProcess?.pid})]: `, data.toString());
          });
        }
        if (activeDatabeeProcess?.stderr) {
          activeDatabeeProcess.stderr.on('data', (data) => {
            logWithPrefix(`[Databee (${activeDatabeeProcess?.pid})]: `, data.toString());
          });
        }
        activeDatabeeProcess.on('exit', () => {
          activeDatabeeProcess = null; // Reset when process exits
        });

        //activeDatabeeProcess.unref(); // This allows the parent process to exit independently of the spawned process
      }

      // Send a message to the databee process to start a new worker
      activeDatabeeProcess.send({ command: 'startWorker', projectId });

      res.send(`Databee process started for project ID: ${projectId}`);
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

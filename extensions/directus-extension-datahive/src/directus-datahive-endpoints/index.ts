//import { defineEndpoint } from '@directus/extensions-sdk';
import goGather from 'datahive-core/dist/databee/main.js'
import { testFC, runPollinator } from 'datahive-core/dist/pollinator/index.js'
import express from 'express';
import { spawn } from 'child_process';


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

			function logWithPrefix(prefix: any, message: any) {
				const yellow = '\x1b[33m';
				const reset = '\x1b[0m';
				console.log(`${yellow}${prefix} ${message}${reset}`);
			}

			const projectId = req.params.projectId;
			console.log(`DATABEE START NEW RUN test changrs - PROJECT ID: ${projectId}`);

			const children = {};

			// Spawn a new process to run the goGather function
			const child = spawn(process.execPath, ['datahive-core/dist/databee/process.js', projectId, '--name=databee'], {
				stdio: ['ignore', 'pipe', 'pipe', 'ipc'], // This will share the I/O with the parent process
				detached: true, // This will make the process independent of the parent
				env: { ...process.env, PROJECT_ID: projectId, PROCESS_NAME: 'databee' } // Pass environment variables if needed
			});

			//@ts-ignore
			children[child.pid] = 'databee';
			console.log("CHILDREN", children)

			if (child.stdout) {
				child.stdout.on('data', (data) => {
					logWithPrefix(`[Databee (${child.pid})]: `, data.toString());
				});
			}
			if (child.stderr) {
				child.stderr.on('data', (data) => {
					logWithPrefix(`[Databee (${child.pid})]: `, data.toString());
				});
			}
			child.unref(); // This allows the parent process to exit independently of the spawned process

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

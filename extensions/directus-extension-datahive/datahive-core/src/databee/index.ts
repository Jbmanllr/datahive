//databee index.js
import dotenv from "dotenv";
import CrawlerRunner from "./crawl-manager/index";
import RouterFactory from "./crawl-manager/routers/index";
import CrawlerFactory from "./crawl-manager/crawlers/index";
import { loadProjectHandlers } from "./crawl-manager/index";
import { Logger } from "../logger";
import { Configuration, KeyValueStore } from "crawlee";
import { parentPort } from "worker_threads";

dotenv.config();

export default async function GoGather(runInstance: any): Promise<void> {
  const routerFactory = new RouterFactory();
  const crawlerFactory = new CrawlerFactory();
  const handlerLoader = { load: loadProjectHandlers };

  // START RUN

  console.log("Run GGATHER", runInstance);

  const project: any = runInstance.project;
  const run: any = runInstance;
  const runSession: any = runInstance.runSession;
  const storageName: any = runInstance.storageName;

  process.env.CRAWLEE_DEFAULT_KEY_VALUE_STORE_ID = storageName;
  await KeyValueStore.setValue("databee_data", {
    databee: runInstance,
    current_run_session_id: runSession.data.id,
  });

  function delay(milliseconds: any) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  async function time() {
    console.log("Start of delay");
    await delay(15000); // Delay for 5000 milliseconds (5 seconds)
    console.log("End of delay");
  }

  await time();

  if (false) {
    const runner = new CrawlerRunner(
      runInstance,
      routerFactory,
      crawlerFactory,
      handlerLoader
    );
    await runner.run().catch(console.error);
  }

  if (typeof process.send === "function") {
    // Multi-Process Mode
    process.send({ command: "completed" });
  } else if (parentPort) {
    // Worker Thread Mode
    parentPort.postMessage({
      caller: "databee",
      status: "completed",
      runId: run.data.id,
    });
  }
  //@ts-ignore
  //process.send({ command: "completed" });

  /*
  process.on("uncaughtException", async (error) => {
    console.error("Uncaught exception:", error);
    //@ts-ignore
    process.send({ command: "aborted" });
  });

  process.on("unhandledRejection", async (reason, promise) => {
    console.error("Unhandled rejection at:", promise, "reason:", reason);
    //@ts-ignore
    process.send({ command: "aborted" });
  });*/

  //process.on("SIGINT", async () => {
  //  console.log("Received SIGINT. Shutting down gracefully.");
  //  await databee.run.end("terminated", databee.run.data.id, databee.config);
  //});

  //process.on("SIGTERM", async () => {
  //  console.log("Received SIGTERM. Shutting down gracefully.");
  //  await databee.run.end("terminated", databee.run.data.id, databee.config);
  //});

  //process.on("exit", (code) => {
  //  console.log(`About to exit with code: ${code}`);
  // Note: It's not safe to call async functions within the 'exit' event listener.
  // });

  //@ts-ignore
  return "Run Completed Succesfully";
}

// Handle process exit signals
/*process.on("SIGINT", async () => {
  console.log("Caught interrupt signal. Cleaning up...");
  await runManager.run.end(runManager.run, runManager.runSession, "stopped");
  process.exit(0);
});

process.on("uncaughtException", async (error) => {
  console.error("Uncaught exception:", error);
  await databee.run.end("aborted", databee.run.data?.id, databee.config);
});

process.on("unhandledRejection", async (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
   await databee.run.end("aborted", databee.run.data?.id, databee.config);
});*/

function handleError(
  message: string,
  error: any = null,
  shouldExit: boolean = false
): void {
  Logger.error(message);
  if (error) Logger.error(error);
  if (shouldExit) process.exit(1);
}

interface IRunSession {
  data: any;
}

interface IRun {
  data: any;
  runSession: IRunSession;
  end: (status: string, session: IRunSession) => Promise<void>;
}

interface IRunManager {
  project: {
    data: any;
  };
  run: IRun;
  isNewRun: boolean;
}

interface IDataBee {
  init: (process: NodeJS.Process) => Promise<void>;
  runManager: IRunManager;
}

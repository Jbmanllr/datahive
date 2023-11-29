//databee index.js
import dotenv from "dotenv";
import CrawlerRunner from "./crawl-manager/index";
import RouterFactory from "./crawl-manager/routers/index";
import CrawlerFactory from "./crawl-manager/crawlers/index";
import { loadProjectHandlers } from "./crawl-manager/index";
import { Configuration, KeyValueStore } from "crawlee";
import { generateStorageName } from "./utils";
//import { time } from "../utils";

dotenv.config();

export default async function GoGather(runInstance: any): Promise<any> {
  const routerFactory = new RouterFactory();
  const crawlerFactory = new CrawlerFactory();
  const handlerLoader = { load: loadProjectHandlers };

  console.log("Run instance infos passed to GoGather", runInstance);

  const storageName: any = generateStorageName(
    runInstance.project.data.id,
    runInstance.data.id
  );

  // Setting CRAWLEE_DEFAULT_KEY_VALUE_STORE_ID env variable.
  process.env.CRAWLEE_DEFAULT_KEY_VALUE_STORE_ID = storageName;

  // Setting KeyValueStore values.
  await KeyValueStore.setValue("databee_data", {
    databee: runInstance,
    current_run_session_id: runInstance.runSession.data.id,
  });

  //await time(10000);

  if (true) {
    const runner = new CrawlerRunner(
      runInstance,
      routerFactory,
      crawlerFactory,
      handlerLoader
    );
    await runner.run().catch(console.error);
  }
  //@ts-ignore
  process.send({ command: "completed" });

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
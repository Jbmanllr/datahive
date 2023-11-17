import { relay } from "../../../../datahive-core/src/index";
import { capitalizeFirstLetter } from "../utils";

const moduleName = "databee";
const capModuleName = capitalizeFirstLetter(moduleName);

export default function (router: any) {
  router.get(`/${moduleName}/start/:projectId`, async (req: any, res: any) => {
    const projectId = req.params.projectId;
    const runId = "";
    try {
      await relay(moduleName, "start", projectId, runId);
      res.send(`New ${capModuleName} run started successfully.`);
    } catch (error: any) {
      res.status(500).json({
        error: true,
        message: `Error in starting run: ${error.message || error}`,
      });
    }
  });

  router.get(`/${moduleName}/pause/:runId`, (req: any, res: any) => {
    const runId = req.params.runId;
    try {
      console.log(`Pausing ${capModuleName} run ID ${runId}...`);
      res.send(`${capitalizeFirstLetter(moduleName)} run paused successfully.`);
    } catch (error: any) {
      res.status(500).json({
        error: true,
        message: `Error pausing ${capModuleName} run: ${
          error.message || error
        }`,
      });
    }
  });

  router.get(`/${moduleName}/resume/:runId`, (req: any, res: any) => {
    const runId = req.params.runId;
    try {
      console.log(`Resuming ${capModuleName} run ID ${runId}...`);
      res.send(`${capModuleName} run resumed successfully.`);
    } catch (error: any) {
      res.status(500).json({
        error: true,
        message: `Error resuming ${capModuleName} run: ${
          error.message || error
        }`,
      });
    }
  });

  router.get(`/${moduleName}/finish/:runId`, (req: any, res: any) => {
    const runId = req.params.runId;
    try {
      console.log(`Finishing ${capModuleName} run ID ${runId}...`);
      res.send(`${capModuleName} run finished successfully.`);
    } catch (error: any) {
      res.status(500).json({
        error: true,
        message: `Error finishing ${capModuleName} run: ${
          error.message || error
        }`,
      });
    }
  });

  router.get(
    `/${moduleName}/info/runs/:projectId`,
    async (req: any, res: any) => {
      const projectId = req.params.projectId;
      try {
        console.log(
          `Getting info for ${capModuleName} runs for project ID ${projectId}...`
        );
        res.send(`Info for ${capModuleName} runs retrieved successfully.`);
      } catch (error: any) {
        res.status(500).json({
          error: true,
          message: `Error getting infos for ${capModuleName} runs: ${
            error.message || error
          }`,
        });
      }
    }
  );

  router.get(`/${moduleName}/info/run/:runId`, async (req: any, res: any) => {
    const runId = req.params.runId;
    try {
      console.log(`Getting info for ${capModuleName} run ID ${runId}...`);
      res.send(`Info for ${capModuleName} run retrieved successfully.`);
    } catch (error: any) {
      res.status(500).json({
        error: true,
        message: `Error getting infos for ${capModuleName} run: ${
          error.message || error
        }`,
      });
    }
  });
}

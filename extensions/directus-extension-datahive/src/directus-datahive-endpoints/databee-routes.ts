import { relay } from "../../datahive-core/src/index";
import { capitalizeFirstLetter } from "../utils";

const moduleName = "databee";
const capModuleName = capitalizeFirstLetter(moduleName);

export default function (router: any) {
  router.post(`/${moduleName}/start/:projectId`, async (req: any, res: any) => {
    const projectId = req.params.projectId;
    try {
      const response = await relay(moduleName, "start", projectId, undefined);
      delete response.runSession.data!.env;
      const resdata = {
        error: false,
        message: `${capModuleName} run started successfully.`,
        response: response,
      };
      res.send(resdata);
    } catch (error: any) {
      res.status(500).json({
        error: true,
        message: `Error starting ${capModuleName} run: ${
          error.message || error
        }`,
      });
    }
  });

  router.post(`/${moduleName}/stop/:runId`, async (req: any, res: any) => {
    const runId = req.params.runId;
    try {
      //console.log(`Stopping ${capModuleName} run ID ${runId}...`);
      await relay(moduleName, "stop", undefined, runId);
      res.send(
        `${capitalizeFirstLetter(moduleName)} run stopped successfully.`
      );
    } catch (error: any) {
      res.status(500).json({
        error: true,
        message: `Error stopping
         ${capModuleName} run: ${error.message || error}`,
      });
    }
  });

  router.post(`/${moduleName}/resume/:runId`, async (req: any, res: any) => {
    const runId = req.params.runId;
    try {
      const response = await relay(moduleName, "resume", undefined, runId);
      delete response.runSession.data!.env;

      const resdata = {
        error: false,
        message: `${capModuleName} run resumed successfully.`,
        data: response,
      };

      res.send(resdata);
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
      res.send(`${capModuleName} run completed successfully.`);
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

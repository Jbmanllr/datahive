import pLimit from "p-limit";
import { apiRequest } from "./helpers.js";
import {
  TRANSFORM_MAPPINGS,
  ENTITY_TABLES,
  TRANSFORM_FUNCTIONS,
} from "./migrations-data.js";

const DATA_FACTORY_RUNS_COLLECTION = "data_factory_migrations_runs";

const CONCURRENCIES = 25;
const BATCH_SIZE = 100;

const PROJECT_NAME = "equipboard";
const PROJECT_ID = "project_id";

const SOURCE_TABLE = "databee_raw_data";

const validEntityTypes = ["submission", "pro", "item", "band", "brand"];

export default {
  id: "greet",
  handler: (router) => {
    router.get("/intro", async (req, res) => {
      console.log("Process ENV", process.env);
      // CREATE RUN
      let run;
      if (true) {
        run = await apiRequest({
          method: "POST",
          collection: DATA_FACTORY_RUNS_COLLECTION,
          data: {
            date_start: new Date(),
            status: "running",
            batch_size: BATCH_SIZE,
            concurrencies: CONCURRENCIES,
            env: process.env,
          },
        });
      }

      try {
        let offset = 0;

        while (true) {
          let rawData = await apiRequest({
            method: "GET",
            collection: SOURCE_TABLE,
            params: {
              limit: BATCH_SIZE,
              offset: offset,
              filter: {
                _and: [
                  { source: { _eq: PROJECT_NAME } },
                  {
                    _or: [
                      { migrated: { _eq: false } },
                      { migrated: { _null: true } },
                    ],
                  },
                ],
              },
            },
          });

          rawData = rawData.data;

          if (rawData.length === 0) {
            console.log("No more items");
            break;
          }

          await migrateData(rawData, run);
          break;
          offset += BATCH_SIZE;
        }

        res.json({ success: true, message: "Data migrated successfully!" });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }

      // UPDATE RUN
      if (true) {
        run = await apiRequest({
          method: "PATCH",
          collection: DATA_FACTORY_RUNS_COLLECTION,
          id: run.data.id,
          data: {
            date_end: new Date(),
            status: "finished",
          },
        });
      }
    });
    router.get("/goodbye", (req, res) => res.send("Goodbye!"));
  },
};

// Main Migration Function
async function migrateData(rawData, run) {
  const concurrencyLimit = pLimit(CONCURRENCIES);
  const promises = rawData.map(async (item) => {
    const entityType = determineEntityType(item); // This function determines the entity type based on the data

    // Check if entityType is determined and is valid
    if (!entityType || !validEntityTypes.includes(entityType)) {
      return; // Skip this iteration if entityType is not valid
    }

    const dataToInsert = transformData(item.data, entityType);
    dataToInsert.raw_data_id = item.id;
    dataToInsert.raw_data = item.data;
    dataToInsert.run_id = run.data.id;

    return concurrencyLimit(async () => {
      await apiRequest({
        method: "POST",
        collection: ENTITY_TABLES[entityType],
        data: dataToInsert,
        isErrorReport: false,
        run: run,
      });
    });
  });

  await Promise.all(promises);
}

function determineEntityType(item) {
  const data = item.data;
  if (data.pro && data.item) {
    return "submission";
  } else if (data.url.includes("/pros/")) {
    return "pro";
  } else if (data.url.includes("/items/")) {
    return "item";
  } else if (data.url.includes("/band/")) {
    return "band";
  } else if (data.url.includes("/brands/")) {
    return "brand";
  }
  return null; // or undefined, depending on your preference
}

function transformData(data, entityType) {
  const mapping = TRANSFORM_MAPPINGS[entityType];
  if (!mapping) return {};

  let transformedData = {};

  for (let [key, value] of Object.entries(mapping)) {
    if (typeof value === "string") {
      transformedData[key] = data[value];
    } else if (typeof value === "object" && value.field) {
      if (value.transform) {
        transformedData[key] = TRANSFORM_FUNCTIONS[value.transform](
          data[value.field],
          data
        );
      } else {
        transformedData[key] = data[value.field];
      }
    }
  }

  return transformedData;
}

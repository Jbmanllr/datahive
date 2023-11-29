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
// @ts-ignore
const PROJECT_ID = "project_id";

const SOURCE_TABLE = "databee_raw_data";

const validEntityTypes = [
  "submission",
  "pro",
  "item",
  "band",
  "brand",
] as const;
type EntityType = (typeof validEntityTypes)[number];

interface RunData {
  data: {
    id: string;
  };
}

interface RawDataItem {
  id: string;
  data: any; // This should be typed more specifically if possible
}

interface TransformedData {
  [key: string]: any; // This should be typed more specifically if possible
}

export async function testFC(): Promise<void> {
  console.log("TEST POLLINATOR");
  function delay(milliseconds: any) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  async function time() {
    console.log("Start of delay");
    await delay(60000); // Delay for 5000 milliseconds (5 seconds)
    console.log("End of delay");
  }

  await time();
}

export async function runPollinator(): Promise<void> {
  // @ts-ignore
  console.log("Process ENV", process.env);
  let run: RunData | undefined;

  run = await apiRequest({
    method: "POST",
    collection: DATA_FACTORY_RUNS_COLLECTION,
    // @ts-ignore
    data: {
      date_start: new Date(),
      status: "running",
      batch_size: BATCH_SIZE,
      concurrencies: CONCURRENCIES,
      // @ts-ignore
      env: process.env,
    },
    isErrorReport: false,
  });

  try {
    let offset = 0;

    while (true) {
      const rawDataResponse = await apiRequest({
        method: "GET",
        collection: SOURCE_TABLE,
        // @ts-ignore
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
        isErrorReport: false,
      });

      const rawData: RawDataItem[] = rawDataResponse.data;

      if (rawData.length === 0) {
        console.log("No more items");
        break;
      }

      await migrateData(rawData, run);
      offset += BATCH_SIZE;
    }

    // The response handling (res.json, res.status) would be outside of this function scope
  } catch (error: unknown) {
    // Error handling should be done here, possibly logging the error or throwing it to be handled by a higher-level function
    console.error("An error occurred:", error);
  }

  if (run) {
    await apiRequest({
      method: "PATCH",
      collection: DATA_FACTORY_RUNS_COLLECTION,
      // @ts-ignore
      id: run.data.id,
      // @ts-ignore
      data: {
        date_end: new Date(),
        status: "completed",
      },
      isErrorReport: false,
    });
  }
}

async function migrateData(
  rawData: RawDataItem[],
  run: RunData | undefined
): Promise<void> {
  if (!run) throw new Error("Run data is undefined");

  const concurrencyLimit = pLimit(CONCURRENCIES);
  const promises = rawData.map((item) => {
    const entityType = determineEntityType(item);

    if (!entityType || !validEntityTypes.includes(entityType)) {
      return; // Skip this iteration if entityType is not valid
    }

    const dataToInsert = transformData(item.data, entityType);
    dataToInsert.raw_data_id = item.id;
    dataToInsert.raw_data = item.data;
    dataToInsert.run_id = run.data.id;

    return concurrencyLimit(() =>
      apiRequest({
        method: "POST",
        collection: ENTITY_TABLES[entityType],
        // @ts-ignore
        data: dataToInsert,
        isErrorReport: false,
      })
    );
  });

  await Promise.all(promises.filter(Boolean)); // Filter out undefined values
}

function determineEntityType(item: RawDataItem): EntityType | null {
  const data = item.data;
  if (data.pro && data.item) {
    return "submission";
  } else if (data.url && data.url.includes("/pros/")) {
    return "pro";
  } else if (data.url && data.url.includes("/items/")) {
    return "item";
  } else if (data.url && data.url.includes("/bands/")) {
    return "band";
  } else if (data.url && data.url.includes("/brands/")) {
    return "brand";
  }
  return null;
}

function transformData(data: any, entityType: EntityType): TransformedData {
  const mapping = TRANSFORM_MAPPINGS[entityType];
  if (!mapping) return {};

  const transformedData: TransformedData = {};
  // @ts-ignore
  for (const [key, value] of Object.entries(mapping)) {
    if (typeof value === "string") {
      transformedData[key] = data[value];
    } else if (typeof value === "object" && value.field) {
      // @ts-ignore
      const transformFunction = TRANSFORM_FUNCTIONS[value.transform];
      if (value.transform && typeof transformFunction === "function") {
        transformedData[key] = transformFunction(data[value.field], data);
      } else {
        transformedData[key] = data[value.field];
      }
    }
  }

  return transformedData;
}

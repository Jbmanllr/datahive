import {
  RequestQueue,
  Dataset,
  KeyValueStore,
  purgeDefaultStorages,
} from "crawlee";

export function delay(ms: number): Promise<unknown> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function cleanRunStorage(storageName: string): Promise<void> {
  await dropQueue(storageName);
  await dropDataset(storageName);
  await dropKeyValueStore(storageName);
  await purgeDefaultStorages();
}
// DROP DATASETS
export async function dropDataset(datasetName: string): Promise<void> {
  const dataset = await Dataset.open(datasetName);
  await dataset.drop();
}

export async function dropDatasets(datasetName: string): Promise<void> {
  const dataset = await Dataset.open(datasetName);
  await dataset.drop();
}

// DROP QUEUES
export async function dropQueue(queueName: string): Promise<void> {
  const queue = await RequestQueue.open(queueName);
  await queue.drop();
}

export async function dropQueues(queueName: string): Promise<void> {
  const queue = await RequestQueue.open(queueName);
  await queue.drop();
}

// DROP KEYVALUESTORES
export async function dropKeyValueStore(kvsName: string): Promise<void> {
  const store = await KeyValueStore.open(kvsName);
  await store.drop();
}

export async function dropAllQueues(projectId: any, runId: any): Promise<void> {
  const queueName = generateStorageName(projectId, runId);
  await dropQueue(queueName);
}

export async function dropEachQueues(project: any, run: any): Promise<void> {
  let orchestration = project.databee_orchestrations;
  for (let sequence of orchestration) {
    const queueName = generateRequestQueueName(
      project.id,
      run.id,
      sequence.request_queue
    );
    await dropQueue(queueName);
  }
}

export function generateRequestQueueName(
  projectId: string,
  runId: string,
  label: string
) {
  const requestQueuePath = generateStorageName(projectId, runId);
  return `${requestQueuePath}/${label}`;
}

export function generateStorageName(projectId: string, runId: string) {
  return `${projectId}__${runId}`;
}

/*
export async function loadApify() {
  try {
    const apifyModule = await import("apify");
    Actor = apifyModule.Actor;
    await Actor.init();
  } catch (error) {
    console.error("Failed to import Actor from apify:", error);
  }
}
*/

/*
  const { totalRequestCount } = await queue.getInfo();
  if (totalRequestCount > 0) {
    await queue.drop();
    console.log(`Queue ${queueName} has been dropped`);
  } else {
    console.log(`Queue ${queueName} is already empty.`);
  }
  */

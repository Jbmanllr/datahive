//@ts-nocheck
import { RequestQueue } from "crawlee";

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function dropQueues(project) {
  
  let orchestration = project.databee_orchestrations;
  for (let sequence of orchestration) {
    let queue = await RequestQueue.open(sequence.request_queue);

    // Check if the queue has any requests
    const { totalRequestCount } = await queue.getInfo();
    //console.log("TOTAL REQUEST COUNT", totalRequestCount);
    if (totalRequestCount > 0) {
      // Drop and recreate the queue
      await queue.drop();
      queue = await RequestQueue.open(sequence.request_queue);
      //console.log(`Queue ${sequence.request_queue} has been dropped`);
    } else {
      //console.log(`Queue ${sequence.request_queue} is already empty.`);
    }
  }
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
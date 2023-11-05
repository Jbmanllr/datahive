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
    console.log("TOTAL REQUEST COUNT", totalRequestCount);
    if (totalRequestCount > 0) {
      // Drop and recreate the queue
      await queue.drop();
      queue = await RequestQueue.open(sequence.request_queue);
      console.log(`Queue ${sequence.request_queue} has been dropped`);
    } else {
      console.log(`Queue ${sequence.request_queue} is already empty.`);
    }
  }
}

export async function getApproxPublishDate(timeText) {
  // Parse the timeText to get the number and time unit
  const timeRegex = /(?:about )?(\d+) (minute|hour|day|week|month|year)/;

  const match = timeText.match(timeRegex);
  let datePublished = null;

  if (match) {
    const number = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case "minute":
      case "minutes":
        datePublished = new Date(Date.now() - number * 60 * 1000);
        break;
      case "hour":
      case "hours":
        datePublished = new Date(Date.now() - number * 60 * 60 * 1000);
        break;
      case "day":
      case "days":
        datePublished = new Date(Date.now() - number * 24 * 60 * 60 * 1000);
        break;
      // Add cases for week, month, year, etc. if needed
      default:
        console.log(`Unknown time unit: ${unit}`);
    }

    console.log(
      `Approximate publish date for card: ${datePublished} with ${timeText}`
    );
  } else {
    console.log("Failed to parse time text:", timeText);
  }

  return datePublished;
}

export function prepareLink(rawLink) {
  let preparedLink = rawLink;
  let rootDomain = "https://equipboard.com";

  // Check if the link contains "https://", "http://"
  const substrings = ["https://", "http://"];
  const containsSubstring = substrings.some((sub) => rawLink?.includes(sub));
  preparedLink = !containsSubstring ? rootDomain + rawLink : rawLink;
  return preparedLink;
}

export function getPathFromUrl(inputUrl) {
  const parsedUrl = new URL(inputUrl);
  return parsedUrl.pathname;
}

export async function calculateTimeSpent(dateStart, dateEnd) {
  const startDate = new Date(dateStart);
  const endDate = new Date(dateEnd);

  let timeSpent = endDate - startDate; // difference in milliseconds

  if (timeSpent < 0) {
    return "End date is before start date";
  }

  let seconds = Math.floor(timeSpent / 1000);
  let minutes = Math.floor(seconds / 60);
  seconds = seconds % 60;
  const hours = Math.floor(minutes / 60);
  minutes = minutes % 60;

  let result = [];
  if (hours > 0) result.push(`${hours} hours`);
  if (minutes > 0) result.push(`${minutes} minutes`);
  if (seconds > 0 || result.length === 0) result.push(`${seconds} seconds`);

  return result.join(", ").replace(/, ([^,]*)$/, " and $1");
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
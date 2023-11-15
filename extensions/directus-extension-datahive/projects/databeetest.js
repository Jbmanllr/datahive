//import { RequestQueue, KeyValueStore } from "crawlee";
//import { apiRequest } from "../dist/api.js";
//import { databee } from "../dist/api.js";

const LABEL_NAMES = {
    TEST: "TEST"
  };

export const handlers = {
  DEFAULT: async (context) => {
    console.log("RUNNING DEFAULT HANDLER");
  },

  TEST: async (context) => {
    const { request, log, enqueueLinks, pushData, $ } = context;
    const path = new URL(request.loadedUrl).pathname;
    const errors = [];
    const report = [];
    console.log("TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST");
    // Promise-based timeout function
    function timeout(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // Async function that waits for a specified time
    async function waitForSeconds(seconds) {
      console.log("Waiting...");

      // Wait for the specified number of seconds
      await timeout(seconds * 1000);

      // Continue with the rest of the function
      console.log(`${seconds} seconds have passed!`);
    }

    // Example usage
    await waitForSeconds(25); // Waits for 3 seconds
  },
};

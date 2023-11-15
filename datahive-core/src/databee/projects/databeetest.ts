// equipboard.js (handlers)
// @ts-nocheck
import {
    getApproxPublishDate,
    prepareLink,
    getPathFromUrl,
  } from "../utils/index";
  import { RequestQueue, KeyValueStore } from "crawlee";
  import { EXTRACT_FREQUENCY_MINUTES } from "../constants";
  import { apiRequest } from "../../connectors/index";
  import databee from "../../run-manager";
  
  const LABEL_NAMES = {
    HOMEPAGE: "HOMEPAGE",
    TEST: "TEST"
  };
  
  export const handlers: { [key: string]: (context: any) => Promise<void> } = {
    
    DEFAULT: async (context: any): Promise<void> => {
      console.log("RUNNING DEFAULT HANDLER");
    },
   
    TEST: async (context: any): Promise<void> => {
      const { request, log, enqueueLinks, pushData, $ } = context;
      const path = new URL(request.loadedUrl).pathname;
      const errors = [];
      const report = [];
  
    },
  }
  
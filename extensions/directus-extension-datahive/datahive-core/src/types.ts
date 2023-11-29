import { DatabeeProjectData } from "./databee/types";
import { PollinatorProjectData } from "./pollinator/types";
import { HoneycombProjectData } from "./honeycomb/types";
import { Method } from "axios";

export interface BaseProperties {
  id: string;
  user_created: string;
  date_created: string;
  user_updated: string | Date | null;
  date_updated: string | Date | null;
}

export interface Run extends BaseProperties {
  date_end: string | Date | null;
  date_start: string | Date;
  id: string;
  isTestRun: boolean;
  project_id: string;
  status: string;
  time_elapsed?: number;
  env?: any;
}

export interface RunSession extends BaseProperties {
  date_end: string | Date | null;
  date_start: string | Date;
  run_id: string;
  status: string;
  time_elapsed?: number;
  env?: any;
}

export type ProjectData =
  | DatabeeProjectData
  | PollinatorProjectData
  | HoneycombProjectData;

export interface ApiRequestOptions {
  method: Method;
  collection: string;
  data?: null | any;
  params?: any;
  id?: string | number;
  isErrorReport?: boolean;
  run?: { data: { id: string | number } };
  fields?: string;
  errorCollection?: string;
}

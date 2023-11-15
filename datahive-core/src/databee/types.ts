import { BaseProperties } from "../types"

export interface DatabeeConfig extends BaseProperties {
  runs_collection: string;
  run_sessions_collection: string;
  project_collection: string;
  raw_data_collection: string;
}

export interface DatabeeProjectData extends BaseProperties {
  base_url: string;
  default_handler: string;
  description: string | null;
  email: string | null;
  key: string;
  name: string;
  username: string | null;
  project_image: string | null;
  password: string | null;
  auto_run: boolean;
  run_frequency: string | null;
  auto_run_terminate_active: boolean;
  schedule_type: string;
  databee_orchestrations: any[];
  databee_runs: any[];
}
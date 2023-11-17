// Orchestrator>process-manager.ts
import { fork, ChildProcess } from 'child_process';
import ps from 'ps-node';

export interface IProcessManager {
  createProcess(options: any): Promise<any>;
  getActiveProcesses(): Map<number, any>;
  checkProcessHealth(process: any): Promise<boolean>;
  terminateProcess(process: any): void;
}

interface ProcessInfo {
  process: ChildProcess;
  startTime: number;
}

interface CreateProcessOptions {
  caller: string;
  projectId?: string | null | undefined;
  runId?: string | null | undefined;
  processPath: string;
}

class ProcessManager implements IProcessManager {
  private activeProcesses: Map<number, ProcessInfo>;
  
  constructor() {
    this.activeProcesses = new Map();
  }

  async createProcess({
    caller,
    projectId,
    runId,
    processPath
  }: CreateProcessOptions): Promise<ChildProcess> {
    if (!projectId && !runId) {
      throw new Error("Project ID or Run ID are required");
    }
    try {
      const ID = projectId ? projectId : runId; 
      //@ts-ignore
      const newProcess = fork(processPath, [ID, '--name=Databee'], {
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        detached: false,
        env: {
          ...process.env,
          PROJECT_ID: projectId,
          RUN_ID: runId,
          IS_CHILD_PROCESS: 'true',
          PROCESS_NAME: caller
        }
      });

      newProcess.stdout?.on('data', (data) => {
        logWithPrefix(`[Databee (${newProcess.pid})]: `, data.toString());
      });

      newProcess.stderr?.on('data', (data) => {
        logWithPrefix(`[Databee (${newProcess.pid})]: `, data.toString());
      });

      newProcess.on('exit', () => {
        if (newProcess.pid !== undefined) {
          this.activeProcesses.delete(newProcess.pid);
          console.log(`Exited & Removed process ${newProcess.pid} from active processes.`);
        }
      });

      if (newProcess.pid !== undefined) {
        const processInfo = {
          process: newProcess,
          startTime: Date.now()
        };

        this.activeProcesses.set(newProcess.pid, processInfo);
        console.log("Active Databee Processes", this.activeProcesses.size)
      }

      return newProcess;
    } catch (error) {
      console.error('Error creating Databee process:', error);
      throw error;
    }
  }

  async getOrCreateActiveProcess(caller: string, projectId: string, processPath: string): Promise<ChildProcess> {
    let latestProcessStartTime = 0;
    let activeProcess = null;

    for (let [pid, processInfo] of this.getActiveProcesses()) {
      const isAlive = await this.checkProcessHealth(processInfo.process);
      if (isAlive && processInfo.startTime > latestProcessStartTime) {
        activeProcess = processInfo.process;
        latestProcessStartTime = processInfo.startTime;
      }
    }

    if (!activeProcess) {
      activeProcess = await this.createProcess({
        caller,
        projectId,
        runId: null,
        processPath
      });
    }

    return activeProcess;
  }

  async terminateProcess(process: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const pid = process.pid;
      console.log(`PIDzz: ${pid}`);
      if (process && !process.killed && pid !== undefined) {
        process.kill(pid);
        process.on('exit', () => {
          console.log(`Terminated process with PID: ${pid}`);
          this.activeProcesses.delete(pid);
          resolve();
        });
      } else {
        resolve();
      }
    });
  }


  async checkForExistingProcesses(
    title: string,
    args: string[]
  ): Promise<any[]> {
    return new Promise((resolve, reject) => {
      ps.lookup({
        command: title,
        //@ts-ignore
        arguments: args,
        psargs: 'ux'
      }, (err: Error | null, resultList: any[]) => {
        if (err) {
          console.error('Error checking for existing processes:', err);
          reject(err);
          return;
        }

        const foundProcesses = resultList.filter(p => p.command.includes(title));
        resolve(foundProcesses);
      });
    });
  }


  async checkProcessHealth(process: any): Promise<boolean> {
    return new Promise((resolve) => {
      if (process && !process.killed && process.connected) {
        const timeout = setTimeout(() => {
          resolve(false);
        }, 5000);

        process.once('message', (message : string) => {
          if (message === 'alive') {
            clearTimeout(timeout);
            resolve(true);
          }
        });

        try {
          process.send({ command: 'heartbeat' });
        } catch (error) {
          console.error('Error sending heartbeat:', error);
          clearTimeout(timeout);
          resolve(false);
        }
      } else {
        resolve(false);
      }
    });
  }

  getActiveProcesses(): Map<number, any> {
    return this.activeProcesses;
  }
}

function logWithPrefix(prefix: any, message: any) {
  const yellow = '\x1b[33m';
  const reset = '\x1b[0m';
  console.log(`${yellow}${prefix} ${message}${reset}`);
}

export default ProcessManager;
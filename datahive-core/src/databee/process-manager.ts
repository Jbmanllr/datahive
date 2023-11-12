// process-manager.ts
import { spawn, fork, ChildProcess } from 'child_process';
import ps from 'ps-node';

const databeeProcessPath = 'datahive-core/dist/databee/process.js';

interface ProcessInfo {
  process: ChildProcess;
  startTime: number;
}

interface CreateDatabeeProcessOptions {
  projectId: string;
  runId?: string;
  differentProcessForEachRun: boolean;
}

class ProcessManager {
  private activeDatabeeProcesses: Map<number, ProcessInfo>;
  constructor() {
    this.activeDatabeeProcesses = new Map();
  }

  async createDatabeeProcess({
    projectId,
    runId,
    differentProcessForEachRun
  }: CreateDatabeeProcessOptions): Promise<ChildProcess> {
    try {
      const databeeProcess = fork(databeeProcessPath, [projectId, '--name=Databee'], {
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        detached: false,
        env: {
          ...process.env,
          PROJECT_ID: projectId,
          RUN_ID: runId,
          PROCESS_NAME: 'Databee',
          //DPFER: differentProcessForEachRun
        }
      });

      databeeProcess.stdout?.on('data', (data) => {
        console.log(`[Databee (${databeeProcess.pid})]: `, data.toString());
      });

      databeeProcess.stderr?.on('data', (data) => {
        console.error(`[Databee (${databeeProcess.pid})]: `, data.toString());
      });

      databeeProcess.on('exit', () => {
        if (databeeProcess.pid !== undefined) {
          this.activeDatabeeProcesses.delete(databeeProcess.pid);
          console.log(`Exited & Removed process ${databeeProcess.pid} from active processes.`);
        }
      });

      if (databeeProcess.pid !== undefined) {
        const processInfo = {
          process: databeeProcess,
          startTime: Date.now()
        };

        this.activeDatabeeProcesses.set(databeeProcess.pid, processInfo);
      }

      return databeeProcess;
    } catch (error) {
      console.error('Error creating Databee process:', error);
      throw error;
    }
  }

  async terminateProcess(process: ChildProcess): Promise<void> {
    return new Promise((resolve, reject) => {
      const pid = process.pid;
      if (process && !process.killed && pid !== undefined) {
        process.kill();
        process.on('exit', () => {
          console.log(`Terminated process with PID: ${pid}`);
          this.activeDatabeeProcesses.delete(pid);
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
  ): Promise<ps.PS[]> {
    return new Promise((resolve, reject) => {
      ps.lookup({
        command: title,
        arguments: args,
        psargs: 'ux'
      }, (err: Error | null, resultList: ps.PS[]) => {
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


  async checkProcessHealth(process: ChildProcess): Promise<boolean> {
    return new Promise((resolve) => {
      if (process && !process.killed && process.connected) {
        const timeout = setTimeout(() => {
          resolve(false);
        }, 5000);

        process.once('message', (message) => {
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

  getActiveProcesses(): Map<number, ProcessInfo> {
    return this.activeDatabeeProcesses;
  }
}

export default ProcessManager;

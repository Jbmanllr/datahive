// Datahive>worker-manager
import { Worker } from "worker_threads";

export interface IWorkerManager {
  createWorker(scriptPath: string, options?: any): Promise<any>;
  terminateWorker(workerId: number): Promise<void>;
}

class WorkerManager implements IWorkerManager {
  private activeWorkers: Map<number, Worker>;

  constructor() {
    this.activeWorkers = new Map();
  }

  async createWorker(
    workerPath: string,
    workerData: any = {}
  ): Promise<Worker> {
    const worker = new Worker(workerPath, { workerData });
    this.activeWorkers.set(worker.threadId, worker);

    worker.on("exit", () => {
      console.log(`Worker ${worker.threadId} exited`);
      this.activeWorkers.delete(worker.threadId);
    });

    return worker;
  }

  async terminateWorker(threadId: number): Promise<void> {
    const worker = this.activeWorkers.get(threadId);
    if (worker) {
      await worker.terminate();
      console.log(`Terminated worker with Thread ID: ${threadId}`);
      this.activeWorkers.delete(threadId);

      // Check if there are no more active workers
      if (this.activeWorkers.size === 0) {
        console.log("No active workers left. Terminating the process.");
        process.exit(0); // or use a different exit code if needed
      }
    } else {
      throw new Error(`No worker found with Thread ID: ${threadId}`);
    }
  }

  getWorker(threadId: number): Worker | undefined {
    return this.activeWorkers.get(threadId);
  }

  getAllWorkers(): Map<number, Worker> {
    return this.activeWorkers;
  }

  areWorkersActive(): boolean {
    return this.activeWorkers.size > 0;
  }
  //@ts-ignore
  private generateWorkerId(worker: Worker): string {
    return "worker-" + worker.threadId;
  }
}

export default WorkerManager;

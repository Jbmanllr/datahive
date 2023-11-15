import { Worker } from 'worker_threads';

class WorkerManager {
  private workers: Map<number, Worker>;

  constructor() {
    this.workers = new Map();
  }

  async createWorker(workerPath: string, workerData: any = {}): Promise<Worker> {
    const worker = new Worker(workerPath, { workerData });
    this.workers.set(worker.threadId, worker);

    worker.on('exit', () => {
      console.log(`Worker ${worker.threadId} exited`);
      this.workers.delete(worker.threadId);
    });

    return worker;
  }

  async terminateWorker(threadId: number): Promise<void> {
    const worker = this.workers.get(threadId);
    if (worker) {
      await worker.terminate();
      console.log(`Terminated worker with Thread ID: ${threadId}`);
      this.workers.delete(threadId);

      // Check if there are no more active workers
      if (this.workers.size === 0) {
        console.log('No active workers left. Terminating the process.');
        process.exit(0); // or use a different exit code if needed
      }
    } else {
      throw new Error(`No worker found with Thread ID: ${threadId}`);
    }
  }

  getWorker(threadId: number): Worker | undefined {
    return this.workers.get(threadId);
  }

  getAllWorkers(): Map<number, Worker> {
    return this.workers;
  }

  areWorkersActive(): boolean {
    return this.workers.size > 0;
  }
  //@ts-ignore
  private generateWorkerId(worker: Worker): string {
    return "worker-" + worker.threadId;
  }
}

export default WorkerManager;

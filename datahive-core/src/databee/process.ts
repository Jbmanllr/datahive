// path_to_your_script.js
import goGather from "./main.js"
interface Worker {
    projectId: string;
    // Add other properties as needed
}
const workers: Worker[] = [];
const projectId = process.argv[2]; // Get the projectId from the command line arguments

(async () => {
    process.title = 'databee';

    console.log("Process", projectId, process.title)

    process.on('message', (message: any) => {
        if (message.command === 'startWorker') {
            const newWorker: Worker = {
                projectId: message.projectId,
                // Initialize other properties
            };

            workers.push(newWorker);
            // Start the worker's task
            startWorkerTask(newWorker);
        }
    });

    async function startWorkerTask(worker: Worker) {
        try {
            await goGather(projectId, null, worker);
            await endWorkerTask(worker);
        } catch (error) {
            console.error('Error during goGather:', error);
            process.exit(1); // Exit with error code
        }
    }


    async function endWorkerTask(worker: Worker) {
        // Clean up after the worker's task is done
        const index = workers.indexOf(worker);
        if (index > -1) {
            workers.splice(index, 1);
        }

        // Exit process if no workers are left
        if (workers.length === 0) {
            process.exit(0);
        }
    }
})();

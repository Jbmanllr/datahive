// path_to_your_script.js
import goGather from "./main.js"

const projectId = process.argv[2]; // Get the projectId from the command line arguments

(async () => {
    process.title = 'databee';
    console.log("PROCESSSSS", projectId, process.title)
    try {
        await goGather(projectId, null);
        process.exit(0); // Exit with success code
    } catch (error) {
        console.error('Error during goGather:', error);
        process.exit(1); // Exit with error code
    }
})();

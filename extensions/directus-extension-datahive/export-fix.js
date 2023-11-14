import fs from 'fs';
import path from 'path';

// Path to the api.js file
const apiFilePath = path.join(__dirname, 'path/to/your/api.js');

// Function to modify the api.js file
async function modifyApiFile() {
  try {
    let data = await fs.promises.readFile(apiFilePath, 'utf8');

    // Replace the specific strings to add 'export'
    let modifiedData = data.replace('async function apiRequest', 'export async function apiRequest')
                           .replace('const databee = new Databee();', 'export const databee = new Databee();');

    // Write the modified data back to api.js
    await fs.promises.writeFile(apiFilePath, modifiedData, 'utf8');
    console.log('api.js successfully modified to export functions.');
  } catch (err) {
    console.error('Error processing api.js:', err);
  }
}

// Run the function
modifyApiFile();

//import nodeResolve from "@rollup/plugin-node-resolve";
import nodeExternals from "rollup-plugin-node-externals";
import dynamicImportVars from '@rollup/plugin-dynamic-import-vars';
//import path from "path";
//import fs from "fs";

//const externalId = path.resolve(__dirname, '../../datahive-core/src/orchestrator.js');
//const datahiveCoreRealPath = fs.realpathSync(path.resolve(__dirname, '../../datahive-core'));

export default {
  plugins: [
    nodeExternals(),
    dynamicImportVars(),
    //copy({
    //  targets: [
    //    {
    //      src: "../../datahive-core/src/projects",
    //      dest: "../directus-extension-datahive/dist",
    //      rename: "projects",
    //    },
    //  ],
    //}),
  ],
};

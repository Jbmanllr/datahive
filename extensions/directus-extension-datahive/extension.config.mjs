//import nodeResolve from "@rollup/plugin-node-resolve";
import nodeExternals from "rollup-plugin-node-externals";
//import path from "path";
//import fs from "fs";

//const externalId = path.resolve(__dirname, '../../datahive-core/src/orchestrator.js');
//const datahiveCoreRealPath = fs.realpathSync(path.resolve(__dirname, '../../datahive-core'));

export default {
  plugins: [
    nodeExternals({
      include: [
        //id => id.startsWith(datahiveCoreRealPath),
        //externalId,
        "datahive-core",
        "playwright",
        "crawlee",
        "async-mutex",
        "axios",
        "p-limit",
        "ps-node",
        "winston",
      ],
    }),
  ],
};

//import nodeResolve from "@rollup/plugin-node-resolve";
import nodeExternals from "rollup-plugin-node-externals";
import excludeDependenciesFromBundle from "rollup-plugin-exclude-dependencies-from-bundle";
import path from "path";
import peerDepsExternal from "rollup-plugin-peer-deps-external";
import fs from "fs";

const externalId = path.resolve(__dirname, '../../datahive-core/src/orchestrator.js');

//const datahiveCoreRealPath = fs.realpathSync(path.resolve(__dirname, '../../datahive-core'));
export default {
  plugins: [
    peerDepsExternal(),
    nodeExternals({
      include: [
        //id => id.startsWith(datahiveCoreRealPath),
        externalId,
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
  external: [
    //id => id.startsWith(datahiveCoreRealPath),
    "datahive-core",
    "playwright",
    "crawlee",
    "async-mutex",
    "axios",
    "p-limit",
    "ps-node",
    "winston",
  ],
  /*external: (id) => {
    // Resolve the path to the symlinked module
    const datahiveCorePath = path.resolve(
      __dirname,
      "./node_modules/datahive-core"
    );

    // Check if the module ID starts with the resolved path of datahive-core
    return id.startsWith(datahiveCorePath);
    
  },*/
};

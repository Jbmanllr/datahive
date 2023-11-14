//import { nodeResolve } from "@rollup/plugin-node-resolve";
//import replaceDefault from '@rollup/plugin-replace';
//import terserDefault from '@rollup/plugin-terser';
//import virtualDefault from '@rollup/plugin-virtual';
//import dynamicImportVars from "@rollup/plugin-dynamic-import-vars";
//import commonjs from "@rollup/plugin-commonjs";
import nodeExternals from "rollup-plugin-node-externals";

export default {
  plugins: [nodeExternals()],
  //preserveEntrySignatures: "exports-only",
};

//import nodeResolve from "@rollup/plugin-node-resolve";
import nodeExternals from "rollup-plugin-node-externals";

export default {
  plugins: [nodeExternals()],
};

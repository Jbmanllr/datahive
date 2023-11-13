//import nodeResolve from "@rollup/plugin-node-resolve";
import nodeExternals from "rollup-plugin-node-externals";
import path from "path";

export default {
  plugins: [nodeExternals()],
  //external: [
    // Exclure tous les fichiers dans un dossier spécifique
    //id => id.startsWith(path.resolve(__dirname, '../../datahive-core'))
  //],
};

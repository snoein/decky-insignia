import { readFileSync } from "fs";
import deckyPlugin from "@decky/rollup";
import replace from "@rollup/plugin-replace";

const { version } = JSON.parse(readFileSync("./package.json", "utf-8"));

export default deckyPlugin({
  plugins: [
    replace({
      preventAssignment: true,
      __APP_VERSION__: JSON.stringify(version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    }),
  ],
});

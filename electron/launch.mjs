import { spawn } from "child_process";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const require = createRequire(import.meta.url);
const electronPath = require("electron"); // returns binary path string when ELECTRON_RUN_AS_NODE is set

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const appDir = path.dirname(fileURLToPath(import.meta.url));
const child = spawn(electronPath, [appDir], {
  stdio: "inherit",
  env,
});

child.on("exit", (code) => process.exit(code ?? 0));

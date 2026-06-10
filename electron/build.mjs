import esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const shared = {
  bundle: true,
  platform: "node",
  target: "node22",
  external: ["electron"],
  sourcemap: true,
};

await Promise.all([
  esbuild.build({
    ...shared,
    entryPoints: [path.join(__dirname, "src/main.ts")],
    outfile: path.join(__dirname, "dist/main.js"),
    format: "cjs",
  }),
  esbuild.build({
    ...shared,
    entryPoints: [path.join(__dirname, "src/preload.ts")],
    outfile: path.join(__dirname, "dist/preload.js"),
    format: "cjs",
  }),
]);

console.log("Build complete.");

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = new URL(".", import.meta.url);
const { dependencies } = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));

// The workspace package ships TypeScript source, so it is bundled; npm packages (including the
// native better-sqlite3 addon) stay external and load from node_modules at runtime.
const external = Object.keys(dependencies).filter((name) => name !== "@invoice/shared");

await build({
  absWorkingDir: fileURLToPath(root),
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  jsx: "automatic",
  sourcemap: true,
  external,
  logLevel: "info",
});

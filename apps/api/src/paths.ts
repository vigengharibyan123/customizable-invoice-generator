import path from "node:path";
import { fileURLToPath } from "node:url";

/** `apps/api`: one level up from both `src/paths.ts` (tsx) and the bundled `dist/index.mjs`. */
export const API_ROOT = fileURLToPath(new URL("..", import.meta.url));
export const REPO_ROOT = path.resolve(API_ROOT, "../..");
export const WEB_DIST = path.join(REPO_ROOT, "apps/web/dist");
export const MIGRATIONS_DIR = path.join(API_ROOT, "drizzle");

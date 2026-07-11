import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = fileURLToPath(new URL(".", import.meta.url));
const engine = resolve(here, "../engine-ts/src");

export default defineConfig({
  resolve: {
    alias: [
      { find: "@morphemeflow/engine/constants", replacement: resolve(engine, "constants.ts") },
      { find: "@morphemeflow/engine/settings", replacement: resolve(engine, "settings.ts") },
      { find: "@morphemeflow/engine/types", replacement: resolve(engine, "types.ts") },
      { find: "@morphemeflow/engine", replacement: resolve(engine, "index.ts") },
    ],
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
  },
});

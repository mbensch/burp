import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["esm"],
  target: "node22",
  banner: {
    js: "#!/usr/bin/env node",
  },
  bundle: true,
  minify: false,
  clean: true,
  external: ["better-sqlite3"],
});

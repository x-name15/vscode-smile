import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/extension.ts"],
  format: ["cjs"],
  splitting: false,
  sourcemap: true,
  clean: true,
  target: "es2022",
  external: ["vscode"],
  noExternal: ["@mrjacket/smile"],
});

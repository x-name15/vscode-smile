import { describe, it, expect } from "vitest";
import { lintSpec, ESpecFormat } from "@mrjacket/smile";
import { resolveLocationInText } from "../src/diagnostics/locationResolver.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("JSON Schema Module Diagnostics", () => {
  const cleanPath = resolve(import.meta.dirname, "fixtures/sample-jsonschema-clean.json");
  const brokenPath = resolve(import.meta.dirname, "fixtures/sample-jsonschema.json");

  it("identifies clean JSON Schema document", async () => {
    const res = await lintSpec(cleanPath);
    expect(res.format).toBe(ESpecFormat.JsonSchema);
    expect(res.passed).toBe(true);
  });

  it("detects violations and resolves locations in broken JSON Schema", async () => {
    const result = await lintSpec(brokenPath);
    expect(result.format).toBe(ESpecFormat.JsonSchema);
    expect(result.violations.length).toBeGreaterThan(0);

    const content = readFileSync(brokenPath, "utf-8");
    for (const v of result.violations) {
      const loc = resolveLocationInText(content, v.path);
      expect(loc.startLine).toBeGreaterThanOrEqual(0);
    }
  });
});

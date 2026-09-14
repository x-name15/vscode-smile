import { describe, it, expect } from "vitest";
import { lintSpec, ESpecFormat } from "@mrjacket/smile";
import { resolveLocationInText } from "../src/diagnostics/locationResolver.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("AsyncAPI Module Diagnostics", () => {
  const cleanV2Path = resolve(import.meta.dirname, "fixtures/sample-asyncapi-clean.yaml");
  const cleanV3Path = resolve(import.meta.dirname, "fixtures/sample-asyncapi-v3-clean.yaml");
  const brokenPath = resolve(import.meta.dirname, "fixtures/sample-asyncapi.yaml");

  it("identifies clean AsyncAPI v2 and v3 specifications", async () => {
    const res2 = await lintSpec(cleanV2Path);
    expect(res2.format).toBe(ESpecFormat.AsyncApi);
    expect(res2.passed).toBe(true);

    const res3 = await lintSpec(cleanV3Path);
    expect(res3.format).toBe(ESpecFormat.AsyncApi);
    expect(res3.passed).toBe(true);
  });

  it("detects violations and resolves locations in broken AsyncAPI spec", async () => {
    const result = await lintSpec(brokenPath);
    expect(result.format).toBe(ESpecFormat.AsyncApi);
    expect(result.violations.length).toBeGreaterThan(0);

    const content = readFileSync(brokenPath, "utf-8");
    for (const v of result.violations) {
      const loc = resolveLocationInText(content, v.path);
      expect(loc.startLine).toBeGreaterThanOrEqual(0);
    }
  });
});

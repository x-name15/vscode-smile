import { describe, it, expect } from "vitest";
import { lintSpec, ESpecFormat } from "@mrjacket/smile";
import { resolveLocationInText } from "../src/diagnostics/locationResolver.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Postman Module Diagnostics", () => {
  const cleanPath = resolve(import.meta.dirname, "../../smile/fixtures/sample-postman-clean.json");
  const brokenPath = resolve(import.meta.dirname, "../../smile/fixtures/sample-postman.json");

  it("identifies clean Postman collection", async () => {
    const res = await lintSpec(cleanPath);
    expect(res.format).toBe(ESpecFormat.Postman);
    expect(res.passed).toBe(true);
  });

  it("detects violations and resolves locations in broken Postman collection", async () => {
    const result = await lintSpec(brokenPath);
    expect(result.format).toBe(ESpecFormat.Postman);
    expect(result.violations.length).toBeGreaterThan(0);

    const content = readFileSync(brokenPath, "utf-8");
    for (const v of result.violations) {
      const loc = resolveLocationInText(content, v.path);
      expect(loc.startLine).toBeGreaterThanOrEqual(0);
    }
  });
});

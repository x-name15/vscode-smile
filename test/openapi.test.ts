import { describe, it, expect } from "vitest";
import { lintSpec, ESpecFormat, ESeverity } from "@mrjacket/smile";
import { resolveLocationInText } from "../src/diagnostics/locationResolver.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("OpenAPI Module Diagnostics", () => {
  const cleanPath = resolve(import.meta.dirname, "fixtures/sample-openapi-clean.yaml");
  const brokenPath = resolve(import.meta.dirname, "fixtures/sample-openapi.yaml");

  it("identifies clean OpenAPI specification without diagnostics", async () => {
    const result = await lintSpec(cleanPath);
    expect(result.format).toBe(ESpecFormat.OpenApi);
    expect(result.passed).toBe(true);
    const errors = result.violations.filter(v => v.severity === ESeverity.Error);
    expect(errors).toHaveLength(0);
  });

  it("detects violations and maps them to editor locations in broken OpenAPI spec", async () => {
    const result = await lintSpec(brokenPath);
    expect(result.format).toBe(ESpecFormat.OpenApi);
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);

    const content = readFileSync(brokenPath, "utf-8");
    for (const violation of result.violations) {
      const loc = resolveLocationInText(content, violation.path);
      expect(loc.startLine).toBeGreaterThanOrEqual(0);
      expect(loc.endLine).toBeGreaterThanOrEqual(loc.startLine);
    }
  });

  it("treats non-spec files (e.g. CHANGELOG.md) as Unknown without false positive diagnostics", async () => {
    const changelogPath = resolve(import.meta.dirname, "../CHANGELOG.md");
    const result = await lintSpec(changelogPath);
    expect(result.format).toBe(ESpecFormat.Unknown);
  });

  it("treats package.json manifests as Unknown", async () => {
    const pkgPath = resolve(import.meta.dirname, "../package.json");
    const result = await lintSpec(pkgPath);
    expect(result.format).toBe(ESpecFormat.Unknown);
  });
});

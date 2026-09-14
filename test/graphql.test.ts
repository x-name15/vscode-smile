import { describe, it, expect } from "vitest";
import { lintSpec, ESpecFormat } from "@mrjacket/smile";
import { resolveLocationInText } from "../src/diagnostics/locationResolver.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("GraphQL Module Diagnostics", () => {
  const cleanPath = resolve(import.meta.dirname, "../../smile/fixtures/sample-graphql-clean.graphql");
  const brokenPath = resolve(import.meta.dirname, "../../smile/fixtures/sample-graphql.graphql");

  it("identifies clean GraphQL schema", async () => {
    const res = await lintSpec(cleanPath);
    expect(res.format).toBe(ESpecFormat.GraphQL);
    expect(res.passed).toBe(true);
  });

  it("detects violations and resolves locations in broken GraphQL schema", async () => {
    const result = await lintSpec(brokenPath);
    expect(result.format).toBe(ESpecFormat.GraphQL);
    expect(result.violations.length).toBeGreaterThan(0);

    const content = readFileSync(brokenPath, "utf-8");
    for (const v of result.violations) {
      const loc = resolveLocationInText(content, v.path);
      expect(loc.startLine).toBeGreaterThanOrEqual(0);
    }
  });
});

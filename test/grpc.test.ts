import { describe, it, expect } from "vitest";
import { lintSpec, ESpecFormat } from "@mrjacket/smile";
import { resolveLocationInText } from "../src/diagnostics/locationResolver.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("gRPC / Protobuf Module Diagnostics", () => {
  const cleanPath = resolve(import.meta.dirname, "../../smile/fixtures/sample-grpc-clean.proto");
  const brokenPath = resolve(import.meta.dirname, "../../smile/fixtures/sample-grpc.proto");

  it("identifies clean gRPC proto specification", async () => {
    const res = await lintSpec(cleanPath);
    expect(res.format).toBe(ESpecFormat.Grpc);
    expect(res.passed).toBe(true);
  });

  it("detects violations and resolves locations in broken proto spec", async () => {
    const result = await lintSpec(brokenPath);
    expect(result.format).toBe(ESpecFormat.Grpc);
    expect(result.violations.length).toBeGreaterThan(0);

    const content = readFileSync(brokenPath, "utf-8");
    for (const v of result.violations) {
      const loc = resolveLocationInText(content, v.path);
      expect(loc.startLine).toBeGreaterThanOrEqual(0);
    }
  });
});

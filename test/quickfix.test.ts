import { describe, it, expect, afterEach } from "vitest";
import { fixSpecFile } from "@mrjacket/smile";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FIXABLE_RULES, isFixableRule } from "../src/quickfix/rules.js";

describe("QuickFix Provider & Autofix Engine", () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("lists missing-operation-id and missing-summary as fixable rules", () => {
    expect(FIXABLE_RULES).toContain("missing-operation-id");
    expect(FIXABLE_RULES).toContain("missing-summary");
    expect(isFixableRule("missing-operation-id")).toBe(true);
    expect(isFixableRule("other-rule")).toBe(false);
  });

  it("applies deterministic AST fixes for fixable rules on a real spec", () => {
    tempDir = mkdtempSync(join(tmpdir(), "vscode-smile-quickfix-"));
    const specFile = join(tempDir, "openapi.yaml");

    const initialYaml = `openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /users/{id}:
    # Important user comment that must be preserved
    get:
      responses:
        "200":
          description: OK
`;
    writeFileSync(specFile, initialYaml, "utf-8");

    const result = fixSpecFile(specFile);
    expect(result.fixedCount).toBe(2); // Added operationId and summary

    const updated = readFileSync(specFile, "utf-8");
    expect(updated).toContain("operationId: getUsersById");
    expect(updated).toContain("summary: Get /users/:id");
    expect(updated).toContain("# Important user comment that must be preserved");
  });
});

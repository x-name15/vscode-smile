import { describe, it, expect } from "vitest";
import { SMILE_RULES_METADATA } from "../src/models/rulesMetadata.js";
import { getWebviewHtml } from "../src/webviews/webviewUtils.js";
import { ESpecFormat, bundleSpec, renderSarifReport, type ILintResult, ESeverity } from "@mrjacket/smile";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

describe("Smile Visual Suite & Webviews", () => {
  it("contains complete rules metadata covering all 6 supported formats", () => {
    const formats = new Set(SMILE_RULES_METADATA.map(r => r.format));
    expect(formats.has(ESpecFormat.OpenApi)).toBe(true);
    expect(formats.has(ESpecFormat.AsyncApi)).toBe(true);
    expect(formats.has(ESpecFormat.GraphQL)).toBe(true);
    expect(formats.has(ESpecFormat.JsonSchema)).toBe(true);
    expect(formats.has(ESpecFormat.Grpc)).toBe(true);
    expect(formats.has(ESpecFormat.Postman)).toBe(true);

    expect(SMILE_RULES_METADATA.length).toBeGreaterThanOrEqual(25);

    for (const rule of SMILE_RULES_METADATA) {
      expect(rule.id).toBeTruthy();
      expect(rule.title).toBeTruthy();
      expect(rule.description).toBeTruthy();
      expect(["error", "warn", "off"]).toContain(rule.defaultSeverity);
    }
  });

  it("generates CSP-compliant webview HTML shell with VS Code theme tokens", () => {
    const mockWebview = {
      cspSource: "vscode-webview://test-csp",
    } as any;

    const html = getWebviewHtml({
      title: "Test Webview",
      bodyContent: "<div id='test-body'>Hello Visual World</div>",
      webview: mockWebview,
      scriptContent: "console.log('loaded');",
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<title>Test Webview</title>");
    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain("vscode-webview://test-csp");
    expect(html).toContain("Hello Visual World");
    expect(html).toContain("--vscode-editor-background");
    expect(html).toContain("acquireVsCodeApi()");
  });

  it("bundles multi-file spec with $ref correctly", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smile-bundle-test-"));
    try {
      const userSchemaPath = path.join(tmpDir, "user.json");
      fs.writeFileSync(
        userSchemaPath,
        JSON.stringify({
          type: "object",
          properties: { id: { type: "string" }, name: { type: "string" } },
        }),
        "utf-8"
      );

      const mainSpecPath = path.join(tmpDir, "api.yaml");
      fs.writeFileSync(
        mainSpecPath,
        `openapi: 3.0.3
info:
  title: Multi-File API
  version: 1.0.0
paths:
  /users:
    get:
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: './user.json'
`,
        "utf-8"
      );

      const result = await bundleSpec(mainSpecPath);
      expect(result.skipped).toBe(false);
      expect(result.bundledData).toBeTruthy();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("generates valid OASIS SARIF v2.1.0 log from lint results", () => {
    const mockResult: ILintResult = {
      format: ESpecFormat.OpenApi,
      sourcePath: "/path/to/spec.yaml",
      passed: false,
      violations: [
        {
          ruleId: "missing-operation-id",
          severity: ESeverity.Error,
          message: "Operation GET /users must have an operationId",
          path: "paths./users.get",
        },
      ],
    };

    const sarifJson = renderSarifReport(mockResult);
    const sarif = JSON.parse(sarifJson);
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.$schema).toContain("sarif");
    expect(sarif.runs.length).toBe(1);
    expect(sarif.runs[0]?.results.length).toBe(1);
    expect(sarif.runs[0]?.results[0]?.ruleId).toBe("missing-operation-id");
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { findConfigFile, loadConfigFile, invalidateConfigCache, CONFIG_FILENAMES } from "../src/config/configResolver.js";
import { lintSpec, ESeverity } from "@mrjacket/smile";

describe("Smile Configuration Resolver", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smile-config-test-"));
    invalidateConfigCache();
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // cleanup best-effort
    }
  });

  it("exports expected standard configuration filenames", () => {
    expect(CONFIG_FILENAMES).toContain("config.smile.json");
    expect(CONFIG_FILENAMES).toContain("smile.config.json");
    expect(CONFIG_FILENAMES).toContain(".smilerc.json");
    expect(CONFIG_FILENAMES).toContain("smile.json");
  });

  it("finds config.smile.json in current directory", () => {
    const configPath = path.join(tmpDir, "config.smile.json");
    fs.writeFileSync(configPath, JSON.stringify({ rules: { "channel-description": "off" } }), "utf-8");

    const found = findConfigFile(tmpDir);
    expect(found).toBe(configPath);
  });

  it("finds smile.config.json traversing upwards from a subfolder", () => {
    const subDir = path.join(tmpDir, "src", "specs");
    fs.mkdirSync(subDir, { recursive: true });

    const configPath = path.join(tmpDir, "smile.config.json");
    fs.writeFileSync(configPath, JSON.stringify({ rules: { "operation-summary": "warn" } }), "utf-8");

    const found = findConfigFile(subDir, tmpDir);
    expect(found).toBe(configPath);
  });

  it("returns undefined when no config file exists within stopDir boundary", () => {
    const subDir = path.join(tmpDir, "sub");
    fs.mkdirSync(subDir, { recursive: true });

    const found = findConfigFile(subDir, tmpDir);
    expect(found).toBeUndefined();
  });

  it("loads and parses valid configuration file with caching", () => {
    const configPath = path.join(tmpDir, "config.smile.json");
    const testConfig = {
      rules: {
        "operation-summary": "off" as const,
      },
      maxWarnings: 5,
    };
    fs.writeFileSync(configPath, JSON.stringify(testConfig), "utf-8");

    const parsed1 = loadConfigFile(configPath);
    expect(parsed1.maxWarnings).toBe(5);
    expect(parsed1.rules?.["operation-summary"]).toBe("off");

    // Test caching returns identical parsed object
    const parsed2 = loadConfigFile(configPath);
    expect(parsed2).toBe(parsed1);

    // Invalidate cache and verify reload
    invalidateConfigCache(configPath);
    const parsed3 = loadConfigFile(configPath);
    expect(parsed3).toEqual(testConfig);
  });

  it("gracefully falls back to empty object on corrupted JSON config file", () => {
    const configPath = path.join(tmpDir, "config.smile.json");
    fs.writeFileSync(configPath, "{ corrupted json: invalid }", "utf-8");

    const parsed = loadConfigFile(configPath);
    expect(parsed).toEqual({});
  });

  it("applies user config rules to suppress violations during linting", async () => {
    const specPath = path.join(tmpDir, "petstore.yaml");
    const brokenYaml = `
openapi: "3.0.3"
info:
  title: Sample API
  version: "1.0.0"
paths:
  /pets:
    get:
      responses:
        "200":
          description: OK
`;
    fs.writeFileSync(specPath, brokenYaml, "utf-8");

    // 1. Without config (default strict rules) -> catches missing-operation-id and missing-summary
    const defaultResult = await lintSpec(specPath, {});
    expect(defaultResult.violations.some(v => v.ruleId === "missing-operation-id")).toBe(true);

    // 2. With user config turning off "missing-operation-id"
    const customConfig = {
      rules: {
        "missing-operation-id": "off" as const,
      },
    };
    const configuredResult = await lintSpec(specPath, customConfig);
    expect(configuredResult.violations.some(v => v.ruleId === "missing-operation-id")).toBe(false);
  });

  it("resolves config automatically via resolveSmileConfig from document URI", async () => {
    const { resolveSmileConfig } = await import("../src/config/configResolver.js");
    const { Uri } = await import("vscode");

    const configPath = path.join(tmpDir, "config.smile.json");
    fs.writeFileSync(configPath, JSON.stringify({ rules: { "channel-description": "off" } }), "utf-8");

    const specPath = path.join(tmpDir, "spec.yaml");
    fs.writeFileSync(specPath, "openapi: 3.0.0", "utf-8");

    const resolved = await resolveSmileConfig(Uri.file(specPath));
    expect(resolved.isCustom).toBe(true);
    expect(resolved.configPath).toBe(configPath);
    expect(resolved.config.rules?.["channel-description"]).toBe("off");
  });
});

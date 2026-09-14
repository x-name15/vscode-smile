import { describe, it, expect } from "vitest";
import { resolveLocationInText } from "../src/diagnostics/locationResolver.js";

describe("locationResolver", () => {
  const sampleYaml = `openapi: 3.0.0
info:
  title: Sample API
  version: 1.0.0
paths:
  /users:
    get:
      responses:
        "200":
          description: OK
`;

  it("resolves exact line and column for nested keys like paths./users.get", () => {
    const loc = resolveLocationInText(sampleYaml, "paths./users.get");
    expect(loc.startLine).toBe(6); // 0-indexed line 6 is '    get:'
    expect(loc.startCharacter).toBe(4);
    expect(loc.endLine).toBe(6);
    expect(loc.endCharacter).toBe(7);
  });

  it("resolves leaf property when matching path", () => {
    const loc = resolveLocationInText(sampleYaml, "paths./users.get.responses.200");
    expect(loc.startLine).toBe(8); // '        "200":'
    expect(loc.startCharacter).toBe(9); // 8 spaces + 1 quote = index 9
  });

  it("falls back gracefully for empty or unknown path", () => {
    const loc = resolveLocationInText(sampleYaml, "");
    expect(loc.startLine).toBe(0);
    expect(loc.startCharacter).toBe(0);

    const locUnknown = resolveLocationInText(sampleYaml, "non.existent.path");
    expect(locUnknown.startLine).toBe(0);
  });
});

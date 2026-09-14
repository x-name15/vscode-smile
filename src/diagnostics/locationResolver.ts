/**
 * @fileoverview Resolves exact line and column ranges in text documents from smile violation paths.
 * Translates paths like 'paths./users.get', 'channels.order/created', 'types.User.name'
 * into concrete line/column ranges so squiggles land precisely on the problem.
 */

import type { IDocumentRange } from "../models/index.js";

/**
 * Searches document text for the best matching line and column for a given JSON/YAML path.
 * Employs hierarchical segment matching and fallback key targeting to guarantee accurate
 * squiggles instead of whole-file highlighting.
 *
 * @param text - The full text content of the specification document.
 * @param path - The dot-separated JSON/YAML path (e.g., 'paths./users.get' or 'channels.order/created').
 * @returns A resolved IDocumentRange structure containing start and end line/character numbers.
 */
export function resolveLocationInText(text: string, path: string): IDocumentRange {
  if (!path || path.trim() === "") {
    return { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 1 };
  }

  const lines = text.split(/\r?\n/);
  const segments = path.split(".").filter(Boolean);
  const targetKey = segments[segments.length - 1] || "";

  // Strategy 1: Look for the specific path sequence downwards
  // For paths like "paths./users.get", search for lines containing the keys
  if (segments.length > 0) {
    let currentLineIndex = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;
      // Escape for regex
      const escaped = segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Key can be in quotes or unquoted, followed by a colon
      const keyRegex = new RegExp(`(^|\\s|["'])${escaped}(["']?\\s*:)`, "i");

      let found = false;
      for (let l = currentLineIndex; l < lines.length; l++) {
        const lineText = lines[l]!;
        const match = keyRegex.exec(lineText);
        if (match) {
          currentLineIndex = l;
          found = true;
          // If this is the last segment, return the precise column position
          if (i === segments.length - 1) {
            const colIndex = lineText.indexOf(segment);
            return {
              startLine: l,
              startCharacter: colIndex >= 0 ? colIndex : 0,
              endLine: l,
              endCharacter: (colIndex >= 0 ? colIndex : 0) + segment.length,
            };
          }
          break;
        }
      }

      if (!found) {
        break;
      }
    }
  }

  // Strategy 2: Direct search for targetKey in quotes or followed by colon
  if (targetKey) {
    const escaped = targetKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const simpleRegex = new RegExp(`(^|\\s|["'])${escaped}(["']?\\s*:)`, "i");

    for (let l = 0; l < lines.length; l++) {
      const lineText = lines[l]!;
      if (simpleRegex.test(lineText)) {
        const col = lineText.indexOf(targetKey);
        return {
          startLine: l,
          startCharacter: col >= 0 ? col : 0,
          endLine: l,
          endCharacter: (col >= 0 ? col : 0) + targetKey.length,
        };
      }
    }
  }

  // Fallback: Return the first line
  return { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: lines[0]?.length || 1 };
}

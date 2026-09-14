/**
 * @fileoverview Domain models and interfaces for the VS Code Smile extension.
 * Follows team conventions: Hungarian notation (I... for interfaces, E... for enums).
 */

import type { Diagnostic, Range } from "vscode";
import type { IViolation, ESpecFormat, ISmileConfig } from "@mrjacket/smile";

/**
 * Extension configuration interface matching contributes.configuration in package.json.
 */
export interface ISmileExtensionConfig {
  /**
   * Whether real-time contract diagnostics are enabled.
   */
  enable: boolean;

  /**
   * Trigger mode for running contract validation (onSave or debounced onType).
   */
  runOn: "onSave" | "onType";

  /**
   * Maximum allowable warnings before marking contract as failed (-1 for unlimited).
   */
  maxWarnings: number;
}

/**
 * Resolved line and column range in a text document.
 */
export interface IDocumentRange {
  /**
   * Zero-based start line index.
   */
  startLine: number;

  /**
   * Zero-based start character index.
   */
  startCharacter: number;

  /**
   * Zero-based end line index.
   */
  endLine: number;

  /**
   * Zero-based end character index.
   */
  endCharacter: number;
}

/**
 * Extended diagnostic representation linking smile violations to editor positions.
 */
export interface ISmileDiagnosticContext {
  /**
   * Raw violation emitted by the smile linter.
   */
  violation: IViolation;

  /**
   * Format of the specification document.
   */
  format: ESpecFormat;

  /**
   * Concrete VS Code editor range mapped to the violation path.
   */
  range: Range;

  /**
   * Constructed VS Code diagnostic for language diagnostics collection.
   */
  diagnostic: Diagnostic;
}

/**
 * Resolved Smile project configuration for a document or workspace.
 */
export interface ISmileResolvedConfig {
  /**
   * Active configuration object passed to smile linters.
   */
  config: ISmileConfig;

  /**
   * Absolute path to the detected configuration file, if any.
   */
  configPath?: string;

  /**
   * Whether a custom configuration file was found and loaded (false if fallback default).
   */
  isCustom: boolean;
}

/**
 * Status summary for the active document contract.
 */
export interface IDocumentContractStatus {
  /**
   * Indicates if the document is a recognized API contract specification.
   */
  isSpec: boolean;

  /**
   * Detected specification format (OpenAPI, AsyncAPI, etc.), if recognized.
   */
  format?: ESpecFormat;

  /**
   * Total count of error-level violations.
   */
  errorCount: number;

  /**
   * Total count of warning-level violations.
   */
  warningCount: number;

  /**
   * Whether the contract passes all criteria.
   */
  passed: boolean;

  /**
   * Absolute path to the configuration file used during linting, if any.
   */
  configPath?: string;

  /**
   * Whether custom project rules were applied.
   */
  isCustomConfig?: boolean;
}

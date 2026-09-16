/**
 * @fileoverview Core diagnostics engine.
 * Connects VS Code documents with @mrjacket/smile linters and updates DiagnosticCollection.
 */

import * as vscode from "vscode";
import { lintSpec, ESeverity, ESpecFormat, type ILintResult } from "@mrjacket/smile";
import { resolveLocationInText } from "./locationResolver.js";
import { resolveSmileConfig } from "../config/configResolver.js";
import type { IDocumentContractStatus } from "../models/index.js";

/**
 * Core diagnostics engine for the Smile extension.
 * Connects VS Code documents with @mrjacket/smile linters, honors project-level
 * configurations (config.smile.json), and populates VS Code DiagnosticCollection.
 */
export class DiagnosticsEngine {
  /** Underlying VS Code diagnostic collection for inline squiggles and Problems tab. */
  private diagnosticCollection: vscode.DiagnosticCollection;

  /** Cache of recent contract statuses keyed by document URI string. */
  private lastStatuses = new Map<string, IDocumentContractStatus>();

  /** Cache of recent raw violation records keyed by document URI string. */
  private lastViolations = new Map<string, Array<{ ruleId: string; message: string; path: string; severity: string }>>();

  /**
   * Initializes a new instance of DiagnosticsEngine.
   *
   * @param collectionName - Identifier used when creating the diagnostic collection (defaults to "smile").
   */
  constructor(collectionName = "smile") {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection(collectionName);
  }

  /**
   * Disposes the diagnostic collection and clears all cached statuses and violations.
   */
  public dispose(): void {
    this.diagnosticCollection.clear();
    this.diagnosticCollection.dispose();
    this.lastStatuses.clear();
    this.lastViolations.clear();
  }

  /**
   * Retrieves the cached contract status for a given document URI.
   *
   * @param uri - The document URI to query.
   * @returns The contract status summary, or undefined if document has not been linted yet.
   */
  public getStatus(uri: vscode.Uri): IDocumentContractStatus | undefined {
    return this.lastStatuses.get(uri.toString());
  }

  /**
   * Retrieves the raw list of violations for a given document URI.
   *
   * @param uri - The document URI to query.
   * @returns An array of violation objects, or an empty array if none found.
   */
  public getLastViolations(uri: vscode.Uri): Array<{ ruleId: string; message: string; path: string; severity: string }> {
    return this.lastViolations.get(uri.toString()) || [];
  }

  /**
   * Clears all diagnostics and cached statuses for a given document.
   *
   * @param uri - The document URI whose diagnostics should be removed.
   */
  public clearDocument(uri: vscode.Uri): void {
    this.diagnosticCollection.delete(uri);
    this.lastStatuses.delete(uri.toString());
    this.lastViolations.delete(uri.toString());
  }

  /**
   * Lints a VS Code text document using @mrjacket/smile, taking into account project configuration.
   * Translates contract violations into VS Code Diagnostics and updates status tracking.
   *
   * @param document - The text document to validate.
   * @returns A promise resolving to the contract status summary.
   */
  public async lintDocument(document: vscode.TextDocument): Promise<IDocumentContractStatus> {
    const filePath = document.uri.fsPath;

    // Ignore unsupported schemes (git, output, walkThrough, etc.)
    if (document.uri.scheme !== "file" && document.uri.scheme !== "untitled") {
      return { isSpec: false, errorCount: 0, warningCount: 0, passed: true };
    }

    // Ignore unsupported file extensions (.md, .ts, .js, .txt, .json non-specs, etc.)
    const VALID_SPEC_EXTENSIONS = /\.(ya?ml|json|graphql|gql|proto)$/i;
    const filename = filePath ? filePath.split(/[/\\]/).pop() || "" : "";
    const isExcludedConfig =
      /^(package(-lock)?|tsconfig(\..+)?|jsconfig(\..+)?)\.json$/i.test(filename) ||
      /^(config\.smile|smile\.config|\.smilerc|smile)\.json$/i.test(filename);

    if ((filePath && !VALID_SPEC_EXTENSIONS.test(filePath)) || isExcludedConfig) {
      this.clearDocument(document.uri);
      const status: IDocumentContractStatus = {
        isSpec: false,
        errorCount: 0,
        warningCount: 0,
        passed: true,
      };
      this.lastStatuses.set(document.uri.toString(), status);
      return status;
    }

    try {
      // 1. Resolve project configuration (e.g. config.smile.json)
      const resolvedConfig = await resolveSmileConfig(document.uri);

      // 2. Execute lintSpec passing the resolved project configuration
      const result: ILintResult = await lintSpec(filePath, resolvedConfig.config);

      if (result.format === ESpecFormat.Unknown) {
        this.clearDocument(document.uri);
        const status: IDocumentContractStatus = {
          isSpec: false,
          errorCount: 0,
          warningCount: 0,
          passed: true,
        };
        this.lastStatuses.set(document.uri.toString(), status);
        return status;
      }

      const text = document.getText();
      const diagnostics: vscode.Diagnostic[] = [];

      for (const v of result.violations) {
        const docRange = resolveLocationInText(text, v.path);
        const range = new vscode.Range(
          docRange.startLine,
          docRange.startCharacter,
          docRange.endLine,
          docRange.endCharacter
        );

        const severity =
          v.severity === ESeverity.Error
            ? vscode.DiagnosticSeverity.Error
            : v.severity === ESeverity.Warning
            ? vscode.DiagnosticSeverity.Warning
            : vscode.DiagnosticSeverity.Information;

        const diagnostic = new vscode.Diagnostic(range, v.message, severity);
        diagnostic.source = "smile";
        diagnostic.code = v.ruleId;

        diagnostics.push(diagnostic);
      }

      this.diagnosticCollection.set(document.uri, diagnostics);

      const errorCount = result.violations.filter(v => v.severity === ESeverity.Error).length;
      const warningCount = result.violations.filter(v => v.severity === ESeverity.Warning).length;

      // Determine passed state considering maxWarnings if configured
      let passed = result.passed;
      if (resolvedConfig.config.maxWarnings !== undefined && resolvedConfig.config.maxWarnings >= 0) {
        if (warningCount > resolvedConfig.config.maxWarnings) {
          passed = false;
        }
      }

      const status: IDocumentContractStatus = {
        isSpec: true,
        format: result.format,
        errorCount,
        warningCount,
        passed,
        configPath: resolvedConfig.configPath,
        isCustomConfig: resolvedConfig.isCustom,
      };

      this.lastStatuses.set(document.uri.toString(), status);
      this.lastViolations.set(
        document.uri.toString(),
        result.violations.map(v => ({
          ruleId: v.ruleId,
          message: v.message,
          path: v.path,
          severity: v.severity,
        }))
      );
      return status;
    } catch {
      // Not a valid or parseable spec — clear diagnostics
      this.clearDocument(document.uri);
      const status: IDocumentContractStatus = {
        isSpec: false,
        errorCount: 0,
        warningCount: 0,
        passed: true,
      };
      this.lastStatuses.set(document.uri.toString(), status);
      return status;
    }
  }
}

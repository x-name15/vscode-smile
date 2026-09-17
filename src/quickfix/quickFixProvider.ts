/**
 * @fileoverview CodeActionProvider providing 1-click Quick Fixes for smile diagnostics.
 * When cursor or document encounters 'missing-operation-id' or 'missing-summary',
 * this provider suggests applying safe canonical autofixes.
 */

import * as vscode from "vscode";
import { FIXABLE_RULES, isFixableRule } from "./rules.js";

export { FIXABLE_RULES, isFixableRule };

/**
 * CodeActionProvider implementation for Smile.
 * Provides 1-click Quick Fixes in the editor lightbulb menu for safe violations
 * such as missing operationIds or summaries.
 */
export class SmileQuickFixProvider implements vscode.CodeActionProvider {
  /**
   * The kinds of code actions provided by this class.
   */
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  /**
   * Provides code actions for the given document and context.
   *
   * @param document - The document in which the command was invoked.
   * @param _range - The selector or cursor range where the action was invoked.
   * @param context - Context carrying diagnostic information.
   * @returns An array of CodeAction items or an empty array if no fixable diagnostics match.
   */
  public provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    // Find diagnostics produced by smile with fixable rule IDs
    const smileDiagnostics = context.diagnostics.filter(
      d => d.source === "smile" && typeof d.code === "string" && isFixableRule(d.code)
    );

    if (smileDiagnostics.length > 0) {
      // 1. Specific fix for each diagnostic under cursor
      for (const diagnostic of smileDiagnostics) {
        const ruleId = String(diagnostic.code);
        const label = ruleId === "missing-operation-id"
          ? "operationId"
          : ruleId === "missing-summary"
          ? "summary"
          : ruleId;

        const specificAction = new vscode.CodeAction(
          `☺ Smile: Autofix '${ruleId}' (generate canonical ${label})`,
          vscode.CodeActionKind.QuickFix
        );
        specificAction.command = {
          command: "smile.fixCurrentFile",
          title: `Smile: Autofix ${ruleId}`,
          arguments: [document.uri],
        };
        specificAction.diagnostics = [diagnostic];
        specificAction.isPreferred = true;
        actions.push(specificAction);
      }

      // 2. Global action to fix all safe issues in file
      const fixAllAction = new vscode.CodeAction(
        "☺ Smile: Fix all safe contract issues in this file",
        vscode.CodeActionKind.QuickFix
      );
      fixAllAction.command = {
        command: "smile.fixCurrentFile",
        title: "Smile: Autofix Safe Issues on Current File",
        arguments: [document.uri],
      };
      fixAllAction.diagnostics = smileDiagnostics;
      actions.push(fixAllAction);
    }

    return actions;
  }
}

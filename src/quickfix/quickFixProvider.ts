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
      const fixAction = new vscode.CodeAction(
        "☺ Smile: Automatically fix safe contract issues",
        vscode.CodeActionKind.QuickFix
      );
      fixAction.command = {
        command: "smile.fixCurrentFile",
        title: "Smile: Autofix Safe Issues on Current File",
        arguments: [document.uri],
      };
      fixAction.diagnostics = smileDiagnostics;
      fixAction.isPreferred = true;

      actions.push(fixAction);
    }

    return actions;
  }
}

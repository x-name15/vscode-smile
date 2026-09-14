/**
 * @fileoverview VS Code Command handlers for Smile.
 * Provides 'smile.lintCurrentFile' and 'smile.fixCurrentFile'.
 */

import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import { fixSpecFile } from "@mrjacket/smile";
import type { DiagnosticsEngine } from "../diagnostics/diagnosticsEngine.js";
import type { StatusBarManager } from "../statusBar/statusBarManager.js";
import { RulesManagerWebview } from "../webviews/rulesManagerWebview.js";
import { SmokeTesterWebview } from "../webviews/smokeTesterWebview.js";
import { runBundleSpecification, runExportContractReport } from "../webviews/bundlerExporter.js";
import { InitWizardWebview } from "../webviews/initWizardWebview.js";

/**
 * Registers all Smile extension commands with the VS Code extension context.
 *
 * Supported commands:
 * - `smile.lintCurrentFile`: Manually triggers contract validation on the active editor and alerts the user.
 * - `smile.fixCurrentFile`: Applies deterministic AST-based autofixes (operationIds and summaries) without mutating comments.
 * - `smile.jumpToViolation`: Navigates to a specific line and column in a file, highlighting the range.
 * - `smile.showViolationDetail`: Displays an interactive modal with full violation details and autofix shortcuts.
 *
 * @param context - Extension context for subscription lifecycle management.
 * @param diagnosticsEngine - Central diagnostics engine handling spec validation.
 * @param statusBarManager - Status bar manager to reflect contract results.
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  diagnosticsEngine: DiagnosticsEngine,
  statusBarManager: StatusBarManager
): void {
  // Command: Lint Current File
  const lintCommand = vscode.commands.registerCommand("smile.lintCurrentFile", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage("Smile: No active editor to lint.");
      return;
    }

    const status = await diagnosticsEngine.lintDocument(editor.document);
    statusBarManager.update(status);

    if (status.isSpec) {
      if (status.passed && status.warningCount === 0) {
        vscode.window.showInformationMessage(`☺ Smile: ${status.format} spec is completely clean!`);
      } else if (!status.passed) {
        vscode.window.showErrorMessage(
          `🚫 Smile: ${status.errorCount} error(s) and ${status.warningCount} warning(s) found in ${status.format} spec.`
        );
      } else {
        vscode.window.showWarningMessage(
          `⚠️ Smile: Spec has ${status.warningCount} warning(s).`
        );
      }
    } else {
      vscode.window.showInformationMessage("Smile: Active document is not a recognized API specification.");
    }
  });

  // Command: Autofix Safe Issues on Current File
  const fixCommand = vscode.commands.registerCommand("smile.fixCurrentFile", async (fileUri?: vscode.Uri) => {
    const uri = fileUri || vscode.window.activeTextEditor?.document.uri;
    if (!uri || uri.scheme !== "file") {
      vscode.window.showInformationMessage("Smile: No active file to fix.");
      return;
    }

    try {
      // Run deterministic AST autofix on the file
      const result = fixSpecFile(uri.fsPath);

      if (result.fixedCount > 0) {
        vscode.window.showInformationMessage(
          `☺ Smile: Successfully fixed ${result.fixedCount} issue(s) without altering comments!`
        );

        // If open in editor, re-lint
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.uri.toString() === uri.toString()) {
          const status = await diagnosticsEngine.lintDocument(editor.document);
          statusBarManager.update(status);
        }
      } else {
        vscode.window.showInformationMessage("Smile: No fixable issues (operationId/summary) found in this file.");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Smile Autofix failed: ${msg}`);
    }
  });

  // Command: Jump to Violation in Editor
  const jumpCommand = vscode.commands.registerCommand(
    "smile.jumpToViolation",
    async (fileUri: vscode.Uri, range: { startLine: number; startCharacter: number; endLine: number; endCharacter: number }) => {
      const doc = await vscode.workspace.openTextDocument(fileUri);
      const editor = await vscode.window.showTextDocument(doc);
      const vsRange = new vscode.Range(range.startLine, range.startCharacter, range.endLine, range.endCharacter);
      editor.selection = new vscode.Selection(vsRange.start, vsRange.end);
      editor.revealRange(vsRange, vscode.TextEditorRevealType.InCenter);
    }
  );

  // Command: Show Detailed Modal / QuickPick for Violation
  const detailCommand = vscode.commands.registerCommand(
    "smile.showViolationDetail",
    async (violation: { ruleId: string; message: string; path: string; severity: string }) => {
      const icon = violation.severity === "error" ? "🚫" : "⚠️";
      const message = `${icon} [${violation.ruleId.toUpperCase()}]\n\n${violation.message}\n\n📍 Path: ${violation.path || "root"}\nLevel: ${violation.severity.toUpperCase()}`;

      const choice = await vscode.window.showInformationMessage(
        message,
        { modal: true },
        "Go to Specification",
        "Run Autofix"
      );

      if (choice === "Run Autofix") {
        vscode.commands.executeCommand("smile.fixCurrentFile");
      }
    }
  );

  // Command: Open Visual Rules Manager
  const openRulesManagerCommand = vscode.commands.registerCommand(
    "smile.openRulesManager",
    () => {
      RulesManagerWebview.createOrShow(context.extensionUri);
    }
  );

  // Command: Open Visual Smoke Tester
  const openSmokeTesterCommand = vscode.commands.registerCommand(
    "smile.openSmokeTester",
    (fileUri?: vscode.Uri) => {
      SmokeTesterWebview.createOrShow(context.extensionUri, fileUri?.fsPath);
    }
  );

  // Command: Bundle Multi-File Specification
  const bundleSpecCommand = vscode.commands.registerCommand(
    "smile.bundleSpec",
    async (fileUri?: vscode.Uri) => {
      await runBundleSpecification(fileUri);
    }
  );

  // Command: Export Contract Report (SARIF / Markdown / HTML)
  const exportReportCommand = vscode.commands.registerCommand(
    "smile.exportReport",
    async (fileUri?: vscode.Uri) => {
      await runExportContractReport(fileUri);
    }
  );

  // Command: Open Project Setup Wizard
  const openInitWizardCommand = vscode.commands.registerCommand(
    "smile.openInitWizard",
    () => {
      InitWizardWebview.createOrShow(context.extensionUri);
    }
  );

  // Command: Install Native Git Pre-Commit Hook (smile install-hook)
  const installHookCommand = vscode.commands.registerCommand(
    "smile.installHook",
    async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage("Smile: Open a workspace folder first to install the pre-commit hook.");
        return;
      }

      const rootDir = workspaceFolders[0].uri.fsPath;
      const gitDir = path.join(rootDir, ".git");

      if (!fs.existsSync(gitDir)) {
        vscode.window.showErrorMessage("Smile: Workspace is not a git repository (missing .git directory).");
        return;
      }

      const hooksDir = path.join(gitDir, "hooks");
      const hookPath = path.join(hooksDir, "pre-commit");

      if (!fs.existsSync(hooksDir)) {
        fs.mkdirSync(hooksDir, { recursive: true });
      }

      if (fs.existsSync(hookPath)) {
        const overwrite = await vscode.window.showWarningMessage(
          "Smile: A git pre-commit hook already exists. Overwrite it with Smile contract gate?",
          "Overwrite",
          "Cancel"
        );
        if (overwrite !== "Overwrite") return;
      }

      const hookScript = `#!/bin/sh\n# smile pre-commit hook\n\necho "🩺 Running smile contract linter..."\nnpx @mrjacket/smile lint .\n\nif [ $? -ne 0 ]; then\n  echo ""\n  echo "❌ API contract violations found. Commit aborted."\n  echo "Please fix the errors or run 'npx @mrjacket/smile deduce <spec>' before committing."\n  exit 1\nfi\n`;

      fs.writeFileSync(hookPath, hookScript, { encoding: "utf-8", mode: 0o755 });
      vscode.window.showInformationMessage("☺ Smile: Pre-commit hook installed! Git will now validate API contracts before every commit.");
    }
  );

  context.subscriptions.push(
    lintCommand,
    fixCommand,
    jumpCommand,
    detailCommand,
    openRulesManagerCommand,
    openSmokeTesterCommand,
    bundleSpecCommand,
    exportReportCommand,
    openInitWizardCommand,
    installHookCommand
  );
}

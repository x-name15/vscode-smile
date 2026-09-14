/**
 * @fileoverview Manages the Smile status bar item in VS Code.
 * Displays clean or breach status when an active document is a supported specification.
 */

import * as vscode from "vscode";
import type { IDocumentContractStatus } from "../models/index.js";

/**
 * Manages the persistent status bar item indicating API contract compliance.
 * Highlights clean status in green/neutral or contract breach in warning/red.
 */
export class StatusBarManager {
  /** The underlying VS Code StatusBarItem. */
  private statusBarItem: vscode.StatusBarItem;

  /**
   * Initializes the status bar item aligned to the right side of the status bar.
   */
  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = "smile.lintCurrentFile";
  }

  /**
   * Disposes the status bar item when the extension deactivates.
   */
  public dispose(): void {
    this.statusBarItem.dispose();
  }

  /**
   * Updates the status bar icon, text, tooltip, and colors according to the contract status.
   * Hides the status bar item if the active document is not an API specification.
   *
   * @param status - The contract status summary for the active document.
   */
  public update(status?: IDocumentContractStatus): void {
    if (!status || !status.isSpec) {
      this.statusBarItem.hide();
      return;
    }

    if (status.passed && status.warningCount === 0) {
      this.statusBarItem.text = `$(check) Smile: Clean (${status.format})`;
      this.statusBarItem.tooltip = `Smile: Contract honors specification with 0 violations. Click to re-lint.`;
      this.statusBarItem.backgroundColor = undefined;
    } else if (status.passed && status.warningCount > 0) {
      this.statusBarItem.text = `$(alert) Smile: ${status.warningCount} warning(s)`;
      this.statusBarItem.tooltip = `Smile: ${status.warningCount} warning(s) found. Click to re-lint.`;
      this.statusBarItem.backgroundColor = undefined;
    } else {
      this.statusBarItem.text = `$(error) Smile: ${status.errorCount} error(s)`;
      this.statusBarItem.tooltip = `Smile: Contract breached! ${status.errorCount} error(s) found. Click to re-lint.`;
      this.statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
    }

    this.statusBarItem.show();
  }
}

/**
 * @fileoverview TreeDataProvider for the Smile Commands & Tools view.
 * Provides direct, 1:1 access to Smile CLI commands and visual workflows
 * (The Breaching Detector, Smile Deduce, Visual Config, Bundler, Exporter, Init Wizard, Git Hook).
 */

import * as vscode from "vscode";

/**
 * Represents a command item in the Smile Commands view.
 */
export class SmileCommandItem extends vscode.TreeItem {
  /**
   * Initializes a new SmileCommandItem.
   *
   * @param label - Command title.
   * @param description - CLI mapping / description.
   * @param icon - Theme icon for the command.
   * @param commandId - Registered VS Code command identifier.
   * @param tooltipText - Extended tooltip explaining what the tool does.
   */
  constructor(
    public readonly label: string,
    public readonly description: string,
    icon: vscode.ThemeIcon,
    commandId: string,
    tooltipText: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.iconPath = icon;
    this.tooltip = tooltipText;
    this.command = {
      command: commandId,
      title: label,
    };
  }
}

/**
 * TreeDataProvider implementing the Smile Commands & Tools view.
 * Aligned 1:1 with the Smile CLI commands and workflows.
 */
export class SmileCommandsProvider implements vscode.TreeDataProvider<SmileCommandItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SmileCommandItem | undefined | null | void> =
    new vscode.EventEmitter<SmileCommandItem | undefined | null | void>();

  readonly onDidChangeTreeData: vscode.Event<SmileCommandItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: SmileCommandItem): vscode.TreeItem {
    return element;
  }

  public getChildren(): Thenable<SmileCommandItem[]> {
    const items: SmileCommandItem[] = [
      new SmileCommandItem(
        "Rules Manager",
        "Visual Rules Editor (smile config)",
        new vscode.ThemeIcon("gear"),
        "smile.openRulesManager",
        "Visual Rules Manager: inspect active configuration and configure rule severities (Error | Warn | Off)."
      ),
      new SmileCommandItem(
        "API Smoke Tester",
        "Live Endpoint Validator (smile test)",
        new vscode.ThemeIcon("pulse", new vscode.ThemeColor("charts.red")),
        "smile.openSmokeTester",
        "The Breaching Detector: execute real HTTP requests against running server endpoints to verify contracts in real time."
      ),
      new SmileCommandItem(
        "Spec Bundler",
        "Resolve $ref Pointers (smile bundle)",
        new vscode.ThemeIcon("package"),
        "smile.bundleSpec",
        "Spec Bundler: consolidate modular multi-file specifications into a single file by resolving external $ref pointers."
      ),
      new SmileCommandItem(
        "Report Exporter",
        "SARIF / Markdown / JUnit / HTML",
        new vscode.ThemeIcon("output"),
        "smile.exportReport",
        "Report Exporter: export full contract diagnostic audits into OASIS SARIF v2.1.0, Markdown, JUnit, or HTML."
      ),
      new SmileCommandItem(
        "Setup Wizard",
        "Scaffold Project (smile init)",
        new vscode.ThemeIcon("sparkle"),
        "smile.openInitWizard",
        "Project Setup Wizard: scaffold config.smile.json, GitHub Actions CI workflow, and starter specs."
      ),
      new SmileCommandItem(
        "Install Git Hook",
        "Pre-Commit Contract Gate",
        new vscode.ThemeIcon("shield"),
        "smile.installHook",
        "Git Hook: install native pre-commit hook that validates specifications before every commit."
      ),
    ];

    return Promise.resolve(items);
  }
}

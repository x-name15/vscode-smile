/**
 * @fileoverview TreeDataProvider for the Smile Sidebar View.
 * Groups violations by rule for high-density readability,
 * supports expanding to inspect individual violations, displays active configuration status,
 * and enables direct click-to-jump navigation.
 */

import * as vscode from "vscode";
import * as path from "node:path";
import { resolveLocationInText } from "../diagnostics/locationResolver.js";
import type { DiagnosticsEngine } from "../diagnostics/diagnosticsEngine.js";
import type { IDocumentContractStatus } from "../models/index.js";

/**
 * Normalized violation representation used internally by the tree provider.
 */
interface IViolationRecord {
  /** Identifier of the violated rule (e.g. 'operation-summary'). */
  ruleId: string;
  /** Human-readable explanation of the violation. */
  message: string;
  /** JSON/YAML path in the specification where the violation occurred. */
  path: string;
  /** Severity level ('error' | 'warning'). */
  severity: string;
}

/**
 * TreeDataProvider implementing the Smile Activity Bar Sidebar view.
 */
export class SmileSidebarProvider implements vscode.TreeDataProvider<SmileTreeItem> {
  /** Event emitter for tree data changes. */
  private _onDidChangeTreeData: vscode.EventEmitter<SmileTreeItem | undefined | null | void> =
    new vscode.EventEmitter<SmileTreeItem | undefined | null | void>();

  /** Event firing when the tree data needs to refresh. */
  readonly onDidChangeTreeData: vscode.Event<SmileTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  /**
   * Initializes a new SmileSidebarProvider.
   *
   * @param diagnosticsEngine - The central diagnostics engine to retrieve statuses and violations from.
   */
  constructor(private diagnosticsEngine: DiagnosticsEngine) {}

  /**
   * Triggers a visual refresh of the tree view.
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Returns the visual TreeItem representation of an element.
   *
   * @param element - The tree item being rendered.
   * @returns The element itself.
   */
  public getTreeItem(element: SmileTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Resolves child elements for a given tree item or the root level.
   *
   * @param element - The parent tree item, or undefined for root elements.
   * @returns A promise resolving to an array of child SmileTreeItem nodes.
   */
  public getChildren(element?: SmileTreeItem): Thenable<SmileTreeItem[]> {
    const editor = vscode.window.activeTextEditor;

    // Root elements
    if (!element) {
      if (!editor) {
        return Promise.resolve([
          new SmileTreeItem(
            "No Active Editor",
            "Open an API specification to inspect contracts",
            vscode.TreeItemCollapsibleState.None,
            "info",
            new vscode.ThemeIcon("info")
          ),
        ]);
      }

      const status: IDocumentContractStatus | undefined = this.diagnosticsEngine.getStatus(editor.document.uri);
      const items: SmileTreeItem[] = [];

      // 1. Check if document is an API spec
      if (!status || !status.isSpec) {
        return Promise.resolve([
          new SmileTreeItem(
            "No API Specification Active",
            "Open an API spec to inspect violations",
            vscode.TreeItemCollapsibleState.None,
            "notSpec",
            new vscode.ThemeIcon("file-code")
          ),
        ]);
      }

      const fmt = (status.format ?? "Spec").toUpperCase();

      if (status.passed && status.warningCount === 0) {
        items.push(
          new SmileTreeItem(
            "Contract Honored",
            `${fmt} • Signed Clean (0 violations)`,
            vscode.TreeItemCollapsibleState.None,
            "cleanStatus",
            new vscode.ThemeIcon("pass-filled", new vscode.ThemeColor("charts.green"))
          )
        );
      } else {
        const errorText = status.errorCount > 0 ? `${status.errorCount} error(s)` : "";
        const warnText = status.warningCount > 0 ? `${status.warningCount} warning(s)` : "";
        const summaryText = [errorText, warnText].filter(Boolean).join(", ");
        const icon = status.errorCount > 0
          ? new vscode.ThemeIcon("error", new vscode.ThemeColor("charts.red"))
          : new vscode.ThemeIcon("warning", new vscode.ThemeColor("charts.yellow"));

        // Collapsible Root: Contract Breached (Crime Scene) with grouped subcategories
        const breachRoot = new SmileTreeItem(
          `Crime Scene (${fmt})`,
          summaryText,
          vscode.TreeItemCollapsibleState.Expanded,
          "breachRoot",
          icon
        );
        items.push(breachRoot);
      }

      // 2. Active configuration item
      if (status.configPath) {
        const configBasename = path.basename(status.configPath);
        const configItem = new SmileTreeItem(
          `Config: ${configBasename}`,
          "Custom rules active",
          vscode.TreeItemCollapsibleState.None,
          "configActive",
          new vscode.ThemeIcon("gear"),
          {
            command: "smile.openRulesManager",
            title: "Open Visual Rules Manager",
          }
        );
        configItem.tooltip = `Smile Config: ${status.configPath}\nClick to open Visual Rules Manager.`;
        items.push(configItem);
      } else {
        const configItem = new SmileTreeItem(
          "Config: Default Rules",
          "Strict mode (built-in)",
          vscode.TreeItemCollapsibleState.None,
          "configDefault",
          new vscode.ThemeIcon("shield"),
          {
            command: "smile.openRulesManager",
            title: "Open Visual Rules Manager",
          }
        );
        configItem.tooltip = "Using Smile built-in strict rules. Click to launch Visual Rules Manager.";
        items.push(configItem);
      }

      return Promise.resolve(items);
    }

    // Children of Breach Root: Group by Rule ID
    if (element.contextValue === "breachRoot") {
      if (!editor) return Promise.resolve([]);
      const violations = this.diagnosticsEngine.getLastViolations(editor.document.uri);
      const groups = new Map<string, IViolationRecord[]>();

      for (const v of violations) {
        const list = groups.get(v.ruleId) || [];
        list.push(v);
        groups.set(v.ruleId, list);
      }

      const groupItems: SmileTreeItem[] = [];
      for (const [ruleId, list] of groups.entries()) {
        const hasErrors = list.some(item => item.severity === "error");
        const icon = hasErrors
          ? new vscode.ThemeIcon("error", new vscode.ThemeColor("charts.red"))
          : new vscode.ThemeIcon("warning", new vscode.ThemeColor("charts.yellow"));

        const groupItem = new SmileTreeItem(
          ruleId,
          `${list.length} occurrence${list.length === 1 ? "" : "s"}`,
          vscode.TreeItemCollapsibleState.Expanded,
          "ruleGroup",
          icon
        );
        groupItem.violations = list;
        groupItems.push(groupItem);
      }

      return Promise.resolve(groupItems);
    }

    // Children of Rule Group: Individual violations with short target name
    if (element.contextValue === "ruleGroup" && element.violations) {
      if (!editor) return Promise.resolve([]);
      const text = editor.document.getText();

      return Promise.resolve(
        element.violations.map(v => {
          const loc = resolveLocationInText(text, v.path);
          const isError = v.severity === "error";
          const icon = isError
            ? new vscode.ThemeIcon("circle-filled", new vscode.ThemeColor("charts.red"))
            : new vscode.ThemeIcon("circle-filled", new vscode.ThemeColor("charts.yellow"));

          // Friendly label: display method + route (e.g. GET /users) or target segment
          let displayLabel = v.path || v.ruleId;
          if (displayLabel.startsWith("paths.")) {
            const parts = displayLabel.slice(6).split(".");
            if (parts.length >= 2) {
              const method = parts[parts.length - 1].toUpperCase();
              const route = parts.slice(0, parts.length - 1).join(".");
              displayLabel = `${method} ${route}`;
            }
          } else if (v.path.includes(".")) {
            const parts = v.path.split(".");
            displayLabel = parts[parts.length - 1] || v.path;
          }

          // Rich Markdown Tooltip containing all the details
          const tooltip = new vscode.MarkdownString();
          tooltip.isTrusted = true;
          tooltip.supportHtml = true;
          tooltip.appendMarkdown(`### ${isError ? "🔴 Error" : "🟡 Warning"}: \`${v.ruleId}\`\n\n`);
          tooltip.appendMarkdown(`**Description:**\n${v.message}\n\n`);
          if (v.path) {
            tooltip.appendMarkdown(`**Path:** \`${v.path}\`\n\n`);
          }
          tooltip.appendMarkdown(`**Location:** Line ${loc.startLine + 1}, Column ${loc.startCharacter + 1}\n\n`);
          tooltip.appendMarkdown(`---\n*Click to jump directly to this line in the editor.*`);

          const jumpCommand: vscode.Command = {
            command: "smile.jumpToViolation",
            title: "Jump to Violation",
            arguments: [editor.document.uri, loc],
          };

          const item = new SmileTreeItem(
            displayLabel,
            `L${loc.startLine + 1}:${loc.startCharacter + 1}`,
            vscode.TreeItemCollapsibleState.None,
            "violationItem",
            icon,
            jumpCommand
          );
          item.tooltip = tooltip;
          return item;
        })
      );
    }

    return Promise.resolve([]);
  }
}

/**
 * Custom TreeItem representation for the Smile Sidebar tree hierarchy.
 */
export class SmileTreeItem extends vscode.TreeItem {
  /** Optional array of raw violations attached to a rule group element. */
  public violations?: IViolationRecord[];

  /**
   * Initializes a new SmileTreeItem.
   *
   * @param label - Main display text of the tree node.
   * @param description - Secondary descriptive string rendered to the right of the label.
   * @param collapsibleState - State indicating if the node can be expanded/collapsed.
   * @param contextValue - Identifier for context-specific actions or views.
   * @param iconPath - Optional theme icon to represent the node.
   * @param command - Optional VS Code command executed when clicking the node.
   */
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly iconPath?: vscode.ThemeIcon,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label} — ${this.description}`;
  }
}

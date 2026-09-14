/**
 * @fileoverview Visual Rules Manager Webview.
 * Provides a rich, interactive graphical interface for editing Smile rules
 * and saving configurations directly to config.smile.json without manual JSON editing.
 */

import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import { SMILE_RULES_METADATA, type IRuleMetadata } from "../models/rulesMetadata.js";
import { findConfigFile, loadConfigFile } from "../config/configResolver.js";
import { getWebviewHtml } from "./webviewUtils.js";
import type { ISmileConfig, RuleSeverity } from "@mrjacket/smile";

/**
 * Message payload sent from Webview to Extension.
 */
interface IRulesManagerWebviewMessage {
  command: "saveRule" | "applyPreset" | "saveAll" | "openConfigFile" | "chooseLocation";
  ruleId?: string;
  severity?: RuleSeverity;
  presetName?: "strict" | "recommended" | "relaxed";
  rules?: Record<string, RuleSeverity>;
  maxWarnings?: number;
}

/**
 * Manages the Visual Rules Manager Webview panel lifecycle.
 */
export class RulesManagerWebview {
  /** Active singleton Webview panel instance. */
  public static currentPanel: RulesManagerWebview | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private customConfigPath?: string;

  /**
   * Opens or reveals the Visual Rules Manager Webview.
   *
   * @param extensionUri - Root URI of the extension.
   */
  public static createOrShow(extensionUri: vscode.Uri): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (RulesManagerWebview.currentPanel) {
      RulesManagerWebview.currentPanel.panel.reveal(column);
      RulesManagerWebview.currentPanel.refresh();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "smileRulesManager",
      "Smile — Visual Rules Manager",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    RulesManagerWebview.currentPanel = new RulesManagerWebview(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, _extensionUri: vscode.Uri) {
    this.panel = panel;

    this.render();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Handle messages sent from Webview UI
    this.panel.webview.onDidReceiveMessage(
      async (message: IRulesManagerWebviewMessage & { command: string }) => {
        await this.handleMessage(message);
      },
      null,
      this.disposables
    );
  }

  /**
   * Refreshes the webview content with latest workspace configuration.
   */
  public refresh(): void {
    this.render();
  }

  /**
   * Disposes the webview and associated event listeners.
   */
  public dispose(): void {
    RulesManagerWebview.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) {
        d.dispose();
      }
    }
  }

  /**
   * Resolves the active target config file path in the workspace.
   */
  private resolveTargetConfigPath(): string {
    if (this.customConfigPath) {
      return this.customConfigPath;
    }
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspaceRoot = workspaceFolders && workspaceFolders[0] ? workspaceFolders[0].uri.fsPath : process.cwd();
    const existing = findConfigFile(workspaceRoot, workspaceRoot);
    return existing || path.join(workspaceRoot, "config.smile.json");
  }

  /**
   * Handles incoming webview events.
   */
  private async handleMessage(message: IRulesManagerWebviewMessage & { command: string }): Promise<void> {
    const configPath = this.resolveTargetConfigPath();

    if (message.command === "chooseLocation") {
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(configPath),
        filters: { "Smile Config": ["json"] },
        title: "Select Smile Configuration Location",
      });
      if (uri) {
        this.customConfigPath = uri.fsPath;
        this.render();
        vscode.window.showInformationMessage(`Smile: Target config set to ${uri.fsPath}`);
      }
      return;
    }

    if (message.command === "openConfigFile") {
      if (fs.existsSync(configPath)) {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(configPath));
        await vscode.window.showTextDocument(doc);
      } else {
        vscode.window.showWarningMessage(`Smile: Config file not found at ${configPath}. Save rules first to create it.`);
      }
      return;
    }

    if (message.command === "saveAll" && message.rules) {
      try {
        let existingConfig: ISmileConfig = {};
        if (fs.existsSync(configPath)) {
          existingConfig = loadConfigFile(configPath);
        }

        const updatedConfig: ISmileConfig = {
          ...existingConfig,
          rules: message.rules,
          maxWarnings: message.maxWarnings !== undefined ? message.maxWarnings : existingConfig.maxWarnings,
        };

        // Ensure parent directory exists
        const parentDir = path.dirname(configPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }

        fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2), "utf-8");
        const rulesCount = Object.keys(message.rules).length;

        // Feedback in VS Code and webview
        vscode.window.showInformationMessage(
          `☺ Smile: Successfully saved ${rulesCount} rules to ${configPath}!`
        );

        this.panel.webview.postMessage({
          command: "saveSucceeded",
          path: configPath,
          rulesCount,
        });

        this.render();
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Smile: Failed to save config: ${msg}`);
      }
    }
  }

  /**
   * Renders the complete HTML dashboard into the webview.
   */
  private render(): void {
    const configPath = this.resolveTargetConfigPath();
    const configExists = fs.existsSync(configPath);
    let activeConfig: ISmileConfig = {};

    if (configExists) {
      activeConfig = loadConfigFile(configPath);
    }

    const activeRules = (activeConfig.rules || {}) as Record<string, RuleSeverity>;
    const maxWarnings = activeConfig.maxWarnings ?? -1;

    const customStyles = `
      .header-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
        gap: 1rem;
      }
      .rules-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
        gap: 12px;
      }
      .rule-card {
        background-color: var(--card-bg);
        border: 1px solid var(--card-border);
        border-radius: 6px;
        padding: 14px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .rule-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 8px;
        gap: 8px;
      }
      .rule-title {
        font-weight: 600;
        font-size: 14px;
      }
      .rule-id {
        font-family: monospace;
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
      }
      .rule-desc {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 12px;
        flex-grow: 1;
      }
      .rule-controls {
        display: flex;
        gap: 6px;
      }
      .tri-btn {
        flex: 1;
        padding: 5px 8px;
        font-size: 12px;
        font-weight: 600;
        background-color: var(--btn-secondary-bg);
        color: var(--btn-secondary-fg);
        border: 1px solid transparent;
        border-radius: 4px;
        cursor: pointer;
        text-align: center;
      }
      .tri-btn.active-error {
        background-color: #f14c4c;
        color: #ffffff;
      }
      .tri-btn.active-warn {
        background-color: #cca700;
        color: #ffffff;
      }
      .tri-btn.active-off {
        background-color: #555555;
        color: #dddddd;
      }
      .search-box {
        margin-bottom: 1rem;
      }
      .preset-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 1.5rem;
        background: var(--card-bg);
        padding: 12px;
        border-radius: 6px;
        border: 1px solid var(--card-border);
      }
    `;

    const bodyContent = `
      <div class="header-container">
        <div>
          <h1>☺ Smile — Visual Rules Manager</h1>
          <p>Configure rule severities visually.</p>
          <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 12px;">
            <span>Target Config:</span>
            <code id="configPathDisplay" style="background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 4px; border: 1px solid var(--card-border); word-break: break-all;">${configPath}</code>
            <button class="btn btn-secondary" style="padding: 3px 8px; font-size: 11px;" onclick="chooseConfigLocation()">Change Location...</button>
          </div>
        </div>
        <div style="display: flex; gap: 8px; align-items: flex-start;">
          <button class="btn btn-secondary" onclick="openConfigFile()">📄 Open JSON</button>
          <button id="saveBtn" class="btn" onclick="saveAllRules()">💾 Save Configuration</button>
        </div>
      </div>

      <div id="saveFeedback" style="display: none; padding: 10px 14px; border-radius: 6px; margin-bottom: 1rem; background: rgba(115, 201, 145, 0.15); border: 1px solid #73c991; color: #73c991; font-weight: 500;"></div>

      <div class="preset-bar">
        <span><strong>Quick Presets:</strong></span>
        <button class="btn btn-secondary" onclick="applyPreset('strict')">🛡️ Strict (Mentalist)</button>
        <button class="btn btn-secondary" onclick="applyPreset('recommended')">⭐ Recommended</button>
        <button class="btn btn-secondary" onclick="applyPreset('relaxed')">🌴 Relaxed</button>
        <div style="margin-left: auto; display: flex; align-items: center; gap: 8px;">
          <label for="maxWarnings"><strong>Max Warnings:</strong></label>
          <input type="number" id="maxWarnings" class="input-text" style="width: 80px;" value="${maxWarnings}" />
        </div>
      </div>

      <div class="search-box">
        <input type="text" id="ruleSearch" class="input-text" placeholder="🔍 Search rules by name or description..." oninput="filterRules()" />
      </div>

      <div class="tab-container">
        <button class="tab-btn active" onclick="switchTab('all', this)">All Formats</button>
        <button class="tab-btn" onclick="switchTab('openapi', this)">OpenAPI</button>
        <button class="tab-btn" onclick="switchTab('asyncapi', this)">AsyncAPI</button>
        <button class="tab-btn" onclick="switchTab('graphql', this)">GraphQL</button>
        <button class="tab-btn" onclick="switchTab('json-schema', this)">JSON Schema</button>
        <button class="tab-btn" onclick="switchTab('grpc', this)">gRPC</button>
        <button class="tab-btn" onclick="switchTab('postman', this)">Postman</button>
      </div>

      <div id="rulesList" class="rules-grid">
        ${this.renderRuleCards(SMILE_RULES_METADATA, activeRules)}
      </div>
    `;

    const scriptContent = `
      let currentTab = 'all';
      const rulesData = ${JSON.stringify(SMILE_RULES_METADATA)};
      const activeRules = ${JSON.stringify(activeRules)};

      function setSeverity(ruleId, severity) {
        activeRules[ruleId] = severity;
        const card = document.querySelector('[data-rule-id="' + ruleId + '"]');
        if (card) {
          card.querySelectorAll('.tri-btn').forEach(btn => {
            btn.classList.remove('active-error', 'active-warn', 'active-off');
          });
          const target = card.querySelector('.btn-' + severity);
          if (target) {
            target.classList.add('active-' + severity);
          }
        }
      }

      function switchTab(format, btn) {
        currentTab = format;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterRules();
      }

      function filterRules() {
        const query = document.getElementById('ruleSearch').value.toLowerCase().trim();
        const cards = document.querySelectorAll('.rule-card');

        cards.forEach(card => {
          const format = card.getAttribute('data-format');
          const title = card.getAttribute('data-title');
          const id = card.getAttribute('data-rule-id');

          const matchesTab = currentTab === 'all' || format === currentTab;
          const matchesQuery = !query || title.includes(query) || id.includes(query);

          card.style.display = (matchesTab && matchesQuery) ? 'flex' : 'none';
        });
      }

      function applyPreset(preset) {
        rulesData.forEach(rule => {
          if (preset === 'strict') {
            setSeverity(rule.id, 'error');
          } else if (preset === 'recommended') {
            setSeverity(rule.id, rule.defaultSeverity);
          } else if (preset === 'relaxed') {
            setSeverity(rule.id, rule.defaultSeverity === 'error' ? 'warn' : 'off');
          }
        });
      }

      function saveAllRules() {
        const maxWarnings = parseInt(document.getElementById('maxWarnings').value, 10);
        vscode.postMessage({
          command: 'saveAll',
          rules: activeRules,
          maxWarnings: isNaN(maxWarnings) ? -1 : maxWarnings
        });
      }

      function chooseConfigLocation() {
        vscode.postMessage({ command: 'chooseLocation' });
      }

      function openConfigFile() {
        vscode.postMessage({ command: 'openConfigFile' });
      }

      window.addEventListener('message', event => {
        const message = event.data;
        if (message.command === 'saveSucceeded') {
          const feedback = document.getElementById('saveFeedback');
          if (feedback) {
            feedback.style.display = 'block';
            feedback.innerHTML = '✅ <strong>Saved!</strong> ' + message.rulesCount + ' rules written to <code>' + message.path + '</code>';
            setTimeout(() => {
              feedback.style.display = 'none';
            }, 6000);
          }
        }
      });
    `;

    this.panel.webview.html = getWebviewHtml({
      title: "Smile — Visual Rules Manager",
      bodyContent,
      scriptContent,
      customStyles,
      webview: this.panel.webview,
    });
  }

  /**
   * Renders rule cards for the webview grid.
   */
  private renderRuleCards(
    rules: readonly IRuleMetadata[],
    activeRules: Record<string, RuleSeverity>
  ): string {
    return rules
      .map(rule => {
        const effectiveSeverity = activeRules[rule.id] ?? rule.defaultSeverity;
        const isFixableBadge = rule.isFixable
          ? `<span class="badge badge-clean" title="Autofix available via QuickFix">💡 Autofix</span>`
          : "";

        return `
          <div class="rule-card" data-rule-id="${rule.id}" data-format="${rule.format}" data-title="${rule.title.toLowerCase()}">
            <div>
              <div class="rule-header">
                <div>
                  <div class="rule-title">${rule.title}</div>
                  <div class="rule-id">${rule.id}</div>
                </div>
                ${isFixableBadge}
              </div>
              <div class="rule-desc">${rule.description}</div>
            </div>
            <div class="rule-controls">
              <button class="tri-btn btn-error ${effectiveSeverity === "error" ? "active-error" : ""}" onclick="setSeverity('${rule.id}', 'error')">Error</button>
              <button class="tri-btn btn-warn ${effectiveSeverity === "warn" ? "active-warn" : ""}" onclick="setSeverity('${rule.id}', 'warn')">Warn</button>
              <button class="tri-btn btn-off ${effectiveSeverity === "off" ? "active-off" : ""}" onclick="setSeverity('${rule.id}', 'off')">Off</button>
            </div>
          </div>
        `;
      })
      .join("");
  }
}

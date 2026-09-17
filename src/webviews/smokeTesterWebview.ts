/**
 * @fileoverview Visual Smoke Tester Webview.
 * Provides a live graphical interface for running runtime contract tests
 * against a running server endpoint using @mrjacket/smile's smoke tester.
 */

import * as vscode from "vscode";
import { runSmokeTest, type ITestResult } from "@mrjacket/smile";
import { getWebviewHtml } from "./webviewUtils.js";

/**
 * Message payload sent from Webview to Extension.
 */
interface ISmokeTesterMessage {
  command: "runTest" | "pickFile";
  specPath?: string;
  baseUrl?: string;
  headers?: string;
  timeoutMs?: number;
}

/**
 * Manages the Visual Smoke Tester Webview panel.
 */
export class SmokeTesterWebview {
  public static currentPanel: SmokeTesterWebview | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private initialSpecPath: string = "";

  /**
   * Opens or reveals the Visual Smoke Tester Webview.
   *
   * @param extensionUri - Root URI of the extension.
   * @param specPath - Optional initial spec path to test (defaults to active editor).
   */
  public static createOrShow(extensionUri: vscode.Uri, specPath?: string): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    const targetSpecPath =
      specPath || vscode.window.activeTextEditor?.document.uri.fsPath || "";

    if (SmokeTesterWebview.currentPanel) {
      SmokeTesterWebview.currentPanel.initialSpecPath = targetSpecPath;
      SmokeTesterWebview.currentPanel.panel.reveal(column);
      SmokeTesterWebview.currentPanel.refresh();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "smileSmokeTester",
      "Smile — Visual Smoke Tester",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    SmokeTesterWebview.currentPanel = new SmokeTesterWebview(panel, extensionUri, targetSpecPath);
  }

  private constructor(panel: vscode.WebviewPanel, _extensionUri: vscode.Uri, initialSpecPath: string) {
    this.panel = panel;
    this.initialSpecPath = initialSpecPath;

    this.render();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      async (message: ISmokeTesterMessage) => {
        await this.handleMessage(message);
      },
      null,
      this.disposables
    );
  }

  public refresh(): void {
    this.render();
  }

  public dispose(): void {
    SmokeTesterWebview.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) {
        d.dispose();
      }
    }
  }

  private async handleMessage(message: ISmokeTesterMessage): Promise<void> {
    if (message.command === "pickFile") {
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        openLabel: "Select API Spec",
        filters: {
          "API Contracts": ["yaml", "yml", "json", "graphql", "gql"],
        },
      });

      if (uris && uris[0]) {
        this.initialSpecPath = uris[0].fsPath;
        this.panel.webview.postMessage({
          command: "setSpecPath",
          specPath: uris[0].fsPath,
        });
      }
      return;
    }

    if (message.command === "runTest") {
      const specPath = message.specPath?.trim();
      const baseUrl = message.baseUrl?.trim();

      if (!specPath) {
        vscode.window.showErrorMessage("Smile: Please specify a specification file to test.");
        return;
      }
      if (!baseUrl) {
        vscode.window.showErrorMessage("Smile: Please provide a valid server Base URL (e.g. http://localhost:3000).");
        return;
      }

      // Parse headers
      let headersRecord: Record<string, string> = {};
      if (message.headers) {
        try {
          const lines = message.headers.split("\n");
          for (const line of lines) {
            const colonIdx = line.indexOf(":");
            if (colonIdx > 0) {
              const k = line.substring(0, colonIdx).trim();
              const v = line.substring(colonIdx + 1).trim();
              if (k) headersRecord[k] = v;
            }
          }
        } catch {
          // ignore header parse error
        }
      }

      try {
        const timeout = message.timeoutMs || 5000;
        const result: ITestResult = await runSmokeTest(specPath, baseUrl, headersRecord, {
          requestTimeoutMs: timeout,
        });

        this.panel.webview.postMessage({
          command: "testCompleted",
          result,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Smile Smoke Test Failed: ${msg}`);
        this.panel.webview.postMessage({
          command: "testError",
          error: msg,
        });
      }
    }
  }

  private render(): void {
    const customStyles = `
      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 1.5rem;
      }
      .form-full {
        grid-column: 1 / -1;
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .method-badge {
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 11px;
        text-align: center;
        display: inline-block;
        width: 60px;
      }
      .method-get { background: #2e7d32; color: #ffffff; }
      .method-post { background: #1565c0; color: #ffffff; }
      .method-put { background: #e65100; color: #ffffff; }
      .method-delete { background: #c62828; color: #ffffff; }
      .method-patch { background: #6a1b9a; color: #ffffff; }
      .summary-banner {
        padding: 1rem;
        border-radius: 6px;
        margin-bottom: 1.5rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .summary-banner.passed {
        background: rgba(115, 201, 145, 0.15);
        border: 1px solid #73c991;
      }
      .summary-banner.failed {
        background: rgba(241, 76, 76, 0.15);
        border: 1px solid #f14c4c;
      }
      .spinner {
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255,255,255,.3);
        border-radius: 50%;
        border-top-color: #fff;
        animation: spin 1s ease-in-out infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;

    const bodyContent = `
      <h1>⚡ Smile — Live API Smoke Tester</h1>
      <p>Test real server responses against your documented schema (Breaching Detector) without opening external tools.</p>

      <div class="card">
        <div class="form-grid">
          <div class="form-group form-full">
            <label><strong>Specification File:</strong></label>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="specPath" class="input-text" value="${this.initialSpecPath}" placeholder="Path to OpenAPI, Postman, or GraphQL contract..." />
              <button class="btn btn-secondary" onclick="pickFile()">Browse...</button>
            </div>
          </div>

          <div class="form-group">
            <label><strong>Server Base URL:</strong></label>
            <input type="text" id="baseUrl" class="input-text" placeholder="http://localhost:3000 or https://api.staging.com" />
          </div>

          <div class="form-group">
            <label><strong>Request Timeout (ms):</strong></label>
            <input type="number" id="timeoutMs" class="input-text" value="5000" />
          </div>

          <div class="form-group form-full">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <label><strong>Recent Test Runs / History:</strong></label>
              <button class="btn btn-secondary" style="font-size: 11px; padding: 2px 8px;" onclick="clearHistory()">Clear History</button>
            </div>
            <select id="historySelect" class="input-text" onchange="loadFromHistory(this.value)">
              <option value="">-- Select a previous test run to restore --</option>
            </select>
          </div>

          <div class="form-group form-full">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <label><strong>Custom Headers (Key: Value per line):</strong></label>
              <select id="presetSelect" class="input-text" style="width: auto; padding: 2px 8px; font-size: 11px;" onchange="applyHeaderPreset(this.value)">
                <option value="">-- Quick Header Presets --</option>
                <option value="bearer">Bearer Token (Authorization: Bearer ...)</option>
                <option value="apikey">API Key (X-API-Key: ...)</option>
                <option value="basic">Basic Auth (Authorization: Basic ...)</option>
                <option value="json">Content-Type / Accept (application/json)</option>
                <option value="clear">Clear Headers</option>
              </select>
            </div>
            <textarea id="headers" class="input-text" rows="3" placeholder="Authorization: Bearer my-token&#10;X-API-Key: 12345"></textarea>
          </div>
        </div>

        <button id="runBtn" class="btn" style="width: 100%; justify-content: center; padding: 10px;" onclick="runTest()">
          <span id="btnText">▶️ Run Contract Smoke Test</span>
        </button>
      </div>

      <div id="resultsContainer" style="display: none;">
        <div id="summaryBanner" class="summary-banner"></div>

        <h3>Endpoint Verification Results</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 80px;">Method</th>
              <th>Endpoint Path</th>
              <th style="width: 120px;">Contract Status</th>
              <th>Violations / Notes</th>
            </tr>
          </thead>
          <tbody id="endpointsBody"></tbody>
        </table>
      </div>
    `;

    const scriptContent = `
      const PRESETS = {
        bearer: 'Authorization: Bearer YOUR_TOKEN_HERE',
        apikey: 'X-API-Key: YOUR_API_KEY_HERE',
        basic: 'Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=',
        json: 'Content-Type: application/json\\nAccept: application/json',
      };

      let history = [];

      // Initialize state from vscode.getState()
      try {
        const state = vscode.getState();
        if (state && Array.isArray(state.history)) {
          history = state.history;
          renderHistoryDropdown();
        }
      } catch (e) {}

      function applyHeaderPreset(presetKey) {
        if (!presetKey) return;
        const textarea = document.getElementById('headers');
        if (presetKey === 'clear') {
          textarea.value = '';
        } else if (PRESETS[presetKey]) {
          const current = textarea.value.trim();
          textarea.value = current ? current + '\\n' + PRESETS[presetKey] : PRESETS[presetKey];
        }
        document.getElementById('presetSelect').value = '';
      }

      function renderHistoryDropdown() {
        const select = document.getElementById('historySelect');
        select.innerHTML = '<option value="">-- Select a previous test run to restore (' + history.length + ' saved) --</option>';
        history.forEach((item, index) => {
          const status = item.passed ? '🟢 PASS' : '🔴 FAIL';
          const opt = document.createElement('option');
          opt.value = String(index);
          opt.textContent = status + ' [' + item.timestamp + '] ' + item.baseUrl + ' (' + (item.specName || 'spec') + ')';
          select.appendChild(opt);
        });
      }

      function loadFromHistory(indexStr) {
        if (indexStr === '') return;
        const item = history[parseInt(indexStr, 10)];
        if (!item) return;

        if (item.specPath) document.getElementById('specPath').value = item.specPath;
        if (item.baseUrl) document.getElementById('baseUrl').value = item.baseUrl;
        if (item.headers !== undefined) document.getElementById('headers').value = item.headers;
        if (item.timeoutMs) document.getElementById('timeoutMs').value = item.timeoutMs;
      }

      function clearHistory() {
        history = [];
        try {
          vscode.setState({ history: [] });
        } catch (e) {}
        renderHistoryDropdown();
      }

      function pickFile() {
        vscode.postMessage({ command: 'pickFile' });
      }

      function runTest() {
        const specPath = document.getElementById('specPath').value;
        const baseUrl = document.getElementById('baseUrl').value;
        const headers = document.getElementById('headers').value;
        const timeoutMs = parseInt(document.getElementById('timeoutMs').value, 10);

        const btn = document.getElementById('runBtn');
        btn.disabled = true;
        document.getElementById('btnText').innerHTML = '<span class="spinner"></span> Testing live endpoints...';

        vscode.postMessage({
          command: 'runTest',
          specPath,
          baseUrl,
          headers,
          timeoutMs
        });
      }

      window.addEventListener('message', event => {
        const message = event.data;

        if (message.command === 'setSpecPath') {
          document.getElementById('specPath').value = message.specPath;
        }

        if (message.command === 'testError') {
          const btn = document.getElementById('runBtn');
          btn.disabled = false;
          document.getElementById('btnText').innerHTML = '▶️ Run Contract Smoke Test';
        }

        if (message.command === 'testCompleted') {
          const btn = document.getElementById('runBtn');
          btn.disabled = false;
          document.getElementById('btnText').innerHTML = '▶️ Run Contract Smoke Test';

          const specPath = document.getElementById('specPath').value;
          const baseUrl = document.getElementById('baseUrl').value;
          const headers = document.getElementById('headers').value;
          const timeoutMs = parseInt(document.getElementById('timeoutMs').value, 10) || 5000;
          const specName = specPath.split(/[\\/\\\\]/).pop();

          // Save to history (keep top 10)
          const historyEntry = {
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            specPath,
            specName,
            baseUrl,
            headers,
            timeoutMs,
            passed: message.result.passed
          };

          history.unshift(historyEntry);
          if (history.length > 10) history.pop();

          try {
            vscode.setState({ history });
          } catch (e) {}
          renderHistoryDropdown();

          renderResults(message.result);
        }
      });

      function renderResults(result) {
        const container = document.getElementById('resultsContainer');
        container.style.display = 'block';

        const banner = document.getElementById('summaryBanner');
        const passedCount = result.endpoints.filter(e => !e.skipped && e.violations.length === 0).length;
        const failedCount = result.endpoints.filter(e => !e.skipped && e.violations.length > 0).length;
        const skippedCount = result.endpoints.filter(e => e.skipped).length;

        banner.className = 'summary-banner ' + (result.passed ? 'passed' : 'failed');
        banner.innerHTML = \`
          <div>
            <h3 style="margin-bottom: 2px;">\${result.passed ? '🟢 Contract Honored' : '🔴 Contract Breached'}</h3>
            <span>\${passedCount} passed, \${failedCount} failed, \${skippedCount} skipped (\${result.endpoints.length} total) on \${result.baseUrl}</span>
          </div>
          <div>
            <span class="badge \${result.passed ? 'badge-clean' : 'badge-error'}">\${result.passed ? 'PASSED' : 'FAILED'}</span>
          </div>
        \`;

        const tbody = document.getElementById('endpointsBody');
        tbody.innerHTML = result.endpoints.map(e => {
          const m = e.method.toLowerCase();
          const hasBreach = e.violations && e.violations.length > 0;
          const statusBadge = e.skipped
            ? '<span class="badge badge-warn">SKIPPED</span>'
            : hasBreach
            ? '<span class="badge badge-error">BREACHED</span>'
            : '<span class="badge badge-clean">HONORED</span>';

          const violationsText = e.skipped
            ? (e.skipReason || 'Skipped')
            : hasBreach
            ? e.violations.map(v => '• [' + v.ruleId + '] ' + v.message).join('<br/>')
            : 'Schema response matched documented contract';

          return \`
            <tr>
              <td><span class="method-badge method-\${m}">\${e.method.toUpperCase()}</span></td>
              <td><code>\${e.path}</code></td>
              <td>\${statusBadge}</td>
              <td style="font-size: 12px; color: \${hasBreach ? '#f14c4c' : 'inherit'}">\${violationsText}</td>
            </tr>
          \`;
        }).join('');
      }
    `;

    this.panel.webview.html = getWebviewHtml({
      title: "Smile — Visual Smoke Tester",
      bodyContent,
      scriptContent,
      customStyles,
      webview: this.panel.webview,
    });
  }
}

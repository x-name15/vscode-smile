/**
 * @fileoverview Project Setup Wizard Webview.
 * Provides an interactive 3-step visual setup wizard (visual 'smile init')
 * to scaffold config.smile.json, CI/CD workflows, and starter API contracts.
 */

import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import { getWebviewHtml } from "./webviewUtils.js";
import { SMILE_RULES_METADATA } from "../models/rulesMetadata.js";
import type { ISmileConfig, RuleSeverity } from "@mrjacket/smile";

/**
 * Message payload sent from Init Wizard Webview.
 */
interface IInitWizardMessage {
  command: "generateProject";
  selectedFormats: string[];
  preset: "strict" | "recommended" | "relaxed";
  includeGithubAction: boolean;
  includeSampleSpec: boolean;
  includeSmileIgnore: boolean;
}

/**
 * Sample specification templates for project bootstrapping.
 */
const SAMPLE_TEMPLATES: Record<string, { filename: string; content: string }> = {
  openapi: {
    filename: "api.yaml",
    content: `openapi: 3.0.3
info:
  title: Sample API Service
  version: 1.0.0
  description: A production-ready API specification managed with Smile.
paths:
  /users:
    get:
      summary: Retrieve all active users
      operationId: getUsers
      responses:
        '200':
          description: List of active users
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    id:
                      type: string
                    name:
                      type: string
`,
  },
  asyncapi: {
    filename: "asyncapi.yaml",
    content: `asyncapi: 3.0.0
info:
  title: User Notifications Event Stream
  version: 1.0.0
  description: Event-driven pub/sub architecture.
channels:
  userRegistered:
    address: 'users.signup'
    messages:
      userSignupEvent:
        payload:
          type: object
          properties:
            userId:
              type: string
            timestamp:
              type: string
`,
  },
  graphql: {
    filename: "schema.graphql",
    content: `"""Root query type"""
type Query {
  "Fetches all users"
  users: [User!]!
}

"A registered user in the system"
type User {
  "Unique identifier"
  id: ID!
  "Full name"
  name: String!
}
`,
  },
  "json-schema": {
    filename: "user.schema.json",
    content: `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "User Schema",
  "description": "Validated user entity",
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    },
    "name": {
      "type": "string"
    }
  },
  "additionalProperties": false
}
`,
  },
  grpc: {
    filename: "service.proto",
    content: `syntax = "proto3";

package api.v1;

// Greeter service handling user communications.
service GreeterService {
  // Sends a greeting to the requester.
  rpc SayHello (HelloRequest) returns (HelloReply);
}

// Request payload containing the username.
message HelloRequest {
  string name = 1;
}

// Response payload with greeting confirmation.
message HelloReply {
  string message = 1;
}
`,
  },
  postman: {
    filename: "collection.json",
    content: `{
  "info": {
    "name": "Service API Collection",
    "description": "Postman contract test suite",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get Users",
      "request": {
        "method": "GET",
        "description": "Fetches list of active system users.",
        "url": "{{baseUrl}}/users"
      },
      "response": [
        {
          "name": "200 Success",
          "code": 200,
          "body": "[{\\"id\\": \\"1\\", \\"name\\": \\"Ada Lovelace\\"}]"
        }
      ]
    }
  ]
}
`,
  },
};

const GITHUB_WORKFLOW_TEMPLATE = `name: "Smile API Contract Gatekeeper"

on:
  push:
    branches: [ "main", "develop" ]
  pull_request:
    branches: [ "main", "develop" ]

jobs:
  validate-contract:
    name: Lint & Validate Specifications
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Run Smile Contract Linter
        uses: x-name15/smile-action@v1
        with:
          path: "./"
          fail_on: "error"
`;

/**
 * Manages the Project Setup Wizard Webview panel.
 */
export class InitWizardWebview {
  public static currentPanel: InitWizardWebview | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (InitWizardWebview.currentPanel) {
      InitWizardWebview.currentPanel.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "smileInitWizard",
      "Smile — Project Setup Wizard",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    InitWizardWebview.currentPanel = new InitWizardWebview(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, _extensionUri: vscode.Uri) {
    this.panel = panel;

    this.render();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      async (message: IInitWizardMessage) => {
        if (message.command === "generateProject") {
          await this.handleGenerateProject(message);
        }
      },
      null,
      this.disposables
    );
  }

  public dispose(): void {
    InitWizardWebview.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) {
        d.dispose();
      }
    }
  }

  private async handleGenerateProject(message: IInitWizardMessage): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage("Smile: Please open a folder or workspace in VS Code before bootstrapping.");
      return;
    }

    const workspaceRoot = workspaceFolders[0]!.uri.fsPath;

    try {
      // 1. Build config.smile.json
      const rules: Record<string, RuleSeverity> = {};
      const formatRules = SMILE_RULES_METADATA.filter(r =>
        message.selectedFormats.includes(r.format)
      );

      for (const r of formatRules) {
        if (message.preset === "strict") {
          rules[r.id] = "error";
        } else if (message.preset === "recommended") {
          rules[r.id] = r.defaultSeverity;
        } else {
          rules[r.id] = r.defaultSeverity === "error" ? "warn" : "off";
        }
      }

      const config: ISmileConfig = {
        rules,
        maxWarnings: 10,
      };

      const configPath = path.join(workspaceRoot, "config.smile.json");
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

      // 2. Optional GitHub Action workflow
      if (message.includeGithubAction) {
        const workflowsDir = path.join(workspaceRoot, ".github", "workflows");
        fs.mkdirSync(workflowsDir, { recursive: true });
        const workflowFile = path.join(workflowsDir, "smile.yml");
        fs.writeFileSync(workflowFile, GITHUB_WORKFLOW_TEMPLATE, "utf-8");
      }

      // 3. Optional .smileignore
      if (message.includeSmileIgnore) {
        const ignorePath = path.join(workspaceRoot, ".smileignore");
        fs.writeFileSync(ignorePath, "node_modules/\ndist/\ncoverage/\n.git/\n", "utf-8");
      }

      // 4. Optional starter spec files
      let firstSpecUri: vscode.Uri | undefined;
      if (message.includeSampleSpec && message.selectedFormats.length > 0) {
        for (const fmt of message.selectedFormats) {
          const sample = SAMPLE_TEMPLATES[fmt];
          if (sample) {
            const specPath = path.join(workspaceRoot, sample.filename);
            if (!fs.existsSync(specPath)) {
              fs.writeFileSync(specPath, sample.content, "utf-8");
              if (!firstSpecUri) {
                firstSpecUri = vscode.Uri.file(specPath);
              }
            }
          }
        }
      }

      vscode.window.showInformationMessage("🎉 Smile: Project successfully initialized!");

      // Open starter file if created
      if (firstSpecUri) {
        const doc = await vscode.workspace.openTextDocument(firstSpecUri);
        await vscode.window.showTextDocument(doc);
      }

      this.panel.dispose();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Smile Init failed: ${msg}`);
    }
  }

  private render(): void {
    const customStyles = `
      .wizard-card {
        background: var(--card-bg);
        border: 1px solid var(--card-border);
        border-radius: 8px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
      }
      .format-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
        margin-top: 1rem;
      }
      .format-card {
        border: 1px solid var(--card-border);
        border-radius: 6px;
        padding: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        background: var(--bg);
        transition: border-color 0.15s ease;
      }
      .format-card.selected {
        border-color: var(--btn-bg);
        background: rgba(0, 122, 204, 0.1);
      }
      .preset-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-top: 1rem;
      }
      .preset-card {
        border: 1px solid var(--card-border);
        border-radius: 6px;
        padding: 14px;
        cursor: pointer;
        background: var(--bg);
        text-align: center;
      }
      .preset-card.selected {
        border-color: var(--btn-bg);
        background: rgba(0, 122, 204, 0.1);
      }
      .checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        cursor: pointer;
      }
    `;

    const bodyContent = `
      <h1>🪄 Smile — Project Setup Wizard</h1>
      <p>Configure API contract governance, CI workflows, and starter specifications visually in seconds.</p>

      <div class="wizard-card">
        <h3>Step 1: Select API Formats Used in this Project</h3>
        <p>Choose all contract types you plan to validate:</p>
        <div class="format-grid">
          <div class="format-card selected" data-format="openapi" onclick="toggleFormat(this)">
            <input type="checkbox" checked />
            <div>
              <strong>OpenAPI 3.x</strong>
              <div style="font-size: 11px; color: var(--vscode-descriptionForeground);">RESTful APIs</div>
            </div>
          </div>
          <div class="format-card" data-format="asyncapi" onclick="toggleFormat(this)">
            <input type="checkbox" />
            <div>
              <strong>AsyncAPI</strong>
              <div style="font-size: 11px; color: var(--vscode-descriptionForeground);">Event-driven streams</div>
            </div>
          </div>
          <div class="format-card" data-format="graphql" onclick="toggleFormat(this)">
            <input type="checkbox" />
            <div>
              <strong>GraphQL</strong>
              <div style="font-size: 11px; color: var(--vscode-descriptionForeground);">Schemas (.graphql)</div>
            </div>
          </div>
          <div class="format-card" data-format="json-schema" onclick="toggleFormat(this)">
            <input type="checkbox" />
            <div>
              <strong>JSON Schema</strong>
              <div style="font-size: 11px; color: var(--vscode-descriptionForeground);">Data payloads</div>
            </div>
          </div>
          <div class="format-card" data-format="grpc" onclick="toggleFormat(this)">
            <input type="checkbox" />
            <div>
              <strong>gRPC / Protobuf</strong>
              <div style="font-size: 11px; color: var(--vscode-descriptionForeground);">Protocol Buffers (.proto)</div>
            </div>
          </div>
          <div class="format-card" data-format="postman" onclick="toggleFormat(this)">
            <input type="checkbox" />
            <div>
              <strong>Postman Collection</strong>
              <div style="font-size: 11px; color: var(--vscode-descriptionForeground);">v2.1 Collections</div>
            </div>
          </div>
        </div>
      </div>

      <div class="wizard-card">
        <h3>Step 2: Choose Rule Enforcement Level</h3>
        <p>Set how strict Smile should gate your API contracts:</p>
        <div class="preset-grid">
          <div class="preset-card selected" data-preset="strict" onclick="selectPreset('strict', this)">
            <h4>🛡️ Strict (Mentalist)</h4>
            <div style="font-size: 12px; margin-top: 6px; color: var(--vscode-descriptionForeground);">All rules enforced as hard errors. Maximum contract safety.</div>
          </div>
          <div class="preset-card" data-preset="recommended" onclick="selectPreset('recommended', this)">
            <h4>⭐ Recommended</h4>
            <div style="font-size: 12px; margin-top: 6px; color: var(--vscode-descriptionForeground);">Standard mix of errors on critical rules and warnings on docs.</div>
          </div>
          <div class="preset-card" data-preset="relaxed" onclick="selectPreset('relaxed', this)">
            <h4>🌴 Relaxed</h4>
            <div style="font-size: 12px; margin-top: 6px; color: var(--vscode-descriptionForeground);">Soft adoption. Non-blocking warnings to onboard existing legacy APIs.</div>
          </div>
        </div>
      </div>

      <div class="wizard-card">
        <h3>Step 3: Extras & Automated CI/CD</h3>
        <label class="checkbox-label">
          <input type="checkbox" id="ciCheckbox" checked />
          <span><strong>Generate GitHub Actions CI Workflow</strong> (<code>.github/workflows/smile.yml</code>)</span>
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="sampleCheckbox" checked />
          <span><strong>Create Starter Specification File</strong> (e.g. <code>api.yaml</code>)</span>
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="ignoreCheckbox" checked />
          <span><strong>Generate <code>.smileignore</code></strong> to exclude <code>node_modules/</code> & build artifacts</span>
        </label>
      </div>

      <button class="btn" style="width: 100%; justify-content: center; padding: 12px; font-size: 14px;" onclick="submitProject()">
        🚀 Initialize Smile Project
      </button>
    `;

    const scriptContent = `
      let selectedPreset = 'strict';

      function toggleFormat(card) {
        const checkbox = card.querySelector('input[type="checkbox"]');
        checkbox.checked = !checkbox.checked;
        card.classList.toggle('selected', checkbox.checked);
      }

      function selectPreset(preset, card) {
        selectedPreset = preset;
        document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      }

      function submitProject() {
        const selectedFormats = [];
        document.querySelectorAll('.format-card').forEach(card => {
          if (card.querySelector('input[type="checkbox"]').checked) {
            selectedFormats.push(card.getAttribute('data-format'));
          }
        });

        if (selectedFormats.length === 0) {
          alert('Please select at least one API format.');
          return;
        }

        vscode.postMessage({
          command: 'generateProject',
          selectedFormats,
          preset: selectedPreset,
          includeGithubAction: document.getElementById('ciCheckbox').checked,
          includeSampleSpec: document.getElementById('sampleCheckbox').checked,
          includeSmileIgnore: document.getElementById('ignoreCheckbox').checked
        });
      }
    `;

    this.panel.webview.html = getWebviewHtml({
      title: "Smile — Project Setup Wizard",
      bodyContent,
      scriptContent,
      customStyles,
      webview: this.panel.webview,
    });
  }
}

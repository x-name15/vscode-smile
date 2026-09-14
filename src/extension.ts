/**
 * @fileoverview Main VS Code Extension entry point for Smile.
 * Activates diagnostics, quick-fixes, status bar indicators, and event listeners.
 */

import * as vscode from "vscode";
import { DiagnosticsEngine } from "./diagnostics/diagnosticsEngine.js";
import { SmileQuickFixProvider } from "./quickfix/quickFixProvider.js";
import { StatusBarManager } from "./statusBar/statusBarManager.js";
import { SmileSidebarProvider } from "./sidebar/smileSidebarProvider.js";
import { SmileCommandsProvider } from "./sidebar/smileCommandsProvider.js";
import { registerCommands } from "./commands/index.js";
import { invalidateConfigCache } from "./config/configResolver.js";
import type { ISmileExtensionConfig } from "./models/index.js";

/** Central diagnostics engine instance. */
let diagnosticsEngine: DiagnosticsEngine | undefined;

/** Status bar manager instance. */
let statusBarManager: StatusBarManager | undefined;

/** Sidebar tree data provider instance. */
let sidebarProvider: SmileSidebarProvider | undefined;

/** Debounce timer handle for onType linting. */
let debounceTimeout: ReturnType<typeof setTimeout> | undefined;

/**
 * Reads current VS Code user and workspace configuration settings for Smile.
 *
 * @returns The active ISmileExtensionConfig values.
 */
function getExtensionConfig(): ISmileExtensionConfig {
  const cfg = vscode.workspace.getConfiguration("smile");
  return {
    enable: cfg.get<boolean>("enable", true),
    runOn: cfg.get<"onSave" | "onType">("runOn", "onSave"),
    maxWarnings: cfg.get<number>("maxWarnings", -1),
  };
}

/**
 * Activates the Smile VS Code extension.
 * Registers diagnostics collection, sidebar view, commands, status bar, quick fixes, and event listeners.
 *
 * @param context - The VS Code extension context.
 */
export function activate(context: vscode.ExtensionContext): void {
  diagnosticsEngine = new DiagnosticsEngine();
  statusBarManager = new StatusBarManager();
  sidebarProvider = new SmileSidebarProvider(diagnosticsEngine);
  const commandsProvider = new SmileCommandsProvider();

  // Register Activity Bar Sidebar Views
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("smile-overview", sidebarProvider),
    vscode.window.registerTreeDataProvider("smile-commands", commandsProvider)
  );

  // Register commands
  registerCommands(context, diagnosticsEngine, statusBarManager);

  // Register Quick Fix provider for supported document selectors
  const documentSelectors: vscode.DocumentSelector = [
    { language: "yaml" },
    { language: "json" },
    { language: "graphql" },
    { language: "proto3" },
  ];

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      documentSelectors,
      new SmileQuickFixProvider(),
      {
        providedCodeActionKinds: SmileQuickFixProvider.providedCodeActionKinds,
      }
    )
  );

  // Watch for changes in smile configuration files (e.g. config.smile.json)
  const configWatcher = vscode.workspace.createFileSystemWatcher(
    "**/{config.smile.json,smile.config.json,.smilerc.json,smile.json}"
  );
  context.subscriptions.push(configWatcher);

  const handleConfigChange = (uri: vscode.Uri) => {
    invalidateConfigCache(uri.fsPath);
    if (vscode.window.activeTextEditor) {
      lintAndUpdate(vscode.window.activeTextEditor.document);
    }
  };

  configWatcher.onDidChange(handleConfigChange);
  configWatcher.onDidCreate(handleConfigChange);
  configWatcher.onDidDelete(handleConfigChange);

  // Watch for changes in VS Code settings under "smile"
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration("smile")) {
        invalidateConfigCache();
        if (vscode.window.activeTextEditor) {
          lintAndUpdate(vscode.window.activeTextEditor.document);
        }
      }
    })
  );

  // Lint active editor on activation
  if (vscode.window.activeTextEditor) {
    lintAndUpdate(vscode.window.activeTextEditor.document);
  }

  // Event: Active editor changed
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        lintAndUpdate(editor.document);
      } else {
        statusBarManager?.update(undefined);
        sidebarProvider?.refresh();
      }
    })
  );

  // Event: Document saved
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(document => {
      const config = getExtensionConfig();
      if (config.enable) {
        lintAndUpdate(document);
      }
    })
  );

  // Event: Document changed (debounced for onType)
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      const config = getExtensionConfig();
      if (!config.enable || config.runOn !== "onType") {
        return;
      }

      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }

      debounceTimeout = setTimeout(() => {
        lintAndUpdate(event.document);
      }, 500);
    })
  );

  // Event: Document closed
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(document => {
      diagnosticsEngine?.clearDocument(document.uri);
    })
  );

  // Add cleanup subscriptions
  context.subscriptions.push({
    dispose: () => {
      diagnosticsEngine?.dispose();
      statusBarManager?.dispose();
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    },
  });
}

/**
 * Runs contract validation on a document, updates the status bar, and refreshes the sidebar tree.
 *
 * @param document - The VS Code text document to lint.
 */
async function lintAndUpdate(document: vscode.TextDocument): Promise<void> {
  const config = getExtensionConfig();
  if (!config.enable || !diagnosticsEngine || !statusBarManager) {
    return;
  }

  const status = await diagnosticsEngine.lintDocument(document);
  statusBarManager.update(status);
  sidebarProvider?.refresh();
}

/**
 * Deactivates the Smile VS Code extension and cleans up resources.
 */
export function deactivate(): void {
  diagnosticsEngine?.dispose();
  statusBarManager?.dispose();
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
  }
}

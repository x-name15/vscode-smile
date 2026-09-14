/**
 * @fileoverview Shared utilities and styling templates for VS Code Webviews.
 * Adheres to CSP security best practices and leverages native VS Code theme variables.
 */

import type * as vscode from "vscode";

/**
 * Configuration options for rendering a webview HTML shell.
 */
export interface IWebviewRenderOptions {
  /** Title for the HTML document. */
  title: string;
  /** Main HTML body content to render inside container. */
  bodyContent: string;
  /** Webview instance to generate CSP source and URIs. */
  webview: vscode.Webview;
  /** Optional inline JavaScript script block. */
  scriptContent?: string;
  /** Optional custom CSS stylesheet. */
  customStyles?: string;
}

/**
 * Generates an accessible, CSP-compliant HTML shell styled with native VS Code design tokens.
 *
 * @param options - Webview rendering options.
 * @returns Fully formed HTML string for the webview.
 */
export function getWebviewHtml(options: IWebviewRenderOptions): string {
  const { title, bodyContent, webview, scriptContent = "", customStyles = "" } = options;
  const cspSource = webview.cspSource;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    :root {
      --font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
      --bg: var(--vscode-editor-background, #1e1e1e);
      --fg: var(--vscode-editor-foreground, #d4d4d4);
      --card-bg: var(--vscode-sideBar-background, #252526);
      --card-border: var(--vscode-widget-border, #3c3c3c);
      --btn-bg: var(--vscode-button-background, #007acc);
      --btn-fg: var(--vscode-button-foreground, #ffffff);
      --btn-hover: var(--vscode-button-hoverBackground, #0062a3);
      --btn-secondary-bg: var(--vscode-button-secondaryBackground, #3a3d41);
      --btn-secondary-fg: var(--vscode-button-secondaryForeground, #ffffff);
      --input-bg: var(--vscode-input-background, #3c3c3c);
      --input-fg: var(--vscode-input-foreground, #cccccc);
      --input-border: var(--vscode-input-border, #555555);
      --badge-err-bg: rgba(241, 76, 76, 0.2);
      --badge-err-fg: #f14c4c;
      --badge-warn-bg: rgba(204, 167, 0, 0.2);
      --badge-warn-fg: #cca700;
      --badge-clean-bg: rgba(115, 201, 145, 0.2);
      --badge-clean-fg: #73c991;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg);
      color: var(--fg);
      font-family: var(--font-family);
      font-size: var(--vscode-font-size, 13px);
      line-height: 1.5;
      padding: 1.5rem;
    }

    h1, h2, h3, h4 {
      color: var(--fg);
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    h1 {
      font-size: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    p {
      margin-bottom: 1rem;
      color: var(--vscode-descriptionForeground, #999999);
    }

    .btn {
      background-color: var(--btn-bg);
      color: var(--btn-fg);
      border: 1px solid transparent;
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 500;
      border-radius: 3px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background-color 0.15s ease;
      text-decoration: none;
    }

    .btn:hover {
      background-color: var(--btn-hover);
    }

    .btn-secondary {
      background-color: var(--btn-secondary-bg);
      color: var(--btn-secondary-fg);
    }

    .btn-secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground, #45494e);
    }

    .input-text, select {
      background-color: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--input-border);
      padding: 6px 10px;
      border-radius: 3px;
      font-size: 13px;
      font-family: inherit;
      width: 100%;
    }

    .input-text:focus, select:focus {
      outline: 1px solid var(--vscode-focusBorder, #007acc);
    }

    .card {
      background-color: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 6px;
      padding: 1rem;
      margin-bottom: 1rem;
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .badge-error {
      background-color: var(--badge-err-bg);
      color: var(--badge-err-fg);
      border: 1px solid var(--badge-err-fg);
    }

    .badge-warn {
      background-color: var(--badge-warn-bg);
      color: var(--badge-warn-fg);
      border: 1px solid var(--badge-warn-fg);
    }

    .badge-clean {
      background-color: var(--badge-clean-bg);
      color: var(--badge-clean-fg);
      border: 1px solid var(--badge-clean-fg);
    }

    /* Tabs */
    .tab-container {
      display: flex;
      gap: 4px;
      border-bottom: 1px solid var(--card-border);
      margin-bottom: 1rem;
    }

    .tab-btn {
      background: none;
      border: none;
      color: var(--vscode-foreground, #cccccc);
      padding: 8px 16px;
      cursor: pointer;
      font-weight: 500;
      border-bottom: 2px solid transparent;
      opacity: 0.7;
    }

    .tab-btn.active {
      opacity: 1;
      border-bottom-color: var(--vscode-focusBorder, #007acc);
      color: var(--vscode-editor-foreground, #ffffff);
    }

    .tab-btn:hover {
      opacity: 1;
    }

    /* Table */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 0.75rem;
    }

    th, td {
      text-align: left;
      padding: 8px 12px;
      border-bottom: 1px solid var(--card-border);
    }

    th {
      font-weight: 600;
      background-color: var(--card-bg);
    }

    tr:hover {
      background-color: rgba(255, 255, 255, 0.03);
    }

    ${customStyles}
  </style>
</head>
<body>
  ${bodyContent}
  <script>
    const vscode = acquireVsCodeApi();
    ${scriptContent}
  </script>
</body>
</html>`;
}

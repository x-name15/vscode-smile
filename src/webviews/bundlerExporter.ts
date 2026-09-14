/**
 * @fileoverview Visual Spec Bundler & Report Exporter.
 * Allows bundling multi-file specifications with $ref into a consolidated document,
 * and exporting contract audit reports into OASIS SARIF v2.1.0, Markdown, or HTML.
 */

import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import {
  bundleSpec,
  renderSarifReport,
  renderMarkdownReport,
  renderJunitReport,
  renderSmileReport,
  lintSpec,
  ESeverity,
  type ILintResult,
} from "@mrjacket/smile";
import { resolveSmileConfig } from "../config/configResolver.js";

/**
 * Bundles the currently active or selected specification into a single file,
 * resolving all external $ref references into canonical internal pointers.
 *
 * @param targetUri - Optional URI of the file to bundle.
 */
export async function runBundleSpecification(targetUri?: vscode.Uri): Promise<void> {
  const uri = targetUri || vscode.window.activeTextEditor?.document.uri;
  if (!uri || uri.scheme !== "file") {
    vscode.window.showInformationMessage("Smile: Please open an API specification to bundle.");
    return;
  }

  try {
    const filePath = uri.fsPath;
    const bundleResult = await bundleSpec(filePath);

    if (bundleResult.skipped) {
      vscode.window.showWarningMessage(`Smile Bundler: ${bundleResult.message || "Bundling not applicable for this format."}`);
      return;
    }

    const formattedJson = JSON.stringify(bundleResult.bundledData, null, 2);

    // Prompt user: Open in editor or save to disk
    const choice = await vscode.window.showInformationMessage(
      `☺ Smile: Successfully bundled ${path.basename(filePath)}!`,
      "Open in New Editor",
      "Save As..."
    );

    if (choice === "Open in New Editor") {
      const doc = await vscode.workspace.openTextDocument({
        content: formattedJson,
        language: "json",
      });
      await vscode.window.showTextDocument(doc);
    } else if (choice === "Save As...") {
      const parsedPath = path.parse(filePath);
      const defaultSavePath = path.join(parsedPath.dir, `${parsedPath.name}.bundled.json`);

      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(defaultSavePath),
        filters: { "JSON Spec": ["json"] },
      });

      if (saveUri) {
        fs.writeFileSync(saveUri.fsPath, formattedJson, "utf-8");
        vscode.window.showInformationMessage(`☺ Smile: Saved bundled spec to ${path.basename(saveUri.fsPath)}!`);
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Smile Bundler failed: ${msg}`);
  }
}

/**
 * Exports contract lint diagnostics of the current file using the official Smile reporters.
 *
 * @param targetUri - Optional URI of the file to export.
 */
export async function runExportContractReport(targetUri?: vscode.Uri): Promise<void> {
  const uri = targetUri || vscode.window.activeTextEditor?.document.uri;
  if (!uri || uri.scheme !== "file") {
    vscode.window.showInformationMessage("Smile: Please open an API specification to export report.");
    return;
  }

  const formatChoice = await vscode.window.showQuickPick(
    [
      { label: "SARIF v2.1.0 (Official)", description: "OASIS standard for GitHub Code Scanning & CI/CD security tools" },
      { label: "Markdown Report (Official)", description: "Standard Smile Markdown table for GitHub PR comments" },
      { label: "JUnit XML (Official)", description: "Standard JUnit test results XML for CI test summary tabs" },
      { label: "Terminal / Text Report (Official)", description: "Human-readable terminal text output as seen in the CLI" },
      { label: "HTML Interactive Report", description: "Standalone HTML audit page with badges and styling" },
    ],
    { placeHolder: "Select report export format" }
  );

  if (!formatChoice) return;

  try {
    const resolvedConfig = await resolveSmileConfig(uri);
    const lintResult: ILintResult = await lintSpec(uri.fsPath, resolvedConfig.config);

    let outputContent = "";
    let fileExtension = "json";
    let languageId = "json";

    if (formatChoice.label.startsWith("SARIF")) {
      outputContent = renderSarifReport(lintResult);
      fileExtension = "sarif";
      languageId = "json";
    } else if (formatChoice.label.startsWith("Markdown")) {
      outputContent = renderMarkdownReport(lintResult, { skipAnnotations: true });
      fileExtension = "md";
      languageId = "markdown";
    } else if (formatChoice.label.startsWith("JUnit")) {
      outputContent = renderJunitReport(lintResult);
      fileExtension = "xml";
      languageId = "xml";
    } else if (formatChoice.label.startsWith("Terminal")) {
      outputContent = renderSmileReport(lintResult);
      fileExtension = "txt";
      languageId = "plaintext";
    } else {
      outputContent = generateHtmlReport(lintResult);
      fileExtension = "html";
      languageId = "html";
    }

    const action = await vscode.window.showInformationMessage(
      `☺ Smile: Generated ${formatChoice.label}!`,
      "View in Editor",
      "Save to File"
    );

    if (action === "View in Editor") {
      const doc = await vscode.workspace.openTextDocument({
        content: outputContent,
        language: languageId,
      });
      await vscode.window.showTextDocument(doc);
    } else if (action === "Save to File") {
      const parsedPath = path.parse(uri.fsPath);
      const defaultSavePath = path.join(parsedPath.dir, `${parsedPath.name}.report.${fileExtension}`);

      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(defaultSavePath),
      });

      if (saveUri) {
        fs.writeFileSync(saveUri.fsPath, outputContent, "utf-8");
        vscode.window.showInformationMessage(`☺ Smile: Saved report to ${path.basename(saveUri.fsPath)}!`);
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Smile Report Export failed: ${msg}`);
  }
}

/**
 * Generates a self-contained HTML audit report with embedded styling.
 */
function generateHtmlReport(result: ILintResult): string {
  const errors = result.violations.filter(v => v.severity === ESeverity.Error);
  const warnings = result.violations.filter(v => v.severity === ESeverity.Warning);
  const filename = path.basename(result.sourcePath);

  const rows = result.violations.map(v => {
    const isError = v.severity === ESeverity.Error;
    return `
      <tr>
        <td><span class="badge ${isError ? "badge-err" : "badge-warn"}">${isError ? "ERROR" : "WARN"}</span></td>
        <td><code>${v.ruleId}</code></td>
        <td><code>${v.path || "root"}</code></td>
        <td>${v.message}</td>
      </tr>
    `;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Smile Contract Audit — ${filename}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f141c; color: #e6edf3; padding: 2rem; }
    .container { max-width: 1000px; margin: 0 auto; background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 2rem; }
    h1 { color: #f85149; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 8px; }
    .banner { padding: 12px 16px; border-radius: 6px; margin: 1.5rem 0; font-weight: 600; }
    .banner-passed { background: rgba(46,160,67,0.15); border: 1px solid #2ea043; color: #3fb950; }
    .banner-failed { background: rgba(248,81,73,0.15); border: 1px solid #f85149; color: #f85149; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { text-align: left; padding: 10px 14px; border-bottom: 1px solid #30363d; }
    th { background: #21262d; }
    code { font-family: ui-monospace, SFMono-Regular, monospace; background: rgba(110,118,129,0.4); padding: 2px 6px; border-radius: 4px; font-size: 12px; }
    .badge { padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; }
    .badge-err { background: #da3633; color: #fff; }
    .badge-warn { background: #d29922; color: #000; }
  </style>
</head>
<body>
  <div class="container">
    <h1>☺ Smile — API Contract Audit Report</h1>
    <p>Target Specification: <code>${filename}</code> (${result.format.toUpperCase()})</p>

    <div class="banner ${result.passed ? "banner-passed" : "banner-failed"}">
      ${result.passed ? "🟢 CONTRACT HONORED — All validation rules passed cleanly." : `🔴 CONTRACT BREACHED — ${errors.length} error(s) and ${warnings.length} warning(s) identified.`}
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 80px;">Severity</th>
          <th style="width: 180px;">Rule ID</th>
          <th style="width: 200px;">Location Path</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        ${rows || "<tr><td colspan='4' style='text-align: center; padding: 20px; color: #3fb950;'>✨ Zero contract violations!</td></tr>"}
      </tbody>
    </table>
  </div>
</body>
</html>`;
}

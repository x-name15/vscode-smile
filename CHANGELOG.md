# Changelog

All notable changes to the "vscode-smile" extension will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-09-17 — QuickFix Lightbulb Actions, Smoke Tester History & Icon Fix

### Added
- **Context-Aware QuickFixes (`SmileQuickFixProvider`):** Surfaces rule-specific Quick Fix actions in the editor lightbulb menu (`💡 ☺ Smile: Autofix '<rule>'`) directly on lines with fixable violations (`missing-operation-id`, `missing-summary`), alongside a global action to resolve all safe issues in the file at once.
- **Visual Smoke Tester History & Presets:** Added automatic persistence for recent test executions (up to 10 runs with pass/fail badges and timestamp) to reload previous configurations with 1 click, plus Quick Header Presets for `Bearer Token`, `API Key`, `Basic Auth`, and `JSON Content-Type/Accept`.
- **Git Hook Management & Safe Uninstaller:** Added `smile.uninstallHook` command and interactive `Remove Git Hook` tool in the sidebar to safely remove `.git/hooks/pre-commit` contract gates with modal confirmation.

### Fixed
- **Sidebar Activity Bar Icon:** Restored the iconic smiley icon in the VS Code Activity Bar (`media/icon.png`).

---

## [1.1.0] - 2026-09-14 — Non-Spec Filtering & Dynamic Rules Metadata SSOT

### Fixed
- **False Positive Elimination on Non-Spec Documents:** Added early document guards in `DiagnosticsEngine` to ignore non-spec files (`.md`, `.ts`, `.js`, `.py`, etc.) and configuration files (`package.json`, `tsconfig.json`, `config.smile.json`). Prevents non-API documents from being evaluated by linters or generating `malformed-spec` diagnostics.

### Added
- **Single Source of Truth (SSOT) for Rules Metadata:** Refactored `rulesMetadata.ts` to directly re-export `SMILE_RULES_METADATA` and `IRuleMetadata` from `@mrjacket/smile`. Visual Rules Manager and Project Setup Wizard now automatically inherit newly introduced contract rules (such as `pascal-case-services`, `require-service-comments`, `require-package-name`, `require-collection-description`, and `valid-request-urls`) seamlessly whenever `@mrjacket/smile` is updated.

---

## [1.0.0] - 2026-09-14 — Initial Release of the Extension

### Added
- **Multi-Protocol Real-Time Diagnostics:** Inline contract diagnostics on save and typing for OpenAPI 3.x, AsyncAPI 2.x/3.x, GraphQL (`.graphql`), gRPC (`.proto`), JSON Schema, and Postman Collections.
- **Dual-View Activity Bar Sidebar:**
  - **Contract Status:** Real-time contract inspection (`Contract Honored` vs `Crime Scene`), rule-grouped violations, and direct line jumping.
  - **Commands & Tools (1:1 with Smile CLI):** Direct access to The Breaching Detector (`smile test`), Smile Deduce (`smile deduce`), Rules Manager (`smile config`), Bundler (`smile bundle`), Exporter (`smile lint -f`), Setup Wizard (`smile init`), and Git Hook (`smile install-hook`).
  - View title actions for one-click re-linting and AST autofixing.
- **Visual Rules Manager (Webview Dashboard):**
  - Graphical interface with tabs for all 6 formats to configure rule severities (`Error`, `Warn`, `Off`).
  - One-click presets: `Strict (Mentalist)`, `Recommended`, and `Relaxed`.
  - Live persistence to `config.smile.json` in workspace root.
- **Visual Smoke Tester (Live API Validator):**
  - Test live servers against documented contracts directly from VS Code.
  - Interactive results table with HTTP method badges, response status, schema verification, and latency.
- **Visual Multi-File Bundler & Report Exporter:**
  - One-click `$ref` bundler with preview and "Save As..." prompt.
  - Multi-format report exporter: **OASIS SARIF v2.1.0** (GitHub Code Scanning / CI), **Markdown**, and **Interactive HTML**.
- **Project Setup Wizard (Visual `smile init`):**
  - 3-step graphical wizard to scaffold project configuration, GitHub Actions CI workflow, `.smileignore`, and starter contracts.
- **Project Configuration Auto-Discovery & Live Reload:**
  - Automatic upward discovery for `config.smile.json`, `smile.config.json`, `.smilerc.json`, and `smile.json`.
  - Active File Watcher automatically invalidates cache and triggers live re-linting across all open documents when config files are modified.
- **Accurate Line/Column Location Resolution:** Smart key path resolver maps contract violation paths (`paths./users.get`, `channels.user/signedup`, etc.) to precise editor ranges.
- **One-Click Quick Fix Provider:** VS Code Lightbulb code action to apply deterministic AST autofixes (`missing-operation-id`, `missing-summary`) preserving comments and formatting.
- **Status Bar Integration:** Real-time indicator displaying specification format, pass/fail status, and violation counts.
- **Comprehensive TSDoc Documentation:** Full TSDoc documentation across all internal and exported modules.

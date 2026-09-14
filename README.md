# Smile — Strict API Contract Linter for VS Code

[![GitHub Release](https://img.shields.io/github/v/release/x-name15/vscode-smile?color=blue&logo=github)](https://github.com/x-name15/vscode-smile/releases)
[![GitHub](https://img.shields.io/badge/GitHub-x--name15%2Fvscode--smile-black?logo=github)](https://github.com/x-name15/vscode-smile)
[![smile version](https://img.shields.io/npm/v/@mrjacket/smile.svg?label=smile%20core&color=success)](https://www.npmjs.com/package/@mrjacket/smile)

The official Visual Studio Code extension for [**smile**](https://github.com/x-name15/smile) — the relentless API contract validator and gatekeeper.

Catch broken API contracts, missing `operationId`s, undocumented responses, and schema violations in real time as you write your specifications. Zero setup required.

---

## ⚡ Supported Formats (Out of the Box)

Smile automatically detects and validates specifications without requiring manual configuration:

- **OpenAPI 3.x / Swagger** (`.yaml`, `.yml`, `.json`)
- **AsyncAPI 2.x & 3.x** (`.yaml`, `.yml`, `.json`)
- **GraphQL** (`.graphql`, `.gql`)
- **gRPC / Protocol Buffers** (`.proto`)
- **JSON Schema** (`.schema.json`, `.schema.yaml`)
- **Postman Collections v2.1** (`.json`)

---

## 🎯 Features

### 1. Real-Time Inline Diagnostics & Squiggles
As you save or write your specification files, Smile pinpoints the exact line and key responsible for any contract violation:
- 🔴 **Errors:** Critical contract breaches (e.g. missing `operationId`, missing success response, invalid type references).
- 🟡 **Warnings:** Structural shortcomings (e.g. missing `summary`, parameter lacking example).

### 2. One-Click Quick Fix (Autofix)
When a missing `operationId` or `summary` is detected:
1. Click the lightbulb 💡 next to the line or press `Ctrl+.` (`Cmd+.` on macOS).
2. Select **"☺ Smile: Automatically fix safe contract issues"**.
3. Smile applies canonical, non-destructive AST changes while preserving all your `# comments`, blank lines, and YAML formatting!

### 3. Status Bar Indicator
Look at the bottom right of VS Code to see your API contract status at a glance:
- `$(check) Smile: Clean (openapi)` — specification honors contract with 0 errors.
- `$(alert) Smile: 2 warning(s)` — warnings found.
- `$(error) Smile: 1 error(s)` — contract breached. Click to re-lint.

### 4. Dual-View Activity Bar Sidebar
The dedicated Smile sidebar panel organizes contract evaluation and tools into two focused, native views:
- **Contract Status:** Displays real-time contract compliance for the active specification file:
  - **Contract Honored:** Signed clean (0 violations).
  - **Crime Scene:** Contract breached — violations grouped by rule with exact line navigation.
  - **Active Configuration:** Inspect whether custom `config.smile.json` or built-in strict rules are active.
  - **View Title Bar Actions:** Quick access to re-lint and autofix icons directly on the panel header.
- **Commands & Tools (1:1 with Smile CLI):** Direct access to all official Smile workflows:
  - ⚡ **The Breaching Detector (`smile test`)**: Run live API contract tests against running servers.
  - 🪄 **Smile Deduce (`smile deduce`)**: Interactively resolve safe contract issues.
  - 🎛️ **Rules & Configuration (`smile config`)**: Visual Rules Manager.
  - 📦 **Spec Bundler (`smile bundle`)**: Resolve external `$ref` pointers.
  - 📊 **Export Audit Report (`smile lint -f`)**: Export reports in SARIF, Markdown, JUnit, and Text.
  - 🚀 **Project Setup Wizard (`smile init`)**: Scaffolding config, CI workflow, and specs.
  - 🪝 **Install Git Hook (`smile install-hook`)**: Native Git pre-commit contract gate.

### 5. 🎨 The Complete Visual Companion Suite

#### 🎛️ Visual Rules Manager (`smile.openRulesManager`)
Configure rule severities visually across all 6 formats:
- Interactive tri-state buttons for each rule: `[ Error | Warn | Off ]`.
- Quick presets: **Strict (Mentalist)**, **Recommended**, and **Relaxed**.
- Filter rules by name, description, or format.
- Click **"Save Configuration"** to write directly to `config.smile.json` and immediately re-lint open files.

#### ⚡ Live API Smoke Tester (`smile.openSmokeTester`)
Test running servers against your documented API schemas (Breaching Detector):
- Enter server Base URL and optional authentication headers.
- Click **"Run Contract Smoke Test"** to see live response verification tables with latency, HTTP status codes, and schema validation details.

#### 📦 Multi-File Spec Bundler (`smile.bundleSpec`)
Resolve all external `$ref` pointers in OpenAPI, AsyncAPI, and JSON Schema contracts into a single consolidated file with one-click preview and "Save As..." export.

#### 📊 Multi-Format Report Exporter (`smile.exportReport`)
Export full specification audit reports into:
- **OASIS SARIF v2.1.0** for GitHub Code Scanning and security scanners.
- **Markdown** for pull request descriptions and comments.
- **HTML** for standalone audit dashboards.

#### 🪄 Project Setup Wizard (`smile.openInitWizard`)
3-step visual project bootstrapper:
- Select API format(s), rule enforcement level, and CI integration.
- Generates `config.smile.json`, `.github/workflows/smile.yml`, `.smileignore`, and starter contracts automatically.

### 6. Command Palette Actions (`Ctrl+Shift+P` / `Cmd+Shift+P`)
- `Smile: Lint Current Specification` — Force a manual contract evaluation.
- `Smile: Autofix Safe Issues on Current File` — Run AST autofix across the active document.
- `Smile: Open Visual Rules Manager` — Launch visual rule configuration dashboard.
- `Smile: Run Live API Contract Test (Smoke Tester)` — Test running servers against contract schemas.
- `Smile: Bundle Multi-File Specification ($ref)` — Resolve external references into a consolidated document.
- `Smile: Export Contract Audit Report (SARIF / MD / HTML)` — Export diagnostic reports.
- `Smile: Project Setup Wizard (Visual Init)` — Initialize contracts and CI workflows visually.
- `Smile: Install Native Git Pre-Commit Hook` — Install pre-commit hook that validates contracts.

---

## 🛠️ Project Configuration (`config.smile.json`)

If you use `smile` in your repository or CI, the VS Code extension automatically discovers and respects your custom configuration file:
- `config.smile.json`
- `smile.config.json`
- `.smilerc.json`
- `smile.json`

### Example `config.smile.json`:
```json
{
  "rules": {
    "missing-summary": "warn",
    "channel-description": "off",
    "operation-operationId": "error"
  },
  "maxWarnings": 10
}
```
- Rules set to `"off"` will be silenced in real-time.
- Rules set to `"warn"` appear as warnings (yellow squiggles).
- Changes to your config file are watched live and immediately re-lint open files!

---

## ⚙️ Extension Settings

Customize Smile behavior in your VS Code settings (`settings.json`):

```json
{
  "smile.enable": true,
  "smile.runOn": "onSave",
  "smile.maxWarnings": -1,
  "smile.configFile": ""
}
```

| Setting | Type | Default | Description |
|---|---|---|---|
| `smile.enable` | `boolean` | `true` | Enable or disable real-time Smile diagnostics. |
| `smile.runOn` | `string` | `"onSave"` | Validation trigger: `"onSave"` or debounced `"onType"`. |
| `smile.maxWarnings` | `number` | `-1` | Maximum allowed warnings (`-1` for unlimited). |
| `smile.configFile` | `string` | `""` | Optional explicit path to a Smile configuration file. |

---

## 📦 Project Links & Ecosystem

- **Core Engine & CLI:** [`@mrjacket/smile` on npm](https://www.npmjs.com/package/@mrjacket/smile)
- **GitHub Action:** [`x-name15/smile-action` on GitHub Marketplace](https://github.com/marketplace/actions/smile-api-linter)
- **Repository:** [`x-name15/smile`](https://github.com/x-name15/smile)

## 📄 License

This extension is licensed under the [GPL-3.0 License](./LICENSE).

### Credits
**Author:** Mr Jacket / Felix Manrique / x-name15 (we are all the same person)
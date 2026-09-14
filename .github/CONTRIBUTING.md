# Contributing to vscode-smile

Thank you for considering a contribution to `vscode-smile`! Contributions of any kind — bug
reports, feature requests, documentation fixes, and pull requests — are welcome.

`vscode-smile` is an open-source Visual Studio Code extension licensed under **GNU GENERAL PUBLIC LICENSE v3**, maintained primarily by a
single developer. Please read this document before submitting anything.

## Contact

Questions, design discussions, or ideas: open a
[GitHub Issue](https://github.com/x-name15/vscode-smile/issues) or a Discussion.
For security issues, see [SECURITY.md](SECURITY.md).

---

## Project philosophy & architecture

`vscode-smile` is an ultra-fast, zero-bloat extension designed to provide live feedback on API contracts.
Its architectural principles are:

- **Thin Wrapper over `@mrjacket/smile`:** The extension delegates all linting, parsing, and AST autofixing logic directly to the core `@mrjacket/smile` package. Avoid reinventing custom rule evaluators in this extension.
- **Accurate Diagnostic Ranges:** When adding or tweaking diagnostics, ensure `locationResolver.ts` highlights the precise line and property rather than whole documents.
- **Strict Performance Budget:** Startup and activation time must stay below 50ms. Bundling is handled via `tsup`, and raw `node_modules` are strictly excluded from `.vsix` distribution.

---

## Development workflow

1. Fork the repository and clone it locally.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a topic branch from `main`:
   ```bash
   git checkout -b feat/custom-code-action
   ```
4. Run tests and typechecking:
   ```bash
   npm run typecheck
   npm test
   npm run build
   ```
5. Debugging inside VS Code:
   - Press `F5` in VS Code to launch an **Extension Development Host** window with `vscode-smile` loaded in development mode.
   - Open any `.yaml`, `.json`, `.graphql`, or `.proto` file to test live squiggles and quick fixes.

---

## Coding conventions

- All identifiers, comments, and commit messages must be in **English**.
- Interfaces and types follow Hungarian notation (`ISmile...`, `T...`).
- Zero unnecessary runtime dependencies.

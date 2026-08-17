# Copilot Coding Agent Onboarding Guide

Repository: sillsdev/apm
Description: “Flexible audio-text orality tool.”
Primary Stack: TypeScript (≈75%), JavaScript, HTML, CSS. Desktop application built with Electron + Vite (indicated by `electron.vite.config.ts`, `electron-builder.yml`).
Purpose (inferred): A desktop and web application for managing and executing oral Bible translation workflows, including but not limited to internalizing preliminary resources, recording drafts, transcribing drafts, recording back translations of the drafts, reviewing by peers and consultants, and comprehension testing by community members.

> Follow these instructions first. Only fall back to repository-wide searching if something you need is **not** covered. If something appears incorrect, ask a question before proceeding.

---

## Memory File Convention

Path: `.github/.memory.md`

Usage Rules:

1. ALWAYS consult the memory file at the start of any multi-step task and before applying a patch.
2. Treat its preferences as binding unless the user explicitly overrides them in the current conversation.
3. You MAY update `.github/.memory.md` to capture newly clarified preferences or workflow agreements without asking first.
4. Do NOT extrapolate memory entries into unsolicited source code changes (no styling/refactors/perf changes) unless the user explicitly requests them.
5. If a direct instruction conflicts with memory, follow the instruction and then amend memory to reflect the change.

Scope Boundary:

- Autonomous modifications are allowed ONLY for `.github/.memory.md` and other agent instructions files.
- Source code under `src/` must only change when explicitly requested.

---

## 1. High-Level Overview

- TypeScript is the dominant language; strict type checking is expected (multiple `tsconfig.*.json` files).
- Formatting & linting are enforced via Prettier (`.prettierrc.yaml`, `.prettierignore`) and ESLint (`eslint.config.mjs`).
- Packaging & distribution are handled by `electron-builder` (`electron-builder.yml`) and there is a development auto-update config (`dev-app-update.yml`).
- Repo root contains standard Node/Electron project metadata (`package.json`, `package-lock.json`, tsconfigs, lint configs).
- Always use Context7 to retrieve current documentation when working with frameworks, libraries, or APIs. Automatically invoke the Context7 MCP tools without being asked.

## 2. Environment & Tooling

(Verify in `package.json` if present—do not assume absent values.)

| Concern            | Guidance                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| Node.js version    | If `engines.node` is defined in `package.json`, use that. Otherwise default to an active LTS (≥18).  |
| Package manager    | Use `npm` (lockfile present: `package-lock.json`). Prefer `npm ci` in CI and `npm install` locally.  |
| TypeScript         | Controlled via `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`.                           |
| Linting/Formatting | Run ESLint and Prettier before committing (see scripts section).                                     |
| Electron           | Build/packaging defined in `electron-builder.yml`.                                                   |
| Auto Update        | `dev-app-update.yml` suggests a development update channel; do not modify unless working on updates. |

Always ensure a clean install before building: delete `node_modules` and run `npm ci` for reproducible dependency states in CI or scripted automation.

## 3. Core Lifecycle Commands (Conventions)

Because we have not enumerated the `scripts` field inside `package.json` here, use the following conventional mapping (adjust only if `package.json` differs):

| Purpose             | Typical Script (verify)  | Command to Run                                                           |
| ------------------- | ------------------------ | ------------------------------------------------------------------------ |
| Bootstrap deps      | `postinstall` (optional) | `npm install` (local) / `npm ci` (CI)                                    |
| Development (watch) | `dev` or `start`         | `npm run dev`                                                            |
| Type check          | `typecheck` or via build | `npm run typecheck` (if defined) or `tsc --noEmit`                       |
| Lint                | `lint`                   | `npm run lint`                                                           |
| Format              | `format`                 | `npm run format`                                                         |
| Build (production)  | `build`                  | `npm run build`                                                          |
| Package installer   | `dist` / `package`       | `npm run dist` (common with electron-builder)                            |
| Tests               | `test`                   | `npm test` (Note: Renderer tests must run from `src\renderer` directory) |

**Running Renderer Tests** (PowerShell on Windows):

```powershell
cd src\renderer; npm test -- TestName
```

Use semicolons (`;`) to chain commands in PowerShell, not `&&`.

If a command fails:

1. Confirm dependencies installed (`node_modules` exists).
2. Remove possible stale artifacts: `rm -rf node_modules dist out`.
3. Re-run: `npm ci` then the intended script.

## 4. Recommended Execution Sequences

### 4.1 Fresh Clone (Local Dev)

1. `git clone <repo-url>`
2. `cd apm`
3. `npm install` (or `npm ci`)
4. (Optional) `npm run lint` & `npm run typecheck` to validate baseline.
5. `npm run dev` (launches Electron with hot reload if configured by Vite).

### 4.2 Validating a Change Before Commit

1. Ensure clean working tree: `git status`.
2. Run:
   - `npm run lint`
   - `npm run typecheck` (or `tsc --noEmit`)
   - `npm test` (if tests exist)
3. Run `npm run build` to confirm production compilation passes.
4. Optionally package: `npm run dist`.
5. Stage & commit.

### 4.3 CI-Oriented Minimal Script

```
npm ci
npm run lint
npm run build
npm test   # if defined
```

### 4.4 Packaging

```
npm ci
npm run build
npm run dist   # electron-builder to create installers / artifacts
```

If `dist` fails, inspect `electron-builder.yml` for missing metadata (e.g., appId, productName, afterPack hooks).

## 5. Project Layout & Key Files

| Path                                   | Role                                                                  |
| -------------------------------------- | --------------------------------------------------------------------- |
| `.editorconfig`                        | Editor consistency (indentation, charset).                            |
| `.gitignore`                           | Ignored artifacts; do not commit transient build output.              |
| `.prettierrc.yaml` / `.prettierignore` | Formatting rules & exclusions.                                        |
| `eslint.config.mjs`                    | ESLint flat config (ESM).                                             |
| `electron.vite.config.ts`              | Central Vite config bridging Electron main/renderer build targets.    |
| `electron-builder.yml`                 | Packaging + distribution config.                                      |
| `dev-app-update.yml`                   | Development auto-update channel config.                               |
| `package.json`                         | Scripts, dependencies, metadata (inspect before adding new libs).     |
| `package-lock.json`                    | Dependency lock; keep in sync.                                        |
| `tsconfig.json`                        | Base TypeScript config (likely "composite" root).                     |
| `tsconfig.node.json`                   | Node/Electron main process compilation options.                       |
| `tsconfig.web.json`                    | Renderer/browser-specific TS options.                                 |
| `resources/`                           | Assets (icons, binaries, static resources) used at packaging/runtime. |
| `src/`                                 | Application source (expect `main` process + renderer substructure).   |
| `README.md`                            | User-level overview (consult for domain-specific behavior).           |
| `LICENSE`                              | License terms (MIT or other; respect when adding third-party code).   |

### Likely `src` Substructure (Inferred Pattern)

(Not enumerated here; inspect when needed.)

- `src/main`: Electron main process entry (creates BrowserWindow, handles lifecycle).
- `src/preload`: Preload script exposing secure APIs.
- `src/renderer`: Frontend (React/Vue/Svelte/vanilla) built by Vite.
  Add new main-process logic near existing lifecycle or IPC management files; add UI functions within renderer folders to keep layering intact.

### Configuration Files – Modification Guidance

- Prefer extending existing ESLint or TS config rather than overwriting.
- Prettier config is authoritative for formatting; do not introduce conflicting style tools.
- Keep `electron-builder.yml` modifications minimal; test packaging after changes.

## 6. Linting, Formatting, and Quality Gates

1. Always run `npm run lint` before committing. Fix auto-fixable issues: `npx eslint . --fix` (if script not defined).
2. Always run formatting: `npx prettier . --write` or `npm run format`.
3. Type checking must pass (no TS errors).
4. Tests (if present) must pass locally; add or update tests for new logic.

If adding dependencies, ensure:

- They are production-safe (avoid large native deps unless necessary).
- devDependencies vs dependencies classification is correct.
- Electron security best practices (avoid enabling `nodeIntegration` in renderer unless already explicitly done).

## 7. Common Pitfalls & Preventive Guidance

| Situation                             | Mitigation                                                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Build fails due to missing types      | Install `@types/<package>` or ensure TS config `types` includes needed declarations.                             |
| Electron cannot start (blank window)  | Confirm `npm run dev` compiles both main & renderer; check entry points referenced in `electron.vite.config.ts`. |
| Packaging error (icon / artifact)     | Ensure required icons exist in `resources/` per `electron-builder.yml` (e.g., `.icns`, `.ico`).                  |
| Auto-update config mismatch           | Do not alter `dev-app-update.yml` unless implementing update channels.                                           |
| Lint errors for unused imports        | Remove or disable at specific lines; avoid broad rule suppression.                                               |
| Mixed formatting (line width, quotes) | Re-run Prettier prior to commit.                                                                                 |

## 8. Adding New Code

1. Identify correct layer:
   - Main process (IPC, file system, OS integration)
   - Preload (secure bridge)
   - Renderer (UI logic only)
2. Add or reuse IPC channels; keep namespacing consistent.
3. Update types: if you add IPC APIs, create/update a central types module.
4. Add tests if a test framework is configured (search for `test` script or `__tests__` folder).
5. Run the full validation sequence (Section 4.2).

## 9. Security & Safety (Electron Context)

- Avoid using `remote` module (deprecated).
- Keep `contextIsolation: true` in BrowserWindow unless explicitly disabled.
- Expose minimal surface through preload; never expose raw `fs` or `child_process` directly to renderer.

## 10. Working With Dependencies

- Use existing versions where possible; do not upgrade Electron or major framework versions as part of unrelated feature work.
- After adding a dependency: run `npm ci` in a clean clone to confirm lockfile integrity.

## 11. Packaging / Release Verification

Before altering packaging:

1. Run `npm run build`
2. Run `npm run dist`
3. Smoke-test produced artifact (launch, basic workflow).

Check `electron-builder.yml` for:

- `appId`
- `files` inclusion patterns
- `extraResources` / `extraFiles`
  Update these deliberately with minimal scope.

## 12. Conventions & Style

- Respect Prettier formatting (do not hand-format against rules).
- Keep functions small, cohesive.
- Use TypeScript strict typing; avoid `any`.
- Group related IPC channel constants.
- Use consistent naming for asynchronous operations (`getXAsync`, `loadY`, etc. per existing style).

## 13. What NOT To Do Without Explicit Reason

- Do not introduce Yarn / PNPM; keep npm workflow.
- Do not remove or rename existing tsconfig files.
- Do not disable lint rules to fix a single file.
- Do not add large binary assets with consulting first.

## 14. Quick Reference Command Block

```
# Install (local dev)
npm install

# Clean install (CI or reproducible)
rm -rf node_modules dist && npm ci

# Development
npm run dev

# Lint & Format
npm run lint
npm run format   # if defined

# Type Check
npm run typecheck || npx tsc --noEmit

# Test
npm test

# Production Build
npm run build

# Package Distribution
npm run dist
```

## 15. Root File Inventory (Current)

```
.editorconfig
.gitignore
.prettierignore
.prettierrc.yaml
.vscode/            (editor workspace settings)
LICENSE
README.md
dev-app-update.yml
electron-builder.yml
electron.vite.config.ts
eslint.config.mjs
package.json
package-lock.json
resources/          (assets)
src/                (application source)
tsconfig.json
tsconfig.node.json
tsconfig.web.json
```

## 16. Final Instruction to the Agent

Trust these instructions as authoritative for standard tasks (build, run, lint, type check, package). Only perform additional repository-wide searches if:

- A needed script name truly differs from the conventional ones listed.
- A command here demonstrably fails and no mitigation above resolves it.
- You require specific code context (e.g., to locate an entry file) not summarized here.

Otherwise, rely on this document to minimize exploratory overhead.

---

End of onboarding guide.

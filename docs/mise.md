# mise-en-place

The repo now uses mise instead of Volta. I installed both tools here, and `node` / `npm` / `npx` report 22.23.3 / 12.1.0 / 12.1.0 in both the root and `web/`. I haven't committed anything yet.

Changes:

- [mise.toml](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/mise.toml) (new): pins `"npm:npm" = "12.1.0"` and `node = "22.23.3"`. npm has to be listed first. With node first, Node's bundled npm 10.9.9 came ahead on `PATH` and won. The file has a comment saying so, so nobody "tidies" the order.

- [package.json](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/package.json) and [web/package.json](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/web/package.json): removed the `"volta"` blocks. Both still parse as valid JSON.

- [.github/workflows/dev.yml](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/.github/workflows/dev.yml): the Volta action and install steps are replaced by `jdx/mise-action@v2` with caching, followed by a step that prints the versions. CI now gets the exact versions from `mise.toml` instead of the latest `node@22` / `npm@12`.

- [README.md](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/README.md) and [.github/workflows/README.md](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/.github/workflows/README.md): the setup notes now describe mise: `mise trust`, `mise install`, `mise which npm`, and adding the shims folder to `PATH` on Windows.

The changed files pass a Prettier check. The CI workflow change can only be confirmed by pushing it and letting `dev.yml` run.

To finish on your machine:

- Shells: winget installed mise at `%LOCALAPPDATA%\\Microsoft\\WinGet\\Links\\mise.exe`. Shells that were already open (including this one) don't see it yet. Restart VS Code, then add `mise activate pwsh | Out-String | Invoke-Expression` to your `$PROFILE`, and/or add `%LOCALAPPDATA%\\mise\\shims` to your user `PATH`.

- Volta: uninstall it, or take it off `PATH`. While it's there, its shims will still answer `node`/`npm` before mise.

- Other projects: if you want a fallback for repos with no `mise.toml`, set a global default, e.g. `mise use -g node@22`.

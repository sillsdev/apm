# Audio Project Manager

This is the repository for the [Audio Project Manager](https://software.sil.org/audioprojectmanager/) application, written in React and TypeScript and built using Vite.

The repository is an npm monorepo with two packages:

- **`web/`** contains the React UI and its own package and configuration. It builds the web app using Vite.
- **The root folder** contains the package and configuration for the Electron desktop app. It uses `web/` as the UI and `electron/` for the main and preload processes. [vite-plugin-electron](https://github.com/electron-vite/vite-plugin-electron) builds both together, and [electron-builder](https://www.electron.build) (configured in `electron-builder.json5`) packages the result into installers in `release/`.

The desktop build is based on the [electron-vite react-ts template](https://electron-vite.github.io/).

We recommend using Visual Studio Code with the [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) and [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) extensions for a consistent development experience.

Most of the development happens in the `develop` branch. Feature branches should be created off of `develop` and merged back into it when ready.

## Table of Contents

- [Setting Up the Development Environment](#setting-up-the-development-environment)
- [Running the Application](#running-the-application)
- [Testing the Application](#testing-the-application)
- [Linting and Formatting](#linting-and-formatting)
- [Building the Electron Desktop App](#building-the-electron-desktop-app)
- [Building the Web App](#building-the-web-app)
- [Generating Logo Assets](#generating-logo-assets)
- [Troubleshooting](#troubleshooting)

## Setting Up the Development Environment

We use mise-en-place to pin node and npm versions. Please [install mise-en-place](https://mise.jdx.dev/getting-started.html) first if you don't have it. Make sure you also [activate it](https://mise.jdx.dev/getting-started.html#activate-mise).

Install the pinned versions of node and npm using mise-en-place:

```bash
mise trust
mise install
```

If you are having issues with mise-en-place, please refer to the [Troubleshooting](#troubleshooting) section.

With the pinned versions of node and npm installed, run:

```bash
npm install
npm run stamp
```

Install dependencies for the user interface:

```bash
cd web
npm install
```

Select a channel using ONE of these three commands (you'll need the appropriate secrets files in `env-config/`):

```bash
npm run devs
npm run qas
npm run prods
```

## Running the Application

In the appropriate folder (`web/` for the web app, root for the Electron desktop app), run:

```bash
npm start
```

## Testing the Application

```bash
npm run test:e2e
```

This runs tests on the desktop app. It requires setting VITE_TEST_EMAIL1 and
VITE_TEST_PW1 in your .env.local variables. As a minimum, it does a sanity test which launches and logs in using the credendials you give it.

```bash
cd web
npm run test
```

The `npm test` command runs the jest tests. There are also Cypress component tests for the renderer `npm run cy:run-ct` and end to end tests for the renderer `npm run cy:run-local` which at least authenticates the web app using credentials like above. For testing, it is also helpful to include VITE_TEST_CACHE=localstorage in your .env files so that it doesn't ask you to authenticate on each change. Also for Cypress there are commands to launch the component (`npm run cy:open-ct`) or e2e (`npm run cy:open-local`) tests in a browser so you can watch them run.

Cypress tests require that the dev server is running on 3000. There are a couple of ways to do this. You can launch the dev server in one terminal using `npm start` or you can use docker to launch the server in the background.

```bash
docker build -t apm-vite-renderer -f web/Dockerfile .
docker run -d -p 3000:3000 --name apm-vite-renderer apm-vite-renderer
```

Once the dev server is running, you can run the tests using the commands described in the readme for `web` which are `npm run cy:run-ct` for terminal and `npm run cy:open-ct` for running the tests in the browser.

When finished, the container can be deleted using the `Docker Desktop` or with the command

```bash
docker stop apm-vite-renderer # stops container from running
docker rm -f apm-vite-renderer # forces removal of container
docker rmi -f apm-vite-renderer # forces removal of image
```

Alternatively, you can use docker compose to run the entire test suite. It warms up with `npm run cy:docker:build` and the actual tests will run the second time using `npm run cy:docker`. (On Windows, Docker Desktop needs to be running to use docker and docker-compose).

## Linting and Formatting

We use ESLint for linting and Prettier for code formatting. To run the linter, use `npm run lint`. To format the code, use `npm run format`.

## Building the Electron Desktop App

```bash
# For Windows
npm run build:win

# For macOS
npm run build:mac

# For Linux
npm run build:linux
```

The renderer bundle is written to `dist/`, the main and preload bundles to `dist-electron/`, and installers to `release/<version>/`.

## Building the Web App

```bash
cd web
npm run build
```

The web app (with its PWA service worker) is written to `web/dist/`.

In order to test and debug web app, launch visual studio code from the `web` folder. (There is a readme there with the commands to use.)

## Generating Logo Assets

All app logo assets are generated from a single source: `web/src/assets/apm-logo.svg`. To regenerate the assets, run this script from the root:

```bash
npm run logoassets
```

This rewrites:

- `favicon.ico` in `web/public`, `web`, and `resources`
- `web/public/favicon.svg`
- PWA icons: `pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-512x512.png`
- `apple-touch-icon.png`
- `resources/icon.png`, which electron-builder converts into the `.icns` and `.ico`
- the Debian icon

Only run this when the logo itself changes. Commit the regenerated files with the new logo, and never edit them by hand.

Rasterizing requires Google Chrome or Chromium to be installed; `npm install` does not download a browser. The script finds Chrome in its standard install location. If it's installed somewhere else, set `PUPPETEER_EXECUTABLE_PATH` to the browser executable, for example (your path might be different):

```bash
# Windows (PowerShell)
$env:PUPPETEER_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"; npm run logoassets

# macOS
PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run logoassets

# Linux
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome npm run logoassets
```

## Troubleshooting

### mise-en-place

After installing the pinned versions of Node and npm using mise-en-place, check that your shell is using mise's shims by running:

```bash
mise which node
mise which npm
```

If you previously used Volta or installed Node system-wide, uninstall both first. Their shims and `PATH` entries shadow mise's shims, so mise appears not to take effect. On Windows, after removing them, also delete any leftover `%LOCALAPPDATA%\Volta` directory and `...\Volta\bin` entry from your user `PATH`.

On Windows, add `%LOCALAPPDATA%\mise\shims` to your user `PATH` so tools that don't load your shell profile (VS Code tasks, Git Bash) also get the pinned versions.

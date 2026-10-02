# Audio Project Manager

An application for desktop and web with Vite using React and TypeScript. This repository contains a simple monorepo using npm. The `web` folder is its own package that builds the web app with Vite. The root package builds the desktop app for Windows, Linux or a Mac with Vite and [vite-plugin-electron](https://github.com/electron-vite/vite-plugin-electron), using `web` as the UI and `electron/` for the main and preload processes; [electron-builder](https://www.electron.build) (`electron-builder.json5`) packages it into `release/`.

Desktop builds based on the [electron-vite react-ts template](https://electron-vite.github.io/)

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
$ npm run stamp
```

Note:
Node and npm versions are pinned via [Volta](https://volta.sh) in `package.json`.
If `npm --version` in this repo is not the pinned version,
Volta has fallen back to the npm bundled with Node (10.x) because the pinned npm
is missing from its local inventory; fetch it once with `volta install npm@12.1.0`

Note: This project uses `usfm-grammar-web` (wasm-based), which typically does not require local C/C++ toolchain setup (for example, MSVC build tools).

Install the user interface

```bash
$ cd web
$ npm install
```

Select a channel using ONE of these three commands (you'll need the appropriate secrets files in env-config).

```bash
$ npm run devs
$ npm run qas
$ npm run prods
```

### Development

```bash
$ npm start
```

### Testing

```bash
$ npm run test:e2e
```

This runs tests on the desktop app. It requires setting VITE_TEST_EMAIL1 and
VITE_TEST_PW1 in your .env.local variables. As a minimum, it does a sanity test which launches and logs in using the credendials you give it.

```bash
$ cd web
$ npm run test
```

The `npm test` command runs the jest tests. There are also Cypress component tests for the renderer `npm run cy:run-ct` and end to end tests for the renderer `npm run cy:run-local` which at least authenticates the web app using credentials like above. For testing, it is also helpful to include VITE_TEST_CACHE=localstorage in your .env files so that it doesn't ask you to authenticate on each change. Also for Cypress there are commands to launch the component (`npm run cy:open-ct`) or e2e (`npm run cy:open-local`) tests in a browser so you can watch them run.

Cypress tests require that the dev server is running on 3000. There are a couple of ways to do this. You can launch the dev server in one terminal using `npm start` or you can use docker to language the server in the background.

```bash
$ docker build -t apm-vite-renderer -f web/Dockerfile .
$ docker run -d -p 3000:3000 --name apm-vite-renderer apm-vite-renderer
```

Once the dev server is running, you can run the tests using the commands described in the readme for `web` which are `npm run cy:run-ct` for terminal and `npm run cy:open-ct` for running the tests in the browser.

When finished, the container can be deleted using the `Docker Desktop` or with the command

```bash
docker stop apm-vite-renderer # stops container from running
docker rm -f apm-vite-renderer # forces removal of container
docker rmi -f apm-vite-renderer # forces removal of image
```

Alternatively, you can use docker compose to run the entire test suite. It warms up with `npm run cy:docker:build` and the actual tests will run the second time using `npm run cy:docker`. (On Windows, Docker Desktop needs to be running to use docker and docker-compose).

### lint - static check

```bash
$ npm run lint
```

### Format - reformat sources

```bash
$ npm run format
```

### Generating Logo Assets

All app logo assets are generated from a single source: `web/src/assets/apm-logo.svg`. To regenerate the assets, run this script from the root:

```bash
$ npm run logoassets
```

This rewrites:

- `favicon.ico` in `web/public`, `web`, and `resources`
- `web/public/favicon.svg`
- PWA icons: `pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-512x512.png`
- `apple-touch-icon.png`
- `resources/icon.png`, which electron-builder converts into the `.icns` and `.ico`
- the Debian icon

Only run this when the logo itself changes. Commit the regenerated files with the new logo, and never edit them by hand.

Rasterizing requires Chrome or Chromium. The script defaults to the copy puppeteer downloaded. If that copy is missing or fails to launch, point it at an installed browser, for example (your path might be different):

    # Windows (PowerShell)
    $ $env:PUPPETEER_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"; npm run logoassets

    # macOS
    $ PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run logoassets

    # Linux
    $ PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome npm run logoassets

### Build Desktop

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

The renderer bundle is written to `dist/`, the main and preload bundles to `dist-electron/`, and installers to `release/<version>/`.

### Build Web

```bash
$ cd web
$ npm run build
```

The web app (with its PWA service worker) is written to `web/dist/`.

In order to test and debug web app, launch visual studio code from the `web` folder. (There is a readme there with the commands to use.)

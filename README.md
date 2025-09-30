# apm-vite

An application for desktop and web with electron-vite and vite using React and TypeScript. This repository contains a simple monorepo using npm. The src/renderer folder builds using vite to create a web app. The root builds using electron-vite and builds a desktop app for Windows, Linux or a Mac such that src/renderer is the UI for the desktop app.

Desktop builds based on [electron-vite](https://electron-vite.org)

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install --legacy-peer-deps
$ npm run stamp
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

### lint - static check

```bash
$ npm run lint
```

### Format - reformat sources

```bash
$ npm run format
```

### Build Desktop

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

In order to test and debug web app, launch visual studio code from the `src/renderer` folder. (There is a readme there with the commands to use.)

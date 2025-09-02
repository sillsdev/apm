# apm-vite

An application for desktop and web with electron-vite and vite using React and TypeScript.

Desktop builds based on [electron-vite](https://electron-vite.org)

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
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

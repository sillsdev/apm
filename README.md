# Audio Project Manager

An application for desktop and web with electron-vite and vite using React and TypeScript. This repository contains a simple monorepo using npm. The src/renderer folder builds using vite to create a web app. The root builds using electron-vite and builds a desktop app for Windows, Linux or a Mac such that src/renderer is the UI for the desktop app.

Desktop builds based on [electron-vite](https://electron-vite.org)

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
$ npm run stamp
```

Install the user interface

```bash
$ cd src/renderer
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
$ cd src/renderer
$ npm run test
```

Cypress tests require that the dev server is running on 3000. There are a couple of ways to do this. You can launch the dev server in one terminal using `npm start` or you can use docker to language the server in the background.

```bash
$ docker build -t apm-vite-renderer -f src/renderer/Dockerfile .
$ docker run -d -p 3000:3000 --name apm-vite-renderer apm-vite-renderer
```

Once the dev server is running, you can run the tests using the commands described in the readme for `src/renderer` which are `npm run cy:run-ct` for terminal and `npm run cy:open-ct` for running the tests in the browser.

WHen finished, the container can be deleted using the `Docker Desktop` or with the command

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

# apm-vite-web

This folder builds the web version which is basically the renderer folder of the
electron desktop app.

Huskey is used to typecheck and run tests on each commit.

Based on
[Vite React with typescript, Cypress (e2e & ct) and Jest testing.](https://github.com/muratkeremozcan/react-cypress-ts-vite-template)

```bash
# parallel unit, typecheck, lint, format and build
npm run validate
```

### Development

```bash
npm start # make sure code running on 3000
```

### Compoent testing

```bash
npm run cy:open-ct # for cypress component test runner
npm run cy:run-ct # headless version
```

### End-to-end (e2e) testing

```bash
# runs the ui and api servers, then opens e2e runner
npm run cy:open-local
npm run cy:run-local  # headless version
```

### jest testing

```bash
npm run test # run unit tests with jest
```

### Testing using docker

On Windows, `Docker Desktop` needs to be installed and running to host docker.

The Dockerfile runs the dev server to host the cypress testing. It is used by
both the `dev.yml` mentioned below and by `Docker Compose` which the developer can
use to run the suite locally.

To run locally without Docker:

```bash
npm start # run this in one terminal
npm run cy:run-ct # run this in a separate terminal
npm run cy:run-ct -- --spec "src/routes/SwitchTeams.cy.tsx" #run just this test file
```

The first time the tests are run, there may be some flakiness since vite optimizes dynamically and this dynamic optimization interferes with the tests. To get around this, you could run `npm run cy:run-ct` a second time.

Alternatively, you can warm up using the docker build command and then run the tests:

```bash
npm run cy:docker:build # run this to warm up. (Some tests succeed and some fail)
npm run cy:docker # the actual test pass where all should succeed
```

If the docker container is not removed, it may not need to be warmed up again until a significant change is made. To remove the containers:

```bash
npm run cy:docker:down
```

## CI

There is a `dev.yml` script in .github/workflows that runs on each check in to run the jest and cypress tests

```bash
build  -->  Cypress e2e test
       -->  Cypress component test
       -->  Typecheck
       -->  Lint
       -->  Unit test
```

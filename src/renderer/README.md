# apm-vite-web

This folder builds the web version which is basically the renderer folder of the
electron desktop app.

Huskey is used to typecheck and run tests on each commit.

Based on
[Vite React with typescript, Cypress (e2e & ct) and Jest testing.](https://github.com/muratkeremozcan/react-cypress-ts-vite-template)

```bash
# parallel unit, typecheck, lint, format and build
npm run validate

npm start # make sure code running on 3000

npm run cy:open-ct # for cypress component test runner
npm run cy:run-ct # headless version

# runs the ui and api servers, then opens e2e runner
npm run cy:open-local
npm run cy:run-local  # headless version

npm run test # run unit tests with jest
```

## CI

```
build  -->  Cypress e2e test
       -->  Cypress component test
       -->  Typecheck
       -->  Lint
       -->  Unit test
```

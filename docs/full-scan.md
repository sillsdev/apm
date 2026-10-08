#  Full-repo scan with a local SonarQube Server (Docker)

This is free, runs on your machine, and gives you a dashboard of every code smell in the repo. On Windows, Docker Desktop will need to be running.

1. Start the server (first start takes ~1–2 min)

```powershell
docker run -d --name sonarqube -e SONAR\_ES\_BOOTSTRAP\_CHECKS\_DISABLE=true -p 9000:9000 sonarqube:latest
```

`Access: Once initialized, the dashboard is accessible at http://localhost:9000 using default credentials (admin/admin).`

`Persistent Data: For production-like local setups, it is advisable to use Docker Compose to link SonarQube with an external database (like PostgreSQL) and persistent volumes for data retention. `

```poershell
docker run -d --name sonarqube -p 9000:9000 sonarqube:community
```

2. Go to [http://localhost:9000](http://localhost:9000/) and log in as `admin`/`admin`. It will make you change the password.

3. Choose Create project → Local project, use the key `apm-vite`, and generate a token.

4. Add a `sonar-project.properties` file at the repo root:

```json
sonar.projectKey=apm-vite
sonar.sources=web/src,electron
sonar.tests=web/src,tests
sonar.test.inclusions=\\/\.test.ts,\\/\.test.tsx,\\/\.spec.ts,\\/\.cy.tsx
sonar.exclusions=\\/node\_modules/\\,\\/dist/\\,\\/dist-electron/\\,\\/out/\\,\\/release/\\,web/src/store/localization/model.tsx,web/src/store/localization/reducers.tsx
sonar.javascript.lcov.reportPaths=web/coverage/lcov.info
```

The two localization files are excluded because they're generated.

5. Run the scanner. It needs no install because it runs through npx:

```powershell
cd web; npm run test:coverage; cd ..   \# optional: adds coverage data to the report
npx sonarqube-scanner "-Dsonar.host.url=http://localhost:9000" "-Dsonar.token=\<your-token\>"
```

6. Look at the results under Issues, filtered by Type = Code Smell (newer versions call it "Maintainability"). You can sort by severity, rule or file.

I've updated [sonar-project.properties](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/sonar-project.properties) but haven't run the scan, so it's not confirmed that this fixes the error. I changed three things:

- Skip the data files: added `web/src/assets/\\` to the exclusions so the analyzer no longer parses that ~25 MB of generated data.

- Use only the two real tsconfigs: `sonar.typescript.tsconfigPaths=tsconfig.web.json,tsconfig.node.json`, instead of all 9 it was finding.

- Count each test file once: test files are now excluded from sources, so they're only picked up as tests. I also added `\.cy.ts`, which was missing from the test patterns.

Run it again with:

```powershell
npx sonarqube-scanner "-Dsonar.host.url=http://localhost:9000" "-Dsonar.token=\<your-token\>"
```

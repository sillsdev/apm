# GitHub Actions Workflows

## Dev Build Workflow

This workflow builds and deploys the dev environment, converted from TeamCity.

### Required Repository Secrets

The following secrets must be configured in your GitHub repository settings (Settings → Secrets and variables → Actions → New repository secret):

1. **CLIENT_ID** - Auth0 client ID (was `env.ClientId` in TeamCity)
2. **SNAG_ID** - Snag ID (was `env.snagId` in TeamCity)
3. **AWS_ACCESS_KEY_ID** - AWS access key ID (was `env.AWS_ACCESS_KEY_ID` in TeamCity)
4. **AWS_SECRET_ACCESS_KEY** - AWS secret access key (was `env.AWS_SECRET_ACCESS_KEY` in TeamCity)

### Workflow Triggers

The workflow runs on:

- Push to `develop` or `main` branches
- Pull requests to `develop` or `main` branches
- Manual workflow dispatch

### Build Steps

1. Checkout code
2. Setup Volta (Node.js version manager)
3. Install Node.js 22
4. Clean up any existing node processes
5. Install dependencies (`npm ci` in `src/renderer`)
6. Stamp build with date and time
7. Create `.env.local` file with environment variables
8. Create `auth0-variables.json` file
9. Create `index.html` using template
10. Clean build artifacts
11. Run unit tests
12. Validate source (format, lint, typecheck, build)
13. Build the application
14. Deploy to S3 bucket `app-dev.audioprojectmanager.org`
15. Clean up processes

### Build Version

The build version follows the pattern: `4.4.3.{run_number}` where `{run_number}` is the GitHub Actions run number.

FROM node:22.19.0

# Install wget for healthcheck
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root package files first
COPY package*.json ./

# Install root dependencies (use ci for clean install, ignore cache)
RUN npm ci

# Copy renderer package files
COPY src/renderer/package*.json ./src/renderer/

# Install renderer dependencies (use ci for clean install, ignore cache)
RUN cd src/renderer && npm ci

# Copy necessary config files
COPY env-config ./env-config
COPY tsconfig*.json ./
COPY electron.vite.config.ts ./
COPY src/renderer ./src/renderer

# Expose Vite dev server port
EXPOSE 3000

# Run the renderer's Vite dev server (not the full Electron app)
# The .env.local and auth0-variables.json files should be created or mounted
# inside the container by the workflow (for example at startup), not copied at build time.
WORKDIR /app/src/renderer
CMD ["npm", "start"]

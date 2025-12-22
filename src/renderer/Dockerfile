FROM node:22.19.0

# Install wget for healthcheck
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root package files first
COPY package*.json ./

# Install root dependencies (use ci for clean install, ignore cache)
RUN npm ci

# These lines appear to cause the container build to hang
# # Create a non-root user for running the application
# RUN groupadd --gid 1010 apm \
#   && useradd --uid 1010 --gid apm --shell /bin/bash --create-home apm
# # Change ownership of the app directory to the apm user
# RUN chown -R apm:apm /app
# # Switch to the non-root user
# USER apm

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

# The command will be overridden by docker-compose
CMD ["npm", "start"]

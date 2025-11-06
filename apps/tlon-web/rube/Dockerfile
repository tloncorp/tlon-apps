# syntax=docker/dockerfile:1.4
# E2E Test Container for Tlon Web
FROM ubuntu:22.04

# Prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    netcat-openbsd \
    ca-certificates \
    lsof \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js (match version from .nvmrc)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g n \
    && n 20.11.0 \
    && hash -r

# Install pnpm
RUN npm install -g pnpm@9.0.5

# Set working directory
WORKDIR /workspace

# Copy only essential files for dependency installation
COPY ../../../package.json ../../../pnpm-lock.yaml ../../../pnpm-workspace.yaml /workspace/
COPY ../../../.nvmrc /workspace/

# Copy root config files needed for building
COPY ../../../tsconfig* /workspace/

# Create directory structure for packages
RUN mkdir -p /workspace/packages/shared /workspace/packages/ui /workspace/packages/app /workspace/packages/editor

# Copy package.json files for all workspaces (more specific paths)
COPY ../../../packages/shared/package.json /workspace/packages/shared/
COPY ../../../packages/ui/package.json /workspace/packages/ui/
COPY ../../../packages/app/package.json /workspace/packages/app/
COPY ../../../packages/editor/package.json /workspace/packages/editor/
COPY ../../../apps/tlon-web/package.json /workspace/apps/tlon-web/
COPY ../../../apps/tlon-mobile/package.json /workspace/apps/tlon-mobile/
COPY ../../../apps/tlon-desktop/package.json /workspace/apps/tlon-desktop/

# Copy patches directory (needed for pnpm patches)
COPY ../../../patches/ /workspace/patches/

# Copy .npmrc if it exists (for npm configurations)
COPY ../../../.npmrc* /workspace/

# Install dependencies (with cache mount for faster rebuilds)
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Pre-download and extract ships + Urbit binary in parallel
# URLs must match those in shipManifest.json
# NOTE: These URLs are automatically updated by archive-piers.sh when ship versions change
RUN mkdir -p /opt/ships && cd /opt/ships && \
    echo "Downloading ship archives and Urbit binary in parallel..." && \
    printf "%s\n" \
        "https://bootstrap.urbit.org/rube-zod20.tgz zod.tgz" \
        "https://bootstrap.urbit.org/rube-bus9.tgz bus.tgz" \
        "https://bootstrap.urbit.org/rube-ten20.tgz ten.tgz" \
        "https://bootstrap.urbit.org/rube-mug20.tgz mug.tgz" \
        "https://github.com/urbit/vere/releases/latest/download/linux-x86_64.tgz urbit.tgz" \
    | xargs -P 5 -n 2 sh -c 'curl -fSL -o "$1" "$0" || exit 255' && \
    echo "All downloads complete, extracting..." && \
    ls -lh *.tgz && \
    printf "%s\n" zod.tgz bus.tgz ten.tgz mug.tgz urbit.tgz \
    | xargs -P 5 -I {} tar -xzf {} && \
    rm *.tgz && \
    mkdir urbit-binary && \
    mv vere-*-linux-x86_64 urbit-binary/urbit && \
    chmod +x urbit-binary/urbit && \
    echo "Ships and binary ready at /opt/ships" && \
    ls -la /opt/ships/

# Now copy the rest of the source code
COPY ../../../packages/ /workspace/packages/
COPY ../../../apps/tlon-web/ /workspace/apps/tlon-web/
COPY ../../../desk/ /workspace/desk/

# Install Playwright browsers and dependencies
WORKDIR /workspace/apps/tlon-web
RUN pnpm exec playwright install --with-deps chromium

# Build packages if needed
WORKDIR /workspace
RUN pnpm build:packages

# Install TypeScript globally for rube compilation
RUN npm install -g typescript

# Pre-compile rube scripts
WORKDIR /workspace/apps/tlon-web
RUN echo "Compiling rube scripts..." && \
    ls -la ./rube/ && \
    tsc --isolatedModules --skipLibCheck ./rube/*.ts --outDir ./rube/dist && \
    echo "Rube scripts compiled successfully" && \
    echo "Verifying compiled files..." && \
    ls -la ./rube/dist/ && \
    test -f ./rube/dist/index.js || (echo "ERROR: index.js not found after compilation!" && exit 1) && \
    echo "Ensuring binaries and scripts are executable..." && \
    chmod +x ./rube/click ./rube/click-format ./rube/*.sh ./*.sh 2>/dev/null || true

# Set environment variables for testing
ENV CI=true
ENV IN_CONTAINER=true
ENV SKIP_DOWNLOAD=true
ENV PRE_EXTRACTED_SHIPS=/opt/ships
ENV URBIT_BINARY_PATH=/opt/ships/urbit-binary/urbit

# Default working directory for tests
WORKDIR /workspace/apps/tlon-web

# Verify rube scripts are available at runtime
RUN echo "Final check - rube scripts:" && ls -la ./rube/dist/*.js 2>/dev/null || echo "No JS files in rube/dist"

# Entry point for running tests with sharding
ENTRYPOINT ["/bin/bash", "-c"]
CMD ["pnpm e2e"]
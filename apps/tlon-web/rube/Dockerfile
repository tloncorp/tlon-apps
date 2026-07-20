# syntax=docker/dockerfile:1.4
# E2E Test Container for Tlon Web
# Node version pinned to match .nvmrc
FROM node:22.22.0-bookworm

# Prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies (some already present in the base image; kept explicit)
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    netcat-openbsd \
    ca-certificates \
    lsof \
    procps \
    rsync \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install peru — rube runs `peru sync` at runtime to vendor desk dependencies
# (base-dev + landscape picks) into desk/ before assembling ship desks.
RUN pip3 install --no-cache-dir --break-system-packages peru

# Install pnpm
RUN npm install -g pnpm@11.9.0

# Set working directory
WORKDIR /workspace

# Copy only essential files for dependency installation
COPY ../../../package.json ../../../pnpm-lock.yaml ../../../pnpm-workspace.yaml /workspace/
COPY ../../../.nvmrc /workspace/

# Copy root config files needed for building
COPY ../../../tsconfig* /workspace/

# Create directory structure for packages
RUN mkdir -p /workspace/packages/shared /workspace/packages/ui /workspace/packages/app /workspace/packages/editor /workspace/packages/api

# Copy package.json files for all workspaces (more specific paths)
COPY ../../../packages/shared/package.json /workspace/packages/shared/
COPY ../../../packages/ui/package.json /workspace/packages/ui/
COPY ../../../packages/app/package.json /workspace/packages/app/
COPY ../../../packages/editor/package.json /workspace/packages/editor/
COPY ../../../packages/api/package.json /workspace/packages/api/
COPY ../../../apps/tlon-web/package.json /workspace/apps/tlon-web/
COPY ../../../apps/tlon-mobile/package.json /workspace/apps/tlon-mobile/
COPY ../../../apps/tlon-desktop/package.json /workspace/apps/tlon-desktop/

# Copy patches directory (needed for pnpm patches)
COPY ../../../patches/ /workspace/patches/

# Copy vendored dependency tarballs referenced by pnpm-lock.yaml
COPY ../../../vendor/ /workspace/vendor/

# Install dependencies.
# Ignore lifecycle scripts in this dependency-only layer to avoid running
# desktop postinstall hooks (electron native rebuilds) during web E2E image build.
RUN pnpm install --frozen-lockfile --ignore-scripts

# Install Playwright browsers and dependencies (before source copy for better caching)
WORKDIR /workspace/apps/tlon-web
RUN pnpm exec playwright install --with-deps chromium

# Pre-download and extract ships + Urbit binary in parallel
# URLs must match those in shipManifest.json
# NOTE: These URLs are automatically updated by archive-piers.sh when ship versions change
WORKDIR /workspace
RUN mkdir -p /opt/ships && cd /opt/ships && \
    echo "Downloading ship archives and Urbit binary in parallel..." && \
    printf "%s\n" \
        "https://bootstrap.urbit.org/rube-zod27.tgz zod.tgz" \
        "https://bootstrap.urbit.org/rube-bus9.tgz bus.tgz" \
        "https://bootstrap.urbit.org/rube-ten27.tgz ten.tgz" \
        "https://bootstrap.urbit.org/rube-mug27.tgz mug.tgz" \
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
# peru.yaml + scripts are needed for the runtime `peru sync` (into desk-deps/)
# and assemble-desk.sh (desk-deps/ + desk/ -> ship groups desk)
COPY ../../../peru.yaml /workspace/peru.yaml
COPY ../../../scripts/ /workspace/scripts/

# Build packages if needed
WORKDIR /workspace
RUN pnpm build:packages

# Install TypeScript globally for rube compilation
RUN npm install -g typescript

# Pre-compile rube scripts
WORKDIR /workspace/apps/tlon-web
RUN echo "Compiling rube scripts..." && \
    ls -la ./rube/ && \
    bash ./rube/compile-rube.sh && \
    echo "Verifying compiled files..." && \
    ls -la ./rube/dist/
RUN chmod +x ./rube/click ./rube/click-format ./rube/*.sh ./*.sh 2>/dev/null || true

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

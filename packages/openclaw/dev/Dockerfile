FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y git curl gettext-base unzip && apt-get install -y git curl jq && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@11.9.0

# Install OpenClaw globally
RUN npm install -g openclaw@2026.5.28

# Install the Brave web-search plugin. openclaw@2026.5.28 rejects
# tools.web.search.provider "brave" (set by entrypoint.sh when BRAVE_API_KEY
# is present) unless the plugin is installed. Mirrors the test image and
# production (tlonbot entrypoint); the install ledger in ~/.openclaw/plugins/
# survives the entrypoint's config patching.
RUN openclaw plugins install @openclaw/brave-plugin

# Install bun for building @tloncorp/tlon-skill from source in the dev override flow.
# Used only by dev/build-local-skill-override.sh when a local tlon-skill checkout is mounted.
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Headless Chromium for `tlon surface preview`, which renders a surface app
# through the real shell and screenshots the capture matrix so the authoring
# bot can score its own output against the rubric.
#
# Version is pinned to the monorepo's own playwright (packages/tlon-skill
# devDependency, ^1.52.0, resolved to 1.52.0 in pnpm-lock.yaml) so the browser
# the container renders in is the browser CI's preview tests render in.
#
# --with-deps pulls Chromium's Debian shared libraries (libnss3, libatk*,
# libxkbcommon0, …); node:22-bookworm-slim ships none of them. Browsers land
# in PLAYWRIGHT_BROWSERS_PATH, which is an image layer and not one of the
# named volumes, so a `docker compose down -v` cannot strand the install.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npm install -g playwright@1.52.0 \
  && playwright install --with-deps chromium \
  && rm -rf /var/lib/apt/lists/*

# surface-preview.ts resolves Playwright through a RUNTIME bare specifier so
# `bun build --compile` leaves it out of the binary. A compiled bun binary
# resolves that specifier against the PROCESS CWD, and the bot runs `tlon`
# from its OpenClaw workspace, which has no node_modules/playwright above it.
# Name the global install absolutely instead — the override hook exists for
# exactly this ("point at a Playwright installed somewhere other than the
# binary's own resolution path"), and an absolute path is CWD-independent.
ENV TLON_PLAYWRIGHT_MODULE=/usr/local/lib/node_modules/playwright

# Create workspace
WORKDIR /workspace

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 18789

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

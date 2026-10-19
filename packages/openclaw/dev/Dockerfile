FROM node:24.16.0-bookworm-slim

RUN apt-get update && apt-get install -y git curl gettext-base unzip && apt-get install -y git curl jq && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@11.9.0

# Install OpenClaw globally
ARG OPENCLAW_CORE_VERSION=2026.9.33
RUN npm install -g "openclaw@${OPENCLAW_CORE_VERSION}"
ENV OPENCLAW_CORE_VERSION=${OPENCLAW_CORE_VERSION}

# Install the Brave web-search plugin used when BRAVE_API_KEY is present.
# Mirrors the test image and production (tlonbot entrypoint); the install
# ledger in ~/.openclaw/plugins/ survives the entrypoint's config patching.
# Pinned to OPENCLAW_CORE_VERSION: an unversioned install resolves clawhub's
# newest plugin build, which can require a plugin API newer than this image's
# OpenClaw core exposes and fail the install.
RUN openclaw plugins install "@openclaw/brave-plugin@${OPENCLAW_CORE_VERSION}"

# Install bun for building @tloncorp/tlon-skill from source in the dev override flow.
# Used only by dev/build-local-skill-override.sh when a local tlon-skill checkout is mounted.
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Create workspace
WORKDIR /workspace

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 18789

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

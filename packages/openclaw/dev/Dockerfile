FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y git curl gettext-base unzip && apt-get install -y git curl jq && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@9.15.9

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

# Create workspace
WORKDIR /workspace

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 18789

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

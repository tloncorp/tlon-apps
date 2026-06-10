FROM node:22-bookworm-slim

ARG HERMES_AGENT_REPO=https://github.com/NousResearch/hermes-agent.git
ARG HERMES_AGENT_REF=main

ENV HERMES_AGENT_DIR=/opt/hermes-agent
ENV HERMES_VENV=/opt/hermes-venv
ENV PATH="/opt/hermes-venv/bin:/root/.bun/bin:${PATH}"

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    python3 \
    python3-pip \
    python3-venv \
    unzip \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@9.15.9

RUN curl -fsSL https://bun.sh/install | bash

RUN git clone --depth 1 --branch "$HERMES_AGENT_REF" "$HERMES_AGENT_REPO" "$HERMES_AGENT_DIR" \
  || (rm -rf "$HERMES_AGENT_DIR" \
    && git clone "$HERMES_AGENT_REPO" "$HERMES_AGENT_DIR" \
    && cd "$HERMES_AGENT_DIR" \
    && git checkout "$HERMES_AGENT_REF")

RUN python3 -m venv "$HERMES_VENV" \
  && "$HERMES_VENV/bin/python" -m pip install --upgrade pip setuptools wheel \
  && "$HERMES_VENV/bin/python" -m pip install -e "$HERMES_AGENT_DIR[all]" \
  && "$HERMES_VENV/bin/python" -m pip install "aiohttp>=3.9" "posthog>=3"

WORKDIR /workspace

COPY entrypoint.sh /usr/local/bin/hermes-tlon-dev-entrypoint
RUN chmod +x /usr/local/bin/hermes-tlon-dev-entrypoint

ENTRYPOINT ["/usr/local/bin/hermes-tlon-dev-entrypoint"]

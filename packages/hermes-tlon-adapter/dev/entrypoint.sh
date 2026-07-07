#!/usr/bin/env bash
set -euo pipefail

TLON_APPS_DIR="${TLON_APPS_DIR:-/workspace/tlon-apps}"
TLON_ADAPTER_DIR="${TLON_ADAPTER_DIR:-$TLON_APPS_DIR/packages/hermes-tlon-adapter}"
TLON_SKILL_DIR="${TLON_SKILL_DIR:-$TLON_APPS_DIR/packages/tlon-skill}"
HERMES_HOME="${HERMES_HOME:-/workspace/hermes-home}"
HERMES_AGENT_DIR="${HERMES_AGENT_DIR:-/opt/hermes-agent}"
HERMES_VENV="${HERMES_VENV:-/opt/hermes-venv}"
TLON_CLI="${TLON_CLI:-/workspace/hermes-dev/bin/tlon}"
TERMINAL_CWD="${TERMINAL_CWD:-$HERMES_HOME}"

export HERMES_HOME HERMES_AGENT_DIR TLON_CLI TERMINAL_CWD
export PATH="$HERMES_VENV/bin:/root/.bun/bin:$PATH"

if [ -z "${BRAVE_SEARCH_API_KEY:-}" ] && [ -n "${BRAVE_API_KEY:-}" ]; then
  export BRAVE_SEARCH_API_KEY="$BRAVE_API_KEY"
fi

if [ -z "${TLON_HOME_CHANNEL:-}" ] && [ -n "${TLON_OWNER_SHIP:-}" ]; then
  export TLON_HOME_CHANNEL="$TLON_OWNER_SHIP"
fi

if [ ! -f "$TLON_ADAPTER_DIR/plugin.yaml" ]; then
  echo "ERROR: Tlon Hermes adapter is not mounted at $TLON_ADAPTER_DIR"
  exit 1
fi

if [ ! -f "$TLON_SKILL_DIR/package.json" ]; then
  echo "ERROR: tlon-skill package is not mounted at $TLON_SKILL_DIR"
  exit 1
fi

mkdir -p "$HERMES_HOME/plugins/platforms" "$HERMES_HOME/logs" /workspace/hermes-dev/bin
ln -sfn "$TLON_ADAPTER_DIR" "$HERMES_HOME/plugins/platforms/tlon"

echo "==> Installing managed Tlon Hermes prompts in $HERMES_HOME"
"$HERMES_VENV/bin/python" - <<'PY'
import os
import re
from pathlib import Path

home = Path(os.environ["HERMES_HOME"])
prompts_dir = Path(os.environ["TLON_ADAPTER_DIR"]) / "prompts"
prompts_root = prompts_dir.resolve()

include_re = re.compile(r"(?m)^\{\{include:([^}]+)\}\}\s*$")


def env_any(names, default):
    for name in names:
        value = (os.environ.get(name) or "").strip()
        if value:
            return value
    return default


values = {
    "TLON_NODE_ID": env_any(["TLON_NODE_ID", "TLON_SHIP", "URBIT_SHIP"], "the configured bot node"),
    "TLON_OWNER_SHIP": env_any(["TLON_OWNER_SHIP"], "the configured owner ship"),
    "TLON_NODE_URL": env_any(["TLON_NODE_URL", "TLON_SHIP_URL", "TLON_URL", "URBIT_URL"], "the configured Tlon node URL"),
}


def checked_prompt_path(rel):
    path = (prompts_dir / rel).resolve()
    if path != prompts_root and prompts_root not in path.parents:
        raise ValueError(f"Prompt include escapes prompts directory: {rel}")
    return path


def render_prompt(rel, stack=()):
    if rel in stack:
        chain = " -> ".join((*stack, rel))
        raise ValueError(f"Prompt include cycle: {chain}")
    path = checked_prompt_path(rel)
    text = path.read_text(encoding="utf-8")

    def include(match):
        include_rel = match.group(1).strip()
        return render_prompt(include_rel, (*stack, rel)).rstrip()

    text = include_re.sub(include, text)
    for key, value in values.items():
        text = text.replace("{{" + key + "}}", value)
    return text.strip() + "\n"


def upsert_managed_block(target, rel, *, replace_default_soul=False, memory_file=False):
    rendered = render_prompt(rel).rstrip()
    start = f"<!-- BEGIN tlon-managed:{rel} -->"
    end = f"<!-- END tlon-managed:{rel} -->"
    block = f"{start}\n{rendered}\n{end}\n"
    target.parent.mkdir(parents=True, exist_ok=True)

    current = ""
    if target.exists():
        current = target.read_text(encoding="utf-8")

    if start in current and end in current:
        pattern = re.compile(re.escape(start) + r".*?" + re.escape(end) + r"\n?", re.S)
        updated = pattern.sub(block, current)
    elif replace_default_soul and current.strip().startswith(
        "You are Hermes Agent, an intelligent AI assistant created by Nous Research."
    ):
        updated = block
    elif current.strip():
        separator = "\n§\n" if memory_file else "\n\n"
        updated = current.rstrip() + separator + block
    else:
        updated = block

    target.write_text(updated, encoding="utf-8")


upsert_managed_block(home / "SOUL.md", "hermes/SOUL.md", replace_default_soul=True)
upsert_managed_block(home / ".hermes.md", "hermes/.hermes.md")
upsert_managed_block(home / "memories" / "USER.md", "hermes/USER.md", memory_file=True)
PY

echo "==> Writing Hermes dev config in $HERMES_HOME/config.yaml"
"$HERMES_VENV/bin/python" "$TLON_ADAPTER_DIR/dev/write_config.py"

echo "==> Installing tlon-skill workspace dependencies into container volumes"
cd "$TLON_APPS_DIR"
pnpm install --filter @tloncorp/tlon-skill... --frozen-lockfile --ignore-scripts

echo "==> Building @tloncorp/api for the local skill binary"
pnpm --filter @tloncorp/api build

ARCH_KEY="$(node -e 'console.log(process.platform + "-" + process.arch)')"
case "$ARCH_KEY" in
  linux-arm64) BUN_TARGET="bun-linux-arm64" ;;
  linux-x64) BUN_TARGET="bun-linux-x64" ;;
  *)
    echo "ERROR: unsupported container architecture $ARCH_KEY"
    exit 1
    ;;
esac

VERSION="$(node -e 'console.log(require(process.argv[1]).version)' "$TLON_SKILL_DIR/package.json")"
BUILD_DIR="/workspace/hermes-dev/tlon-skill-build-$ARCH_KEY"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

echo "==> Building local tlon CLI for $ARCH_KEY at $TLON_CLI"
(cd "$BUILD_DIR" && bun build "$TLON_SKILL_DIR/scripts/main.ts" \
  --compile \
  --target="$BUN_TARGET" \
  --outfile "$TLON_CLI" \
  --define "__VERSION__=\"$VERSION\"")
chmod +x "$TLON_CLI"
"$TLON_CLI" --version

case "${HERMES_PLUGINS_DEBUG:-0}" in
  1|true|TRUE|yes|YES|on|ON)
    echo "==> Hermes plugin list"
    hermes plugins list --json | "$HERMES_VENV/bin/python" -m json.tool || true
    ;;
esac

echo "==> Starting Hermes gateway"
read -r -a GATEWAY_ARGS <<< "${HERMES_GATEWAY_ARGS:---replace}"
exec hermes gateway run "${GATEWAY_ARGS[@]}"

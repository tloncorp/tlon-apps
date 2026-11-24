"""Render a deterministic Hermes config for the shared E2E harness."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Mapping

try:
    import yaml
except ModuleNotFoundError:  # pragma: no cover - depends on local Python env
    yaml = None


def _clean(env: Mapping[str, str | None], name: str, default: str = "") -> str:
    value = str(env.get(name) or "").strip()
    return value or default


_TRUTHY = {"1", "true", "yes", "on"}


def _flag(env: Mapping[str, str | None], name: str) -> bool:
    return _clean(env, name).lower() in _TRUTHY


def render_config(env: Mapping[str, str | None]) -> dict[str, object]:
    enable_cronjob = _flag(env, "HERMES_E2E_ENABLE_CRONJOB")
    # Mirrors the hosted entrypoint's LCM wiring (tlonbot entrypoint/hermes.py):
    # the LCM plugin enabled beside the Tlon platform plugin, context.engine
    # naming its engine, and the context_engine toolset so the lcm_* tools are
    # advertised. Defaults to lcm-x (plugin "hermes-lcm-x", engine "lcm-x");
    # hermes-lcm is plugin "hermes-lcm" with engine "lcm".
    enable_lcm = _flag(env, "TLON_E2E_HERMES_LCM")
    lcm_plugin = _clean(env, "TLON_E2E_HERMES_LCM_PLUGIN", "hermes-lcm-x")
    lcm_engine = _clean(env, "TLON_E2E_HERMES_LCM_ENGINE", "lcm-x")
    platform_toolsets = ["tlon", "cronjob", "no_mcp"] if enable_cronjob else ["tlon", "no_mcp"]
    if enable_lcm:
        platform_toolsets.append("context_engine")
    context_length = _clean(env, "HERMES_MODEL_CONTEXT_LENGTH")
    home_channel = (
        _clean(env, "TLON_HOME_CHANNEL")
        or _clean(env, "TLON_OWNER_SHIP")
        or _clean(env, "TLON_GATEWAY_STATUS_OWNER")
    )
    home_channel_config = {
        "platform": "tlon",
        "chat_id": home_channel,
        "name": home_channel,
    }

    return {
        "model": {
            "provider": _clean(env, "HERMES_MODEL_PROVIDER", "custom"),
            "default": _clean(env, "HERMES_MODEL", "tlon-test-scripted"),
            "base_url": _clean(
                env, "HERMES_MODEL_BASE_URL", "http://fake-model:4000/v1"
            ),
            "api_key": _clean(env, "HERMES_MODEL_API_KEY", "no-key-required"),
            "api_mode": _clean(env, "HERMES_MODEL_API_MODE", "chat_completions"),
            **({"context_length": int(context_length)} if context_length else {}),
        },
        "plugins": {
            "enabled": ["platforms/tlon", lcm_plugin] if enable_lcm else ["platforms/tlon"],
        },
        **({"context": {"engine": lcm_engine}} if enable_lcm else {}),
        "platforms": {
            "tlon": {
                "enabled": True,
                "home_channel": home_channel_config,
            },
        },
        "gateway": {
            "platforms": {
                "tlon": {
                    "enabled": True,
                    "home_channel": home_channel_config,
                },
            },
        },
        "platform_toolsets": {
            "tlon": platform_toolsets,
        },
        "mcp_servers": {},
        # Hermes >= 0.22 defers plugin tools behind tool_search/tool_describe/
        # tool_call bridges by default; keep the tlon tool directly advertised.
        "tools": {"tool_search": {"enabled": "off"}},
        "agent": {
            "disabled_toolsets": [] if enable_cronjob else ["cronjob"],
        },
        "tlon": {
            "known_bot_users": _clean(env, "TLON_KNOWN_BOT_USERS"),
            "max_consecutive_bot_responses": int(
                _clean(env, "TLON_MAX_CONSECUTIVE_BOT_RESPONSES", "3")
            ),
        },
        "terminal": {
            "cwd": _clean(env, "TERMINAL_CWD")
            or str(Path(_clean(env, "HERMES_HOME", "/workspace/hermes-home"))),
        },
    }


def write_config(home: Path, env: Mapping[str, str | None]) -> Path:
    rendered = render_config(env)
    path = home / "config.yaml"
    path.parent.mkdir(parents=True, exist_ok=True)
    if yaml is not None:
        text = yaml.safe_dump(rendered, sort_keys=False)
    else:
        text = json.dumps(rendered, indent=2) + "\n"
    path.write_text(text, encoding="utf-8")
    return path


def main() -> None:
    write_config(Path(os.environ["HERMES_HOME"]), os.environ)


if __name__ == "__main__":
    main()

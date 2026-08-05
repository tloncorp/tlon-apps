"""Render the disposable Hermes dev profile config."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Mapping, MutableMapping

try:
    import yaml
except ModuleNotFoundError:  # pragma: no cover - depends on local Python env
    yaml = None


MODEL_ENV_FIELDS = (
    (("HERMES_MODEL_PROVIDER", "HERMES_PROVIDER"), "provider"),
    (("HERMES_MODEL", "MODEL"), "default"),
    (("HERMES_MODEL_BASE_URL",), "base_url"),
    (("HERMES_MODEL_API_KEY",), "api_key"),
    (("HERMES_MODEL_API_MODE",), "api_mode"),
)


def _clean_env(env: Mapping[str, str | None], name: str) -> str:
    return str(env.get(name) or "").strip()


def _first_env(env: Mapping[str, str | None], names: tuple[str, ...]) -> str:
    for name in names:
        value = _clean_env(env, name)
        if value:
            return value
    return ""


def _dict_at(config: MutableMapping[str, object], key: str) -> MutableMapping[str, object]:
    value = config.get(key)
    if not isinstance(value, dict):
        value = {}
        config[key] = value
    return value


def render_config(
    config: MutableMapping[str, object],
    env: Mapping[str, str | None],
) -> MutableMapping[str, object]:
    plugins = _dict_at(config, "plugins")
    enabled = plugins.get("enabled")
    if not isinstance(enabled, list):
        enabled = []
        plugins["enabled"] = enabled
    if "platforms/tlon" not in enabled:
        enabled.append("platforms/tlon")

    gateway = _dict_at(config, "gateway")
    gateway_platforms = _dict_at(gateway, "platforms")
    gateway_tlon = _dict_at(gateway_platforms, "tlon")
    gateway_tlon["enabled"] = True

    platforms = _dict_at(config, "platforms")
    tlon = _dict_at(platforms, "tlon")
    tlon["enabled"] = True

    terminal = _dict_at(config, "terminal")
    terminal["cwd"] = _clean_env(env, "TERMINAL_CWD") or str(
        Path(_clean_env(env, "HERMES_HOME") or "/workspace/hermes-home")
    )

    home_channel = (
        _clean_env(env, "TLON_HOME_CHANNEL")
        or _clean_env(env, "TLON_OWNER_SHIP")
        or _clean_env(env, "TLON_GATEWAY_STATUS_OWNER")
    )
    if home_channel:
        home_channel_config = {
            "platform": "tlon",
            "chat_id": home_channel,
            "name": home_channel,
        }
        tlon["home_channel"] = home_channel_config
        gateway_tlon["home_channel"] = home_channel_config

    model_values = {
        config_key: value
        for env_keys, config_key in MODEL_ENV_FIELDS
        if (value := _first_env(env, env_keys))
    }
    if model_values:
        model_config = _dict_at(config, "model")
        model_config.update(model_values)

    web_backend = _clean_env(env, "HERMES_WEB_BACKEND")
    web_search_backend = _clean_env(env, "HERMES_WEB_SEARCH_BACKEND") or web_backend
    if not web_search_backend and _clean_env(env, "BRAVE_SEARCH_API_KEY"):
        web_search_backend = "brave-free"

    web_extract_backend = _clean_env(env, "HERMES_WEB_EXTRACT_BACKEND")
    if not web_extract_backend and web_backend in {"firecrawl", "parallel", "tavily", "exa"}:
        web_extract_backend = web_backend
    if not web_extract_backend:
        if (
            _clean_env(env, "FIRECRAWL_API_KEY")
            or _clean_env(env, "FIRECRAWL_API_URL")
            or _clean_env(env, "FIRECRAWL_GATEWAY_URL")
            or _clean_env(env, "TOOL_GATEWAY_DOMAIN")
        ):
            web_extract_backend = "firecrawl"
        elif _clean_env(env, "PARALLEL_API_KEY"):
            web_extract_backend = "parallel"
        elif _clean_env(env, "TAVILY_API_KEY"):
            web_extract_backend = "tavily"
        elif _clean_env(env, "EXA_API_KEY"):
            web_extract_backend = "exa"

    if web_search_backend or web_extract_backend:
        web_config = _dict_at(config, "web")
        if web_search_backend:
            web_config["search_backend"] = web_search_backend
        if web_extract_backend:
            web_config["extract_backend"] = web_extract_backend

    return config


def write_config(home: Path, env: Mapping[str, str | None]) -> Path:
    path = home / "config.yaml"
    if path.exists():
        text = path.read_text(encoding="utf-8")
        if yaml is not None:
            config = yaml.safe_load(text) or {}
        else:
            config = json.loads(text)
    else:
        config = {}
    if not isinstance(config, dict):
        config = {}

    rendered = render_config(config, env)
    path.parent.mkdir(parents=True, exist_ok=True)
    if yaml is not None:
        text = yaml.safe_dump(rendered, sort_keys=False)
    else:
        text = json.dumps(rendered, indent=2) + "\n"
    path.write_text(text, encoding="utf-8")
    return path


def main() -> None:
    home = Path(os.environ["HERMES_HOME"])
    write_config(home, os.environ)


if __name__ == "__main__":
    main()

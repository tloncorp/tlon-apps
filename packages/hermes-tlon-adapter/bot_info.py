"""The bot's identity claim, published in its own contact profile.

The adapter tells Tlon clients *who it is* — harness plus versions — and
nothing about what it can do: command lists are app-static, bound to this
package's ``fixtures/commands.json`` by a CI drift contract. Wire contract:
docs/bot-info.md in tlon-apps.

This module has no package-relative imports so it stays importable from any
context, matching commands.py.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Mapping, Optional

logger = logging.getLogger(__name__)

BOT_INFO_CONTACT_KEY = "bot-info"
BOT_INFO_CONTACT_MARK = "contact-action-1"
# Client-side parse ceiling for the raw claim; the backend's 10kB jam cap
# covers the whole profile, so a rejected poke is a real, non-fatal outcome
# regardless.
BOT_INFO_MAX_BYTES = 512

HARNESS = "hermes"


def resolve_harness_version() -> Optional[str]:
    """The Hermes runtime's own version, as a diagnostic rider on the claim.

    Byte-for-byte the source core's own ``/version`` command reads
    (``gateway/slash_commands.py`` -> ``hermes_cli/banner.py`` -> these
    constants), guaranteed importable because the gateway process *is*
    ``hermes_cli``. Both numbers are emitted: the SemVer alone matches nothing
    the pins or the README use, and the CalVer matches the release tag.

    These are version claims, not code-identity claims — the constants bump at
    release-cut, so a build off an unreleased ref reports the last release.

    Returns None when nothing can be sourced; the caller publishes without the
    field rather than withholding the claim. Never shells out to
    ``hermes --version`` and never uses ``git describe`` (production strips
    ``.git``).
    """
    try:
        from hermes_cli import __release_date__, __version__

        version = str(__version__ or "").strip()
        release_date = str(__release_date__ or "").strip()
        if version and release_date:
            return f"{version} ({release_date})"
        # Half the pair is a broken host convention, not a usable value: the
        # SemVer alone is exactly what the distribution fallback yields, so fall
        # through rather than quietly publishing a degraded claim as if it were
        # the preferred one.
        logger.warning(
            "[tlon] hermes_cli version constants incomplete "
            "(__version__=%r, __release_date__=%r); falling back",
            version,
            release_date,
        )
    except Exception as exc:  # pragma: no cover - depends on the host install
        logger.warning("[tlon] could not read hermes_cli version: %s", exc)

    try:
        from importlib.metadata import version as distribution_version

        # SemVer only, and stale under an editable install (dist-info freezes
        # at install time) — a fallback, not a preference.
        fallback = str(distribution_version("hermes-agent") or "").strip()
        if fallback:
            return fallback
    except Exception as exc:  # pragma: no cover - depends on the host install
        logger.warning("[tlon] could not read hermes-agent metadata: %s", exc)

    logger.warning("[tlon] no Hermes version available for the bot info claim")
    return None


def build_bot_info_json(
    version: str, harness_version: Optional[str] = None
) -> str:
    """Serialize the identity claim. Byte-stable (fixed key order, compact
    separators) so compare-before-poke does not false-positive.

    ``harnessVersion`` is omitted when the host reports nothing: the field is a
    diagnostic rider and a missing rider must never invalidate the claim."""
    claim: dict[str, Any] = {"v": 1, "harness": HARNESS, "version": version}
    trimmed = (harness_version or "").strip()
    if trimmed:
        claim["harnessVersion"] = trimmed
    # ensure_ascii=False keeps non-ASCII literal, matching the TS builder's
    # JSON.stringify output and making the byte cap count real UTF-8 bytes
    # rather than \\uXXXX escapes.
    value = json.dumps(claim, separators=(",", ":"), ensure_ascii=False)
    size = len(value.encode("utf-8"))
    if size > BOT_INFO_MAX_BYTES:
        raise ValueError(f"bot info exceeds {BOT_INFO_MAX_BYTES} UTF-8 bytes: {size}")
    return value


def extract_bot_info_value(self_contact: Any) -> Optional[str]:
    """Runtime shape check for the ``bot-info`` field on a self-contact map:
    only a %text field carrying a string is a published claim."""
    if not isinstance(self_contact, Mapping):
        return None
    candidate = self_contact.get(BOT_INFO_CONTACT_KEY)
    if not isinstance(candidate, Mapping):
        return None
    if candidate.get("type") != "text":
        return None
    value = candidate.get("value")
    return value if isinstance(value, str) else None


def build_bot_info_poke(value: Optional[str]) -> dict[str, Any]:
    """The contact-action-1 self poke publishing (or, with None, clearing) the
    claim. Keys die only by explicit null — see docs/bot-info.md for the
    rollback procedure."""
    return {
        "self": {
            BOT_INFO_CONTACT_KEY: None
            if value is None
            else {"type": "text", "value": value}
        }
    }

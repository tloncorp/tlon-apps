"""Runtime version identity for the Hermes Tlon adapter.

Nothing here is generated or checked in; identity is resolved when asked:

- semver from package.json (the human-facing release label)
- git branch/commit/dirty state when the install is a git checkout
- a content fingerprint over the runtime files, which identifies copied
  installs and hand-patched trees that a baked commit constant cannot

This module deliberately has no package-relative imports so the fingerprint
can be recomputed standalone at any checkout:

    python3 -c "import version; print(version.content_fingerprint())"
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
from pathlib import Path
from typing import Optional

FINGERPRINT_RULE = "fp1"
FINGERPRINT_HEX_CHARS = 12
PACKAGE_DIR = Path(__file__).resolve().parent

_COMMAND_RE = re.compile(r"^/tlon-version(?:\s|$)", re.IGNORECASE)


def is_tlon_version_command(text: str) -> bool:
    return bool(_COMMAND_RE.match(str(text or "").strip()))


def plugin_version(package_dir: Path = PACKAGE_DIR) -> str:
    try:
        data = json.loads((package_dir / "package.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return "unknown"
    version = str(data.get("version") or "").strip() if isinstance(data, dict) else ""
    return version or "unknown"


async def _git(package_dir: Path, *args: str) -> Optional[str]:
    try:
        proc = await asyncio.create_subprocess_exec(
            "git",
            "-C",
            str(package_dir),
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
    except (FileNotFoundError, OSError):
        return None
    try:
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        return None
    if proc.returncode != 0:
        return None
    return stdout.decode("utf-8", errors="replace").strip()


async def git_source(package_dir: Path = PACKAGE_DIR) -> Optional[str]:
    """``branch @ shortsha (clean|dirty)``, or None outside a git checkout."""
    sha = await _git(package_dir, "rev-parse", "--short", "HEAD")
    if not sha:
        return None
    branch = await _git(package_dir, "rev-parse", "--abbrev-ref", "HEAD")
    if not branch or branch == "HEAD":
        branch = "detached"
    # Scope dirtiness to this package, not the whole monorepo.
    status = await _git(package_dir, "status", "--porcelain", "--", ".")
    dirty = "dirty" if status else "clean"
    return f"{branch} @ {sha} ({dirty})"


def runtime_files(package_dir: Path = PACKAGE_DIR) -> list[Path]:
    """The files that define runtime behavior, in deterministic order."""
    files = [
        path
        for path in sorted(package_dir.glob("*.py"))
        if not path.name.startswith("test_")
    ]
    plugin_yaml = package_dir / "plugin.yaml"
    if plugin_yaml.is_file():
        files.append(plugin_yaml)
    prompts = package_dir / "prompts"
    if prompts.is_dir():
        files.extend(sorted(path for path in prompts.rglob("*") if path.is_file()))
    return files


def content_fingerprint(package_dir: Path = PACKAGE_DIR) -> str:
    digest = hashlib.sha256()
    for path in runtime_files(package_dir):
        digest.update(path.relative_to(package_dir).as_posix().encode("utf-8"))
        digest.update(b"\x00")
        try:
            digest.update(path.read_bytes())
        except OSError:
            digest.update(b"<unreadable>")
        digest.update(b"\x00")
    return f"{FINGERPRINT_RULE}:{digest.hexdigest()[:FINGERPRINT_HEX_CHARS]}"


def format_version_reply(
    *,
    adapter_version: str,
    source: Optional[str],
    fingerprint: str,
    cli_version: str,
) -> str:
    return "\n".join(
        [
            f"Adapter: {adapter_version}",
            f"Source: {source or 'no git checkout'}",
            f"Fingerprint: {fingerprint}",
            f"Tlon CLI: {cli_version}",
        ]
    )

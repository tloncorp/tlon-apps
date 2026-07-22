"""Dependency-free sanitizers for model-visible Tlon text."""

from __future__ import annotations

import re


BLOCK_DIRECTIVE_RE = re.compile(
    r"\[BLOCK_USER:\s*(~[\w-]+)\s*\|\s*(.+?)\]", re.IGNORECASE | re.DOTALL
)
EXECUTABLE_BLOCK_DIRECTIVE_RE = re.compile(
    r"^[^\S\r\n]*\[BLOCK_USER:\s*(~[\w-]+)\s*\|\s*([^\]]+?)\][^\S\r\n]*$",
    re.IGNORECASE | re.DOTALL | re.MULTILINE,
)
_BLOCK_DIRECTIVE_PREFIX = "[BLOCK_USER:"


def find_block_directives(text: str) -> list[tuple[str, str]]:
    """Return complete block-directive targets and trimmed reasons."""
    return [
        (match.group(1), match.group(2).strip())
        for match in BLOCK_DIRECTIVE_RE.finditer(str(text or ""))
    ]


def find_executable_block_directives(text: str) -> list[tuple[str, str]]:
    """Return block directives that occupy standalone lines."""
    return [
        (match.group(1), match.group(2).strip())
        for match in EXECUTABLE_BLOCK_DIRECTIVE_RE.finditer(str(text or ""))
    ]


def strip_block_directives(text: str) -> str:
    """Remove complete block directives while preserving all other text."""
    return BLOCK_DIRECTIVE_RE.sub("", str(text or ""))


def _incomplete_directive_start(text: str) -> int | None:
    value = str(text or "")
    lowered = value.lower()
    prefix = _BLOCK_DIRECTIVE_PREFIX.lower()
    for index, char in enumerate(lowered):
        if char != "[":
            continue
        suffix = lowered[index:]
        if 0 < len(suffix) < len(prefix) and prefix.startswith(suffix):
            return index
        if suffix.startswith(prefix) and "]" not in suffix:
            return index
    return None


def ends_with_directive_prefix(text: str) -> bool:
    """Whether text ends in a proper or unclosed block-directive prefix."""
    return _incomplete_directive_start(str(text or "")) is not None


def strip_trailing_directive_prefix(text: str) -> tuple[str, bool]:
    """Remove a trailing incomplete block-directive fragment, if present."""
    value = str(text or "")
    start = _incomplete_directive_start(value)
    if start is None:
        return value, False
    return value[:start], True

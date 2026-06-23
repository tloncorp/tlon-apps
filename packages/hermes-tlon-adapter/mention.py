"""Bot wake-word matching for the Hermes Tlon adapter."""

from __future__ import annotations

import re
from typing import Any, Iterable, Pattern

from .tlon_api import bare_ship, normalize_ship


MENTION_END_CHARS = r"\s,!?\.:\;\"'\)\]\}"
LEADING_END_CHARS = r"\s,!?\.:\;-"


def build_bot_mention_terms(
    ship_name: str,
    *,
    aliases: Iterable[str] = (),
    nickname: str | None = None,
) -> tuple[str, ...]:
    terms = [normalize_ship(ship_name), bare_ship(ship_name)]
    terms.extend(str(alias).strip() for alias in aliases if str(alias).strip())
    if nickname and str(nickname).strip():
        terms.append(str(nickname).strip())

    seen: set[str] = set()
    result: list[str] = []
    for term in terms:
        key = term.casefold()
        if term and key not in seen:
            seen.add(key)
            result.append(term)
    return tuple(result)


def extract_profile_nickname(profile: Any) -> str:
    if not isinstance(profile, dict):
        return ""
    nickname = profile.get("nickname")
    if isinstance(nickname, dict):
        value = nickname.get("value")
    else:
        value = nickname
    return str(value or "").strip()


class BotMentionMatcher:
    def __init__(self, terms: Iterable[str]) -> None:
        self.terms = _dedupe_terms(terms)
        self._wake_pattern = _compile_wake_pattern(self.terms)
        self._leading_pattern = _compile_leading_pattern(self.terms)

    def mentioned(self, text: str) -> bool:
        return bool(self._wake_pattern and self._wake_pattern.search(str(text or "")))

    def strip_leading(self, text: str) -> str:
        clean = str(text or "")
        if self._leading_pattern is not None:
            clean = self._leading_pattern.sub("", clean, count=1)
        return clean.strip()


def _dedupe_terms(terms: Iterable[str]) -> tuple[str, ...]:
    seen: set[str] = set()
    result: list[str] = []
    for raw in terms:
        term = str(raw or "").strip()
        key = term.casefold()
        if term and key not in seen:
            seen.add(key)
            result.append(term)
    return tuple(sorted(result, key=len, reverse=True))


def _compile_wake_pattern(terms: tuple[str, ...]) -> Pattern[str] | None:
    if not terms:
        return None
    alternates = "|".join(re.escape(term) for term in terms)
    return re.compile(
        rf"(^|(?<=\s))(?:{alternates})(?=$|[{MENTION_END_CHARS}])",
        re.IGNORECASE,
    )


def _compile_leading_pattern(terms: tuple[str, ...]) -> Pattern[str] | None:
    if not terms:
        return None
    alternates = "|".join(re.escape(term) for term in terms)
    return re.compile(
        rf"^\s*(?:{alternates})(?=$|[{LEADING_END_CHARS}])[{LEADING_END_CHARS}]*",
        re.IGNORECASE,
    )

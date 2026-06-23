"""Deterministic message attention decisions for the Hermes Tlon adapter."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AttentionFacts:
    is_dm: bool
    is_authorized: bool
    has_text: bool
    is_mentioned: bool = False
    is_owner_listen: bool = False
    is_free_response: bool = False
    is_participated_thread: bool = False


@dataclass(frozen=True)
class AttentionDecision:
    action: str
    reason: str

    @property
    def dispatch(self) -> bool:
        return self.action == "dispatch"


def resolve_attention(facts: AttentionFacts) -> AttentionDecision:
    if not facts.is_authorized:
        return AttentionDecision("drop", "unauthorized")
    if not facts.has_text:
        return AttentionDecision("drop", "empty")
    if facts.is_dm:
        return AttentionDecision("dispatch", "dm")
    if facts.is_mentioned:
        return AttentionDecision("dispatch", "mention")
    if facts.is_owner_listen:
        return AttentionDecision("dispatch", "owner-listen")
    if facts.is_free_response:
        return AttentionDecision("dispatch", "free-response")
    if facts.is_participated_thread:
        return AttentionDecision("dispatch", "participated-thread")
    return AttentionDecision("drop", "unaddressed")

"""Which model a Tlon turn is using, how its requests reach it, and whether
they're kept: the note packages/openclaw/src/model-privacy-context.ts gives
an OpenClaw bot. Nothing else in the bot's context says any of this, and a
bot asked otherwise guesses, down to inventing a model service.
"""

from typing import Any, Callable, Optional

ROUTED_PROVIDER = "openrouter"

# Hermes is the bot's software, and a bot asked what powers it otherwise
# names that instead of the model. Hermes adds the note to the user's
# message, not the system prompt as OpenClaw does, and there a bot brought
# it into unrelated answers, so it also says when it applies.
_ASKED = (
    " When asked what model or company you run on, whether you are connected "
    "to OpenAI or any other AI company, or whether the AI company keeps or "
    "trains on what people say, answer from this note: name the model, the "
    "route and whether zero data retention is on. Otherwise leave it out of "
    "your reply. Hermes is the software you run in, not a model service."
)

# The note answers only for the provider, and a bot asked about retention
# would otherwise answer from it alone and leave Tlon's side out.
_TLON_SIDE = (
    " That covers the model provider only: for Tlon's side, read the privacy "
    'page of skill_view("tlon-platform:tlon-product-guide").'
)


def model_privacy_note(
    provider: Optional[str], model: Optional[str], *, product_guide: bool
) -> Optional[str]:
    if not provider or not model:
        return None
    tlon_side = _TLON_SIDE if product_guide else ""
    if provider != ROUTED_PROVIDER:
        return (
            f"Model: you're running {model}, with requests sent to {provider} "
            "directly under that provider's own data policy. Zero data "
            "retention settings only apply to models routed through "
            "OpenRouter." + _ASKED + tlon_side
        )
    # Hermes can't ask OpenRouter for zero data retention: its
    # provider_routing passes only, ignore, order, sort, require_parameters
    # and data_collection, and no `zdr`. So no Hermes bot's requests have it.
    return (
        f"Model: you're running {model}, routed through OpenRouter. Zero data "
        "retention is off: OpenRouter routes each request to a company serving "
        "the model, which may keep it under its own policy." + _ASKED + tlon_side
    )


def configured_model_provider() -> Optional[str]:
    from hermes_cli.config import load_config  # type: ignore

    model = load_config().get("model")
    provider = model.get("provider") if isinstance(model, dict) else None
    return str(provider) if provider else None


def make_pre_llm_call_model_note(
    *,
    product_guide: bool,
    provider: Callable[[], Optional[str]] = configured_model_provider,
) -> Callable[..., Optional[dict]]:
    def handle(**kwargs: Any) -> Optional[dict]:
        if kwargs.get("platform") != "tlon":
            return None
        note = model_privacy_note(
            provider(), kwargs.get("model"), product_guide=product_guide
        )
        return {"context": note} if note else None

    return handle

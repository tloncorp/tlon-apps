import importlib.util
import unittest
from pathlib import Path


spec = importlib.util.spec_from_file_location(
    "hermes_tlon_model_note", Path(__file__).parent / "model_note.py"
)
model_note = importlib.util.module_from_spec(spec)
spec.loader.exec_module(model_note)


def hook(provider, *, product_guide=True):
    return model_note.make_pre_llm_call_model_note(
        product_guide=product_guide, provider=lambda: provider
    )


class ModelNoteTests(unittest.TestCase):
    def test_openrouter_names_model_route_and_zdr_off(self):
        result = hook("openrouter")(platform="tlon", model="openai/gpt-5.6-luna")

        note = result["context"]
        self.assertIn("you're running openai/gpt-5.6-luna, routed through OpenRouter", note)
        self.assertIn("Zero data retention is off", note)
        self.assertIn("not a model service", note)
        self.assertIn('skill_view("tlon-platform:tlon-product-guide")', note)

    def test_direct_provider_names_its_policy(self):
        note = hook("anthropic")(platform="tlon", model="claude-opus-5-5")["context"]

        self.assertIn("with requests sent to anthropic directly", note)
        self.assertNotIn("Zero data retention is off", note)

    def test_only_tlon_turns_get_the_note(self):
        self.assertIsNone(hook("openrouter")(platform="cron", model="openai/gpt-5.6-luna"))

    def test_no_guide_pointer_without_the_guide(self):
        note = hook("openrouter", product_guide=False)(
            platform="tlon", model="openai/gpt-5.6-luna"
        )["context"]

        self.assertNotIn("tlon-product-guide", note)

    def test_no_note_without_a_model(self):
        self.assertIsNone(hook("openrouter")(platform="tlon", model=""))


if __name__ == "__main__":
    unittest.main()

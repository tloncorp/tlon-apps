import importlib.util
import unittest
from pathlib import Path


spec = importlib.util.spec_from_file_location(
    "hermes_tlon_model_note", Path(__file__).parent / "model_note.py"
)
model_note = importlib.util.module_from_spec(spec)
spec.loader.exec_module(model_note)


def note(provider, model="openai/gpt-5.6-luna", *, product_guide=True):
    return model_note.configured_model_note(
        product_guide=product_guide, configured=lambda: (provider, model)
    )


class ModelNoteTests(unittest.TestCase):
    def test_openrouter_names_model_route_and_zdr_off(self):
        text = note("openrouter")

        self.assertIn("you're running openai/gpt-5.6-luna, routed through OpenRouter", text)
        self.assertIn("Zero data retention is off", text)
        self.assertIn("not a model service", text)
        self.assertIn('skill_view("tlon-platform:tlon-product-guide")', text)

    def test_direct_provider_names_its_policy(self):
        text = note("anthropic", "claude-opus-5-5")

        self.assertIn("with requests sent to anthropic directly", text)
        self.assertNotIn("Zero data retention is off", text)

    def test_no_guide_pointer_without_the_guide(self):
        self.assertNotIn("tlon-product-guide", note("openrouter", product_guide=False))

    def test_no_note_without_a_configured_model(self):
        self.assertEqual(note("openrouter", None), "")
        self.assertEqual(note(None), "")

if __name__ == "__main__":
    unittest.main()

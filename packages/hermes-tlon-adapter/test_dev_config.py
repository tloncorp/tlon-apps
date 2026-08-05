import json
import tempfile
import unittest
from pathlib import Path

from dev import write_config as config_writer


def read_config(path):
    text = path.read_text(encoding="utf-8")
    if config_writer.yaml is not None:
        return config_writer.yaml.safe_load(text)
    return json.loads(text)


class HermesDevConfigTests(unittest.TestCase):
    def test_writes_fake_model_chat_completions_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)

            config_writer.write_config(
                home,
                {
                    "HERMES_HOME": str(home),
                    "TERMINAL_CWD": str(home),
                    "TLON_OWNER_SHIP": "~ten",
                    "HERMES_MODEL_PROVIDER": "custom",
                    "HERMES_MODEL": "tlon-test-scripted",
                    "HERMES_MODEL_BASE_URL": "http://fake-model:4000/v1",
                    "HERMES_MODEL_API_KEY": "no-key-required",
                    "HERMES_MODEL_API_MODE": "chat_completions",
                },
            )

            config = read_config(home / "config.yaml")

        self.assertEqual(
            config["model"],
            {
                "provider": "custom",
                "default": "tlon-test-scripted",
                "base_url": "http://fake-model:4000/v1",
                "api_key": "no-key-required",
                "api_mode": "chat_completions",
            },
        )
        self.assertIn("platforms/tlon", config["plugins"]["enabled"])
        self.assertTrue(config["platforms"]["tlon"]["enabled"])
        self.assertEqual(config["platforms"]["tlon"]["home_channel"]["chat_id"], "~ten")
        self.assertTrue(config["gateway"]["platforms"]["tlon"]["enabled"])

    def test_keeps_legacy_model_aliases(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)

            config_writer.write_config(
                home,
                {
                    "HERMES_HOME": str(home),
                    "HERMES_PROVIDER": "openrouter",
                    "MODEL": "nous/hermes-test",
                },
            )

            config = read_config(home / "config.yaml")

        self.assertEqual(config["model"]["provider"], "openrouter")
        self.assertEqual(config["model"]["default"], "nous/hermes-test")

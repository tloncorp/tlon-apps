import json
import tempfile
import unittest
from pathlib import Path

from dev.e2e import write_config


def read_config(path):
    text = path.read_text(encoding="utf-8")
    if write_config.yaml is not None:
        return write_config.yaml.safe_load(text)
    return json.loads(text)


class HermesE2EConfigTests(unittest.TestCase):
    def test_writes_fresh_fake_model_baseline_config(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            stale = home / "config.yaml"
            stale.write_text(
                "model:\n  provider: openrouter\nweb:\n  search_backend: brave-free\n",
                encoding="utf-8",
            )

            write_config.write_config(
                home,
                {
                    "HERMES_HOME": str(home),
                    "TERMINAL_CWD": str(home),
                    "TLON_HOME_CHANNEL": "~ten",
                    "HERMES_MODEL_PROVIDER": "custom",
                    "HERMES_MODEL": "tlon-test-scripted",
                    "HERMES_MODEL_BASE_URL": "http://fake-model:4000/v1",
                    "HERMES_MODEL_API_KEY": "no-key-required",
                    "HERMES_MODEL_API_MODE": "chat_completions",
                    "TLON_KNOWN_BOT_USERS": "~mug",
                    "TLON_MAX_CONSECUTIVE_BOT_RESPONSES": "2",
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
        self.assertNotIn("web", config)
        self.assertEqual(config["platform_toolsets"]["tlon"], ["tlon", "no_mcp"])
        self.assertEqual(config["mcp_servers"], {})
        self.assertIn("cronjob", config["agent"]["disabled_toolsets"])
        self.assertEqual(config["tlon"]["known_bot_users"], "~mug")
        self.assertEqual(config["tlon"]["max_consecutive_bot_responses"], 2)
        self.assertEqual(config["platforms"]["tlon"]["home_channel"]["chat_id"], "~ten")

    def test_loop_cap_default_is_three(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            write_config.write_config(
                home,
                {
                    "HERMES_HOME": str(home),
                    "TERMINAL_CWD": str(home),
                    "TLON_HOME_CHANNEL": "~ten",
                    "HERMES_MODEL_PROVIDER": "custom",
                    "HERMES_MODEL": "tlon-test-scripted",
                    "HERMES_MODEL_BASE_URL": "http://fake-model:4000/v1",
                    "HERMES_MODEL_API_KEY": "no-key-required",
                    "HERMES_MODEL_API_MODE": "chat_completions",
                },
            )

            config = read_config(home / "config.yaml")

        self.assertEqual(config["tlon"]["max_consecutive_bot_responses"], 3)

    def test_enables_cronjob_for_cron_partition(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            config = write_config.render_config(
                {
                    "HERMES_HOME": str(home),
                    "TLON_HOME_CHANNEL": "~ten",
                    "HERMES_E2E_ENABLE_CRONJOB": "1",
                }
            )

        self.assertEqual(
            config["platform_toolsets"]["tlon"],
            ["tlon", "cronjob", "no_mcp"],
        )
        self.assertNotIn("cronjob", config["agent"]["disabled_toolsets"])

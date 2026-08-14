import asyncio
import importlib.util
import json
import sys
import time
import types
import unittest
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).with_name("tlon_api.py")
SPEC = importlib.util.spec_from_file_location("hermes_tlon_adapter_tlon_api", MODULE_PATH)
tlon_api = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = tlon_api
SPEC.loader.exec_module(tlon_api)


class TlonConfigTests(unittest.TestCase):
    def test_from_env_accepts_hermes_names_and_seeds_cli_aliases(self):
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network/",
                "TLON_NODE_ID": "zod",
                "TLON_ACCESS_CODE": "code",
                "TLON_CHANNELS": "chat/~zod/general, heap/~zod/links",
                "TLON_ALLOWED_USERS": "bus,~nec",
                "TLON_AUTO_DISCOVER": "true",
                "TLON_CLI": "/tmp/tlon",
            }
        )

        self.assertEqual(cfg.ship_url, "https://zod.tlon.network")
        self.assertEqual(cfg.ship_name, "~zod")
        self.assertEqual(cfg.channels, ("chat/~zod/general", "heap/~zod/links"))
        self.assertEqual(cfg.allowed_users, frozenset({"~bus", "~nec"}))
        self.assertTrue(cfg.auto_discover)

        env = cfg.cli_env(base={})
        self.assertEqual(env["TLON_NODE_URL"], "https://zod.tlon.network")
        self.assertEqual(env["TLON_NODE_ID"], "~zod")
        self.assertEqual(env["TLON_ACCESS_CODE"], "code")
        self.assertEqual(env["TLON_SHIP_URL"], "https://zod.tlon.network")
        self.assertEqual(env["TLON_SHIP_NAME"], "~zod")
        self.assertEqual(env["TLON_SHIP_CODE"], "code")
        self.assertEqual(env["TLON_URL"], "https://zod.tlon.network")
        self.assertEqual(env["URBIT_URL"], "https://zod.tlon.network")
        self.assertEqual(env["TLON_SHIP"], "~zod")
        self.assertEqual(env["URBIT_SHIP"], "~zod")
        self.assertEqual(env["TLON_CODE"], "code")
        self.assertEqual(env["URBIT_CODE"], "code")

    def test_cli_env_scrubs_config_file_and_preserves_unrelated_base_value(self):
        cfg = tlon_api.TlonConfig(
            ship_url="https://zod.tlon.network",
            ship_name="~zod",
            ship_code="code",
        )

        env = cfg.cli_env(
            base={
                "TLON_CONFIG_FILE": "/tmp/hostile-config.json",
                "UNRELATED_ENV": "preserved",
            }
        )

        self.assertNotIn("TLON_CONFIG_FILE", env)
        self.assertEqual(env["UNRELATED_ENV"], "preserved")

    def test_cli_env_scrubs_stale_cookies_for_code_auth(self):
        cfg = tlon_api.TlonConfig(
            ship_url="https://zod.tlon.network",
            ship_name="~zod",
            ship_code="code",
        )

        env = cfg.cli_env(
            base={
                "URBIT_COOKIE": "stale-urbit-cookie",
                "TLON_COOKIE": "stale-tlon-cookie",
            }
        )

        self.assertTrue({"URBIT_COOKIE", "TLON_COOKIE"}.isdisjoint(env))

    def test_cli_env_reinjects_config_cookie_after_scrubbing_base(self):
        cfg = tlon_api.TlonConfig(
            ship_url="https://zod.tlon.network",
            ship_name="~zod",
            cookie="config-cookie",
        )

        env = cfg.cli_env(
            base={
                "TLON_CONFIG_FILE": "/tmp/hostile-config.json",
                "URBIT_COOKIE": "stale-urbit-cookie",
                "TLON_COOKIE": "stale-tlon-cookie",
            }
        )

        self.assertNotIn("TLON_CONFIG_FILE", env)
        self.assertEqual(
            (env.get("URBIT_COOKIE"), env.get("TLON_COOKIE")),
            ("config-cookie", "config-cookie"),
        )

    def test_cli_env_scrubs_stale_code_for_cookie_only_auth(self):
        cfg = tlon_api.TlonConfig(
            ship_url="https://zod.tlon.network",
            ship_name="~zod",
            cookie="config-cookie",
        )

        env = cfg.cli_env(
            base={
                "TLON_CODE": "stale-tlon-code",
                "URBIT_CODE": "stale-urbit-code",
            }
        )

        self.assertTrue({"TLON_CODE", "URBIT_CODE"}.isdisjoint(env))

    def test_cli_env_scrubs_stale_url_and_ship_when_config_omits_them(self):
        cfg = tlon_api.TlonConfig(
            ship_url="",
            ship_name="",
            cookie="config-cookie",
        )

        env = cfg.cli_env(
            base={
                "URBIT_URL": "https://stale.tlon.network",
                "URBIT_SHIP": "~stale",
            }
        )

        self.assertTrue({"URBIT_URL", "URBIT_SHIP"}.isdisjoint(env))

    def test_cli_env_scrubs_before_injecting_all_config_values(self):
        cfg = tlon_api.TlonConfig(
            ship_url="https://zod.tlon.network",
            ship_name="~zod",
            ship_code="code",
            hosting=True,
        )
        expected = {
            "TLON_NODE_URL": "https://zod.tlon.network",
            "TLON_SHIP_URL": "https://zod.tlon.network",
            "TLON_URL": "https://zod.tlon.network",
            "URBIT_URL": "https://zod.tlon.network",
            "TLON_NODE_ID": "~zod",
            "TLON_SHIP_NAME": "~zod",
            "TLON_SHIP": "~zod",
            "URBIT_SHIP": "~zod",
            "TLON_ACCESS_CODE": "code",
            "TLON_SHIP_CODE": "code",
            "TLON_CODE": "code",
            "URBIT_CODE": "code",
            "TLON_HOSTING": "true",
        }

        env = cfg.cli_env(
            base={
                "TLON_CONFIG_FILE": "/tmp/hostile-config.json",
                "URBIT_COOKIE": "stale-urbit-cookie",
                "TLON_COOKIE": "stale-tlon-cookie",
                "TLON_URL": "https://nec.tlon.network",
                "URBIT_URL": "https://bus.tlon.network",
                "TLON_SHIP": "~nec",
                "URBIT_SHIP": "~bus",
                "TLON_CODE": "stale-code",
                "URBIT_CODE": "stale-urbit-code",
            }
        )

        self.assertEqual({key: env.get(key) for key in expected}, expected)
        self.assertNotIn("TLON_CONFIG_FILE", env)

    def test_from_env_accepts_openclaw_style_aliases(self):
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_URL": "http://host.docker.internal:8080",
                "TLON_SHIP": "~pen",
                "TLON_CODE": "code",
            }
        )

        self.assertTrue(cfg.is_complete())
        self.assertEqual(cfg.ship_url, "http://host.docker.internal:8080")
        self.assertEqual(cfg.ship_name, "~pen")
        self.assertEqual(cfg.ship_code, "code")

    def test_blank_ship_env_is_treated_as_unset(self):
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_URL": "http://host.docker.internal:8080",
                "TLON_CODE": "code",
                "TLON_SHIP": "   ",
            }
        )

        self.assertEqual(cfg.ship_name, "")
        self.assertFalse(cfg.is_complete())
        self.assertNotIn("TLON_SHIP", cfg.cli_env(base={}))

    def test_ship_env_is_trimmed_before_normalization(self):
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_URL": "http://host.docker.internal:8080",
                "TLON_CODE": "code",
                "TLON_SHIP": "  ~zod  ",
            }
        )

        self.assertEqual(cfg.ship_name, "~zod")
        self.assertTrue(cfg.is_complete())
        self.assertEqual(cfg.cli_env(base={})["TLON_SHIP"], "~zod")

    def test_blank_ship_extra_is_treated_as_unset(self):
        cfg = tlon_api.TlonConfig.from_env(
            extra={
                "url": "http://host.docker.internal:8080",
                "code": "code",
                "ship": "   ",
            },
            env={},
        )

        self.assertEqual(cfg.ship_name, "")
        self.assertFalse(cfg.is_complete())
        self.assertNotIn("TLON_SHIP", cfg.cli_env(base={}))

    def test_blank_owner_fields_are_treated_as_unset(self):
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_OWNER_SHIP": "  ",
                "TLON_GATEWAY_STATUS_OWNER": "   ",
                "TLON_CONTEXT_LENS_OWNER": " ",
            }
        )

        self.assertEqual(cfg.owner_ship, "")
        self.assertEqual(cfg.gateway_status_owner, "")
        self.assertEqual(cfg.context_lens_owner, "")

    def test_allowed_users_csv_drops_blank_entries(self):
        cfg = tlon_api.TlonConfig.from_env(
            env={"TLON_ALLOWED_USERS": "~zod, ,~ten,  "}
        )

        self.assertEqual(cfg.allowed_users, frozenset({"~zod", "~ten"}))

    def test_blank_high_priority_ship_alias_falls_through(self):
        cfg = tlon_api.TlonConfig.from_env(
            env={"TLON_NODE_ID": "  ", "TLON_SHIP": "~ten"}
        )

        self.assertEqual(cfg.ship_name, "~ten")

    def test_extra_config_is_used_when_env_is_empty(self):
        cfg = tlon_api.TlonConfig.from_env(
            extra={
                "node_url": "https://bus.tlon.network",
                "node_id": "~bus",
                "access_code": "code",
                "channels": ["chat/~bus/general"],
            },
            env={},
        )
        self.assertTrue(cfg.is_complete())
        self.assertEqual(cfg.channels, ("chat/~bus/general",))

    def test_hosting_defaults_off_and_is_not_injected(self):
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
            }
        )
        self.assertFalse(cfg.hosting)
        self.assertNotIn("TLON_HOSTING", cfg.cli_env(base={}))

    def test_hosting_opt_in_via_env_is_injected(self):
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
                "TLON_HOSTING": "true",
            }
        )
        self.assertTrue(cfg.hosting)
        # carried explicitly into the subprocess env, independent of os.environ
        self.assertEqual(cfg.cli_env(base={})["TLON_HOSTING"], "true")

    def test_hosting_opt_in_via_extra_config(self):
        cfg = tlon_api.TlonConfig.from_env(
            extra={
                "node_url": "https://bus.tlon.network",
                "node_id": "~bus",
                "access_code": "code",
                "hosting": True,
            },
            env={},
        )
        self.assertTrue(cfg.hosting)
        self.assertEqual(cfg.cli_env(base={})["TLON_HOSTING"], "true")

    def test_from_env_accepts_sse_read_timeout(self):
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
                "TLON_SSE_READ_TIMEOUT_SECONDS": "12.5",
            }
        )

        self.assertEqual(cfg.sse_read_timeout_seconds, 12.5)

    def test_from_env_accepts_sse_watchdog_knobs(self):
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
                "TLON_SSE_STALE_THRESHOLD_SECONDS": "120",
                "TLON_SSE_WATCHDOG_INTERVAL_SECONDS": "15",
            }
        )

        self.assertEqual(cfg.sse_stale_threshold_seconds, 120.0)
        self.assertEqual(cfg.sse_watchdog_interval_seconds, 15.0)

        extra_cfg = tlon_api.TlonConfig.from_env(
            extra={
                "node_url": "https://zod.tlon.network",
                "node_id": "~zod",
                "access_code": "code",
                "sse_stale_threshold_seconds": 90.0,
                "sse_watchdog_interval_seconds": 10.0,
            },
            env={},
        )
        self.assertEqual(extra_cfg.sse_stale_threshold_seconds, 90.0)
        self.assertEqual(extra_cfg.sse_watchdog_interval_seconds, 10.0)

        default_cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
            }
        )
        self.assertEqual(
            default_cfg.sse_stale_threshold_seconds,
            tlon_api.DEFAULT_SSE_STALE_THRESHOLD_SECONDS,
        )
        self.assertEqual(
            default_cfg.sse_watchdog_interval_seconds,
            tlon_api.DEFAULT_SSE_WATCHDOG_INTERVAL_SECONDS,
        )

    def test_sse_watchdog_knobs_reject_invalid_values(self):
        required = {
            "TLON_NODE_URL": "https://zod.tlon.network",
            "TLON_NODE_ID": "~zod",
            "TLON_ACCESS_CODE": "code",
        }
        max_seconds = tlon_api.MAX_SSE_SECONDS
        invalid = (
            "",
            "garbage",
            "nan",
            "inf",
            "-inf",
            "Infinity",
            "-5",
            "-0",
            "-0.0",
            "1e300",
            str(max_seconds + 1),
        )
        for value in invalid:
            with self.subTest(value=value):
                cfg = tlon_api.TlonConfig.from_env(
                    env={
                        **required,
                        "TLON_SSE_STALE_THRESHOLD_SECONDS": value,
                        "TLON_SSE_WATCHDOG_INTERVAL_SECONDS": value,
                    }
                )
                self.assertEqual(
                    cfg.sse_stale_threshold_seconds,
                    tlon_api.DEFAULT_SSE_STALE_THRESHOLD_SECONDS,
                )
                self.assertEqual(
                    cfg.sse_watchdog_interval_seconds,
                    tlon_api.DEFAULT_SSE_WATCHDOG_INTERVAL_SECONDS,
                )

        # The boundary itself is accepted.
        boundary = tlon_api.TlonConfig.from_env(
            env={
                **required,
                "TLON_SSE_STALE_THRESHOLD_SECONDS": str(max_seconds),
                "TLON_SSE_WATCHDOG_INTERVAL_SECONDS": str(max_seconds),
            }
        )
        self.assertEqual(boundary.sse_stale_threshold_seconds, max_seconds)
        self.assertEqual(boundary.sse_watchdog_interval_seconds, max_seconds)

    def test_sse_watchdog_interval_rejects_zero_and_sub_minimum(self):
        required = {
            "TLON_NODE_URL": "https://zod.tlon.network",
            "TLON_NODE_ID": "~zod",
            "TLON_ACCESS_CODE": "code",
        }
        # The interval has no disable spelling; a sub-second tick would spin
        # the watchdog loop.
        for value in ("0", "0.5", "1e-300"):
            with self.subTest(value=value):
                cfg = tlon_api.TlonConfig.from_env(
                    env={**required, "TLON_SSE_WATCHDOG_INTERVAL_SECONDS": value}
                )
                self.assertEqual(
                    cfg.sse_watchdog_interval_seconds,
                    tlon_api.DEFAULT_SSE_WATCHDOG_INTERVAL_SECONDS,
                )

    def test_sse_stale_threshold_disable_is_strict_literal_zero(self):
        required = {
            "TLON_NODE_URL": "https://zod.tlon.network",
            "TLON_NODE_ID": "~zod",
            "TLON_ACCESS_CODE": "code",
        }
        disabled = tlon_api.TlonConfig.from_env(
            env={**required, "TLON_SSE_STALE_THRESHOLD_SECONDS": "0"}
        )
        self.assertEqual(disabled.sse_stale_threshold_seconds, 0.0)
        stripped = tlon_api.TlonConfig.from_env(
            env={**required, "TLON_SSE_STALE_THRESHOLD_SECONDS": " 0 "}
        )
        self.assertEqual(stripped.sse_stale_threshold_seconds, 0.0)

        # Every other zero spelling falls back to the default — including
        # underflow, which Python silently parses to 0.0.
        for value in ("0.0", "00", "1e-9999"):
            with self.subTest(value=value):
                cfg = tlon_api.TlonConfig.from_env(
                    env={**required, "TLON_SSE_STALE_THRESHOLD_SECONDS": value}
                )
                self.assertEqual(
                    cfg.sse_stale_threshold_seconds,
                    tlon_api.DEFAULT_SSE_STALE_THRESHOLD_SECONDS,
                )

    def test_sse_read_timeout_rejects_infinite_and_above_bound(self):
        required = {
            "TLON_NODE_URL": "https://zod.tlon.network",
            "TLON_NODE_ID": "~zod",
            "TLON_ACCESS_CODE": "code",
        }
        # Sub-second values (including underflow spellings) would tear the
        # stream down in a reconnect loop and fall back to the default too.
        for value in ("inf", "Infinity", "1e309", "999999999", "1e300", "0.5", "1e-300"):
            with self.subTest(value=value):
                cfg = tlon_api.TlonConfig.from_env(
                    env={**required, "TLON_SSE_READ_TIMEOUT_SECONDS": value}
                )
                self.assertEqual(
                    cfg.sse_read_timeout_seconds,
                    tlon_api.DEFAULT_SSE_READ_TIMEOUT_SECONDS,
                )

        boundary = tlon_api.TlonConfig.from_env(
            env={
                **required,
                "TLON_SSE_READ_TIMEOUT_SECONDS": str(tlon_api.MAX_SSE_SECONDS),
            }
        )
        self.assertEqual(boundary.sse_read_timeout_seconds, tlon_api.MAX_SSE_SECONDS)

    def test_non_finite_nudge_tick_interval_falls_back_to_default(self):
        required = {
            "TLON_NODE_URL": "https://zod.tlon.network",
            "TLON_NODE_ID": "~zod",
            "TLON_ACCESS_CODE": "code",
        }
        for interval in ("Infinity", "1e309"):
            with self.subTest(interval=interval):
                cfg = tlon_api.TlonConfig.from_env(
                    env={**required, "TLON_NUDGE_TICK_INTERVAL_MS": interval}
                )
                self.assertEqual(
                    cfg.nudge_tick_interval_ms,
                    tlon_api.DEFAULT_NUDGE_TICK_INTERVAL_MS,
                )

    def test_from_env_accepts_attention_and_loop_settings(self):
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
                "TLON_FREE_RESPONSE_CHANNELS": "chat/~zod/general",
                "TLON_REQUIRE_MENTION": "false",
                "TLON_KNOWN_BOT_USERS": "~bot,other-bot",
                "TLON_MAX_CONSECUTIVE_BOT_RESPONSES": "3",
            }
        )

        self.assertEqual(cfg.free_response_channels, ("chat/~zod/general",))
        self.assertFalse(cfg.require_mention)
        self.assertEqual(cfg.known_bot_users, frozenset({"~bot", "~other-bot"}))
        self.assertEqual(cfg.max_consecutive_bot_responses, 3)

    def test_loop_cap_defaults_to_three_and_allows_zero(self):
        required = {
            "node_url": "https://zod.tlon.network",
            "node_id": "~zod",
            "access_code": "code",
        }

        default_cfg = tlon_api.TlonConfig.from_env(extra=required, env={})
        env_zero = tlon_api.TlonConfig.from_env(
            extra=required,
            env={"TLON_MAX_CONSECUTIVE_BOT_RESPONSES": "0"},
        )
        extra_zero = tlon_api.TlonConfig.from_env(
            extra={**required, "max_consecutive_bot_responses": 0},
            env={},
        )

        self.assertEqual(default_cfg.max_consecutive_bot_responses, 3)
        self.assertEqual(env_zero.max_consecutive_bot_responses, 0)
        self.assertEqual(extra_zero.max_consecutive_bot_responses, 0)

    def test_loop_cap_rejects_fractional_values(self):
        required = {
            "node_url": "https://zod.tlon.network",
            "node_id": "~zod",
            "access_code": "code",
        }

        # "0.5" must not truncate to the 0 = unlimited sentinel.
        env_fraction = tlon_api.TlonConfig.from_env(
            extra=required,
            env={"TLON_MAX_CONSECUTIVE_BOT_RESPONSES": "0.5"},
        )
        extra_fraction = tlon_api.TlonConfig.from_env(
            extra={**required, "max_consecutive_bot_responses": 2.5},
            env={},
        )

        self.assertEqual(env_fraction.max_consecutive_bot_responses, 3)
        self.assertEqual(extra_fraction.max_consecutive_bot_responses, 3)

    def test_dm_allowlist_is_additive_and_free_response_is_guarded(self):
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
                "TLON_DM_ALLOWLIST": "~mug",
                "TLON_FREE_RESPONSE_CHANNELS": "chat/~zod/general",
                "TLON_REQUIRE_MENTION": "false",
            }
        )

        self.assertTrue(cfg.user_allowed("~mug", is_dm=True))
        self.assertFalse(cfg.user_allowed("~mug", is_dm=False))
        self.assertFalse(cfg.group_free_response_enabled("chat/~zod/general"))

        allowed_cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
                "TLON_ALLOWED_USERS": "~mug",
                "TLON_FREE_RESPONSE_CHANNELS": "chat/~zod/general",
            }
        )
        self.assertTrue(allowed_cfg.group_free_response_enabled("chat/~zod/general"))

        owner_cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
                "TLON_OWNER_SHIP": "~mug",
                "TLON_FREE_RESPONSE_CHANNELS": "chat/~zod/general",
            }
        )
        self.assertTrue(owner_cfg.user_allowed("~mug", is_dm=True))
        self.assertTrue(owner_cfg.user_allowed("~mug", is_dm=False))
        self.assertTrue(owner_cfg.group_free_response_enabled("chat/~zod/general"))

    def test_default_home_channel_requires_explicit_home_or_owner(self):
        explicit = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
                "TLON_HOME_CHANNEL": "chat/~zod/home",
                "TLON_OWNER_SHIP": "~mug",
                "TLON_CHANNELS": "chat/~zod/general",
            }
        )
        owner = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
                "TLON_OWNER_SHIP": "~mug",
                "TLON_ALLOWED_USERS": "~mug",
                "TLON_CHANNELS": "chat/~zod/general",
            }
        )
        allowlist_only = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
                "TLON_ALLOWED_USERS": "~mug",
                "TLON_CHANNELS": "chat/~zod/general",
            }
        )

        self.assertEqual(explicit.default_home_channel_id(), "chat/~zod/home")
        self.assertEqual(owner.default_home_channel_id(), "~mug")
        self.assertEqual(allowlist_only.default_home_channel_id(), "")


class FakeClientTimeout:
    def __init__(self, *, total=None, sock_read=None, connect=None):
        self.total = total
        self.sock_read = sock_read
        self.connect = connect


class FakeSSEContent:
    def __init__(self, chunks, block_event=None):
        self.chunks = chunks
        self.block_event = block_event

    async def iter_any(self):
        for chunk in self.chunks:
            yield chunk
        if self.block_event is not None:
            await self.block_event.wait()


class FakeSSEResponse:
    def __init__(self, chunks, status=200, block_event=None, text_error=None):
        self.status = status
        self.content = FakeSSEContent(chunks, block_event=block_event)
        self.entered = False
        self.released = False
        self._text_error = text_error

    async def __aenter__(self):
        self.entered = True
        return self

    async def __aexit__(self, exc_type, exc, tb):
        self.released = True
        return False

    async def text(self):
        if self._text_error is not None:
            raise self._text_error
        return ""


class FakeSSESession:
    def __init__(self, chunks=None, responses=None, block_event=None, text_error=None):
        self.chunks = chunks
        self.responses = responses or []
        self.timeout = None
        self.get_calls = []
        self.last_response = None
        self.block_event = block_event
        self.text_error = text_error

    def get(self, url, *, headers, timeout):
        self.timeout = timeout
        self.get_calls.append({"url": url, "headers": headers, "timeout": timeout})
        if self.responses:
            status, chunks = self.responses.pop(0)
            resp = FakeSSEResponse(
                chunks,
                status=status,
                block_event=self.block_event,
                text_error=self.text_error,
            )
        else:
            resp = FakeSSEResponse(
                self.chunks or [],
                block_event=self.block_event,
                text_error=self.text_error,
            )
        self.last_response = resp
        return resp


class FakeActionResponse:
    def __init__(self, status=204, text="", text_error=None):
        self.status = status
        self._text = text
        self._text_error = text_error

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def text(self):
        if self._text_error is not None:
            raise self._text_error
        return self._text


class FakeActionSession:
    def __init__(self, status=204, text_error=None):
        self.put_calls = []
        self.status = status
        self.text_error = text_error

    def put(self, url, *, json, headers, timeout):
        self.put_calls.append(
            {
                "url": url,
                "json": json,
                "headers": headers,
                "timeout": timeout,
            }
        )
        return FakeActionResponse(
            self.status, "action rejected", text_error=self.text_error
        )

    async def close(self):
        pass


class FakeScryResponse:
    status = 200

    def __init__(self, payload):
        self.payload = payload

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def json(self):
        return self.payload

    async def text(self):
        return ""


class FakeScrySession:
    def __init__(self, payload):
        self.payload = payload
        self.get_calls = []

    def get(self, url, *, timeout):
        self.get_calls.append({"url": url, "timeout": timeout})
        return FakeScryResponse(self.payload)

    async def close(self):
        pass


class FakeCloseSession:
    def __init__(self):
        self.closed = False
        self.put_calls = 0
        self.delete_calls = 0

    def put(self, *args, **kwargs):
        self.put_calls += 1
        raise AssertionError("non-graceful close should not PUT channel actions")

    def delete(self, *args, **kwargs):
        self.delete_calls += 1
        raise AssertionError("non-graceful close should not DELETE the channel")

    async def close(self):
        self.closed = True


def sse_frame(event_id, data):
    return f"id: {event_id}\ndata: {json.dumps(data)}\n\n".encode()


class FakeChannelGeneration:
    def __init__(self):
        self.next_event_id = 0
        self.buffered = []


class FakeHandshakeSSEResponse(FakeSSEResponse):
    """A 200 SSE response whose __aenter__ hook runs between the get() issue
    and the status read — the GET-handshake window."""

    def __init__(self, chunks, *, on_enter=None):
        super().__init__(chunks, status=200)
        self._on_enter = on_enter

    async def __aenter__(self):
        if self._on_enter is not None:
            await self._on_enter()
        return await super().__aenter__()


class FakeChannelSession:
    """A stateful fake Eyre: PUT and GET share per-channel-URL state (a
    generation counter plus a pending-response script), and a PUT to a reaped
    or unknown channel re-creates it with the counter restarted — so causal
    races (an ack completing mid-GET-handshake, a setup PUT reviving a reaped
    channel) can be expressed as sequences rather than hand-scripted frames.
    Not a full Eyre simulator."""

    def __init__(self):
        self.generations = {}
        self.reaped = set()
        self.get_calls = []
        self.put_calls = []
        self.put_status = 204
        self.on_get_enter = None

    def generation(self, url):
        gen = self.generations.get(url)
        if gen is None or url in self.reaped:
            self.reaped.discard(url)
            gen = FakeChannelGeneration()
            self.generations[url] = gen
        return gen

    def reap(self, url):
        self.reaped.add(url)

    def enqueue_ack(self, url, action_id, *, response="poke", err=None, event_id=None):
        gen = self.generation(url)
        if event_id is None:
            event_id = gen.next_event_id
            gen.next_event_id += 1
        frame = {"response": response, "id": action_id}
        if err is not None:
            frame["err"] = err
        gen.buffered.append(sse_frame(event_id, frame))
        return event_id

    def put(self, url, *, json, headers, timeout):
        self.put_calls.append({"url": url, "json": json})
        if self.put_status not in (200, 204):
            return FakeActionResponse(self.put_status, "action rejected")
        for action in json:
            name = action.get("action")
            if name in ("poke", "subscribe"):
                self.enqueue_ack(url, action.get("id"), response=name)
        return FakeActionResponse(204)

    def get(self, url, *, headers, timeout):
        self.get_calls.append({"url": url, "headers": headers, "timeout": timeout})
        gen = self.generations.get(url)
        chunks = list(gen.buffered) if gen is not None else []
        if gen is not None:
            gen.buffered.clear()
        return FakeHandshakeSSEResponse(chunks, on_enter=self.on_get_enter)

    async def close(self):
        pass


class TlonSSEClientTests(unittest.TestCase):
    def test_open_sends_helm_hi_channel_poke(self):
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
            }
        )
        client = tlon_api.TlonSSEClient(cfg)
        session = FakeActionSession()
        client._session = session

        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            asyncio.run(client.open())

        self.assertEqual(len(session.put_calls), 1)
        action = session.put_calls[0]["json"][0]
        self.assertEqual(action["action"], "poke")
        self.assertEqual(action["ship"], "zod")
        self.assertEqual(action["app"], "hood")
        self.assertEqual(action["mark"], "helm-hi")

    def test_action_status_classifies_only_nonretryable_4xx_as_terminal(self):
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
            }
        )
        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)

        for status in (404, 408, 410, 425, 429, 500, 503):
            client = tlon_api.TlonSSEClient(cfg)
            client._session = FakeActionSession(status)
            client.channel_url = "https://zod.tlon.network/~/channel/test"
            with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
                with self.assertRaises(ConnectionError) as raised:
                    asyncio.run(client._send_actions([]))
            self.assertNotIsInstance(raised.exception, tlon_api.TlonTerminalActionError)

        for status in (400, 403):
            client = tlon_api.TlonSSEClient(cfg)
            client._session = FakeActionSession(status)
            client.channel_url = "https://zod.tlon.network/~/channel/test"
            with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
                with self.assertRaises(tlon_api.TlonTerminalActionError):
                    asyncio.run(client._send_actions([]))

    def test_action_terminal_class_survives_unreadable_body(self):
        # A stalled/truncated rejection body must not downgrade a terminal
        # 401/403 to a generic ConnectionError — the classification is made
        # from the status alone, before the body is read.
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
            }
        )
        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        for status in (401, 403):
            client = tlon_api.TlonSSEClient(cfg)
            client._session = FakeActionSession(
                status, text_error=RuntimeError("body stalled")
            )
            client.channel_url = "https://zod.tlon.network/~/channel/test"
            with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
                with self.assertRaises(tlon_api.TlonTerminalActionError) as raised:
                    asyncio.run(client._send_actions([]))
            self.assertEqual(raised.exception.status, status)

    def test_sse_500_raises_channel_error_without_reading_body(self):
        # A stalled/truncated 500 body must not defeat dead-channel recovery:
        # events() must raise TlonChannelError(status=500) even when text()
        # would itself raise, so _run_stream rebuilds rather than resumes.
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
            }
        )
        client = tlon_api.TlonSSEClient(cfg)
        client.channel_url = "https://zod.tlon.network/~/channel/test"
        client._session = FakeSSESession(
            responses=[(500, [])], text_error=RuntimeError("body stalled")
        )
        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            with self.assertRaises(tlon_api.TlonChannelError) as raised:

                async def run():
                    async for _ in client.events():
                        pass

                asyncio.run(run())
        self.assertEqual(raised.exception.status, 500)

    def test_parse_acknowledges_id_only_sse_frames(self):
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
            }
        )
        client = tlon_api.TlonSSEClient(cfg)
        acked = []

        async def fake_ack(event_id):
            acked.append(event_id)

        async def run():
            client._ack = fake_ack
            event = await client._parse_sse_payload("id: 21\n\n")
            await asyncio.sleep(0)
            return event

        self.assertIsNone(asyncio.run(run()))
        self.assertEqual(acked, [21])
        self.assertEqual(client._last_acked_event_id, 21)

    def test_subscription_quit_raises_to_force_reconnect(self):
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
            }
        )
        client = tlon_api.TlonSSEClient(cfg)
        client._subscriptions[1] = ("channels", "/v2")
        client._last_acked_event_id = 100

        async def run():
            with self.assertRaisesRegex(ConnectionError, "subscription quit.*channels /v2"):
                await client._parse_sse_payload('id: 22\ndata: {"id":1,"response":"quit"}\n\n')

        asyncio.run(run())

    def test_subscription_error_raises_to_force_reconnect(self):
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
            }
        )
        client = tlon_api.TlonSSEClient(cfg)
        client._subscriptions[2] = ("chat", "/v3")
        client._last_acked_event_id = 100

        async def run():
            with self.assertRaisesRegex(ConnectionError, "subscription failed.*chat /v3"):
                await client._parse_sse_payload(
                    'id: 23\ndata: {"id":2,"response":"subscribe","err":"nope"}\n\n'
                )

        asyncio.run(run())

    def test_optional_subscription_error_is_skipped_not_raised(self):
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
            }
        )
        client = tlon_api.TlonSSEClient(cfg)
        client._subscriptions[3] = ("steward", "/v1/lens")
        client._optional_subscriptions.add(3)
        client._last_acked_event_id = 100

        async def run():
            result = await client._parse_sse_payload(
                'id: 24\ndata: {"id":3,"response":"subscribe","err":"no-such-agent"}\n\n'
            )
            self.assertIsNone(result)

        asyncio.run(run())
        # The dead optional sub is forgotten so its later facts aren't matched.
        self.assertNotIn(3, client._subscriptions)
        self.assertNotIn(3, client._optional_subscriptions)

    def test_optional_subscription_quit_forces_reconnect(self):
        # `optional` only suppresses the initial unavailability. Once the
        # subscription is established, a quit must raise so the stream
        # reconnects and re-subscribes — otherwise the adapter goes
        # permanently deaf to (e.g.) owner Retry facts.
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
            }
        )
        client = tlon_api.TlonSSEClient(cfg)
        client._subscriptions[4] = ("steward", "/v1/lens")
        client._optional_subscriptions.add(4)
        client._last_acked_event_id = 100

        async def run():
            with self.assertRaisesRegex(ConnectionError, "subscription quit.*steward"):
                await client._parse_sse_payload(
                    'id: 25\ndata: {"id":4,"response":"quit"}\n\n'
                )

        asyncio.run(run())

    def test_non_graceful_close_abandons_channel_without_unsubscribing(self):
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
            }
        )
        client = tlon_api.TlonSSEClient(cfg)
        session = FakeCloseSession()
        client._session = session
        client.channel_id = "test"
        client.channel_url = "https://zod.tlon.network/~/channel/test"
        client._subscriptions[1] = ("channels", "/v2")

        asyncio.run(client.close(graceful=False))

        self.assertTrue(session.closed)
        self.assertEqual(session.put_calls, 0)
        self.assertEqual(session.delete_calls, 0)
        self.assertIsNone(client.channel_id)
        self.assertIsNone(client.channel_url)

    def test_events_use_configured_read_timeout_and_raise_on_stream_end(self):
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
                "TLON_SSE_READ_TIMEOUT_SECONDS": "7.5",
            }
        )
        client = tlon_api.TlonSSEClient(cfg)
        session = FakeSSESession(
            [
                b'id: 3\n'
                b'data: {"id":1,"response":"diff","json":{"nest":"chat/~zod/general"}}\n\n'
            ]
        )
        client._session = session
        client.channel_url = "https://zod.tlon.network/~/channel/test"
        client._subscriptions[1] = ("channels", "/v2")

        async def run():
            events = []
            try:
                async for event in client.events():
                    events.append(event)
            except ConnectionError as exc:
                return events, str(exc)
            return events, ""

        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            events, error = asyncio.run(run())

        self.assertEqual(error, "Tlon SSE stream ended")
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].app, "channels")
        self.assertEqual(events[0].path, "/v2")
        self.assertEqual(events[0].json, {"nest": "chat/~zod/general"})
        self.assertIsNone(session.timeout.total)
        self.assertEqual(session.timeout.sock_read, 7.5)
        self.assertEqual(session.timeout.connect, 60)

    def test_scry_uses_eyre_scry_endpoint(self):
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
            }
        )
        client = tlon_api.TlonSSEClient(cfg)
        session = FakeScrySession({"nickname": {"value": "Mr Arvo"}})
        client._session = session

        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            result = asyncio.run(client.scry("/contacts/v1/self.json"))

        self.assertEqual(result, {"nickname": {"value": "Mr Arvo"}})
        self.assertEqual(
            session.get_calls[0]["url"],
            "https://zod.tlon.network/~/scry/contacts/v1/self.json",
        )
        self.assertEqual(session.get_calls[0]["timeout"].total, 30)


class TlonCLITests(unittest.TestCase):
    def test_send_and_reply_use_tlon_cli(self):
        calls = []
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
                "TLON_CLI": "tlon-test",
            }
        )

        async def runner(command, env, timeout, on_deadline):
            self.assertIsNone(on_deadline)
            calls.append((tuple(command), dict(env), timeout))
            return tlon_api.TlonProcessResult(returncode=0, stdout="Message sent\n")

        async def run():
            cli = tlon_api.TlonCLI(cfg, runner=runner)
            sent = await cli.send_message("chat/~zod/general", "hello --help")
            replied = await cli.send_reply(
                "~nec",
                "170.141",
                "hi",
                parent_author="nec",
            )
            return sent, replied

        sent, replied = asyncio.run(run())

        self.assertTrue(sent.success)
        self.assertTrue(replied.success)
        self.assertEqual(
            calls[0][0],
            ("tlon-test", "posts", "send", "chat/~zod/general", "hello --help"),
        )
        self.assertEqual(
            calls[1][0],
            ("tlon-test", "posts", "reply", "~nec", "170.141", "hi", "--author", "~nec"),
        )
        self.assertEqual(calls[0][1]["TLON_NODE_URL"], "https://zod.tlon.network")
        self.assertEqual(calls[0][1]["TLON_NODE_ID"], "~zod")
        self.assertEqual(calls[0][1]["TLON_ACCESS_CODE"], "code")
        self.assertEqual(calls[0][1]["TLON_URL"], "https://zod.tlon.network")

    def test_send_and_reply_forward_sent_at(self):
        calls = []
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
                "TLON_CLI": "tlon-test",
            }
        )

        async def runner(command, env, timeout, _on_deadline):
            calls.append(tuple(command))
            return tlon_api.TlonProcessResult(returncode=0, stdout="✓ Message sent\n")

        async def run():
            cli = tlon_api.TlonCLI(cfg, runner=runner)
            await cli.send_message("chat/~zod/general", "hi", sent_at=1234)
            await cli.send_reply("~nec", "170.141", "hi", sent_at=5678)

        asyncio.run(run())
        self.assertEqual(calls[0][-2:], ("--sent-at", "1234"))
        self.assertEqual(calls[1][-2:], ("--sent-at", "5678"))

    def test_format_post_id_round_trips_through_da(self):
        # da.fromUnix round-trips via aura's da.toUnix; the id is
        # ~author/<dotted @ud>.
        pid = tlon_api.format_post_id("bot", 1_700_000_000_000)
        ship, _, ud = pid.partition("/")
        self.assertEqual(ship, "~bot")
        self.assertIn(".", ud)
        da = int(ud.replace(".", ""))
        offset = (1 << 64) // 2000
        back = round((offset + (da - tlon_api._DA_UNIX_EPOCH)) * 1000 / (1 << 64))
        self.assertEqual(back, 1_700_000_000_000)

    def test_run_command_uses_same_runner_and_env(self):
        calls = []
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
                "TLON_CLI": "tlon-test",
            }
        )

        async def runner(command, env, timeout, _on_deadline):
            calls.append((tuple(command), dict(env), timeout))
            return tlon_api.TlonProcessResult(returncode=0, stdout="~zod\n")

        async def run():
            cli = tlon_api.TlonCLI(cfg, runner=runner)
            return await cli.run_command(("contacts", "self"))

        result = asyncio.run(run())

        self.assertTrue(result.success)
        self.assertEqual(result.stdout, "~zod\n")
        self.assertEqual(calls[0][0], ("tlon-test", "contacts", "self"))
        self.assertEqual(calls[0][1]["TLON_NODE_ID"], "~zod")

    def test_run_command_scrubs_ambient_resolver_credentials_before_runner(self):
        calls = []
        cfg = tlon_api.TlonConfig(
            ship_url="https://zod.tlon.network",
            ship_name="~zod",
            ship_code="config-code",
            cli="tlon-test",
        )
        ambient = {
            "TLON_CONFIG_FILE": "/tmp/hostile-config.json",
            "URBIT_COOKIE": "stale-urbit-cookie",
            "TLON_COOKIE": "stale-tlon-cookie",
            "TLON_URL": "https://nec.tlon.network",
            "TLON_SHIP": "~nec",
            "TLON_CODE": "stale-code",
        }

        async def runner(command, env, timeout, _on_deadline):
            calls.append(dict(env))
            return tlon_api.TlonProcessResult(returncode=0)

        async def run():
            cli = tlon_api.TlonCLI(cfg, runner=runner)
            return await cli.run_command(("contacts", "self"))

        with patch.dict(tlon_api.os.environ, ambient, clear=True):
            asyncio.run(run())

        resolver_keys = {
            "TLON_CONFIG_FILE",
            "URBIT_COOKIE",
            "TLON_COOKIE",
            "URBIT_URL",
            "TLON_URL",
            "URBIT_SHIP",
            "TLON_SHIP",
            "URBIT_CODE",
            "TLON_CODE",
        }
        self.assertEqual(
            {key: calls[0][key] for key in resolver_keys if key in calls[0]},
            {
                "TLON_URL": "https://zod.tlon.network",
                "URBIT_URL": "https://zod.tlon.network",
                "TLON_SHIP": "~zod",
                "URBIT_SHIP": "~zod",
                "TLON_CODE": "config-code",
                "URBIT_CODE": "config-code",
            },
        )

    def test_run_command_override_timeout_preserves_timeout_output(self):
        calls = []
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
            }
        )

        async def runner(command, env, timeout, _on_deadline):
            calls.append(timeout)
            raise tlon_api.TlonProcessTimeout(
                "Target notebook created: notes/~zod/log\n", "still working\n"
            )

        async def run():
            cli = tlon_api.TlonCLI(cfg, runner=runner)
            return await cli.run_command(
                ("notes", "migrate-apply", "diary/~zod/log", "--yes"),
                timeout=1800,
            )

        result = asyncio.run(run())
        self.assertFalse(result.success)
        self.assertTrue(result.timed_out)
        self.assertEqual(calls, [1800])
        self.assertIn("notes/~zod/log", result.stdout)
        self.assertEqual(result.stderr, "still working\n")

    def test_subprocess_timeout_kills_and_drains_buffered_stdout(self):
        async def run():
            return await tlon_api.TlonCLI._run_subprocess(
                (
                    sys.executable,
                    "-c",
                    (
                        "import time; "
                        "print('Target notebook created: notes/~zod/log', flush=True); "
                        "time.sleep(10)"
                    ),
                ),
                {},
                0.05,
            )

        started = time.monotonic()
        with self.assertRaises(tlon_api.TlonProcessTimeout) as raised:
            asyncio.run(run())
        self.assertLess(time.monotonic() - started, 2)
        self.assertIn("notes/~zod/log", raised.exception.stdout)

    def test_deadline_reports_partial_chunks_without_signalling_and_returns_result(self):
        deadline_outputs = []
        cfg = tlon_api.TlonConfig(
            ship_url="https://zod.test",
            ship_name="~zod",
            ship_code="code",
            cli=sys.executable,
        )

        async def on_deadline(output):
            deadline_outputs.append(output)

        async def run():
            cli = tlon_api.TlonCLI(cfg)
            return await cli.run_command(
                (
                    "-c",
                    (
                        "import sys,time; "
                        "print('stdout-before', flush=True); "
                        "print('stderr-before', file=sys.stderr, flush=True); "
                        "time.sleep(0.4); "
                        "print('stdout-after', flush=True); "
                        "print('stderr-after', file=sys.stderr, flush=True)"
                    ),
                ),
                timeout=0.15,
                on_deadline=on_deadline,
            )

        command_result = asyncio.run(run())
        self.assertTrue(command_result.success)
        self.assertEqual(command_result.returncode, 0)
        self.assertEqual(len(deadline_outputs), 1)
        self.assertEqual(deadline_outputs[0].stdout, "stdout-before\n")
        self.assertEqual(deadline_outputs[0].stderr, "stderr-before\n")
        self.assertEqual(
            command_result.stdout, "stdout-before\nstdout-after\n"
        )
        self.assertEqual(
            command_result.stderr, "stderr-before\nstderr-after\n"
        )


class FakeGatewayStatusClient:
    def __init__(self):
        self.authenticated = False
        self.opened = False
        self.closed = False
        self.pokes = []

    async def authenticate(self):
        self.authenticated = True
        return "urbauth=fake"

    async def open(self):
        self.opened = True

    async def poke(self, app, mark, json_payload):
        self.pokes.append((app, mark, json_payload))
        return len(self.pokes)

    async def close(self):
        self.closed = True


class TlonGatewayStatusTests(unittest.TestCase):
    def test_gateway_status_uses_explicit_owner(self):
        fake = FakeGatewayStatusClient()
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
                "TLON_OWNER_SHIP": "~mug",
                "TLON_ALLOWED_USERS": "~mug",
                "TLON_GATEWAY_STATUS_HEARTBEAT_SECONDS": "999",
            }
        )

        async def run():
            status = tlon_api.TlonGatewayStatus(cfg, client_factory=lambda _cfg: fake)
            status.boot_id = "boot-test"
            started = await status.start()
            await status.stop("unit-test")
            return started

        self.assertTrue(asyncio.run(run()))
        self.assertTrue(fake.authenticated)
        self.assertTrue(fake.opened)
        self.assertTrue(fake.closed)
        self.assertEqual([poke[0] for poke in fake.pokes], ["steward"] * 4)
        self.assertEqual(
            [poke[1] for poke in fake.pokes],
            ["steward-action-1"] + ["steward-gateway-action-1"] * 3,
        )
        # The owner rides the core mark; only the timings are the module's own.
        self.assertEqual(fake.pokes[0][2], {"configure": {"owner": "~mug"}})
        self.assertEqual(
            fake.pokes[1][2],
            {
                "configure": {
                    "active-window": "~s300",
                    "offline-reply-cooldown": "~s300",
                }
            },
        )
        self.assertEqual(fake.pokes[2][2]["gateway-start"]["boot-id"], "boot-test")
        self.assertTrue(fake.pokes[2][2]["gateway-start"]["lease-until"].startswith("~"))
        self.assertEqual(
            fake.pokes[3][2],
            {"gateway-stop": {"boot-id": "boot-test", "reason": "unit-test"}},
        )

    def test_gateway_status_does_not_infer_owner_from_allowlist(self):
        fake = FakeGatewayStatusClient()
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
                "TLON_ALLOWED_USERS": "~mug",
            }
        )

        async def run():
            status = tlon_api.TlonGatewayStatus(cfg, client_factory=lambda _cfg: fake)
            return await status.start()

        self.assertFalse(asyncio.run(run()))
        self.assertEqual(fake.pokes, [])

    def test_gateway_status_can_be_disabled(self):
        fake = FakeGatewayStatusClient()
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
                "TLON_ALLOWED_USERS": "~mug",
                "TLON_GATEWAY_STATUS": "false",
            }
        )

        async def run():
            status = tlon_api.TlonGatewayStatus(cfg, client_factory=lambda _cfg: fake)
            return await status.start()

        self.assertFalse(asyncio.run(run()))
        self.assertEqual(fake.pokes, [])


class MessageParsingTests(unittest.TestCase):
    def test_extract_message_text_handles_story_blocks(self):
        story = [
            {"inline": ["hello ", {"ship": "nec"}, " "]},
            {"inline": [{"link": {"href": "https://example.com", "content": "link"}}]},
            {"block": {"code": {"lang": "py", "code": "print('x')"}}},
        ]
        text = tlon_api.extract_message_text(story)
        self.assertIn("hello ~nec", text)
        self.assertIn("link", text)
        self.assertIn("```py", text)

    def test_parse_channel_message(self):
        raw = {
            "nest": "chat/~zod/general",
            "response": {
                "post": {
                    "id": "170.141",
                    "r-post": {
                        "set": {
                            "seal": {"parent-id": "root"},
                            "essay": {
                                "author": "~nec",
                                "sent": 1000,
                                "content": [{"inline": [{"ship": "~zod"}, " hello"]}],
                            },
                        }
                    },
                }
            },
        }

        message = tlon_api.parse_channel_message(raw, self_ship="~zod")

        self.assertIsNotNone(message)
        self.assertEqual(message.chat_id, "chat/~zod/general")
        self.assertEqual(message.user_id, "~nec")
        self.assertEqual(message.text, "~zod hello")
        self.assertEqual(message.content, [{"inline": [{"ship": "~zod"}, " hello"]}])

    def test_parse_channel_message_accepts_bot_profile_author(self):
        raw = {
            "nest": "chat/~zod/general",
            "response": {
                "post": {
                    "id": "170.141",
                    "r-post": {
                        "set": {
                            "essay": {
                                "author": {
                                    "ship": "~nec",
                                    "nickname": "Test Bot",
                                    "avatar": "",
                                },
                                "sent": 1000,
                                "content": [{"inline": [{"ship": "~zod"}, " hello"]}],
                            },
                        }
                    },
                }
            },
        }

        message = tlon_api.parse_channel_message(raw, self_ship="~zod")

        self.assertIsNotNone(message)
        self.assertEqual(message.user_id, "~nec")
        self.assertEqual(message.user_name, "~nec")
        self.assertTrue(message.author_is_bot)

    def test_author_is_bot_meta_rejects_mappings_without_ship(self):
        self.assertTrue(tlon_api.author_is_bot_meta({"ship": "~nec", "nickname": "Bot"}))
        self.assertFalse(tlon_api.author_is_bot_meta({"nickname": "Bot"}))
        self.assertFalse(tlon_api.author_is_bot_meta("~nec"))

    def test_parse_channel_message_preserves_blob_and_allows_blob_only(self):
        blob = json.dumps(
            [
                {
                    "type": "file",
                    "version": 1,
                    "fileUri": "https://storage.example.com/report.pdf",
                    "name": "report.pdf",
                }
            ]
        )
        raw = {
            "nest": "chat/~zod/general",
            "response": {
                "post": {
                    "id": "170.141",
                    "r-post": {
                        "set": {
                            "essay": {
                                "author": "~nec",
                                "sent": 1000,
                                "content": [],
                                "blob": blob,
                            },
                        }
                    },
                }
            },
        }

        message = tlon_api.parse_channel_message(raw, self_ship="~zod")

        self.assertIsNotNone(message)
        self.assertEqual(message.text, "")
        self.assertEqual(message.blob, blob)
        self.assertEqual(message.content, [])

    def test_parse_channel_reply_preserves_blob_and_parent(self):
        blob = json.dumps(
            [
                {
                    "type": "video",
                    "version": 1,
                    "fileUri": "https://storage.example.com/clip.mp4",
                    "name": "clip.mp4",
                }
            ]
        )
        raw = {
            "nest": "chat/~zod/general",
            "response": {
                "post": {
                    "id": "root",
                    "r-post": {
                        "reply": {
                            "id": "170.142",
                            "r-reply": {
                                "set": {
                                    "seal": {"parent-id": "root"},
                                    "memo": {
                                        "author": "~nec",
                                        "sent": 1000,
                                        "content": [{"inline": ["see this"]}],
                                        "blob": blob,
                                    },
                                }
                            },
                        }
                    },
                }
            },
        }

        message = tlon_api.parse_channel_message(raw, self_ship="~zod")

        self.assertIsNotNone(message)
        self.assertEqual(message.message_id, "170.142")
        self.assertEqual(message.reply_to_message_id, "root")
        self.assertEqual(message.blob, blob)

    def test_parse_channel_reply_accepts_reply_essay_bot_author(self):
        raw = {
            "nest": "chat/~zod/general",
            "response": {
                "post": {
                    "id": "root",
                    "r-post": {
                        "reply": {
                            "id": "170.142",
                            "r-reply": {
                                "set": {
                                    "seal": {"parent-id": "root"},
                                    "reply-essay": {
                                        "author": {
                                            "ship": "~nec",
                                            "nickname": "Test Bot",
                                            "avatar": "",
                                        },
                                        "sent": 1000,
                                        "content": [{"inline": [{"ship": "~zod"}, " hi"]}],
                                    },
                                }
                            },
                        }
                    },
                }
            },
        }

        message = tlon_api.parse_channel_message(raw, self_ship="~zod")

        self.assertIsNotNone(message)
        self.assertEqual(message.message_id, "170.142")
        self.assertEqual(message.reply_to_message_id, "root")
        self.assertEqual(message.user_id, "~nec")
        self.assertEqual(message.text, "~zod hi")
        self.assertTrue(message.author_is_bot)

    def test_old_substring_mention_helpers_are_removed(self):
        self.assertFalse(hasattr(tlon_api, "bot_mentioned"))
        self.assertFalse(hasattr(tlon_api, "strip_bot_mentions"))

    def test_parse_dm_message_skips_own_messages(self):
        raw = {
            "whom": "~nec",
            "id": "170.141",
            "response": {
                "add": {
                    "essay": {
                        "author": "~nec",
                        "sent": 1000,
                        "content": [{"inline": ["hello"]}],
                    }
                }
            },
        }

        message = tlon_api.parse_dm_message(raw, self_ship="~zod")
        own = tlon_api.parse_dm_message(raw, self_ship="~nec")

        self.assertIsNotNone(message)
        self.assertEqual(message.chat_id, "~nec")
        self.assertEqual(message.chat_type, "dm")
        self.assertEqual(message.text, "hello")
        self.assertFalse(message.author_is_bot)
        self.assertIsNone(own)

    def test_parse_dm_message_records_bot_profile_author(self):
        raw = {
            "whom": "~nec",
            "id": "170.141",
            "response": {
                "add": {
                    "essay": {
                        "author": {"ship": "~nec", "nickname": "Bot", "avatar": ""},
                        "sent": 1000,
                        "content": [{"inline": ["hello"]}],
                    }
                }
            },
        }

        message = tlon_api.parse_dm_message(raw, self_ship="~zod")

        self.assertIsNotNone(message)
        self.assertTrue(message.author_is_bot)

    def test_parse_dm_message_allows_blob_only(self):
        blob = json.dumps(
            [
                {
                    "type": "voicememo",
                    "version": 1,
                    "fileUri": "https://storage.example.com/memo.m4a",
                }
            ]
        )
        raw = {
            "whom": "~nec",
            "id": "170.141",
            "response": {
                "add": {
                    "essay": {
                        "author": "~nec",
                        "sent": 1000,
                        "content": [],
                        "blob": blob,
                    }
                }
            },
        }

        message = tlon_api.parse_dm_message(raw, self_ship="~zod")

        self.assertIsNotNone(message)
        self.assertEqual(message.text, "")
        self.assertEqual(message.blob, blob)

    def test_parse_dm_reply_preserves_blob_and_parent(self):
        blob = json.dumps(
            [
                {
                    "type": "file",
                    "version": 1,
                    "fileUri": "https://storage.example.com/report.pdf",
                    "name": "report.pdf",
                }
            ]
        )
        raw = {
            "whom": "~nec",
            "id": "dm-root",
            "response": {
                "reply": {
                    "id": "dm-reply",
                    "delta": {
                        "add": {
                            "essay": {
                                "author": "~nec",
                                "sent": 1000,
                                "content": [{"inline": ["see attached"]}],
                                "blob": blob,
                            }
                        }
                    },
                }
            },
        }

        message = tlon_api.parse_dm_message(raw, self_ship="~zod")

        self.assertIsNotNone(message)
        self.assertEqual(message.message_id, "dm-reply")
        self.assertEqual(message.reply_to_message_id, "dm-root")
        self.assertEqual(message.blob, blob)


class ReactionParsingTests(unittest.TestCase):
    def test_config_reaction_level_defaults_and_invalid_values(self):
        required = {
            "TLON_NODE_URL": "https://zod.tlon.network",
            "TLON_NODE_ID": "~zod",
            "TLON_ACCESS_CODE": "code",
        }
        self.assertEqual(tlon_api.TlonConfig.from_env(env=required).reaction_level, "minimal")
        self.assertEqual(
            tlon_api.TlonConfig.from_env(
                env={**required, "TLON_REACTION_LEVEL": "EXTENSIVE"}
            ).reaction_level,
            "extensive",
        )
        self.assertEqual(
            tlon_api.TlonConfig.from_env(
                env={**required, "TLON_REACTION_LEVEL": "unexpected"}
            ).reaction_level,
            "minimal",
        )

    def test_channel_snapshot_decodes_plain_bot_any_and_reply_entries(self):
        raw = {
            "nest": "chat/~zod/general",
            "response": {
                "post": {
                    "id": "170.141",
                    "r-post": {
                        "reacts": {
                            "~mug": "👍",
                            "~bot/nick": {
                                "ship": "~bot",
                                "nickname": "nick",
                                "avatar": None,
                                "react": {"any": "🔥"},
                            },
                        }
                    },
                }
            },
        }
        snapshot = tlon_api.parse_channel_reacts_snapshot(raw)
        self.assertIsNotNone(snapshot)
        self.assertEqual(snapshot.post_id, "170.141")
        self.assertIsNone(snapshot.parent_id)
        self.assertEqual(snapshot.entries["~mug"], ("👍", "~mug", False))
        self.assertEqual(snapshot.entries["~bot/nick"], ("🔥", "~bot", True))

        reply_raw = {
            "nest": "chat/~zod/general",
            "response": {
                "post": {
                    "id": "root",
                    "r-post": {
                        "reply": {
                            "id": "reply",
                            "r-reply": {"reacts": {"~mug": {"any": ":wave:"}}},
                        }
                    },
                }
            },
        }
        reply = tlon_api.parse_channel_reacts_snapshot(reply_raw)
        self.assertEqual(reply.post_id, "reply")
        self.assertEqual(reply.parent_id, "root")
        self.assertEqual(reply.entries["~mug"], (":wave:", "~mug", False))

    def test_channel_snapshot_rejects_whole_map_on_bad_entry(self):
        raw = {
            "nest": "chat/~zod/general",
            "response": {
                "post": {
                    "id": "170.141",
                    "r-post": {"reacts": {"~mug": "👍", "~bad": {"nope": 1}}},
                }
            },
        }
        self.assertIsNone(tlon_api.parse_channel_reacts_snapshot(raw))

    def test_dm_reactions_cover_add_remove_reply_bot_any_club_and_self(self):
        add = {
            "whom": "~mug",
            "id": "~zod/170.141",
            "response": {"add-react": {"author": "~mug", "react": {"any": "👍"}}},
        }
        reaction = tlon_api.parse_dm_reaction(add, self_ship="~zod")
        self.assertEqual((reaction.chat_id, reaction.post_id, reaction.emoji, reaction.added), ("~mug", "~zod/170.141", "👍", True))
        self.assertEqual(reaction.wire_key, "~mug")

        remove = {
            "whom": "~mug",
            "id": "~zod/170.141",
            "response": {"del-react": {"ship": "~bot", "nickname": "nick", "avatar": None}},
        }
        removed = tlon_api.parse_dm_reaction(remove, self_ship="~zod")
        self.assertFalse(removed.added)
        self.assertEqual(removed.emoji, "")
        self.assertEqual((removed.wire_key, removed.reactor, removed.reactor_is_bot), ("~bot/nick", "~bot", True))

        reply = {
            "whom": "~mug",
            "id": "~zod/root",
            "response": {
                "reply": {
                    "id": "~zod/reply",
                    "delta": {"add-react": {"author": "~mug", "react": "🔥"}},
                }
            },
        }
        reply_reaction = tlon_api.parse_dm_reaction(reply, self_ship="~zod")
        self.assertEqual((reply_reaction.post_id, reply_reaction.parent_id), ("~zod/reply", "~zod/root"))
        self.assertIsNone(
            tlon_api.parse_dm_reaction(
                {**add, "whom": "0v5.legacy"}, self_ship="~zod"
            )
        )
        self.assertIsNone(
            tlon_api.parse_dm_reaction(
                {**add, "response": {"add-react": {"author": "~zod", "react": "👍"}}},
                self_ship="~zod",
            )
        )

    def test_bot_reaction_author_allows_null_nickname(self):
        # nickname is wire type `(unit @t)`: a bot profile without a nickname
        # serializes null, which must not drop the reaction or reject a snapshot.
        add = {
            "whom": "~mug",
            "id": "~zod/170.141",
            "response": {
                "add-react": {
                    "author": {"ship": "~bot", "nickname": None, "avatar": None},
                    "react": {"any": "👍"},
                }
            },
        }
        reaction = tlon_api.parse_dm_reaction(add, self_ship="~zod")
        self.assertIsNotNone(reaction)
        self.assertEqual(reaction.reactor, "~bot")
        self.assertTrue(reaction.reactor_is_bot)
        self.assertEqual(reaction.emoji, "👍")

        raw = {
            "nest": "chat/~zod/general",
            "response": {
                "post": {
                    "id": "170.141",
                    "r-post": {
                        "reacts": {
                            "~mug": "👍",
                            "~bot/": {
                                "ship": "~bot",
                                "nickname": None,
                                "avatar": None,
                                "react": {"any": "🔥"},
                            },
                        }
                    },
                }
            },
        }
        snapshot = tlon_api.parse_channel_reacts_snapshot(raw)
        self.assertIsNotNone(snapshot)
        self.assertEqual(snapshot.entries["~mug"], ("👍", "~mug", False))
        self.assertEqual(snapshot.entries["~bot/"], ("🔥", "~bot", True))

    def test_include_self_preserves_author_without_changing_dm_partner(self):
        channel = tlon_api.parse_channel_message(
            {
                "nest": "chat/~zod/general",
                "response": {
                    "post": {
                        "id": "170.141",
                        "r-post": {"set": {"essay": {"author": "~zod", "sent": 1, "content": [{"inline": ["hi"]}]}}},
                    }
                },
            },
            self_ship="~zod",
            include_self=True,
        )
        dm = tlon_api.parse_dm_message(
            {
                "whom": "~mug",
                "id": "~zod/170.141",
                "response": {"add": {"essay": {"author": "~zod", "sent": 1, "content": [{"inline": ["hi"]}]}}},
            },
            self_ship="~zod",
            include_self=True,
        )
        self.assertEqual(channel.author_id, "~zod")
        self.assertEqual(dm.author_id, "~zod")
        self.assertEqual((dm.chat_id, dm.user_id), ("~mug", "~mug"))


class TlonSSEClientResumeTests(unittest.TestCase):
    def _make_client(self):
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
            }
        )
        client = tlon_api.TlonSSEClient(cfg)
        client.channel_id = "test-channel"
        client.channel_url = "https://zod.tlon.network/~/channel/test-channel"
        return client

    def _diff_chunk(self, event_id, sub_id=1, app="channels", path="/v2"):
        data = json.dumps({"id": sub_id, "response": "diff", "json": {"hello": True}})
        return f"id: {event_id}\ndata: {data}\n\n".encode()

    def test_first_connect_sends_no_last_event_id(self):
        client = self._make_client()
        session = FakeSSESession(responses=[(200, [self._diff_chunk(1)])])
        client._session = session

        async def run():
            events = []
            try:
                async for ev in client.events():
                    events.append(ev)
            except ConnectionError:
                pass
            return events

        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            asyncio.run(run())

        self.assertEqual(len(session.get_calls), 1)
        self.assertNotIn("Last-Event-ID", session.get_calls[0]["headers"])

    def test_resume_sends_last_event_id(self):
        client = self._make_client()
        session = FakeSSESession(
            responses=[
                (200, [self._diff_chunk(7), self._diff_chunk(21)]),
                (200, [self._diff_chunk(30)]),
            ]
        )
        client._session = session

        async def run():
            try:
                async for _ in client.events():
                    pass
            except ConnectionError:
                pass
            try:
                async for _ in client.events():
                    pass
            except ConnectionError:
                pass

        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            asyncio.run(run())

        self.assertNotIn("Last-Event-ID", session.get_calls[0]["headers"])
        self.assertEqual(session.get_calls[1]["headers"]["Last-Event-ID"], "21")

    def test_event_id_zero_is_delivered_and_resumed(self):
        client = self._make_client()
        session = FakeSSESession(
            responses=[
                (200, [self._diff_chunk(0)]),
                (200, [self._diff_chunk(1)]),
            ]
        )
        client._session = session

        async def run():
            events = []
            try:
                async for ev in client.events():
                    events.append(ev)
            except ConnectionError:
                pass
            try:
                async for ev in client.events():
                    events.append(ev)
            except ConnectionError:
                pass
            return events

        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            events = asyncio.run(run())

        self.assertEqual(len(events), 2)
        self.assertEqual(events[0].event_id, 0)
        self.assertEqual(session.get_calls[1]["headers"]["Last-Event-ID"], "0")

    def test_open_resets_cursor_and_subscriptions(self):
        client = self._make_client()
        client._last_heard_event_id = 42
        client._last_acked_event_id = 42
        client._subscriptions[1] = ("channels", "/v2")
        client._optional_subscriptions.add(1)
        session = FakeActionSession()
        client._session = session

        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            asyncio.run(client.open())

        self.assertEqual(client._last_heard_event_id, -1)
        self.assertEqual(client._last_acked_event_id, -1)
        self.assertEqual(client._subscriptions, {})
        self.assertEqual(client._optional_subscriptions, set())

        sse_session = FakeSSESession(responses=[(200, [self._diff_chunk(1)])])
        client._session = sse_session
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            async def run():
                try:
                    async for _ in client.events():
                        pass
                except ConnectionError:
                    pass
            asyncio.run(run())
        self.assertNotIn("Last-Event-ID", sse_session.get_calls[0]["headers"])

    def test_replayed_event_not_yielded_and_no_ack(self):
        client = self._make_client()
        client._last_heard_event_id = 30
        client._last_acked_event_id = -1
        acked = []

        async def fake_ack(event_id):
            acked.append(event_id)

        client._ack = fake_ack

        async def run():
            result = await client._parse_sse_payload("id: 25\ndata: {\"id\":1,\"response\":\"diff\",\"json\":{}}\n\n")
            return result

        result = asyncio.run(run())
        self.assertIsNone(result)
        self.assertEqual(acked, [])
        self.assertEqual(client._last_heard_event_id, 30)
        self.assertEqual(client._last_acked_event_id, -1)

    def test_ack_threshold_fires_for_new_ids_only(self):
        client = self._make_client()
        client._last_heard_event_id = 100
        client._last_acked_event_id = 100
        acked = []

        async def fake_ack(event_id):
            acked.append(event_id)

        client._ack = fake_ack

        async def run():
            await client._parse_sse_payload("id: 105\ndata: {\"id\":1,\"response\":\"diff\",\"json\":{}}\n\n")
            await asyncio.sleep(0)
            await client._parse_sse_payload("id: 121\ndata: {\"id\":1,\"response\":\"diff\",\"json\":{}}\n\n")
            await asyncio.sleep(0)

        asyncio.run(run())
        self.assertEqual(acked, [121])
        self.assertEqual(client._last_acked_event_id, 121)

    def test_status_mapping_channel_fatal_vs_resumable(self):
        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)

        for status, expected_type, expected_status in [
            (404, tlon_api.TlonChannelError, 404),
            (410, tlon_api.TlonChannelError, 410),
            (401, tlon_api.TlonChannelError, 401),
            (403, tlon_api.TlonChannelError, 403),
            (500, tlon_api.TlonChannelError, 500),
        ]:
            client = self._make_client()
            session = FakeSSESession(responses=[(status, [])])
            client._session = session
            with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
                with self.assertRaises(expected_type) as cm:
                    async def run():
                        async for _ in client.events():
                            pass
                    asyncio.run(run())
                self.assertEqual(cm.exception.status, expected_status)

        # A non-500 server error stays resume-able: only 500 means Eyre cannot
        # serve this channel any more.
        client = self._make_client()
        session = FakeSSESession(responses=[(503, [])])
        client._session = session
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            with self.assertRaises(ConnectionError) as cm:
                async def run():
                    async for _ in client.events():
                        pass
                asyncio.run(run())
            self.assertNotIsInstance(cm.exception, tlon_api.TlonChannelError)

    def test_subscription_nack_and_quit_raise_channel_error(self):
        client = self._make_client()
        client._subscriptions[1] = ("channels", "/v2")
        client._subscriptions[2] = ("chat", "/v3")

        async def run_nack():
            await client._parse_sse_payload(
                'id: 1\ndata: {"id":1,"response":"subscribe","err":"nope"}\n\n'
            )

        with self.assertRaises(tlon_api.TlonChannelError) as cm:
            asyncio.run(run_nack())
        self.assertIsNone(cm.exception.status)

        async def run_quit():
            await client._parse_sse_payload(
                'id: 2\ndata: {"id":2,"response":"quit"}\n\n'
            )

        with self.assertRaises(tlon_api.TlonChannelError) as cm:
            asyncio.run(run_quit())
        self.assertIsNone(cm.exception.status)

    def test_optional_subscription_nack_still_skips(self):
        client = self._make_client()
        client._subscriptions[3] = ("steward", "/v1/lens")
        client._optional_subscriptions.add(3)

        async def run():
            return await client._parse_sse_payload(
                'id: 1\ndata: {"id":3,"response":"subscribe","err":"no-agent"}\n\n'
            )

        result = asyncio.run(run())
        self.assertIsNone(result)
        self.assertNotIn(3, client._subscriptions)

    def test_on_open_fires_once_after_first_payload(self):
        # Established moves from "GET returned 200" to "first payload parsed"
        # (a keepalive payload counts): a 200-then-instant-EOF must escalate
        # backoff instead of resetting it.
        client = self._make_client()
        session = FakeSSESession(
            responses=[(200, [b": keepalive\n\n", self._diff_chunk(1)])]
        )
        client._session = session
        calls = []

        async def run():
            try:
                async for ev in client.events(on_open=lambda: calls.append("open")):
                    calls.append("event")
            except ConnectionError:
                pass

        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            asyncio.run(run())

        self.assertEqual(calls, ["open", "event"])

    def test_on_open_not_called_on_200_that_eofs_with_zero_payloads(self):
        client = self._make_client()
        session = FakeSSESession(responses=[(200, [])])
        client._session = session
        calls = []

        async def run():
            try:
                async for _ in client.events(on_open=lambda: calls.append("open")):
                    pass
            except ConnectionError:
                pass

        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            asyncio.run(run())

        self.assertEqual(calls, [])

    def test_on_open_not_called_on_failed_get(self):
        client = self._make_client()
        session = FakeSSESession(responses=[(500, [])])
        client._session = session
        calls = []

        async def run():
            async for _ in client.events(on_open=lambda: calls.append("open")):
                pass

        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            with self.assertRaises(ConnectionError):
                asyncio.run(run())

        self.assertEqual(calls, [])

    def test_response_context_released_on_normal_end(self):
        client = self._make_client()
        session = FakeSSESession(responses=[(200, [self._diff_chunk(1)])])
        client._session = session

        async def run():
            async for _ in client.events():
                pass

        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            with self.assertRaises(ConnectionError):
                asyncio.run(run())

        self.assertTrue(session.last_response.entered)
        self.assertTrue(session.last_response.released)

    def test_response_context_released_on_iteration_error(self):
        client = self._make_client()
        chunks = [self._diff_chunk(1), self._diff_chunk(2)]
        session = FakeSSESession(responses=[(200, chunks)])
        client._session = session

        async def run():
            async for _ in client.events():
                raise RuntimeError("consumer error")

        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            with self.assertRaises(RuntimeError):
                asyncio.run(run())

        self.assertTrue(session.last_response.entered)
        self.assertTrue(session.last_response.released)

    def test_response_context_released_on_cancellation(self):
        client = self._make_client()
        block = asyncio.Event()
        session = FakeSSESession(
            responses=[(200, [self._diff_chunk(1)])], block_event=block
        )
        client._session = session

        async def run():
            async def consumer():
                async for _ in client.events():
                    pass

            task = asyncio.ensure_future(consumer())
            await asyncio.sleep(0.01)
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            asyncio.run(run())

        self.assertTrue(session.last_response.entered)
        self.assertTrue(session.last_response.released)

    def test_response_context_released_on_aclose(self):
        client = self._make_client()
        chunks = [self._diff_chunk(1), self._diff_chunk(2), self._diff_chunk(3)]
        session = FakeSSESession(responses=[(200, chunks)])
        client._session = session

        async def run():
            stream = client.events()
            async for ev in stream:
                await stream.aclose()
                break

        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            asyncio.run(run())

        self.assertTrue(session.last_response.entered)
        self.assertTrue(session.last_response.released)


class TlonSSEClientReapDetectionTests(unittest.TestCase):
    def _make_client(
        self, *, reap_detection=True, read_timeout=None, stale_threshold=None
    ):
        env = {
            "TLON_NODE_URL": "https://zod.tlon.network",
            "TLON_NODE_ID": "~zod",
            "TLON_ACCESS_CODE": "code",
        }
        if read_timeout is not None:
            env["TLON_SSE_READ_TIMEOUT_SECONDS"] = read_timeout
        if stale_threshold is not None:
            env["TLON_SSE_STALE_THRESHOLD_SECONDS"] = stale_threshold
        cfg = tlon_api.TlonConfig.from_env(env=env)
        client = tlon_api.TlonSSEClient(cfg, reap_detection=reap_detection)
        client.channel_id = "test-channel"
        client.channel_url = "https://zod.tlon.network/~/channel/test-channel"
        return client

    def _run_events(self, client, **kwargs):
        async def run():
            try:
                async for _ in client.events(**kwargs):
                    pass
            except BaseException as exc:
                return exc
            return None

        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            return asyncio.run(run())

    # ── regression detector ──────────────────────────────────────────────

    def test_confirmed_floor_advances_only_on_successful_ack_put(self):
        client = self._make_client()
        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            client._session = FakeActionSession(status=503)
            asyncio.run(client._ack(5))
            self.assertEqual(client._last_confirmed_ack_event_id, -1)

            client._session = FakeActionSession(status=204)
            asyncio.run(client._ack(5))
            self.assertEqual(client._last_confirmed_ack_event_id, 5)
            # max semantics: an older confirmed ack never lowers the floor.
            asyncio.run(client._ack(3))
            self.assertEqual(client._last_confirmed_ack_event_id, 5)

    def test_ack_channel_identity_guard(self):
        client = self._make_client()
        session = FakeActionSession(status=204)

        def swap_channel_url(url, *, json, headers, timeout):
            # A channel rebuilt mid-PUT must not be repopulated by the stale ack.
            client.channel_url = "https://zod.tlon.network/~/channel/other"
            return FakeActionResponse(204)

        session.put = swap_channel_url
        client._session = session
        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            asyncio.run(client._ack(7))
        self.assertEqual(client._last_confirmed_ack_event_id, -1)

    def test_end_to_end_reap_revive_resume_detects_and_rebuilds(self):
        # The central failure mode, through the real poke()/events() paths on
        # the stateful fake: build a cursor on generation 1, reap, let an
        # outage-window poke silently revive the channel (generation 2, ids
        # restarting at 0), then resume — the reviving poke's regressed ack
        # must raise the rebuild error instead of being replay-dropped.
        client = self._make_client()
        session = FakeChannelSession()
        client._session = session
        # Let the first poke auto-open() so the genesis helm-hi is minted
        # through the real path (the fake acks it as generation 1's event 0).
        client.channel_id = None
        client.channel_url = None

        async def scenario():
            await client.poke("hood", "helm-hi", "a")
            await client.poke("hood", "helm-hi", "b")
            url = client.channel_url
            # First stream: hear generation 1's acks (helm-hi at 0, pokes at
            # 1..2) — a healthy young channel, genesis clause included.
            try:
                async for _ in client.events():
                    pass
            except tlon_api.TlonChannelError:
                raise
            except ConnectionError:
                pass
            assert client._last_heard_event_id == 2, client._last_heard_event_id
            session.reap(url)
            # Outage-window poke: revives the channel invisibly (204), records
            # a floor at the current cursor, and generation 2 acks it at 0.
            await client.poke("hood", "helm-hi", "revive")
            async for _ in client.events():
                pass

        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            with self.assertRaises(tlon_api.TlonChannelError) as raised:
                asyncio.run(scenario())
        self.assertIn("action ack regressed", str(raised.exception))
        # The resume GET carried the stale cursor — the revived channel's 200
        # looked healthy at the transport level.
        self.assertEqual(session.get_calls[-1]["headers"].get("Last-Event-ID"), "2")

    def test_pre_get_snapshot_survives_handshake_ack_race(self):
        # F1: an ack PUT completing between the get() issue and the 200 must
        # not raise the in-stream floor (Eyre binds the replay before
        # pruning), so the replayed acked event is replay-dropped, not
        # condemned.
        client = self._make_client()
        session = FakeChannelSession()
        client._session = session
        url = client.channel_url
        client._last_heard_event_id = 5
        # Eyre redelivers the already-acked event 5 in the replay.
        session.enqueue_ack(url, 99, response="poke", event_id=5)

        async def handshake_ack():
            await client._ack(5)

        session.on_get_enter = handshake_ack
        exc = self._run_events(client)
        self.assertIsInstance(exc, ConnectionError)
        self.assertNotIsInstance(exc, tlon_api.TlonChannelError)
        self.assertEqual(client._last_heard_event_id, 5)
        self.assertEqual(client._last_confirmed_ack_event_id, 5)

    def test_frame_between_snapshot_and_heard_replay_dropped_without_raise(self):
        client = self._make_client()
        client._last_heard_event_id = 10
        client._confirmed_floor_at_stream_bind = 5

        async def run():
            return await client._parse_sse_payload(
                'id: 7\ndata: {"id":1,"response":"diff","json":{}}\n\n'
            )

        self.assertIsNone(asyncio.run(run()))
        self.assertEqual(client._last_heard_event_id, 10)

    def test_frame_at_or_below_snapshot_raises_regression(self):
        for event_id in (5, 3):
            with self.subTest(event_id=event_id):
                client = self._make_client()
                client._last_heard_event_id = 10
                client._confirmed_floor_at_stream_bind = 5

                async def run():
                    await client._parse_sse_payload(f"id: {event_id}\n\n")

                with self.assertRaises(tlon_api.TlonChannelError) as raised:
                    asyncio.run(run())
                self.assertIn("event-id regression", str(raised.exception))

    def test_fresh_floor_is_inert(self):
        client = self._make_client()
        self.assertEqual(client._confirmed_floor_at_stream_bind, -1)

        async def run():
            return await client._parse_sse_payload("id: 0\n\n")

        self.assertIsNone(asyncio.run(run()))
        self.assertEqual(client._last_heard_event_id, 0)

    def test_open_resets_detection_state(self):
        client = self._make_client()
        client._session = FakeActionSession()
        client._last_confirmed_ack_event_id = 9
        client._confirmed_floor_at_stream_bind = 9
        client._action_floors[3] = 1
        client._genesis_action_id = 3
        client._last_event_frame_at = 12345.0

        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            asyncio.run(client.open())

        self.assertEqual(client._last_confirmed_ack_event_id, -1)
        self.assertEqual(client._confirmed_floor_at_stream_bind, -1)
        self.assertIsNone(client._last_event_frame_at)
        # The fresh generation records only its own genesis helm-hi.
        self.assertEqual(client._genesis_action_id, 1)
        self.assertEqual(client._action_floors, {1: -1})

    # ── floor ledger ─────────────────────────────────────────────────────

    def test_poke_subscribe_and_open_record_floors_before_send(self):
        client = self._make_client()
        session = FakeChannelSession()
        client._session = session

        async def run():
            await client.open()
            await client.subscribe("channels", "/v2")
            client._last_heard_event_id = 7
            await client.poke("hood", "helm-hi", "probe")

        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            asyncio.run(run())

        self.assertEqual(client._genesis_action_id, 1)
        self.assertEqual(client._action_floors, {1: -1, 2: -1, 3: 7})

    def test_ack_does_not_record_floor(self):
        client = self._make_client()
        client._session = FakeActionSession()
        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            asyncio.run(client._ack(3))
        self.assertEqual(client._action_floors, {})

    def test_healthy_ack_pops_only_its_own_entry(self):
        client = self._make_client()
        client._action_floors.update({1: -1, 2: -1})

        async def run():
            return await client._parse_sse_payload(
                'id: 5\ndata: {"id":1,"response":"poke"}\n\n'
            )

        self.assertIsNone(asyncio.run(run()))
        self.assertEqual(client._action_floors, {2: -1})
        self.assertEqual(client._last_heard_event_id, 5)

    def test_nack_also_pops_entry(self):
        client = self._make_client()
        client._action_floors[1] = -1

        async def run():
            return await client._parse_sse_payload(
                'id: 5\ndata: {"id":1,"response":"poke","err":"boom"}\n\n'
            )

        self.assertIsNone(asyncio.run(run()))
        self.assertEqual(client._action_floors, {})

    def test_idless_or_invalid_event_id_frame_neither_judges_nor_pops(self):
        for payload in (
            'data: {"id":1,"response":"poke"}\n\n',
            'id: 12x\ndata: {"id":1,"response":"poke"}\n\n',
        ):
            with self.subTest(payload=payload):
                client = self._make_client()
                client._action_floors[1] = -1
                client._genesis_action_id = 2

                async def run():
                    return await client._parse_sse_payload(payload)

                self.assertIsNone(asyncio.run(run()))
                self.assertEqual(client._action_floors, {1: -1})
                self.assertEqual(client._last_heard_event_id, -1)

    def test_optional_sub_nack_pops_floor_alongside_the_sub(self):
        client = self._make_client()
        client._subscriptions[3] = ("steward", "/v1/lens")
        client._optional_subscriptions.add(3)
        client._action_floors[3] = -1

        async def run():
            return await client._parse_sse_payload(
                'id: 4\ndata: {"id":3,"response":"subscribe","err":"no-agent"}\n\n'
            )

        self.assertIsNone(asyncio.run(run()))
        self.assertEqual(client._action_floors, {})
        self.assertNotIn(3, client._subscriptions)

    def test_action_ack_regression_raises(self):
        # The catch-up killer: a floor recorded at cursor 5, acked at event 0
        # by a revived generation. The cursor matches the floor (a floor is
        # the cursor at send time), which also pins the ordering property:
        # with the detector after the replay-drop, event 0 <= cursor 5 would
        # be silently discarded instead of raising.
        client = self._make_client()
        client._last_heard_event_id = 5
        client._action_floors[7] = 5
        client._genesis_action_id = 7

        async def run_zero():
            await client._parse_sse_payload(
                'id: 0\ndata: {"id":7,"response":"poke"}\n\n'
            )

        with self.assertRaises(tlon_api.TlonChannelError) as raised:
            asyncio.run(run_zero())
        self.assertIn("action ack regressed", str(raised.exception))

        # A non-zero regressed id, again with the cursor at the floor.
        client = self._make_client()
        client._last_heard_event_id = 2
        client._action_floors[7] = 2
        client._genesis_action_id = 7

        async def run_regressed():
            await client._parse_sse_payload(
                'id: 1\ndata: {"id":7,"response":"poke"}\n\n'
            )

        with self.assertRaises(tlon_api.TlonChannelError):
            asyncio.run(run_regressed())

    def test_failed_send_keeps_floor_entry(self):
        client = self._make_client()
        client._session = FakeActionSession(status=503)

        async def run():
            try:
                await client.poke("hood", "helm-hi", "x")
            except ConnectionError:
                pass

        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            asyncio.run(run())
        # Delivery is ambiguous: the action may have landed and revived a
        # reaped channel.
        self.assertIn(client._action_counter, client._action_floors)

    def test_floor_setdefault_does_not_overwrite(self):
        client = self._make_client()
        client._last_heard_event_id = 3
        client._record_action_floor(7)
        client._last_heard_event_id = 9
        client._record_action_floor(7)
        self.assertEqual(client._action_floors[7], 3)

    def test_cap_fail_closed_skips_insert_condemns_and_still_sends(self):
        client = self._make_client()
        session = FakeActionSession()
        client._session = session
        client._action_floors.update(
            {100_000 + i: -1 for i in range(tlon_api.ACTION_FLOOR_CAP)}
        )

        async def run():
            return await client.poke("hood", "helm-hi", "x")

        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            poke_id = asyncio.run(run())

        self.assertNotIn(poke_id, client._action_floors)
        self.assertEqual(len(client._action_floors), tlon_api.ACTION_FLOOR_CAP)
        self.assertIsInstance(client._condemned, tlon_api.TlonChannelError)
        self.assertEqual(len(session.put_calls), 1)

    def test_poke_only_client_records_no_detector_state(self):
        client = self._make_client(reap_detection=False)
        session = FakeActionSession()
        client._session = session
        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            for _ in range(3):
                asyncio.run(client.poke("steward", "steward-action-1", {}))
        self.assertEqual(client._action_floors, {})
        self.assertIsNone(client._condemned)

        # No cap applies: a full ledger stays untouched and never condemns.
        client._action_floors.update(
            {i: -1 for i in range(tlon_api.ACTION_FLOOR_CAP)}
        )
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            asyncio.run(client.poke("steward", "steward-action-1", {}))
        self.assertEqual(len(client._action_floors), tlon_api.ACTION_FLOOR_CAP)
        self.assertIsNone(client._condemned)

    # ── genesis clause ───────────────────────────────────────────────────

    def test_genesis_ack_at_event_zero_on_virgin_cursor_passes(self):
        client = self._make_client()
        client._genesis_action_id = 1

        async def run():
            return await client._parse_sse_payload(
                'id: 0\ndata: {"id":1,"response":"poke"}\n\n'
            )

        self.assertIsNone(asyncio.run(run()))
        self.assertEqual(client._last_heard_event_id, 0)

    def test_healthy_full_bootstrap_passes_end_to_end(self):
        # The live-verified ordering: event 0 = helm-hi ack, subscribe acks
        # at 1..6 in send order.
        client = self._make_client()
        session = FakeChannelSession()
        client._session = session

        async def run():
            await client.open()
            for app, path in (
                ("channels", "/v2"),
                ("chat", "/v3"),
                ("settings", "/desk/moltbot"),
                ("groups", "/v1/foreigns"),
                ("contacts", "/v1/news"),
                ("steward", "/v1/lens"),
            ):
                await client.subscribe(app, path)
            try:
                async for _ in client.events():
                    pass
            except ConnectionError:
                pass

        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            asyncio.run(run())

        self.assertEqual(client._last_heard_event_id, 6)
        self.assertEqual(client._action_floors, {})
        self.assertIsNone(client._condemned)

    def test_setup_subscribe_acked_at_event_zero_raises(self):
        # A reap between the sequential setup PUTs: the reviving subscribe is
        # not the genesis action.
        client = self._make_client()
        client._genesis_action_id = 1

        async def run():
            await client._parse_sse_payload(
                'id: 0\ndata: {"id":2,"response":"subscribe"}\n\n'
            )

        with self.assertRaises(tlon_api.TlonChannelError) as raised:
            asyncio.run(run())
        self.assertIn("non-genesis", str(raised.exception))

    def test_catchup_window_poke_acked_at_event_zero_raises(self):
        client = self._make_client()
        client._genesis_action_id = 1

        async def run():
            await client._parse_sse_payload(
                'id: 0\ndata: {"id":5,"response":"poke"}\n\n'
            )

        with self.assertRaises(tlon_api.TlonChannelError):
            asyncio.run(run())

    def test_advanced_cursor_immune_to_genesis_clause(self):
        client = self._make_client()
        client._genesis_action_id = 1
        client._last_heard_event_id = 3

        async def run():
            return await client._parse_sse_payload(
                'id: 0\ndata: {"id":5,"response":"poke"}\n\n'
            )

        self.assertIsNone(asyncio.run(run()))
        self.assertEqual(client._last_heard_event_id, 3)

    def test_resume_preserves_genesis_id(self):
        client = self._make_client()
        session = FakeChannelSession()
        client._session = session

        async def run():
            await client.open()
            for _ in range(2):
                try:
                    async for _ in client.events():
                        pass
                except ConnectionError:
                    pass

        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            asyncio.run(run())
        self.assertEqual(client._genesis_action_id, 1)

    # ── condemn latch ────────────────────────────────────────────────────

    def test_rebuild_condemnation_raises_on_next_payload_including_keepalive(self):
        client = self._make_client()
        client.condemn(tlon_api.TlonChannelError("forced rebuild"))

        async def run():
            await client._parse_sse_payload(": keepalive")

        with self.assertRaises(tlon_api.TlonChannelError) as raised:
            asyncio.run(run())
        self.assertEqual(str(raised.exception), "forced rebuild")
        # Consumed on raise: the next payload parses normally.
        self.assertIsNone(client._condemned)

        async def run_again():
            return await client._parse_sse_payload("id: 1\n\n")

        self.assertIsNone(asyncio.run(run_again()))
        self.assertEqual(client._last_heard_event_id, 1)

    def test_stale_condemnation_held_through_detectors_for_rebuild_evidence(self):
        # A frame carrying regression evidence while a resume condemnation is
        # latched must raise the rebuild, not the stale error.
        client = self._make_client()
        client._confirmed_floor_at_stream_bind = 5
        client.condemn(tlon_api.TlonStreamStaleError("stale"))

        async def run():
            await client._parse_sse_payload('id: 3\ndata: {"id":1,"response":"poke"}\n\n')

        with self.assertRaises(tlon_api.TlonChannelError) as raised:
            asyncio.run(run())
        self.assertNotIsInstance(raised.exception, tlon_api.TlonStreamStaleError)
        self.assertIn("event-id regression", str(raised.exception))

    def test_stale_condemnation_raises_before_cursor_advance(self):
        # Lossless: the frame was not acked, so the resume GET redelivers it.
        client = self._make_client()
        client.condemn(tlon_api.TlonStreamStaleError("stale"))

        async def run():
            await client._parse_sse_payload(
                'id: 5\ndata: {"id":1,"response":"diff","json":{}}\n\n'
            )

        with self.assertRaises(tlon_api.TlonStreamStaleError):
            asyncio.run(run())
        self.assertEqual(client._last_heard_event_id, -1)

    def test_rebuild_condemnation_survives_bind(self):
        # Not cleared at bind: a condemnation set during an outage forces its
        # rebuild on the resumed stream's first payload.
        client = self._make_client()
        client.condemn(tlon_api.TlonChannelError("forced rebuild"))
        session = FakeChannelSession()
        client._session = session
        session.generation(client.channel_url).buffered.append(b": keepalive\n\n")

        exc = self._run_events(client)
        self.assertIsInstance(exc, tlon_api.TlonChannelError)
        self.assertEqual(str(exc), "forced rebuild")

    def test_stale_condemnation_cleared_by_successful_bind(self):
        # A stale condemnation demands a resume; if the stream faults and
        # re-binds on its own first, that bind satisfies it — raising it on
        # the recovered stream's first payload would tear down a healthy
        # stream for nothing.
        client = self._make_client()
        client.condemn(tlon_api.TlonStreamStaleError("stale"))
        session = FakeChannelSession()
        client._session = session
        session.generation(client.channel_url).buffered.append(
            b'id: 1\ndata: {"id":1,"response":"diff","json":{}}\n\n'
        )

        exc = self._run_events(client)
        self.assertNotIsInstance(exc, tlon_api.TlonStreamStaleError)
        self.assertIsInstance(exc, ConnectionError)
        self.assertIsNone(client._condemned)
        self.assertEqual(client._last_heard_event_id, 1)

    def test_channel_error_outranks_stale_and_is_never_downgraded(self):
        client = self._make_client()
        client.condemn(tlon_api.TlonStreamStaleError("stale-1"))
        self.assertIsInstance(client._condemned, tlon_api.TlonStreamStaleError)
        client.condemn(tlon_api.TlonChannelError("rebuild"))
        self.assertIsInstance(client._condemned, tlon_api.TlonChannelError)
        # A later stale condemnation cannot downgrade the rebuild.
        client.condemn(tlon_api.TlonStreamStaleError("stale-2"))
        self.assertIsInstance(client._condemned, tlon_api.TlonChannelError)
        self.assertEqual(str(client._condemned), "rebuild")

    # ── liveness/bind plumbing ───────────────────────────────────────────

    def test_last_event_frame_at_refresh_rules(self):
        client = self._make_client()
        self.assertIsNone(client.last_event_frame_at)

        async def parse(payload):
            return await client._parse_sse_payload(payload)

        asyncio.run(parse("id: 1\n\n"))
        self.assertIsNotNone(client.last_event_frame_at)

        client._last_event_frame_at = None
        asyncio.run(parse('data: {"id":1,"response":"diff","json":{}}\n\n'))
        self.assertIsNotNone(client.last_event_frame_at)

        # Replay-dropped frames still refresh the clock.
        client._last_heard_event_id = 10
        client._last_event_frame_at = None
        asyncio.run(parse("id: 5\n\n"))
        self.assertIsNotNone(client.last_event_frame_at)

        # Keepalive-only payloads deliberately do not.
        client._last_event_frame_at = None
        asyncio.run(parse(": keepalive"))
        self.assertIsNone(client.last_event_frame_at)

    def test_bind_resets_liveness_baseline(self):
        client = self._make_client()
        client._last_event_frame_at = time.monotonic() - 10000
        session = FakeChannelSession()
        client._session = session
        # Only a keepalive arrives after the resume: the clock must show the
        # bind baseline, not the ancient pre-outage frame.
        session.generation(client.channel_url).buffered.append(b": keepalive\n\n")

        self._run_events(client)
        self.assertGreater(client.last_event_frame_at, time.monotonic() - 5)

    def test_stream_bound_lifecycle(self):
        client = self._make_client()
        session = FakeChannelSession()
        client._session = session
        gen = session.generation(client.channel_url)
        gen.buffered.append(sse_frame(1, {"response": "diff", "id": 1, "json": {}}))
        gen.buffered.append(sse_frame(2, {"response": "diff", "id": 1, "json": {}}))
        bound_at_open = []

        def on_open():
            bound_at_open.append(client.stream_bound)

        async def run_normal():
            try:
                async for _ in client.events(on_open=on_open):
                    pass
            except ConnectionError:
                pass

        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            asyncio.run(run_normal())
        self.assertEqual(bound_at_open, [True])
        self.assertFalse(client.stream_bound)

        # Cleared on aclose mid-stream.
        gen.buffered.append(sse_frame(3, {"response": "diff", "id": 1, "json": {}}))
        gen.buffered.append(sse_frame(4, {"response": "diff", "id": 1, "json": {}}))

        async def run_aclose():
            stream = client.events()
            async for _ in stream:
                await stream.aclose()
                break

        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            asyncio.run(run_aclose())
        self.assertFalse(client.stream_bound)

        # Cleared on a detector error mid-stream. The confirmed floor must be
        # seeded via _last_confirmed_ack_event_id (events() re-snapshots the
        # bind floor from it), and the detector's exact error is asserted so
        # an ordinary EOF cannot satisfy this case vacuously.
        client._last_confirmed_ack_event_id = 100
        gen.buffered.append(sse_frame(5, {"response": "diff", "id": 1, "json": {}}))

        async def run_error():
            async for _ in client.events():
                pass

        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            with self.assertRaises(tlon_api.TlonChannelError) as raised:
                asyncio.run(run_error())
        self.assertIn("event-id regression", str(raised.exception))
        self.assertFalse(client.stream_bound)

    # ── strict id parse ──────────────────────────────────────────────────

    def test_strict_event_id_parse(self):
        # The 5000-digit id passes isdigit() but would make int() RAISE under
        # CPython's int-str conversion limit \u2014 it must be treated as id-less,
        # not kill the stream in a resume/replay loop.
        for bad in ("-5", "+5", "1_000", "12x", "\u0665", "9" * 5000, "1" * 19):
            with self.subTest(bad=bad):
                client = self._make_client()

                async def run():
                    return await client._parse_sse_payload(f"id: {bad}\n\n")

                self.assertIsNone(asyncio.run(run()))
                self.assertEqual(client._last_heard_event_id, -1)

        for good, expected in (("0", 0), ("5", 5)):
            with self.subTest(good=good):
                client = self._make_client()

                async def run():
                    return await client._parse_sse_payload(f"id: {good}\n\n")

                self.assertIsNone(asyncio.run(run()))
                self.assertEqual(client._last_heard_event_id, expected)

    def test_boolean_action_id_is_ignored(self):
        client = self._make_client()
        client._genesis_action_id = 1
        client._action_floors[7] = 9

        async def run():
            return await client._parse_sse_payload(
                'id: 0\ndata: {"id":true,"response":"poke"}\n\n'
            )

        self.assertIsNone(asyncio.run(run()))
        self.assertEqual(client._action_floors, {7: 9})
        self.assertEqual(client._last_heard_event_id, 0)

    # ── closed latch + task retention ────────────────────────────────────

    def test_closed_latch_blocks_public_entry_points_without_reminting(self):
        client = self._make_client()
        client._session = FakeActionSession()

        async def drain_events():
            async for _ in client.events():
                pass

        asyncio.run(client.close(graceful=False))
        for coro in (
            client.poke("hood", "helm-hi", "x"),
            client.subscribe("channels", "/v2"),
            client.scry("/contacts/v1/self"),
            client.authenticate(),
            drain_events(),
        ):
            with self.subTest(coro=coro):
                with self.assertRaisesRegex(ConnectionError, "closed"):
                    asyncio.run(coro)
        self.assertIsNone(client._session)
        self.assertIsNone(client.channel_id)

    def test_graceful_close_still_sends_unsubscribe_and_delete(self):
        class RecordingGracefulSession:
            def __init__(self):
                self.put_payloads = []
                self.delete_urls = []

            def put(self, url, *, json, headers, timeout):
                self.put_payloads.append(json)
                return FakeActionResponse(204)

            async def delete(self, url, *, timeout):
                self.delete_urls.append(url)
                return FakeActionResponse(204)

            async def close(self):
                pass

        client = self._make_client()
        session = RecordingGracefulSession()
        client._session = session
        client._subscriptions[1] = ("channels", "/v2")

        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            asyncio.run(client.close())

        self.assertEqual(len(session.put_payloads), 1)
        self.assertEqual(session.put_payloads[0][0]["action"], "unsubscribe")
        self.assertEqual(session.delete_urls, [client.url + "/~/channel/test-channel"])

    def test_inflight_ack_task_cancelled_and_awaited_on_close(self):
        class BlockingPutResponse:
            async def __aenter__(self):
                # Park until cancelled; a bare future is loop-portable
                # (asyncio.Event binds to a loop at construction on 3.10).
                await asyncio.get_running_loop().create_future()
                return self

            async def __aexit__(self, exc_type, exc, tb):
                return False

            async def text(self):
                return ""

        class BlockingPutSession:
            def __init__(self):
                self.puts = 0

            def put(self, url, *, json, headers, timeout):
                self.puts += 1
                return BlockingPutResponse()

            async def close(self):
                pass

        client = self._make_client()
        session = BlockingPutSession()
        client._session = session

        async def run():
            await client._parse_sse_payload("id: 21\n\n")
            await asyncio.sleep(0)
            await asyncio.sleep(0)
            (ack_task,) = list(client._ack_tasks)
            await client.close(graceful=False)
            return ack_task

        fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
        with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
            ack_task = asyncio.run(run())
        self.assertTrue(ack_task.cancelled())

    def test_ack_tasks_retained_until_done(self):
        client = self._make_client()
        client._session = FakeActionSession()

        async def run():
            fake_aiohttp = types.SimpleNamespace(ClientTimeout=FakeClientTimeout)
            with patch.dict(sys.modules, {"aiohttp": fake_aiohttp}):
                await client._parse_sse_payload("id: 21\n\n")
                retained = len(client._ack_tasks)
                for _ in range(5):
                    await asyncio.sleep(0)
                return retained, len(client._ack_tasks)

        retained, after = asyncio.run(run())
        self.assertEqual(retained, 1)
        self.assertEqual(after, 0)

    # ── silent-socket clamp ──────────────────────────────────────────────

    def test_silent_socket_clamp_on_get_timeout(self):
        cases = (
            # (read timeout, stale threshold, expected sock_read)
            ("600", "180", 180.0),
            ("600", "5", tlon_api.KEEPALIVE_SAFE_SECONDS),
            ("600", "0", 600.0),
            (None, None, tlon_api.DEFAULT_SSE_READ_TIMEOUT_SECONDS),
        )
        for read_timeout, stale_threshold, expected in cases:
            with self.subTest(read_timeout=read_timeout, stale_threshold=stale_threshold):
                client = self._make_client(
                    read_timeout=read_timeout, stale_threshold=stale_threshold
                )
                session = FakeSSESession(responses=[(200, [])])
                client._session = session
                self._run_events(client)
                self.assertEqual(session.timeout.sock_read, expected)


if __name__ == "__main__":
    unittest.main()

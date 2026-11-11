import asyncio
import importlib.util
import json
import os
import sys
import types
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch


PACKAGE_DIR = Path(__file__).parent
PACKAGE_NAME = "hermes_tlon_adapter_owner_timezone_testpkg"

package = types.ModuleType(PACKAGE_NAME)
package.__path__ = [str(PACKAGE_DIR)]
sys.modules[PACKAGE_NAME] = package


def load_module(name):
    module_name = f"{PACKAGE_NAME}.{name}"
    spec = importlib.util.spec_from_file_location(module_name, PACKAGE_DIR / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


tlon_api = load_module("tlon_api")
owner_timezone = load_module("owner_timezone")


class FakeHermesTime(types.ModuleType):
    def __init__(self):
        super().__init__("hermes_time")
        self.resets = 0

    def reset_cache(self):
        self.resets += 1


class OwnerTimezoneTestCase(unittest.TestCase):
    def setUp(self):
        self.hermes_time = FakeHermesTime()
        modules = patch.dict(sys.modules, {"hermes_time": self.hermes_time})
        modules.start()
        self.addCleanup(modules.stop)
        env = patch.dict(os.environ, {"HERMES_TIMEZONE": "America/Chicago"})
        env.start()
        self.addCleanup(env.stop)
        owner_timezone._baseline = owner_timezone._UNSET
        self.addCleanup(setattr, owner_timezone, "_baseline", owner_timezone._UNSET)


class ValidTimezoneTests(unittest.TestCase):
    def test_accepts_iana_names_and_utc(self):
        for name in ("Asia/Tokyo", "UTC", "America/Argentina/Buenos_Aires", "Etc/GMT+9"):
            with self.subTest(name=name):
                self.assertEqual(owner_timezone.valid_timezone(name), name)
        self.assertEqual(owner_timezone.valid_timezone("  Europe/Berlin "), "Europe/Berlin")

    def test_rejects_abbreviations_offsets_and_unknown_zones(self):
        for raw in ("PST", "EST", "+09:00", "GMT+9", "", "../etc/passwd", "A/" + "b" * 64):
            with self.subTest(raw=raw):
                with self.assertRaisesRegex(ValueError, "is not an IANA timezone name"):
                    owner_timezone.valid_timezone(raw)
        with self.assertRaisesRegex(ValueError, 'Unknown timezone "Mars/Olympus_Mons"'):
            owner_timezone.valid_timezone("Mars/Olympus_Mons")

    def test_settings_value_must_be_a_valid_name(self):
        self.assertEqual(owner_timezone.settings_timezone("Asia/Tokyo"), "Asia/Tokyo")
        for value in (None, 9, "PST", "Mars/Olympus_Mons"):
            with self.subTest(value=value):
                self.assertIsNone(owner_timezone.settings_timezone(value))


class DescribeNowTests(unittest.TestCase):
    def test_matches_openclaw_wording(self):
        at = datetime(2026, 10, 16, 18, 0, tzinfo=timezone.utc)
        self.assertEqual(
            owner_timezone.describe_now("Asia/Tokyo", at),
            "Saturday, October 17, 2026 at 03:00 GMT+09:00",
        )
        self.assertEqual(
            owner_timezone.describe_now("UTC", at),
            "Friday, October 16, 2026 at 18:00 GMT",
        )
        self.assertEqual(
            owner_timezone.describe_now("America/St_Johns", at),
            "Friday, October 16, 2026 at 15:30 GMT-02:30",
        )


class ApplyOwnerTimezoneTests(OwnerTimezoneTestCase):
    def test_apply_switches_the_running_zone_and_resets_hermes_cache(self):
        owner_timezone.apply_owner_timezone("Asia/Tokyo")

        self.assertEqual(os.environ["HERMES_TIMEZONE"], "Asia/Tokyo")
        self.assertEqual(self.hermes_time.resets, 1)

    def test_clearing_restores_the_boot_zone(self):
        owner_timezone.apply_owner_timezone("Asia/Tokyo")
        owner_timezone.apply_owner_timezone(None)

        self.assertEqual(os.environ["HERMES_TIMEZONE"], "America/Chicago")
        self.assertEqual(self.hermes_time.resets, 2)

    def test_clearing_restores_an_unset_boot_zone(self):
        del os.environ["HERMES_TIMEZONE"]
        owner_timezone.apply_owner_timezone("Asia/Tokyo")
        owner_timezone.apply_owner_timezone(None)

        self.assertNotIn("HERMES_TIMEZONE", os.environ)

    def test_unchanged_zone_leaves_the_cache_alone(self):
        owner_timezone.apply_owner_timezone(None)
        owner_timezone.apply_owner_timezone("Asia/Tokyo")
        owner_timezone.apply_owner_timezone("Asia/Tokyo")

        self.assertEqual(self.hermes_time.resets, 1)


class SetTimezoneToolTests(OwnerTimezoneTestCase):
    def setUp(self):
        super().setUp()
        self.calls = []
        self.returncode = 0
        self.config = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
                "TLON_CLI": "tlon-test",
            }
        )

    async def runner(self, command, env, timeout, _on_deadline):
        self.calls.append(tuple(command))
        return tlon_api.TlonProcessResult(returncode=self.returncode, stderr="poke failed")

    def run_tool(self, params):
        return json.loads(
            asyncio.run(
                owner_timezone.execute_set_timezone_tool(
                    params,
                    config=self.config,
                    runner=self.runner,
                    now=datetime(2026, 10, 16, 18, 0, tzinfo=timezone.utc),
                )
            )
        )

    def test_saves_the_zone_on_the_ship_then_applies_it(self):
        payload = self.run_tool({"timezone": " Asia/Tokyo "})

        self.assertTrue(payload["success"])
        self.assertEqual(
            self.calls,
            [("tlon-test", "settings", "set", "ownerTimezone", '"Asia/Tokyo"')],
        )
        self.assertEqual(os.environ["HERMES_TIMEZONE"], "Asia/Tokyo")
        self.assertEqual(self.hermes_time.resets, 1)
        self.assertTrue(
            payload["result"].startswith(
                "Timezone set to Asia/Tokyo. It is now Saturday, October 17, "
                "2026 at 03:00 GMT+09:00 there."
            )
        )

    def test_invalid_zone_changes_nothing(self):
        payload = self.run_tool({"timezone": "PST"})

        self.assertFalse(payload["success"])
        self.assertIn("is not an IANA timezone name", payload["error"])
        self.assertEqual(self.calls, [])
        self.assertEqual(os.environ["HERMES_TIMEZONE"], "America/Chicago")

    def test_failed_save_leaves_the_running_zone(self):
        self.returncode = 1
        payload = self.run_tool({"timezone": "Asia/Tokyo"})

        self.assertFalse(payload["success"])
        self.assertIn("nothing changed", payload["error"])
        self.assertEqual(os.environ["HERMES_TIMEZONE"], "America/Chicago")
        self.assertEqual(self.hermes_time.resets, 0)


if __name__ == "__main__":
    unittest.main()

import asyncio
import importlib.util
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path

PACKAGE_DIR = Path(__file__).parent
PACKAGE_NAME = "hermes_tlon_adapter_version_testpkg"

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


version = load_module("version")


class CommandDetectionTests(unittest.TestCase):
    def test_command_detection(self):
        self.assertTrue(version.is_tlon_version_command("/tlon-version"))
        self.assertTrue(version.is_tlon_version_command("  /Tlon-Version  "))
        self.assertTrue(version.is_tlon_version_command("/tlon-version please"))
        self.assertFalse(version.is_tlon_version_command("/tlon-versions"))
        self.assertFalse(version.is_tlon_version_command("tlon-version"))


class PluginVersionTests(unittest.TestCase):
    def test_reads_package_json(self):
        self.assertEqual(version.plugin_version(), "0.1.0")

    def test_missing_or_invalid_package_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            self.assertEqual(version.plugin_version(tmp_path), "unknown")
            (tmp_path / "package.json").write_text("not json", encoding="utf-8")
            self.assertEqual(version.plugin_version(tmp_path), "unknown")
            (tmp_path / "package.json").write_text(json.dumps({"name": "x"}), encoding="utf-8")
            self.assertEqual(version.plugin_version(tmp_path), "unknown")


class FingerprintTests(unittest.TestCase):
    def make_tree(self, tmp):
        root = Path(tmp)
        (root / "adapter.py").write_text("code-a", encoding="utf-8")
        (root / "owner_listen.py").write_text("code-b", encoding="utf-8")
        (root / "test_adapter.py").write_text("tests", encoding="utf-8")
        (root / "plugin.yaml").write_text("name: tlon", encoding="utf-8")
        (root / "prompts" / "shared").mkdir(parents=True)
        (root / "prompts" / "shared" / "identity.md").write_text("soul", encoding="utf-8")
        return root

    def test_runtime_files_excludes_tests_includes_yaml_and_prompts(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.make_tree(tmp)
            rels = [path.relative_to(root).as_posix() for path in version.runtime_files(root)]
            self.assertEqual(
                rels,
                [
                    "adapter.py",
                    "owner_listen.py",
                    "plugin.yaml",
                    "prompts/shared/identity.md",
                ],
            )

    def test_fingerprint_is_deterministic_and_content_sensitive(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.make_tree(tmp)
            first = version.content_fingerprint(root)
            second = version.content_fingerprint(root)
            self.assertEqual(first, second)
            self.assertRegex(first, r"^fp1:[0-9a-f]{12}$")

            (root / "adapter.py").write_text("code-a-changed", encoding="utf-8")
            self.assertNotEqual(version.content_fingerprint(root), first)

    def test_fingerprint_ignores_test_file_changes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.make_tree(tmp)
            before = version.content_fingerprint(root)
            (root / "test_adapter.py").write_text("changed tests", encoding="utf-8")
            self.assertEqual(version.content_fingerprint(root), before)


class GitSourceTests(unittest.TestCase):
    def test_inside_repo_reports_branch_sha_and_state(self):
        source = asyncio.run(version.git_source())
        self.assertIsNotNone(source)
        self.assertIn(" @ ", source)
        self.assertRegex(source, r"\((clean|dirty)\)$")

    def test_outside_repo_returns_none(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertIsNone(asyncio.run(version.git_source(Path(tmp))))


class FormatReplyTests(unittest.TestCase):
    def test_field_per_line_format(self):
        reply = version.format_version_reply(
            adapter_version="0.1.0",
            source="main @ abc1234 (clean)",
            fingerprint="fp1:0123456789ab",
            cli_version="0.3.2",
        )
        self.assertEqual(
            reply.splitlines(),
            [
                "Adapter: 0.1.0",
                "Source: main @ abc1234 (clean)",
                "Fingerprint: fp1:0123456789ab",
                "Tlon CLI: 0.3.2",
            ],
        )

    def test_no_git_fallback(self):
        reply = version.format_version_reply(
            adapter_version="0.1.0",
            source=None,
            fingerprint="fp1:0123456789ab",
            cli_version="0.3.2",
        )
        self.assertIn("Source: no git checkout", reply)


if __name__ == "__main__":
    unittest.main()

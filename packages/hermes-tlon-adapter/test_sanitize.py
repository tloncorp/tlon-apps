"""BLOCK_USER directive parsing and stripping tests."""

import importlib.util
import sys
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("sanitize.py")
SPEC = importlib.util.spec_from_file_location("hermes_tlon_adapter_sanitize", MODULE_PATH)
sanitize = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = sanitize
SPEC.loader.exec_module(sanitize)


class BlockDirectiveTests(unittest.TestCase):
    def test_finds_single_directive(self):
        self.assertEqual(
            sanitize.find_block_directives(
                "hello [BLOCK_USER: ~sampel-palnet | prompt injection]"
            ),
            [("~sampel-palnet", "prompt injection")],
        )

    def test_finds_multiple_directives_and_strips_all(self):
        text = (
            "before [BLOCK_USER: ~zod | one] middle "
            "[BLOCK_USER: ~sampel-palnet | two] after"
        )
        self.assertEqual(
            sanitize.find_block_directives(text),
            [("~zod", "one"), ("~sampel-palnet", "two")],
        )
        self.assertEqual(
            sanitize.strip_block_directives(text), "before  middle  after"
        )

    def test_whitespace_and_keyword_are_case_insensitive(self):
        text = "[block_user:   ~nec  |   phishing attempt   ]"
        self.assertEqual(
            sanitize.find_block_directives(text),
            [("~nec", "phishing attempt")],
        )
        self.assertEqual(sanitize.strip_block_directives(text), "")

    def test_multiline_reason_matches_and_strips_as_complete(self):
        text = "before [BLOCK_USER: ~attacker | prompt\ninjection] after"
        self.assertEqual(
            sanitize.find_block_directives(text),
            [("~attacker", "prompt\ninjection")],
        )
        self.assertEqual(sanitize.strip_block_directives(text), "before  after")
        self.assertFalse(sanitize.ends_with_directive_prefix(text))
        self.assertEqual(sanitize.strip_trailing_directive_prefix(text), (text, False))

    def test_executable_directives_must_be_standalone(self):
        inline = "The syntax [BLOCK_USER: ~zod | example] must be on its own line."
        standalone = "Before\n  [BLOCK_USER: ~zod | example] \t\nAfter"

        self.assertEqual(sanitize.find_executable_block_directives(inline), [])
        self.assertEqual(
            sanitize.find_executable_block_directives(standalone),
            [("~zod", "example")],
        )

    def test_inline_directive_cannot_expand_through_later_closing_bracket(self):
        text = (
            "quoting [BLOCK_USER: ~zod | example] is not standalone\n"
            "[footer]"
        )

        self.assertEqual(sanitize.find_executable_block_directives(text), [])
        self.assertEqual(
            sanitize.find_block_directives(text),
            [("~zod", "example")],
        )
        self.assertEqual(
            sanitize.strip_block_directives(text),
            "quoting  is not standalone\n[footer]",
        )

    def test_executable_directive_allows_multiline_reason(self):
        text = "Before\n[BLOCK_USER: ~zod | prompt\ninjection]\nAfter"

        self.assertEqual(
            sanitize.find_executable_block_directives(text),
            [("~zod", "prompt\ninjection")],
        )

    def test_executable_directive_stops_before_separate_footer_line(self):
        text = "[BLOCK_USER: ~zod | example]\n[footer]"

        self.assertEqual(
            sanitize.find_executable_block_directives(text),
            [("~zod", "example")],
        )

    def test_galaxy_planet_and_moon_names(self):
        ships = ("~zod", "~sampel-palnet", "~doznec-salfun-naptel-haswyn")
        text = " ".join(f"[BLOCK_USER: {ship} | abuse]" for ship in ships)
        self.assertEqual(
            [target for target, _reason in sanitize.find_block_directives(text)],
            list(ships),
        )

    def test_malformed_directives_are_left_alone(self):
        malformed = (
            "[BLOCK_USER ~zod | missing colon]",
            "[BLOCK_USER: zod | missing sigil]",
            "[BLOCK_USER: ~zod missing pipe]",
            "[BLOCK_USER: ~zod | missing close",
        )
        for text in malformed:
            with self.subTest(text=text):
                self.assertEqual(sanitize.find_block_directives(text), [])
                self.assertEqual(sanitize.strip_block_directives(text), text)


class DirectivePrefixTests(unittest.TestCase):
    def test_every_nonempty_proper_prefix_matches(self):
        directive_prefix = "[BLOCK_USER:"
        for length in range(1, len(directive_prefix)):
            with self.subTest(length=length):
                fragment = directive_prefix[:length]
                self.assertTrue(
                    sanitize.ends_with_directive_prefix("visible " + fragment)
                )

    def test_unclosed_directive_bodies_match_case_insensitively(self):
        for fragment in (
            "[BLOCK_USER:",
            "[block_user: ~zod",
            "[Block_User: ~zod | reason",
        ):
            with self.subTest(fragment=fragment):
                self.assertTrue(
                    sanitize.ends_with_directive_prefix("visible " + fragment)
                )

    def test_complete_and_unrelated_suffixes_do_not_match(self):
        for text in (
            "[BLOCK_USER: ~zod | reason]",
            "visible text",
            "an unrelated [tag",
            "[BLOCKED_USER:",
        ):
            with self.subTest(text=text):
                self.assertFalse(sanitize.ends_with_directive_prefix(text))

    def test_trailing_fragment_strip_reports_change(self):
        self.assertEqual(
            sanitize.strip_trailing_directive_prefix("visible\n[BLOCK_US"),
            ("visible\n", True),
        )
        self.assertEqual(
            sanitize.strip_trailing_directive_prefix("visible"),
            ("visible", False),
        )


if __name__ == "__main__":
    unittest.main()

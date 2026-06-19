import importlib.util
import sys
import types
import unittest
from pathlib import Path


PACKAGE_DIR = Path(__file__).parent
PACKAGE_NAME = "hermes_tlon_mention_testpkg"

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
mention = load_module("mention")


class BotMentionMatcherTests(unittest.TestCase):
    def matcher(self):
        terms = mention.build_bot_mention_terms(
            "~latter-bolden",
            aliases=("mr.arvo", "C++"),
            nickname="Jon",
        )
        return mention.BotMentionMatcher(terms)

    def test_matches_ship_bare_alias_and_nickname(self):
        matcher = self.matcher()

        self.assertTrue(matcher.mentioned("~latter-bolden can you help?"))
        self.assertTrue(matcher.mentioned("latter-bolden: can you help?"))
        self.assertTrue(matcher.mentioned("mr.arvo, can you help?"))
        self.assertTrue(matcher.mentioned("jon what's the weather?"))
        self.assertTrue(matcher.mentioned("C++ help"))

    def test_does_not_match_substrings(self):
        matcher = mention.BotMentionMatcher(
            mention.build_bot_mention_terms("~pen", nickname="jon")
        )

        self.assertFalse(matcher.mentioned("jonathan can you help?"))
        self.assertFalse(matcher.mentioned("the penpal meetup"))
        self.assertFalse(matcher.mentioned("~pen-pal should not wake"))

    def test_regex_escapes_aliases(self):
        matcher = mention.BotMentionMatcher(
            mention.build_bot_mention_terms("~pen", aliases=("mr.bot?", "[arvo]"))
        )

        self.assertTrue(matcher.mentioned("mr.bot? help"))
        self.assertTrue(matcher.mentioned("[arvo] help"))
        self.assertFalse(matcher.mentioned("mrXbot? help"))

    def test_strip_only_leading_wake(self):
        matcher = self.matcher()

        self.assertEqual(matcher.strip_leading("Jon: can you help?"), "can you help?")
        self.assertEqual(matcher.strip_leading("  ~latter-bolden, hello"), "hello")
        self.assertEqual(
            matcher.strip_leading("please ask Jon about the plan"),
            "please ask Jon about the plan",
        )
        self.assertEqual(matcher.strip_leading("jon"), "")

    def test_extract_profile_nickname(self):
        self.assertEqual(
            mention.extract_profile_nickname({"nickname": {"value": "Mr Arvo"}}),
            "Mr Arvo",
        )
        self.assertEqual(mention.extract_profile_nickname({"nickname": "Mr Arvo"}), "Mr Arvo")
        self.assertEqual(mention.extract_profile_nickname({"nickname": {"value": ""}}), "")


if __name__ == "__main__":
    unittest.main()

import importlib.util
import sys
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("attention.py")
SPEC = importlib.util.spec_from_file_location("hermes_tlon_attention", MODULE_PATH)
attention = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = attention
SPEC.loader.exec_module(attention)


class AttentionTests(unittest.TestCase):
    def decide(self, **kwargs):
        defaults = {
            "is_dm": False,
            "is_authorized": True,
            "has_text": True,
            "is_mentioned": False,
            "is_owner_blob": False,
            "is_free_response": False,
            "is_participated_thread": False,
        }
        defaults.update(kwargs)
        return attention.resolve_attention(attention.AttentionFacts(**defaults))

    def test_authorized_dm_dispatches(self):
        self.assertTrue(self.decide(is_dm=True).dispatch)

    def test_unauthorized_drops_even_with_attention_signal(self):
        decision = self.decide(
            is_authorized=False,
            is_mentioned=True,
            is_free_response=True,
            is_participated_thread=True,
        )

        self.assertFalse(decision.dispatch)
        self.assertEqual(decision.reason, "unauthorized")

    def test_group_attention_signals_dispatch(self):
        self.assertTrue(self.decide(is_mentioned=True).dispatch)
        self.assertTrue(self.decide(is_free_response=True).dispatch)
        self.assertTrue(self.decide(is_participated_thread=True).dispatch)

    def test_owner_blob_dispatches_in_group(self):
        decision = self.decide(is_owner_blob=True)

        self.assertTrue(decision.dispatch)
        self.assertEqual(decision.reason, "owner-blob")

    def test_owner_blob_preserves_existing_attention_reasons(self):
        self.assertEqual(
            self.decide(is_owner_blob=True, is_mentioned=True).reason,
            "mention",
        )
        self.assertEqual(
            self.decide(is_owner_blob=True, is_owner_listen=True).reason,
            "owner-listen",
        )
        self.assertEqual(
            self.decide(is_owner_blob=True, is_participated_thread=True).reason,
            "participated-thread",
        )
        self.assertEqual(
            self.decide(is_owner_blob=True, is_free_response=True).reason,
            "free-response",
        )

    def test_owner_blob_respects_authorization_and_content_guards(self):
        unauthorized = self.decide(is_owner_blob=True, is_authorized=False)
        empty = self.decide(is_owner_blob=True, has_text=False)

        self.assertFalse(unauthorized.dispatch)
        self.assertEqual(unauthorized.reason, "unauthorized")
        self.assertFalse(empty.dispatch)
        self.assertEqual(empty.reason, "empty")

    def test_unaddressed_or_empty_group_drops(self):
        self.assertFalse(self.decide().dispatch)
        self.assertFalse(self.decide(has_text=False, is_mentioned=True).dispatch)


if __name__ == "__main__":
    unittest.main()

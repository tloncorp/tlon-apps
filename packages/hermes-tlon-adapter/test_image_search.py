import asyncio
import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path


PACKAGE_DIR = Path(__file__).parent
PACKAGE_NAME = "hermes_tlon_image_search_testpkg"

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


image_search = load_module("image_search")


class ImageSearchTests(unittest.TestCase):
    def test_brave_key_accepts_new_and_legacy_env_names(self):
        self.assertEqual(
            image_search.brave_image_api_key({"BRAVE_SEARCH_API_KEY": "search-key"}),
            "search-key",
        )
        self.assertEqual(
            image_search.brave_image_api_key({"BRAVE_API_KEY": "legacy-key"}),
            "legacy-key",
        )
        self.assertEqual(
            image_search.brave_image_api_key(
                {"BRAVE_SEARCH_API_KEY": "search-key", "BRAVE_API_KEY": "legacy-key"}
            ),
            "search-key",
        )

    def test_missing_query_returns_error(self):
        async def run():
            return await image_search.execute_image_search_tool(
                {"query": " "},
                env={"BRAVE_SEARCH_API_KEY": "key"},
            )

        payload = json.loads(asyncio.run(run()))

        self.assertFalse(payload["success"])
        self.assertIn("query", payload["error"])

    def test_missing_api_key_returns_error_without_fetching(self):
        async def fetch_json(url, params, headers):
            raise AssertionError("should not fetch without an API key")

        async def run():
            return await image_search.execute_image_search_tool(
                {"query": "slug png"},
                env={},
                fetch_json=fetch_json,
            )

        payload = json.loads(asyncio.run(run()))

        self.assertFalse(payload["success"])
        self.assertIn("BRAVE_SEARCH_API_KEY", payload["error"])

    def test_search_returns_direct_image_urls_and_source_metadata(self):
        calls = []

        async def fetch_json(url, params, headers):
            calls.append((url, dict(params), dict(headers)))
            return {
                "results": [
                    {
                        "title": "Smiley face",
                        "url": "https://example.com/page",
                        "source": "https://example.com/smiley",
                        "properties": {
                            "url": "https://cdn.example.com/smiley.png",
                            "width": 512,
                            "height": 512,
                            "type": "image/png",
                        },
                    },
                    {
                        "title": "Bad result",
                        "properties": {"url": "ftp://example.com/bad.png"},
                    },
                    {
                        "title": "Fallback image URL",
                        "url": "https://images.example.com/fallback.jpg",
                        "page_url": "https://example.com/fallback",
                    },
                ]
            }

        async def run():
            return await image_search.execute_image_search_tool(
                {"query": "smiley face png", "count": 99},
                env={"BRAVE_SEARCH_API_KEY": "key"},
                fetch_json=fetch_json,
            )

        payload = json.loads(asyncio.run(run()))

        self.assertTrue(payload["success"])
        self.assertEqual(calls[0][0], image_search.BRAVE_IMAGE_SEARCH_ENDPOINT)
        self.assertEqual(calls[0][1], {"q": "smiley face png", "count": "10"})
        self.assertEqual(calls[0][2]["X-Subscription-Token"], "key")
        self.assertEqual(len(payload["results"]), 2)
        self.assertEqual(payload["results"][0]["image_url"], "https://cdn.example.com/smiley.png")
        self.assertEqual(payload["results"][0]["url"], "https://cdn.example.com/smiley.png")
        self.assertEqual(payload["results"][0]["source_url"], "https://example.com/smiley")
        self.assertEqual(payload["results"][0]["width"], 512)
        self.assertEqual(payload["results"][0]["height"], 512)
        self.assertEqual(payload["results"][0]["content_type"], "image/png")
        self.assertEqual(
            payload["results"][1]["image_url"],
            "https://images.example.com/fallback.jpg",
        )
        self.assertIn("tlon upload", payload["usage"])
        self.assertIn("source_url", payload["usage"])

    def test_http_error_is_reported(self):
        async def fetch_json(url, params, headers):
            return {"_http_error": True, "status": 429, "body": "rate limited"}

        async def run():
            return await image_search.execute_image_search_tool(
                {"query": "car png"},
                env={"BRAVE_SEARCH_API_KEY": "key"},
                fetch_json=fetch_json,
            )

        payload = json.loads(asyncio.run(run()))

        self.assertFalse(payload["success"])
        self.assertIn("HTTP 429", payload["error"])
        self.assertEqual(payload["details"], "rate limited")


if __name__ == "__main__":
    unittest.main()

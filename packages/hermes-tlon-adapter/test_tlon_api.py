import asyncio
import importlib.util
import json
import sys
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
    def __init__(self, chunks):
        self.chunks = chunks

    async def iter_any(self):
        for chunk in self.chunks:
            yield chunk


class FakeSSEResponse:
    def __init__(self, chunks):
        self.status = 200
        self.content = FakeSSEContent(chunks)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def text(self):
        return ""


class FakeSSESession:
    def __init__(self, chunks):
        self.chunks = chunks
        self.timeout = None

    def get(self, url, *, headers, timeout):
        self.timeout = timeout
        return FakeSSEResponse(self.chunks)


class FakeActionResponse:
    status = 204

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def text(self):
        return ""


class FakeActionSession:
    def __init__(self):
        self.put_calls = []

    def put(self, url, *, json, headers, timeout):
        self.put_calls.append(
            {
                "url": url,
                "json": json,
                "headers": headers,
                "timeout": timeout,
            }
        )
        return FakeActionResponse()

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

        async def runner(command, env, timeout):
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

        async def runner(command, env, timeout):
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

        async def runner(command, env, timeout):
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
        self.assertEqual([poke[0] for poke in fake.pokes], ["gateway-status"] * 3)
        self.assertEqual(
            [poke[1] for poke in fake.pokes],
            ["gateway-status-action-1"] * 3,
        )
        self.assertEqual(
            fake.pokes[0][2],
            {
                "configure": {
                    "owner": "~mug",
                    "active-window": "~s300",
                    "offline-reply-cooldown": "~s300",
                }
            },
        )
        self.assertEqual(fake.pokes[1][2]["gateway-start"]["boot-id"], "boot-test")
        self.assertTrue(fake.pokes[1][2]["gateway-start"]["lease-until"].startswith("~"))
        self.assertEqual(
            fake.pokes[2][2],
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
        self.assertIsNone(own)

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


if __name__ == "__main__":
    unittest.main()

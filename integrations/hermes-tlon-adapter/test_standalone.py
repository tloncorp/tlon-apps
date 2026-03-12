#!/usr/bin/env python3
"""
Standalone test of the Tlon adapter — no Hermes dependency.
Tests: auth, scry, send channel post, send DM, SSE subscribe.
"""
import asyncio
import json
import time
import uuid

import aiohttp

SHIP_URL = "https://timryd-macnus.tlon.network"
SHIP_NAME = "~timryd-macnus"
SHIP_CODE = "dacdyn-timser-hilmud-docrev"
TEST_CHANNEL = "chat/~ramlud-bintun/v1fsl36d"  # Bots and Humans
TEST_DM_SHIP = "~malmur-halmex"  # DM test target

# --- Urbit aura helpers (replicated from tlon.py) ---

_DA_UNIX_EPOCH = 170141184475152167957503069145530368000
_DA_SECOND = 18446744073709551616


def _format_ud(num: int) -> str:
    s = str(num)
    groups = []
    while len(s) > 3:
        groups.append(s[-3:])
        s = s[:-3]
    groups.append(s)
    return ".".join(reversed(groups))


def _da_from_unix(unix_ms: int) -> str:
    time_since_epoch = unix_ms * _DA_SECOND // 1000
    da_value = _DA_UNIX_EPOCH + time_since_epoch
    return _format_ud(da_value)


# --- HTTP helpers ---


async def authenticate(session):
    """Auth and return cookie string."""
    async with session.post(
        f"{SHIP_URL}/~/login",
        data={"password": SHIP_CODE},
        allow_redirects=False,
        timeout=aiohttp.ClientTimeout(total=15),
    ) as resp:
        assert resp.status in (200, 204, 302, 303, 307), f"Auth failed: {resp.status}"
        for c in session.cookie_jar:
            if c.key.startswith("urbauth"):
                return f"{c.key}={c.value}"
    raise RuntimeError("No urbauth cookie received")


async def scry(session, path):
    """Scry a path and return JSON. Uses cookie jar (no manual header)."""
    full = path if path.endswith(".json") else f"{path}.json"
    async with session.get(
        f"{SHIP_URL}/~/scry{full}",
        timeout=aiohttp.ClientTimeout(total=15),
    ) as resp:
        assert resp.status == 200, f"Scry failed: {resp.status} {await resp.text()}"
        return await resp.json()


async def send_actions(session, actions):
    """Send actions to a one-shot Eyre channel. Uses cookie jar."""
    channel_id = f"{int(time.time())}-{uuid.uuid4().hex[:8]}"
    channel_url = f"{SHIP_URL}/~/channel/{channel_id}"
    async with session.put(
        channel_url,
        json=actions,
        headers={"Content-Type": "application/json"},
        timeout=aiohttp.ClientTimeout(total=30),
    ) as resp:
        if resp.status not in (200, 204):
            text = await resp.text()
            raise RuntimeError(f"Channel action failed: {resp.status} - {text[:300]}")
    return channel_id


# --- Tests ---


async def test_auth(session):
    print("1. Testing auth...")
    cookie = await authenticate(session)
    print(f"   OK — cookie: {cookie[:40]}...")
    return cookie


async def test_scry(session):
    print("2. Testing scry (self profile)...")
    profile = await scry(session, "/contacts/v1/self")
    nickname = profile.get("nickname", {}).get("value", "N/A")
    print(f"   OK — nickname: {nickname}")


async def test_send_channel(session):
    """Test sending a top-level channel post with correct mark and structure."""
    print(f"3. Testing channel post to {TEST_CHANNEL}...")
    sent_at = int(time.time() * 1000)
    bare_ship = SHIP_NAME.lstrip("~")

    story = [{"inline": ["Test from Hermes adapter (standalone test)"]}]

    poke = {
        "id": 1,
        "action": "poke",
        "ship": bare_ship,
        "app": "channels",
        "mark": "channel-action-1",
        "json": {
            "channel": {
                "nest": TEST_CHANNEL,
                "action": {
                    "post": {
                        "add": {
                                "content": story,
                                "author": bare_ship,
                                "sent": sent_at,
                                "kind": "/chat",
                                "meta": None,
                                "blob": None,
                        }
                    }
                },
            }
        },
    }

    await send_actions(session, [poke])
    print("   OK — channel post sent!")


async def test_send_dm(session):
    """Test sending a top-level DM with correct mark and writ ID."""
    print(f"4. Testing DM to {TEST_DM_SHIP}...")
    sent_at = int(time.time() * 1000)
    bare_ship = SHIP_NAME.lstrip("~")
    ud_time = _da_from_unix(sent_at)
    writ_id = f"{bare_ship}/{ud_time}"

    story = [{"inline": ["Test DM from Hermes adapter (standalone test)"]}]

    poke = {
        "id": 1,
        "action": "poke",
        "ship": bare_ship,
        "app": "chat",
        "mark": "chat-dm-action-1",
        "json": {
            "ship": TEST_DM_SHIP.lstrip("~"),
            "diff": {
                "id": writ_id,
                "delta": {
                    "add": {
                        "essay": {
                            "content": story,
                            "author": bare_ship,
                            "sent": sent_at,
                            "kind": "/chat",
                            "meta": None,
                            "blob": None,
                        },
                        "time": None,
                    }
                },
            },
        },
    }

    print(f"   writ_id: {writ_id}")
    await send_actions(session, [poke])
    print("   OK — DM sent!")


async def test_subscribe(session):
    """Test SSE subscription to channels firehose."""
    print("5. Testing SSE subscribe (5 seconds)...")
    channel_id = f"{int(time.time())}-{uuid.uuid4().hex[:8]}"
    channel_url = f"{SHIP_URL}/~/channel/{channel_id}"
    bare_ship = SHIP_NAME.lstrip("~")

    sub_action = [{
        "id": 1,
        "action": "subscribe",
        "ship": bare_ship,
        "app": "channels",
        "path": "/v2",
    }]

    async with session.put(
        channel_url,
        json=sub_action,
        headers={"Content-Type": "application/json"},
        timeout=aiohttp.ClientTimeout(total=15),
    ) as resp:
        assert resp.status in (200, 204), f"Subscribe failed: {resp.status}"

    print("   Subscription created, opening SSE stream...")

    events = []
    try:
        async with session.get(
            channel_url,
            headers={"Accept": "text/event-stream"},
            timeout=aiohttp.ClientTimeout(total=8, connect=5),
        ) as resp:
            assert resp.status == 200, f"SSE stream failed: {resp.status}"
            buffer = ""
            async for chunk in resp.content.iter_any():
                buffer += chunk.decode("utf-8", errors="replace")
                while "\n\n" in buffer:
                    event_data, buffer = buffer.split("\n\n", 1)
                    for line in event_data.split("\n"):
                        if line.startswith("data: "):
                            try:
                                d = json.loads(line[6:])
                                events.append(d)
                                resp_type = d.get("response", "unknown")
                                print(f"   Event: response={resp_type}")
                            except json.JSONDecodeError:
                                pass
    except asyncio.TimeoutError:
        pass
    except Exception as e:
        print(f"   (stream ended: {e})")

    print(f"   OK — received {len(events)} event(s)")

    # Clean up channel
    try:
        async with session.delete(
            channel_url,
            timeout=aiohttp.ClientTimeout(total=5),
        ) as resp:
            pass
    except Exception:
        pass


async def main():
    print("=" * 50)
    print("Hermes Tlon Adapter — Standalone Test")
    print(f"Ship: {SHIP_NAME}")
    print(f"URL:  {SHIP_URL}")
    print("=" * 50)

    async with aiohttp.ClientSession() as session:
        await test_auth(session)
        await test_scry(session)
        await test_send_channel(session)
        await test_send_dm(session)
        await test_subscribe(session)

    print("\nAll tests passed!")


if __name__ == "__main__":
    asyncio.run(main())

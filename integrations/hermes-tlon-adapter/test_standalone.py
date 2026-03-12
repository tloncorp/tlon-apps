#!/usr/bin/env python3
"""
Standalone test of the Tlon adapter — no Hermes dependency.
Tests: auth, scry, send message, SSE subscribe.
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


async def scry(session, cookie, path):
    """Scry a path and return JSON."""
    full = path if path.endswith(".json") else f"{path}.json"
    async with session.get(
        f"{SHIP_URL}/~/scry{full}",
        headers={"Cookie": cookie},
        timeout=aiohttp.ClientTimeout(total=15),
    ) as resp:
        assert resp.status == 200, f"Scry failed: {resp.status}"
        return await resp.json()


async def send_channel_action(session, cookie, actions):
    """Send actions to a one-shot Eyre channel."""
    channel_id = f"{int(time.time())}-{uuid.uuid4().hex[:8]}"
    channel_url = f"{SHIP_URL}/~/channel/{channel_id}"
    async with session.put(
        channel_url,
        json=actions,
        headers={"Content-Type": "application/json", "Cookie": cookie},
        timeout=aiohttp.ClientTimeout(total=30),
    ) as resp:
        if resp.status not in (200, 204):
            text = await resp.text()
            raise RuntimeError(f"Channel action failed: {resp.status} - {text[:200]}")
    return channel_id


async def test_auth(session):
    print("1. Testing auth...")
    cookie = await authenticate(session)
    print(f"   ✓ Authenticated, cookie: {cookie[:40]}...")
    return cookie


async def test_scry(session, cookie):
    print("2. Testing scry (self profile)...")
    profile = await scry(session, cookie, "/contacts/v1/self")
    nickname = profile.get("nickname", {}).get("value", "N/A")
    print(f"   ✓ Nickname: {nickname}")


async def test_send(session, cookie):
    print(f"3. Testing send to {TEST_CHANNEL}...")
    sent_at = int(time.time() * 1000)
    bare_ship = SHIP_NAME.lstrip("~")

    poke = {
        "id": 1,
        "action": "poke",
        "ship": bare_ship,
        "app": "channels",
        "mark": "channel-action",
        "json": {
            "channel": {
                "nest": TEST_CHANNEL,
                "action": {
                    "post": {
                        "add": {
                            "essay": {
                                "content": [{"inline": ["🧪 Test message from Hermes Tlon adapter! (standalone test)"]}],
                                "author": bare_ship,
                                "sent": sent_at,
                            }
                        }
                    }
                },
            }
        },
    }

    await send_channel_action(session, cookie, [poke])
    print("   ✓ Message sent!")


async def test_subscribe(session, cookie):
    print("4. Testing SSE subscribe (5 seconds)...")
    channel_id = f"{int(time.time())}-{uuid.uuid4().hex[:8]}"
    channel_url = f"{SHIP_URL}/~/channel/{channel_id}"
    bare_ship = SHIP_NAME.lstrip("~")

    # Subscribe to channels
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
        headers={"Content-Type": "application/json", "Cookie": cookie},
        timeout=aiohttp.ClientTimeout(total=15),
    ) as resp:
        assert resp.status in (200, 204), f"Subscribe failed: {resp.status}"

    print("   ✓ Subscription created, opening SSE stream...")

    events = []
    try:
        async with session.get(
            channel_url,
            headers={"Accept": "text/event-stream", "Cookie": cookie},
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
                                print(f"   📨 Event: response={resp_type}")
                            except json.JSONDecodeError:
                                pass
    except asyncio.TimeoutError:
        pass
    except Exception as e:
        print(f"   (stream ended: {e})")

    print(f"   ✓ Received {len(events)} event(s)")

    # Clean up
    try:
        async with session.delete(
            channel_url,
            headers={"Cookie": cookie},
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
        cookie = await test_auth(session)
        await test_scry(session, cookie)
        await test_send(session, cookie)
        await test_subscribe(session, cookie)

    print("\n✅ All tests passed!")


if __name__ == "__main__":
    asyncio.run(main())

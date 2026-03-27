#!/usr/bin/env python3
"""
Quick test of the Tlon adapter - auth, subscribe, send a test message.
"""
import asyncio
import os
import sys

# Add the adapter directory to path
sys.path.insert(0, os.path.dirname(__file__))

from tlon import TlonSSEClient, _text_to_story, _normalize_ship

SHIP_URL = "https://timryd-macnus.tlon.network"
SHIP_NAME = "~timryd-macnus"
SHIP_CODE = "dacdyn-timser-hilmud-docrev"
TEST_CHANNEL = "chat/~ramlud-bintun/v1fsl36d"  # Bots and Humans


async def test_auth():
    """Test authentication."""
    print("Testing auth...")
    client = TlonSSEClient(url=SHIP_URL, code=SHIP_CODE, ship=SHIP_NAME)
    cookie = await client.authenticate()
    print(f"  ✓ Auth OK, cookie: {cookie[:40]}...")
    return client


async def test_scry(client):
    """Test scry for self profile."""
    print("Testing scry...")
    profile = await client.scry("/~/scry/contacts/v1/self")
    print(f"  ✓ Profile: nickname={profile.get('nickname', {}).get('value', 'N/A')}")


async def test_send(client):
    """Test sending a message to the Bots and Humans channel."""
    print(f"Testing send to {TEST_CHANNEL}...")
    import time
    sent_at = int(time.time() * 1000)
    story = _text_to_story("🧪 Test message from Hermes Tlon adapter!")

    # Create a one-shot channel
    import uuid
    channel_id = f"{int(time.time())}-{uuid.uuid4().hex[:8]}"
    client.channel_id = channel_id
    client.channel_url = f"{SHIP_URL}/~/channel/{channel_id}"

    await client._send_actions([{
        "id": 1,
        "action": "poke",
        "ship": SHIP_NAME.lstrip("~"),
        "app": "channels",
        "mark": "channel-action",
        "json": {
            "channel": {
                "nest": TEST_CHANNEL,
                "action": {
                    "post": {
                        "add": {
                            "essay": {
                                "content": story,
                                "author": SHIP_NAME.lstrip("~"),
                                "sent": sent_at,
                            }
                        }
                    }
                },
            }
        },
    }])
    print("  ✓ Message sent!")


async def test_subscribe(client):
    """Test subscribing to channel events (listen for 5 seconds)."""
    print("Testing subscribe (5 seconds)...")

    events_received = []

    async def on_event(data):
        events_received.append(data)
        print(f"  📨 Event received: {str(data)[:100]}...")

    await client.subscribe(
        app="channels",
        path="/v2",
        on_event=on_event,
    )

    await client.connect()
    print("  ✓ SSE connected, listening for 5 seconds...")
    await asyncio.sleep(5)
    print(f"  ✓ Received {len(events_received)} event(s)")
    await client.close()


async def main():
    print("=" * 50)
    print("Hermes Tlon Adapter Test")
    print("=" * 50)

    client = await test_auth()
    await test_scry(client)
    await test_send(client)

    # Create new client for subscribe test (send used up the channel)
    client2 = TlonSSEClient(url=SHIP_URL, code=SHIP_CODE, ship=SHIP_NAME)
    await client2.authenticate()
    await test_subscribe(client2)

    print("\n✅ All tests passed!")


if __name__ == "__main__":
    asyncio.run(main())

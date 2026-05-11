# A2UI Desk

Standalone `%a2ui` Gall desk for storing A2UI user actions emitted by Tlon Messenger.

## Poke

App: `%a2ui`

Mark: `%a2ui-action`

Remote pokes are accepted. The desk records the calling ship as `sourceShip`,
so a button tap from `~malmur-halmex` routed to `~sitrul-nacwyl` will be stored
on `~sitrul-nacwyl` with `sourceShip: "~malmur-halmex"`.

Canonical payload:

```json
{
  "userAction": {
    "name": "tlon.approval.approve",
    "surfaceId": "approval-dm-123",
    "sourceComponentId": "approve",
    "timestamp": "2026-05-07T19:57:00.000Z",
    "context": {
      "approvalId": "dm-123",
      "approvalType": "dm",
      "requestingShip": "~sampel-palnet"
    }
  },
  "tlonContext": {
    "postId": "optional-post-id",
    "channelId": "optional-channel-id",
    "authorId": "optional-author-id",
    "actionHostShip": "~sitrul-nacwyl"
  }
}
```

Legacy flat fields are still accepted additively:

```json
{
  "postId": "post-id",
  "channelId": "channel-id",
  "action": "refresh",
  "blobType": "a2ui",
  "payload": {}
}
```

## Subscribe

Watch `/actions`. Each accepted action emits one `%json` fact containing the stored action object.

## Scry

- `/x/actions/all`
- `/x/actions/since/[da]`
- `/x/actions/post/[post-id]`
- `/x/actions/channel/[channel-id]`

The store keeps the newest 200 actions.

## Install Note

This is a fresh `%a2ui` desk, not an upgrade/migration for older experimental
state. If a ship already has an old `%a2ui`, wipe or recreate that desk state
before installing this one.

The canonical `userAction.timestamp` is stored as text because the current Tlon
client emits ISO timestamps.

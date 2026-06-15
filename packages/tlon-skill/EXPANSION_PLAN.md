# Tlon Skill Expansion Plan

Based on analysis of `packages/shared/src/api/` and `packages/shared/src/urbit/` in homestead.

## Current State
- ✅ `groups.ts` - list, create, info, invite, leave, add-channel
- ✅ `contacts.ts` - list, get, update-profile  
- ✅ `channels.ts` - dms, group-dms, groups (listing only)
- ✅ `messages.ts` - dm, channel, history, search
- ✅ `activity.ts` - mentions, replies, all, unreads
- ✅ `notebook-post.ts` - post to diary channels

## Proposed Additions

### 1. Group Administration (`groups.ts`) ✅ COMPLETE

| Command | API | Mark | Status |
|---------|-----|------|--------|
| `delete <group>` | groups | group-action-4 | ✅ |
| `update <group>` | groups | group-action-4 | ✅ |
| `kick <group> <ships...>` | groups | group-action-4 | ✅ |
| `ban <group> <ships...>` | groups | group-action-4 | ✅ |
| `unban <group> <ships...>` | groups | group-action-4 | ✅ |
| `add-role <group> <role>` | groups | group-action-4 | ✅ |
| `delete-role <group> <role>` | groups | group-action-4 | ✅ |
| `assign-role <group> <role> <ships...>` | groups | group-action-4 | ✅ |
| `remove-role <group> <role> <ships...>` | groups | group-action-4 | ✅ |
| `set-privacy <group> <public|private|secret>` | groups | group-action-4 | ✅ |
| `accept-join <group> <ships...>` | groups | group-action-4 | ✅ |
| `reject-join <group> <ships...>` | groups | group-action-4 | ✅ |
| `join <group>` | groups | group-join | ✅ |
| `revoke-invite <group> <ships...>` | groups | group-action-4 | (not implemented - lower priority) |

### 2. Channel Management (`channels.ts` expansion) ✅ COMPLETE

| Command | API | Mark | Status |
|---------|-----|------|--------|
| `create <group> <title>` | channels | channel-action-1 | ✅ (in groups.ts add-channel) |
| `delete <nest>` | groups | group-action-4 | ✅ |
| `update <nest>` | groups | group-action-4 | ✅ |
| `info <nest>` | groups | scry | ✅ |

### 3. Posting (`posts.ts` - NEW)

| Command | API | Mark | Description |
|---------|-----|------|-------------|
| `send <channel> <message>` | channels | channel-action | Post to channel |
| `reply <channel> <post-id> <message>` | channels | channel-action | Reply to post |
| `edit <channel> <post-id> <message>` | channels | channel-action | Edit a post |
| `delete <channel> <post-id>` | channels | channel-action | Delete a post |
| `react <channel> <post-id> <emoji>` | channels | channel-action | Add reaction |
| `unreact <channel> <post-id>` | channels | channel-action | Remove reaction |

### 4. DMs (`dms.ts` - NEW)

| Command | API | Mark | Description |
|---------|-----|------|-------------|
| `send <ship> <message>` | chat | chat-dm-action-1 | Send DM |
| `create-group <ships...>` | chat | chat-club-create | Create group DM |
| `reply <dm-id> <post-id> <message>` | chat | chat-dm-action-1 | Reply in DM |
| `react <dm-id> <post-id> <emoji>` | chat | chat-dm-action-1 | React in DM |

### 5. Contacts (`contacts.ts` expansion)

| Command | API | Mark | Description |
|---------|-----|------|-------------|
| `add <ship>` | contacts | contact-action-1 | Add a contact |
| `remove <ship>` | contacts | contact-action-1 | Remove a contact |
| `sync <ships...>` | contacts | contact-action-1 | Sync profiles from ships |

## Key API Patterns Discovered

### Groups Agent (`group-action-4`)
```json
{
  "group": {
    "flag": "~ship/group-name",
    "a-group": {
      // Operations:
      "meta": { "title": "", "description": "", "image": "", "cover": "" },
      "delete": null,
      "entry": {
        "privacy": "public" | "private" | "secret",
        "ban": { "add-ships": [...] } | { "del-ships": [...] },
        "ask": { "ships": [...], "a-ask": "approve" | "deny" }
      },
      "seat": {
        "ships": [...],
        "a-seat": { "del": null } | { "add-roles": [...] } | { "del-roles": [...] }
      },
      "role": {
        "roles": ["role-id"],
        "a-role": { "add": {...} } | { "del": null } | { "edit": {...} }
      },
      "channel": {
        "nest": "chat/~ship/name",
        "a-channel": { "del": null } | { "edit": {...} } | { "section": "zone-id" }
      }
    }
  }
}
```

### Channels Agent (`channel-action-1`)
```json
{
  "create": {
    "kind": "chat" | "diary" | "heap",
    "group": "~ship/group-name",
    "name": "channel-slug",
    "title": "Display Title",
    "description": "...",
    "meta": null,
    "readers": [],
    "writers": []
  }
}
```

### Channels Agent (`channel-action` for posts)
```json
{
  "channel": {
    "nest": "chat/~ship/channel",
    "action": {
      "post": {
        "add": { "content": [...], "author": "~ship", "sent": timestamp }
      }
    }
  }
}
```

### Chat Agent (DMs - `chat-dm-action-1`)
```json
{
  "ship": "~recipient",
  "diff": {
    "id": "~author/timestamp",
    "delta": {
      "add": {
        "essay": {
          "content": [...],
          "sent": timestamp,
          "author": "~ship",
          "kind": "/chat",
          "meta": null,
          "blob": null
        },
        "time": null
      }
    }
  }
}
```

## Implementation Priority

### Phase 1 (High Value) ✅ COMPLETE
1. `posts.ts send/reply` - Enable posting to channels ✅
2. `dms.ts send` - Enable sending DMs ✅
3. `contacts.ts add/remove` - Complete contact management ✅

### Phase 2 (Group Admin) ✅ COMPLETE
4. Group admin commands (kick, ban, roles) ✅
5. Channel delete/update (via groups.ts add-channel, delete not yet needed)

### Phase 3 (Polish) - Partially Complete
6. Reactions ✅ (posts.ts react/unreact, dms.ts react/unreact)
7. Edit/delete posts ✅ (posts.ts delete, dms.ts delete)
8. Group DM creation (not yet implemented)

## Notes

- All pokes go through HTTP channel API with curl (like existing scripts)
- Need to handle auth cookies (existing pattern in urbit-client.ts)
- Response format varies - some pokes return immediately, others need subscription
- For posts, need to generate proper IDs using `@da` format from timestamp

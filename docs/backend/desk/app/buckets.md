# `%buckets`

`%buckets` is a third-party `%groups` channel host for group-owned file spaces. It owns the logical folder tree, file metadata, authorization, and upload lifecycle. It does not store or transport file bytes.

The channel nest is `buckets/~host/name`. The Bucket host is authoritative, while member ships keep subscribed replicas and expose those replicas to their local clients.

## Authority and storage boundary

- `%groups` remains the authority for membership and channel visibility.
- The Bucket host re-checks the affiliated group's live `can-read` gate for every remote command and subscription. In version 1, anyone who can read the channel can also mutate it.
- The acting principal is always `src.bowl`; commands cannot claim a different ship.
- Gall persists only the manifest and bounded upload-session metadata. Object bytes, storage credentials, and signed URLs must not travel over Ames or enter Gall state.
- Object keys are host-generated and independent of display names, so rename and move operations only change manifest metadata.

The current upload completion action accepts an object URL supplied by the requester. That is sufficient for the fakezod slice, but it is not the production trust boundary. Ylem/Memex integration must mint a scoped grant and verify object existence, size, and optional checksum before `%finish-upload` is accepted.

## State

The protocol and persisted molds are in `desk/sur/buckets.hoon`.

Each Bucket contains:

- Bucket metadata and affiliated group flag
- File/folder entries keyed by stable numeric ID
- Upload sessions keyed by host entropy
- A monotonically increasing manifest revision

Files transition from `%pending` to `%ready` or `%failed`. Upload sessions independently transition from `%pending` to `%complete` or `%failed`. State is explicitly tagged `%0`; any future mold change must add a migration rather than changing `state-0` in place.

## Pokes

Local clients poke `%buckets-action-1`. The mark accepts JSON and noun input.

| Action | Purpose |
| --- | --- |
| `%create` | Create a host-owned Bucket and register the channel with `%groups` |
| `%delete-bucket` | Delete the Bucket and remove its `%groups` channel registration |
| `%create-folder` | Add a folder beneath an existing folder or the root |
| `%begin-upload` | Allocate a pending file, opaque object key, and one-hour upload session |
| `%finish-upload` | Mark the requester's pending upload ready |
| `%fail-upload` | Mark the requester's pending upload failed |
| `%rename-entry` | Change an entry's display name |
| `%move-entry` | Move an entry while preventing folder cycles |
| `%delete-entry` | Delete a file or recursively delete a folder tree |

Subscriber agents forward non-create actions to the host with the noun-only `%buckets-command-1` mark. The host derives the actor from the Gall bowl and re-authorizes the command.

## Scries and subscriptions

| Path | Mark | Description |
| --- | --- | --- |
| `/x/v1/buckets` | `%buckets-snapshots-1` | All locally available Bucket snapshots |
| `/x/v1/buckets/<host>/<name>` | `%buckets-response-1` | One local Bucket snapshot |
| `/u/joined/<host>/<name>` | `%loob` | Whether the local agent has the Bucket |
| `/v1` | `%buckets-response-1` | Initial snapshots and all local replica updates |
| `/v1/buckets/<host>/<name>/updates` | `%buckets-response-1` | Host-authorized snapshot followed by manifest updates |

Direct scries are self-only. Remote consumers subscribe to the host's update path, where the host can apply the live group authorization check. Subscriber agents report joined/left state to local `%groups` using `%group-channel-active`.

## Intended hosted upload flow

1. The client calls `%begin-upload` through its local `%buckets` agent.
2. The host authorizes the caller, allocates the file ID, object key, and session.
3. A Ylem/Memex broker exchanges that authorized session for a short-lived PUT grant bound to the host, Bucket, key, caller, size, content type, and expiry.
4. The client uploads bytes directly to object storage with progress and retry.
5. The broker HEAD-verifies the object and finalizes the reservation.
6. The client calls `%finish-upload`; the host emits a revisioned manifest update to every subscriber.

The broker/grant steps are deliberately not implemented in the Gall slice yet. The client fixture's upload queue is therefore a UI simulation, not a live object transfer.

## Tests

`desk/tests/app/buckets.hoon` covers:

- Folder creation plus a complete metadata-only upload lifecycle
- Rejection of nonexistent folder parents
- Rejection of a remote write after the live `%groups` permission gate denies access

Run the targeted fakezod test with the repository's normal `%test` thread against `/tests/app/buckets/hoon`. Marks must remain top-level files such as `desk/mar/buckets-action-1.hoon`; nesting them under `desk/mar/buckets/` changes the mark name and prevents Gall from resolving the protocol.

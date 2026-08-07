# `%buckets`

`%buckets` is a third-party `%groups` channel host for group-owned file spaces. It owns the logical folder tree, file metadata, authorization, and upload lifecycle. It does not store or transport file bytes.

The channel nest is `buckets/~host/name`. The Bucket host is authoritative, while member ships keep subscribed replicas and expose those replicas to their local clients.

## Authority and storage boundary

-   `%groups` remains the authority for membership and channel visibility.
-   The Bucket host re-checks the affiliated group's live `can-read` gate for subscriptions and read grants.
-   Mutations require either group-admin authority or a group role in the Bucket's writer set. An empty writer set means every readable group member may write. Writer roles are independent from the reader roles stored by `%groups`.
-   Title changes, writer-role changes, and Bucket deletion require a live group-admin check.
-   The acting principal is always `src.bowl`; commands cannot claim a different ship.
-   Gall persists only the manifest, bounded upload-session metadata, and opaque short-lived broker capabilities. Object bytes, storage credentials, and signed URLs must not travel over Ames or enter Gall state.
-   Object keys are host-generated and independent of display names, so rename and move operations only change manifest metadata.

Hosted clients use the private Ylem/Memex broker path described below. `%finish-upload` remains available for the legacy public Memex fallback while the private broker is rolled out by canary.

## State

The protocol and persisted molds are in `desk/sur/buckets.hoon`.

Each Bucket contains:

-   Bucket metadata and affiliated group flag
-   File/folder entries keyed by stable numeric ID
-   Upload sessions keyed by host entropy
-   Reader and writer role sets used by the group channel and Bucket writer gate
-   A monotonically increasing manifest revision

Files transition from `%pending` to `%ready` or `%failed`. Upload sessions independently transition from `%pending` to `%complete` or `%failed`.

State `%1` adds two host-private maps to the original `%0` state: capability-to-authority records and broker-reservation-to-capability bindings. State `%2` adds a distinct writer-role set to each Bucket. `+on-load` explicitly migrates `%0` and `%1` to `%2`, initially copying the old reader roles into writers so existing Buckets retain their previous write behavior. Future mold changes must add another version and migration rather than changing an existing mold in place. The host-private broker maps are not included in Bucket snapshots or Ames updates.

## Pokes

Local clients poke `%buckets-action-1`. The mark accepts JSON and noun input.

| Action           | Purpose                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| `%create`        | Create a host-owned Bucket and register the channel with `%groups`                                                  |
| `%delete-bucket` | Delete the Bucket and remove its `%groups` channel registration                                                     |
| `%set-title`     | Update the Bucket's authoritative title; group metadata is updated separately through `%groups`                     |
| `%set-writers`   | Replace the group-role writer set                                                                                   |
| `%create-folder` | Add a folder beneath an existing folder or the root                                                                 |
| `%begin-upload`  | Allocate a pending file, opaque object key, one-hour upload session, and bind the caller's opaque broker capability |
| `%finish-upload` | Mark the requester's pending upload ready                                                                           |
| `%fail-upload`   | Mark the requester's pending upload failed                                                                          |
| `%issue-read`    | Bind a ten-minute read capability to a ready file and the requesting ship                                           |
| `%issue-delete`  | Bind a ten-minute delete capability to a ready file and the requesting ship                                         |
| `%rename-entry`  | Change an entry's display name                                                                                      |
| `%move-entry`    | Move an entry while preventing folder cycles                                                                        |
| `%delete-entry`  | Delete a file or recursively delete a folder tree                                                                   |

Subscriber agents forward actions to the host with the noun-only `%buckets-command-1` mark. The host derives the actor from the Gall bowl and re-authorizes the command.

The group host always creates and hosts the Bucket, but any current group admin may initiate creation. A non-host admin's local `%buckets` agent first checks its group replica, then forwards the request to the group host. The host checks the actor against its authoritative `%groups` state before allocating the Bucket or registering its channel. Consequently the channel nest, object storage, quota, and eventual billing all remain attached to the group host rather than the initiating admin. Repeating an identical create request is idempotent and re-attempts channel registration; a conflicting request for an existing Bucket name is rejected.

The Gall delete action removes the manifest and `%groups` registration, but storage-wide object cleanup is not atomic yet. The client intentionally withholds Bucket deletion until Memex exposes a host-authorized bulk cleanup operation.

## Scries and subscriptions

| Path                                | Mark                   | Description                                           |
| ----------------------------------- | ---------------------- | ----------------------------------------------------- |
| `/x/v1/buckets`                     | `%buckets-snapshots-1` | All locally available Bucket snapshots                |
| `/x/v1/buckets/<host>/<name>`       | `%buckets-response-1`  | One local Bucket snapshot                             |
| `/u/joined/<host>/<name>`           | `%loob`                | Whether the local agent has the Bucket                |
| `/v1`                               | `%buckets-response-1`  | Initial snapshots and all local replica updates       |
| `/v1/buckets/<host>/<name>/updates` | `%buckets-response-1`  | Host-authorized snapshot followed by manifest updates |

Direct scries are self-only. Remote consumers subscribe to the host's update path, where the host can apply the live group authorization check. Subscriber agents report joined/left state to local `%groups` using `%group-channel-active`.

## Hosted private-broker flow

1. The client generates an opaque capability and sends it with `%begin-upload` through its local `%buckets` agent.
2. The host authorizes the caller, allocates the file ID, object key, and session.
3. The client presents the capability and Bucket host to Memex `POST /v2/buckets/uploads/grant`.
4. Memex asks the host's Pioneer sidecar to run `%pioneer-buckets-authorize-upload`. The thread binds Memex's reservation ID exactly once and returns authoritative Bucket metadata. Pioneer stamps the host from its own ship identity.
5. Memex returns a short-lived PUT grant bound to the host, Bucket, object ID, caller, size, content type, and expiry.
6. The client uploads bytes directly to object storage with progress, cancel, and retry support.
7. The client calls Memex's completion endpoint. Memex HEAD-verifies the object and sends its receipt through `%pioneer-buckets-complete-upload`.
8. Gall validates the reservation, object ID, host, Bucket ID, size, and MIME type before marking the file ready and emitting a revisioned update.

Completion is idempotent. Re-exchanging an upload capability with the same reservation is also idempotent; a different reservation is denied.

For a private read, the client sends `%issue-read`, exchanges the capability at Memex, and receives a short-lived read URL after `%pioneer-buckets-authorize-read` re-checks live group access. Delete follows the same pattern through `%issue-delete` and `%pioneer-buckets-authorize-delete` before the manifest entry is removed.

The client falls back to the legacy public Memex upload only when the private endpoint reports that the feature is disabled, unavailable, or absent. Authorization failures do not fall back.

## Pioneer thread contract

All four threads live under `desk/ted/pioneer/` and are invoked by Pioneer with the flattened `%pioneer-buckets-*` file names. They accept `(unit json)` and return JSON.

| Thread                              | Input                               | Successful result                                                                                                                                        |
| ----------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `%pioneer-buckets-authorize-upload` | `{capability, brokerReservationId}` | `{result: "authorized", upload: {bucketName, bucketId, sessionId, objectId, actorShip, size, mimeType, checksum, expiresAtMillis, brokerReservationId}}` |
| `%pioneer-buckets-complete-upload`  | `{brokerReservationId, receipt}`    | `{result: "completed"}`                                                                                                                                  |
| `%pioneer-buckets-authorize-read`   | `{capability, objectId}`            | `{result: "authorized", read: {bucketId, objectId, displayFilename}}`                                                                                    |
| `%pioneer-buckets-authorize-delete` | `{capability, objectId}`            | `{result: "authorized", delete: {bucketId, objectId}}`                                                                                                   |

Authorization failures return `{result: "denied"}` and expired capabilities return `{result: "expired"}`. `expiresAtMillis` is Unix time in milliseconds.

## Tests

`desk/tests/app/buckets.hoon` covers:

-   Folder creation plus a complete metadata-only upload lifecycle
-   Private reservation binding and verified completion, including idempotent retries
-   Exact upload/read/delete broker verdicts and denial for a mismatched object ID
-   Lazy cleanup of expired capabilities and their reservation bindings
-   Rejection of nonexistent folder parents
-   Rejection of a remote write after the live `%groups` permission gate denies access
-   Acceptance of a remote write only when the member has a configured writer role
-   Group-hosted creation initiated by an authorized remote admin
-   Rejection of creation by a non-admin and idempotent handling of retries

Run the targeted fakezod test with the repository's normal `%test` thread against `/tests/app/buckets/hoon`. Marks must remain top-level files such as `desk/mar/buckets-action-1.hoon`; nesting them under `desk/mar/buckets/` changes the mark name and prevents Gall from resolving the protocol.

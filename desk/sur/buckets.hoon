::  buckets: shared group file-space protocol
::
::  Gall owns only the logical manifest and upload lifecycle. File bytes and
::  signed object-store grants must never be stored in this state or sent over
::  Ames.
::
|%
::  $flag: global bucket identity — its host ship plus a slug.
::
+$  flag  [=ship name=@tas]
::  $nest: channel identity shared with %groups. For a bucket the kind is
::  always %buckets and [host name] is the bucket's flag.
::
+$  nest  [kind=@tas host=@p name=@tas]
::
::  Channel-host messages used by %groups for third-party channel kinds.
::
+$  channel-join   [=nest group=flag]
::  $channel-leave: %groups tells us a member left, or lost access.
::
+$  channel-leave  [=nest]
::
::  Minimal %groups channel-registration payloads. These intentionally mirror
::  the protocol shapes consumed by %group-action-4.
::
+$  group-channel
  $:  meta=[title=@t description=@t image=@t cover=@t]
      created=@da
      section=@tas
      readers=(set @tas)
      join=?
  ==
+$  group-create
  $:  %group
      =flag
      %channel
      =nest
      %add
      channel=group-channel
  ==
+$  group-channel-del
  $:  %group
      =flag
      %channel
      =nest
      %del
      ~
  ==
::
::  $bucket: one shared file space, owned by its group host.
::
+$  bucket
  $:  id=@ud
      title=@t
      created-by=ship
      created-at=@da
      updated-by=ship
      updated-at=@da
  ==
::
::  $file: object-store metadata for a leaf entry.
::
::  .object-key is host-generated and unrelated to .name on the entry, so
::  rename and move stay metadata-only.
::
+$  upload-status  ?(%pending %ready %failed)
+$  file
  $:  mime=@t
      size=@ud
      checksum=(unit @t)
      object-key=@t
      status=upload-status
  ==
::  $entry-kind: a tree node is either a folder or a file.
::
+$  entry-kind
  $%  [%folder ~]
      [%file =file]
  ==
::
::  $entry: a folder or file in a bucket's tree.
::
+$  entry
  $:  id=@ud
      parent=(unit @ud)
      name=@t
      created-by=ship
      created-at=@da
      updated-by=ship
      updated-at=@da
      kind=entry-kind
  ==
::
::  $upload-session: host-private record of one in-flight upload.
::
::  .id doubles as the opaque broker token the uploader presents to Memex.
::  It is minted from bowl entropy and returned only to .requested-by, never
::  broadcast — so it is safe to use as a bearer secret.
::  .entry is the not-yet-published entry: it joins the bucket's manifest
::  only once the object lands, so an in-flight upload is invisible to
::  everyone but its uploader.
::  .reservation is the broker reservation id bound on first exchange.
::
+$  session-status  ?(%pending %complete %failed)
+$  upload-session
  $:  id=@uv
      =flag
      =entry
      requested-by=ship
      created-at=@da
      expires-at=@da
      status=session-status
      reservation=(unit @t)
      error=(unit @t)
  ==
::
::  $object-capability: host-private grant to read or delete one object.
::
::  Minted per request and returned only to .actor. Uploads do not appear
::  here — their token is the upload session id.
::
+$  object-kind  ?(%read %delete)
+$  object-capability
  $:  kind=object-kind
      =flag
      entry-id=@ud
      actor=ship
      expires-at=@da
  ==
::
::  Group readability remains authoritative in %groups. Bucket writers are a
::  separate subset of group roles; an empty set means every readable member
::  may write, matching the convention used by %channels.
::
+$  bucket-state
  $:  =bucket
      group=flag
      readers=(set @tas)
      writers=(set @tas)
      entries=(map @ud entry)
      revision=@ud
  ==
::
::  Actions (client -> agent)
::
::  $a-buckets: what a client on our own ship asks for. The outer tag carries
::  identity; the inner unions carry only the verb.
::
::  Tokens are never supplied by the caller — the host mints them and hands
::  them back in a $response-body.
::
+$  a-buckets
  $%  [%create name=@tas title=@t group=flag readers=(set @tas) writers=(set @tas)]
      [%bucket =flag =a-bucket]
  ==
::
::  $a-bucket: actions on one bucket. The flag lives on the outer envelope.
::
+$  a-bucket
  $%  [%delete ~]
      [%set-title title=@t]
      [%set-readers readers=(set @tas)]
      [%set-writers writers=(set @tas)]
      [%create-folder parent=(unit @ud) name=@t]
      [%begin-upload parent=(unit @ud) name=@t mime=@t size=@ud checksum=(unit @t)]
      [%fail-upload session=@uv reason=@t]
      [%issue-read id=@ud]
      [%issue-delete id=@ud]
      [%entry id=@ud =a-entry]
  ==
::
::  $a-entry: actions on one entry. The id lives on the outer envelope.
::
+$  a-entry
  $%  [%rename name=@t]
      [%move parent=(unit @ud)]
      [%delete recursive=?]
  ==
::
+$  request-id  @uv
::
::  $command: a request-id'd action, carried by both %buckets-action-1 (a
::  local client) and %buckets-command-1 (a subscriber forwarding to the
::  host).
::
::  There is deliberately no separate c-* family: every verb a local client
::  can send is also one a peer may forward, so an a-/c- split would be two
::  identical unions. The trust boundary is the poke handler's gate —
::  ?> =(src.bowl our.bowl) for actions, a permission check for commands.
::  Add the split when the first local-only or peer-only verb appears.
::
+$  command  [=request-id act=a-buckets]
::
::  $grant: a host-minted bearer token returned to the requester alone.
::
::  .token is the opaque string presented to Memex — for an upload it is the
::  session id, for a read or delete it is a freshly minted capability.
::
+$  grant
  $:  token=@t
      entry-id=@ud
      expires-at=@da
  ==
::
::  $action-error: enumerated failure modes returned to the requester.
::
+$  action-error
  $?  %not-authorized
      %not-found
      %invalid-input
      %unknown
  ==
::
::  $response-body: terminal answer to one client action.
::
::  %pending is emitted by a subscriber once it has forwarded the command to
::  the host and is waiting; the host's real answer replaces it.
::
+$  response-body
  $%  [%ok ~]
      [%grant =grant]
      [%pending ~]
      [%error type=action-error message=@t]
  ==
::
::  $req-response: a $response-body addressed to one in-flight request.
::
+$  req-response  [=request-id body=response-body]
::
::  Opaque, short-lived bearer capabilities exchanged by Memex through
::  Pioneer's local spider threads. They are host-only authority state and
::  are never included in Bucket snapshots or Ames updates.
::
+$  broker-receipt
  $:  broker-reservation-id=@t
      object-id=@t
      host=@t
      bucket-id=@t
      size=@ud
      mime-type=@t
  ==
::  $broker-command: what a Pioneer thread relays in from Memex. The
::  capability is opaque on the Memex side, so this shape is fixed by the
::  cross-repo contract — do not change it without changing ylem.
::
+$  broker-command
  $%  [%authorize-upload capability=@t broker-reservation-id=@t]
      [%complete-upload =broker-receipt]
  ==
::
::  Updates (host -> subscribers)
::
::  $u-bucket: a canonical manifest change on one bucket, broadcast to every
::  subscriber. Updates are fat: an arm carries the whole post-change entity,
::  so a replica overwrites rather than merging.
::
::  Upload lifecycle arms are deliberately absent. A pending upload lives on
::  its session, not in the manifest, so it produces no update at all — the
::  file arrives as [%entry id %create] when the object lands, and a failed
::  upload is reported to its uploader in a $response-body instead.
::
+$  u-bucket
  $%  [%create =bucket]
      [%delete ~]
      [%meta =bucket]
      [%readers readers=(set @tas)]
      [%writers writers=(set @tas)]
      [%entry id=@ud =u-entry]
      [%entries-deleted ids=(list @ud)]
  ==
::
::  $u-entry: a change to one entry. The id lives on the outer envelope, and
::  attribution rides on the entity's own .updated-by / .updated-at.
::
+$  u-entry
  $%  [%create =entry]
      [%update =entry]
  ==
::
::  Responses (agent -> local client subscribers)
::
::  $r-buckets: facts on /v1 and on a bucket's update path. No actor field —
::  who changed what is recorded on $bucket and $entry.
::
+$  r-buckets
  $%  [%snapshot =flag =bucket-state]
      [%update =flag revision=@ud =u-bucket]
  ==
::
+$  snapshot  [=flag =bucket-state]
::
::  Type aliases used by the mark files.
::
+$  action    a-buckets
+$  update    u-bucket
+$  response  r-buckets
::
+$  net  ?(%pub %sub)
::  $space: one bucket as this ship sees it — whether we host it or replicate
::  it, the replica itself, and the group we expect it to belong to before the
::  first snapshot arrives.
::
+$  space  [=net state=(unit bucket-state) pending-group=(unit flag)]
::
::  Persisted state. %buckets has never run on a live ship, so there is
::  nothing to migrate from — this is version 0. A future change adds
::  $state-1 plus a +state-0-to-1 arm chained from +on-load; never mutate a
::  numbered mold in place.
::
+$  state-0
  $:  %0
      spaces=(map flag space)
      next-id=@ud
      sessions=(map @uv upload-session)
      object-capabilities=(map @t object-capability)
      reservations=(map @t @uv)
      pending=(map request-id [host=ship until=@da])
  ==
::  $versioned-state: every persisted shape +on-load may be handed.
::
+$  versioned-state  $%(state-0)
::  $state: the current persisted shape.
::
+$  state  state-0
--

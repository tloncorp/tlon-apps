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
::  .id names the session in every action its uploader sends. It is no longer
::  a bearer secret: the uploader never presents it to the broker, because it
::  never talks to the broker -- we do, authenticated as ourselves.
::  .entry is the not-yet-published entry: it joins the bucket's manifest
::  only once the object lands, so an in-flight upload is invisible to
::  everyone but its uploader.
::  .reservation is the broker's id for this upload, learned from the answer
::  to our own grant call rather than proposed to us by the broker.
::
::  .cancelled is the uploader withdrawing. It stops a new upload URL being
::  issued against the session, and a cancel is also sent on to the broker so
::  the quota it reserved is released rather than held until expiry.
::
::  .awaiting is the client request held open while a broker call is in
::  flight for this session. It rides here rather than on the wire so a
::  restart drops it cleanly instead of stranding a request that can never be
::  answered.
::
+$  session-status  ?(%pending %complete %cancelled)
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
      awaiting=(unit request-id)
  ==
::
::  $object-capability: host-private grant to read or delete objects.
::
::  Minted per request and returned only to .actor. Uploads do not appear
::  here — their token is the upload session id.
::
::  Reads are scoped to a whole bucket, not one object. Read access is uniform
::  across a bucket — group-can-read answers for the channel, not the file — so
::  a per-object grant would be exactly as precise while costing the reader a
::  round trip per file. Deletes stay per-object because they are destructive
::  and a mistake is not recoverable.
::
+$  object-kind  ?(%read %delete)
::  .entry-id is ~ for a read, which covers the whole bucket, and set for a
::  delete, which names one object.
::
+$  object-capability
  $:  kind=object-kind
      =flag
      entry-id=(unit @ud)
      actor=ship
      expires-at=@da
  ==
::
::  $reader-state: what one reader's access to one bucket should look like at
::  the broker. Granted carries the bearer token; revoked carries nothing
::  usable, because there is nothing the reader should be able to present.
::
+$  reader-state
  $%  [%granted token=@t expires-at=@da]
      [%revoked ~]
  ==
::  $reader-sync: one (bucket, reader) pair as desired state rather than as a
::  sequence of pushes and revokes.
::
::  .revision is strictly increasing per pair and bumped on every access
::  change -- grant, rotation, revoke alike. The broker keeps only the highest
::  it has seen, so a delayed or duplicated request is harmless and delivery
::  order stops mattering: the message says what should be true, not what to
::  do. .synced is the highest revision the broker has confirmed, so anything
::  above it is still owed.
::
::  .awaiting is the client request still holding open for this pair's grant
::  to land at the broker. It rides here rather than on the wire so a retry
::  does not lose it.
::
::  .bucket-id and .expires make the record self-sufficient. A revoke issued
::  as a bucket is deleted still has to be deliverable afterwards, so the
::  request cannot be rebuilt from live bucket state that is already gone.
::  .expires is when this pair's authority stops mattering either way -- the
::  granted token's expiry, carried onto the revoke that replaces it -- which
::  is also when a confirmed revoked record can be dropped, since past it a
::  lost revoke is moot.
::
::  .failed marks a revision the broker refused as invalid rather than stale.
::  Retrying that is pointless -- it is a bug on this side, not a race -- so
::  it stops being owed until the next access change supersedes it.
::
+$  reader-sync
  $:  revision=@ud
      bucket-id=@t
      desired=reader-state
      expires=@da
      synced=@ud
      failed=?
      awaiting=(unit request-id)
  ==
::  $reader-key: a bucket and one of its readers.
::
+$  reader-key  [=flag reader=ship]
::  $reader-status: what a reader record still asks of us.
::
::  Derived from .revision, .synced, .failed and .expires together, which
::  every caller used to do for itself from whichever fields it happened to
::  care about. They disagreed, and each disagreement was a bug: records the
::  broker had refused were owed by nobody and prunable by nobody, so they
::  accumulated for good. Switching on this with ?- makes a missed state a
::  compile error instead of something review has to catch.
::
+$  reader-status  ?(%owed %settled %refused %lapsed)
::
::  $read-token: the bucket-read capability this ship currently holds.
::
::  Every ship keeps its own, refreshed on a timer, so a local client always
::  has one to hand without a network round trip — and because the token names
::  its actor, the broker still sees who is reading.
::
+$  read-token
  $:  token=@t
      expires-at=@da
  ==
::
::  Readability is %groups' business alone, so no reader set is kept here: the
::  roles named at creation are handed to %groups with the channel and belong
::  to it from then on, and +group-can-read asks it. Bucket writers are a
::  separate subset of group roles that %groups does not model, so those do
::  live here; an empty set means every readable member may write, matching
::  the convention used by %channels.
::
+$  bucket-state
  $:  =bucket
      group=flag
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
::  .readers on %create is passed straight to %groups as the new channel's
::  reader roles and is not retained; change it there, not here.
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
      [%set-writers writers=(set @tas)]
      [%create-folder parent=(unit @ud) name=@t]
      [%begin-upload parent=(unit @ud) name=@t mime=@t size=@ud checksum=(unit @t)]
      ::  The uploader drives its own transfer, so it says when the bytes are
      ::  up, when it wants another URL, and when it is giving up. Each is a
      ::  call we make to the broker on its behalf.
      [%finish-upload session=@uv]
      [%retry-upload session=@uv]
      [%cancel-upload session=@uv reason=@t]
      [%issue-bucket-read ~]
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
      [%upload =upload-grant]
      [%token =read-token]
      [%pending ~]
      [%error type=action-error message=@t]
  ==
::
::  $upload-grant: where to PUT one file's bytes, and how.
::
::  .headers are the broker's, not ours: they are part of what the URL is
::  signed over, so sending a different set -- or the same set under different
::  capitalisation -- invalidates the signature. Pass them through unchanged.
::
::  .session is what the uploader names in %finish-upload, %retry-upload and
::  %cancel-upload afterwards.
::
+$  upload-grant
  $:  session=@uv
      entry-id=@ud
      url=@t
      headers=(list [key=@t value=@t])
      expires-at=@da
  ==
::
::  $req-response: a $response-body addressed to one in-flight request.
::
+$  req-response  [=request-id body=response-body]
::
::  $incoming-request: an action we are tracking to its terminal answer.
::
::  .http-id is set while an Eyre POST is held open waiting for that answer;
::  clearing it after delivery stops a late update re-answering a closed
::  request. .final-at is stamped once .result is terminal, so cleanup can
::  evict the record after a grace window.
::
+$  incoming-request
  $:  =request-id
      http-id=(unit @ta)
      result=(unit response-body)
      final-at=(unit @da)
  ==
+$  requests  (map request-id incoming-request)
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
::  $summary: a bucket without its contents.
::
::  Every use but opening one -- listing them, routing to them, reading a
::  channel's writer roles -- needs the metadata and none of the entries, and
::  a bucket's entries are unbounded. Answering those from $snapshot made the
::  cost of asking about buckets scale with everything stored in them.
::
+$  summary
  $:  =flag
      =bucket
      group=flag
      writers=(set @tas)
      revision=@ud
  ==
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
      ::  .broker-base is where this ship's storage broker lives. Ship
      ::  configuration rather than bucket data: a ship has no environment to
      ::  read, so pointing a host at a test broker is a poke, and the default
      ::  +init installs is production.
      broker-base=@t
      spaces=(map flag space)
      next-id=@ud
      sessions=(map @uv upload-session)
      object-capabilities=(map @t object-capability)
      read-tokens=(map flag read-token)
      ::  .readers is the desired access state we owe the broker, per bucket
      ::  and reader. It replaces separate push and revoke effects: both are
      ::  the same idempotent sync of one pair at one revision.
      readers=(map reader-key reader-sync)
      reservations=(map @t @uv)
      ::  .token-for is set only when the forwarded action was a request for
      ::  a read token, and names the bucket it is for. It answers two
      ::  questions at once: which bucket to file a %token answer under --
      ::  guessing from the host is wrong once two buckets share one -- and
      ::  whether this request's failure has anything to do with tokens at
      ::  all, so that a refused folder rename does not discard one.
      pending=(map request-id [host=ship until=@da token-for=(unit flag)])
      requests=requests
  ==
::  $versioned-state: every persisted shape +on-load may be handed.
::
+$  versioned-state  $%(state-0)
::  $state: the current persisted shape.
::
+$  state  state-0
--

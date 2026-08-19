::  buckets: shared group file-space protocol
::
::  Gall owns only the logical manifest and upload lifecycle. File bytes and
::  signed object-store grants must never be stored in this state or sent over
::  Ames.
::
|%
+$  flag  [=ship name=@tas]
+$  nest  [kind=@tas host=@p name=@tas]
::
::  Channel-host messages used by %groups for third-party channel kinds.
::
+$  channel-join   [=nest group=flag]
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
      object-url=(unit @t)
      status=upload-status
  ==
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
::  $action: what a client asks for.
::
::  Non-create actions carry the bucket flag so a subscriber can forward the
::  same noun to the authoritative host. Tokens are never supplied by the
::  caller — the host mints them and returns them in a $response-body.
::
+$  action
  $%  [%create name=@tas title=@t group=flag readers=(set @tas) writers=(set @tas)]
      [%delete-bucket =flag]
      [%set-title =flag title=@t]
      [%set-readers =flag readers=(set @tas)]
      [%set-writers =flag writers=(set @tas)]
      [%create-folder =flag parent=(unit @ud) name=@t]
      [%begin-upload =flag parent=(unit @ud) name=@t mime=@t size=@ud checksum=(unit @t)]
      [%finish-upload =flag session=@uv object-url=@t]
      [%fail-upload =flag session=@uv reason=@t]
      [%issue-read =flag id=@ud]
      [%issue-delete =flag id=@ud]
      [%rename-entry =flag id=@ud name=@t]
      [%move-entry =flag id=@ud parent=(unit @ud)]
      [%delete-entry =flag id=@ud recursive=?]
  ==
::
::  $request-id: correlates one client action with its terminal response.
::  Minted by the client; opaque to the host.
::
+$  request-id  @uv
::
::  $command: a request-id'd action.
::
::  Carried by both %buckets-action-1 (local client) and %buckets-command-1
::  (subscriber forwarding to the host). The trust difference lives in the
::  poke handler's gates, not in the type; splitting these into a-/c-
::  families is tracked separately.
::
+$  command  [=request-id =action]
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
+$  broker-command
  $%  [%authorize-upload capability=@t broker-reservation-id=@t]
      [%complete-upload =broker-receipt]
  ==
::
::  $update: a canonical manifest change, broadcast to every subscriber.
::
::  Upload lifecycle arms are deliberately absent. A pending upload lives on
::  its session, not in the manifest, so it produces no update at all — the
::  file arrives as %entry-created when the object lands, and a failed
::  upload is reported to its uploader in a $response-body instead.
::
+$  update
  $%  [%bucket-created =bucket]
      [%bucket-deleted ~]
      [%bucket-updated =bucket]
      [%readers-updated readers=(set @tas)]
      [%writers-updated writers=(set @tas)]
      [%entry-created =entry]
      [%entry-updated =entry]
      [%entries-deleted ids=(list @ud)]
  ==
+$  response
  $%  [%snapshot =flag =bucket-state]
      [%update =flag revision=@ud actor=ship =update]
  ==
+$  snapshot  [=flag =bucket-state]
::
+$  net  ?(%pub %sub)
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
+$  versioned-state  $%(state-0)
+$  state  state-0
--

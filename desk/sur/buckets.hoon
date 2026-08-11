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
+$  bucket
  $:  id=@ud
      title=@t
      created-by=ship
      created-at=@da
      updated-by=ship
      updated-at=@da
  ==
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
+$  session-status  ?(%pending %complete %failed)
+$  upload-session
  $:  id=@uv
      file-id=@ud
      requested-by=ship
      created-at=@da
      expires-at=@da
      status=session-status
      error=(unit @t)
  ==
::
::  State as persisted by versions 0 and 1. Keep this mold frozen so upgrades
::  can explicitly preserve the old "readers can write" behavior.
::
+$  bucket-state-1
  $:  =bucket
      group=flag
      readers=(set @tas)
      entries=(map @ud entry)
      sessions=(map @uv upload-session)
      revision=@ud
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
      sessions=(map @uv upload-session)
      revision=@ud
  ==
::
::  Client actions. Non-create actions carry a complete Bucket flag so a
::  subscriber can forward the same noun to the authoritative host.
::
+$  action
  $%  [%create name=@tas title=@t group=flag readers=(set @tas) writers=(set @tas)]
      [%delete-bucket =flag]
      [%set-title =flag title=@t]
      [%set-readers =flag readers=(set @tas)]
      [%set-writers =flag writers=(set @tas)]
      [%create-folder =flag parent=(unit @ud) name=@t]
      [%begin-upload =flag parent=(unit @ud) name=@t mime=@t size=@ud checksum=(unit @t) capability=@t]
      [%finish-upload =flag session=@uv object-url=@t]
      [%fail-upload =flag session=@uv reason=@t]
      [%issue-read =flag id=@ud capability=@t]
      [%issue-delete =flag id=@ud capability=@t]
      [%rename-entry =flag id=@ud name=@t]
      [%move-entry =flag id=@ud parent=(unit @ud)]
      [%delete-entry =flag id=@ud recursive=?]
  ==
::
::  Cross-ship commands are noun-only. The actor is always src.bowl; no
::  claimed principal appears in the payload.
::
+$  command  [=action]

::  Opaque, short-lived bearer capabilities exchanged by Memex through
::  Pioneer's local spider threads. They are host-only authority state and
::  are never included in Bucket snapshots or Ames updates.
::
+$  broker-kind  ?(%upload %read %delete)
+$  broker-capability
  $:  =broker-kind
      =flag
      session=(unit @uv)
      entry-id=@ud
      object-id=@t
      actor=ship
      expires-at=@da
      broker-reservation-id=(unit @t)
  ==
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
+$  update
  $%  [%bucket-created =bucket]
      [%bucket-deleted ~]
      [%bucket-updated =bucket]
      [%readers-updated readers=(set @tas)]
      [%writers-updated writers=(set @tas)]
      [%folder-created =entry]
      [%upload-begun =upload-session =entry]
      [%upload-ready =upload-session =entry]
      [%upload-failed =upload-session =entry]
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
+$  space-1  [=net state=(unit bucket-state-1) pending-group=(unit flag)]
::
::  Greenfield state. Future changes must add state-N and an explicit
::  state-(N-1)-to-N migration in +on-load; never mutate this mold in place.
::
+$  state-0
  $:  %0
      spaces=(map flag space-1)
      next-id=@ud
  ==
+$  state-1
  $:  %1
      spaces=(map flag space-1)
      next-id=@ud
      broker-capabilities=(map @t broker-capability)
      broker-reservations=(map @t @t)
  ==
+$  state-2
  $:  %2
      spaces=(map flag space)
      next-id=@ud
      broker-capabilities=(map @t broker-capability)
      broker-reservations=(map @t @t)
  ==
+$  versioned-state  $%(state-0 state-1 state-2)
+$  state  state-2
--

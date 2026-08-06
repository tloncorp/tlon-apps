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
::  A group Bucket uses the group's live can-read gate as its read and write
::  authority in v1. `readers` is preserved for channel registration and UI.
::
+$  bucket-state
  $:  =bucket
      group=flag
      readers=(set @tas)
      entries=(map @ud entry)
      sessions=(map @uv upload-session)
      revision=@ud
  ==
::
::  Client actions. Non-create actions carry a complete Bucket flag so a
::  subscriber can forward the same noun to the authoritative host.
::
+$  action
  $%  [%create name=@tas title=@t group=flag readers=(set @tas)]
      [%delete-bucket =flag]
      [%create-folder =flag parent=(unit @ud) name=@t]
      [%begin-upload =flag parent=(unit @ud) name=@t mime=@t size=@ud checksum=(unit @t)]
      [%finish-upload =flag session=@uv object-url=@t]
      [%fail-upload =flag session=@uv reason=@t]
      [%rename-entry =flag id=@ud name=@t]
      [%move-entry =flag id=@ud parent=(unit @ud)]
      [%delete-entry =flag id=@ud recursive=?]
  ==
::
::  Cross-ship commands are noun-only. The actor is always src.bowl; no
::  claimed principal appears in the payload.
::
+$  command  [=action]
::
+$  update
  $%  [%bucket-created =bucket]
      [%bucket-deleted ~]
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
::
::  Greenfield state. Future changes must add state-N and an explicit
::  state-(N-1)-to-N migration in +on-load; never mutate this mold in place.
::
+$  state-0
  $:  %0
      spaces=(map flag space)
      next-id=@ud
  ==
+$  state  state-0
--

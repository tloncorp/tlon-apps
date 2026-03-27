::  sur/a2ui.hoon: types for %a2ui agent
::
::    universal mini-app backend for interactive blobs.
::    stores user actions (button taps, chess moves, form
::    submissions) for external bot consumption via scry.
::
|%
::  $action: a user interaction with a blob
::
::    .post-id: ID of the post containing the blob
::    .channel-id: channel nest (e.g. "chat/~host/name")
::    .act: action string (e.g. "test-live", "e2e4", "approve")
::    .blob-type: blob type (e.g. "a2ui", "chess", "form")
::    .payload: optional JSON payload string (empty cord if none)
::
+$  action
  $:  post-id=@t
      channel-id=@t
      act=@t
      blob-type=@t
      payload=@t
  ==
::  $stored-action: action with metadata added by agent
::
::    .id: monotonic counter
::    .timestamp: when received
::    .ship: who sent it (src.bowl)
::    .action: the original action
::
+$  stored-action
  $:  id=@ud
      timestamp=@da
      ship=@p
      =action
  ==
::  $state-0: agent state
::
+$  state-0
  $:  %0
      next-id=@ud
      actions=(list stored-action)
  ==
--

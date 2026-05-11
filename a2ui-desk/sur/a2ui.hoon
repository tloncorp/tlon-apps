::  a2ui: action event types
::
|%
::
::  $user-action: canonical A2UI client action envelope body
::
::  .name: action name declared by the component
::  .surface-id: A2UI surface that produced the action
::  .source-component-id: component id that triggered the action
::  .timestamp: client trigger time as emitted by the client
::  .context: resolved A2UI action context
::
+$  user-action
  $:  name=@t
      surface-id=@t
      source-component-id=@t
      timestamp=@t
      context=json
  ==
::
::  $tlon-context: Tlon bridge metadata added by the client
::
+$  tlon-context
  $:  post-id=(unit @t)
      channel-id=(unit @t)
      author-id=(unit @t)
      action-host-ship=(unit @t)
  ==
::
::  $action-input: accepted poke payload
::
::    Supports both legacy flat action fields and canonical
::    `{userAction, tlonContext}` payloads. `.raw` preserves the original JSON
::    for compatibility and debugging.
::
+$  action-input
  $:  post-id=(unit @t)
      channel-id=(unit @t)
      act=(unit @t)
      blob-type=(unit @t)
      payload=(unit json)
      user-action=(unit user-action)
      tlon-context=(unit tlon-context)
      raw=json
  ==
::
::  $stored-action: persisted event
::
+$  stored-action
  $:  id=@ud
      source-ship=@p
      received-at=@da
      post-id=(unit @t)
      channel-id=(unit @t)
      author-id=(unit @t)
      action-host-ship=(unit @t)
      act=(unit @t)
      blob-type=(unit @t)
      payload=(unit json)
      name=(unit @t)
      surface-id=(unit @t)
      source-component-id=(unit @t)
      timestamp=(unit @t)
      context=json
      raw=json
  ==
::
+$  state
  $:  %0
      next-id=@ud
      actions=(list stored-action)
  ==
--

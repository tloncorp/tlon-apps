::  a2ui-json: JSON codecs for A2UI action payloads
::
/-  a2ui
::
|%
++  enjs
  =,  enjs:format
  |%
  ++  maybe-text
    |=  txt=(unit @t)
    ^-  json
    ?~(txt ~ s+u.txt)
  ::
  ++  maybe-json
    |=  jon=(unit json)
    ^-  json
    ?~(jon ~ u.jon)
  ::
  ++  user-action
    |=  act=user-action:a2ui
    ^-  json
    %-  pairs
    :~  'name'^s+name.act
        'surfaceId'^s+surface-id.act
        'sourceComponentId'^s+source-component-id.act
        'timestamp'^s+timestamp.act
        'context'^context.act
    ==
  ::
  ++  maybe-user-action
    |=  act=stored-action:a2ui
    ^-  json
    ?~  name.act  ~
    ?~  surface-id.act  ~
    ?~  source-component-id.act  ~
    ?~  timestamp.act  ~
    %-  user-action
    [u.name.act u.surface-id.act u.source-component-id.act u.timestamp.act context.act]
  ::
  ++  tlon-context
    |=  act=stored-action:a2ui
    ^-  json
    %-  pairs
    :~  'postId'^(maybe-text post-id.act)
        'channelId'^(maybe-text channel-id.act)
        'authorId'^(maybe-text author-id.act)
        'actionHostShip'^(maybe-text action-host-ship.act)
    ==
  ::
  ++  action
    |=  stored=stored-action:a2ui
    ^-  json
    %-  pairs
    :~  'id'^(numb id.stored)
        'sourceShip'^s+(scot %p source-ship.stored)
        'receivedAt'^s+(scot %da received-at.stored)
        'postId'^(maybe-text post-id.stored)
        'channelId'^(maybe-text channel-id.stored)
        'authorId'^(maybe-text author-id.stored)
        'actionHostShip'^(maybe-text action-host-ship.stored)
        'action'^(maybe-text act.stored)
        'blobType'^(maybe-text blob-type.stored)
        'payload'^(maybe-json payload.stored)
        'name'^(maybe-text name.stored)
        'surfaceId'^(maybe-text surface-id.stored)
        'sourceComponentId'^(maybe-text source-component-id.stored)
        'timestamp'^(maybe-text timestamp.stored)
        'context'^context.stored
        'userAction'^(maybe-user-action stored)
        'tlonContext'^(tlon-context stored)
        'raw'^raw.stored
    ==
  ::
  ++  actions
    |=  acts=(list stored-action:a2ui)
    ^-  json
    a+(turn acts action)
  ::
  ++  action-input
    |=  act=action-input:a2ui
    ^-  json
    raw.act
  --
::
++  dejs
  =,  dejs:format
  |%
  ++  object
    |=  jon=json
    ^-  (map @t json)
    ((om json) jon)
  ::
  ++  opt-text
    |=  [obj=(map @t json) key=@t]
    ^-  (unit @t)
    (bind (~(get by obj) key) so)
  ::
  ++  opt-json
    |=  [obj=(map @t json) key=@t]
    ^-  (unit json)
    (~(get by obj) key)
  ::
  ++  req-text
    |=  [obj=(map @t json) key=@t]
    ^-  @t
    (so (~(got by obj) key))
  ::
  ++  user-action
    |=  jon=json
    ^-  user-action:a2ui
    =/  obj=(map @t json)  (object jon)
    :*  (req-text obj 'name')
        (req-text obj 'surfaceId')
        (req-text obj 'sourceComponentId')
        (req-text obj 'timestamp')
        (~(got by obj) 'context')
    ==
  ::
  ++  tlon-context
    |=  jon=json
    ^-  tlon-context:a2ui
    =/  obj=(map @t json)  (object jon)
    :*  (opt-text obj 'postId')
        (opt-text obj 'channelId')
        (opt-text obj 'authorId')
        (opt-text obj 'actionHostShip')
    ==
  ::
  ++  action-input
    |=  jon=^json
    ^-  action-input:a2ui
    =/  obj=(map @t json)  (object jon)
    =/  usr-json=(unit json)  (~(get by obj) 'userAction')
    =/  ctx-json=(unit json)  (~(get by obj) 'tlonContext')
    =/  usr=(unit user-action:a2ui)
      ?~  usr-json
        ~
      (some (user-action u.usr-json))
    =/  ctx=(unit tlon-context:a2ui)
      ?~  ctx-json
        ~
      (some (tlon-context u.ctx-json))
    :*  (opt-text obj 'postId')
        (opt-text obj 'channelId')
        (opt-text obj 'action')
        (opt-text obj 'blobType')
        (opt-json obj 'payload')
        usr
        ctx
        jon
    ==
  --
--

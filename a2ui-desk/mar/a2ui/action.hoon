::  mar/a2ui/action.hoon: mark for a2ui actions
::
/-  *a2ui
|_  =action
++  grab
  |%
  ++  noun  action
  ++  json
    |=  jon=json
    ^-  action
    =/  obj  ((om:dejs:format json) jon)
    :*  (so:dejs:format (~(got by obj) 'postId'))
        (so:dejs:format (~(got by obj) 'channelId'))
        (so:dejs:format (~(got by obj) 'action'))
        (so:dejs:format (~(got by obj) 'blobType'))
        (fall (bind (~(get by obj) 'payload') so:dejs:format) '')
    ==
  --
++  grow
  |%
  ++  noun  action
  ++  json
    ^-  ^json
    %-  pairs:enjs:format
    :~  ['postId' s+post-id.action]
        ['channelId' s+channel-id.action]
        ['action' s+act.action]
        ['blobType' s+blob-type.action]
        ['payload' s+payload.action]
    ==
  --
++  grad  %noun
--

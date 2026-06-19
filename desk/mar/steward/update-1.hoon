::  steward-update-1: mark for steward outbound updates and scry results
::
::    lens update is now a single entry (bot + id + run), not a union.
::    dispatched by module key: {"lens": {...lens-entry...}}
::    adding a future module means adding a variant to $update in sur/steward,
::    not a new mark file.
::
/-  s=steward
|_  =update:v1:s
++  grad  %noun
++  grow
  |%
  ++  noun  update
  ++  json
    |^
    =,  enjs:format
    ^-  ^json
    ?-  -.update
        %lens
      %-  frond  :-  'lens'
      (entry update.update)
    ::
        %gateway
      %-  frond  :-  'gateway'
      (gateway-update update.update)
    ==
    ++  entry
      |=  e=update:lens:v1:s
      ^-  ^json
      =,  enjs:format
      %-  pairs
      :~  ['bot' s+(scot %p bot.e)]
          ['id' s+id.e]
          ['complete' b+complete.run.e]
          ['received' s+(scot %da received.run.e)]
          ['payload' s+payload.run.e]
      ==
    ++  gateway-update
      |=  upd=update:gateway:s
      ^-  ^json
      =,  enjs:format
      ?-  -.upd
          %status
        %-  frond  :-  'status'
        %-  pairs
        :~  ['status' s+(crip (trip status.upd))]
            ['lease-until'
              ?~  lease-until.upd  ~
              s+(scot %da u.lease-until.upd)
            ]
        ==
      ::
          %owner-activity
        %-  frond  :-  'owner-activity'
        %-  frond  :-  'last-owner-msg'
        s+(scot %da last-owner-msg.upd)
      ::
          %auto-reply
        %-  frond  :-  'auto-reply'
        %-  pairs
        :~  ['ship' s+(scot %p ship.upd)]
            ['at' s+(scot %da at.upd)]
        ==
      ==
    --
  --
++  grab
  |%
  ++  noun  update:v1:s
  --
--

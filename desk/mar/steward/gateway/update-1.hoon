::  %steward-gateway-update-1: liveness facts for status observers
::
/-  g=steward-gateway
|_  upd=update:v1:g
++  grad  %noun
++  grow
  |%
  ++  noun  upd
  ++  json
    =,  enjs:format
    ?-  -.upd
        %status
      %-  frond  :-  'status'
      %-  pairs
      :~  ['status' s+(crip (trip status.upd))]
          :-  'lease-until'
          ?~(lease-until.upd ~ s+(scot %da u.lease-until.upd))
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
++  grab
  |%
  ++  noun  update:v1:g
  --
--

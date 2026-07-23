::  %acp-update-1: Tlon agent message bus updates
::
/-  a=acp
/+  cj=channel-json
=*  z  ..zuse
|_  upd=update:a
++  grad  %noun
++  grow
  |%
  ++  noun  upd
  ++  json
    =,  enjs:format
    =/  ship-json  |=(value=@p s+(scot %p value))
    =/  conversation-json
      |=  value=conversation:a
      ^-  json:z
      ?-  -.value
        %dm       (frond 'dm' (ship-json ship.value))
        %channel  (frond 'channel' (nest:enjs:cj [kind.value host.value name.value]))
      ==
    =/  routing-json
      |=  value=routing:a
      ^-  json:z
      %-  pairs
      :~  owner+(ship-json owner.value)
          allowed-dms+a+(turn ~(tap in allowed-dms.value) ship-json)
          allowed-channel-ships+a+(turn ~(tap in allowed-channel-ships.value) ship-json)
          channels+a+(turn ~(tap in channels.value) nest:enjs:cj)
          require-channel-mention+b+require-channel-mention.value
          owner-listen+b+owner-listen.value
      ==
    =/  request-json
      |=  value=request:a
      ^-  json:z
      %-  pairs
      :~  sequence+(numb sequence.value)
          received+s+(scot %da received.value)
          conversation+(conversation-json conversation.value)
          sender+(ship-json sender.value)
          message-id+s+message-id.value
          text+s+text.value
      ==
    ^-  json:z
    ?-  -.upd
        %configuration
      (frond 'configuration' ?~(routing.upd ~ (routing-json u.routing.upd)))
    ::
        %requests
      (frond 'requests' a+(turn requests.upd request-json))
    ::
        %completed
      (frond 'completed' (frond 'sequence' (numb sequence.upd)))
    ::
        %failed
      %-  frond  :-  'failed'
      %-  pairs
      :~  sequence+(numb sequence.upd)
          reason+s+reason.upd
      ==
    ==
  --
++  grab
  |%
  ++  noun  update:a
  --
--

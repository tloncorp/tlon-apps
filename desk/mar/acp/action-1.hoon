::  %acp-action-1: configure and consume the Tlon agent message bus
::
/-  a=acp
/+  cj=channel-json
=*  z  ..zuse
|_  act=action:a
++  grad  %noun
++  grow
  |%
  ++  noun  act
  ++  json
    =,  enjs:format
    =/  ship-json  |=(value=@p s+(scot %p value))
    =/  nest-json
      |=  value=[kind=?(%chat %diary %heap) host=@p name=@tas]
      ^-  json:z
      (nest:enjs:cj value)
    =/  routing-json
      |=  value=routing:a
      ^-  json:z
      %-  pairs
      :~  owner+(ship-json owner.value)
          allowed-dms+a+(turn ~(tap in allowed-dms.value) ship-json)
          allowed-channel-ships+a+(turn ~(tap in allowed-channel-ships.value) ship-json)
          channels+a+(turn ~(tap in channels.value) nest-json)
          require-channel-mention+b+require-channel-mention.value
          owner-listen+b+owner-listen.value
      ==
    ^-  json:z
    ?-  -.act
        %configure
      (frond 'configure' (routing-json routing.act))
    ::
        %reply
      %-  frond  :-  'reply'
      %-  pairs
      :~  sequence+(numb sequence.act)
          text+s+text.act
      ==
    ==
  --
++  grab
  |%
  ++  noun  action:a
  ++  json
    =,  dejs:format
    =/  routing-json
      %-  ot
      :~  owner+(se %p)
          allowed-dms+(cu sy (ar (se %p)))
          allowed-channel-ships+(cu sy (ar (se %p)))
          channels+(cu sy (ar nest:dejs:cj))
          require-channel-mention+bo
          owner-listen+bo
      ==
    %-  of
    :~  [%configure routing-json]
        [%reply (ot sequence+ni text+so ~)]
    ==
  --
--

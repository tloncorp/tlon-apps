/-  gt=groups-thread, meta
/+  gj=groups-json, cj=channel-json
=>
  =,  dejs:format
  |%
  ++  create-group
    ^-  $-(json create-group:gvt)
    %-  ot
    :~  'groupId'^flag:dejs:gvj
        'meta'^meta
        'guestList'^(as ship:dejs:gvj)
        'channels'^(ar create-channel)
    ==
  ++  create-channel
    ^-  $-(json create-channel:gvt)
    %-  ot
    :~  'channelId'^nest:dejs:cj
        'meta'^meta
    ==
  ++  meta
    ^-  $-(json data:^^meta)
    %-  ou
    :~  'title'^(uf '' so)
        'description'^(uf '' so)
        'image'^(uf '' so)
        'cover'^(uf '' so)
    ==
  --
|_  =create-group:gvt
++  grad  %noun
++  grow
  |%
  ++  noun  create-group
  --
++  grab
  |%
  ++  noun  create-group:gvt
  ++  json  ^create-group
  --
--

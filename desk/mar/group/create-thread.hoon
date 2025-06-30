/-  gt=groups-thread, meta
/+  gj=groups-json, cj=channel-json
=>
  =,  dejs:format
  |%
  ++  create-group
    ^-  $-(json create-group:gt)
    %-  ot
    :~  'groupId'^flag:dejs:gj
        'meta'^meta
        'guestList'^(as ship:dejs:gj)
        'channels'^(ar create-channel)
    ==
  ++  create-channel
    ^-  $-(json create-channel:gt)
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
|_  =create-group:gt
++  grad  %noun
++  grow
  |%
  ++  noun  create-group
  --
++  grab
  |%
  ++  noun  create-group:gt
  ++  json  ^create-group
  --
--

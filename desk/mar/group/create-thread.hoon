/-  gt=groups-thread
/+  gj=groups-json, cj=channel-json
=>
  =,  dejs:format
  |%
  ++  create-group
    ^-  $-(json create-group:gt)
    %-  ot
    :~  group-id+flag:dejs:gj
        meta+meta:dejs:gj
        guest-list+(as ship:dejs:gj)
        channels+(ar create-channel)
    ==
  ++  create-channel
    ^-  $-(json create-channel:gt)
    %-  ot
    :~  channel-id+nest:dejs:cj
        meta+meta:dejs:gj
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

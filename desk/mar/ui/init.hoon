/-  u=ui
/+  gj=groups-json, cj=chat-json, dj=channel-json
::  group flag + channel flag
|_  =init:u
++  grad  %noun
++  grow
  |%
  ++  noun  init
  ++  json
    =,  enjs:format
    ^-  ^json
    %-  pairs
    :~  groups/(groups-ui:enjs:gj groups.init)
        gangs/(gangs:enjs:gj gangs.init)
        channels/(channels:enjs:dj channels.init)
        unreads/(unreads:enjs:dj unreads.init)
        pins/a/(turn pins.init whom:enjs:gj)
        profile/b/profile.init
    ==
  --
++  grab
  |%
  ++  noun  init:u
  --
--

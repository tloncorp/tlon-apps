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
        briefs/(briefs:enjs:dj briefs.init)
        pins/a/(turn pins.init (cork whom:enjs:cj (lead %s)))
    ==
  --
++  grab
  |%
  ++  noun  init:u
  --
--

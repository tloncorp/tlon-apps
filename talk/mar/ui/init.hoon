/-  u=ui
/+  gj=groups-json, cj=chat-json, dj=channel-json
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
        clubs/(clubs:enjs:cj clubs.init)
        dms/a/(turn ~(tap in dms.init) ship:enjs:gj)
        unreads/(unreads:enjs:cj unreads.init)
        invited/a/(turn ~(tap in invited.init) ship:enjs:gj)
        pins/a/(turn pins.init (cork whom:enjs:cj (lead %s)))
    ==
  --
++  grab
  |%
  ++  noun  init:u
  --
--

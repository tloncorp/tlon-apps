/-  u=ui
/+  gj=groups-json, cj=chat-json
|_  =init:u
++  grad  %noun
++  grow
  |%
  ++  noun  init
  ++  json
    =,  enjs:format
    %-  pairs
    :~  groups/(groups-ui:enjs:gj groups.init)
        gangs/(gangs:enjs:gj gangs.init)
        clubs/(clubs:enjs:cj clubs.init)
        dms/a/(turn ~(tap in dms.init) ship:enjs:gj)
        briefs/(briefs:enjs:cj briefs.init)
        invited/a/(turn ~(tap in invited.init) ship:enjs:gj)
        pins/a/(turn pins.init (cork whom:enjs:cj (lead %s)))
    ==
  --
++  grab
  |%
  ++  noun  init:u
  --
--

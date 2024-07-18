/-  u=ui
/+  gj=groups-json, cj=chat-json, dj=channel-json, aj=activity-json
|_  init=init-2:u
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
        channels/(channels-2:enjs:dj channels.init)
        activity/(activity:v2:enjs:aj activity.init)
        pins/a/(turn pins.init whom:enjs:gj)
        profile/b/profile.init
      ::
        :-  %chat
        %-  pairs
        :~  clubs/(clubs:enjs:cj clubs.chat.init)
            dms/a/(turn ~(tap in dms.chat.init) ship:enjs:gj)
            invited/a/(turn ~(tap in invited.chat.init) ship:enjs:gj)
        ==
    ==
  --
++  grab
  |%
  ++  noun  init-2:u
  --
--

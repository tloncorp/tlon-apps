/-  u=ui
/+  gj=groups-json, cj=chat-json, dj=channel-json
::  group flag + channel flag
|_  init=init-0:u
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
      ::
        :-  %chat
        %-  pairs
        :~  clubs/(clubs:enjs:cj clubs.chat.init)
            dms/a/(turn ~(tap in dms.chat.init) ship:enjs:gj)
            unreads/(unreads:enjs:cj unreads.chat.init)
            invited/a/(turn ~(tap in invited.chat.init) ship:enjs:gj)
        ==
    ==
  --
++  grab
  |%
  ++  noun  init:u
  --
--

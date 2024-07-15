/-  u=ui
/+  gj=groups-json, cj=chat-json, dj=channel-json, aj=activity-json
|_  init=init-4:u
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
        activity/(activity:enjs:aj activity.init)
        pins/a/(turn pins.init whom:enjs:gj)
        profile/b/profile.init
      ::
        :-  %channel
        %-  pairs
        :~  channels/(channels-2:enjs:dj channels.channel.init)
            hidden-posts/(hidden-posts:enjs:dj hidden-posts.channel.init)
        ==
      ::
        :-  %chat
        %-  pairs
        :~  clubs/(clubs:enjs:cj clubs.chat.init)
            dms/a/(turn ~(tap in dms.chat.init) ship:enjs:gj)
            invited/a/(turn ~(tap in invited.chat.init) ship:enjs:gj)
            blocked/a/(turn ~(tap in blocked.chat.init) ship:enjs:gj)
            blocked-by/a/(turn ~(tap in blocked-by.chat.init) ship:enjs:gj)
            hidden-messages/(hidden-messages:enjs:cj hidden-messages.chat.init)
        ==
    ==
  --
++  grab
  |%
  ++  noun  init-4:u
  --
--

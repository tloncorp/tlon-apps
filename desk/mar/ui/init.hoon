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
    |^
    ^-  ^json
    %-  pairs
    :~  groups/(groups-ui:enjs:gj groups.init)
        gangs/(gangs:enjs:gj gangs.init)
        chat/(chat chat.init)
        heap/(heap heap.init)
        diary/(diary diary.init)
    ==
    ++  chat
      |=  =chat:u
      ^-  ^json
      %-  pairs
      :~  briefs/(briefs:enjs:dj briefs.chat)
          shelf/(rr-shelf:enjs:dj shelf.chat)
          pins/a/(turn pins.chat (cork whom:enjs:cj (lead %s)))
      ==
    ++  heap
      |=  =heap:u
      ^-  ^json
      %-  pairs
      :~  briefs/(briefs:enjs:dj -.heap)
          shelf/(rr-shelf:enjs:dj +.heap)
      ==
    ++  diary
      |=  =diary:u
      ^-  ^json
      %-  pairs
      :~  briefs/(briefs:enjs:dj -.diary)
          shelf/(rr-shelf:enjs:dj +.diary)
      ==
    --
  --
++  grab
  |%
  ++  noun  init:u
  --
--

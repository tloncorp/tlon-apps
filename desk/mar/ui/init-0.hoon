/-  u=ui
/+  gj=groups-json, cj=chat-json, dj=diary-json, hj=heap-json
::  group flag + channel flag
|_  init=init-0:u
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
      :~  briefs/(briefs:enjs:cj briefs.chat)
          chats/(chats:enjs:cj chats.chat)
          pins/a/(turn pins.chat (cork whom:enjs:cj (lead %s)))
      ==
    ++  heap
      |=  =heap:u
      ^-  ^json
      %-  pairs
      :~  briefs/(briefs:enjs:hj -.heap)
          stash/(stash:enjs:hj +.heap)
      ==
    ++  diary
      |=  =diary:u
      ^-  ^json
      %-  pairs
      :~  briefs/(briefs:enjs:dj -.diary)
          shelf/(shelf:enjs:dj +.diary)
      ==
    --
  --
++  grab
  |%
  ++  noun  init-0:u
  --
--

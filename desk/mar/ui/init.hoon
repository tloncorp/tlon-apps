/-  u=ui
/+  gj=groups-json, cj=chat-json, dj=diary-json, hj=heap-json
::  group flag + channel flag
|_  =init:u
++  grad  %noun
++  grow
  |%
  ++  noun  init
  ++  json
    =,  enjs:format
    |^
    %-  pairs
    :~  groups/(groups:enjs:gj groups.init)
        gangs/(gangs:enjs:gj gangs.init)
        chat/(chat chat.init)
        heap/(heap heap.init)
        diary/(diary diary.init)
    ==
    ++  chat
      |=  =chat:u
      %-  pairs
      :~  briefs/(briefs:enjs:cj -.chat)
          chats/(chats:enjs:cj +.chat)
      ==
    ++  heap
      |=  =heap:u
      %-  pairs
      :~  briefs/(briefs:enjs:hj -.heap)
          stash/(stash:enjs:hj +.heap)
      ==
    ++  diary
      |=  =diary:u
      %-  pairs
      :~  briefs/(briefs:enjs:dj -.diary)
          shelf/(shelf:enjs:dj +.diary)
      ==
    --
  --
++  grab
  |%
  ++  noun  init:u
  --
--

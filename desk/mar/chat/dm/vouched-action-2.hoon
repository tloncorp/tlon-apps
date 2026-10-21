::  chat-dm-vouched-action-2: a dm action carried out under a vouched
::  "virtual identity" (.as, a moon of the actor). See +dv-core in /app/chat.
::
/-  c=chat
/+  j=chat-json
|_  =vouched-action:dm:c
++  grad  %noun
++  grow
  |%
  ++  noun  vouched-action
  ++  json
    %-  pairs:enjs:format
    :~  as+(ship:enjs:j as.vouched-action)
        action+(dm-action:v7:enjs:j action.vouched-action)
    ==
  --
++  grab
  |%
  ++  noun  vouched-action:dm:c
  ++  json
    %-  ot:dejs:format
    :~  as+ship:dejs:j
        action+dm-action:v7:dejs:j
    ==
  --
--

::  chat-dm-vouched-diff-2: the network message for a vouched "virtual
::  identity" dm. .as is the bot moon; the conversation key is derived from
::  .as and the sender/receiver. See +dv-core in /app/chat.
::
/-  c=chat
/+  j=chat-json
|_  =vouched-diff:dm:c
++  grad  %noun
++  grow
  |%
  ++  noun  vouched-diff
  ++  json
    %-  pairs:enjs:format
    :~  as+(ship:enjs:j as.vouched-diff)
        diff+(writs-diff:v7:enjs:j diff.vouched-diff)
    ==
  --
++  grab
  |%
  ++  noun  vouched-diff:dm:c
  ++  json
    %-  ot:dejs:format
    :~  as+ship:dejs:j
        diff+writs-diff:v7:dejs:j
    ==
  --
--

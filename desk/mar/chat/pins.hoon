/-  c=chat
/+  j=chat-json
|_  pins=(list whom:c)
++  grad  %noun
++  grow
  |%
  ++  noun  pins
  ++  json  (pins:enjs:j pins)
  --
++  grab
  |%
  ++  noun  (list whom:c)
  ++  json  pins:dejs:j
  --
--

/-  d=channels
/+  j=channel-json
|_  pins=(list nest:d)
++  grad  %noun
++  grow
  |%
  ++  noun  pins
  ++  json  (pins:enjs:j pins)
  --
++  grab
  |%
  ++  noun  (list nest:d)
  ++  json  pins:dejs:j
  --
--

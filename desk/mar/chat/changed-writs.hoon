/-  c=chat
/+  j=chat-json
|_  changes=(map whom:v6:c (unit writs:v6:c))
++  grad  %noun
++  grow
  |%
  ++  noun  changes
  ++  json
    ^-  ^json
    %-  pairs:enjs:format
    =,  enjs:j
    %+  turn  ~(tap by changes)
    |=  [=whom:v6:c writs=(unit writs:v6:c)]
    ^-  [@t json]
    :-  (^whom whom)
    ?~(writs ~ (^writs u.writs))
  --
++  grab
  |%
  ++  noun  (map whom:v6:c (unit writs:v6:c))
  --
--

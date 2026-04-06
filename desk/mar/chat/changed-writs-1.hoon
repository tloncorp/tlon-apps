/-  cv=chat-ver
/+  j=chat-json
|_  changes=(map whom:v7:cv (unit writs:v7:cv))
++  grad  %noun
++  grow
  |%
  ++  noun  changes
  ++  json
    ^-  ^json
    %-  pairs:enjs:format
    =,  enjs:j
    %+  turn  ~(tap by changes)
    |=  [=whom:v7:cv writs=(unit writs:v7:cv)]
    ^-  [@t json]
    :-  (^whom whom)
    ?~(writs ~ (writs:v7 u.writs))
  --
++  grab
  |%
  ++  noun  (map whom:v7:cv (unit writs:v7:cv))
  --
--

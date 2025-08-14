/-  cv=chat-ver
/+  j=chat-json
|_  changes=(map whom:v6:cv (unit writs:v6:cv))
++  grad  %noun
++  grow
  |%
  ++  noun  changes
  ++  json
    ^-  ^json
    %-  pairs:enjs:format
    =,  enjs:j
    %+  turn  ~(tap by changes)
    |=  [=whom:v6:cv writs=(unit writs:v6:cv)]
    ^-  [@t json]
    :-  (^whom whom)
    ?~(writs ~ (^writs u.writs))
  --
++  grab
  |%
  ++  noun  (map whom:v6:cv (unit writs:v6:cv))
  --
--

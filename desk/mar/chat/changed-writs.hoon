/-  cv=chat-ver
/+  j=chat-json
|_  changes=(map whom:v6:cv writs:v6:cv)
++  grad  %noun
++  grow
  |%
  ++  noun  changes
  ++  json
    ^-  ^json
    %-  pairs:enjs:format
    =,  enjs:j
    %+  turn  ~(tap by changes)
    |=  [=whom:v6:cv writs=writs:v6:cv]
    ^-  [@t json]
    [(^whom whom) (^writs writs)]
  --
++  grab
  |%
  ++  noun  (map whom:v6:cv writs:v6:cv)
  --
--

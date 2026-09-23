/-  gv=groups-ver
/+  j=groups-json
|_  changes=(map flag:v11:gv group-ui:v11:gv)
++  grad  %noun
++  grow
  |%
  ++  noun  changes
  ++  json
    ^-  ^json
    %-  pairs:enjs:format
    %+  turn  ~(tap by changes)
    |=  [=flag:v11:gv =group-ui:v11:gv]
    :-  (print-flag:v11:enjs:j flag)
    (group-ui:v11:enjs:j group-ui)
  --
++  grab
  |%
  ++  noun  (map flag:v11:gv group-ui:v11:gv)
  --
--

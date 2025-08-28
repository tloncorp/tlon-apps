/-  gv=groups-ver
/+  j=groups-json
|_  changes=(map flag:v6:gv group-ui:v6:gv)
++  grad  %noun
++  grow
  |%
  ++  noun  changes
  ++  json
    ^-  ^json
    %-  pairs:enjs:format
    %+  turn  ~(tap by changes)
    |=  [=flag:v6:gv =group-ui:v6:gv]
    :-  (print-flag:v6:enjs:j flag)
    (group-ui:v6:enjs:j group-ui)
  --
++  grab
  |%
  ++  noun  (map flag:v6:gv group-ui:v6:gv)
  --
--

/-  gv=groups-ver
/+  j=groups-json
|_  changes=(map flag:v9:gv group-ui:v9:gv)
++  grad  %noun
++  grow
  |%
  ++  noun  changes
  ++  json
    ^-  ^json
    %-  pairs:enjs:format
    %+  turn  ~(tap by changes)
    |=  [=flag:v9:gv =group-ui:v9:gv]
    :-  (print-flag:v9:enjs:j flag)
    (group-ui:v9:enjs:j group-ui)
  --
++  grab
  |%
  ++  noun  (map flag:v9:gv group-ui:v9:gv)
  --
--

/-  gv=groups-ver
/+  j=groups-json
|_  changes=(map flag:v7:gv group-ui:v7:gv)
++  grad  %noun
++  grow
  |%
  ++  noun  changes
  ++  json
    ^-  ^json
    %-  pairs:enjs:format
    %+  turn  ~(tap by changes)
    |=  [=flag:v7:gv =group-ui:v7:gv]
    :-  (print-flag:v7:enjs:j flag)
    (group-ui:v7:enjs:j group-ui)
  --
++  grab
  |%
  ++  noun  (map flag:v7:gv group-ui:v7:gv)
  --
--

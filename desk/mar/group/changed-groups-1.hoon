/-  gv=groups-ver
/+  j=groups-json
|_  changes=(map flag:v5:gv group-ui:v5:gv)
++  grad  %noun
++  grow
  |%
  ++  noun  changes
  ++  json
    ^-  ^json
    %-  pairs:enjs:format
    %+  turn  ~(tap by changes)
    |=  [=flag:v5:gv =group-ui:v5:gv]
    :-  (print-flag:v5:enjs:j flag)
    (group-ui:v5:enjs:j group-ui)
  --
++  grab
  |%
  ++  noun  (map flag:v5:gv group-ui:v5:gv)
  --
--

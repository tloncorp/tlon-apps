/-  gv=groups-ver
/+  j=groups-json
|_  changes=(map flag:v7:gv group-ui:v7:gv)
++  grad  %noun
++  grow
  |%
  ++  noun  changes
  ++  json
    ^-  ^json
    :-  %a
    %+  turn  ~(tap by changes)
    |=  [=flag:v7:gv =group-ui:v7:gv]
    =+  ui=(group-ui:v7:enjs:j group-ui)
    ?>  ?=([%o *] ui)
    ui(p (~(put by p.ui) 'flag' (flag:v7:enjs:j flag)))
  --
++  grab
  |%
  ++  noun  (map flag:v7:gv group-ui:v7:gv)
  --
--

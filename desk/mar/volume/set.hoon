::  %volume-set: a notification configuration command
::
/+  *volume, gjs=groups-json
|_  [=scope =value]
++  grad  %noun
++  grow
  |%
  ++  noun  [scope value]
  --
++  grab
  |%
  ++  noun  ,[=^scope =^value]
  ++  json
    =,  dejs:format
    |^  (ot 'scope'^scope 'value'^value ~)
    ++  scope
      |=  jon=^^json
      ^-  ^^scope
      ?~  jon  ~
      %.  jon
      %-  of
      :~  %group^flag:dejs:gjs
          %channel^nest:dejs:gjs
      ==
    ++  value
      |=  jon=^^json
      ^-  ^^value
      ?+  jon  !!
        ~  ~
        [%s ?(%loud %soft %hush)]  p.jon
      ==
    --
  --
--

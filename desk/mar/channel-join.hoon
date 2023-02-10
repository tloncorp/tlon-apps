/-  g=groups
/+  j=groups-json
::  group flag + channel flag
|_  join=[group=flag:g chan=flag:g]
++  grad  %noun
++  grow
  |%
  ++  noun  join
  ++  json
    %-  pairs:enjs:format
    :~  group/s/(flag:enjs:j group.join)
        chan/s/(flag:enjs:j chan.join)
    ==
  --
++  grab
  |%
  ++  noun  [group=flag:g chan=flag:g]
  ++  json  
    %-  ot:dejs:format
    :~  group/flag:dejs:j
        chan/flag:dejs:j
    ==
  --
--

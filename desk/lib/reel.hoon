/-  reel
|%
++  enjs-metadata
  |=  =metadata:reel
  ^-  json
  =/  fields
    %+  turn  ~(tap by fields.metadata)
    |=  [key=cord value=cord]
    ^-  [cord json]
    [key s+value]
  %-  pairs:enjs:format
  :~  ['tag' s+tag.metadata]
      ['fields' (pairs:enjs:format fields)]
  ==
++  dejs-metadata
  %-  ot:dejs:format
  :~  tag+so:dejs:format
      fields+(om so):dejs:format
  ==
--

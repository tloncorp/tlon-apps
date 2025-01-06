/-  c=channels
/+  cj=channel-json
|_  [example=nest:c target=nest:c]
++  grad  %noun
++  grow
  |%
  ++  noun  [example target]
  ++  json
    =,  enjs:format
    %-  pairs
    :~  example+(nest:enjs:cj example)
        target+(nest:enjs:cj target)
    ==
  --
++  grab
  |%
  ++  noun  [nest:c nest:c]
  ++  json
    =,  dejs:format
    %-  ot
    :~  example/nest:dejs:cj
        target/nest:dejs:cj
    ==
  --
--

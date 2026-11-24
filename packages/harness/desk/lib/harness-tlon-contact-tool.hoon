::  Public profile projection and patch-only edits. Never send omitted fields.
/-  ct=contacts
/+  spec=harness-tlon-tool, hp=harness-tlon-history-page
|%
++  fields
  ^-  (list [key=@tas cap=@ud image=?])
  ~[[%nickname 64 |] [%bio 1.024 |] [%status 128 |] [%avatar 2.048 &] [%cover 2.048 &]]
++  encode
  |=  con=contact:ct
  %-  pairs:enjs:format
  %+  turn  fields
  |=  [key=@tas cap=@ud image=?]
  =/  value  (~(get by con) key)
  :-  key
  :-  %s
  ?~  value  ''
  ?@  u.value  ''
  ?.  ?=(?(%text %look) -.u.value)  ''
  (clip-text:hp p.u.value cap)
++  decode
  |=  args=json
  ^-  contact:ct
  =/  edits=(list [@tas value:ct])
    %+  murn  fields
    |=  [key=@tas cap=@ud image=?]
    ^-  (unit [@tas value:ct])
    ?.  (has:spec args key)  ~
    =/  value  (string:spec args key '' cap)
    ?:  =('' value)  `[key ~]
    ?.  image  `[key %text value]
    ?>  |(=('https://' (end 3^8 value)) =('http://' (end 3^7 value)))
    `[key %look `@ta`value]
  ?>  ?=(^ edits)
  (~(gas by *contact:ct) edits)
--

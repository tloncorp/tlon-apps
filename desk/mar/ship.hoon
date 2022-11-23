/-  g=groups
/+  j=groups-json
|_  s=ship
++  grad  %noun
++  grow
  |%
  ++  mime  [/text/x-ship (as-octs:mimes:html (scot %p s))]
  ++  noun  s
  ++  json  s/(scot %p s)
  --
++  grab
  |%
  ++  noun  ship
  ++  json  (se:dejs:format %p)
  ++  mime  |=([=mite len=@ud tex=@] `@p`(slav %p tex))
  --
--

/-  c=contacts
/+  j=contacts-json-1
|_  dir=(map kip:c (unit page:c))
++  grad  %noun
++  grow
  |%
  ++  noun  dir
  ++  json
    %-  pairs:enjs:format
    %+  turn  ~(tap by dir)
    |=  [=kip:c page=(unit page:c)]
    ::NOTE  shenanigans to extract just the string
    :-  ?@(kip (scot %p kip) =+((cid:enjs:j +.kip) ?>(?=([%s *] -) p)))
    ?~(page ~ (page:enjs:j u.page))
  --
++  grab
  |%
  ++  noun  (map kip:c (unit page:c))
  --
--

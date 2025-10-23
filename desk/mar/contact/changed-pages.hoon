/-  c=contacts
/+  j=contacts-json-1
|_  dir=(map kip:c page=[(unit contact:c) (unit contact:c)])
++  grad  %noun
++  grow
  |%
  ++  noun  dir
  ++  json
    %-  pairs:enjs:format
    %+  turn  ~(tap by dir)
    |=  [=kip:c con=(unit contact:c) mod=(unit contact:c)]
    ::NOTE  shenanigans to extract just the string
    :-  ?@(kip (scot %p kip) =+((cid:enjs:j +.kip) ?>(?=([%s *] -) p)))
    :-  %a
    :~  ?~(con ~ (contact:enjs:j u.con))
        ?~(mod ~ (contact:enjs:j u.mod))
    ==
  --
++  grab
  |%
  ++  noun  (map kip:c (unit page:c))
  --
--

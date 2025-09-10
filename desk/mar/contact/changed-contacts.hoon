/-  c=contacts
/+  j=contacts-json-1
|_  dir=(map ship profile:c)
++  grad  %noun
++  grow
  |%
  ++  noun  dir
  ++  json
    %-  pairs:enjs:format
    %+  turn  ~(tap by dir)
    |=  [who=ship pro=profile:c]
    :-  (scot %p who)
    =+  (contact:enjs:j con.pro)
    ?>  ?=([%o *] -)
    o+(~(put by p) 'since' s+(scot %da wen.pro))
  --
++  grab
  |%
  ++  noun  (map ship profile:c)
  --
--

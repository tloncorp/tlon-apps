::  +of: ordered set, backed by list
=|  a=(list)  :: list 
|@
++  apt
  =(a ~(tap in (~(gas in *(set)) a))) 
++  push
  |*  b=*
  ^+  a
  [b (del b)]
::
++  del
  |*  b=*
  ^+  a
  (skip a |*(c=* =(c b)))
::
++  into
  |*  [b=@ud c=*] 
  ^+  a
  (^into (del c) b c)
::
++  has
  |*  b=*
  ^-  ?
  ?~  a  |
  ?:  =(i.a b)  &
  $(a t.a)
--


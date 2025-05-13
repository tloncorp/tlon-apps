::  +of: ordered set, backed by list
=|  a=(list)  :: list
|@
++  apt
  ::TODO  this can't be right lol
  =(a ~(tap in (~(gas in *(set)) a)))
++  push
  |*  b=*
  ^+  a
  [b (del b)]
::
++  del
  |*  b=*
  ^+  a
  ::TODO  out of scope for this pr, but lol, this walks the entire list always
  ::      even though it's supposed to be a "set"
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
  ::TODO  also out of scope, but this is the unjetted equivqalent of:
  ::      ?=(^ (find [b]~ a))
  ?~  a  |
  ?:  =(i.a b)  &
  $(a t.a)
--


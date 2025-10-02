::  kol: key-unique, value-ordered lists
::
|*  comp=$-([* *] ?)
=|  a=(list (pair))  ::  key-value list
|@
++  put
  |*  b=(pair)
  =+  c=|  ::  inserted b
  =+  d=|  ::  dropped old
  |-  ^+  a
  ?:  &(d c)  a
  ?~  a  ?:(c ~ [b]~)
  ?:  =(p.i.a p.b)      $(a t.a, d &)
  ?:  (comp q.i.a q.b)  [i.a $(a t.a)]
  [b i.a $(a t.a, c &)]
::
++  del
  |*  b=*
  |-  ^+  a
  ?~  a  ~
  ?:  =(p.i.a b)  t.a
  [i.a $(a t.a)]
::
++  top
  |*  b=*
  |-  ^+  a
  ?~  a  ~
  ?:((comp q.i.a b) [i.a $(a t.a)] ~)
::
++  bot
  |*  b=*
  |-  ^+  a
  ?~  a  ~
  ?:((comp q.i.a b) $(a t.a) a)
--

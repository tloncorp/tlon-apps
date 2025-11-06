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
  ?:  &(d c)                 a               ::  done
  ?~  a                      ?:(c ~ [b]~)    ::  end
  ?:  =(p.i.a p.b)           $(a t.a, d &)   ::  drop old
  ?:  |(c (comp q.i.a q.b))  [i.a $(a t.a)]  ::  next
  [b i.a $(a t.a, c &)]                      ::  insert new
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

|*  [key=mold val=mold]
=>  |%
    +$  item  [key=key val=val]
    --
~%  %mope-comp  ..zuse  ~
|=  compare=$-([key key] ?)
~%  %mope-core  ..zuse  ~
|%
::  +bat: tabulate a subset excluding start element with a max count (backwards)
::
++  bat
  |=  [a=(tree item) b=(unit key) c=@]
  ^-  (list item)
  |^
  e:(tabulate (del-span a b) b c)
  ::
  ++  tabulate
    |=  [a=(tree item) b=(unit key) c=@]
    ^-  [d=@ e=(list item)]
    ?:  ?&(?=(~ b) =(c 0))
      [0 ~]
    =|  f=[d=@ e=(list item)]
    |-  ^+  f
    ?:  ?|(?=(~ a) =(d.f c))  f
    =.  f  $(a r.a)
    ?:  =(d.f c)  f
    =.  f  [+(d.f) [n.a e.f]]
    ?:(=(d.f c) f $(a l.a))
  ::
  ++  del-span
    |=  [a=(tree item) b=(unit key)]
    ^-  (tree item)
    ?~  a  a
    ?~  b  a
    ?:  =(key.n.a u.b)
      l.a
    ?.  (compare key.n.a u.b)
      $(a l.a)
    a(r $(a r.a))
  --
::  +bot: produce the N leftmost elements
::
++  bot
  |=  [a=(tree item) b=@]
  ^-  (list item)
  |^  p:(items-with-remainder a b)
  ++  items-with-remainder
    |=  [a=(tree item) b=@]
    ^-  (pair (list item) @)
    ?~  a  [~ b]
    ?:  =(b 0)  [~ 0]
    =/  left-result  (items-with-remainder l.a b)
    ?:  =(q.left-result 0)  left-result
    ?:  =(q.left-result 1)  [(zing ~[p.left-result ~[n.a]]) (dec q.left-result)]
    =/  right-result
      (items-with-remainder r.a (dec q.left-result))
    [(zing ~[p.left-result ~[n.a] p.right-result]) q.right-result]
  --
::  +top: produce the N rightmost elements
::
++  top
  |=  [a=(tree item) b=@]
  ^-  (list item)
  |^  p:(items-with-remainder a b)
  ++  items-with-remainder
    |=  [a=(tree item) b=@]
    ^-  (pair (list item) @)
    ?~  a  [~ b]
    ?:  =(b 0)  [~ 0]
    =/  right-result  (items-with-remainder r.a b)
    ?:  =(q.right-result 0)  right-result
    ?:  =(q.right-result 1)  [[n.a p.right-result] (dec q.right-result)]
    =/  left-result
      (items-with-remainder l.a (dec q.right-result))
    [(zing ~[p.left-result ~[n.a] p.right-result]) q.left-result]
  --
::  +bif: split by node (used internally by +dif)
::
++  bif
  ~/
  |=  [a=(tree item) b=key c=val]
  ^-  [l=(tree item) r=(tree item)
  =<  +
  |-  ^-  (tree item)
  ?~  a
    [[b c] ~ ~]
  ?:  =(b key.n.a)
    ?:  =(c val.n.a)
      a
    a(n [b c])
  ?:  (compare b key.n.a)
    =+  d=$(a l.a)
    ?>  ?=(^ d)
    d(r a(l r.d))
  =+  d=$(a r.a)
  ?>  ?=(^ d)
  d(l a(r l.d))
::
::  +dif: "set difference", those elements in a but not in b
::
++  dif
  ~/  %dif
  |=  [a=(tree item) b=(tree item)]
  |-  ^-  (tree item)
  ?~  b
    a
  =+  c=(bif a n.b)
  ?>  ?=(^ c)
  =+  d=$(a l.c, b l.b)
  =+  e=$(a r.c, b r.b)
  |-  ^-  (tree item)
  ?~  d  e
  ?~  e  d
  ?:  (mor key.n.d key.n.e)
    d(r $(d r.d))
  e(l $(e l.e))
::  +uno: merge with conflict resolution function
::
++  uno
  ~/  %uno
  |=  [a=(tree item) b=(tree item)]
  |=  [meg=$-([key val val] val)]
  ^-  (tree item)
  ?~  b  a
  ?~  a  b
  ?:  =(key.n.a key.n.b)
    [n=(meg key.n.a val.n.a val.n.b) l=$(a l.a, b l.b) r=$(a r.a, b r.b)]
  ?:  (mor key.n.a key.n.b)
    ?:  (compare key.n.b key.n.a)
      $(l.a $(a l.a, r.b ~), b r.b)
    $(r.a $(a r.a, l.b ~), b l.b)
  ?:  (compare key.n.a key.n.b)
    $(l.b $(b l.b, r.a ~), a r.a)
  $(r.b $(b r.b, l.a ~), a l.a)
::  +int: intersection, preferring second value
::
++  int
  ~/  %int
  |=  [a=(tree item) b=(tree item)]
  |-  ^-  (tree item)
  ?~  b  ~
  ?~  a  ~
  ?:  =(key.n.a key.n.b)
    b(l $(b l.b, a l.a), r $(b r.b, a r.a))
  ?:  (compare key.n.b key.n.a)
    %+  uni:on
      $(a l.a, r.b ~)   ::  left side of b must be in the left side of a
    $(l.b ~)            ::  right side of b might be anywhere
  %+  uni:on
    $(a r.a, l.b ~)     ::  right side of b must be in the right side of a
  $(r.b ~)              ::  left side of b might be anywhere
::  +tin: intersection, but only if value is also equal
::
++  tin
  ~/  %tin
  |=  [a=(tree item) b=(tree item)]
  |-  ^-  (tree item)
  ?~  b  ~
  ?~  a  ~
  ?:  =(key.n.a key.n.b)
    ?:  =(val.n.a val.n.b)
      b(l $(b l.b, a l.a), r $(b r.b, a r.a))
    (uni:on $(b l.b, a l.a), r $(b r.b, a r.a))
  ?:  (compare key.n.b key.n.a)
    %+  uni:on
      $(a l.a, r.b ~)   ::  left side of b must be in the left side of a
    $(l.b ~)            ::  right side of b might be anywhere
  %+  uni:on
    $(a r.a, l.b ~)     ::  right side of b must be in the right side of a
  $(r.b ~)              ::  left side of b might be anywhere
--

::  re-html: _very experimental_ manx reparsers
::
::TODO  not relevant to us, but selector-esque navigations/grabbing could be cool
::TODO  probably want reparsers here to take the shape of
::      "if it matches, do x, then continue" or "try to do x, continue after"
::      and being able to specify that recursively, and/or specify what
::      "continue" means (into node, into children, back out, etc.)
|%
+$  fist  $-(manx (unit *))
+$  fest  $-(marl (unit *))
+$  fans  $-(manx marl)
::  manx navigation
::
++  dig  ::  get children of expected tag
  |=  tag=mane
  |=  nod=manx
  ^-  (unit marl)
  ?.  =(tag n.g.nod)  ~
  (some c.nod)
::  manx processing
::
++  tex  ::  get as text node
  |=  nod=manx
  ^-  (unit tape)
  ?~  a.g.nod  ~
  ?:  =(%$ n.i.a.g.nod)
    `v.i.a.g.nod
  $(a.g.nod t.a.g.nod)
::
++  tez  ::  get all contained text
  |=  nod=manx
  ^-  (list tape)
  ::NOTE  the way text nodes are constructed, we _shouldn't_ be getting
  ::      text from both sides of this weld, but you really never know...
  ::TODO  $manx should just have a @t case for text nodes...
  %+  weld
    ?.  =(%$ n.g.nod)  ~
    (drop (tex nod))
  ^-  (list tape)
  (zing (turn c.nod tez))
::  marl processing
::
++  pop  ::  process first child
  |*  fun=fist
  |=  nos=marl
  ?~  nos  [~ ~]
  [(fun i.nos) t.nos]
--
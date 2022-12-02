/-  spider
/-  gra=graph-store
/-  d=diary
/+  chat-migrate=chat-graph
/+  migrate=diary-graph
/+  strandio
|%
++  graph-to-notes
  |=  =graph:gra:d
  %+  gas:on:notes:d  *notes:d
  %+  murn  (tap:orm-gra:d graph)
  |=  [=time =node:gra:d]
  ^-  (unit [_time note:d])
  ?~  not=(node-to-note time node)
    ~
  `[time u.not]
++  orm  orm-gra:d
++  node-to-children
  |=  =node:gra:d
  ^-  (unit graph:gra:d)
  ?.  ?=(%graph -.children.node)
    ~
  `p.children.node
::
++  node-to-post
  |=  =node:gra:d
  ^-  (unit post:gra:d)
  ?.  ?=(%& -.post.node)
    ~
  `p.post.node
::
++  get-latest-post
  |=  =node:gra:d
  ^-  (unit post:gra:d)
  ;<  =graph:gra:d           _biff   (node-to-children node)
  ;<  nod=node:gra:d         _biff   (get:orm graph 1)
  ;<  revs=graph:gra:d       _biff   (node-to-children nod)
  ;<  [@ recent=node:gra:d]  _biff   (pry:orm revs)
  (node-to-post recent)
::  TODO: review crashing semantics
::        check graph ordering (backwards iirc)
++  node-to-note
  |=  [=time =node:gra:d]
  ^-  (unit note:d)
  ?~  pos=(get-latest-post node)
    ~
  ::  =/  coms=(note-to-quips)
  =/  =seal:d  [time ~ ~]
  ::  =/  comments  (node-to-comments com-node)
  ?.  ?=([[%text *] *] contents.u.pos)
    ~  :: XX: should be invariant, don't want to risk it
  =/  con=(list verse:d)  (migrate *flag:d *@ud t.contents.u.pos)
  =/  =essay:d
    =,(u.pos [text.i.contents '' con author time-sent])
  `[seal essay]
::
++  node-to-quips
  |=  =node:gra:d
  ^-  quips:d
  =/  coms=(unit graph:gra:d)
    ;<  =graph:gra:d      _biff  (node-to-children node)
    ;<  coms=node:gra:d   _biff  (get:orm graph 2)
    (node-to-children coms)
  %+  gas:on:quips:d  *quips:d
  %+  murn  ?~(coms ~ (tap:orm u.coms))
  |=  [=time =node:gra:d]
  ?~  qup=(node-to-quip time node)
    ~
  `[time u.qup]
::
++  node-to-quip
  |=  [=time =node:gra:d]
  ^-  (unit quip:d)
  ;<  =graph:gra:d           _biff  (node-to-children node)
  ;<  [@ latest=node:gra:d]  _biff  (pry:orm graph)
  ;<  =post:gra:d            _biff  (node-to-post latest)
  =/  =cork:d  [time ~]
  =/  =memo:d  =,(post [[~ (inline:chat-migrate contents)] author time-sent])
  `[cork memo]
--
=,  strand=strand:spider
=,  poke-our=poke-our:strandio
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<([~ =flag:d] arg)
;<  [%6 =network:gra]  bind:m
  (scry:strandio ,[%6 =network:gra] /gx/graph-store/export/noun)
=/  [=graph:gra:d mar=(unit mark)]  (~(got by graphs.network) flag)
~&  (graph-to-notes graph)
(pure:m *vase)

  

  


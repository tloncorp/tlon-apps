/-  c=chat, n=nark, g=groups
/-  cite
/+  gra=graph-store
/+  pac=dm
/+  nark
|%
++  convert
  |=  =graph:gra
  ^-  pact:c
  =|  =pact:c
  =/  nodes=(list (pair atom node:gra))
    (tap:orm:gra graph)
  |- 
  ?~  nodes
    ~&  'nothing to do :('
    pact
  =/  node  i.nodes
  ?~  mem=(node-to-memo q.node)
    $(nodes t.nodes)
  =/  =id:c
    [author.u.mem p.node] :: technically wrong, but defends against poor clients
  $(nodes t.nodes, pact (~(reduce pac pact) p.node id %add u.mem))
++  node-to-memo
  |=  =node:gra
  ^-  (unit memo:c)
  ?.  ?=(%& -.post.node)
    ~
  =*  p  p.post.node
  ~&  >>  (ref contents.p)
  :-  ~
  :*  replying=~  ::(ref contents.p)
      author=author.p
      sent=time-sent.p
      contents=(con:nark contents.p)
  ==
--

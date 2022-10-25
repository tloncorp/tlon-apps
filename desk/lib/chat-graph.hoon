/-  c=chat
/+  gra=graph-store
/+  pac=dm
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
  :-  ~
  :*  replying=~
      author=author.p
      sent=time-sent.p
      contents=(con contents.p)
  ==
++  con
  |=  cs=(list content:gra)
  ^-  content:c
  =;  mes=(list inline:c)
    story/[~ mes]
  %+  turn  cs
  |=  con=content:gra
  ^-  inline:c
  ?-  -.con
    %text       text.con
    %mention    `@t`(scot %p ship.con)
    %url        [%link [. .]:url.con]
    %code       [%inline-code expression.con]
    %reference  'elided reference' :: TODO fix?
  ==
--

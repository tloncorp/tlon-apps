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
  story/[~ (inline cs)]
::
++  inline
  |=  cs=(list content:gra)
  ^-  (list inline:c)
  %-  zing
  %+  turn  cs
  |=  con=content:gra
  ^-  (list inline:c)
  ?-  -.con
    %text       (fall (rush text.con apex:parse) ~[text.con])
    %mention    ~[`@t`(scot %p ship.con)]
    %url        [%link [. .]:url.con]~
    %code       [%inline-code expression.con]~
    %reference  ~['elided reference'] :: TODO fix?
  ==
::
++  parse
  |%
  ++  apex
    %+  knee  *(list inline:c)
    |.  ~+
    %-  plus
    ;~  pose
      (stag %bold (infix ;~(plug cab cab) apex))
      (stag %bold (infix ;~(plug tar tar) apex))
      (stag %code (infix ;~(plug tic tic tic) code))
      (stag %inline-code (infix tic code))
      (stag %italics (infix cab apex))
      (stag %italics (infix tar apex))
      str
      next
    ==
  ++  str   (tie (plus ;~(less cab tar tic next)))
  ++  code  (tie (star next))
  ++  tie
    |*  rul=rule
    (cook crip rul)
  ++  infix
    |*  [delim=rule inner=rule]
    |=  tub=nail
    =+  vex=(delim tub)
    ?~  q.vex
      (fail tub)
    =/  but=nail  tub
    =+  outer=(;~(sfix (plus ;~(less delim next)) delim) q.u.q.vex)
    ?~  q.outer
      (fail tub)
    =+  in=(inner [1 1] p.u.q.outer)
    ?~  q.in
      (fail tub)
    outer(p.u.q p.u.q.in)
  --
--

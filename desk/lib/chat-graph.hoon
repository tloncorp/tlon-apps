/-  c=chat, g=groups
/-  cite
/+  gra=graph-store
/+  pac=dm
|%
++  nert
  |_  [=flag:g =dude:gall]
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
      contents=story/(con contents.p)
  ==
++  con
  |=  cs=(list content:gra)
  ^-  story:c
  %+  roll  cs
  |=  [con=content:gra p=(list block:c) q=(list inline:c)]
  ^-  story:c
  ?-  -.con
    %text       [p (welp q (fall (rush text.con apex:parse) ~[text.con]))]
    %mention    [p (snoc q ship/ship.con)]
    %url        [p (snoc q [%link [. .]:url.con])] :: XX: maybe try pull images?
    %code       [p (snoc q [%inline-code expression.con])]
    %reference  :_(q (snoc p (ref reference.con)))
  ==
  ::
  ++  ref
    |=  ref=reference:gra
    ^-  block:c
    =;  =cite
      [%cite cite]
    ?-  -.ref
      %group  [%group group.ref]
      %app    [%desk [ship desk] path]:ref
      %graph  [%bait group.ref resource.uid.ref (idx-to-path index.uid.ref)]
    ==
  ++  idx-to-path  |=(=index:gra (turn index (cury scot %ud)))
    
  --
  ::
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

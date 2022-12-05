/-  c=chat, g=groups
/-  cite
/+  gra=graph-store
/+  pac=dm
|%
++  nert
  |_  =flag:g
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
    %reference  ~  :: shouldn't hit this
  ==
  ++  con
    |=  cs=(list content:gra)
    ^-  content:c
    =/  fer=(unit id:c)  (ref cs)
    ?~  fer  story/[~ (inline cs)]
    =/  wer=path  /msg/(scot %p p.u.fer)/(scot %ud q.u.fer)
    story/[(turn (cit cs) (lead %cite)) (inline cs)]
  ::
  ++  ref
    |=  cs=(list content:gra)
    ^-  (unit id:c)
    %+  roll  cs
    |=  [con=content:gra fer=(unit id:c)]
    ?+     -.con  fer
        %reference
      ?.  ?=(%graph -.reference.con)  fer
      =/  [res=resource:gra author=ship =index:gra]
      :*  resource.uid.reference.con
          entity.resource.uid.reference.con
          index.uid.reference.con
      ==
      ::  XX unsure about this bunt
      =-  `[author -]
      ?~(index *@da `@da`(head index))
    ==
  ::
  ++  cit
    |=  cs=(list content:gra)
    ^-  (list cite:cite)
    =;  refs
      %+  turn  refs
      |=  =reference:gra
      ?-    -.reference
          %graph
        =/  grp=resource:gra  group:reference
        =/  [res=resource:gra idx=index:gra]  uid:reference
        =/  =time  ?~(idx *time (head idx))
        =/  wer=path
          /msg/(scot %p entity.res)/(scot %ud time)
        ?.  =(grp flag)  [%bait grp flag wer]
        =/  =nest:g  [%chat res]
          [%chan nest wer]
        ::
          %group  *cite:cite :: XX TODO: shia lebouf says just do it
        ::
          %app  *cite:cite :: XX TODO: do it
      ==
    ::
    %+  roll  cs
    |=  [con=content:gra fer=(list reference:gra)]
    ?+     -.con  fer
        %reference
      (snoc fer reference.con)
    ==
    ::
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

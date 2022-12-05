/-  ha=hark
/-  c=chat, n=nark, g=groups
/-  cite
/-  g-one=group
/-  m-one=metadata-store
/-  meta
/+  gra=graph-store
/+  pac=dm
/+  of
|%
++  sect-for-flag
  |=  =flag:g
  `sect:g`(rap 3 'imports-' (scot %p p.flag) '/' q.flag ~)
::
++  graph-mark-to-agent
|=  =mark
^-  (unit term)
?+  mark  ~
  %graph-validator-chat     `%chat
  %graph-validator-link     `%heap
  %graph-validator-publish  `%diary
==

::
++  graph-meta-to-agent
  |=  =metadatum:m-one
  ^-  (unit dude:gall)
  ?.  ?=(%graph -.config.metadatum)
    ~
  ?+  module.config.metadatum  ~
    %chat  `%chat
    %link  `%heap
    %publish   `%diary
  ==
::
++  old-assoc-to-new-meta
 |=  =association:m-one
 (old-to-new-meta metadatum.association)
::
++  old-to-new-meta
  |=  =metadatum:m-one
  ^-  data:meta
  =,(metadatum [title description picture (scot %ux color)])
::
++  policy-to-cordon
  |=  =policy:g-one

  ^-  cordon:g
  ?-    -.policy
      %open
    [%open banned ban-ranks]:policy
  ::
      %invite
    [%shut pending.policy ~]
  ==
::
++  scrier
  |=  [=flag:g =bowl:gall]
  |^  scry
  ++  scry
  |=  [care=@tas =dude:gall =path]
  ^+  path
  :*  care
      (scot %p our.bowl)
      dude
      (scot %da now.bowl)
      path
  ==
  ::
  ++  old-flag-path
  `path`/ship/(scot %p p.flag)/[q.flag]
  ::
  ++  exists-path
  `path`/exists/(scot %p p.flag)/[q.flag]
  ::
  ++  scry-groups
    =-  .^(_| -)
    %:  scry  %gx  %groups
    `path`(snoc exists-path %noun)
    ==
  ::
  ++  scry-group
    =-  .^((unit group:g-one) -)
    %:  scry  %gx  %group-store
    `path`[%groups (snoc old-flag-path %noun)]
    ==
  ::
  ++  scry-meta
    =-  .^(associations:m-one -)
    %:  scry  %gx  %metadata-store
    `path`[%group (snoc old-flag-path %noun)]
    ==
  --
::
++  nert
  |=  [=flag:g group=flag:g]
  |^  convert
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
    ::
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
    contents=(con contents.p)
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
      =/  [old=resource:gra idx=index:gra]  
        uid:reference
      =/  wer=path
        /msg/(scot %p entity.old)/(scot %ud (head idx))
      ?.  =(grp group)  [%bait grp old wer]
      ::  TODO: old -> new channel
      =/  =nest:g  [%chat old]
      [%chan nest wer]
      ::
        %group  *cite:cite
      ::
        %app  *cite:cite
      ==
    ::
    %+  roll  cs
    |=  [con=content:gra fer=(list reference:gra)]
    ?+     -.con  fer
    %reference
    (snoc fer reference.con)
    ==
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
    `[author `@da`(head index)]
    ==
  ::
  ++  con
    |=  cs=(list content:gra)
    ^-  content:c
    =/  fer=(unit id:c)  (ref cs)
    ?~  fer  story/[~ (inline cs)]
    =/  wer=path  /msg/(scot %p p.u.fer)/(scot %ud q.u.fer)
    story/[(turn (cit cs) (lead %cite)) (inline cs)]
    ::
    ++  inline
    |=  cs=(list content:gra)
    ^-  (list inline:c)
    %+  turn  cs
    |=  con=content:gra
    ^-  inline:c
    ?-  -.con
    %text       text.con
    %mention    `@t`(scot %p ship.con)
    %url        [%link [. .]:url.con]
    %code       [%inline-code expression.con]
    %reference
    =;  bait  ''
    ::  =;  bait  (crip "{<bait>}")
    ?.  ?=(%graph -.reference.con)  %not-graph
    =/  [res=resource:gra author=ship =index:gra]
    :*  resource.uid.reference.con
    entity.resource.uid.reference.con
    index.uid.reference.con
    ==
    (bait:n [%grub [res author index]])
    ==
  --
--

/-  h=heap, g=groups, ha=hark, e=epic
/-  meta
/+  default-agent, verb, dbug
/+  cur=curios
/+  heap-json
/+  chat-migrate=chat-graph
/+  epos-lib=saga
^-  agent:gall
=>
  |%
  ++  okay  `epic:e`0
  +$  card  card:agent:gall
  +$  current-state
    $:  %0
        =stash:h
        voc=(map [flag:h time] (unit said:h))
        ::  true represents imported, false pending import
        imp=(map flag:h ?)
    ==
  ::
  --
=|  current-state
=*  state  -
=< 
  %+  verb  &
  %-  agent:dbug
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %|) bowl)
      cor   ~(. +> [bowl ~])
  ++  on-init  
    ^-  (quip card _this)
    =^  cards  state
      abet:init:cor
    [cards this]
  ::
  ++  on-save  !>([state okay])
  ++  on-load
    |=  =vase
    ^-  (quip card _this)
    =^  cards  state
      abet:(load:cor vase)
    [cards this]
  ::
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state
      abet:(poke:cor mark vase)
    [cards this]
  ++  on-watch
    |=  =path
    ^-  (quip card _this)
    =^  cards  state
      abet:(watch:cor path)
    [cards this]
  ::
  ++  on-peek   peek:cor
  ::
  ++  on-leave   on-leave:def
  ++  on-fail    on-fail:def
  ::
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    =^  cards  state
      abet:(agent:cor wire sign)
    [cards this]
  ++  on-arvo
    |=  [=wire sign=sign-arvo]
    ^-  (quip card _this)
    =^  cards  state
      abet:(arvo:cor wire sign)
    [cards this]
  --
|_  [=bowl:gall cards=(list card)]
+*  epos  ~(. epos-lib [bowl %heap-update okay])
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  init
  ^+  cor
  watch-groups
::
++  watch-groups
  ^+  cor
  (emit %pass /groups %agent [our.bowl %groups] %watch /groups)
::
++  mar
  |%
  ++  act  `mark`(rap 3 %heap-action '-' (scot %ud okay) ~)
  ++  upd  `mark`(rap 3 %heap-update '-' (scot %ud okay) ~)
  --
::
++  poke
  |=  [=mark =vase]
  |^  ^+  cor 
  ?+    mark  ~|(bad-poke/mark !!)
  ::
      %graph-imports  (import-graphs !<(imports:h vase))
      %import-flags
    =+  !<(flags=(set flag:h) vase)
    =.  imp  %-  ~(gas by *(map flag:h ?))
      ^-  (list [flag:h ?])
      %+  turn
        ~(tap in flags) 
      |=(=flag:h [flag |])
    cor
  ::
      ?(%flag %channel-join)
    =+  !<(=flag:h vase)
    ?<  =(our.bowl p.flag)
    (join flag)
  ::
      %heap-leave
    =+  !<(=leave:h vase)
    ?<  =(our.bowl p.leave)  :: cannot leave chat we host
    he-abet:he-leave:(he-abed:he-core leave)
  ::
      %heap-create
    =+  !<(req=create:h vase)
    (create req)
  ::
      ?(%heap-action-0 %heap-action)
    =+  !<(=action:h vase)
    =/  heap-core  (he-abed:he-core p.action)
    ?:  =(p.p.action our.bowl)
      he-abet:(he-update:heap-core q.action)
    he-abet:(he-proxy:heap-core q.action)
  ::
      %heap-remark-action
    =+  !<(act=remark-action:h vase)
    he-abet:(he-remark-diff:(he-abed:he-core p.act) q.act)
  ==
  ++  join
    |=  =flag:h
    ^+  cor
    =.  stash  (~(put by stash) flag *heap:h)
    he-abet:(he-join:he-core flag)
  ::
  ++  create
    |=  req=create:h
    |^  ^+  cor
      ~_  leaf+"Create failed: check group permissions"
      ?>  can-nest
      ?>  ((sane %tas) name.req)
      =/  =flag:h  [our.bowl name.req]
      =|  =heap:h
      =/  =perm:h  [writers.req group.req]
      =.  perm.heap  perm
      =.  net.heap  [%pub ~]
      =.  stash  (~(put by stash) flag heap)
      he-abet:(he-init:(he-abed:he-core flag) req)
    ++  can-nest
      ^-  ?
      =/  gop  (~(got by groups) group.req)
      %-  ~(any in bloc.gop)
      ~(has in sects:(~(got by fleet.gop) our.bowl))
    ::
    ++  groups
      .^  groups:g
        %gx
        /(scot %p our.bowl)/groups/(scot %da now.bowl)/groups/noun
      ==
    --
  --
++  load
  |=  =vase
  |^  ^+  cor
  =/  maybe-old=(each [p=versioned-state q=epic:e] tang)
    (mule |.(!<([versioned-state epic:e] vase)))
  =/  [old=versioned-state cool=epic:e bad=?]
    ::  XX only save when epic changes
    ?.  ?=(%| -.maybe-old)  [p q &]:p.maybe-old
    =;  [sta=versioned-state ba=?]  [sta okay ba]
    =-  %+  fall  -  ~&  >  %bad-load  [state &]
    (mole |.([!<(versioned-state vase) |]))
  =.  state  old
  ?:  =(okay cool)  cor
  ::  speak the good news
  =.  cor  (emil (drop load:epos))
  =/  heaps  ~(tap in ~(key by stash))
  |-
  ?~  heaps
    cor
  =.  cor
    he-abet:he-upgrade:(he-abed:he-core i.heaps)
  $(heaps t.heaps)
  ::
  +$  versioned-state  $%(current-state)
  --
::
++  watch
  |=  =(pole knot)
  ^+  cor
  ?+    pole  ~|(bad-watch-path/pole !!)
      [%briefs ~]  ?>(from-self cor)
      [%ui ~]      ?>(from-self cor)
      [%imp ~]     ?>(from-self cor)
    ::
      [%epic ~]    (give %fact ~ epic+!>(okay))
    ::
      [%heap ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    he-abet:(he-watch:(he-abed:he-core ship name.pole) rest.pole)
    ::
      [%said host=@ name=@ %curio time=@ ~]
    =/  host=ship   (slav %p host.pole)
    =/  =flag:h     [host name.pole]
    =/  =time       (slav %ud time.pole)
    (watch-said flag time)
  ==
::
++  watch-said
  |=  [=flag:h =time]
  ?.  (~(has by stash) flag)
    (proxy-said flag time)
  he-abet:(he-said:(he-abed:he-core flag) time)
++  said-wire
  |=  [=flag:h =time]
  ^-  wire
  /said/(scot %p p.flag)/[q.flag]/curio/(scot %ud time)
::
++  take-said
  |=  [=flag:h =time =sign:agent:gall]
  =/  =wire  (said-wire flag time)
  ^+  cor
  ?+    -.sign  !!
      %watch-ack
    %.  cor
    ?~  p.sign  same
    (slog leaf/"Preview failed" u.p.sign)
  ::
      %kick
    ?:  (~(has by voc) [flag time])
      cor  :: subscription ended politely
    ::  XX: only versioned subscriptions should rewatch on kick
    (give %kick ~[wire] ~)
    ::  (proxy-said flag time)
  ::
      %fact
    =.  cor  (give %fact ~[wire] cage.sign)
    =.  cor  (give %kick ~[wire] ~)
    ?+    p.cage.sign  ~|(funny-mark/p.cage.sign !!)
        %heap-said
      =+  !<(=said:h q.cage.sign)
      =.  voc  (~(put by voc) [flag time] `said)
      cor
    ::
        %heap-denied
      =.  voc  (~(put by voc) [flag time] ~)
      cor
    ==
  ==
::
++  proxy-said
  |=  [=flag:h =time]
  =/  =dock  [p.flag dap.bowl]
  =/  wire  (said-wire flag time)
  ?:  (~(has by wex.bowl) wire dock)
    cor
  (emit %pass wire %agent dock %watch wire)
::
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+    pole  ~|(bad-agent-wire/pole !!)
      ~  cor
      [%epic ~]  (take-epic sign)
      [%hark ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  cor
    %-  (slog leaf/"Failed to hark" u.p.sign)
    cor
  ::
      [%heap ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    he-abet:(he-agent:(he-abed:he-core ship name.pole) rest.pole sign)
  ::
      [%said host=@ name=@ %curio time=@ ~]
    =/  host=ship   (slav %p host.pole)
    =/  =flag:h     [host name.pole]
    =/  id=time     (slav %ud time.pole)
    (take-said flag id sign)
  ::
      [%groups ~]
    ?+    -.sign  !!
      %kick  watch-groups
    ::
        %watch-ack
      %.  cor
      ?~  p.sign  same
      =/  =tank
        leaf/"Failed groups subscription in {<dap.bowl>}, unexpected"
      (slog tank u.p.sign)
    ::
        %fact
      ?.  =(%group-action-0 p.cage.sign)  cor
      (take-groups !<(=action:g q.cage.sign))
    ==
  ==
++  watch-epic
  |=  her=ship
  ^+  cor
  =/  =wire  /epic
  =/  =dock  [her dap.bowl]
  ?:  (~(has by wex.bowl) [wire dock])
    cor
  (emit %pass wire %agent [her dap.bowl] %watch /epic)
::
++  take-epic
  |=  =sign:agent:gall
  ^+  cor
  ?+    -.sign  cor
      %kick
    (watch-epic src.bowl)
  ::
      %fact
    ?.  =(%epic p.cage.sign)
      ~&  '!!! weird fact on /epic'
      cor
    =+  !<(=epic:e q.cage.sign)
    ?.  =(epic okay)
      cor
    ~&  >>  "good news everyone!"
    %+  roll  ~(tap by stash)
    |=  [[=flag:g =heap:h] out=_cor]
    ?>  =(src.bowl p.flag)
    he-abet:(he-take-epic:(he-abed:he-core:out flag) epic)
      %watch-ack
    %.  cor
    ?~  p.sign  same
    (slog leaf/"weird watch nack" u.p.sign)
  ==
::
++  take-groups
  |=  =action:g
  =/  affected=(list flag:h)
    %+  murn  ~(tap by stash)
    |=  [=flag:h =heap:h]
    ?.  =(p.action group.perm.heap)  ~
    `flag
  ?+    q.q.action  cor
      [%fleet * %del ~]
    ~&  'revoke perms for'
    %+  roll  affected
    |=  [=flag:h co=_cor]
    ^+  cor
    %+  roll  ~(tap in p.q.q.action)
    |=  [=ship ci=_cor]
    ^+  cor
    =/  he  (he-abed:he-core:ci flag)
    he-abet:(he-revoke:he ship)
  ::
      [%fleet * %del-sects *]
    ~&  'recheck permissions'
    %+  roll  affected
    |=  [=flag:h co=_cor]
    =/  he  (he-abed:he-core:co flag)
    he-abet:he-recheck:he
  ::
      [%channel * %del-sects *]
    ~&  'recheck permissions'
    %+  roll  affected
    |=  [=flag:h co=_cor]
    =/  he  (he-abed:he-core:co flag)
    he-abet:he-recheck:he
  ==
::
++  arvo
  |=  [=wire sign=sign-arvo]
  ^+  cor
  ~&  arvo/wire
  cor
++  peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
  ::
    [%x %stash ~]  ``stash+!>(stash)
    [%x %imp ~]    ``migrate-map+!>(imp)
  ::
      [%x %heap @ @ *]
    =/  =ship  (slav %p i.t.t.path)
    =*  name   i.t.t.t.path
    (he-peek:(he-abed:he-core ship name) t.t.t.t.path)
    ::
      [%x %briefs ~]
    =-  ``heap-briefs+!>(-)
    ^-  briefs:h
    %-  ~(gas by *briefs:h)
    %+  turn  ~(tap in ~(key by stash))
    |=  =flag:h
    :-  flag
    he-brief:(he-abed:he-core flag)
  ==
::
++  import-graphs
  |=  =imports:h
  ^+  cor
  =/  imports  ~(tap by imports)
  |-  =*  loop  $
  ?~  imports  cor
  =/  [=flag:h writers=(set ship) =association:met:h =update-log:gra:h =graph:gra:h]
    i.imports
  |^
  =/  =perm:h
    :_  group.association
    ?:(=(~ writers) ~ (silt (rap 3 'import/' (scot %p p.flag) '/' q.flag ~) ~))
  =/  =curios:h  graph-to-curios
  =.  stash
    %+  ~(put by stash)  flag
    :*  net=?:(=(our.bowl p.flag) pub/~ sub/[p.flag | chi/~])
      log=(import-log perm curios)
      perm
      %grid :: XX: check defaults with design
      curios
      [now.bowl | ~]
    ==
  =.  imp    (~(put by imp) flag &)
  =.  cor
    (give %fact ~[/imp] migrate-map+!>(imp))
  =.  cor
    he-abet:(he-import:(he-abed:he-core flag) writers association)
  loop(imports t.imports)
  ::
  ++  import-log
    |=  [=perm:h =curios:h]
    ^-  log:h
    =/  =time  (fall (bind (ram:orm-log-gra:h update-log) head) *time)
    %+  gas:log-on:h  *log:h
    :~  [time %create perm curios]
    ==
  ::
  ++  orm  orm-gra:h
  ::
  ++  graph-to-curios
    %+  roll  (tap:orm graph)
    |=  [[=time =node:gra:h] out=curios:h]
    ^+  out
    =/  curs  (node-to-curio time node)
    (uni:on:curios:h out curs)
  ::
  ++  node-to-curio
    |=  [=time =node:gra:h]
    ^-  curios:h
    =/  =curios:h  (node-to-quips time node)
    =/  replies   ~(key by curios)
    =/  =seal:h  [time ~ replies]
    ?~  pos=(node-to-post node)
     :: discard comments on deleted 
     :: XX: review
      *curios:h 
    =*  con  contents.u.pos
    ?.  ?=([[%text @] $%([%url @] [%reference *]) ~] con)
      :: invariant
      *curios:h
    =;  =content:h
      %^  put:on:curios:h  curios  time
      [seal `text.i.con content author.u.pos time-sent.u.pos ~]
    ?-  -.i.t.con
      %reference  :_(~ (ref:nert:chat-migrate reference.i.t.con)^~)
      %url        [~ [%link url.i.t.con '']~]
    ==
  ::
  ++  node-to-quips
    |=  [id=time =node:gra:h]
    ^-  curios:h
    =/  coms=(unit graph:gra:h)
      ;<  =graph:gra:h      _biff  (node-to-children node)
      ;<  coms=node:gra:h   _biff  (get:orm graph 2)
      (node-to-children coms)
    %+  gas:on:curios:h  *curios:h
    %+  murn  ?~(coms ~ (tap:orm u.coms))
    |=  [=time =node:gra:h]
    ?~  qup=(node-to-quip id time node)
      ~
    `[time u.qup]
  ::
  ++  node-to-quip
    |=  [reply=time =time =node:gra:h]
    ^-  (unit curio:h)
    ;<  =graph:gra:h           _biff  (node-to-children node)
    ;<  [@ latest=node:gra:h]  _biff  (pry:orm graph)
    ;<  =post:gra:h            _biff  (node-to-post latest)
    =/  =seal:h  [time ~ ~]
    =/  =content:h  (con:nert:chat-migrate contents.post)
    =/  =heart:h  
      =,(post [~ content author time-sent `reply])
    `[seal heart]
  ::
  ++  node-to-children
    |=  =node:gra:h
    ^-  (unit graph:gra:h)
    ?.  ?=(%graph -.children.node)
      ~
    `p.children.node
  ::
  ++  node-to-post
    |=  =node:gra:h
    ^-  (unit post:gra:h)
    ?.  ?=(%& -.post.node)
      ~
    `p.post.node
  --
      

::
++  give-brief
  |=  [=flag:h =brief:briefs:h]
  (give %fact ~[/briefs] heap-brief-update+!>([flag brief]))
::
++  pass-hark
  |=  [all=? desk=? =yarn:ha]
  ^-  card
  =/  =wire  /hark
  =/  =dock  [our.bowl %hark]
  =/  =cage  hark-action+!>([%add-yarn all desk yarn])
  [%pass wire %agent dock %poke cage]
++  spin
  |=  [=rope:ha con=(list content:ha) wer=path but=(unit button:ha)]
  ^-  yarn:ha
  =/  id  (end [7 1] (shax eny.bowl))
  [id rope now.bowl con wer but]
++  flatten
  |=  content=(list inline:h)
  ^-  cord
  %-  crip
  %-  zing
  %+  turn
    content
  |=  c=inline:h
  ^-  tape
  ?@  c  (trip c)
  ?-  -.c
      ?(%break %block)  ""
      %tag    (trip p.c)
      %link   (trip q.c)
      ?(%code %inline-code)  ""
      %ship                  (scow %p p.c)
      ?(%italics %bold %strike %blockquote)  (trip (flatten p.c))
  ==
++  from-self  =(our src):bowl
++  he-core
  |_  [=flag:h =heap:h gone=_|]
  +*  he-curios  ~(. cur curios.heap)
  ++  he-core  .
  ::  TODO: archive??
  ++  he-abet  
    %_  cor
        stash  
      ?:(gone (~(del by stash) flag) (~(put by stash) flag heap))
    ==
  ++  he-abed
    |=  f=flag:h
    he-core(flag f, heap (~(got by stash) f))
  ++  he-area  `path`/heap/(scot %p p.flag)/[q.flag]
  ++  he-spin
    |=  [rest=path con=(list content:ha) but=(unit button:ha)]
    =*  group  group.perm.heap
    =/  =nest:g  [dap.bowl flag]
    =/  rope  [`group `nest q.byk.bowl (welp /(scot %p p.flag)/[q.flag] rest)]
    =/  link  
      (welp /groups/(scot %p p.group)/[q.group]/channels/heap/(scot %p p.flag)/[q.flag] rest)
    (spin rope con link but)
  ::
  ++  he-said
    |=  =time
    |^  ^+  he-core
    ?.  (he-can-read src.bowl)
      (give-kick heap-denied+!>(~))
    =/  [* =curio:h]  (got:he-curios time)
    %+  give-kick  %heap-said
    !>  ^-  said:h
    [flag curio]
    ++  give-kick
      |=  =cage
      =.  cor  (give %fact ~ cage)
      =.  cor  (give %kick ~ ~)
      he-core
    --
  ::
  ++  he-upgrade
    ^+  he-core
    ?.  ?=(%sub -.net.heap)  he-core
    ?.  ?=(%dex -.saga.net.heap)  he-core
    ?.  =(okay ver.saga.net.heap)
      ~&  future-shock/[ver.saga.net.heap flag]
      he-core
    he-make-chi
  ::
  ++  he-watch
    |=  =path
    ^+  he-core
    ?+    path  !!
      [%updates *]    (he-pub t.path)
      [%ui ~]         ?>(from-self he-core)
      [%ui %curios ~]  ?>(from-self he-core)
    ::
    ==
  ++  he-pass
    |%
    ++  writer-sect
      |=  [ships=(set ship) =association:met:h]
      =/  =sect:g
        (rap 3 %heap '-' (scot %p p.flag) '-' q.flag ~)
      =/  title=@t
        (rap 3 'Writers: ' title.metadatum.association ~)
      =/  desc=@t
        (rap 3 'The writers role for the ' title.metadatum.association ' chat' ~)
      %+  poke-group  %import-writers
      :+  group.association   now.bowl
      [%cabal sect %add title desc '' '']
    ::
    ++  poke-group
      |=  [=term =action:g]
      ^+  he-core
      =/  =dock      [our.bowl %groups] :: XX which ship
      =/  =wire      (snoc he-area term)
      =.  cor
        (emit %pass wire %agent dock %poke group-action-0+!>(action))
      he-core
    ::
    ++  create-channel
      |=  [=term group=flag:g =channel:g]
      ^+  he-core
      =/  =nest:g  [dap.bowl flag]
      (poke-group term group now.bowl %channel nest %add channel)
    ::
    ++  import-channel
      |=  =association:met:h
      =/  meta=data:meta:g
        [title description '' '']:metadatum.association
      (create-channel %import group.association meta now.bowl zone=%default %| ~)
    ::
    ++  add-channel
      |=  req=create:h
      %+  create-channel  %create
      [group.req =,(req [[title description '' ''] now.bowl %default | readers])]
    --
  ::
  ++  he-import
    |=  [writers=(set ship) =association:met:h]
    ^+  he-core
    =?  he-core  ?=(%sub -.net.heap)
      he-sub
    he-core
  ::
  ++  he-init
    |=  req=create:h
    =/  =perm:h  [writers.req group.req]
    =.  cor
      (give-brief flag he-brief)
    =.  he-core  (he-update now.bowl %create perm curios.heap)
    (add-channel:he-pass req)
  ::
  ++  he-agent
    |=  [=wire =sign:agent:gall]
    ^+  he-core
    ?+  wire  !!
        ~  :: noop wire, should only send pokes
      he-core
    ::
        [%import ~]
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign
        he-core
      %-  (slog u.p.sign)
      ::  =.  cor  (emit %pass /pyre %pyre leaf/"Failed group import" u.p.sign)
      he-core
    ::
        [%updates ~]
      (he-take-update sign)
    ::
        [%create ~]
      ?>  ?=(%poke-ack -.sign)
      %.  he-core  :: TODO rollback creation if poke fails?
      ?~  p.sign  same
      (slog leaf/"poke failed" u.p.sign)
    ==
  ::
  ++  he-brief  (brief:he-curios our.bowl last-read.remark.heap)
  ::
  ++  he-peek
    |=  =(pole knot)
    ^-  (unit (unit cage))
    ?+  pole  [~ ~]
      [%curios rest=*]  (peek:he-curios rest.pole)
      [%perm ~]        ``heap-perm+!>(perm.heap)
    ==
  ::
  ++  he-revoke
    |=  her=ship
    %+  roll  ~(tap in he-subscriptions)
    |=  [[=ship =path] he=_he-core]
    ?.  =(ship her)  he
    he(cor (emit %give %kick ~[path] `ship))
  ::
  ++  he-recheck
    %+  roll  ~(tap in he-subscriptions)
    |=  [[=ship =path] he=_he-core]
    ?:  (he-can-read:he ship)  he
    he(cor (emit %give %kick ~[path] `ship))
  ::
  ++  he-take-epic
    |=  her=epic:e
    ^+  he-core
    ?>  ?=(%sub -.net.heap)
    ?:  =(her okay)
      he-make-chi
    ?:  (gth her okay)
      =.  saga.net.heap  dex+her
      he-core
    he-make-lev
  ::
  ++  he-make-lev
    ?.  ?=(%sub -.net.heap)
      he-core
    ~&  make-lev/flag
    =.  saga.net.heap  lev+~
    =.  cor  (watch-epic p.flag)
    he-core
  ::
  ++  he-make-chi
    ?.  ?=(%sub -.net.heap)
      he-core
    ~&  make-chi/flag
    =.  saga.net.heap  chi+~
    he-safe-sub
  ::
  ++  he-take-update
    |=  =sign:agent:gall
    ^+  he-core
    ?+    -.sign  he-core
        %kick
      ?>  ?=(%sub -.net.heap)
      ?:  =(%chi -.saga.net.heap)  he-sub
      he-core
    ::
        %watch-ack
      =.  net.heap  [%sub src.bowl & [%chi ~]]
      ?~  p.sign  he-core
      %-  (slog leaf/"Failed subscription" u.p.sign)
      ::  =.  gone  &
      he-core
    ::
        %fact
      =*  cage  cage.sign 
      ?+  p.cage  (he-odd-update p.cage)
        %epic                             (he-take-epic !<(epic:e q.cage))
        ?(%heap-logs-0 %heap-logs)      (he-apply-logs !<(log:h q.cage))
        ?(%heap-update-0 %heap-update)  (he-update !<(update:h q.cage))
      ==
    ==
  ::
  ++  he-odd-update
    |=  =mark
    ?.  (is-old:epos mark)
      he-core
    ?.  ?=(%sub -.net.heap)
      he-core
    he-make-lev
  ::
  ++  he-proxy
    |=  =update:h
    ^+  he-core
    ?>  he-can-write
    =/  =dock  [p.flag dap.bowl]
    =/  =cage  [act:mar !>([flag update])]
    =.  cor
      (emit %pass he-area %agent dock %poke cage)
    he-core
  ::
  ++  he-groups-scry
    =*  group  group.perm.heap
    /(scot %p our.bowl)/groups/(scot %da now.bowl)/groups/(scot %p p.group)/[q.group]
  ::
  ++  he-can-write
    ?:  =(p.flag src.bowl)  &
    =/  =path
      %+  welp  he-groups-scry
      /fleet/(scot %p src.bowl)/vessel/noun
    =+  .^(=vessel:fleet:g %gx path)
    ?:  =(~ writers.perm.heap)  &
    !=(~ (~(int in writers.perm.heap) sects.vessel))
  ::
  ++  he-can-read
    |=  her=ship
    =/  =path
      %+  welp  he-groups-scry
      /channel/[dap.bowl]/(scot %p p.flag)/[q.flag]/can-read/(scot %p her)/loob
    .^(? %gx path)
  ::
  ++  he-pub
    |=  =path
    ^+  he-core
    ?>  (he-can-read src.bowl)
    =/  =log:h
      ?~  path  log.heap
      =/  =time  (slav %da i.path)
      (lot:log-on:h log.heap `time ~)
    =/  =cage  heap-logs+!>(log)
    =.  cor  (give %fact ~ cage)
    he-core
  ::
  ++  he-safe-sub
    ^+  he-core
    ?:  (~(has by wex.bowl) [(snoc he-area %updates) p.flag dap.bowl])
      he-core
    he-sub
  ::
  ++  he-sub
    ^+  he-core
    =/  tim=(unit time)
      (bind (ram:log-on:h log.heap) head)
    =/  base=wire  (snoc he-area %updates)
    =/  =path 
      %+  weld  base
      ?~  tim  ~
      /(scot %da u.tim)
    =/  =card
      [%pass base %agent [p.flag dap.bowl] %watch path]
    =.  cor  (emit card)
    he-core
  ++  he-join
    |=  f=flag:h
    ^+  he-core
    =.  stash  (~(put by stash) f *heap:h)
    =.  he-core  (he-abed f)
    =.  cor  (give-brief flag he-brief)
    he-sub
  ::
  ++  he-leave
    =/  =dock  [p.flag dap.bowl]
    =/  =wire  (snoc he-area %updates)
    =.  cor  (emit %pass wire %agent dock %leave ~)
    =.  cor  (emit %give %fact ~[/briefs] heap-leave+!>(flag))
    =.  gone  &
    he-core
  ::
  ++  he-apply-logs
    |=  =log:h
    ^+  he-core
    =/  updates=(list update:h)
      (tap:log-on:h log)
    %+  roll  updates
    |=  [=update:h he=_he-core]
    (he-update:he update)
  ::
  ++  he-subscriptions
    %+  roll  ~(val by sup.bowl)
    |=  [[=ship =path] out=(set [ship path])]
    ?.  =((scag 4 path) (snoc he-area %updates))
      out
    (~(put in out) [ship path])
  ::
  ++  he-give-updates
    |=  [=time d=diff:h]
    ^+  he-core
    =/  paths=(set path)
      %-  ~(gas in *(set path))
      (turn ~(tap in he-subscriptions) tail)
    =.  paths  (~(put in paths) (snoc he-area %ui))
    =/  cag=cage  [upd:mar !>([time d])]
    =.  cor
      (give %fact ~(tap in paths) cag)
    =.  cor  (give %fact ~[/ui] act:mar !>([flag [time d]]))
    he-core
  ::
  ++  he-remark-diff
    |=  diff=remark-diff:h
    ^+  he-core
    =.  cor
      (give %fact ~[(snoc he-area %ui)] heap-remark-action+!>([flag diff]))
    =.  remark.heap
      ?-  -.diff
        %watch    remark.heap(watching &)
        %unwatch  remark.heap(watching |)
        %read-at  !!
      ::
          %read
      =/  [=time =curio:h]  (need (ram:on:curios:h curios.heap))
      remark.heap(last-read `@da`(add time 1))  ::  greater than last
      ==
    =.  cor
      (give-brief flag he-brief)
    he-core
  ::
  ++  he-update
    |=  [=time d=diff:h]
    ^+  he-core
    ?>  he-can-write
    :: we use now on the host to enforce host ordering
    =?  time  =(p.flag our.bowl)
      now.bowl
    =.  log.heap
      (put:log-on:h log.heap time d)
    =.  he-core
      (he-give-updates time d)
    ?-    -.d
        %curios
      =.  curios.heap  (reduce:he-curios time p.d)
      =.  cor  (give-brief flag he-brief)
      ?-  -.q.p.d
          ?(%edit %del %add-feel %del-feel)  he-core
          %add
        =/  =heart:h  p.q.p.d
        ?~  replying.heart  he-core
        =/  op  (~(get cur curios.heap) u.replying.heart)
        ?~  op  he-core
        =/  curio  curio.u.op
        =/  in-replies
            %+  lien
              ~(tap in replied.curio)
            |=  =^time
            =/  curio  (~(get cur curios.heap) time)
            ?~  curio  %.n
            =(author.curio.u.curio our.bowl)
        ?:  |(=(author.heart our.bowl) !in-replies)  he-core
        =/  content  (trip (flatten q.content.curio))
        =/  title
          ?:  !=(title.heart ~)  (need title.heart)
          ?:  (lte (lent content) 80)  (crip content)
          (crip (weld (swag [0 77] content) "..."))
        =/  yarn
          %^  he-spin
            /curio/(rsh 4 (scot %ui u.replying.heart))
            :~  [%ship author.heart]
                ' commented on '
                [%emph title]
                ': '
                [%ship author.heart]
                ': '
                (flatten q.content.heart)
            ==
          ~  
        =.  cor  (emit (pass-hark & & yarn))
        he-core
      ==
    ::
        %add-sects
      =*  p  perm.heap
      =.  writers.p  (~(uni in writers.p) p.d)
      he-core
    ::
        %del-sects
      =*  p  perm.heap
      =.  writers.p  (~(dif in writers.p) p.d)
      he-core
    ::
        %create
      =:  perm.heap  p.d
          curios.heap  q.d
        ==
      he-core
    ::
        %view
      =.  view.heap  p.d
      he-core
    ==
  --
--

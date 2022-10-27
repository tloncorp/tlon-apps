/-  h=heap, g=groups, ha=hark
/-  meta
/+  default-agent, verb, dbug
/+  cur=curios
/+  heap-json
/+  chat-migrate=chat-graph
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  state-0
    $:  %0
        =stash:h
    ==
  --
=|  state-0
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
  ++  on-save  !>(state)
  ++  on-load
    |=  =vase
    ^-  (quip card _this)
    =/  old=(unit state-0)
      (mole |.(!<(state-0 vase)))  
    ?^  old  `this(state u.old)
    ~&  >>>  "Incompatible load, nuking"
    =^  cards  this  on-init
    :_  this
    =-  (welp - cards)
    %+  turn  ~(tap in ~(key by wex.bowl))
    |=  [=wire =ship =term] 
    ^-  card
    [%pass wire %agent [ship term] %leave ~]
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
++  poke
  |=  [=mark =vase]
  |^  ^+  cor 
  ?+    mark  ~|(bad-poke/mark !!)
  ::
      %graph-imports  (import-graphs !<(imports:h vase))
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
    =.  p.q.action  now.bowl
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
    ^+  cor
    =/  =flag:h  [our.bowl name.req]
    =|  =heap:h
    =/  =perm:h  [writers.req group.req]
    =.  perm.heap  perm
    =.  net.heap  [%pub ~]
    =.  stash  (~(put by stash) flag heap)
    he-abet:(he-init:(he-abed:he-core flag) req)
  --
++  watch
  |=  =path
  ^+  cor
  ?+    path  ~|(bad-watch-path/path !!)
      [%briefs ~]  ?>(from-self cor)
      [%ui ~]      ?>(from-self cor)
    ::
      [%heap @ @ *]
    =/  =ship  (slav %p i.t.path)
    =*  name   i.t.t.path
    he-abet:(he-watch:(he-abed:he-core ship name) t.t.t.path)
  ==
::
++  agent
  |=  [=wire =sign:agent:gall]
  ^+  cor
  ?+    wire  ~|(bad-agent-wire/wire !!)
  ::
      [%hark ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  cor
    %-  (slog leaf/"Failed to hark" u.p.sign)
    cor
  ::
      [%heap @ @ *]
    =/  =ship  (slav %p i.t.wire)
    =*  name   i.t.t.wire
    he-abet:(he-agent:(he-abed:he-core ship name) t.t.t.wire sign)
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
      ?.  =(%group-action p.cage.sign)  cor
      (take-groups !<(=action:g q.cage.sign))
    ==
  ==
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
    ?:(=(~ writers) ~ (silt (rap 3 %heap '-' (scot %p p.flag) '-' q.flag ~) ~))
  =.  stash
    %+  ~(put by stash)  flag
    :*  net=?:(=(our.bowl p.flag) pub/~ sub/p.flag)
      log=(import-log update-log)
      perm
      %grid :: XX: check defaults with design
      graph-to-curios
      *remark:h
    ==
  =.  cor
    he-abet:(he-import:(he-abed:he-core flag) writers association)
  loop(imports t.imports)
  ::
  ++  import-log
    |=  =update-log:gra:h
    ^-  log:h
    *log:h
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
    =-  (put:on:curios:h curios time [seal `text.i.con - author.u.pos time-sent.u.pos ~])
    ?-  -.i.t.con
      %reference  ~
      %url        [%link url.i.t.con '']~
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
    =/  con=(list inline:h)  (inline:chat-migrate contents.post)
    =/  =heart:h  
      =,(post [~ con author time-sent `reply])
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
        (emit %pass wire %agent dock %poke group-action+!>(action))
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
    =.  he-core
      (import-channel:he-pass association)
    =?  he-core  &(?=(%pub -.net.heap) !=(writers ~))
      (writer-sect:he-pass writers association)
    he-core
  ::
  ++  he-init
    |=  req=create:h
    =/  =perm:h  [writers.req group.req]
    =.  cor
      (give-brief flag he-brief)
    =.  he-core  (he-update now.bowl %create perm)
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
      =.  cor  (emit %pass /pyre %pyre leaf/"Failed group import" u.p.sign)
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
  ++  he-take-update
    |=  =sign:agent:gall
    ^+  he-core
    ?+    -.sign  he-core
      %kick  he-sub
    ::
        %watch-ack
      =.  net.heap  [%sub src.bowl]
      ?~  p.sign  he-core
      %-  (slog leaf/"Failed subscription" u.p.sign)
      ::  =.  gone  &
      he-core
    ::
        %fact
      =*  cage  cage.sign 
      ?+  p.cage  he-core
        ?(%heap-logs-0 %heap-logs)      (he-apply-logs !<(log:h q.cage))
        ?(%heap-update-0 %heap-update)  (he-update !<(update:h q.cage))
      ==
    ==
  ++  he-proxy
    |=  =update:h
    ^+  he-core
    ?>  he-can-write
    =/  =dock  [p.flag dap.bowl]
    =/  =cage  heap-action+!>([flag update])
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
    =/  cag=cage  heap-update+!>([time d])
    =.  cor
      (give %fact ~(tap in paths) cag)
    =.  cor  (give %fact ~[/ui] heap-action+!>([flag [time d]]))
    =?  cor  ?=(%curios -.d)
      =/  =cage  curios-diff+!>(p.d)
      (give %fact ~[(welp he-area /ui/curios)] cage)
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
          %read   remark.heap(last-read now.bowl)
      ==
    =.  cor
      (give-brief flag he-brief)
    he-core
  ::
  ++  he-update
    |=  [=time d=diff:h]
    ?>  he-can-write
    ^+  he-core
    =.  log.heap
      (put:log-on:h log.heap time d)
    =.  he-core
      (he-give-updates time d)
    ?-    -.d
        %curios
      =.  curios.heap  (reduce:he-curios time p.d)
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
        =/  content  (trip (flatten content.curio))
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
                (flatten content.heart)
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
      =.  perm.heap  p.d
      he-core
    ::
        %view
      =.  view.heap  p.d
      he-core
    ==
  --
--

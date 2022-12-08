/-  d=diary, g=groups, ha=hark
/-  meta
/-  e=epic
/+  default-agent, verb, dbug
/+  not=notes
/+  qup=quips
/+  diary-json
/+  migrate=diary-graph
/+  chat-migrate=chat-graph
/+  epos-lib=saga
^-  agent:gall
=>
  |%
  ++  okay  `epic:e`0
  +$  card  card:agent:gall
  +$  current-state
    $:  %0
        =shelf:d
        voc=(map [flag:d plan:d] (unit said:d))
        ::  true represents imported, false pending import
        imp=(map flag:d ?)
    ==
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
+*  epos  ~(. epos-lib [bowl %diary-update okay])
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  init
  ^+  cor
  watch-groups
++  mar
  |%
  ++  act  `mark`(rap 3 %diary-action '-' (scot %ud okay) ~)
  ++  upd  `mark`(rap 3 %diary-update '-' (scot %ud okay) ~)
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
  =.  cor
    (emil (drop load:epos))
  =/  diaries  ~(tap in ~(key by shelf))
  |-
  ?~  diaries
    cor
  =.  cor
    di-abet:di-upgrade:(di-abed:di-core i.diaries)
  $(diaries t.diaries)
  ::
  +$  versioned-state  $%(current-state)
  --
::
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
    %+  roll  ~(tap by shelf)
    |=  [[=flag:g =diary:d] out=_cor]
    ?.  =(src.bowl p.flag)
      out
    di-abet:(di-take-epic:(di-abed:di-core:out flag) epic)
  ::
      %watch-ack
    %.  cor
    ?~  p.sign  same
    (slog leaf/"weird watch nack" u.p.sign)
  ==
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
      %graph-imports  (import !<(imports:d vase))
      %import-flags
    =+  !<(flags=(set flag:d) vase)
    =.  imp  %-  ~(gas by *(map flag:d ?))
      ^-  (list [flag:d ?])
      %+  turn 
        ~(tap in flags) 
      |=(=flag:d [flag |])
    cor
  ::
      ?(%flag %channel-join)
    =+  !<(=flag:d vase)
    ?<  =(our.bowl p.flag)
    (join flag)
  ::
      %diary-leave
    =+  !<(=leave:d vase)
    ?<  =(our.bowl p.leave)  :: cannot leave chat we host
    di-abet:di-leave:(di-abed:di-core leave)
  ::
      %diary-create
    =+  !<(req=create:d vase)
    (create req)
  ::
      ?(%diary-action-0 %diary-action)
    =+  !<(=action:d vase)
    =/  diary-core  (di-abed:di-core p.action)
    ?:  =(p.p.action our.bowl)
      di-abet:(di-update:diary-core q.action)
    di-abet:(di-proxy:diary-core q.action)
  ::
      %diary-remark-action
    =+  !<(act=remark-action:d vase)
    di-abet:(di-remark-diff:(di-abed:di-core p.act) q.act)
  ==
  ++  join
    |=  =flag:d
    ^+  cor
    =.  shelf  (~(put by shelf) flag *diary:d)
    di-abet:(di-join:di-core flag)
  ::
  ++  create
    |=  req=create:d
    |^  ^+  cor
    ~_  leaf+"Create failed: check group permissions"
    ?>  can-nest
    ?>  ((sane %tas) name.req)
    =/  =flag:d  [our.bowl name.req]
    =|  =diary:d
    =/  =perm:d  [writers.req group.req]
    =.  perm.diary  perm
    =.  net.diary  [%pub ~]
    =.  shelf  (~(put by shelf) flag diary)
    di-abet:(di-init:(di-abed:di-core flag) req)
    ::  +can-nest: does group exist, are we allowed
    ::
    ++  can-nest
      ^-  ?
      =/  gop  (~(got by groups) group.req)
      %-  ~(any in bloc.gop)
      ~(has in sects:(~(got by fleet.gop) our.bowl))
    ::  +groups:
    ::
    ::  this has to be duplicated because
    ::  +di-groups-scry does not allow me
    ::  to properly adjust for a possible
    ::  group.
    ::
    ++  groups
      .^  groups:g
        %gx
        /(scot %p our.bowl)/groups/(scot %da now.bowl)/groups/noun
      ==
    --
  --
::
++  import
  |=  =imports:d
  ^+  cor
  =/  imports  ~(tap by imports)
  |-  =*  loop  $
  ?~  imports  cor
  =/  [=flag:d writers=(set ship) =association:met:d =update-log:gra:d =graph:gra:d]
    i.imports
  |^
  =/  =perm:d
    :_  group.association
    ?:(=(~ writers) ~ (silt (rap 3 'import/' (scot %p p.flag) '/' q.flag ~) ~))
  =/  =remark:d
    [now.bowl | ~]
  =/  =notes:d  graph-to-notes
  =/  =diary:d
    :*  net=?:(=(our.bowl p.flag) pub/~ sub/[p.flag | %chi ~])
        log=(import-log notes perm)
        perm
        %grid  :: TODO: check defaults with design
        %time
        notes
        remark
    ==
  =.  shelf  (~(put by shelf) flag diary)
  =.  imp    (~(put by imp) flag &)
  =.  cor
    (give %fact ~[/imp] migrate-map+!>(imp))
  =.  cor    di-abet:(di-import:(di-abed:di-core flag) writers association)
  loop(imports t.imports)
  ::
  ++  import-log  
    |=  [=notes:d =perm:d]
    ^-  log:d
    =/  =time  (fall (bind (ram:orm-log-gra:d update-log) head) *time)
    %+  gas:log-on:d  *log:d
    :~  [time %create perm notes]
    ==
  ::
  ++  graph-to-notes
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
    =/  =seal:d  [time (node-to-quips node) ~]
    ?.  ?=([[%text *] *] contents.u.pos)
      ~  :: XX: should be invariant, don't want to risk it
    =/  con=(list verse:d)  (migrate flag `@ud`time t.contents.u.pos)
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
    =/  =memo:d  =,(post [(con:nert:chat-migrate contents) author time-sent])
    `[cork memo]
  --
::
++  watch
  |=  =(pole knot)
  ^+  cor
  ?+    pole  ~|(bad-watch-path/pole !!)
      [%briefs ~]  ?>(from-self cor)
      [%ui ~]      ?>(from-self cor)
      [%imp ~]      ?>(from-self cor)
    ::
      [%epic ~]    (give %fact ~ epic+!>(okay))
    ::
      [%diary ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    di-abet:(di-watch:(di-abed:di-core ship name.pole) rest.pole)
    ::
      [%said host=@ name=@ %note time=@ quip=?(~ [@ ~])]
    =/  host=ship   (slav %p host.pole)
    =/  =flag:d     [host name.pole]
    =/  =plan:d     =,(pole [(slav %ud time) ?~(quip ~ `(slav %ud -.quip))])
    (watch-said flag plan)
  ==
::
++  watch-said
  |=  [=flag:d =plan:d]
  ?.  (~(has by shelf) flag)
    (proxy-said flag plan)
  di-abet:(di-said:(di-abed:di-core flag) plan)
++  said-wire
  |=  [=flag:d =plan:d]
  ^-  wire
  %+  welp
    /said/(scot %p p.flag)/[q.flag]/note/(scot %ud p.plan)
  ?~(q.plan / /(scot %ud u.q.plan))
::
++  take-said
  |=  [=flag:d =plan:d =sign:agent:gall]
  =/  =wire  (said-wire flag plan)
  ^+  cor
  ?+    -.sign  !!
      %watch-ack
    %.  cor
    ?~  p.sign  same
    (slog leaf/"Preview failed" u.p.sign)
  ::
      %kick
    ?:  (~(has by voc) [flag plan])
      cor  :: subscription ended politely
    ::  XX: only versioned subscriptions should rewatch on kick
    (give %kick ~[wire] ~)
    :: (proxy-said flag time)  
  ::
      %fact
    =.  cor  (give %fact ~[wire] cage.sign)
    =.  cor  (give %kick ~[wire] ~)
    ?+    p.cage.sign  ~|(funny-mark/p.cage.sign !!)
        %diary-said
      =+  !<(=said:d q.cage.sign)
      =.  voc  (~(put by voc) [flag plan] `said)
      cor
    ::
        %diary-denied
      =.  voc  (~(put by voc) [flag plan] ~)
      cor
    ==
  ==
::
++  proxy-said
  |=  [=flag:d =plan:d]
  =/  =dock  [p.flag dap.bowl]
  =/  wire  (said-wire flag plan)
  ?:  (~(has by wex.bowl) wire dock)
    cor
  (emit %pass wire %agent dock %watch wire)
::
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+    pole  ~|(bad-agent-wire/pole !!)
      ~  cor
  ::
      [%epic ~]  (take-epic sign)
  ::
      [%hark ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  cor
    %-  (slog leaf/"Failed to hark" u.p.sign)
    cor
  ::
      [%diary ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    di-abet:(di-agent:(di-abed:di-core ship name.pole) rest.pole sign)
  ::
      [%said host=@ name=@ %note time=@ quip=?(~ [@ ~])]
    =/  host=ship   (slav %p host.pole)
    =/  =flag:d     [host name.pole]
    =/  =plan:d     =,(pole [(slav %ud time) ?~(quip ~ `(slav %ud -.quip))])
    (take-said flag plan sign)
  ::
      [%groups ~]
    ?+    -.sign  !!
      %kick  watch-groups
    ::
        %watch-ack
      ?~  p.sign
       (give %fact ~ epic+!>(okay))
      =/  =tank
        leaf/"Failed groups subscription in {<dap.bowl>}, unexpected"
      ((slog tank u.p.sign) cor)
    ::
        %fact
      ?.  =(%group-action-0 p.cage.sign)  cor
      (take-groups !<(=action:g q.cage.sign))
    ==
  ==
++  take-groups
  |=  =action:g
  =/  affected=(list flag:d)
    %+  murn  ~(tap by shelf)
    |=  [=flag:d =diary:d]
    ?.  =(p.action group.perm.diary)  ~
    `flag
  ?+    q.q.action  cor
      [%fleet * %del ~]
    ~&  'revoke perms for'
    %+  roll  affected
    |=  [=flag:d co=_cor]
    ^+  cor
    %+  roll  ~(tap in p.q.q.action)
    |=  [=ship ci=_cor]
    ^+  cor
    =/  di  (di-abed:di-core:ci flag)
    di-abet:(di-revoke:di ship)
  ::
      [%fleet * %del-sects *]
    ~&  'recheck permissions'
    %+  roll  affected
    |=  [=flag:d co=_cor]
    =/  di  (di-abed:di-core:co flag)
    di-abet:di-recheck:di
  ::
      [%channel * %del-sects *]
    ~&  'recheck permissions'
    %+  roll  affected
    |=  [=flag:d co=_cor]
    =/  di  (di-abed:di-core:co flag)
    di-abet:di-recheck:di
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
    [%x %imp ~]    ``migrate-map+!>(imp)
  ::
    [%x %shelf ~]  ``shelf+!>(shelf)
  ::
      [%x %diary @ @ *]
    =/  =ship  (slav %p i.t.t.path)
    =*  name   i.t.t.t.path
    (di-peek:(di-abed:di-core ship name) t.t.t.t.path)
    ::
      [%x %briefs ~]
    =-  ``diary-briefs+!>(-)
    ^-  briefs:d
    %-  ~(gas by *briefs:d)
    %+  turn  ~(tap in ~(key by shelf))
    |=  =flag:d
    :-  flag
    di-brief:(di-abed:di-core flag)
  ==
::
++  give-brief
  |=  [=flag:d =brief:briefs:d]
  (give %fact ~[/briefs] diary-brief-update+!>([flag brief]))
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
++  from-self  =(our src):bowl
++  di-core
  |_  [=flag:d =diary:d gone=_|]
  +*  di-notes  ~(. not notes.diary)
  ++  di-core  .
  ::  TODO: archive??
  ++  di-abet  
    %_  cor
        shelf  
      ?:(gone (~(del by shelf) flag) (~(put by shelf) flag diary))
    ==
  ++  di-abed
    |=  f=flag:d
    di-core(flag f, diary (~(got by shelf) f))
  ++  di-area  `path`/diary/(scot %p p.flag)/[q.flag]
  ++  di-spin
    |=  [rest=path con=(list content:ha) but=(unit button:ha)]
    =*  group  group.perm.diary
    =/  =nest:g  [dap.bowl flag]
    =/  rope  [`group `nest q.byk.bowl (welp /(scot %p p.flag)/[q.flag] rest)]
    =/  link  
      (welp /groups/(scot %p p.group)/[q.group]/channels/diary/(scot %p p.flag)/[q.flag] rest)
    (spin rope con link but)
  ::  TODO: add metadata
  ::        maybe delay the watch?
  ++  di-import
    |=  [writers=(set ship) =association:met:d]
    ^+  di-core
    =?  di-core  ?=(%sub -.net.diary)
      di-sub
    di-core
  ::
  ++  di-said
    |=  =plan:d
    |^  ^+  di-core
    ?.  (di-can-read src.bowl)
      (give-kick diary-denied+!>(~))
    =/  [* =note:d]  (got:di-notes p.plan)
    =/  =outline:d  (trace:di-notes note)
    %+  give-kick  %diary-said
    !>  ^-  said:d
    [flag outline]
    ++  give-kick
      |=  =cage
      =.  cor  (give %fact ~ cage)
      =.  cor  (give %kick ~ ~)
      di-core
    --
  ::
  ++  di-upgrade
    ^+  di-core
    ?.  ?=(%sub -.net.diary)
      di-core
    ?.  ?=(%dex -.saga.net.diary)
      di-core
    ?.  =(okay ver.saga.net.diary)
      ~&  future-shock/[ver.saga.net.diary flag]
      di-core
    =>  .(saga.net.diary `saga:e`saga.net.diary)
    di-make-chi
  ::
  ++  di-make-lev
    ?.  ?=(%sub -.net.diary)
      di-core
    =.  saga.net.diary  lev/~
    =.  cor  (watch-epic p.flag)
    di-core
  ::
  ++  di-make-chi
    ?.  ?=(%sub -.net.diary)
      di-core
    =.  saga.net.diary  chi/~
    di-safe-sub
  ::
  ++  di-safe-sub
    ?:  (~(has by wex.bowl) [(snoc di-area %updates) p.flag dap.bowl])
      di-core
    di-sub
  ::
  ++  di-watch
    |=  =path
    ^+  di-core
    ?+    path  !!
      [%updates *]    (di-pub t.path)
      [%ui ~]         ?>(from-self di-core)
      [%ui %notes ~]  ?>(from-self di-core)
    ::
    ==
  ++  di-pass
    |%
    ++  writer-sect
      |=  [ships=(set ship) =association:met:d]
      =/  =sect:g
        (rap 3 %diary '-' (scot %p p.flag) '-' q.flag ~)
      =/  title=@t
        (rap 3 'Writers: ' title.metadatum.association ~)
      =/  desc=@t
        (rap 3 'The writers role for the ' title.metadatum.association ' notebook' ~)
      %+  poke-group  %import-writers
      :+  group.association   now.bowl
      [%cabal sect %add title desc '' '']
    ::
    ++  poke-group
      |=  [=term =action:g]
      ^+  di-core
      =/  =dock      [our.bowl %groups] :: [p.p.action %groups] XX: check?
      =/  =wire      (snoc di-area term)
      =.  cor
        (emit %pass wire %agent dock %poke group-action-0+!>(action))
      di-core
    ::
    ++  create-channel
      |=  [=term group=flag:g =channel:g]
      ^+  di-core
      %+  poke-group  term
      ^-  action:g
      :+  group  now.bowl
      [%channel [dap.bowl flag] %add channel]
    ::
    ++  import-channel
      |=  =association:met:d
      =/  meta=data:meta:g
        [title description '' '']:metadatum.association
      (create-channel %import group.association meta now.bowl zone=%default %| ~)
    ::
    ++  add-channel
      |=  req=create:d
      %+  create-channel  %create
      [group.req =,(req [[title description '' ''] now.bowl %default | readers])]
    ::
    --
  ++  di-init
    |=  req=create:d
    =/  =perm:d  [writers.req group.req]
    =.  cor
      (give-brief flag di-brief)
    =.  di-core  (di-update now.bowl %create perm notes.diary)
    (add-channel:di-pass req)
  ::
  ++  di-agent
    |=  [=wire =sign:agent:gall]
    ^+  di-core
    ?+  wire  !!
        ~  :: noop wire, should only send pokes
      di-core
    ::
        [%updates ~]
      (di-take-update sign)
    ::
        [%create ~]
      ?>  ?=(%poke-ack -.sign)
      %.  di-core  :: TODO rollback creation if poke fails?
      ?~  p.sign  same
      (slog leaf/"poke failed" u.p.sign)
    ::
        [%import ~]
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  di-core
      %-  (slog u.p.sign)
      ::  =.  cor  (emit %pass /pyre %pyre leaf/"Failed group import" u.p.sign)
      di-core
    ==
  ::
  ++  di-brief  (brief:di-notes our.bowl last-read.remark.diary)
  ::
  ++  di-peek
    |=  =(pole knot)
    ^-  (unit (unit cage))
    ?+  pole  [~ ~]
        [%notes rest=*]  (peek:di-notes rest.pole)
        [%perm ~]        ``diary-perm+!>(perm.diary)
    ==
  ::
  ++  di-revoke
    |=  her=ship
    %+  roll  ~(tap in di-subscriptions)
    |=  [[=ship =path] he=_di-core]
    ?.  =(ship her)  he
    he(cor (emit %give %kick ~[path] `ship))
  ::
  ++  di-recheck
    %+  roll  ~(tap in di-subscriptions)
    |=  [[=ship =path] di=_di-core]
    ?:  (di-can-read:di ship)  di
    di(cor (emit %give %kick ~[path] `ship))
  ::
  ++  di-take-epic
    |=  her=epic:e
    ^+  di-core
    ?>  ?=(%sub -.net.diary)
    ?:  =(her okay)
      di-core
    ?:  (gth her okay)
      =.  saga.net.diary  dex+her
      di-core
    di-make-lev
 ::
 ++  di-take-update
    |=  =sign:agent:gall
    ^+  di-core
    ?+    -.sign  di-core
        %kick
      ?>  ?=(%sub -.net.diary)
      ?:  =(%chi -.saga.net.diary)  di-sub
      di-core
    ::
        %watch-ack
      =.  net.diary  [%sub src.bowl & [%chi ~]]
      ?~  p.sign  di-core
      %-  (slog leaf/"Failed subscription" u.p.sign)
      :: =.  gone  &
      di-core
    ::
        %fact
      =*  cage  cage.sign 
      ?+  p.cage  (di-odd-update p.cage)
        %epic                             (di-take-epic !<(epic:e q.cage))
        ?(%diary-logs %diary-logs-0)      (di-apply-logs !<(log:d q.cage))
        ?(%diary-update %diary-update-0)  (di-update !<(update:d q.cage))
      ==
    ==
  ::
  ++  di-odd-update
    |=  =mark
    ?.  (is-old:epos mark)
      di-core
    ?.  ?=(%sub -.net.diary)
      di-core
    di-make-lev
  ::
  ++  di-proxy
    |=  =update:d
    ^+  di-core
    ?>  di-can-write
    =/  =dock  [p.flag dap.bowl]
    =/  =cage  [act:mar !>([flag update])]
    =.  cor
      (emit %pass di-area %agent dock %poke cage)
    di-core
  ::
  ++  di-groups-scry
    =*  group  group.perm.diary
    /(scot %p our.bowl)/groups/(scot %da now.bowl)/groups/(scot %p p.group)/[q.group]
  ::
  ++  di-can-write
    ?:  =(p.flag src.bowl)  &
    =/  =path
      %+  welp  di-groups-scry
      /fleet/(scot %p src.bowl)/vessel/noun
    =+  .^(=vessel:fleet:g %gx path)
    ?:  =(~ writers.perm.diary)  &
    !=(~ (~(int in writers.perm.diary) sects.vessel))
  ::
  ++  di-can-read
    |=  her=ship
    =/  =path
      %+  welp  di-groups-scry
      /channel/[dap.bowl]/(scot %p p.flag)/[q.flag]/can-read/(scot %p her)/loob
    .^(? %gx path)
  ::
  ++  di-pub
    |=  =path
    ^+  di-core
    ?>  (di-can-read src.bowl)
    =/  =log:d
      ?~  path  log.diary
      =/  =time  (slav %da i.path)
      (lot:log-on:d log.diary `time ~)
    =/  =cage  diary-logs+!>(log)
    =.  cor  (give %fact ~ cage)
    di-core
  ::
  ++  di-sub
    ^+  di-core
    =/  tim=(unit time)
      (bind (ram:log-on:d log.diary) head)
    =/  base=wire  (snoc di-area %updates)
    =/  =path 
      %+  weld  base
      ?~  tim  ~
      /(scot %da u.tim)
    =/  =card
      [%pass base %agent [p.flag dap.bowl] %watch path]
    =.  cor  (emit card)
    di-core
  ::
  ++  di-join
    |=  f=flag:d
    ^+  di-core
    =.  shelf  (~(put by shelf) f *diary:d)
    =.  di-core  (di-abed f)
    =.  cor  (give-brief flag di-brief)
    di-sub
  ::
  ++  di-leave
    =/  =dock  [p.flag dap.bowl]
    =/  =wire  (snoc di-area %updates)
    =.  cor  (emit %pass wire %agent dock %leave ~)
    =.  cor  (emit %give %fact ~[/briefs] diary-leave+!>(flag))
    =.  gone  &
    di-core
  ::
  ++  di-apply-logs
    |=  =log:d
    ^+  di-core
    =/  updates=(list update:d)
      (tap:log-on:d log)
    %+  roll  updates
    |=  [=update:d di=_di-core]
    (di-update:di update)
  ::
  ++  di-subscriptions
    %+  roll  ~(val by sup.bowl)
    |=  [[=ship =path] out=(set [ship path])]
    ?.  =((scag 4 path) (snoc di-area %updates))
      out
    (~(put in out) [ship path])
  ::
  ++  di-give-updates
    |=  [=time d=diff:d]
    ^+  di-core
    =/  paths=(set path)
      %-  ~(gas in *(set path))
      (turn ~(tap in di-subscriptions) tail)
    =.  paths  (~(put in paths) (snoc di-area %ui))
    =.  cor  (give %fact ~[/ui] act:mar !>([flag [time d]]))
    =/  cag=cage  [upd:mar !>([time d])]
    =.  cor
      (give %fact ~(tap in paths) cag)
    di-core
  ::
  ++  di-remark-diff
    |=  diff=remark-diff:d
    ^+  di-core
    =.  cor
      (give %fact ~[(snoc di-area %ui)] diary-remark-action+!>([flag diff]))
    =.  remark.diary
      ?-  -.diff
        %watch    remark.diary(watching &)
        %unwatch  remark.diary(watching |)
        %read-at  !!
      ::
          %read
      =/  [=time =note:d]  (need (ram:on:notes:d notes.diary))
      remark.diary(last-read `@da`(add time 1))  ::  greater than last
      ==
    =.  cor
      (give-brief flag di-brief)
    di-core
  ::
  ++  di-update
    |=  [=time dif=diff:d]
    ?>  di-can-write
    ^+  di-core
    :: we use now on the host to enforce host ordering
    =?  time  =(p.flag our.bowl)
      now.bowl
    =.  log.diary
      (put:log-on:d log.diary time dif)
    =.  di-core
      (di-give-updates time dif)
    ?-    -.dif
        %notes
      =.  notes.diary  (reduce:di-notes time p.dif)
      =.  cor  (give-brief flag di-brief)
      =/  cons=(list (list content:ha))
        (hark:di-notes our.bowl p.dif)
      =.  cor
        %-  emil
        %+  turn  cons
        |=  cs=(list content:ha)
        (pass-hark & & (di-spin /note/(rsh 4 (scot %ui p.p.dif)) cs ~))
      di-core
    ::
        %add-sects
      =*  p  perm.diary
      =.  writers.p  (~(uni in writers.p) p.dif)
      di-core
    ::
        %del-sects
      =*  p  perm.diary
      =.  writers.p  (~(dif in writers.p) p.dif)
      di-core
    ::
        %create
      =:  notes.diary  q.dif
          perm.diary   p.dif
        ==
      di-core
    ::
        %sort
      =.  sort.diary  p.dif
      di-core
    ::
        %view
      =.  view.diary  p.dif
      di-core
    ==
  --
--

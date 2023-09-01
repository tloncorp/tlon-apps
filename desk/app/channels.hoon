::  TODO: listen to groups to join channel
::  TODO: should version negotiation be by han or one for all?
::  TODO: migrate data from source apps
::
/-  j=joint, d=diary, h=heap, g=groups, ha=hark
/-  meta
/-  e=epic
/+  default-agent, verb, dbug, sparse
/+  epos-lib=saga
/+  libserver=channel-server
::  performance, keep warm
/+  diary-json
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  han  ?(%diary %heap)
  +$  current-state
    $:  %2
        =shelf:d
        =stash:h
        vod=(map [flag:d plan:d] (unit said:d))
        voh=(map [flag:d id-curio:h] (unit said:h))
    ==
  --
=|  current-state
=*  state  -
=<
  %+  verb  |
  %-  agent:dbug
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %|) bowl)
      cor   ~(. +> [bowl ~])
  ++  on-init
    ^-  (quip card _this)
    =^  cards  state
      abet:inflate-io:cor
    [cards this]
  ::
  ++  on-save  !>([state okay:d])
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
  ::
  ++  on-watch
    |=  =path
    ^-  (quip card _this)
    =^  cards  state
      abet:(watch:cor path)
    [cards this]
  ::
  ++  on-peek    peek:cor
  ++  on-leave   on-leave:def
  ++  on-fail    on-fail:def
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    =^  cards  state
      abet:(agent:cor wire sign)
    [cards this]
  ::
  ++  on-arvo
    |=  [=wire sign=sign-arvo]
    ^-  (quip card _this)
    ~&  strange-diary-arvo+wire
    `this
  --
|_  [=bowl:gall cards=(list card)]
+*  epos  ~(. epos-lib [bowl %diary-update okay:d])
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  server  (cat 3 dap.bowl '-server')
::
::  does not overwite if wire and dock exist.  maybe it should
::  leave/rewatch if the path differs?
::
++  safe-watch
  |=  [=wire =dock =path]
  ^+  cor
  ?:  (~(has by wex.bowl) wire dock)  cor
  (emit %pass wire %agent dock %watch path)
::
++  load
  |=  =vase
  |^  ^+  cor
  =+  !<([old=versioned-state cool=epic:e] vase)
  ?>  ?=(%0 -.old)
  =.  state  old
  =.  cor  inflate-io
  (give %fact ~[/epic] epic+!>(okay:d))
  ::
  +$  versioned-state  $%(current-state)
  --
::
++  inflate-io
  ::  leave all subscriptions we don't recognize
  ::
  =.  cor
    %+  roll
      ~(tap by wex.bowl)
    |=  [[[=wire =ship =dude:gall] acked=? =path] core=_cor]
    =.  cor  core
    =/  keep=?
      ?+    wire  |
          [%epic *]    &(=(dap.bowl dude) =(/epic wire) =(/epic path))
          [%groups *]  &(=(%groups dude) =(our.bowl ship) =(/groups path))
          [han @ @ %updates ~]
        ?.  =(%channel-server dude)  |
        ?.  =((scot %p ship) i.t.wire)  |
        =*  qflag  i.t.t.wire
        ?+    i.wire  |
            %diary
          ?~  diary=(~(get by shelf) ship qflag)  |
          ?.  ?=(%chi -.saga.net.u.diary)  |
          ?.  ?=([%diary @ %updates ?(~ [@ ~])] path)  |
          =(qflag i.t.path)
        ::
            %heap
          ?~  heap=(~(get by stash) ship qflag)  |
          ?.  ?=(%chi -.saga.net.u.heap)  |
          ?.  ?=([%heap @ %updates ?(~ [@ ~])] path)  |
          =(qflag i.t.path)
        ==
      ::
          [han @ @ %checkpoint ~]
        ?.  =(%channel-server dude)  |
        ?.  =((scot %p ship) i.t.wire)  |
        =*  qflag  i.t.t.wire
        ?+    i.wire  |
            %diary
          ?~  diary=(~(get by shelf) ship qflag)  |
          ?.  ?=(%chi -.saga.net.u.diary)  |
          ?.  ?=([%diary @ %checkpoint %before @] path)  |
          =(qflag i.t.path)
        ::
            %heap
          ?~  heap=(~(get by stash) ship qflag)  |
          ?.  ?=(%chi -.saga.net.u.heap)  |
          ?.  ?=([%heap @ %checkpoint %before @] path)  |
          =(qflag i.t.path)
        ==
      ::
          [%said @ @ han @ rest=*]
        ?.  =(%channel-server dude)  |       :: maybe %diary ?
        ?.  =((scot %p ship) i.t.wire)  |  :: ?
        =*  qflag  i.t.t.wire
        =*  rest  t.t.t.t.t.wire
        ?.  =(wire path)  |
        ?-    i.t.t.t.wire
            %diary
          ?.  ?=([@ ?(~ [@ ~])] rest)  |
          ?~  pplan=(slaw %ud i.rest)  |
          =/  qplan=(unit (unit time))
            ?~  t.rest  `~
            ?~  q=(slaw %ud i.t.rest)  ~
            ``u.q
          ?~  qplan  |
          (~(has by vod) [ship qflag] u.pplan u.qplan)
        ::
            %heap
          ?.  ?=([@ ~] rest)  |
          ?~  id=(slaw %ud i.rest)  |
          (~(has by voh) [ship qflag] id)
        ==
      ==
    ?:  keep  cor
    (emit %pass wire %agent [ship dude] %leave ~)
  ::
  ::  watch all the subscriptions we expect to have
  ::
  =.  cor  watch-groups
  =/  diaries  ~(tap in ~(key by shelf))
  =/  heaps    ~(tap in ~(key by stash))
  =.  cor
    =/  ships
      %-  ~(gas in *(set ship))
      %+  welp  (turn diaries head)
      (turn heaps head)
    %+  roll  ~(tap in ships)
    |=  [=ship cr=_cor]
    ?:  =(ship our.bowl)  cr
    (watch-epic:cr ship)
  ::
  =.  cor
    %+  roll  ~(tap by shelf)
    |=  [[=flag:d *] core=_cor]
    di-abet:di-safe-sub:(di-abed:di-core:core flag)
  ::
  =.  cor
    %+  roll  ~(tap by stash)
    |=  [[=flag:d *] core=_cor]
    he-abet:he-safe-sub:(he-abed:he-core:core flag)
  ::
  =.  cor
    |-
    ?^  diaries
      =.  cor  di-abet:di-upgrade:(di-abed:di-core i.diaries)
      $(diaries t.diaries)
    ?^  heaps
      =.  cor  he-abet:he-upgrade:(he-abed:he-core i.heaps)
      $(heaps t.heaps)
    cor
  cor
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+    mark  ~|(bad-poke/mark !!)
      %channel-join
    =+  !<([group=flag:g chan=flag:g] vase)
    $(mark %diary-action, vase !>([chan %join group]))
  ::
      %diary-action
    =+  !<(=a-shelf:d vase)
    ?:  ?=(%create -.a-shelf)
      di-abet:(di-create:di-core create-diary.a-shelf)
    ?:  ?=(%join -.a-diary.a-shelf)
      di-abet:(di-join:di-core [flag group.a-diary]:a-shelf)
    di-abet:(di-a-diary:(di-abed:di-core flag.a-shelf) a-diary.a-shelf)
  ::
      %heap-action
    =+  !<(=a-stash:h vase)
    ?:  ?=(%create -.a-stash)
      he-abet:(he-create:he-core create-heap.a-stash)
    ?:  ?=(%join -.a-heap.a-stash)
      he-abet:(he-join:he-core [flag group.a-heap]:a-stash)
    he-abet:(he-a-heap:(he-abed:he-core flag.a-stash) a-heap.a-stash)
  ==
::
++  watch
  |=  =(pole knot)
  ^+  cor
  ?+    pole  ~|(bad-watch-path/pole !!)
      [%briefs ~]   ?>(from-self cor)
      [%ui ~]       ?>(from-self cor)
      [%imp ~]      ?>(from-self cor)
      [%epic ~]    (give %fact ~ epic+!>(okay:d))
      [%diary ship=@ name=@ %ui ?(~ [%notes ~])]  ?>(from-self cor)
      [%heap ship=@ name=@ %ui ?(~ [%notes ~])]   ?>(from-self cor)
      [%said host=@ name=@ =han rest=*]
    =/  host=ship   (slav %p host.pole)
    =/  =flag:d     [host name.pole]
    (watch-said han.pole flag)
  ==
::
++  watch-said
  |=  [=han =flag:d =(pole knot)]
  ^+  cor
  ?-    han
      %diary
    ?.  ?=([time=@ quip=?(~ [@ ~])] pole)  cor
    =/  =plan:d  =,(pole [(slav %ud time) ?~(quip ~ `(slav %ud -.quip))])
    ?.  (~(has by shelf) flag)
      =/  wire  (said-wire-diary flag plan)
      (safe-watch wire [p.flag server] wire)
    di-abet:(di-said:(di-abed:di-core flag) plan)
  ::
      %heap
    ?.  ?=([time=@ ~] pole)  cor
    =/  =id-curio:h  (slav %ud time)
    ?.  (~(has by stash) flag)
      =/  wire  (said-wire-heap flag id-curio)
      (safe-watch wire [p.flag server] wire)
    he-abet:(he-said:(he-abed:he-core flag) id-curio)
  ==
::
++  said-wire-diary
  |=  [=flag:d =plan:d]
  ^-  wire
  %+  welp
    /said/(scot %p p.flag)/[q.flag]/diary/(scot %ud p.plan)
  ?~(q.plan / /(scot %ud u.q.plan))
::
++  said-wire-heap
  |=  [=flag:d =id-curio:d]
  ^-  wire
  /said/(scot %p p.flag)/[q.flag]/heap/(scot %ud id-curio)
::
++  take-said
  |=  [=han =flag:d =(pole knot) =sign:agent:gall]
  ^+  cor
  ?:  ?=(%poke-ack -.sign)  cor
  ?:  ?=(%watch-ack -.sign)
    %.  cor
    ?~  p.sign  same
    (slog leaf+"Preview failed for {<han>} {<flag>}" u.p.sign)
  ::
  ?-    han
      %diary
    ?.  ?=([time=@ quip=?(~ [@ ~])] pole)  cor
    =/  =plan:d  =,(pole [(slav %ud time) ?~(quip ~ `(slav %ud -.quip))])
    =/  =wire  (said-wire-diary flag plan)
    ?-    -.sign
        %kick
      ?:  (~(has by vod) flag plan)
        cor  :: subscription ended politely
      (give %kick ~[(said-wire-diary han flag plan)] ~)
    ::
        %fact
      =.  cor  (give %fact ~[wire] cage.sign)
      =.  cor  (give %kick ~[wire] ~)
      ?+    p.cage.sign  ~|(funny-mark+p.cage.sign !!)
          %diary-denied  cor(vod (~(put by vod) [flag plan] ~))
          %diary-said
        =+  !<(=said:d q.cage.sign)
        cor(vod (~(put by vod) [flag plan] `said))
      ==
    ==
  ::
      %heap
    ?.  ?=([time=@ ~] pole)  cor
    =/  =id-curio:h  (slav %ud time)
    =/  =wire  (said-wire-heap flag id-curio)
    ?-    -.sign
        %kick
      ?:  (~(has by voh) [flag id-curio])
        cor  :: subscription ended politely
      (give %kick ~[(said-wire-heap han flag id-curio)] ~)
    ::
        %fact
      =.  cor  (give %fact ~[wire] cage.sign)
      =.  cor  (give %kick ~[wire] ~)
      ?+    p.cage.sign  ~|(funny-mark+p.cage.sign !!)
          %heap-denied  cor(voh (~(put by voh) [flag id-curio] ~))
          %heap-said
        =+  !<(=said:h q.cage.sign)
        cor(voh (~(put by voh) [flag id-curio] `said))
      ==
    ==
  ==
::
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+    pole  ~|(bad-agent-wire/pole !!)
      ~          cor
      [%epic ~]  (take-epic sign)
      [%hark ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  cor
    %-  (slog leaf+"Failed to hark" u.p.sign)
    cor
  ::
      [%diary ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    di-abet:(di-agent:(di-abed:di-core ship name.pole) rest.pole sign)
  ::
      [%heap ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    he-abet:(he-agent:(he-abed:he-core ship name.pole) rest.pole sign)
  ::
      [%said host=@ name=@ =han rest=*]
    =/  host=ship   (slav %p host.pole)
    =/  =flag:d     [host name.pole]
    (take-said han.pole flag plan rest.pole sign)
  ::
      [%groups ~]
    ?+    -.sign  !!
        %kick       watch-groups
        %watch-ack
      ?~  p.sign
        cor
      =/  =tank
        leaf+"Failed groups subscription in {<dap.bowl>}, unexpected"
      ((slog tank u.p.sign) cor)
    ::
        %fact
      ?.  =(act:mar:g p.cage.sign)  cor
      (take-groups !<(=action:g q.cage.sign))
    ==
  ==
::
++  watch-groups  (safe-watch /groups [our.bowl %groups] /groups)
++  watch-epic
  |=  her=ship
  (safe-watch /epic [her server] /epic)
::
++  safe-watch-epic
  |=  her=ship
  ^-  [(unit saga:e) _cor]
  =/  diaries=(list [=flag:d =diary:d])  ~(tap by shelf)
  |-
  ?^  diaries
    ?.  =(p.flag.i.diaries her)  $(diaries t.diaries)
    [`saga.net.diary.i.diaries di-core]
  |-
  =/  heaps=(list [=flag:h =heap:d])  ~(tap by shelf)
  ?^  heaps
    ?.  =(p.flag.i.heaps her)  $(heaps t.heaps)
    [`saga.net.heap.i.heaps di-core]
  (watch-epic her)
::
++  take-epic
  |=  =sign:agent:gall
  ^+  cor
  ?+    -.sign  cor
      %kick  (watch-epic src.bowl)
      %fact
    ?.  =(%epic p.cage.sign)
      ~&  '!!! weird fact on /epic'
      ~&  p.cage.sign
      cor
    =+  !<(=epic:e q.cage.sign)
    =.  cor
      %+  roll  ~(tap by shelf)
      |=  [[=flag:g =diary:d] out=_cor]
      ?.  =(src.bowl p.flag)  out
      di-abet:(di-take-epic:(di-abed:di-core:out flag) epic)
    ::
    =.  cor
      %+  roll  ~(tap by stash)
      |=  [[=flag:g =heap:d] out=_cor]
      ?.  =(src.bowl p.flag)  out
      he-abet:(he-take-epic:(he-abed:he-core:out flag) epic)
    ::
    cor
  ::
      %watch-ack
    %.  cor
    ?~  p.sign  same
    (slog leaf+"weird watch nack" u.p.sign)
  ==
::
++  take-groups
  |=  =action:g
  =/  affected=(list [han flag:d])
    %+  weld
      %+  murn  ~(tap by shelf)
      |=  [=flag:d =diary:d]
      ?.  =(p.action group.perm.perm.diary)  ~
      `[%diary flag]
    %+  murn  ~(tap by stash)
    |=  [=flag:d =heap:d]
    ?.  =(p.action group.perm.perm.heap)  ~
    `[%heap flag]
  ::
  =/  diff  q.q.action
  ?+    diff  cor
      [%fleet * %add-sects *]    (recheck-perms affected ~)
      [%fleet * %del-sects *]    (recheck-perms affected ~)
      [%channel * %edit *]       (recheck-perms affected ~)
      [%channel * %del-sects *]  (recheck-perms affected ~)
      [%channel * %add-sects *]  (recheck-perms affected ~)
      [%cabal * %del *]
    =/  =sect:g  (slav %tas p.diff)
    %+  recheck-perms  affected
    (~(gas in *(set sect:g)) ~[p.diff])
  ==
::
++  recheck-perms
  |=  [affected=(list [han flag:d]) sects=(set sect:g)]
  ~&  "%channel-server recheck permissions for {<affected>}"
  %+  roll  affected
  |=  [[=han =flag:d] co=_cor]
  =.  cor  co
  ?-  han
    %diary  di-abet:(di-recheck:(di-abed:di-core flag) sects)
    %heap   he-abet:(he-recheck:(he-abed:he-core flag) sects)
  ==
::
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+    pole  [~ ~]
      [%x %shelf ~]  ``shelf+!>((di-rr-shelf:di-core shelf))
      [%x %init ~]   ``noun+!>([briefs (di-rr-shelf:di-core shelf)])
      [%x %diary %briefs ~]  ``diary-briefs+!>(briefs)
      [%x %diary ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    (di-peek:(di-abed:di-core ship name.pole) rest.pole)
  ::
      [%u %diary ship=@ name=@ ~]
    =/  =ship  (slav %p ship.pole)
    ``loob+!>((~(has by shelf) [ship name.pole]))
  ::
      [%x %heap %briefs ~]  ``heap-briefs+!>(heap-briefs)
      [%x %heap ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    (he-peek:(he-abed:he-core ship name.pole) rest.pole)
  ::
      [%u %heap ship=@ name=@ ~]
    =/  =ship  (slav %p ship.pole)
    ``loob+!>((~(has by stash) [ship name.pole]))
  ==
::
++  diary-briefs
  ^-  briefs:d
  %-  ~(gas by *briefs:d)
  %+  turn  ~(tap in ~(key by shelf))
  |=  =flag:d
  [flag di-brief:(di-abed:di-core flag)]
::
++  heap-briefs
  ^-  briefs:h
  %-  ~(gas by *briefs:d)
  %+  turn  ~(tap in ~(key by stash))
  |=  =flag:d
  [flag he-brief:(he-abed:he-core flag)]
::
++  spin-yarn
  |=  [=nest:g group=flag:g rest=path con=(list content:ha) but=(unit button:ha)]
  ^-  new-yarn:ha
  =/  rope  [`group `nest q.byk.bowl (welp /(scot %p p.q.nest)/[q.q.nest] rest)]
  =/  link
    %-  welp  :_  rest
    :-  %groups
    /(scot %p p.group)/[q.group]/channels/[p.nest]/(scot %p p.q.nest)/[q.flag]
  [& & rope con link but]
::
++  pass-hark
  |=  =new-yarn:ha
  ^-  card
  =/  =cage  hark-action-1+!>([%new-yarn new-yarn])
  [%pass /hark %agent [our.bowl %hark] %poke cage]
::
++  from-self  =(our src):bowl
::
++  di-core
  |_  [=flag:d =diary:d gone=_|]
  ++  di-core  .
  ++  emit  |=(=card di-core(cor (^emit card)))
  ++  emil  |=(caz=(list card) di-core(cor (^emil caz)))
  ++  give  |=(=gift:agent:gall di-core(cor (^give gift)))
  ++  safe-watch  |=([=wire =dock =path] di-core(cor (^safe-watch +<)))
  ++  di-abet
    %_    cor
        shelf
      ?:(gone (~(del by shelf) flag) (~(put by shelf) flag diary))
    ==
  ::
  ++  di-abed
    |=  f=flag:d
    di-core(flag f, diary (~(got by shelf) f))
  ::
  ++  di-area  `path`/diary/(scot %p p.flag)/[q.flag]
  ++  di-sub-wire  `path`/diary/(scot %p p.flag)/[q.flag]/updates
  ++  di-give-brief
    (give %fact ~[/briefs] diary-brief-update+!>([flag di-brief]))
  ::
  ::  give a "response" to our subscribers
  ::
  ++  di-response
    |=  =r-diary:d
    =/  =r-shelf:d  [flag r-diary]
    (give %fact ~[/ui] %diary-response !>(r-shelf))
  ::
  ::  handle creating a channel
  ::
  ++  di-create
    |=  create=create-diary:d
    ?>  from-self
    =.  flag  [our.bowl name.create]
    ?<  (~(has by shelf) flag)
    =.  diary  *diary:d
    =.  group.perm.perm.diary  group.create
    =.  last-read.remark.diary  now.bowl
    =/  =cage  [%diary-command !>([%create create])]
    (emit %pass (weld di-area /create) %agent [our.bowl server] %poke cage)
  ::
  ::  handle joining a channel
  ::
  ++  di-join
    |=  [f=flag:d group=flag:g]
    ?<  (~(has by shelf) flag)
    ?>  |(=(p.group src.bowl) from-self)
    =.  flag  f
    =.  diary  *diary:d
    =.  group.perm.perm.diary  group
    =.  last-read.remark.diary  now.bowl
    =.  di-core  di-give-brief
    =.  di-core  (di-response %join group)
    =^  sag=(unit saga:e)  cor  (safe-watch-epic p.flag)
    =?  saga.net.diary  ?=(^ sag)  u.sag
    di-safe-sub
  ::
  ::  handle an action from the client
  ::
  ::    typically this will either handle the action directly (for local
  ::    things like marking channels read) or proxy the request to the
  ::    host (for global things like posting a note).
  ::
  ++  di-a-diary
    |=  =a-diary:d
    ?>  from-self
    ?+  -.a-diary  (di-send-command a-diary)
      %join   !!  ::  handled elsewhere
      %leave  di-leave
      ?(%read %read-at %watch %unwatch)  (di-a-remark a-diary)
    ==
  ::
  ++  di-a-remark
    |=  =a-remark:j
    ^+  di-core
    =.  di-core
      (give %fact ~[(snoc di-area %ui)] diary-response+!>([flag a-remark]))
    =.  remark.diary
      ?-    -.a-remark
          %watch    remark.diary(watching &)
          %unwatch  remark.diary(watching |)
          %read-at  !!
          %read
        =/  [=time note=(unit note:d)]  (need (ram:on-notes:d notes.diary))
        remark.diary(last-read `@da`(add time (div ~s1 100)))
      ==
    =.  di-core  di-give-brief
    (di-response a-remark)
  ::
  ::  proxy command to host
  ::
  ++  di-send-command
    |=  =c-diary:d
    ^+  di-core
    ::  don't allow anyone else to proxy through us
    ?.  =(src.bowl our.bowl)
      ~|("%diary-action poke failed: only allowed from self" !!)
    =/  =cage  [%diary-command !>(`c-shelf:d`[%diary flag c-diary])]
    (emit %pass di-area %agent [p.flag server] %poke cage)
  ::
  ::  handle a said (previews) request where we have the data to respond
  ::
  ++  di-said
    |=  =plan:d
    ^+  di-core
    =.  di-core
      %^  give  %fact  ~
      ?.  (di-can-read src.bowl)  diary-denied+!>(~)
      (diary-said:libserver flag plan notes.diary)
    (give %kick ~ ~)
  ::
  ::  when we get a new %diary agent update, we need to check if we
  ::  should upgrade any lagging diaries. if we're lagging, we need to
  ::  change the saga to "chi" to resume syncing updates from the host.
  ::  otherwise we can no-op, because we're not in sync yet.
  ::
  ++  di-upgrade
    ^+  di-core
    ::  if we're ahead or synced, no-op
    ::
    ?.  ?=(%dex -.saga.net.diary)
      di-core
    ::  if we're still behind even with the upgrade, no-op
    ::
    ?.  =(okay:d ver.saga.net.diary)
      ~&  future-shock+[ver.saga.net.diary flag]
      di-core
    ::  safe to sync and resume updates from host
    ::
    =>  .(saga.net.diary `saga:e`saga.net.diary)
    di-make-chi
  ::
  ::  when we hear a version number from a publisher, check if we match
  ::
  ++  di-take-epic
    |=  her=epic:e
    ^+  di-core
    ?:  (lth her okay:d)  di-make-lev
    ?:  (gth her okay:d)  (di-make-dex her)
    di-make-chi
  ::
  ++  di-make-dex
    |=  her=epic:e
    =.  saga.net.diary  dex+her
    di-simple-leave
  ::
  ++  di-make-lev
    =.  saga.net.diary  lev+~
    di-simple-leave
  ::
  ++  di-make-chi
    =.  saga.net.diary  chi+~
    di-safe-sub
  ::
  ++  di-has-sub
    (~(has by wex.bowl) [di-sub-wire p.flag dap.bowl])
  ::
  ++  di-safe-sub
    ^+  di-core
    ?:  di-has-sub  di-core
    ?.  ?=(%chi -.saga.net.diary)  di-core
    ?^  notes.diary  di-start-updates
    =.  load.net.diary  |
    %^  safe-watch  (weld di-area /checkpoint)  [p.flag server]
    ?.  =(our.bowl p.flag)
      /diary/[q.flag]/checkpoint/before/20
    /diary/[q.flag]/checkpoint/time-range/(scot %da *@da)
  ::
  ++  di-start-updates
    ::  not most optimal time, should maintain last heard time instead
    =/  tim=(unit time)
      (bind (ram:on-notes:d notes.diary) head)
    %^  safe-watch  di-sub-wire  [p.flag server]
    /diary/[q.flag]/updates/(scot %da (fall tim *@da))
  ::
  ++  di-agent
    |=  [=wire =sign:agent:gall]
    ^+  di-core
    ?+  wire  ~|(diary-strange-agent-wire+wire !!)
      ~  di-core  :: noop wire, should only send pokes
      [%create ~]       (di-take-create sign)
      [%updates ~]      (di-take-update sign)
      [%checkpoint ~]   (di-take-checkpoint sign)
    ==
  ::
  ++  di-take-create
    |=  =sign:agent:gall
    ^+  di-core
    ?-    -.sign
        %poke-ack
      =+  ?~  p.sign  ~
          %-  (slog leaf+"%diary: Failed creation (poke)" u.p.sign)
          ~
      =/  =path  /diary/[q.flag]/create
      =/  =wire  (weld di-area /create)
      (emit %pass wire %agent [our.bowl server] %watch path)
    ::
        %kick       di-safe-sub
        %watch-ack
      ?~  p.sign  di-core
      %-  (slog leaf+"%diary: Failed creation" u.p.sign)
      di-core
    ::
        %fact
      =*  cage  cage.sign
      ?.  =(%diary-update p.cage)
        ~|(diary-strange-fact+p.cage !!)
      =+  !<(=update:d q.cage)
      =.  di-core  (di-u-shelf update)
      =.  di-core  di-give-brief
      di-safe-sub
    ==
  ::
  ++  di-take-update
    |=  =sign:agent:gall
    ^+  di-core
    ?+    -.sign  di-core
        %kick       di-safe-sub
        %watch-ack
      ?~  p.sign  di-core
      %-  (slog leaf+"%diary: Failed subscription" u.p.sign)
      di-core
    ::
        %fact
      =*  cage  cage.sign
      ?+  p.cage  ~|(diary-strange-fact+p.cage !!)
        %diary-logs    (di-apply-logs !<(log:d q.cage))
        %diary-update  (di-u-shelf !<(update:d q.cage))
      ==
    ==
  ::
  ++  di-take-checkpoint
    |=  =sign:agent:gall
    ^+  di-core
    ?+    -.sign  di-core
        :: only if kicked prematurely
        %kick       ?:(load.net.diary di-core di-safe-sub)
        %watch-ack
      ?~  p.sign  di-core
      %-  (slog leaf+"%diary: Failed partial checkpoint" u.p.sign)
      di-core
    ::
        %fact
      =*  cage  cage.sign
      ?+    p.cage  ~|(diary-strange-fact+p.cage !!)
          %diary-checkpoint
        (di-ingest-checkpoint !<(u-checkpoint:d q.cage))
      ==
    ==
  ::
  ++  di-ingest-checkpoint
    |=  chk=u-checkpoint:d
    ^+  di-core
    =.  load.net.diary  &
    =^  changed  sort.diary  (apply-rev:j sort.diary sort.chk)
    =?  di-core  changed  (di-response %sort sort.sort.diary)
    =^  changed  view.diary  (apply-rev:j view.diary view.chk)
    =?  di-core  changed  (di-response %view view.view.diary)
    =^  changed  perm.diary  (apply-rev:j perm.diary perm.chk)
    =?  di-core  changed  (di-response %perm perm.perm.diary)
    =^  changed  order.diary  (apply-rev:j order.diary order.chk)
    =?  di-core  changed  (di-response %order order.order.diary)
    =/  old  notes.diary
    =.  notes.diary
      ((uno:mo-notes:d notes.diary notes.chk) di-apply-unit-note)
    =?  di-core  !=(old notes.diary)
      %+  di-response  %notes
      %+  gas:rr-on-notes:d  *rr-notes:d
      %+  murn  (turn (tap:on-notes:d notes.chk) head)
      |=  id=id-note:d
      ^-  (unit [id-note:d (unit rr-note:d)])
      =/  note  (got:on-notes:d notes.diary id)
      =/  old   (get:on-notes:d old id)
      ?:  =(old `note)  ~
      ?~  note  (some [id ~])
      (some [id `(di-rr-note u.note)])
    =.  di-core  di-start-updates
    =/  wire  (weld di-area /checkpoint)
    (emit %pass wire %agent [p.flag dap.bowl] %leave ~)
  ::
  ++  di-apply-logs
    |=  =log:d
    ^+  di-core
    %+  roll  (tap:log-on:d log)
    |=  [[=time =u-diary:d] di=_di-core]
    (di-u-shelf:di time u-diary)
  ::
  ::  +di-u-* functions ingest updates and execute them
  ::
  ::    often this will modify the state and emit a "response" to our
  ::    own subscribers.  it may also emit briefs and/or trigger hark
  ::    events.
  ::
  ++  di-u-shelf
    |=  [=time =u-diary:d]
    ?>  di-from-host
    ^+  di-core
    ?-    -.u-diary
        %create
      ?.  =(0 rev.perm.diary)  di-core
      =.  perm.perm.diary  perm.u-diary
      (di-response %create perm.u-diary)
    ::
        %order
      =^  changed  order.diary  (apply-rev:j order.diary +.u-diary)
      ?.  changed  di-core
      (di-response %order order.order.diary)
    ::
        %view
      =^  changed  view.diary  (apply-rev:j view.diary +.u-diary)
      ?.  changed  di-core
      (di-response %view view.view.diary)
    ::
        %sort
      =^  changed  sort.diary  (apply-rev:j sort.diary +.u-diary)
      ?.  changed  di-core
      (di-response %sort sort.sort.diary)
    ::
        %perm
      =^  changed  perm.diary  (apply-rev:j perm.diary +.u-diary)
      ?.  changed  di-core
      (di-response %perm perm.perm.diary)
    ::
        %note
      =/  old  notes.diary
      =.  di-core  (di-u-note id.u-diary u-note.u-diary)
      =?  di-core  !=(old notes.diary)  di-give-brief
      di-core
    ==
  ::
  ++  di-u-note
    |=  [=id-note:d =u-note:d]
    ^+  di-core
    =/  note  (get:on-notes:d notes.diary id-note)
    ?:  ?=([~ ~] note)  di-core
    ?:  ?=(%set -.u-note)
      ?~  note
        =/  rr-note=(unit rr-note:d)  (bind note.u-note di-rr-note)
        =.  notes.diary  (put:on-notes:d notes.diary id-note note.u-note)
        (di-response %note id-note %set rr-note)
      ::
      ?~  note.u-note
        =.  notes.diary  (put:on-notes:d notes.diary id-note ~)
        (di-response %note id-note %set ~)
      ::
      =*  old  u.u.note
      =*  new  u.note.u-note
      =/  merged  (di-apply-note id-note old new)
      ?:  =(merged old)  di-core
      =.  notes.diary  (put:on-notes:d notes.diary id-note `merged)
      (di-response %note id-note %set `(di-rr-note merged))
    ::
    ?~  note
      =.  diffs.future.diary
        ::  if the item affected by the update is not in the window we
        ::  care about, ignore it. otherwise, put it in the pending
        ::  diffs set.
        ::
        ?.  (~(has as:sparse window.future.diary) id-note)
          diffs.future.diary
        (~(put ju diffs.future.diary) id-note u-note)
      di-core
    ::
    ?-    -.u-note
        %quip   (di-u-quip id-note u.u.note id.u-note u-quip.u-note)
        %feels
      =/  merged  (apply-feels:j feels.u.u.note feels.u-note)
      ?:  =(merged feels.u.u.note)  di-core
      =.  notes.diary
        (put:on-notes:d notes.diary id-note `u.u.note(feels merged))
      (di-response %note id-note %feels (reduce-feels:j merged))
    ::
        %essay
      =^  changed  +.u.u.note  (apply-rev:j +.u.u.note +.u-note)
      ?.  changed  di-core
      =.  notes.diary  (put:on-notes:d notes.diary id-note `u.u.note)
      (di-response %note id-note %essay +>.u.u.note)
    ==
  ::
  ++  di-u-quip
    |=  [=id-note:d =note:d =id-quip:d =u-quip:d]
    ^+  di-core
    =/  quip  (get:on-quips:d quips.note id-note)
    ?:  ?=([~ ~] quip)  di-core
    ?:  ?=(%set -.u-quip)
      ?~  quip
        =/  rr-quip=(unit rr-quip:d)  (bind quip.u-quip di-rr-quip)
        =?  di-core  ?=(^ quip.u-quip)
          (di-hark id-note note u.quip.u-quip)
        =.  di-core  (di-put-quip id-note id-quip quip.u-quip)
        (di-response %note id-note %quip id-quip %set rr-quip)
      ::
      ?~  quip.u-quip
        =.  di-core  (di-put-quip id-note id-quip ~)
        (di-response %note id-note %quip id-quip %set ~)
      ::
      =*  old  u.u.quip
      =*  new  u.quip.u-quip
      =/  merged  (need (di-apply-quip id-quip `old `new))
      ?:  =(merged old)  di-core
      =.  di-core  (di-put-quip id-note id-quip `merged)
      (di-response %note id-note %quip id-quip %set `(di-rr-quip merged))
    ::
    ?~  quip  di-core
    ::
    =/  merged  (apply-feels:j feels.u.u.quip feels.u-quip)
    ?:  =(merged feels.u.u.quip)  di-core
    =.  di-core  (di-put-quip id-note id-quip `u.u.quip(feels merged))
    (di-response %note id-note %quip id-quip %feels (reduce-feels:j merged))
  ::
  ::  put a quip into a note by id
  ::
  ++  di-put-quip
    |=  [=id-note:d =id-quip:d quip=(unit quip:d)]
    ^+  di-core
    =/  note  (get:on-notes:d notes.diary id-note)
    ?~  note  di-core
    ?~  u.note  di-core
    =.  quips.u.u.note  (put:on-quips:d quips.u.u.note id-quip quip)
    =.  notes.diary  (put:on-notes:d notes.diary id-note `u.u.note)
    di-core
  ::
  ::  +di-apply-* functions apply new copies of data to old copies,
  ::  keeping the most recent versions of each sub-piece of data
  ::
  ++  di-apply-unit-note
    |=  [=id-note:d old=(unit note:d) new=(unit note:d)]
    ^-  (unit note:d)
    ?~  old  ~
    ?~  new  ~
    `(di-apply-note id-note u.old u.new)
  ::
  ++  di-apply-note
    |=  [=id-note:d old=note:d new=note:d]
    ^-  note:d
    %_  old
      quips  (di-apply-quips quips.old quips.new)
      feels  (apply-feels:j feels.old feels.new)
      +      +:(apply-rev:j +.old +.new)
    ==
  ::
  ++  di-apply-quips
    |=  [old=quips:d new=quips:d]
    ((uno:mo-quips:d old new) di-apply-quip)
  ::
  ++  di-apply-quip
    |=  [=id-quip:d old=(unit quip:d) new=(unit quip:d)]
    ^-  (unit quip:d)
    ?~  old  ~
    ?~  new  ~
    :-  ~
    %=  u.old
      feels  (apply-feels:j feels.u.old feels.u.new)
      +      +.u.new
    ==
  ::
  ::  +di-rr-* functions convert notes, quips, and feels into their "rr"
  ::  forms, suitable for responses to our subscribers
  ::
  ++  di-rr-shelf
    |=  =shelf:d
    ^-  rr-shelf:d
    %-  ~(run by shelf)
    |=  =diary:d
    ^-  rr-diary:d
    %*  .  *rr-diary:d
      notes  *rr-notes:d
      perm   +.perm.diary
      view   +.view.diary
      sort   +.sort.diary
      order  +.order.diary
    ==
  ::
  ++  di-rr-note
    |=  =note:d
    ^-  rr-note:d
    :_  +>.note
    :+  id.note
      (di-rr-quips quips.note)
    (reduce-feels:j feels.note)
  ::
  ++  di-rr-quips
    |=  =quips:d
    ^-  rr-quips:d
    %+  gas:rr-on-quips:d  *rr-quips:d
    %+  murn  (tap:on-quips:d quips)
    |=  [=time quip=(unit quip:d)]
    ^-  (unit [id-quip:d rr-quip:d])
    ?~  quip  ~
    %-  some
    [time (di-rr-quip u.quip)]
  ::
  ++  di-rr-quip
    |=  =quip:d
    ^-  rr-quip:d
    :_  +.quip
    [id.quip (reduce-feels:j feels.quip)]
  ::
  ::  emit hark notifications when necessary
  ::
  ++  di-hark
    |=  [=id-note:d =note:d =quip:d]
    ^+  di-core
    ::  checks for comments on our threads. should also check for
    ::  mentions?
    ::
    |^  =/  in-replies
          %+  lien  (tap:on-quips:d quips.note)
          |=  [=time quip=(unit quip:d)]
          ?~  quip  |
          =(author.u.quip our.bowl)
        ?:  |(=(author.quip our.bowl) &(!in-replies !=(author.note our.bowl)))
          di-core
        =/  cs=(list content:ha)
          :~  [%ship author.quip]  ' commented on '
              [%emph title.note]   ': '
              [%ship author.quip]  ': '
              (flatten q.content.quip)
          ==
        %-  emit
        %-  pass-hark
        %^  spin-yarn  [%diary flag]  group.perm.perm.diary
        [/note/(rsh 4 (scot %ui id-note)) cs ~]
    ::
    ++  flatten
      |=  content=(list inline:d)
      ^-  cord
      %-  crip
      %-  zing
      %+  turn
        content
      |=  c=inline:d
      ^-  tape
      ?@  c  (trip c)
      ?-  -.c
          %break  ""
          %tag    (trip p.c)
          %link   (trip q.c)
          %block   (trip q.c)
          ?(%code %inline-code)  ""
          %ship    (scow %p p.c)
          ?(%italics %bold %strike %blockquote)  (trip (flatten p.c))
      ==
    --
  ::
  ::  produce an up-to-date brief
  ::
  ++  di-brief
    ^-  brief:d
    =/  =time
      ?~  tim=(ram:on-notes:d notes.diary)  *time
      key.u.tim
    =/  unreads
      (lot:on-notes:d notes.diary `last-read.remark.diary ~)
    =/  read-id=(unit ^time)
      =/  pried  (pry:on-notes:d unreads)
      ?~  pried  ~
      ?~  val.u.pried  ~
      `id.u.val.u.pried
    =/  count
      %-  lent
      %+  skim  ~(tap by unreads)
      |=  [tim=^time note=(unit note:d)]
      ?&  ?=(^ note)
          !=(author.u.note our.bowl)
      ==
    [time count read-id]
  ::
  ::  handle scries
  ::
  ++  di-peek
    |=  =(pole knot)
    ^-  (unit (unit cage))
    ?+  pole  [~ ~]
        [%notes rest=*]  (di-peek-notes rest.pole)
        [%perm ~]        ``diary-perm+!>(perm.perm.diary)
    ==
  ::
  ++  di-peek-notes
    |=  =(pole knot)
    ^-  (unit (unit cage))
    =*  on   on-notes:d
    ?+    pole  [~ ~]
    ::
        [%newest count=@ mode=?(%outline %note) ~]
      =/  count  (slav %ud count.pole)
      =/  ls    (top:mo-notes:d notes.diary count)
      ?:  =(mode.pole %note)
        ``diary-notes+!>((gas:on *notes:d ls))
      =-  ``diary-outlines+!>(-)
      %+  gas:on:outlines:d  *outlines:d
      %+  murn  ls
      |=  [=time note=(unit note:d)]
      ?~  note  ~
      (some [time (diary-trace:libserver u.note)])
    ::
        [%older start=@ count=@ mode=?(%outline %note) ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %ud start.pole)
      =/  ls    (bat:mo-notes:d notes.diary `start count)
      ?:  =(mode.pole %note)
        ``diary-notes+!>((gas:on *notes:d ls))
      =-  ``diary-outlines+!>(-)
      %+  gas:on:outlines:d  *outlines:d
      %+  murn  ls
      |=  [=time note=(unit note:d)]
      ?~  note  ~
      (some [time (diary-trace:libserver u.note)])
    ::
        [%newer start=@ count=@ ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %ud start.pole)
      ``diary-notes+!>((gas:on *notes:d (tab:on notes.diary `start count)))
    ::
        [%note time=@ ~]
      =/  time  (slav %ud time.pole)
      =/  note  (get:on notes.diary time)
      ?~  note  ~
      ?~  u.note  `~
      ``diary-note+!>((di-rr-note u.u.note))
    ::
        [%note %id time=@ %quips rest=*]
      =/  time  (slav %ud time.pole)
      =/  note  (get:on notes.diary `@da`time)
      ?~  note  ~
      ?~  u.note  `~
      (di-peek-quips quips.u.u.note rest.pole)
    ==
  ::
  ++  di-peek-quips
    |=  [=quips:d =(pole knot)]
    ^-  (unit (unit cage))
    =*  on   on-quips:d
    ?+    pole  [~ ~]
        [%all ~]
      ``diary-quips+!>(quips)
    ::
        [%newest count=@ ~]
      =/  count  (slav %ud count.pole)
      ``diary-quips+!>((gas:on *quips:d (top:mo-quips:d quips count)))
    ::
        [%older start=@ count=@ ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %ud start.pole)
      ``diary-quips+!>((gas:on *quips:d (bat:mo-quips:d quips `start count)))
    ::
        [%newer start=@ count=@ ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %ud start.pole)
      ``diary-quips+!>((gas:on *quips:d (tab:on quips `start count)))
    ::
        [%quip %id time=@ ~]
      =/  time  (slav %ud time.pole)
      =/  quip  (get:on-quips:d quips `@da`time)
      ?~  quip  ~
      ?~  u.quip  `~
      ``quip+!>(u.u.quip)
    ==
  ::
  ::  when we receive an update from the group we're in, check if we
  ::  need to change anything
  ::
  ++  di-recheck
    |=  sects=(set sect:g)
    ::  if our read permissions restored, re-subscribe
    ?:  (di-can-read our.bowl)  di-safe-sub
    di-core
  ::
  ::  scry from groups
  ::
  ++  di-groups-scry
    ^-  path
    =*  group  group.perm.perm.diary
    :-  (scot %p our.bowl)
    /groups/(scot %da now.bowl)/groups/(scot %p p.group)/[q.group]
  ::
  ::  assorted helpers
  ::
  ++  di-from-host  |(=(p.flag src.bowl) =(p.group.perm.perm.diary src.bowl))
  ++  di-can-read
    |=  her=ship
    =/  =path
      %+  welp  di-groups-scry
      /channel/diary/(scot %p p.flag)/[q.flag]/can-read/(scot %p her)/loob
    .^(? %gx path)
  ::
  ::  leave the subscription only
  ::
  ++  di-simple-leave
    (emit %pass di-sub-wire %agent [p.flag dap.bowl] %leave ~)
  ::
  ::  Leave the subscription, tell people about it, and delete our local
  ::  state for the channel
  ::
  ++  di-leave
    =.  di-core  di-simple-leave
    =.  di-core  (di-response %leave ~)
    =.  gone  &
    di-core
  --
::
++  he-core
  |_  [=flag:h =heap:h gone=_|]
  ++  he-core  .
  ++  emit  |=(=card he-core(cor (^emit card)))
  ++  emil  |=(caz=(list card) he-core(cor (^emil caz)))
  ++  give  |=(=gift:agent:gall he-core(cor (^give gift)))
  ++  safe-watch  |=([=wire =dock =path] he-core(cor (^safe-watch +<)))
  ++  he-abet
    %_    cor
        stash
      ?:(gone (~(del by stash) flag) (~(put by stash) flag heap))
    ==
  ::
  ++  he-abed
    |=  f=flag:h
    he-core(flag f, heap (~(got by stash) f))
  ::
  ++  he-area  `path`/heap/(scot %p p.flag)/[q.flag]
  ++  he-sub-wire  `path`/heap/(scot %p p.flag)/[q.flag]/updates
  ++  he-give-brief
    |=  =flag:h
    (give %fact ~[/briefs] heap-brief-update+!>([flag he-brief]))
  ::
  ++  he-response
    |=  =r-heap:h
    =/  =r-stash:h  [flag r-heap]
    (give %fact ~[/ui] %heap-response !>(r-stash))
  ::
  ++  he-create
    |=  create=create-heap:h
    ?>  from-self
    =.  flag  [our.bowl name.create]
    ?<  (~(has by shelf) flag)
    =.  heap  *heap:h
    =.  group.perm.perm.heap  group.create
    =.  last-read.remark.heap  now.bowl
    =/  =cage  [%heap-command !>([%create create])]
    (emit %pass (weld he-area /create) %agent [our.bowl server] %poke cage)
  ::
  ++  he-join
    |=  [f=flag:h group=flag:g]
    ?<  (~(has by stash) flag)
    ?>  |(=(p.group src.bowl) from-self)
    =.  flag  f
    =.  heap  *heap:h
    =.  group.perm.perm.heap  group
    =.  last-read.remark.heap  now.bowl
    =.  he-core  (he-give-brief flag he-brief)
    =.  he-core  (he-response %join group)
    =^  sag=(unit saga:e)  cor  (safe-watch-epic p.flag)
    =?  saga.net.heap  ?=(^ sag)  u.sag
    he-safe-sub
  ::
  ++  he-a-heap
    |=  =a-heap:d
    ?>  from-self
    ?+  -.a-heap  (he-send-command %heap flag a-heap)
      %join   !!  ::  handled elsewhere
      %leave  he-leave
      ?(%read %read-at %watch %unwatch)  (he-a-remark a-heap)
    ==
  ::
  ++  he-a-remark
    |=  a-remark:j
    ^+  he-core
    =.  he-core
      (give %fact ~[(snoc he-area %ui)] heap-response+!>([flag a-remark]))
    =.  remark.heap
      ?-    -.a-remark
          %watch    remark.heap(watching &)
          %unwatch  remark.heap(watching |)
          %read-at  !!
          %read
        =/  [=time curio=(unit curio:h)]  (need (ram:on-curios:h curios.heap))
        remark.heap(last-read `@da`(add time (div ~s1 100)))
      ==
    =.  he-core  he-give-brief
    (he-response a-remark)
  ::
  ++  he-send-command
    |=  =c-heap:h
    ^+  he-core
    ?.  =(src.bowl our.bowl)
      ~|("%heap-action poke failed: only allowed from self" !!)
    =/  =cage  [%heap-command !>(`c-stash:h`[%heap flag c-heap])]
    (emit %pass he-area %agent [p.flag server] %poke cage)
  ::
  ++  he-said
    |=  =id-curio:h
    ^+  he-core
    =.  he-core
      %^  give  %fact  ~
      ?.  (he-can-read src.bowl)  heap-denied+!>(~)
      (heap-said:libserver flag plan curios.heap)
    (give %kick ~ ~)
  ::
  ++  he-upgrade
    ^+  he-core
    ::  if we're ahead or synced, no-op
    ::
    ?.  ?=(%dex -.saga.net.heap)
      he-core
    ::  if we're still behind even with the upgrade, no-op
    ::
    ?.  =(okay:d ver.saga.net.heap)
      ~&  future-shock+[ver.saga.net.heap flag]
      he-core
    ::  safe to sync and resume updates from host
    ::
    =>  .(saga.net.heap `saga:e`saga.net.heap)
    he-make-chi
  ::
  ++  he-take-epic
    |=  her=epic:e
    ^+  he-core
    ?:  (lth her okay:d)  he-make-lev
    ?:  (gth her okay:d)  (he-make-dex her)
    he-make-chi
  ::
  ++  he-make-dex
    |=  her=epic:e
    =.  saga.net.heap  dex+her
    he-simple-leave
  ::
  ++  he-make-lev
    =.  saga.net.heap  lev/~
    he-simple-leave
  ::
  ++  he-make-chi
    =.  saga.net.heap  chi/~
    he-safe-sub
  ::
  ++  he-has-sub
    (~(has by wex.bowl) [he-sub-wire p.flag dap.bowl])
  ::
  ++  he-safe-sub
    ^+  he-core
    ?:  he-has-sub  he-core
    ?.  ?=(%chi -.saga.net.heap)  he-core
    ?^  curios.heap  he-start-updates
    =.  load.net.heap  |
    %^  safe-watch  (weld he-area /checkpoint)  [p.flag server]
    ?.  =(our.bowl p.flag)
      /heap/[q.flag]/checkpoint/before/20
    /heap/[q.flag]/checkpoint/time-range/(scot %da *@da)
  ::
  ++  he-start-updates
    =/  tim=(unit time)
      (bind (ram:on-curios:d curios.heap) head)
    %^  safe-watch  he-sub-wire  [p.flag server]
    /heap/[q.flag]/updates/(scot %da (fall tim *@da))
  ::
  ++  he-agent
    |=  [=wire =sign:agent:gall]
    ^+  he-core
    ?+  wire  ~|(heap-strange-agent-wire+wire !!)
      ~  he-core  :: noop wire, should only send pokes
      [%create ~]       (he-take-create sign)
      [%updates ~]      (he-take-update sign)
      [%checkpoint ~]   (he-take-checkpoint sign)
    ==
  ::
  ++  he-take-create
    |=  =sign:agent:gall
    ^+  he-core
    ?-    -.sign
        %poke-ack
      =+  ?~  p.sign  ~
          %-  (slog leaf+"%heap: Failed creation (poke)" u.p.sign)
          ~
      =/  =path  /heap/[q.flag]/create
      =/  =wire  (weld he-area /create)
      (emit %pass wire %agent [our.bowl server] %watch path)
    ::
        %kick       he-safe-sub
        %watch-ack
      ?~  p.sign  he-core
      %-  (slog leaf+"%heap: Failed creation" u.p.sign)
      he-core
    ::
        %fact
      =*  cage  cage.sign
      ?.  =(%heap-update p.cage)
        ~|(heap-strange-fact+p.cage !!)
      =+  !<(=update:h q.cage)
      =.  he-core  (he-u-shelf update)
      =.  he-core  he-give-brief
      he-safe-sub
    ==
  ::
  ++  he-take-update
    |=  =sign:agent:gall
    ^+  he-core
    ?+    -.sign  he-core
        %kick       he-safe-sub
        %watch-ack
      ?~  p.sign  he-core
      %-  (slog leaf+"%heap: Failed subscription" u.p.sign)
      he-core
    ::
        %fact
      =*  cage  cage.sign
      ?+  p.cage  ~|(heap-strange-fact+p.cage !!)
        %heap-logs    (he-apply-logs !<(log:h q.cage))
        %heap-update  (he-u-stash !<(update:h q.cage))
      ==
    ==
  ::
  ++  he-take-checkpoint
    |=  =sign:agent:gall
    ^+  he-core
    ?+    -.sign  he-core
        %kick       ?:(load.net.heap he-core he-safe-sub)
        %watch-ack
      ?~  p.sign  he-core
      %-  (slog leaf+"%heap: Failed partial checkpoint" u.p.sign)
      he-core
    ::
        %fact
      =*  cage  cage.sign
      ?+    p.cage  ~|(heap-strange-fact+p.cage !!)
          %heap-checkpoint
        (he-ingest-checkpoint !<(u-checkpoint:h q.cage))
      ==
    ==
  ::
  ++  he-ingest-checkpoint
    |=  chk=u-checkpoint:h
    ^+  he-core
    =.  load.net.heap  &
    =^  changed  view.heap  (apply-rev:j view.heap view.chk)
    =?  he-core  changed  (he-response %view view.view.heap)
    =^  changed  perm.heap  (apply-rev:j perm.heap perm.chk)
    =?  he-core  changed  (he-response %perm perm.perm.heap)
    =/  old  curios.heap
    =.  curios.heap
      ((uno:mo-curios:h curios.heap curios.chk) he-apply-unit-curio)
    =?  he-core  !=(old curios.heap)
      %+  he-response  %curios
      %+  gas:rr-on-curios:h  *rr-curios:h
      %+  murn  (turn (tap:on-curios:h curios.chk) head)
      |=  id=id-curio:h
      ^-  (unit [id-curio:h (unit rr-curio:h)])
      =/  curio  (got:on-curios:h curios.heap id)
      =/  old   (get:on-curios:h old id)
      ?:  =(old `curio)  ~
      ?~  curio  (some [id ~])
      (some [id `(he-rr-curio u.curio)])
    =.  he-core  he-start-updates
    =/  wire  (weld he-area /checkpoint)
    (emit %pass wire %agent [p.flag %heap] %leave ~)
  ::
  ++  he-apply-logs
    |=  =log:h
    ^+  he-core
    %+  roll  (tap:log-on:h log)
    |=  [[=time =u-heap:h] he=_he-core]
    (he-u-stash:he time u-heap)
  ::
  ++  he-u-stash
    |=  [=time =u-heap:h]
    ?>  he-from-host
    ^+  he-core
    ?-    -.u-heap
        %create
      ?.  =(0 rev.perm.heap)  he-core
      =.  perm.perm.heap  perm.u-heap
      (he-response %create perm.u-heap)
    ::
        %view
      =^  changed  view.heap  (apply-rev:h view.heap +.u-heap)
      ?.  changed  he-core
      (he-response %view view.view.heap)
    ::
        %perm
      =^  changed  perm.heap  (apply-rev:h perm.heap +.u-heap)
      ?.  changed  he-core
      (he-response %perm perm.perm.heap)
    ::
        %curio
      =/  old  curios.heap
      =.  he-core  (he-u-curio id.u-heap u-curio.u-heap)
      =?  he-core  !=(old curios.heap)  he-give-brief
      he-core
    ==
  ::
  ++  he-u-curio
    |=  [=id-curio:h =u-curio:h]
    ^+  he-core
    =/  curio  (get:on-curios:h curios.heap id-curio)
    ?:  ?=([~ ~] curio)  he-core
    ?:  ?=(%set -.u-curio)
      ?~  curio
        =/  rr-curio=(unit rr-curio:h)  (bind curio.u-curio he-rr-curio)
        =?  he-core  ?=(^ curio.u-curio)
          =.  he-core  (he-hark u.curio.u-curio)
          ?~  replying.u.curio.u-curio
            he-core
          =*  op-id  u.replying.u.curio.u-curio
          =/  op  (get:on-curios:h curios.heap op-id)
          ?~  op    he-core
          ?~  u.op  he-core
          =.  replied.u.u.op  (~(put in replied.u.u.op) id-curio)
          =.  curios.heap  (put:on-curios:h curios.heap op-id u.op)
          he-core
        =.  curios.heap  (put:on-curios:h curios.heap id-curio curio.u-curio)
        (he-response %curio id-curio %set rr-curio)
      ::
      ?~  curio.u-curio
        =.  curios.heap  (put:on-curios:h curios.heap id-curio ~)
        (he-response %curio id-curio %set ~)
      ::
      =*  old  u.u.curio
      =*  new  u.curio.u-curio
      =/  merged  (he-apply-curio id-curio old new)
      ?:  =(merged old)  he-core
      =.  curios.heap  (put:on-curios:h curios.heap id-curio `merged)
      (he-response %curio id-curio %set `(he-rr-curio merged))
    ::
    ?~  note
      he-core
    ::
    ?-    -.u-curio
        %feels
      =/  merged  (apply-feels:j feels.u.u.curio feels.u-curio)
      ?:  =(merged feels.u.u.curio)  he-core
      =.  curios.heap
        (put:on-curios:h curios.heap id-curio `u.u.curio(feels merged))
      (he-response %curio id-curio %feels (reduce-feels:j merged))
    ::
        %heart
      =^  changed  +.u.u.curio  (apply-rev:h +.u.u.curio +.u-curio)
      ?.  changed  he-core
      =.  curios.heap  (put:on-curios:h curios.heap id-curio `u.u.curio)
      (he-response %curio id-curio %heart +>.u.u.curio)
    ==
  ::
  ++  he-apply-unit-curio
    |=  [=id-curio:h old=(unit curio:h) new=(unit curio:h)]
    ^-  (unit curio:h)
    ?~  old  ~
    ?~  new  ~
    `(he-apply-curio id-curio u.old u.new)
  ::
  ++  he-apply-curio
    |=  [=id-curio:h old=curio:h new=curio:h]
    ^-  curio:h
    %_  old
      feels    (apply-feels:j feels.old feels.new)
      replied  (~(uni in replied.old) replied.new)
      +        +:(apply-rev:h +.old +.new)
    ==
  ::
  ++  he-rr-stash
    |=  =stash:h
    ^-  rr-stash:h
    %-  ~(run by stash)
    |=  =heap:h
    ^-  rr-heap:h
    %*  .  *rr-heap:h
      curios  *rr-curios:h
      view    +.view.heap
      perm    +.perm.heap
    ==
  ::
  ++  he-rr-curio
    |=  =curio:h
    ^-  rr-curio:h
    :_  +>.curio
    :+  id.curio
      (reduce-feels:j feels.curio)
    replied.curio
  ::
  ++  he-rr-curio-list
    |=  curios=(list curio:h)
    ^-  curios:h
    %+  gas:on-curios:h  *curios:h
    %+  turn  curios
    |=  [=id-curio:h curio=(unit curio:h)]
    [id-curio (bind curio he-rr-curio)]
  ::
  ++  he-hark
    |=  =curio:h
    |^  ^+  he-core
    ?~  replying.curio  he-core
    =/  op  (get:on-curios:h curios.heap u.replying.curio)
    ?~  op  he-core
    ?~  u.op  he-core
    =/  in-replies
      %+  lien  ~(tap in replied.u.u.op)
      |=  =id-curio:h
      =/  curio  (get:on-curios:h curios.heap id-curio)
      ?~  curio  %.n
      ?~  u.curio  %.n
      =(author.u.u.curio our.bowl)
    =/  content  (trip (flatten q.content.curio))
    =/  title=@t
      ?^  title.curio  u.title.curio
      ?:  (lte (lent content) 80)  (crip content)
      (crip (weld (swag [0 77] content) "..."))
    =/  am-op-author  =(author.u.u.op our.bowl)
    =/  am-author  =(author.curio our.bowl)
    =?  he-core  &(!am-author |(in-replies am-op-author))
      %-  emit
      %-  pass-hark
      %^  spin-yarn  [%heap flag]  group.perm.perm.heap
      :_  ~
      :-  /curio/(rsh 4 (scot %ui u.replying.curio))
      :~  [%ship author.curio]
          ' commented on '
          [%emph title]
          ': '
          [%ship author.curio]
          ': '
          (flatten q.content.curio)
      ==
    he-core
    ::
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
    --
  ::
  ++  he-brief
    ^-  brief:h
    =/  =time
      ?~  tim=(ram:on:curios:h cur)  *time
      key.u.tim
    =/  unreads
      (lot:on:curios:h cur `last-read.remark.heap ~)
    =/  read-id=(unit ^time)
      (bind (pry:on:curios:h unreads) |=([key=@da val=curio:h] time.val))
    =/  count
      %-  lent
      %+  skim  ~(tap by unreads)
      |=  [tim=^time =curio:h]
      !=(author.curio our.bowl)
    [time count read-id]
  ::
  ++  he-peek
    |=  =(pole knot)
    ^-  (unit (unit cage))
    ?+  pole  [~ ~]
        [%curios rest=*]  (he-peek-curios rest.pole)
        [%perm ~]         ``heap-perm+!>(perm.perm.heap)
    ==
  ::
  ++  peek-curios
    |=  =(pole knot)
    ^-  (unit (unit cage))
    =*  on   on:curios:h
    ?+    pole  [~ ~]
    ::
        [%newest count=@ ~]
      =/  count  (slav %ud count.pole)
      ``heap-curios+!>((gas:on *curios:h (top:mope cur count)))
    ::
        [%newest count=@ %blocks ~]
      =/  count  (slav %ud count.pole)
      ``heap-curios+!>((gas:on *curios:h (top:mope blocks-only count)))
    ::
        [%older start=@ count=@ ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %ud start.pole)
      ``heap-curios+!>((gas:on *curios:h (bat:mope cur `start count)))
    ::
        [%older start=@ count=@ %blocks ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %ud start.pole)
      ``heap-curios+!>((gas:on *curios:h (bat:mope blocks-only `start count)))
    ::
        [%newer start=@ count=@ ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %ud start.pole)
      ``heap-curios+!>((gas:on *curios:h (tab:on cur `start count)))
    ::
        [%newer start=@ count=@ %blocks ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %ud start.pole)
      ``heap-curios+!>((gas:on *curios:h (tab:on blocks-only `start count)))
    ::
        [%curio %id time=@ %full ~]
      =/  time          (slav %ud time.pole)
      =/  [* =curio:h]  (got time)
      =-  ``heap-curios+!>(-)
      %+  gas:on  *curios:h
      %+  welp
        ~[[time curio]]
      %+  murn
        ~(tap in replied.curio)
      |=  t=^time
      (get t)
    ::
        [%curio %id time=@ ~]
      ~&  time
      =/  time  (slav %ud time.pole)
      ``curio+!>(+:(got `@da`time))
    ==
  ::
  ++  he-peek-curios
    |=  =(pole knot)
    ^-  (unit (unit cage))
    |^
    =*  on  on-curios:h
    =*  mo  mo-curios:h
    ?+    pole  [~ ~]
        [%newest count=@ ~]
      =/  count  (slav %ud count.pole)
      ``heap-curios+!>((he-rr-curio-list (top:mo curios.heap count)))
    ::
        [%newest count=@ %blocks ~]
      =/  count  (slav %ud count.pole)
      ``heap-curios+!>((he-rr-curio-list (top:mo blocks-only count)))
    ::
        [%older start=@ count=@ ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %ud start.pole)
      ``heap-curios+!>((he-rr-curio-list (bat:mo curios.heap `start count)))
    ::
        [%older start=@ count=@ %blocks ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %ud start.pole)
      ``heap-curios+!>((he-rr-curio-list (bat:mo blocks-only `start count)))
    ::
        [%newer start=@ count=@ ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %ud start.pole)
      ``heap-curios+!>((he-rr-curio-list (tab:mo curios.heap `start count)))
    ::
        [%newer start=@ count=@ %blocks ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %ud start.pole)
      ``heap-curios+!>((he-rr-curio-list (tab:mo blocks-only `start count)))
    ::
        [%curio %id time=@ %full ~]
      =/  =id-curio:h  (slav %ud time.pole)
      =/  curio  (get:on id-curio)
      ?~  curio  ~
      ?~  u.curio  `~
      =-  ``heap-curios+!>(-)
      %-  he-rr-curio-list
      %+  welp
        ~[[id-curio u.u.curio]]
      %+  murn
        ~(tap in replied.curio)
      |=  i=id-curio:h
      =/  c  (get:on i)
      ?~  c  ~
      ?~  u.c  ~
      (some u.u.c)
    ::
        [%curio %id time=@ ~]
      =/  =id-curio:h  (slav %ud time.pole)
      ``curio+!>((need (need (get:on id-curio))))
    ==
    ::
    ++  blocks-only
      ^-  curios:h
      =-  +:-
      %^  (dip:on-curios:h @)  cur  ~
      |=  [st=@ =time =curio:h]
      :_  [%.n st]
      ?^  replying.curio  ~
      `curio
    --
  ::
  ++  he-recheck
    |=  sects=(set sect:g)
    ::  if our read permissions restored, re-subscribe
    ?:  (he-can-read our.bowl)  he-safe-sub
    he-core
  ::
  ++  he-groups-scry
    ^-  path
    =*  group  group.perm.perm.heap
    :-  (scot %p our.bowl)
    /groups/(scot %da now.bowl)/groups/(scot %p p.group)/[q.group]
  ::
  ++  he-from-host  |(=(p.flag src.bowl) =(p.group.perm.perm.heap src.bowl))
  ++  he-can-read
    |=  her=ship
    =/  =path
      %+  welp  he-groups-scry
      /channel/heap/(scot %p p.flag)/[q.flag]/can-read/(scot %p her)/loob
    .^(? %gx path)
  ::
  ++  he-simple-leave
    (emit %pass he-sub-wire %agent [p.flag dap.bowl] %leave ~)
  ::
  ++  he-leave
    =.  he-core  he-simple-leave
    =.  he-core  (he-response %leave ~)
    =.  gone  &
    he-core
  --
--

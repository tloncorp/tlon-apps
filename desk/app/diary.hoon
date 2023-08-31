::  TODO: refactor initial subscription to actually fetch by notes
::  TODO: listen to groups to join channel
::
/-  d=diary, g=groups, ha=hark
/-  meta
/-  e=epic
/+  default-agent, verb, dbug, sparse
/+  epos-lib=saga
/+  diary-load, libnotes=notes
::  performance, keep warm
/+  diary-json
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  current-state
    $:  %2
        =shelf:d
        voc=(map [flag:d plan:d] (unit said:d))
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
  =.  state  (diary-load vase)
  =.  cor  inflate-io
  (give %fact ~[/epic] epic+!>(okay:d))
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
          [%diary @ @ %updates ~]
        ?.  =(%diary-server dude)  |
        ?.  =((scot %p ship) i.t.wire)  |
        =*  qflag  i.t.t.wire
        ?~  diary=(~(get by shelf) ship qflag)  |
        ?.  ?=(%chi -.saga.net.u.diary)  |
        ?.  ?=([%diary @ %updates ?(~ [@ ~])] path)  |
        =(qflag i.t.path)
      ::
          [%diary @ @ %checkpoint ~]
        ?.  =(%diary-server dude)  |
        ?.  =((scot %p ship) i.t.wire)  |
        =*  qflag  i.t.t.wire
        ?~  diary=(~(get by shelf) ship qflag)  |
        ?.  ?=(%chi -.saga.net.u.diary)  |
        ?.  ?=([%diary @ %checkpoint %before @] path)  |
        =(qflag i.t.path)
      ::
          [%said @ @ %note @ ?(~ [@ ~])]
        ?.  =(%diary-server dude)  |       :: maybe %diary ?
        ?.  =((scot %p ship) i.t.wire)  |  :: ?
        =*  qflag  i.t.t.wire
        ?~  pplan=(slaw %ud i.t.t.t.t.wire)  |
        =/  qplan=(unit (unit time))
          ?~  t.t.t.t.t.wire  `~
          ?~  q=(slaw %ud i.t.t.t.t.t.wire)  ~
          ``u.q
        ?~  qplan  |
        ?.  (~(has by voc) [ship qflag] u.pplan u.qplan)  |
        =(wire path)
      ==
    ?:  keep  cor
    (emit %pass wire %agent [ship dude] %leave ~)
  ::
  ::  watch all the subscriptions we expect to have
  ::
  =.  cor  watch-groups
  =/  diaries  ~(tap in ~(key by shelf))
  =.  cor
    %+  roll
      ~(tap in (~(gas in *(set ship)) (turn diaries head)))
    |=  [=ship cr=_cor]
    ?:  =(ship our.bowl)  cr
    (watch-epic:cr ship)
  ::
  =.  cor
    %+  roll
      ~(tap by shelf)
    |=  [[=flag:d *] core=_cor]
    di-abet:di-safe-sub:(di-abed:di-core:core flag)
  ::
  =.  cor
    |-
    ?~  diaries
      cor
    =.  cor  di-abet:di-upgrade:(di-abed:di-core i.diaries)
    $(diaries t.diaries)
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
      %diary-migrate
    migrate
  ==
::
++  watch
  |=  =(pole knot)
  ^+  cor
  ?+    pole  ~|(bad-watch-path/pole !!)
      [%briefs ~]  ?>(from-self cor)
      [%ui ~]      ?>(from-self cor)
      [%imp ~]      ?>(from-self cor)
    ::
      [%epic ~]    (give %fact ~ epic+!>(okay:d))
    ::
      [%diary ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    ?>  =(our.bowl ship)
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
    =/  wire  (said-wire flag plan)
    (safe-watch wire [p.flag server] wire)
  di-abet:(di-said:(di-abed:di-core flag) plan)
::
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
    (give %kick ~[wire] ~)
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
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+    pole  ~|(bad-agent-wire/pole !!)
      ~          cor
      [%epic ~]  (take-epic sign)
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
        %kick       watch-groups
        %watch-ack
      ?~  p.sign
        cor
      =/  =tank
        leaf/"Failed groups subscription in {<dap.bowl>}, unexpected"
      ((slog tank u.p.sign) cor)
    ::
        %fact
      ?.  =(act:mar:g p.cage.sign)  cor
      (take-groups !<(=action:g q.cage.sign))
    ==
  ::
      [%migrate ~]
    ?+  -.sign  !!
        %poke-ack
      ?~  p.sign
        cor
      %-  (slog 'diary: migration poke failure' >wire< u.p.sign)
      cor
    ==
  ==
::
++  watch-groups  (safe-watch /groups [our.bowl %groups] /groups)
++  watch-epic
  |=  her=ship
  (safe-watch /epic [her server] /epic)
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
++  take-groups
  |=  =action:g
  =/  affected=(list flag:d)
    %+  murn  ~(tap by shelf)
    |=  [=flag:d =diary:d]
    ?.  =(p.action group.perm.perm.diary)  ~
    `flag
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
  |=  [affected=(list flag:d) sects=(set sect:g)]
  ~&  "%diary-server recheck permissions for {<affected>}"
  %+  roll  affected
  |=  [=flag:d co=_cor]
  =/  di  (di-abed:di-core:co flag)
  di-abet:(di-recheck:di sects)
::
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+    pole  [~ ~]
      [%x %shelf ~]  ``shelf+!>((di-rr-shelf:di-core shelf))
      [%x %init ~]   ``noun+!>([briefs (di-rr-shelf:di-core shelf)])
      [%x %briefs ~]  ``diary-briefs+!>(briefs)
      [%x %diary ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    (di-peek:(di-abed:di-core ship name.pole) rest.pole)
  ::
      [%u %diary ship=@ name=@ ~]
    =/  =ship  (slav %p ship.pole)
    ``loob+!>((~(has by shelf) [ship name.pole]))
  ==
::
++  briefs
  ^-  briefs:d
  %-  ~(gas by *briefs:d)
  %+  turn  ~(tap in ~(key by shelf))
  |=  =flag:d
  :-  flag
  di-brief:(di-abed:di-core flag)
::
++  give-brief
  |=  [=flag:d =brief:briefs:d]
  (give %fact ~[/briefs] diary-brief-update+!>([flag brief]))
::
++  pass-hark
  |=  =new-yarn:ha
  ^-  card
  =/  =cage  hark-action-1+!>([%new-yarn new-yarn])
  [%pass /hark %agent [our.bowl %hark] %poke cage]
::
++  from-self  =(our src):bowl
::
++  migrate
  =/  server-shelf=shelf:d
    %-  ~(gas by *shelf:d)
    %+  skim  ~(tap by shelf)
    |=  [=flag:d =diary:d]
    ^-  ?
    =(our.bowl p.flag)
  =/  =cage  [%diary-migration !>(server-shelf)]
  (emit %pass /migrate %agent [our.bowl server] %poke cage)
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
  ++  di-abed
    |=  f=flag:d
    di-core(flag f, diary (~(got by shelf) f))
  ::
  ++  di-area  `path`/diary/(scot %p p.flag)/[q.flag]
  ++  di-sub-wire  `path`/diary/(scot %p p.flag)/[q.flag]/updates
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
    =.  cor  (give-brief flag di-brief)
    =.  di-core  (di-response %join group)
    =.  di-core
      =/  diaries=(list [fl=flag:d di=diary:d])  ~(tap by shelf)
      |-
      ?~  diaries  di-core(cor (watch-epic p.flag))
      ?:  !=(p.fl.i.diaries p.flag)  $(diaries t.diaries)
      di-core(saga.net.diary saga.net.di.i.diaries)
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
    ?+  -.a-diary  (di-send-command [%diary flag a-diary])
      %join       !!  ::  handled elsewhere
      %leave      di-leave
      ?(%read %read-at %watch %unwatch)  (di-a-remark a-diary)
    ==
  ::
  ++  di-a-remark
    |=  =a-remark:d
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
        remark.diary(last-read `@da`(add time (div ~s1 100)))  ::  greater than last
      ==
    =.  cor  (give-brief flag di-brief)
    (di-response a-remark)
  ::
  ::  proxy command to host
  ::
  ++  di-send-command
    |=  command=c-shelf:d
    ^+  di-core
    ?>  ?=(%diary -.command)
    ::  don't allow anyone else to proxy through us
    ?.  =(src.bowl our.bowl)
      ~|("%diary-action poke failed: only allowed from self" !!)
    =/  =cage  [%diary-command !>(command)]
    (emit %pass di-area %agent [p.flag.command server] %poke cage)
  ::
  ::  handle a said (previews) request where we have the data to respond
  ::
  ++  di-said
    |=  =plan:d
    ^+  di-core
    =.  di-core
      %^  give  %fact  ~
      ?.  (di-can-read src.bowl)
        diary-denied+!>(~)
      (said:libnotes flag plan notes.diary)
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
      ~&  future-shock/[ver.saga.net.diary flag]
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
    =.  saga.net.diary  lev/~
    di-simple-leave
  ::
  ++  di-make-chi
    =.  saga.net.diary  chi/~
    di-safe-sub
  ::
  ++  di-has-sub
    ^-  ?
    (~(has by wex.bowl) [di-sub-wire p.flag dap.bowl])
  ::
  ++  di-safe-sub
    ?:  di-has-sub  di-core
    ?.  ?=(%chi -.saga.net.diary)  di-core
    ?^  notes.diary  di-start-updates
    =.  load.net.diary  |
    %^  safe-watch  (weld di-area /checkpoint)  [p.flag server]
    ::  ?.  =(our.bowl p.flag)
      /diary/[q.flag]/checkpoint/before/20
    ::  /diary/[q.flag]/checkpoint/time-range/(scot %da *@da)
  ::
  ++  di-start-updates
    ::  not most optimal time, should maintain last heard time instead
    =/  tim=(unit time)
      (bind (ram:on-notes:d notes.diary) head)
    %^  safe-watch  di-sub-wire  [p.flag server]
    /diary/[q.flag]/updates/(scot %da (fall tim *@da))
  ::
  ++  di-watch
    |=  =path
    ^+  di-core
    ?+    path  !!
      [%ui ~]         ?>(from-self di-core)
      [%ui %notes ~]  ?>(from-self di-core)
    ==
  ::
  ++  di-agent
    |=  [=wire =sign:agent:gall]
    ^+  di-core
    ?+    wire  ~|(diary-strange-agent-wire+wire !!)
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
          %-  (slog leaf+"{<dap.bowl>}: Failed creation (poke)" u.p.sign)
          ~
      =/  =path  /diary/[q.flag]/create
      =/  =wire  (weld di-area /create)
      (emit %pass wire %agent [our.bowl server] %watch path)
    ::
        %kick       di-safe-sub
        %watch-ack
      ?~  p.sign  di-core
      %-  (slog leaf+"{<dap.bowl>}: Failed creation" u.p.sign)
      di-core
    ::
        %fact
      =*  cage  cage.sign
      ?.  =(%diary-update p.cage)
        ~|(diary-strange-fact+p.cage !!)
      =+  !<(=update:d q.cage)
      =.  di-core  (di-u-shelf update)
      =.  cor  (give-brief flag di-brief)
      di-safe-sub
    ==
  ::
  ++  di-take-update
    |=  =sign:agent:gall
    ^+  di-core
    ?+    -.sign  di-core
        %kick       di-safe-sub
        %watch-ack
      =.  net.diary  [src.bowl & [%chi ~]]
      ?~  p.sign  di-core
      %-  (slog leaf/"{<dap.bowl>}: Failed subscription" u.p.sign)
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
      =.  net.diary  [src.bowl & [%chi ~]]
      ?~  p.sign  di-core
      %-  (slog leaf/"{<dap.bowl>}: Failed partial checkpoint" u.p.sign)
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
    =^  changed  sort.diary  (apply-rev:d sort.diary sort.chk)
    =?  di-core  changed  (di-response %sort sort.sort.diary)
    =^  changed  view.diary  (apply-rev:d view.diary view.chk)
    =?  di-core  changed  (di-response %view view.view.diary)
    =^  changed  perm.diary  (apply-rev:d perm.diary perm.chk)
    =?  di-core  changed  (di-response %perm perm.perm.diary)
    =^  changed  order.diary  (apply-rev:d order.diary order.chk)
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
      =^  changed  order.diary  (apply-rev:d order.diary +.u-diary)
      ?.  changed  di-core
      (di-response %order order.order.diary)
    ::
        %view
      =^  changed  view.diary  (apply-rev:d view.diary +.u-diary)
      ?.  changed  di-core
      (di-response %view view.view.diary)
    ::
        %sort
      =^  changed  sort.diary  (apply-rev:d sort.diary +.u-diary)
      ?.  changed  di-core
      (di-response %sort sort.sort.diary)
    ::
        %perm
      =^  changed  perm.diary  (apply-rev:d perm.diary +.u-diary)
      ?.  changed  di-core
      (di-response %perm perm.perm.diary)
    ::
        %note
      =/  old  notes.diary
      =.  di-core  (di-u-note id.u-diary u-note.u-diary)
      =?  cor  !=(old notes.diary)  (give-brief flag di-brief)
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
      =/  merged  (di-apply-feels feels.u.u.note feels.u-note)
      ?:  =(merged feels.u.u.note)  di-core
      =.  notes.diary
        (put:on-notes:d notes.diary id-note `u.u.note(feels merged))
      (di-response %note id-note %feels (di-rr-feels merged))
    ::
        %essay
      =^  changed  +.u.u.note  (apply-rev:d +.u.u.note +.u-note)
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
    =/  merged  (di-apply-feels feels.u.u.quip feels.u-quip)
    ?:  =(merged feels.u.u.quip)  di-core
    =.  di-core  (di-put-quip id-note id-quip `u.u.quip(feels merged))
    (di-response %note id-note %quip id-quip %feels (di-rr-feels merged))
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
      feels  (di-apply-feels feels.old feels.new)
      +      +:(apply-rev:d +.old +.new)
    ==
  ::
  ++  di-apply-feels
    |=  [old=feels:d new=feels:d]
    ^-  feels:d
    %-  (~(uno by old) new)
    |=  [* a=(rev:d (unit feel:d)) b=(rev:d (unit feel:d))]
    +:(apply-rev:d a b)
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
      feels  (di-apply-feels feels.u.old feels.u.new)
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
  ++  di-rr-notes
    |=  =notes:d
    ^-  rr-notes:d
    %+  gas:rr-on-notes:d  *rr-notes:d
    %+  turn  (tap:on-notes:d notes)
    |=  [=id-note:d note=(unit note:d)]
    ^-  [id-note:d (unit rr-note:d)]
    [id-note ?~(note ~ `(di-rr-note u.note))]
  ::
  ++  di-rr-note
    |=  =note:d
    ^-  rr-note:d
    :_  +>.note
    :+  id.note
      (di-rr-quips quips.note)
    (di-rr-feels feels.note)
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
    [id.quip (di-rr-feels feels.quip)]
  ::
  ++  di-rr-feels
    |=  =feels:d
    ^-  (map ship feel:d)
    %-  ~(gas by *(map ship feel:d))
    %+  murn  ~(tap by feels)
    |=  [=ship (rev:d feel=(unit feel:d))]
    ?~  feel  ~
    (some ship u.feel)
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
        (emit (pass-hark (di-spin /note/(rsh 4 (scot %ui id-note)) cs ~)))
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
  ::  convert content into a full yarn suitable for hark
  ::
  ++  di-spin
    |=  [rest=path con=(list content:ha) but=(unit button:ha)]
    ^-  new-yarn:ha
    =*  group  group.perm.perm.diary
    =/  =nest:g  [dap.bowl flag]
    =/  rope  [`group `nest q.byk.bowl (welp /(scot %p p.flag)/[q.flag] rest)]
    =/  link
      (welp /groups/(scot %p p.group)/[q.group]/channels/diary/(scot %p p.flag)/[q.flag] rest)
    [& & rope con link but]
  ::
  ::  give a "response" to our subscribers
  ::
  ++  di-response
    |=  =r-diary:d
    =/  =r-shelf:d  [flag r-diary]
    (give %fact ~[/ui] %diary-response !>(r-shelf))
  ::
  ::  produce an up-to-date brief
  ::
  ++  di-brief
    ^-  brief:briefs:d
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
      (some [time (trace:libnotes u.note)])
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
      (some [time (trace:libnotes u.note)])
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
    /(scot %p our.bowl)/groups/(scot %da now.bowl)/groups/(scot %p p.group)/[q.group]
  ::
  ::  assorted helpers
  ::
  ++  di-from-admin
    ?:  =(p.flag src.bowl)  &
    .^  admin=?
    ;:  weld
        /gx
        di-groups-scry
        /channel/[dap.bowl]/(scot %p p.flag)/[q.flag]
        /fleet/(scot %p src.bowl)/is-bloc/loob
    ==  ==
  ::
  ++  di-from-host  |(=(p.flag src.bowl) =(p.group.perm.perm.diary src.bowl))
  ++  di-can-write
    ?:  =(p.flag src.bowl)  &
    =/  =path
      %+  welp  di-groups-scry
      /channel/[dap.bowl]/(scot %p p.flag)/[q.flag]/can-write/(scot %p src.bowl)/noun
    =+  .^(write=(unit [bloc=? sects=(set sect:g)]) %gx path)
    ?~  write  |
    =/  perms  (need write)
    ?:  |(bloc.perms =(~ writers.perm.perm.diary))  &
    !=(~ (~(int in writers.perm.perm.diary) sects.perms))
  ::
  ++  di-can-read
    |=  her=ship
    =/  =path
      %+  welp  di-groups-scry
      /channel/[dap.bowl]/(scot %p p.flag)/[q.flag]/can-read/(scot %p her)/loob
    .^(? %gx path)
  ::
  ::  leave the subscription only
  ::
  ++  di-simple-leave
    =/  =wire  di-sub-wire
    (emit %pass wire %agent [p.flag dap.bowl] %leave ~)
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
--

/-  d=diary, g=groups, ha=hark
/-  meta
/-  e=epic
/+  default-agent, verb, dbug, sparse
/+  not=notes
/+  qup=quips
/+  epos-lib=saga
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
      abet:init:cor
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
+*  epos  ~(. epos-lib [bowl %diary-update okay:d])
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  init
  ^+  cor
  watch-groups
++  load
  |=  =vase
  |^  ^+  cor
  =+  !<([old=versioned-state cool=epic:e] vase)
  |-
  ?-  -.old
    %0  $(old (state-0-to-1 old))
    %1  $(old (state-1-to-2 old))
    ::
      %2
    =.  state  old
    =.  cor  restore-missing-subs
    =.  cor
      (emil (drop load:epos))
    =/  diaries  ~(tap in ~(key by shelf))
    =.  cor
      %+  roll
        ~(tap in (~(gas in *(set ship)) (turn diaries head)))
      |=  [=ship cr=_cor]
      ?:  =(ship our.bowl)  cr
      (watch-epic:cr ship &)
    |-
    ?~  diaries
      cor
    =.  cor  di-abet:di-upgrade:(di-abed:di-core i.diaries)
    $(diaries t.diaries)
  ==
  ::
  +$  versioned-state  $%(current-state state-0 state-1)
  +$  state-0
    $:  %0
        shelf=shelf:zero
        voc=(map [flag:zero plan:zero] (unit said:zero))
        imp=(map flag:zero ?)
    ==
  +$  state-1
    $:  %1
        =shelf:one
        voc=(map [flag:one plan:one] (unit said:one))
        imp=(map flag:one ?)
    ==
  +$  state-2  current-state
  ++  zero  zero:old:d
  ++  one   one:old:d
  ++  two   d
  ++  state-0-to-1
    |=  s=state-0
    ^-  state-1
    %*  .  *state-1
      shelf  (shelf-0-to-1 shelf.s)
      voc    voc.s
      imp    imp.s
    ==
  ::
  ++  shelf-0-to-1
    |=  old-shelf=shelf:zero
    ^-  shelf:one
    %-  malt
    %+  turn
      ~(tap by old-shelf)
    |=  [=flag:one old-diary=diary:zero]
    ^-  [flag:one diary:one]
    [flag [~ old-diary]]
  ::
  ++  state-1-to-2
    |=  s=state-1
    ^-  state-2
    %*  .  *state-2
      shelf  (shelf-1-to-2 shelf.s)
      voc    voc.s
    ==
  ::
  ++  shelf-1-to-2
    |=  old-shelf=shelf:one
    ^-  shelf:two
    %-  ~(run by old-shelf)
    |=  =diary:one
    ^-  diary:two
    diary(log (log-1-to-2))
  ::
  ++  log-1-to-2
    |=  old-log=log:one
    ^-  log:two
    %-  ~(run by old-log)
    |=  =diff:one
    ^-  diff:two
    ?+  -.diff  diff
      %arranged-notes  [%order +.diff]
      %add-sects  [%add-writers +.diff]
      %del-sects  [%del-writers +.diff]
      %create  [%create [group.p.diff '' '' ~ writers.p.diff]]
    ==
  ::
  ++  restore-missing-subs
    %+  roll
      ~(tap by shelf)
    |=  [[=flag:d *] core=_cor]
    di-abet:di-safe-sub:(di-abed:di-core:core flag)
  --
::
++  watch-epic
  |=  [her=ship leave=?]
  ^+  cor
  =/  =wire  /epic
  =/  =dock  [her dap.bowl]
  =?  cor  leave  (emit %pass wire %agent dock %leave ~)
  (emit %pass wire %agent dock %watch /epic)
::
++  take-epic
  |=  =sign:agent:gall
  ^+  cor
  ?+    -.sign  cor
      %kick
    (watch-epic src.bowl |)
  ::
      %fact
    ?.  =(%epic p.cage.sign)
      ~&  '!!! weird fact on /epic'
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
++  watch-groups
  ^+  cor
  (emit %pass /groups %agent [our.bowl %groups] %watch /groups)
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
    =+  !<([=flag:d =action:d] vase)
    =/  diary-core
      ?:  ?=(?(%join %create) -.action)
        (di-apex:di-core flag)
      (di-abed:di-core flag)
    di-abet:(di-action:diary-core action)
  ::
      %diary-command
    =+  !<([=flag:d =command:d] vase)
    =/  diary-core  (di-abed:di-core flag)
    di-abet:(di-command:diary-core command)
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
    ?>  =(our ship)
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
       (give %fact ~ epic+!>(okay:d))
      =/  =tank
        leaf/"Failed groups subscription in {<dap.bowl>}, unexpected"
      ((slog tank u.p.sign) cor)
    ::
        %fact
      ?.  =(act:mar:g p.cage.sign)  cor
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
  =/  diff  q.q.action
  ?+  diff  cor
      [%fleet * %del ~]
    ~&  "%diary: revoke perms for {<affected>}"
    %+  roll  affected
    |=  [=flag:d co=_cor]
    ^+  cor
    %+  roll  ~(tap in p.diff)
    |=  [=ship ci=_cor]
    ^+  cor
    =/  di  (di-abed:di-core:ci flag)
    di-abet:(di-revoke:di ship)
  ::
    [%fleet * %add-sects *]    (recheck-perms affected ~)
    [%fleet * %del-sects *]    (recheck-perms affected ~)
    [%channel * %edit *]       (recheck-perms affected ~)
    [%channel * %del-sects *]  (recheck-perms affected ~)
    [%channel * %add-sects *]  (recheck-perms affected ~)
  ::
      [%cabal * %del *]
    =/  =sect:g  (slav %tas p.diff)
    %+  recheck-perms  affected
    (~(gas in *(set sect:g)) ~[p.diff])
  ==
::
++  recheck-perms
  |=  [affected=(list flag:d) sects=(set sect:g)]
  ~&  "%diary recheck permissions for {<affected>}"
  %+  roll  affected
  |=  [=flag:d co=_cor]
  =/  di  (di-abed:di-core:co flag)
  di-abet:(di-recheck:di sects)
++  arvo
  |=  [=wire sign=sign-arvo]
  ^+  cor
  ~&  arvo/wire
  cor
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+  pole  [~ ~]
  ::
    [%x %shelf ~]  ``shelf+!>(shelf)
    [%x %init ~]   ``noun+!>([briefs shelf])
    [%x %briefs ~]  ``diary-briefs+!>(briefs)
  ::
      [%x %diary ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    (di-peek:(di-abed:di-core ship name.pole) rest.pole)
    ::
      [%u %diary ship=@ name=@ ~]
    =/  =ship  (slav %p ship.pole)
    ``loob+!>((~(has by shelf) [ship name.pole]))
  ::
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
  =/  =wire  /hark
  =/  =dock  [our.bowl %hark]
  =/  =cage  hark-action-1+!>([%new-yarn new-yarn])
  [%pass wire %agent dock %poke cage]
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
  ++  di-apex
    |=  f=flag:d
    di-core(flag f, diary (~(gut by shelf) f *diary:d))
  ++  di-area  `path`/diary/(scot %p p.flag)/[q.flag]
  ++  di-action
    |=  =action:d
    ?>  from-self
    ?+  -.action  (di-send-command action)
      %create     (di-create create.action)
      %join       (di-join group.action)
      %leave      di-leave
      ?(%read %read-at %watch %unwatch)  (di-remark action)
    ==
  ::
  ++  di-send-command
    |=  =command:d
    ^+  di-core
    ::  don't allow anyone else to proxy through us
    ?.  =(src.bowl our.bowl)
      ~|("%diary-action poke failed: only allowed from self" !!)
    ?:  di-am-host
      (di-command command)
    =/  =dock  [p.flag dap.bowl]
    =/  =cage  [cmd:mar:d !>([flag command])]
    =.  cor  (emit %pass di-area %agent dock %poke cage)
    di-core
  ::
  ++  di-command
    |=  =command:d
    ^+  di-core
    =;  new=_di-core
      =.  di-core  new
      ::  if the changes succeeded,
      ::  we must update the log and send subscription updates
      ::
      =/  =update:d  [now.bowl command]
      =.  log.diary  (put:log-on:d log.diary update)
      =.  di-core  (di-give-ui update)
      (di-give-updates update)
    ::  only accept commands for diaries we own
    ::
    ?>  di-am-host
    ?-  -.command
      %view   ?>(di-from-admin di-core(view.diary view.command))
      %sort   ?>(di-from-admin di-core(sort.diary sort.command))
      %order  ?>(di-from-admin di-core(arranged-notes.diary notes.command))
    ::
        %notes
      ?>  di-can-write
      ?>  (di-check-ownership +.command)
      =.  notes.diary  (reduce:di-notes now.bowl +.command)
      =.  cor  (give-brief flag di-brief)
      =/  cons=(list (list content:ha))
        (hark:di-notes our.bowl +.command)
      =.  cor
        %-  emil
        %+  turn  cons
        |=  cs=(list content:ha)
        (pass-hark (di-spin /note/(rsh 4 (scot %ui id.command)) cs ~))
      di-core
    ::
        ?(%add-writers %del-writers)
      ?>  di-from-admin
      =*  writers  writers.perm.diary
      =.  writers
        ?-  -.command
          %add-writers  (~(uni in writers) sects.command)
          %del-writers  (~(dif in writers) sects.command)
        ==
      di-core
    ==
  ::
  ++  di-spin
    |=  [rest=path con=(list content:ha) but=(unit button:ha)]
    ^-  new-yarn:ha
    =*  group  group.perm.diary
    =/  =nest:g  [dap.bowl flag]
    =/  rope  [`group `nest q.byk.bowl (welp /(scot %p p.flag)/[q.flag] rest)]
    =/  link
      (welp /groups/(scot %p p.group)/[q.group]/channels/diary/(scot %p p.flag)/[q.flag] rest)
    [& & rope con link but]
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
  ::  when we get a new %diary agent update, we need to check if we should
  ::  upgrade any lagging diaries. if we're lagging, we need to change
  ::  the saga to "chi" to resume syncing updates from the host. otherwise
  ::  we can no-op, because we're not in sync yet.
  ::
  ++  di-upgrade
    ^+  di-core
    ::  if we're the host, no-op
    ::
    ?.  ?=(%sub -.net.diary)
      di-core
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
  ++  di-make-dex
    |=  her=epic:e
    ?.  ?=(%sub -.net.diary)
      di-core
    =.  saga.net.diary  dex+her
    di-core
  ::
  ++  di-make-lev
    ?.  ?=(%sub -.net.diary)
      di-core
    =.  saga.net.diary  lev/~
    di-core
  ::
  ++  di-make-chi
    ?.  ?=(%sub -.net.diary)
      di-core
    =.  saga.net.diary  chi/~
    di-safe-sub
  ::
  ++  di-has-sub
    ^-  ?
    (~(has by wex.bowl) [(snoc di-area %updates) p.flag dap.bowl])
  ::
  ++  di-safe-sub
    ?:  |(di-has-sub di-am-host)
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
  ++  di-create-channel
    |=  create:d
    ^+  di-core
    =/  =channel:g  [[title description '' ''] now.bowl %default | readers]
    =/  =action:g   [group now.bowl %channel [dap.bowl flag] %add channel]
    =/  =dock       [our.bowl %groups]
    =/  =wire       (snoc di-area %create)
    =.  cor  (emit %pass wire %agent dock %poke act:mar:g !>(action))
    di-core
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
    |=  [[=ship =path] di=_di-core]
    ?.  =(ship her)  di
    di(cor (emit %give %kick ~[path] `ship))
  ::
  ++  di-recheck
    |=  sects=(set sect:g)
    ::  if we have sects, we need to delete them from writers
    =?  cor  &(!=(sects ~) =(p.flag our.bowl))
      =/  =cage  [act:mar:d !>([flag now.bowl %del-sects sects])]
      (emit %pass di-area %agent [our.bowl dap.bowl] %poke cage)
    ::  if our read permissions restored, re-subscribe
    =?  di-core  (di-can-read our.bowl)  di-safe-sub
    ::  if subs read permissions removed, kick
    %+  roll  ~(tap in di-subscriptions)
    |=  [[=ship =path] di=_di-core]
    ?:  (di-can-read:di ship)  di
    di(cor (emit %give %kick ~[path] `ship))
  ::
  ++  di-take-epic
    |=  her=epic:e
    ^+  di-core
    ?:  (lth her okay:d)  di-make-lev
    ?:  (gth her okay:d)  (di-make-dex her)
    di-make-chi
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
      %-  (slog leaf/"{<dap.bowl>}: Failed subscription" u.p.sign)
      ~&  'diary watch ack done'
      di-core
    ::
        %fact
      =*  cage  cage.sign
      ?+  p.cage  (di-odd-update p.cage)
        %epic                             (di-take-epic !<(epic:e q.cage))
        ?(%diary-logs %diary-logs-0 %diary-logs-1)      (di-apply-logs !<(log:d q.cage))
        ?(%diary-update %diary-update-0 %diary-update-1)  (di-apply-update !<(update:d q.cage))
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
  ++  di-groups-scry
    ^-  path
    =*  group  group.perm.diary
    /(scot %p our.bowl)/groups/(scot %da now.bowl)/groups/(scot %p p.group)/[q.group]
  ::
  ++  di-am-host  =(our.bowl p.flag)
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
  ++  di-from-host  |(=(p.flag src.bowl) =(p.group.perm.diary src.bowl))
  ++  di-can-write
    ?:  =(p.flag src.bowl)  &
    =/  =path
      %+  welp  di-groups-scry
      /channel/[dap.bowl]/(scot %p p.flag)/[q.flag]/can-write/(scot %p src.bowl)/noun
    =+  .^(write=(unit [bloc=? sects=(set sect:g)]) %gx path)
    ?~  write  |
    =/  perms  (need write)
    ?:  |(bloc.perms =(~ writers.perm.diary))  &
    !=(~ (~(int in writers.perm.diary) sects.perms))
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
    =.  cor  (give %fact ~ log:mar:d !>(log))
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
  ++  di-create
    |=  =create:d
    |^  ^+  di-core
    ~_  leaf+"Create failed: check group permissions"
    ?>  can-nest
    ?>  di-am-host
    ?>  ((sane %tas) p.flag)
    =.  perm.diary  [writers.create group.create]
    =.  net.diary  [%pub ~]
    =.  cor  (give-brief flag di-brief)
    =.  di-core  (di-apply-update now.bowl %create create)
    (di-create-channel create)
    ::  +can-nest: does group exist, are we allowed
    ::
    ++  can-nest
      ^-  ?
      =/  gop  (~(got by groups) group.create)
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
  ::
  ++  di-join
    |=  group=flag:d
    ^+  di-core
    ?<  (~(has by shelf) flag)
    ?>  |(=(p.group src.bowl) =(src.bowl our.bowl))
    =.  group.perm.diary  group
    =.  last-read.remark.diary  now.bowl
    =.  cor  (give-brief flag di-brief)
    =.  cor  (watch-epic p.flag &)
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
    (di-apply-update:di update)
  ::
  ++  di-subscriptions
    %+  roll  ~(val by sup.bowl)
    |=  [[=ship =path] out=(set [ship path])]
    ?.  =((scag 4 path) (snoc di-area %updates))
      out
    (~(put in out) [ship path])
  ::
  ++  di-give-ui
    |=  =update:d
    |^  
    =/  =response:d
      ?-  -.diff.update
          %order  [%order order.diff.update]
          %view   [%view view.diff.update]
          %sort   [%sort sort.diff.update]
          %perm   [%perm perm.diff.update]
          %notes
        :+  %notes  id.diff.update
        ?-  -.diff.diff.update
            %set    diff.diff.update
            %essay  [%essay essay.diff.diff.update]
            %feels  [%feels (reduce-feels feels.diff.diff.update)]
            %quip
          :+  %quip  id.diff.diff.update
          ?-  -.diff.diff.diff.update
            %set  diff.diff.diff.update
            %feels  [%feels (reduce-feels feels.diff.diff.diff.update)]
          ==
        ==
      ==
    (give %fact ~[/ui] act:mar:d !>([flag diff.update]))
    ::
    ++  reduce-feels
      |=  =feels:d
      ^-  (map ship feel:d)
      %-  ~(gas by *(map ship feel:d))
      %+  murn  ~(tap by feels)
      |=  [=ship (rev:d feel=(unit feel:d))]
      ?~  feel  ~
      (some ship u.feel)
    --
  ::
  ++  di-give-updates
    |=  =update:d
    ^+  di-core
    =/  paths=(set path)
      %-  ~(gas in *(set path))
      (turn ~(tap in di-subscriptions) tail)
    =/  cag=cage  [upd:mar:d !>(update)]
    =.  cor
      (give %fact ~(tap in paths) cag)
    di-core
  ::
  ++  di-remark
    |=  action=remark-action:d
    ^+  di-core
    =.  cor
      (give %fact ~[(snoc di-area %ui)] diary-action+!>([flag action]))
    =.  remark.diary
      ?-  -.action
        %watch    remark.diary(watching &)
        %unwatch  remark.diary(watching |)
        %read-at  !!
      ::
          %read
      =/  [=time =note:d]  (need (ram:on:notes:d notes.diary))
      remark.diary(last-read `@da`(add time (div ~s1 100)))  ::  greater than last
      ==
    =.  cor  (give-brief flag di-brief)
    di-core
  ::
  ++  di-check-ownership
    |=  [=id:notes:d =command:notes:d]
    ^-  ?
    =/  entry=(unit [=time =note:d])
      (get:di-notes id)
    ?-  -.command
      %add       =(src.bowl author.p.command)
      %add-feel  =(src.bowl p.command)
      %del-feel  =(src.bowl p.command)
      %quips     (di-check-quips-ownership id +.command)
      %del       ?~(entry | =(src.bowl author.note.u.entry))
    ::
        %edit
      ?&  =(src.bowl author.p.command)
          ?~(entry | =(src.bowl author.note.u.entry))
      ==
    ==
  ::
  ++  di-check-quips-ownership
    |=  [note-id=id:notes:d =id:quips:d =command:quips:d]
    ^-  ?
    =/  parent=(unit [* note:d])  (get:di-notes note-id)
    ?~  parent  |  ::  note missing, nothing to do
    =/  quips  ~(. qup quips.u.parent)
    =/  entry=(unit [* quip:d])  (get:quips id)
    ?-  -.command
      %add       =(src.bowl author.p.command)
      %add-feel  =(src.bowl p.command)
      %del-feel  =(src.bowl p.command)
      %del       ?~(entry | =(src.bowl author.u.entry))
    ==
  ::
  ++  di-apply-update
    |=  update:d
    ?>  di-from-host
    ^+  di-core
    =.  di-core  (di-give-ui time diff)
    =/  result
      (apply-diff:diary global.diary diff)
    ?:  ?=(%| -.result)
      =.  diffs.future.local.diary
        ::  if the item affected by the diff is not in the window we care about,
        ::  then ignore it. otherwise, put it in the pending diffs set.
        ::
        ?.  (~(has as:sparse window.future.local.diary) id)
          diffs.future.local.diary
        (~(put ju diffs.future.local.diary) id diff)
      di-core
    ::  emit notifications if we need to
    ::
    ?.  ?=(%notes -.diff)  di-core
    =.  cor  (give-brief flag di-brief)
    =/  cons=(list (list content:ha))
      (hark:di-notes our.bowl +.diff)
    =.  cor
      %-  emil
      %+  turn  cons
      |=  cs=(list content:ha)
      (pass-hark (di-spin /note/(rsh 4 (scot %ui id.diff)) cs ~))
    di-core
  --
--

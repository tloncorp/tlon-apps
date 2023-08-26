:: XX refactor initial subscription
:: XX move +said handing to server
::
/-  d=diary, g=groups, ha=hark
/-  meta
/-  e=epic
/+  default-agent, verb, dbug, sparse
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
    ^+  cor
    ~&  %strange-diary-arvo+wire
    `this
  --
|_  [=bowl:gall cards=(list card)]
+*  epos  ~(. epos-lib [bowl %diary-update okay:d])
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
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
++  init
  ^+  cor
  inflate-io
::
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
    =.  cor  inflate-io
    (emil (drop load:epos))
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
    !!  ::TODO  diary(log (log-1-to-2 diary))
  ::
  ++  log-1-to-2
    |=  old-diary=diary:one  ::NOTE  because we need the perm also
    ^-  log:two
    %-  ~(gas in *log:two)  ::TODO  ordered map
    %+  murn  ~(tap by log.old-diary)
    |=  [=time =diff:one]
    =;  new=(unit u-diary:two)
      (bind new (lead time))
    !!  ::TODO
    :: ::TODO  we invent rev numbers here. safe/sane??
    :: ?-  -.diff
    ::   ?(%add-sects %del-sects)  [%perm 0 perm.old-diary]  ::TODO  is this correct?
    ::   %create                   ~
    ::   ?(%view %sort)            `[- 0 +]:diff
    ::   %arranged-notes           `[%order 0 +.diff]
    :: ::
    ::     %notes
    ::   :+  %notes  p.p.diff
    ::   ?-  -.q.p.diff
    ::     ?(%add %edit)  xx ::TODO  how? get from old state?
    ::     ?(%add-feel %del-feel)  xx ::TODO  how? get from old state?
    ::     %del           [%set ~]
    ::   ::
    ::     %quips         xx
    ::   ==
    ::   ::  $note = [seal (rev essay)]
    :: ==
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
          ?.  ?=(%chi saga.net.u.diary)  |
          ?.  ?=([%diary @ %updates ?(~ [@ ~])] path)  |
          =(i.t.t.wire i.t.path)
        ::
            [%said @ @ %note @ ?(~ [@ ~])]
          ?.  =(%diary-server dude)  |       :: maybe %diary ?
          ?.  =((scot %p ship) i.t.wire)  |  :: ?
          =*  qflag  i.t.t.wire
          ?~  pplan=(slaw %ud i.t.t.t.t.wire)  ~
          =/  qplan=(unit (unit time))
            ?~  t.t.t.t.t.wire  `~
            ?~  q=(slaw %ud i.t.t.t.t.t.wire)  ~
            ``u.q
          ?~  qplan  ~
          ?.  (~(has by voc) [ship qflag] u.pplan u.qplan)  |
          =(wire path)  |
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
  --
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
    ?:  ?=(%join -.a-diary.a-shelf)
      di-abet:(di-join:di-core [flag group.a-diary]:a-shelf)
    di-abet:(di-a-diary:(di-abed:di-core flag.a-shelf) a-diary.a-shelf)
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
    =/  wire  (said-wire flag plan)
    (safe-watch wire [p.flag dap.bowl] wire)
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
  ==
::
++  watch-groups  (safe-watch /groups [our.bowl %groups] /groups)
++  watch-epic
  |=  her=ship
  (safe-watch /epic [her dap.bowl] /epic)
::
++  take-epic
  |=  =sign:agent:gall
  ^+  cor
  ?+    -.sign  cor
      %kick  (watch-epic src.bowl)
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
      [%x %shelf ~]  ``shelf+!>(shelf)
      [%x %init ~]   ``noun+!>([briefs shelf])
      [%x %briefs ~]  ``diary-briefs+!>(briefs)
      [%x %diary ship=@ name=@ rest=*]  ::  XX
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
++  di-core
  |_  [=flag:d =diary:d gone=_|]
  +*  di-notes  ~(. not notes.diary)
  ++  di-core  .
  ++  emit  |=(=card di-core(cor (^emit card)))
  ++  emil  |=(caz=(list card) di-core(cor (^emil caz)))
  ++  give  |=(=gift:agent:gall di-core(cor (^give gift)))
  ++  safe-watch  |=([=wire =dock =path] di-core(cor (^safe-watch +<)))
  ++  di-abet
    %_  cor
        shelf
      ?:(gone (~(del by shelf) flag) (~(put by shelf) flag diary))
    ==
  ++  di-abed
    |=  f=flag:d
    di-core(flag f, diary (~(got by shelf) f))
  ::
  ++  di-area  `path`/diary/(scot %p p.flag)/[q.flag]
  ::
  ++  di-join
    |=  [f=flag:d group=flag:g]
    ?<  (~(has by shelf) flag)
    ?>  |(=(p.group src.bowl) =(src.bowl our.bowl))
    =.  flag  f
    =.  diary  *diary:d
    =.  group.perm.perm.diary  group
    =.  last-read.remark.diary  now.bowl
    =.  cor  (give-brief flag di-brief)
    =.  cor  (watch-epic p.flag)
    di-safe-sub
  ::
  ++  di-a-diary
    |=  =a-diary:d
    ?>  from-self
    ?+  -.a-diary  (di-send-command a-diary)
      %join       !!  ::  handled elsewhere
      %leave      di-leave
      ?(%read %read-at %watch %unwatch)  (di-a-remark a-diary)
    ==
  ::
  ++  di-a-remark
    |=  =a-remark:d
    ^+  di-core
    =.  cor
      (give %fact ~[(snoc di-area %ui)] diary-response+!>([flag a-remark]))
    =.  remark.diary
      ?-    -.action
          %watch    remark.diary(watching &)
          %unwatch  remark.diary(watching |)
          %read-at  !!
          %read
        =/  [=time =note:d]  (need (ram:on:notes:d notes.diary))
        remark.diary(last-read `@da`(add time (div ~s1 100)))  ::  greater than last
      ==
    =.  cor  (give-brief flag di-brief)
    (di-response a-remark)
  ::
  ++  di-send-command
    |=  command=c-diary:d
    ^+  di-core
    ::  don't allow anyone else to proxy through us
    ?.  =(src.bowl our.bowl)
      ~|("%diary-action poke failed: only allowed from self" !!)
    =/  =cage  [%diary-command !>([flag command])]
    =.  cor  (emit %pass di-area %agent [p.flag dap.bowl] %poke cage)
    di-core
  ::
  ++  di-said  :: XX move to diary-server
    |=  =plan:d
    |^  ^+  di-core
    ?.  (di-can-read src.bowl)
      (give-kick diary-denied+!>(~))
    =/  note=(unit (unit note:d))  (get:on-notes:d p.plan)
    =/  [* note=(unit note:d)]  (got:di-notes p.plan)
    =/  =outline:d
      ?~  note
        ::TODO  give "outline" that formally declares deletion
        [0 ~ 'This post was deleted.' '' ~ ~nul *@da]
      (trace:di-notes u.note)
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
    (~(has by wex.bowl) [(snoc di-area %updates) p.flag dap.bowl])
  ::
  ++  di-safe-sub
    ?:  di-has-sub  di-core
    ?.  ?=(%chi saga.net.diary)  di-core
    =/  =wire  (snoc di-area %updates)
    =/  =path
      =/  tim=(unit time)
        (bind (ram:log-on:d log.diary) head)
      %+  weld  /diary/[q.flag]/updates
      ?~  tim  ~
      /(scot %da u.tim)
    (safe-watch base [p.flag dap.bowl] path)
  ::
  ++  di-watch
    |=  =path
    ^+  di-core
    ?+    path  !!
      [%ui ~]         ?>(from-self di-core)
      [%ui %notes ~]  ?>(from-self di-core)
    ::
    ==
  ::
  ++  di-agent
    |=  [=wire =sign:agent:gall]
    ^+  di-core
    ?+    wire  ~|(diary-strange-agent-wire+wire !!)
        ~  di-core  :: noop wire, should only send pokes
        [%updates ~]  (di-take-update sign)
    ==
  ::
  ++  di-take-update
    |=  =sign:agent:gall
    ^+  di-core
    ?+    -.sign  di-core
        %kick       di-safe-sub
        %watch-ack
      =.  net.diary  [%sub src.bowl & [%chi ~]]
      ?~  p.sign  di-core
      %-  (slog leaf/"{<dap.bowl>}: Failed subscription" u.p.sign)
      ~&  'diary watch ack done'
      di-core
    ::
        %fact
      =*  cage  cage.sign
      ?+  p.cage  ~|(diary-strange-fact+p.cage !!)
        %diary-logs    (di-apply-logs !<(log:d q.cage))
        %diary-update  (di-u-shelf !<(update:d q.cage))
        %diary-notes   !!  ::  XX
      ==
    ==
  ::
  ++  di-apply-logs
    |=  =log:d
    ^+  di-core
    =/  updates=(list update:d)
      (tap:log-on:d log)
    %+  roll  updates
    |=  [=update:d di=_di-core]
    (di-u-shelf:di update)
  ::
  ++  di-u-shelf
    |=  [=time =u-diary:d]  :: XX don't need time?
    ?>  di-from-host
    ^+  di-core
    ?-    -.u-diary
        %create
      ?.  =(0 rev.perm.diary)  di-core
      =.  perm.diary  perm.u-diary
      (di-response %perm perm)
    ::
        %order
      =^  changed  order.diary  (apply-rev:d order.diary order.u-diary)
      ?.  changed  di-core
      (di-response %order order.diary)
    ::
        %view
      =^  changed  view.diary  (apply-rev:d view.diary view.u-diary)
      ?.  changed  di-core
      (di-response %view view.diary)
    ::
        %sort
      =^  changed  sort.diary  (apply-rev:d sort.diary sort.u-diary)
      ?.  changed  di-core
      (di-response %sort sort.diary)
    ::
        %perm
      =^  changed  perm.diary  (apply-rev:d perm.diary perm.u-diary)
      ?.  changed  di-core
      (di-response %perm perm.diary)
    ::
        %notes
      =^  [response=(unit r-note:d) new=(unit note:d)]  di-core
        (di-u-note (get:on-notes:d id.r-note) u-note.u-diary)
      ?~  response  di-core
      =.  notes.diary  (put:on-notes:d notes.diary id.r-note new)
      (di-response %notes id.r-note u.response)
    ==
  ::
  ++  di-u-note
    |=  [note=(unit (unit note:d)) =u-note:d]
    ^-  [(unit r-note:d) _di-core]
    =;  [response di]
      =.  di-core  di
      [response (give-brief flag di-brief)]
    ?:  ?=([~ ~] note)  ``di-core
    ?:  ?=(%set -.u-note)
      ?~  note
        =/  rr-note=(unit rr-note:d)
          ?~  note.u-note  ~
          :-  ~  :_  +>.u.note.u-note
          :+  time.u.note.u-note
            (di-rr-quips quips.u.note.u-note)
          (di-reduce-feels feels.u.note.u-note)
        =.  notes.diary  (put:on-notes:d notes.diary id.r-note `note.u-note)
        [`[%set rr-note] di-core]
      ::
      ?~  note.u-note
        =.  notes.diary  (put:on-notes:d notes.diary id.r-note ~)
        [`[%set ~] di-core]
      ::
      =*  old  u.u.note
      =*  new  u.note.u-note
      =/  merged  (di-apply-note old new)
      ?:  =(merged old)  ``old
      =.  notes.diary  (put:on-notes:d notes.diary id.r-note `merged)
      [`[%set ~ merged] di-core]
    ::
    ?~  note
      =.  diffs.future.local.diary
        ::  if the item affected by the update is not in the window we
        ::  care about, ignore it. otherwise, put it in the pending
        ::  diffs set.
        ::
        ?.  (~(has as:sparse window.future.local.diary) id.u-note)
          diffs.future.local.diary
        (~(put ju diffs.future.local.diary) id.u-note %notes id.u-note u-note)
      `di-core
    ::
    ?-    -.u-note
        %feels
      =/  merged  (di-apply-feels feels.u.u.note feels.u-note)
      ?:  =(merged feels.u.u.note)  ``u.u.note
      =.  notes.diary
        (put:on-notes:d notes.diary id.r-note `u.u.note(feels merged))
      [`[%feels (di-reduce-feels merged)] di-core]
    ::
        %essay
      =^  changed  +.u.u.note  (apply-rev +.u.u.note +.u-note)
      ?.  changed  ``u.u.note
      =.  notes.diary  (put:on-notes:d notes.diary id.r-note `u.u.note)
      [`[%essay +>.u.u.note] di-core]
    ::
        %quip
      =/  [response=(unit r-quip:d) new=(unit quip:d)]
        (di-u-quip (get:on-quips:d id.r-quip) u-quip.u-note)
      ?~  response  di-core
      =.  quips.u.u.note  (put:on-notes:d quips.u.u.note id.r-note new)
      =.  notes.diary  (put:on-notes:d notes.diary id.r-note `u.u.note)
      [`[%quip id.r-quip u.response] di-core]
    ==
  ::
  ++  di-u-quip
    |=  [quip=(unit (unit quip:d)) =u-quip:d]
    ?:  ?=([~ ~] quip)  `~
    ?:  ?=(%set -.u-quip)
      ?~  quip
        =/  rr-quip=(unit rr-quip:d)  :: XX
          ?~  quip.u-note  ~
          :_  +>.u.quip.u-note
          [time.u.quip.u-note (reduce-feels feels.u.quip.u-note)]
        [`[%set rr-quip] quip.u-quip]
      ::
      ?~  quip.u-quip
        [`[%set ~] ~]
      ::
      =*  old  u.u.quip
      =*  new  u.quip.u-quip
      =/  merged  (need (di-apply-quip `old `new))
      ?:  =(merged old)  ``old
      [`[%set ~ merged] `merged]
    ::
    ?~  quip  ~
    ::
    =/  merged  (di-apply-feels feels.u.u.quip feels.u-quip)
    ?:  =(merged feels.u.u.quip)  ``u.u.quip
    [`[%feels (di-reduce-feels merged)] `u.u.quip(feels merged)]
  ::
  ++  di-apply-note
    |=  [=id old=note:d new=note:d]
    ^-  note:d
    %=  u.old
      quips  (di-apply-quips:quips quips.u.old quips.u.new)
      feels  (di-apply-feels feels.u.old feels.u.new)
      +      +:(apply-rev +.u.old +.u.new)
    ==
  ::
  ++  di-apply-feels
    |=  [old=feels:d new=feels:d]
    ^-  feels
    %-  (~(uno by old) new)
    |=  [* a=(rev:d (unit feel:d)) b=(rev (unit feel:d))]
    (apply-rev:d a b)
  ::
  ++  di-apply-quips
    |=  [old=quips:d new=quips:d]
    ((uno:mo-quips:d old new) di-apply-quip)
  ::
  ++  di-apply-quip
    |=  [=id old=(unit quip:d) new=(unit quip:d)]
    ^-  (unit quip:d)
    ?~  old  ~
    ?~  new  ~
    :-  ~
    %=  u.old
      feels  (di-apply-feels feels.u.old feels.u.new)
      +      +.u.new
    ==
  ::
  ++  di-rr-quips
    |=  =quips:d
    ^-  rr-quips:d
    %+  gas:on-quips  *quips:d
    %+  murn  (tap:on-quips:d quips)
    |=  [=time quip=(unit quip:d)]
    ?~  quip  ~
    %-  some
    :_  +>.u.quip
    [time.u.quip (reduce-feels feels.u.quip)]
  ::
  ++  di-reduce-feels
    |=  =feels:d
    ^-  (map ship feel:d)
    %-  ~(gas by *(map ship feel:d))
    %+  murn  ~(tap by feels)
    |=  [=ship (rev:d feel=(unit feel:d))]
    ?~  feel  ~
    (some ship u.feel)


    ::  emit notifications if we need to
    ::
    ?.  ?=(%notes -.u-diary)  di-core
    =.  cor  (give-brief flag di-brief)
    =/  cons=(list (list content:ha))  :: XX still need to handle
      (hark:di-notes our.bowl +.u-diary)
    =.  cor
      %-  emil
      %+  turn  cons
      |=  cs=(list content:ha)
      (pass-hark (di-spin /note/(rsh 4 (scot %ui id.u-diary)) cs ~))
    di-core
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
  ++  di-response
    |=  =r-diary:d
    =/  =r-shelf:d  [flag r-diary]
    (give %fact ~[/ui] %diary-response !>(r-shelf))  :: XX create mark
  ::
  ++  di-brief
    ^-  brief:briefs:d
    =/  =time
      ?~  tim=(ram:on-notes:d not)  *time
      key.u.tim
    =/  unreads
      (lot:on-notes:d not `last-read.remark.diary ~)
    =/  read-id=(unit ^time)
      =/  pried  (pry:on-notes:d unreads)
      ?~  pried  ~
      ?~  val.u.pried  ~
      `time.u.val.u.pried
    =/  count
      %-  lent
      %+  skim  ~(tap by unreads)
      |=  [tim=^time note=(unit note:d)]
      ?&  ?=(^ note)
          !=(author.u.note our.bowl)
      ==
    [time count read-id]
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
      (some [time (trace u.note)])
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
      (some [time (trace u.note)])
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
      ``diary-note+!>(u.u.note)
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
      =/  quip  (get:on-quips:d `@da`time)
      ?~  quip  ~
      ?~  u.quip  `~
      ``quip+!>(u.u.quip)
    ==
  ::
  ++  di-recheck
    |=  sects=(set sect:g)
    ::  if our read permissions restored, re-subscribe
    ?:  (di-can-read our.bowl)  di-safe-sub
    di-core
  ::
  ++  di-take-epic
    |=  her=epic:e
    ^+  di-core
    ?:  (lth her okay:d)  di-make-lev
    ?:  (gth her okay:d)  (di-make-dex her)
    di-make-chi
  ::
  ++  di-groups-scry
    ^-  path
    =*  group  group.perm.perm.diary
    /(scot %p our.bowl)/groups/(scot %da now.bowl)/groups/(scot %p p.group)/[q.group]
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
  ++  di-join
    |=  group=flag:d
    ^+  di-core
    ?<  (~(has by shelf) flag)
    ?>  |(=(p.group src.bowl) =(src.bowl our.bowl))
    =.  group.perm.perm.diary  group
    =.  last-read.remark.diary  now.bowl
    =.  cor  (give-brief flag di-brief)
    =.  cor  (watch-epic p.flag &)
    di-safe-sub
  ::
  ++  di-simple-leave
    =/  =wire  (snoc di-area %updates)
    (emit %pass wire %agent [p.flag dap.bowl] %leave ~)
  ::
  ++  di-leave
    =/  =dock  [p.flag dap.bowl]
    =/  =wire  (snoc di-area %updates)
    =.  cor  (emit %pass wire %agent dock %leave ~)
    =.  cor  (emit %give %fact ~[/briefs] diary-leave+!>(flag))
    =.  gone  &
    di-core
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
      ?-  -.u-diary.update
          %order  [%order order.u-diary.update]
          %view   [%view view.u-diary.update]
          %sort   [%sort sort.u-diary.update]
          %perm   [%perm perm.u-diary.update]
          %notes
        :+  %notes  id.u-diary.update
        ?-  -.u-note.u-diary.update
            %set    u-note.u-diary.update
            %essay  [%essay essay.u-note.u-diary.update]
            %feels  [%feels (reduce-feels feels.u-note.u-diary.update)]
            %quip
          :+  %quip  id.u-note.u-diary.update
          ?-  -.u-quip.u-note.u-diary.update
            %set  u-quip.u-note.u-diary.update
            %feels  [%feels (reduce-feels feels.u-quip.u-note.u-diary.update)]
          ==
        ==
      ==
    (give %fact ~[/ui] act:mar:d !>([flag u-diary.update]))
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
  --
--

::  groups: agent for managing group membership, metadata and permissions
::
::    note: all subscriptions are handled by the subscriber library so
::    we can have resubscribe loop protection.
::
/-  g=groups, zero=groups-0, ha=hark, h=heap, d=channels, c=chat,
    tac=contacts-0, activity
/-  meta
/+  default-agent, verb, dbug
/+  v=volume, s=subscriber, imp=import-aid, logs
/+  of
/+  neg=negotiate
::  performance, keep warm
/+  groups-json
/*  desk-bill  %bill  /desk/bill
=/  verbose  |
::
%-  %-  agent:neg
    :+  notify=|
      [~.groups^%0 ~ ~]
    %-  my
    :~  %groups^[~.groups^%0 ~ ~]
        %channels-server^[~.channels^%2 ~ ~]
    ==
%-  agent:dbug
%+  verb  |
::
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  ++  import-epoch  ~2022.10.11
  +$  current-state
    $:  %6
        groups=net-groups:g
        =volume:v
        xeno=gangs:g
        =^subs:s
        =pimp:imp
    ==
  ::
  --
=|  current-state
=*  state  -
=<
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %|) bowl)
      log   ~(. logs [our.bowl /logs])
      cor   ~(. +> [bowl ~])
  ++  on-init
    ^-  (quip card _this)
    =^  cards  state
      abet:init:cor
    [cards this]
  ::
  ++  on-save  !>([state okay:g])
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
  ++  on-fail
    |=  [=term =tang]
    ^-  (quip card _this)
    :_  this
    [(fail:log term tang ~)]~
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
+*  epos  ~(. epos-lib [bowl %group-update okay:g])
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  log
  |=  msg=(trap tape)
  ?.  verbose  same
  (slog leaf+"%{(trip dap.bowl)} {(msg)}" ~)
::
++  submit-activity
  |=  =action:activity
  ^+  cor
  ?.  .^(? %gu /(scot %p our.bowl)/activity/(scot %da now.bowl)/$)
    cor
  %-  emit
  =/  =cage  [%activity-action !>(`action:activity`action)]
  [%pass /activity/submit %agent [our.bowl %activity] %poke cage]
::
++  check-known
  |=  =ship
  ^-  ?(%alien %known)
  =-  (fall (~(get by -) ship) %alien)
  .^((map ^ship ?(%alien %known)) %ax /(scot %p our.bowl)//(scot %da now.bowl)/peers)
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+    mark  ~|(bad-mark+mark !!)
      %noun
    ?+  q.vase  !!
      %reset-all-perms  reset-all-perms
    ::
        [%group-wake flag:g]
      =+  ;;(=flag:g +.q.vase)
      ?.  |(=(our src):bowl =(p.flag src.bowl))
        cor
      ?~  g=(~(get by groups) flag)
        cor
      go-abet:(go-safe-sub:(go-abed:group-core:cor flag) |)
    ::
        %pimp-ready
      ?-  pimp
        ~         cor(pimp `&+~)
        [~ %& *]  cor
        [~ %| *]  (run-import p.u.pimp)
      ==
    ==
  ::
      %reset-group-perms
    =+  !<(=flag:g vase)
    =/  val  (~(get by groups) flag)
    ?~  val
      ~&  'No group found'
      cor
    ((reset-group-perms cor) [flag u.val] cor)
  ::
      %group-leave
    =+  !<(=flag:g vase)
    ?>  from-self
    ?<  =(our.bowl p.flag)
    go-abet:(go-leave:(go-abed:group-core flag) &)
  ::
      %group-create
    ?>  from-self
    =+  !<(=create:g vase)
    ?>  ((sane %tas) name.create)
    =/  =flag:g  [our.bowl name.create]
    =/  =fleet:g
      %-  ~(run by members.create)
      |=  sects=(set sect:g)
      ^-  vessel:fleet:g
      [sects *time]
    =/  =group:g
      :*  fleet
          ~  ~  ~  ~  ~  ~  ~
          cordon.create
          secret.create
          :*  title.create
              description.create
              image.create
              cover.create
          ==
          ~
      ==
    =.  groups  (~(put by groups) flag *net:g group)
    =.  cor  (give-invites flag ~(key by members.create))
    go-abet:(go-init:(go-abed:group-core flag) ~)
    ::
      ::TODO  the $action type is unfortunately interwined
      ::      with the $diff type, causing it to change without a real need.
      ::      it should be disentangled with dedicated action
      ::      and response types.
      ::
      ?(%group-action-3 %group-action-2 %group-action-1 %group-action-0)
    =+  !<(action-3=action:v2:g vase)
    =/  =action:g
      ?.  ?=(%create -.q.q.action-3)  action-3
      ~|("group action %create poke unsupported, use %group-create" !!)
    $(mark %group-action-4, vase !>(`action:v5:g`action))
    ::
        %group-action-4
    =+  !<(action=action:v5:g vase)
    =.  p.q.action  now.bowl
    =/  group-core  (go-abed:group-core p.action)
    ?:  &(!=(our.bowl p.p.action) from-self)
      go-abet:(go-proxy:group-core q.action)
    go-abet:(go-update:group-core q.action)
  ::
      %group-invite
    =+  !<(=invite:g vase)
    ?:  =(q.invite our.bowl)
      :: invitee
      ga-abet:(ga-invite:(ga-abed:gang-core p.invite) invite)
    :: inviter
    =/  cage  group-invite+!>(invite)
    (emit [%pass /gangs/invite %agent [q.invite dap.bowl] %poke cage])
  ::
      %group-join
    ?>  from-self
    =+  !<(=join:g vase)
    ga-abet:(ga-start-join:(ga-abed:gang-core flag.join) join-all.join)
  ::
      %group-knock
    ?>  from-self
    =+  !<(=flag:g vase)
    ga-abet:ga-knock:(ga-abed:gang-core flag)
  ::
      %group-rescind
    ?>  from-self
    =+  !<(=flag:g vase)
    ga-abet:ga-rescind:(ga-abed:gang-core flag)
  ::
      %group-cancel
    ?>  from-self
    =+  !<(=flag:g vase)
    ga-abet:ga-cancel:(ga-abed:gang-core flag)
  ::
      %invite-decline
    ?>  from-self
    =+  !<(=flag:g vase)
    ga-abet:ga-invite-reject:(ga-abed:gang-core flag)
  ::
      %volume-set
    ?>  =(our src):bowl
    =+  !<([=scope:v =value:v] vase)
    ?-  scope
        ~
      ?<  ?=(~ value)
      cor(base.volume value)
    ::
        [%group *]
      =-  cor(area.volume -)
      ?~  value
        (~(del by area.volume) +.scope)
      (~(put by area.volume) +.scope value)
    ::
        [%channel *]
      =-  cor(chan.volume -)
      ?~  value
        (~(del by chan.volume) +.scope)
      (~(put by chan.volume) +.scope value)
    ==
  ::
      %egg-any
    =+  !<(=egg-any:gall vase)
    ?-  pimp
      ~         cor(pimp `|+egg-any)
      [~ %& *]  (run-import egg-any)
      [~ %| *]  ~&  [dap.bowl %overwriting-pending-import]
                cor(pimp `|+egg-any)
    ==
  ::
      %handle-http-request
    ::  we may (in some Tlon hosting circumstances) have been bound to serve
    ::  on the root path, making us act as a catch-all for http requests.
    ::  handle all requests that hit us by redirecting back into the web app.
    ::
    =+  !<([id=@ta inbound-request:eyre] vase)
    =/  pax=path                 /http-response/[id]
    =/  pay=simple-payload:http  [[307 ['location' '/apps/groups/']~] ~]
    %-  emil
    :~  [%give %fact ~[pax] %http-response-header !>(response-header.pay)]
        [%give %fact ~[pax] %http-response-data !>(data.pay)]
        [%give %kick ~[pax] ~]
    ==
  ==
::
++  run-import
  |=  =egg-any:gall
  ^+  cor
  =.  pimp  ~
  ?-  -.egg-any
      ?(%15 %16)
    ?.  ?=(%live +<.egg-any)
      ~&  [dap.bowl %egg-any-not-live]
      cor
    =/  bak
      (load -:!>(*[versioned-state:load _okay:g]) +>.old-state.egg-any)
    ::  restore any previews & invites we might've had
    ::
    =.  xeno
      %+  roll  ~(tap by xeno:bak)
      |=  [[=flag:g =gang:g] =_xeno]
      %+  ~(put by xeno)  flag
      ?.  (~(has by xeno) flag)
        gang(cam ~)
      =/  hav  (~(got by xeno) flag)
      :^    cam.hav
          ?~(pev.hav pev.gang pev.hav)
        ?~(vit.hav vit.gang vit.hav)
      ~
    ::  restore the groups we were in, taking care to re-establish
    ::  subscriptions to the group, and to tell %channels to re-establish
    ::  its subscriptions to the groups' channels as well.
    ::
    =.  cor
      %+  roll  ~(tap by groups:bak)
      |=  [[=flag:g gr=[=net:g =group:g]] =_cor]
      ?:  (~(has by groups.cor) flag)
        cor
      =.  groups.cor  (~(put by groups.cor) flag gr)
      =/  goc  (go-abed:group-core:cor flag)
      =.  goc  (go-safe-sub:goc |)
      =.  cor  go-abet:goc
      =?  cor  =(p.flag our.bowl)
        (emil:cor go-wake-members:go-pass:goc)
      %-  emil:cor
      %-  join-channels:go-pass:goc
      ~(tap in ~(key by channels.group.gr))
    =.  volume
      :+  base.volume:bak
        (~(uni by area.volume:bak) area.volume)
      (~(uni by chan.volume:bak) chan.volume)
    cor
  ==
::
++  channel-scry
  |=  =nest:g
  ^-  path
  /(scot %p our.bowl)/channels/(scot %da now.bowl)/[p.nest]/(scot %p p.q.nest)/[q.q.nest]
::
++  reset-all-perms
  (~(rep by groups) (reset-group-perms cor))
::
++  reset-group-perms
  |=  core=_cor
  |=  [[=flag:g [=net:g =group:g]] cr=_core]
  ?.  =(our.bowl p.flag)  cr
  (~(rep by channels.group) (reset-channel-perms flag cr))
::
++  reset-channel-perms
  |=  [=flag:g cr=_cor]
  |=  [[=nest:g =channel:g] core=_cr]
  ?.  ?=(?(%diary %heap %chat) p.nest)  core
  =.  cards.core
    :_
    :_  cards.core
      ^-  card
      =/  wire  /groups
      =/  dock  [our.bowl dap.bowl]
      =/  =action:v5:g  [flag [now.bowl [%channel nest [%del-sects readers.channel]]]]
      =/  cage  group-action-4+!>(action)
      [%pass wire %agent dock %poke cage]
    ^-  card
    =/  =path  (welp (channel-scry nest) /perm/noun)
    =/  perms  .^(perm:d %gx path)
    =/  =c-channels:d  [%channel nest %del-writers writers.perms]
    =/  =wire  /diary
    =/  =dock  [our.bowl %channels-server]
    =/  =cage  [%channel-command !>(c-channels)]
    [%pass wire %agent dock %poke cage]
  core
::  +init: initialize agent
++  init
  ^+  cor
  inflate-io
::  +load: load next state
++  load
  |^  |=  =vase
  ^+  cor
  =+  !<([old=versioned-state cool=*] vase)
  =?  old  ?=(%0 -.old)  (state-0-to-1 old)
  =?  old  ?=(%1 -.old)  (state-1-to-2 old)
  =?  old  ?=(%2 -.old)  (state-2-to-3 old)
  =?  old  ?=(%3 -.old)  (state-3-to-4 old)
  ::
  ::  v4 -> v5
  ::
  ::  leave all /epic subscriptions
  ::
  =?  cor  ?=(%4 -.old)
    %+  roll  ~(tap by wex.bowl)
    |=  [[[=wire =dock] *] =_cor]
    ?.  ?=([%epic ~] wire)  cor
    =^  caz=(list card)  subs.cor
      (~(unsubscribe s [subs bowl]) wire dock)
    =.  cor  (emil:cor caz)
    ::  force leave
    (emit:cor [%pass wire %agent dock %leave ~])
  =?  cor  ?=(%4 -.old)
    (emit [%pass /load/active-channels %arvo %b %wait now.bowl])
  =?  old  ?=(%4 -.old)  (state-4-to-5 old)
  ::
  =?  old  ?=(%5 -.old)  (state-5-to-6 old)
  ::
  ?>  ?=(%6 -.old)
  =.  state  old
  inflate-io
  ::
  ::
  +$  versioned-state
    $%  state-6
        state-5
        state-4
        state-3
        state-2
        state-1
        state-0
    ==
  +$  state-0
    $:  %0
        groups=net-groups:zero
        xeno=gangs:zero
        shoal=(map flag:zero dude:gall)
    ==
  ::
  +$  state-1
    $:  %1
      groups=net-groups:zero
      ::
        $=  volume
        $:  base=level:v
            area=(map flag:zero level:v)  ::  override per group
            chan=(map nest:zero level:v)  ::  override per channel
        ==
      ::
        xeno=gangs:zero
        ::  graph -> agent
        shoal=(map flag:zero dude:gall)
    ==
  ::
  +$  state-2
    $:  %2
        groups=net-groups:v2:g
      ::
        $=  volume
        $:  base=level:v
            area=(map flag:g level:v)  ::  override per group
            chan=(map nest:g level:v)  ::  override per channel
        ==
      ::
        xeno=gangs:v2:g
        ::  graph -> agent
        shoal=(map flag:g dude:gall)
    ==
  ::
  +$  state-3
    $:  %3
        groups=net-groups:v2:g
        =volume:v
        xeno=gangs:v2:g
        ::  graph -> agent
        shoal=(map flag:g dude:gall)
        =^subs:s
    ==
  ::
  +$  state-4
    $:  %4
        groups=net-groups:v2:g
        =volume:v
        xeno=gangs:v2:g
        ::  graph -> agent
        shoal=(map flag:g dude:gall)
        =^subs:s
        =pimp:imp
    ==
  ::
  +$  state-5
    $:  %5
        groups=net-groups:v5:g
        =volume:v
        xeno=gangs:v5:g
        ::  graph -> agent
        shoal=(map flag:g dude:gall)
        =^subs:s
        =pimp:imp
    ==
  ::
  +$  state-6  current-state
  ::
  ++  state-0-to-1
    |=  state-0
    ^-  state-1
    [%1 groups [*level:v ~ ~] xeno shoal]
  ::
  ++  state-1-to-2
    |=  state-1
    ^-  state-2
    [%2 (groups-1-to-2 groups) volume xeno shoal]
  ::
  ++  state-2-to-3
    |=  state-2
    ^-  state-3
    [%3 groups volume xeno shoal *^subs:s]
  ::
  ++  state-3-to-4
    |=  state-3
    ^-  state-4
    [%4 groups volume xeno shoal subs ~]
  ::
  ++  state-4-to-5
    |=  state-4
    ^-  state-5
    :*  %5
        (~(run by groups) net-group-2-to-5)
        volume
        (~(run by xeno) gang-2-to-5)
        shoal
        subs
        ~
    ==
  ::
  ++  state-5-to-6
    |=  state-5
    ^-  state-6
    :*  %6
        groups
        volume
        (~(run by xeno) gang-5-to-6)
        subs
        ~
    ==
  ::
  ++  gang-5-to-6
    |=  gang:v5:g
    ^-  gang:v6:g
    [cam pev vit ~]
  ::
  ++  net-group-2-to-5
    |=  [old-net=net:v2:g old-group=group:v2:g]
    [(net-2-to-5 old-net) (group-2-to-5 old-group)]
  ::
  ++  net-2-to-5
    |=  =net:v2:g
    ^-  net:v5:g
    ?:  ?=(%sub -.net)
      [%sub p.net load.net]
    [%pub (run:log-on:v2:g p.net diff-2-to-5)]
  ::
  ++  diff-2-to-5
    |=  =diff:v2:g
    ^-  diff:v5:g
    ?.  ?=(%create -.diff)  diff
    diff(p (group-2-to-5 p.diff))
  ::
  ++  group-2-to-5
    |=  group:v2:g
    ^-  group:v5:g
    :*  fleet
        cabals
        zones
        zone-ord
        bloc
        channels
        ~  ::  active-channels
        imported
        cordon
        secret
        meta
        flagged-content
    ==
  ::
  ++  claim-2-to-5
    |=  claim:v2:g
    ^-  claim:v5:g
    ::  there is no trace of %done ever being used
    ::  since the earliest recorded version of %groups.
    ::  thus we are free to treat such claims as an %error.
    ::
    :-  join-all
    ?:(?=(%done progress) %error progress)
  ::
  ++  preview-2-to-5
    |=  preview:v2:g
    ^-  preview:v5:g
    [flag meta cordon time secret 0]
  ::
  ++  gang-2-to-5
    |=  gang:v2:g
    ^-  gang:v5:g
    [(bind cam claim-2-to-5) (bind pev preview-2-to-5) vit]
  ::
  ++  groups-1-to-2
    =*  v2  v2:g
    |=  groups=net-groups:zero
    ^-  net-groups:v2
    %-  ~(run by groups)
    |=  [=net:zero gr=group:zero]
    ^-  [net:v2 group:v2]
    :_  (group-1-to-2 gr)
    ?-  -.net
        %sub  net
        %pub
      :-  %pub
      %+  gas:log-on:v2  *log:v2
      %+  turn
        (tap:log-on:zero p.net)
      |=  [t=time =diff:zero]
      ^-  [time diff:v2]
      :-  t
      ?+  -.diff  diff
        %create  [%create (group-1-to-2 p.diff)]
      ==
    ==
  ++  group-1-to-2
    |=  gr=group:zero
    ^-  group:v2:g
    %*  .  *group:v2:g
      fleet            fleet.gr
      cabals           cabals.gr
      zones            zones.gr
      zone-ord         zone-ord.gr
      bloc             bloc.gr
      channels         channels.gr
      imported         imported.gr
      cordon           cordon.gr
      secret           secret.gr
      meta             meta.gr
      flagged-content  ~
    ==
  --
::
++  inflate-io
  ^+  cor
  ::
  =.  cor  (watch-contact |)
  =.  cor  (watch-channels |)
  ::
  =.  cor
    %+  roll
      ~(tap by groups)
    |=  [[=flag:g *] core=_cor]
    go-abet:(go-safe-sub:(go-abed:group-core:core flag) &)
  cor
::
++  watch
  |=  =(pole knot)
  ^+  cor
  ~|  watch-path=`path`pole
  ?+  pole  ~|(%bad-watch-path !!)
    [%http-response *]    cor
  ::
    ::
    ::  /v0/groups
    ::
  ::
    [%init ~]             (give %kick ~ ~)
    [%groups ~]           cor
    [%groups %ui ~]       cor
  ::
      [%groups ship=@ name=@ rest=*]
    =/  ship=@p  (slav %p ship.pole)
    go-abet:(go-watch:(go-abed:group-core ship name.pole) %v0 rest.pole)
  ::
    ::
    ::  /v1/groups
    ::
  ::
    [%v1 %groups ~]  cor
    [%v1 %groups %ui ~]  cor
  ::
    ::  /v2/groups/[ship]/[name]/preview
    ::
      [%v2 %groups ship=@ name=@ %preview ~]
    =/  ship=@p  (slav %p ship.pole)
    ?.  (~(has by groups) ship name.pole)
      =/  =preview-response:v6:g  |+%missing
      =.  cor  (emit %give %fact ~ group-preview-2+!>(preview-response))
      (emit %give %kick ~ ~)
    go-abet:(go-watch:(go-abed:group-core ship name.pole) %v2 /preview)
  ::
    ::
    ::  /v/groups/*
    ::
      [ver=?(%v1 %v2) %groups ship=@ name=@ rest=*]
    =/  ship=@p  (slav %p ship.pole)
    go-abet:(go-watch:(go-abed:group-core ship name.pole) ver.pole rest.pole)
  ::
    ::
    ::  /v0/gangs
    ::
  ::
    [%gangs %updates ~]   cor
  ::
      [%gangs %index ship=@ ~]
    =/  =ship  (slav %p ship.pole)
    ?:  =(our.bowl ship)  res-gang-index-2
    ::  XX remove when ames fix is in
    =+  (check-known ship)
    ?.  ?=(%known -)  (hi-and-req-gang-index ship)
    (req-gang-index ship)
  ::
      [%gangs ship=@ name=@ rest=*]
    =/  ship=@p  (slav %p ship.pole)
    ga-abet:(ga-watch:(ga-abed:gang-core ship name.pole) %v0 rest.pole)
  ::
    ::
    ::  /v1/gangs
    ::
  ::
    [%v1 %gangs %updates ~]   cor
  ::
      [%v1 %gangs %index ship=@ ~]
    =/  =ship  (slav %p ship.pole)
    ?:  =(our.bowl ship)  res-gang-index-5
    ::  XX remove when ames fix is in
    =+  (check-known ship)
    ?.  ?=(%known -)  (hi-and-req-gang-index ship)
    (req-gang-index ship)
  ::
      [%v1 %gangs ship=@ name=@ rest=*]
    =/  ship=@p  (slav %p ship.pole)
    ga-abet:(ga-watch:(ga-abed:gang-core ship name.pole) %v1 rest.pole)
  ::
    ::
    ::  /v2/gangs
    ::
  ::
    [%v2 %gangs %updates ~]   cor
  ::
      [%v2 %gangs ship=@ name=@ rest=*]
    =/  ship=@p  (slav %p ship.pole)
    ga-abet:(ga-watch:(ga-abed:gang-core ship name.pole) %v2 rest.pole)
  ::
      [%hi ship=@ ~]
    =/  =ship  (slav %p ship.pole)
    (hi-ship ship)
  ::
     [%chan app=@ ship=@ name=@ rest=*]
    =/  ship=@p  (slav %p ship.pole)
    =/  =nest:g  [app.pole ship name.pole]
    (watch-chan nest)
  ::
    [%epic ~]  (give %fact ~ epic+!>(okay:g))
  ==
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  =*  xeno-2
    ^-  gangs:v2:g
    (~(run by xeno) to-gang-2)
  =*  xeno-5
    ^-  gangs:v5:g
    (~(run by xeno) to-gang-5)
  =*  xeno-6
    ^-  gangs:v6:g
    xeno
  ::
  ?+    pole  [~ ~]
  ::
    [%x %gangs ~]  ``gangs+!>(xeno-2)
    [%x %v1 %gangs ~]  ``gangs-1+!>(xeno-5)
    [%x %v2 %gangs ~]  ``gangs-2+!>(xeno-6)
  ::
    [%x %init ~]  ``noun+!>([groups-light-2 xeno-2])
    [%x %init %v0 ~]  ``noun+!>([groups-light-ui-v0 xeno-2])
    [%x %init %v1 ~]  ``noun+!>([groups-light-ui-2 xeno-2])
    [%x %v2 %init ~]  ``noun+!>([groups-light-ui-5 xeno-5])
    [%x %v3 %init ~]  ``noun+!>([groups-light-ui-5 xeno-6])
  ::
    [%x %groups %light ~]  ``groups+!>(groups-light-2)
    [%x %groups %light %v0 ~]  ``groups-ui-v0+!>(groups-light-ui-v0)
    [%x %groups %light %v1 ~]  ``groups-ui+!>(groups-light-ui-2)
  ::
      [%x %groups ~]
    =/  groups-2=groups:v2:g
      %-  ~(run by groups)
      |=  [net:g =group:g]
      (to-group-2 group)
    ``groups+!>(groups-2)
  ::
      [%x %v1 %groups ~]
    ``groups-1+!>(`groups:v5:g`(~(run by groups) tail))
  ::
      [%x %groups %v0 ~]
    ``groups-ui-v0+!>(`groups-ui:zero`(~(urn by groups) to-group-ui-v0))
  ::
      [%x %groups %v1 ~]
    ``groups-ui+!>(`groups-ui:v2:g`(~(urn by groups) to-group-ui-2))
  ::
      [%x %groups ship=@ name=@ rest=*]
    =/  ship  (slav %p ship.pole)
    =*  flag  [ship name.pole]
    =/  group  (~(get by groups) flag)
    ?~  group  [~ ~]
    ?~  rest.pole
      ``group+!>((to-group-2 +.u.group))
    ?+    rest.pole
        (go-peek:(go-abed:group-core ship name.pole) rest.pole)
      ::
    ::
        [%v0 ~]
      ``group-ui-v0+!>(`group-ui:zero`(to-group-ui-v0 flag u.group))
    ::
        [%v1 ~]
      ``group-ui+!>((to-group-ui-2 flag u.group))
    ::
        [%v2 ~]
      ``group-ui-1+!>((to-group-ui-5 u.group))
    ==
  ::
      [%x %exists ship=@ name=@ rest=*]
      =/  src  (slav %p ship.pole)
      ``noun+!>((~(has by groups) [src name.pole]))
  ::
      [%x %volume ~]
    ``volume-value+!>(base.volume)
  ::
      [%x %volume %all ~]
    ``noun+!>(volume)
  ::
      [%x %volume ship=@ name=@ ~]
    =/  ship  (slav %p ship.pole)
    :^  ~  ~  %volume-value
    !>  ^-  value:v
    %-  ~(gut by area.volume)
    [[(slav %p ship.pole) name.pole] ~]
  ::
      [%x %volume dude=@ ship=@ name=@ ~]
    =/  =ship    (slav %p ship.pole)
    =/  =nest:g  [dude.pole ship name.pole]
    :^  ~  ~  %volume-value
    !>  ^-  value:v
    ?^  vol=(~(get by chan.volume) nest)
      u.vol
    ::NOTE  searching through all groups like this is... inefficient,
    ::      but the alternative is depending on the dude knowing what
    ::      group the nest belongs to and scrying that out of it...
    =/  groups=(list [=flag:g net:g group:g])
      ~(tap by groups)
    |-
    ?~  groups  ~
    ?.  (~(has by channels.i.groups) nest)
      $(groups t.groups)
    (~(gut by area.volume) flag.i.groups ~)
  ==
::
++  drop-fleet
  |=  =group:g
  ^-  group:g
  =.  fleet.group
    =/  our-vessel=vessel:fleet:g  (~(gut by fleet.group) our.bowl *vessel:fleet:g)
    =/  fleet-size=@ud  ~(wyt by fleet.group)
    ?:  (lte fleet-size 15)
      fleet.group  :: keep all members if 15 or fewer
    =/  other-ships=(list [ship vessel:fleet:g])
      ~(tap by (~(del by fleet.group) our.bowl))
    =/  keep-ships=(list [ship vessel:fleet:g])
      :-  [our.bowl our-vessel]
      (scag 14 other-ships)  :: take first 14 other ships
    (~(gas by *fleet:g) keep-ships)
  group
::
++  to-claim-2
  |=  =claim:g
  ^-  claim:v2:g
  claim
::
++  to-preview-2
  |=  preview:g
  ^-  preview:v2:g
  [flag meta cordon time secret]
::
++  to-gang-2
  |=  gang:g
  ^-  gang:v2:g
  :*  (bind cam to-claim-2)
      (bind pev to-preview-2)
      vit
  ==
++  to-gang-5
  |=  gang:g
  ^-  gang:v5:g
  [cam pev vit]
::
++  to-group-2
  |=  group:g
  ^-  group:v2:g
  :*  fleet
      cabals
      zones
      zone-ord
      bloc
      channels
      imported
      cordon
      secret
      meta
      flagged-content
  ==
::
++  groups-light-2
  ^-  groups:v2:g
  %-  ~(run by groups)
  |=  [=net:g =group:g]
  (to-group-2 (drop-fleet group))
::
++  groups-light-ui-2
  ^-  groups-ui:v2:g
  %-  ~(urn by groups)
  |=  [=flag:g [=net:g =group:g]]
  (to-group-ui-2 flag net (drop-fleet group))
::
++  groups-light-ui-5
  ^-  groups-ui:v5:g
  %-  ~(run by groups)
  |=  [=net:g =group:g]
  :*  (drop-fleet group)
      ::  init
      ?:(?=(%pub -.net) & load.net)
      ::  member count
      ~(wyt by fleet.group)
  ==
::
++  to-groups-ui-5
  |=  [=net:g =group:g]
  ^-  group-ui:v5:g
  :*  (drop-fleet group)
      ::  init
      ?:(?=(%pub -.net) & load.net)
      ::  member count
      ~(wyt by fleet.group)
  ==
::
++  groups-light-ui-v0
  ^-  groups-ui:zero
  %-  ~(urn by groups)
  |=  [=flag:g [=net:g =group:g]]
  (to-group-ui-v0 flag net (drop-fleet group))
::
++  to-group-ui-5
  |=  [=net:g =group:g]
  ^-  group-ui:v5:g
  :*  group
      ::  init
      ?:(?=(%pub -.net) & load.net)
      ::  member count
      ~(wyt by fleet.group)
  ==
::
++  to-group-ui-2
  |=  [=flag:g =net:g =group:g]
  ^-  group-ui:v2:g
  :-  (to-group-2 group)
  ?.  ?=(%sub -.net)  ~
  =/  =status:neg
    (read-status:neg bowl [p.flag %groups])
  ?+  status  ~
    %match  `[%chi ~]
    %clash  `[%lev ~]
  ==
++  to-group-ui-v0
  |=  [=flag:g =net:g =group:g]
  ^-  group-ui:zero
  :_  ?.  ?=(%sub -.net)  ~
      =/  =status:neg
        (read-status:neg bowl [p.flag %groups])
      ?+  status  ~
        %match  `[%chi ~]
        %clash  `[%lev ~]
      ==
  :*  fleet.group
      cabals.group
      zones.group
      zone-ord.group
      bloc.group
      channels.group
      imported.group
      cordon.group
      secret.group
      meta.group
  ==
::
++  to-log-2
  |=  =log:g
  ^-  log:v2:g
  (run:log-on:g log to-diff-2)
::
++  to-diff-2
  |=  =diff:g
  ^-  diff:v2:g
  ?.  ?=(%create -.diff)  diff
  diff(p (to-group-2 p.diff))
::
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ~|  `wire`pole
  ?+    pole  ~|(bad-agent-take/pole !!)
      ~   cor
      [%epic ~]  cor
      [%cast ship=@ name=@ ~]  cor
      [%logs ~]  cor
      [%helm *]  cor
      [%activity %submit *]  cor
      [%groups %role ~]  cor
      [?(%hark %groups %chat %heap %diary) ~]  cor
  ::
      [%hi ship=@ ~]
    =/  =ship  (slav %p ship.pole)
    (take-hi ship sign)
  ::
      [%gangs %invite ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  cor
    %.  cor
    (slog leaf/"Error giving invite" u.p.sign)
  ::
      [%groups ship=@ name=@ %proxy ~]
    ?>  ?=(%poke-ack -.sign)
    ::  whether it's an ack or nack, nothing to do on our end
    ?~  p.sign  cor
    %-  (slog leaf/"Error forwarding poke" u.p.sign)
    cor
  ::
      [%groups ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    ?:  ?&  ?=(%kick -.sign)
            !(~(has by groups) ship name.pole)
        ==
      cor
    go-abet:(go-agent:(go-abed:group-core ship name.pole) rest.pole sign)
  ::
      [%gangs %index ship=@ ~]
    (take-gang-index (slav %p ship.pole) sign)
  ::
      [%gangs ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    ga-abet:(ga-agent:(ga-abed:gang-core ship name.pole) rest.pole sign)
  ::
      [%chan app=@ ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    =/  =nest:g  [app.pole ship name.pole]
    (take-chan nest sign)
  ::
      [%channels ~]
    (take-channels sign)
  ::
      [%contact ~]
    (take-contact sign)
  ==
::
++  arvo
  |=  [=(pole knot) sign=sign-arvo]
  ^+  cor
  ?+  pole  ~|(bad-arvo-take/pole !!)
      [%~.~ %cancel-retry rest=*]  cor
  ::
      [%~.~ %retry rest=*]
    =^  caz=(list card)  subs
      (~(handle-wakeup s [subs bowl]) pole)
    (emil caz)
  ::
      [%load %active-channels ~]
    ::
    =.  groups
      %-  ~(run by groups)
      |=  [=net:g =group:g]
      =/  nests
        ~(tap in ~(key by channels.group))
      :-  net
      %_  group  active-channels
        %-  silt
        %+  skim  nests
        |=  =nest:g
        .^(? %gu (channel-scry nest))
      ==
    cor
  ==
::
++  subscribe
  |=  [=wire =dock =path]
  |=  delay=?
  =^  caz=(list card)  subs
    (~(subscribe s [subs bowl]) wire dock path delay)
  (emil caz)
::
++  watch-channels
  (subscribe /channels [our.bowl %channels] /v1)
::
++  take-channels
  |=  =sign:agent:gall
  ?+    -.sign  cor
  ::
      %kick
    (watch-channels &)
  ::
      %fact
    ?.  =(%channel-response-2 p.cage.sign)  cor
    =+  !<(=r-channels:v7:old:d q.cage.sign)
    =*  rc  r-channel.r-channels
    ?+    -.rc  cor
        %create
      ?.  (~(has by groups) group.perm.rc)  cor
      =+  group=(~(got by groups) group.perm.rc)
      %_  cor  groups
        %+  ~(put by groups)
          group.perm.rc
        %_  group  active-channels
          (~(put in active-channels.group) nest.r-channels)
        ==
      ==
    ::
        %join
      ?.  (~(has by groups) group.rc)  cor
      =+  group=(~(got by groups) group.rc)
      %_  cor  groups
        %+  ~(put by groups)
          group.rc
        %_  group  active-channels
          (~(put in active-channels.group) nest.r-channels)
        ==
      ==
    ::
    ::XX  this is inefficient, but %leave, unlike %join and %create,
    ::    does not carry group information. thus, we have
    ::    to comb through our groups to find matches.
    ::
        %leave
      %_  cor  groups
        %-  ~(run by groups)
        |=  [=net:g =group:g]
        ^-  [_net _group]
        ?:  =(~ channels.group)
          [net group]
        ?.  (~(has by channels.group) nest.r-channels)
          [net group]
        :-  net
        %_  group  active-channels
          (~(del in active-channels.group) nest.r-channels)
        ==
      ==
    ==
  ==
::
++  watch-contact
  (subscribe /contact [our.bowl %contacts] /news)
::
++  take-contact
  |=  =sign:agent:gall
  ?+  -.sign  cor
      %kick
    (watch-contact &)
  ::
      %watch-ack
    cor
  ::
      %fact
    =+  !<(=news-0:tac q.cage.sign)
    ?~  con.news-0  cor
    %-  emil
    %+  turn  ~(tap in groups.con.news-0)
    |=  =flag:g
    [%pass /gangs/(scot %p p.flag)/[q.flag]/preview %agent [p.flag dap.bowl] %watch /v1/groups/(scot %p p.flag)/[q.flag]/preview]
  ==
::
++  watch-epic
  |=  [her=ship delay=?]
  ^+  cor
  =/  =wire  /epic
  =/  =dock  [her dap.bowl]
  ?:  (~(has by wex.bowl) [wire dock])
    cor
  ((subscribe wire dock wire) delay)
::
++  watch-chan
  |=  =nest:g
  ^+  cor
  ?.  =(our.bowl p.q.nest)
    =/  =wire  /chan/[p.nest]/(scot %p p.q.nest)/[q.q.nest]
    ?:  (~(has by wex.bowl) [wire p.q.nest dap.bowl])
      cor
    (emit [%pass wire %agent [p.q.nest dap.bowl] %watch `path`wire])
  ::
  =/  gs  ~(tap by groups)
  |-
  ?~  gs
    ~|(no-group-found/nest !!)
  =/  [=flag:g =net:g =group:g]  i.gs
  ?.  (~(has by channels.group) nest)
    $(gs t.gs)
  ?.  (go-can-read:(go-abed:group-core flag) src.bowl (~(got by channels.group) nest))
    $(gs t.gs)
  =/  =preview:channel:v2:g
    =,  group
    :*  nest
        meta:(~(got by channels.group) nest)
        flag  meta  cordon  now.bowl  secret.group
    ==
  =.  cor  (emit %give %fact ~ channel-preview+!>(preview))
  (emit %give %kick ~ ~)
::
++  take-chan
  |=  [=nest:g =sign:agent:gall]
  =/  =wire  =,(nest /chan/[p]/(scot %p p.q)/[q.q])
  ^+  cor
  ?+    -.sign  ~|(bad-chan-take/[-.sign nest] !!)
      %watch-ack
    ?~  p.sign  cor
    :: TODO: propagate upwards
    %-  (slog leaf/"Failed to fetch group" u.p.sign)
    cor
  ::
      %fact
    ?.  =(%channel-preview p.cage.sign)
      cor
    =+  !<(=preview:channel:v2:g q.cage.sign) :: XX: really necessary?
    =.  cor  (emit %give %fact ~[wire] cage.sign)
    (emit %give %kick ~[wire] ~)
  ::
      %kick  :: XX: better?
    (emit %give %kick ~[wire] ~)
  ==
::
++  from-self  =(our src):bowl
++  pass-hark
  |=  =new-yarn:ha
  ^-  card
  =/  =wire  /hark
  =/  =dock  [our.bowl %hark]
  =/  =cage  hark-action-1+!>([%new-yarn new-yarn])
  [%pass wire %agent dock %poke cage]
++  spin
  |=  [=rope:ha wer=path but=(unit button:ha) con=(list content:ha)]
  ^-  new-yarn:ha
  [& & rope con wer but]
::
++  give-invites
  |=  [=flag:g ships=(set ship)]
  ?.  =(p.flag our.bowl)  cor
  %-  emil
    %+  turn
      ~(tap in ships)
    |=  =ship
    ^-  card
    =/  cage  group-invite+!>(`invite:g`[flag ship])
    =/  line  `wire`/gangs/(scot %p p.flag)/[q.flag]/invite
    [%pass line %agent [ship dap.bowl] %poke cage]
::
++  get-channel-rope
  |=  [=nest:g =id-post:d id-reply=(unit id-reply:d)]
  ^-  (unit rope:ha)
  =/  prefix  (channel-scry nest)
  ?.  .^(has=? %gu prefix)  ~
  =/  ch-path=path
    ?~  id-reply
      (welp prefix /hark/rope/(scot %ud id-post))
    (welp prefix /hark/rope/(scot %ud id-post)/(scot %ud u.id-reply))
  =/  =path  (snoc ch-path %noun)
  .^((unit rope:ha) %gx path)
::
++  group-core
  |_  [=flag:g =net:g =group:g gone=_|]
  ++  go-core  .
  ++  go-abet
    =.  groups
      ?:  gone
        (~(del by groups) flag)
      (~(put by groups) flag net group)
    ?.  gone  cor
    ::  delete group
    ::
    =?  cor  !=(p.flag our.bowl)  (emil leave:go-pass)
    =/  =action:v5:g  [flag now.bowl %del ~]
    (give %fact ~[/groups/ui] group-action-4+!>(action))
  ++  go-abed
    |=  f=flag:g
    ^+  go-core
    ~|  flag=f
    =/  [n=net:g gr=group:g]  (~(got by groups) f)
    go-core(flag f, group gr, net n)
  ::
  ++  go-area  `path`/groups/(scot %p p.flag)/[q.flag]
  ++  go-rope
    |=  thread=path
    [`flag ~ q.byk.bowl (welp /(scot %p p.flag)/[q.flag] thread)]
  ++  go-link
    |=  link=path
    (welp /groups/(scot %p p.flag)/[q.flag] link)
  ++  go-is-our-bloc
    (~(has in go-bloc-who) our.bowl)
  ++  go-is-bloc
    |(=(src.bowl p.flag) (~(has in go-bloc-who) src.bowl))
  ++  go-bloc-who
    %+  roll  ~(tap by fleet.group)
    |=  [[who=ship =vessel:fleet:g] out=(set ship)]
    ?:  =(~ (~(int in sects.vessel) bloc.group))
      out
    (~(put in out) who)
  ::
  ++  go-activity
    =,  activity
    |=  $=  concern
        $%  [%join =ship]
            [%kick =ship]
            [%flag-post key=message-key =nest:d group=flag:g]
            [%flag-reply key=message-key parent=message-key =nest:d group=flag:g]
            [%role =ship roles=(set sect:g)]
            [%ask =ship]
        ==
    ^+  go-core
    =.  cor
      %-  submit-activity
      ^-  action
      =,  concern
      :-  %add
      ?-  -.concern
        %ask   [%group-ask ^flag ship]
        %join  [%group-join ^flag ship]
        %kick  [%group-kick ^flag ship]
        %role  [%group-role ^flag ship roles]
        %flag-post  [%flag-post key nest group]
        %flag-reply  [%flag-reply key parent nest group]
      ==
    go-core
  ::
  ++  go-channel-hosts
    ^-  (set ship)
    %-  ~(gas in *(set ship))
    %+  turn
      ~(tap by channels.group)
    |=  [=nest:g *]
    p.q.nest
  ::
  ++  go-is-banned
    |=  =ship
    =*  cordon  cordon.group
    ?&  =(-.cordon %open)
        ?-  -.cordon
            ?(%shut %afar)  |
            %open
          ?|  (~(has in ranks.ban.cordon) (clan:title ship))
              (~(has in ships.ban.cordon) ship)
          ==
        ==
    ==
  ++  go-pass
    |%
    ++  leave
      ^-  (list card)
      =/  =wire  (snoc go-area %updates)
      =/  =dock  [p.flag dap.bowl]
      =^  caz=(list card)  subs
        (~(unsubscribe s [subs bowl]) wire dock)
      caz
    ::
    ++  remove-self
      ^-  card
      =/  =wire  (snoc go-area %proxy)
      =/  =dock  [p.flag dap.bowl]
      =/  =cage
        :-  %group-action-4
        !>  ^-  action:v5:g
        [flag now.bowl %fleet (silt our.bowl ~) %del ~]
      [%pass wire %agent dock %poke cage]
    ::
    ++  leave-channels
      |=  nests=(list nest:g)
      ^-  (list card)
      %+  murn
          nests
      |=  nes=nest:g
      ^-  (unit card)
      ?.  ?=(?(%chat %diary %heap) p.nes)
        ~
      =/  =dock  [our.bowl %channels]
      =/  action=a-channels:d  [%channel nes %leave ~]
      =/  =cage  channel-action-1+!>(action)
      =/  =wire  (snoc go-area %leave-channels)
      `[%pass wire %agent dock %poke cage]
    ::
    ++  join-channels
      |=  nests=(list nest:g)
      ^-  (list card)
      %+  murn
          nests
      |=  nes=nest:g
      ^-  (unit card)
      ?.  ?=(?(%chat %diary %heap) p.nes)
        ~
      =/  =dock  [our.bowl %channels]
      =/  action=a-channels:d  [%channel nes %join flag]
      =/  =cage  channel-action-1+!>(action)
      =/  =wire  (snoc go-area %join-channels)
      `[%pass wire %agent dock %poke cage]
    ::
    ++  go-wake-members
      ^-  (list card)
      %+  turn
        ~(tap in (~(del in ~(key by fleet.group)) our.bowl))
      |=  who=ship
      ^-  card
      =/  =wire  (snoc go-area %wake)
      =/  =cage  noun+!>([%group-wake flag])
      [%pass wire %agent [who dap.bowl] %poke cage]
    --
  ::
  ++  go-leave
    |=  send-remove=?
    ::NOTE  we leave *all* channels, not just those that
    ::      are joined.
    ::
    =/  channels  ~(tap in ~(key by channels.group))
    =.  cor
      (emil (leave-channels:go-pass channels))
    =.  cor
      (submit-activity [%del %group flag])
    =?  cor  send-remove
      (emit remove-self:go-pass)
    =.  cor
      (emit %give %fact ~[/groups /groups/ui] group-leave+!>(flag))
    =.  cor
      (emit %give %fact ~[/v1/groups /v1/groups/ui] group-leave+!>(flag))
    go-core(gone &)
  ::
  ++  go-init
    |=  admins=(set ship)
    =.  cabals.group
      %+  ~(put by cabals.group)  %admin
      :_  ~
      ['Admin' 'Admins can add and remove channels and edit metadata' '' '']
    =.  bloc.group  (~(put in bloc.group) %admin)
    =.  zones.group
      %+  ~(put by zones.group)  %default
      :-  ['Sectionless' '' '' '']
      %+  murn  ~(tap by channels.group)
      |=  [=nest:g =channel:g]
      ^-  (unit nest:g)
      ?.  =(zone.channel %default)
        ~
      `nest
    =.  zone-ord.group  (~(push of zone-ord.group) %default)
    =.  fleet.group
      %-  ~(urn by fleet.group)
      |=  [=ship =vessel:fleet:g]
      ?.  (~(has in admins) ship)
        vessel
      vessel(sects (~(put in sects.vessel) %admin))
    ::XX  should not we crash here? +go-init is called
    ::    on a %group-create poke, that sets the flag
    ::    to [our.bowl name.create]
    ::
    ?.  =(our.bowl p.flag)
      (go-safe-sub &)
    =/  our=vessel:fleet:g  (~(gut by fleet.group) our.bowl *vessel:fleet:g)
    =.  sects.our  (~(put in sects.our) %admin)
    =.  fleet.group  (~(put by fleet.group) our.bowl our)
    =/  =diff:g  [%create group]
    (go-tell-update now.bowl diff)
  ::
  ++  go-has-sub
    (~(has by wex.bowl) [(snoc go-area %updates) p.flag dap.bowl])
  ::
  ++  go-safe-sub
    |=  init=_|
    ^+  go-core
    ?:  |(go-has-sub =(our.bowl p.flag))
      go-core
    (go-sub init |)
  ::
  ++  go-sub
    |=  [init=_| delay=?]
    ^+  go-core
    =/  =time
      ?.(?=(%sub -.net) *time p.net)
    =/  base=wire  (snoc go-area %updates)
    =/  =path      (snoc `path`[%v1 base] ?:(init %init (scot %da time)))
    =.  cor  ((subscribe base [p.flag dap.bowl] path) delay)
    go-core
  ::
  ::
  ++  go-watch
    |=  [ver=?(%v0 %v1 %v2) =(pole knot)]
    ^+  go-core
    ?+    pole  !!
      ::
        [%updates rest=*]
      ?>  ?=(?(%v0 %v1) ver)
      (go-pub ver rest.pole)
    ::
        [%ui ~]       ?>(?=(?(%v0 %v1) ver) go-core)
        [%preview ~]  (go-preview ver)
    ==
  ::
  ++  go-preview
    |=  ver=?(%v0 %v1 %v2)
    =/  allow=?
      ?-  -.cordon.group
          %afar  &
          %open  !secret.group  :: should never be secret
        ::
            %shut
          ::  allow previews of a private group:
          ::  (1) if it is *not* secret, or
          ::  (2) the viewer is on the invitation list
          ::
          ?|  !secret.group
              (~(has in pend.cordon.group) src.bowl)
          ==
        ==
    ::  access control: crash if we are on v0, v1
    ::  and we disallow the preview
    ::
    ?<  &(?=(%v0 %v1) !allow)
    =/  =preview:g
      =,  group
      [flag meta cordon now.bowl secret.group ~(wyt by fleet)]
    =.  cor
      ?-    ver
          %v0
        (emit %give %fact ~ group-preview+!>((to-preview-2 preview)))
      ::
          %v1
        =/  =preview:v5:g  preview
        (emit %give %fact ~ group-preview-1+!>(preview))
      ::
          %v2
        ?.  allow
          ?:  secret.group
            ::  conceal secret private group
            ::
            =/  pev=preview-response:v6:g  |+%missing
            (emit %give %fact ~ group-preview-2+!>(pev))
          =/  pev=preview-response:v6:g  |+%forbidden
          (emit %give %fact ~ group-preview-2+!>(pev))
        ::
        =/  pev=preview-response:v6:g  &+preview
        (emit %give %fact ~ group-preview-2+!>(pev))
      ==
    =.  cor
      (emit %give %kick ~ ~)
    go-core
  ::
  ++  go-peek
    |=  =(pole knot)
    ^-  (unit (unit cage))
    :-  ~
    ?+    pole  ~
        [%hosts ~]
      `ships+!>(go-channel-hosts)
      ::
        [%fleet %ships ~]
      `ships+!>(~(key by fleet.group))
      ::
        [%fleet ship=@ %vessel ~]
      =/  src  (slav %p ship.pole)
      `noun+!>((~(got by fleet.group) src))
      ::
        [%fleet ship=@ %is-bloc ~]
      =/  src  (slav %p ship.pole)
      `loob+!>((~(has in go-bloc-who) src))
      ::
        [%fleet ship=@ %is-ban ~]
      =/  src  (slav %p ship.pole)
      `loob+!>((go-is-banned src))
      ::
        [%channel app=@ ship=@ name=@ rest=*]
      =/  nes=nest:g  [app.pole (slav %p ship.pole) name.pole]
      ?+    rest.pole  ~
          [%can-read member=@ ~]
        ?~  channel=(~(get by channels.group) nes)
          `loob+!>(`?`|)
        =/  member  (slav %p member.rest.pole)
        `loob+!>((go-can-read member u.channel))
        ::
          [%can-write member=@ ~]
        =/  member  (slav %p member.rest.pole)
        =-  `noun+!>(-)
        ?:  |((go-is-banned member) !(~(has by fleet.group) member))  ~
        %-  some
        :-  bloc=(~(has in go-bloc-who) member)
        sects=sects:(~(got by fleet.group) member)
      ==
      ::
        [%can-read ~]
      :+  ~  %noun
      !>  ^-  $-([ship nest:g] ?)
      |=  [=ship =nest:g]
      ?~  cha=(~(get by channels.group) nest)  |
      (go-can-read ship u.cha)
    ==
  ::
  ++  go-can-read
    |=  [src=ship =channel:g]
    =/  open  =(-.cordon.group %open)
    =/  ves  (~(get by fleet.group) src)
    =/  visible  =(~ readers.channel)
    ?:  (go-is-banned src)  |
    ?:  ?|  (~(has in go-bloc-who) src)
            &(open visible)
            &(!=(~ ves) visible)
        ==
      &
    ?~  ves  |
    !=(~ (~(int in readers.channel) sects.u.ves))
  ++  go-agent
    |=  [=wire =sign:agent:gall]
    ^+  go-core
    ?+  wire  !!
        [%updates ~]  (go-take-update sign)
        [%wake ~]     go-core
    ::
        [?(%join-channels %leave-channels) ~]
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign
        go-core
      %.  go-core
      ?-    i.wire
        ::
            %join-channels
          (slog leaf/"Failed to join channel" u.p.sign)
        ::
            %leave-channels
          (slog leaf/"Failed to leave channel" u.p.sign)
      ==
    ::
    ==
  ::
  ++  go-take-update
    |=  =sign:agent:gall
    ^+  go-core
    ?+    -.sign  (go-sub | &)
        %kick
      ?>  ?=(%sub -.net)
      (go-sub !load.net &)
    ::
        %watch-ack
      =?  cor  (~(has by xeno) flag)
        ga-abet:(ga-watched:(ga-abed:gang-core flag) p.sign)
      %.  go-core
      ?~  p.sign  same
      (slog leaf/"Failed subscription" u.p.sign)
    ::
        %fact
      =*  cage  cage.sign
      ::  XX: does init need to be handled specially?
      ?+  p.cage  ~|(bad-mark+p.cage !!)
        %group-log-4     (go-apply-log !<(log:g q.cage))
        %group-update-4  (go-update !<(update:g q.cage))
        %group-init-4    (go-fact-init !<(init:g q.cage))
      ==
    ==
  ::
  ++  go-proxy
    |=  =update:v5:g
    ^+  go-core
    =*  diff  q.update
    ::  don't allow anyone else to proxy through us
    ?.  =(src.bowl our.bowl)
      ~|("%group-action poke failed: only allowed from self" !!)
    ::  must have permission to write
    ?.  ?|  go-is-bloc
            ?=(%flag-content -.diff)
            ?&(?=(%fleet -.diff) ?=([%add ~] q.diff))
        ==
      ~|("%group-action poke failed: can't write to host" !!)
    =/  =wire  (snoc go-area %proxy)
    =/  =dock  [p.flag dap.bowl]
    =/  =cage  group-action-4+!>([flag update])
    =.  cor  (emit %pass wire %agent dock %poke cage)
    go-core
  ::
  ++  go-pub
    |=  [ver=?(%v0 %v1) =path]
    ^+  go-core
    ?>  ?=(%pub -.net)
    =;  =cage
      =.  cor  (give %fact ~ cage)
      go-core
    ?:  ?=([%init ~] path)
      =/  [=time *]  (need (ram:log-on:g p.net))
      ?:  ?=(%v0 ver)
        group-init-3+!>([time (to-group-2 group)])
      ::  v1
      group-init-4+!>([time group])
    ?>  ?=([@ ~] path)
    =/  =time  (slav %da i.path)
    =/  =log:g
      (lot:log-on:g p.net `time ~)
    ?:  ?=(%v0 ver)
      group-log-3+!>((to-log-2 log))
    ::  %v1
    group-log-4+!>(log)
  ::
  ++  go-apply-log
    |=  =log:g
    =/  updates=(list update:g)
      (tap:log-on:g log)
    %+  roll  updates
    |=  [=update:g go=_go-core]
    (go-update:go update)
  ::
  ++  go-fact-init
    |=  [=time gr=group:g]
    =.  group  gr
    =.  net  [%sub time &]
    =/  create=diff:v5:g  [%create group]
    =/  readable-channels
      %-  ~(gas in *(set nest:g))
      %+  murn  ~(tap in channels.group)
      |=  [ch=nest:g =channel:g]
      ?.  (go-can-read our.bowl channel)  ~
      [~ ch]
    =.  cor
      (give %fact ~[/groups /groups/ui] group-action-3+!>(`action:v2:g`[flag now.bowl (to-diff-2 create)]))
    =.  cor
      (give %fact ~[/groups /groups/ui] gang-gone+!>(flag))
    =.  cor
      (give %fact ~[/v1/groups /v1/groups/ui] group-action-4+!>(`action:v5:g`[flag now.bowl create]))
    =.  cor
      (give %fact ~[/v1/groups /v1/groups/ui] gang-gone+!>(flag))
    =.  cor
      (emil (join-channels:go-pass ~(tap in readable-channels)))
    go-core
  ::
  ++  go-give-update
    |=  [=time =diff:g]
    ^+  go-core
    =/  v0-paths=(set path)
      %+  roll  ~(val by sup.bowl)
      |=  [[=ship =path] out=(set path)]
      ?.  =((scag 4 path) (snoc go-area %updates))
        out
      (~(put in out) path)
    =.  v0-paths  (~(put in v0-paths) (snoc go-area %ui))
    =/  v1-paths=(set path)
      %+  roll  ~(val by sup.bowl)
      |=  [[=ship =path] out=(set path)]
      ?.  =((scag 5 path) (snoc `^path`[%v1 go-area] %updates))
        out
      (~(put in out) path)
    =.  v1-paths  (~(put in v1-paths) (snoc `path`[%v1 go-area] %ui))
    ::
    =/  diff-2=diff:v2:g
      ?:  ?=(%create -.diff)
        diff(p (to-group-2 p.diff))
      diff
    =.  cor  %^  give  %fact
               ~[/groups /groups/ui]
             group-action-3+!>(`action:v2:g`[flag time diff-2])
    =.  cor  %^  give  %fact
               ~(tap in v0-paths)
             group-update-3+!>(`update:v2:g`[time diff-2])
    =.  cor  %^  give  %fact
               ~[/v1/groups /v1/groups/ui]
             group-action-4+!>(`action:v5:g`[flag time diff])
    =.  cor  %^  give  %fact
               ~(tap in v1-paths)
             group-update-4+!>(`update:v5:g`[time diff])
    go-core
  ::
  ++  go-tell-update
    |=  [=time =diff:g]
    ^+  go-core
    =.  go-core  (go-give-update time diff)
    ?.  ?=(%pub -.net)
      go-core
    =.  p.net
      (put:log-on:g p.net time diff)
    go-core
  ::
  ++  go-update
    |=  [=time =diff:g]
    ^+  go-core
    =.  go-core
      ::  For channel edits, only emit update if something actually changed
      ?:  ?&  ?=(%channel -.diff)
              ?=(%edit -.q.diff)
          ==
        =/  =channel:g  (~(got by channels.group) p.diff)
        =/  new-channel=channel:g  channel.q.diff
        ::  Only emit update if channel data actually changed
        ?.  =(channel new-channel)
          (go-tell-update time diff)
        go-core
      (go-tell-update time diff)
    =.  net
      ?:    ?=(%pub -.net)
        [%pub (put:log-on:g p.net time diff)]
      [%sub time load.net]
    ?-  -.diff
      %channel  (go-channel-update [p q]:diff)
      %fleet    (go-fleet-update [p q]:diff)
      %cabal    (go-cabal-update [p q]:diff)
      %bloc     (go-bloc-update p.diff)
      %cordon   (go-cordon-update p.diff)
      %create   go-core(group p.diff)
      %zone     (go-zone-update +.diff)
      %meta     (go-meta-update p.diff)
      %secret   (go-secret-update p.diff)
      %del      (go-leave |)
      %flag-content  (go-flag-content +:diff)
    ==
  ::
  ++  go-secret-update
    |=  secret=?
    =.  secret.group  secret
    go-core
  ++  go-meta-update
    |=  meta=data:meta
    =.  meta.group  meta
    go-core
  ++  go-flag-content
    |=  [=nest:g =post-key:g src=ship]
    =/  posts  (~(gut by flagged-content.group) nest *(map post-key:g flaggers:g))
    =/  flaggers=(unit flaggers:g)  (~(get by posts) post-key)
    =/  channel-flagged
      %+  ~(put by posts)  post-key
      ?~  flaggers  (sy ~[src])
      (~(put in u.flaggers) src)
    =.  flagged-content.group  (~(put by flagged-content.group) nest channel-flagged)
    ?:  |(from-self !go-is-our-bloc)  go-core
    =/  rope=(unit rope:ha)  (get-channel-rope nest post-key)
    ?~  rope  go-core
    =/  link
      (welp /groups/(scot %p p.flag)/[q.flag]/channels ted.u.rope)
    =/  =new-yarn:ha
      %-  spin
      :*  u.rope
          link
          `['See post' link]
          :~  [%ship src]
              ' has reported a post as inappropriate.'
          ==
      ==
    =.  cor  (emit (pass-hark new-yarn))
    =/  new-message-id=message-id:activity  [src post.post-key]
    =/  kind-from-nest=kind:d
      ?:  =(p.nest %chat)  %chat
      ?:  =(p.nest %heap)  %heap
      ?:  =(p.nest %diary)  %diary
      ~|  "Invalid nest kind"  !!
    =/  converted-nest=nest:d  [kind-from-nest p.q.nest q.q.nest]
    =.  go-core
       ?~  reply.post-key
          %+  go-activity  %flag-post
          :*  [new-message-id post.post-key]
              converted-nest
              flag
          ==
        =/  new-reply-message-id=message-id:activity  [src u.reply.post-key]
        %+  go-activity  %flag-reply
        :*  [new-reply-message-id u.reply.post-key]
            [new-message-id post.post-key]
            converted-nest
            flag
        ==
    go-core
  ++  go-zone-update
    |=  [=zone:g =delta:zone:g]
    ^+  go-core
    ?-    -.delta
        %add
      =/  =realm:zone:g  [meta.delta ~]
      =.  zones.group    (~(put by zones.group) zone realm)
      =.  zone-ord.group  (~(push of zone-ord.group) zone)
      go-core
    ::
        %del
      ~|  %cant-delete-default-zone
      ?<  =(%default zone)
      =.  zones.group
        (~(del by zones.group) zone)
      =.  zone-ord.group
        (~(del of zone-ord.group) zone)
      =.  channels.group
        %-  ~(run by channels.group)
        |=  =channel:g
        channel(zone ?:(=(zone zone.channel) %default zone.channel))
      go-core
    ::
        %edit
      =.  zones.group
        %+  ~(jab by zones.group)  zone
        |=  realm:zone:g
        +<(met meta.delta)
      go-core
    ::
        %mov
      =.  zone-ord.group
        (~(into of zone-ord.group) idx.delta zone)
      go-core
    ::
        %mov-nest
      ?.  (~(has by zones.group) zone)  go-core
      =/  =realm:zone:g  (~(got by zones.group) zone)
      ?.  (~(has of ord.realm) nest.delta)  go-core
      =.  ord.realm
        (~(into of ord.realm) [idx nest]:delta)
      =.  zones.group    (~(put by zones.group) zone realm)
      go-core
    ==
  ++  go-bloc-update
    |=  =diff:bloc:g
    ?>  go-is-bloc
    ^+  go-core
    =.  bloc.group
      ?-  -.diff
        %add  (~(uni in bloc.group) p.diff)
        %del  (~(dif in bloc.group) p.diff)
      ==
    go-core
  ++  go-cordon-update
    |=  =diff:cordon:g
    |^  ^+  go-core
    ?-  -.diff
      %open     (open p.diff)
      %shut     (shut p.diff)
      %swap     ?>(go-is-bloc =.(cordon.group p.diff go-core))
    ==
    ::
    ++  open
      |=  =diff:open:cordon:g
      ^+  go-core
      ?>  go-is-bloc
      =*  cordon  cordon.group
      ?>  ?=(%open -.cordon)
      ?-  -.diff
      ::
          %add-ships
        ?<  ?|  &((~(has in p.diff) our.bowl) =(p.flag our.bowl))
                %+  lth  0
                %~  wyt  in
                (~(int in p.diff) go-channel-hosts)
            ==
        =.  fleet.group
        %-  malt
          %+  skip
            ~(tap by fleet.group)
          |=  [=ship =vessel:fleet:g]
          (~(has in p.diff) ship)
        =.  ships.ban.cordon  (~(uni in ships.ban.cordon) p.diff)
        %+  go-give-update
          now.bowl
        [%fleet p.diff [%del ~]]
      ::
          %del-ships
        =.  ships.ban.cordon  (~(dif in ships.ban.cordon) p.diff)
        go-core
      ::
          %add-ranks
        =/  foes
          %-  malt
          %+  skim
            ~(tap by fleet.group)
          |=  [=ship =vessel:fleet:g]
          (~(has in p.diff) (clan:title ship))
        =.  fleet.group  (~(dif by fleet.group) foes)
        =.  ranks.ban.cordon  (~(uni in ranks.ban.cordon) p.diff)
        %+  go-give-update
          now.bowl
        [%fleet ~(key by foes) [%del ~]]
      ::
          %del-ranks
        =.  ranks.ban.cordon  (~(dif in ranks.ban.cordon) p.diff)
        go-core
      ==
    ::
    ++  shut
      |=  =diff:shut:cordon:g
      ^+  go-core
      =*  cordon  cordon.group
      ?>  ?=(%shut -.cordon)
      ?+    [-.diff p.diff]  !!  :: should never happen, compiler bug
      ::
          [%add-ships %pending]
        ?>  go-is-bloc
        =.  pend.cordon.group  (~(uni in pend.cordon) q.diff)
        =.  ask.cordon.group  (~(dif in ask.cordon) q.diff)
        =.  cor  (give-invites flag q.diff)
        go-core
      ::
          [%del-ships %pending]
        ?>  go-is-bloc
        =.  pend.cordon.group  (~(dif in pend.cordon) q.diff)
        go-core
      ::
          [%add-ships %ask]
        ?>  |(go-is-bloc =(~(tap in q.diff) ~[src.bowl]))
        =.  ask.cordon.group  (~(uni in ask.cordon) q.diff)
        =/  ships  q.diff
        ?:  from-self  go-core
        =/  link  (go-link /edit/members)
        =/  =new-yarn:ha
          %-  spin
          :*  (go-rope /asks)
              link
              `['View all members' link]
              %+  welp
                ^-  (list content:ha)
                %+  join  `content:ha`', '
                `(list content:ha)`(turn ~(tap in ships) |=(=ship ship/ship))
              :~  ?:  =(~(wyt in ships) 1)  ' has '
                  ' have '
                  'requested to join '
                  [%emph title.meta.group]
              ==
          ==
        ?.  go-is-our-bloc  go-core
        =.  cor
          (emit (pass-hark new-yarn))
        =+  ships=~(tap in ships)
        |-
        ?~  ships  go-core
        =.  go-core
          =<  ?>(?=(%shut -.cordon.group) .)  ::NOTE  tmi
          (go-activity %ask i.ships)
        $(ships t.ships)
      ::
          [%del-ships %ask]
        ?>  |(go-is-bloc =(~(tap in q.diff) ~[src.bowl]))
        =.  ask.cordon.group  (~(dif in ask.cordon) q.diff)
        go-core
      ==
    --
  ::
  ++  go-cabal-update
    |=  [=sect:g =diff:cabal:g]
    ?>  go-is-bloc
    ^+  go-core
    ?-    -.diff
        %add
      =/  =cabal:g
        [meta.diff ~]
      =.  cabals.group  (~(put by cabals.group) sect cabal)
      go-core
    ::
        %edit
      ::  TODO: we don't know why we could be desynced on cabals, but we
      ::        need to be safe so we don't enter a loop.
      ::        REFACTOR GROUPS PLZ
      =?  cabals.group  (~(has by cabals.group) sect)
        %+  ~(jab by cabals.group)  sect
        |=  cabal:g
        +<(meta meta.diff)
      go-core
    ::
        %del
      =.  cabals.group  (~(del by cabals.group) sect)
      =/  old-sect=(set sect:g)  (sy sect ~)
      =.  fleet.group
        ::  remove from members as needed
        ::
        %-  ~(urn by fleet.group)
        |=  [* =vessel:fleet:g]
        vessel(sects (~(dif in sects.vessel) old-sect))
      =/  channels  ~(tap by channels.group)
      |-
      ?~  channels  go-core
      =*  next  $(channels t.channels)
      =/  [=nest:g =channel:g]  i.channels
      ::  repair readers as needed
      ::
      =.  go-core  (go-channel-del-sects nest old-sect)
      ::  repair writers as needed
      ::
      =+  .^(has=? %gu (channel-scry nest))
      ::  missing channel
      ?.  has  next
      ::  unsupported channel
      ?.  ?=(?(%chat %heap %diary) p.nest)  next
      ::  not host
      ?:  !=(our.bowl p.q.nest)  next
      =/  cmd=c-channels:d  [%channel nest %del-writers old-sect]
      =/  cage  [%channel-command !>(cmd)]
      =/  dock  [p.q.nest %channels-server]
      =.  cor  (emit %pass /groups/role %agent dock %poke cage)
      next
    ==
  ::
  ++  go-fleet-update
    |=  [ships=(set ship) =diff:fleet:g]
    ^+  go-core
    =/  user-join  &((~(has in ships) src.bowl) =(1 ~(wyt in ships)))
    =/  am-host  =(p.flag our.bowl)
    =/  from-host  =(p.flag src.bowl)
    =/  has-host  (~(has in ships) p.flag)
    =*  cordon  cordon.group
    ?-    -.diff
        %add
      ?>  |(am-host from-host user-join)
      ?<  (go-is-banned src.bowl)
      ?>  ?|  from-host
              ?-  -.cordon
                  ?(%open %afar)  &
                  %shut
                =.  pend.cordon  (~(uni in pend.cordon) ~(key by fleet.group))
                =/  cross  (~(int in pend.cordon) ships)
                =(~(wyt in ships) ~(wyt in cross))
              ==
          ==
      =?  cor  &(!user-join am-host)  (give-invites flag ships)
      =.  fleet.group
        %-  ~(uni by fleet.group)
          %-  malt
          ^-  (list [ship vessel:fleet:g])
          %+  turn
            ~(tap in ships)
          |=  =ship
          ::  only give time when joining
          =/  joined  ?:((~(has in ships) src.bowl) now.bowl *time)
          ::  if ship previously added, retain sects
          =/  vessel  (~(gut by fleet.group) ship *vessel:fleet:g)
          [ship [sects=sects.vessel joined=joined]]
      ?:  from-self  go-core
      =/  link  (go-link /edit/members)
      =/  =new-yarn:ha
        %-  spin
        :*  (go-rope /joins)
            link
            `['View all members' link]
            %+  welp
              ^-  (list content:ha)
              %+  join  `content:ha`', '
              `(list content:ha)`(turn ~(tap in ships) |=(=ship ship/ship))
            :~  ?:  =(~(wyt in ships) 1)  ' has joined '
                ' have joined '
                [%emph title.meta.group]
            ==
        ==
      =?  cor  go-is-our-bloc
        (emit (pass-hark new-yarn))
      =.  go-core
        =+  ships=~(tap in ships)
        |-
        ?~  ships  go-core
        =.  go-core  (go-activity %join i.ships)
        $(ships t.ships)
      ?-  -.cordon
          ?(%open %afar)  go-core
          %shut
        =.  pend.cordon  (~(dif in pend.cordon) ships)
        go-core
      ==
    ::
        %del
      ?<  ?|  &((~(has in ships) our.bowl) =(p.flag our.bowl))
              %+  lth  0
              %~  wyt  in
              (~(int in ships) go-channel-hosts)
          ==
      ?>  ?|  go-is-bloc
              =(p.flag src.bowl)
              (~(has in ships) src.bowl)
          ==
      =.  fleet.group
      %-  malt
        %+  skip
          ~(tap by fleet.group)
        |=  [=ship =vessel:fleet:g]
        (~(has in ships) ship)
      ?:  from-self  go-core
      =/  link  (go-link /edit/members)
      =/  =new-yarn:ha
        %-  spin
        :*  (go-rope /leaves)
            link
            `['View all members' link]
            %+  welp
              ^-  (list content:ha)
              %+  join  `content:ha`', '
              `(list content:ha)`(turn ~(tap in ships) |=(=ship ship/ship))
            :~  ?:  =(~(wyt in ships) 1)  ' has left '
                ' have left '
                [%emph title.meta.group]
            ==
        ==
      =?  cor  go-is-our-bloc
        (emit (pass-hark new-yarn))
      =.  go-core
        =+  ships=~(tap in ships)
        |-
        ?~  ships  go-core
        =.  go-core  (go-activity %kick i.ships)
        $(ships t.ships)
      ?:  (~(has in ships) our.bowl)
        (go-leave |)
      go-core
    ::
        %add-sects
      ?>  go-is-bloc
      ~|  strange-sect/sects.diff
      =.  sects.diff  (~(int in sects.diff) ~(key by cabals.group))
      ?:  =(~ sects.diff)  go-core
      =.  fleet.group
        %-  ~(urn by fleet.group)
        |=  [=ship =vessel:fleet:g]
        ?.  (~(has in ships) ship)  vessel
        vessel(sects (~(uni in sects.vessel) sects.diff))
      ?:  from-self  go-core
      =/  link  (go-link /edit/members)
      =/  ship-list=(list content:ha)
        %+  join  `content:ha`', '
        `(list content:ha)`(turn ~(tap in ships) |=(=ship ship/ship))
      =/  role-list
        %-  crip
        %+  join  ', '
        %+  turn
          ~(tap in sects.diff)
        |=  =sect:g
        =/  cabal  (~(got by cabals.group) sect)
        title.meta.cabal
      =/  =new-yarn:ha
        %-  spin
        :*  (go-rope /add-roles)
            link
            `['View all members' link]
            %+  welp
              ship-list
            :~  ?:  =(~(wyt in ships) 1)  ' is now a(n) '
                ' are now a(n) '
                [%emph role-list]
            ==
        ==
      =?  cor  go-is-our-bloc
        (emit (pass-hark new-yarn))
      =+  ships=~(tap in ships)
      |-
      ?~  ships  go-core
      =.  go-core  (go-activity %role i.ships sects.diff)
      $(ships t.ships)
    ::
        %del-sects
      ?>  go-is-bloc
      ?:  &(has-host (~(has in sects.diff) 'admin'))  go-core
      =.  fleet.group
        %-  ~(urn by fleet.group)
        |=  [=ship =vessel:fleet:g]
        ?.  (~(has in ships) ship)  vessel
        vessel(sects (~(dif in sects.vessel) sects.diff))
      go-core
    ==
  ::
  ++  go-channel-update
    |=  [ch=nest:g =diff:channel:g]
    ^+  go-core
    ?>  go-is-bloc
    =*  by-ch  ~(. by channels.group)
    ?.  |(=(-.diff %add) (has:by-ch ch))  go-core
    ?-    -.diff
        %add
      =.  zones.group  (go-bump-zone ch channel.diff)
      =.  channels.group  (put:by-ch ch channel.diff)
      ?:  from-self  go-core
      =.  cor  (emil (join-channels:go-pass ~[ch]))
      go-core
    ::
        %edit
      =/  prev=channel:g  (got:by-ch ch)
      =.  zones.group  (go-bump-zone ch channel.diff)
      =.  channels.group  (put:by-ch ch channel.diff)
      go-core
    ::
        %del
      =/  =channel:g   (got:by-ch ch)
      =.  zones.group
        ?.  (~(has by zones.group) zone.channel)  zones.group
        %+  ~(jab by zones.group)  zone.channel
        |=(=realm:zone:g realm(ord (~(del of ord.realm) ch)))
      =.  channels.group  (del:by-ch ch)
      go-core
    ::
        %add-sects
      ~|  strange-sect/sects.diff
      ?>  =(~ (~(dif in sects.diff) ~(key by cabals.group)))
      =/  =channel:g  (got:by-ch ch)
      =.  readers.channel  (~(uni in readers.channel) sects.diff)
      =.  channels.group  (put:by-ch ch channel)
      go-core
    ::
        %del-sects
      (go-channel-del-sects ch sects.diff)
    ::
        %zone
      ?.  (has:by-ch ch)  go-core
      =/  =channel:g  (got:by-ch ch)
      ?.  (~(has by zones.group) zone.diff)  go-core
      =.  zones.group
        %+  ~(jab by zones.group)  zone.channel
        |=(=realm:zone:g realm(ord (~(del of ord.realm) ch)))
      =.  zone.channel   zone.diff
      =.  channels.group  (put:by-ch ch channel)
      ?.  (~(has by zones.group) zone.diff)  go-core
      =/  =realm:zone:g  (~(got by zones.group) zone.diff)
      =.  ord.realm  (~(push of ord.realm) ch)
      =.  zones.group  (~(put by zones.group) zone.diff realm)
      go-core
    ::
        %join
      =/  =channel:g  (got:by-ch ch)
      =.  join.channel  join.diff
      =.  channels.group  (put:by-ch ch channel)
      go-core
    ==
  ::
  ++  go-channel-del-sects
    |=  [ch=nest:g sects=(set sect:g)]
    =/  =channel:g  (~(got by channels.group) ch)
    =.  readers.channel  (~(dif in readers.channel) sects)
    =.  channels.group  (~(put by channels.group) ch channel)
    go-core
  ::
  ++  go-bump-zone
    |=  [ch=nest:g =channel:g]
    =/  =zone:g  zone.channel
    ?.  (~(has by zones.group) zone)  zones.group
    %+  ~(jab by zones.group)  zone
    |=(=realm:zone:g realm(ord (~(push of ord.realm) ch)))
  --
::
++  res-gang-index-2
  ^+  cor
  =;  =cage
    =.  cor  (emit %give %fact ~ cage)
    (emit %give %kick ~ ~)
  :-  %group-previews
  !>  ^-  previews:v2:g
  %-  ~(gas by *previews:v2:g)
  %+  murn  ~(tap by groups)
  |=  [=flag:g =net:g =group:g]
  ^-  (unit [flag:g preview:v2:g])
  ?.  &(=(our.bowl p.flag) !secret.group)
    ~
  `[flag =,(group [flag meta cordon now.bowl |])]
::
++  res-gang-index-5
  ^+  cor
  =;  =cage
    =.  cor  (emit %give %fact ~ cage)
    (emit %give %kick ~ ~)
  :-  %group-previews-1
  !>  ^-  previews:v5:g
  %-  ~(gas by *previews:v5:g)
  %+  murn  ~(tap by groups)
  |=  [=flag:g =net:g =group:g]
  ^-  (unit [flag:g preview:v5:g])
  ?.  &(=(our.bowl p.flag) !secret.group)
    ~
  `[flag =,(group [flag meta cordon now.bowl | ~(wyt by fleet)])]
::
::
++  req-gang-index
  |=  =ship
  ^+  cor
  =/  =wire  /gangs/index/(scot %p ship)
  =/  =dock  [ship dap.bowl]
  =/  watch  [%pass wire %agent dock %watch `path`[%v1 wire]]
  %-  emil
  ?:  =(ship our.bowl)  ~[watch]
  :~  [%pass wire %agent dock %leave ~]
      watch
  ==
::
++  hi-and-req-gang-index
  |=  =ship
  ^+  cor
  =/  hi-wire=wire  /helm/hi/(scot %p ship)
  =/  hi-dock=dock  [ship %hood]
  =/  gang-wire  /gangs/index/(scot %p ship)
  =/  gang-dock  [ship dap.bowl]
  %-  emil
  :~  [%pass hi-wire %agent hi-dock %poke %helm-hi !>('')]
      [%pass gang-wire %agent gang-dock %watch `path`[%v1 gang-wire]]
  ==
::
++  hi-ship
  |=  =ship
  ^+  cor
  =/  hi-wire=wire  /hi/(scot %p ship)
  =/  hi-dock=dock  [ship %hood]
  %-  emil
  :~  [%pass hi-wire %agent hi-dock %poke %helm-hi !>('%groups connectivity check')]
  ==
::
++  take-hi
  |=  [=ship =sign:agent:gall]
  ^+  cor
  =/  =path  /hi/(scot %p ship)
  ?+  -.sign  !!
      %kick  (emit %give %kick ~[path] ~)
   ::
      %poke-ack
    =.  cor  (emit [%give %fact ~[path] hi-ship+!>(ship)])
    (emit %give %kick ~[path] ~)
  ==
::
++  take-gang-index
  |=  [=ship =sign:agent:gall]
  ^+  cor
  =/  =path  /gangs/index/(scot %p ship)
  =*  path-v1  `^path`[%v1 path]
  ?+  -.sign  !!
      %kick  (emit %give %kick ~[path path-v1] ~)
  ::
      %watch-ack
    ?~  p.sign  cor
    %-  (slog leaf/"failed to watch gang index" u.p.sign)
    (emit %give %kick ~[path path-v1] ~)
  ::
      %fact
    ?.  =(%group-previews-1 p.cage.sign)  cor
    =+  !<(=previews:v5:g q.cage.sign)
    ::  v1
    =.  cor  (emit %give %fact ~[path-v1] cage.sign)
    =.  cor  (emit %give %kick ~[path-v1] ~)
    ::  v0
    =.  cor
      %:  emit  %give  %fact
        ~[path]
        ::
        :-  %group-previews
        !>(`previews:v2:g`(~(run by previews) to-preview-2))
      ==
    (emit %give %kick ~[path] ~)
  ==
::
++  gang-core
  |_  [=flag:g =gang:g]
  ++  ga-core  .
  ++  ga-abet
    =.  xeno  (~(put by xeno) flag gang)
    ?.  (~(has by groups) flag)  cor
    =/  [=net:g =group:g]  (~(got by groups) flag)
    ?.  &(?=(%sub -.net) !load.net)  cor
    =.  xeno  (~(del by xeno) flag)
    ga-give-update
  ::
  ++  ga-abed
    |=  f=flag:g
    =/  ga=gang:g  (~(gut by xeno) f [~ ~ ~ ~])
    ga-core(flag f, gang ga)
  ::
  ++  ga-activity
    =,  activity
    |=  concern=[%group-invite =ship]
    ^+  ga-core
    =.  cor
      %-  submit-activity
      ^-  action
      [%add %group-invite ^flag ship.concern]
    ga-core
  ::
  ++  ga-area  `wire`/gangs/(scot %p p.flag)/[q.flag]
  ++  ga-pass
    |%
    ++  poke-host  |=([=wire =cage] (pass-host wire %poke cage))
    ++  pass-host
      |=  [=wire =task:agent:gall]
      ^-  card
      [%pass (welp ga-area wire) %agent [p.flag dap.bowl] task]
    ++  add-self
      =/  =action:v5:g  [flag now.bowl %fleet (silt ~[our.bowl]) %add ~]
      (poke-host /join/add group-action-4+!>(action))
    ::
    ++  knock
      =/  ships=(set ship)  (~(put in *(set ship)) our.bowl)
      =/  =action:v5:g  [flag now.bowl %cordon %shut %add-ships %ask ships]
      (poke-host /knock group-action-4+!>(action))
    ++  rescind
      =/  ships=(set ship)  (~(put in *(set ship)) our.bowl)
      =/  =action:v5:g  [flag now.bowl %cordon %shut %del-ships %ask ships]
      (poke-host /rescind group-action-4+!>(action))
    ++  get-preview
      |=  invite=?
      =/  =wire
        (welp ga-area ?:(invite /preview/invite /preview))
      =/  =dock  [p.flag dap.bowl]
      =/  =path  /v2/groups/(scot %p p.flag)/[q.flag]/preview
      =/  watch  [%pass wire %agent dock %watch path]
      ^+  cor
      %-  emil
      ?:  =(p.flag our.bowl)  ~[watch]
      :~  [%pass wire %agent dock %leave ~]
          watch
      ==
    --
  ++  ga-start-join
    |=  join-all=?
    ^+  ga-core
    ::  already in the group
    ?:  (~(has by groups) flag)  ga-core
    =.  cor  (emit (initiate:neg [p.flag dap.bowl]))
    ::  already valid join in progress
    ?:  ?&  ?=(^ cam.gang)
            !?=(?(%knocking %error) progress.u.cam.gang)
        ==
      ga-core
    =.  cam.gang  `[join-all %adding]
    =.  cor  (emit add-self:ga-pass)
    ga-core
  ::
  ++  ga-cancel
    ^+  ga-core
    =.  cam.gang  ~
    =.  cor  ga-give-update
    ga-core
  ::
  ++  ga-knock
    ^+  ga-core
    =.  cam.gang  `[| %knocking]
    =.  cor  (emit knock:ga-pass)
    ga-core
  ::
  ++  ga-rescind
    ^+  ga-core
    =.  cam.gang  ~
    =.  cor  ga-give-update
    =.  cor  (emit rescind:ga-pass)
    ga-core
  ::
  ++  ga-watch
    |=  [ver=?(%v0 %v1 %v2) =(pole knot)]
    ^+  ga-core
    =.  cor  (get-preview:ga-pass |)
    ga-core
  ::
  ++  ga-give-update
    =+  gangs=(~(put by xeno) flag gang)
    =.  cor
      (give %fact ~[/gangs/updates] gangs+!>((~(run by gangs) to-gang-2)))
    =.  cor
      (give %fact ~[/v1/gangs/updates] gangs-1+!>((~(run by gangs) to-gang-5)))
    (give %fact ~[/v2/gangs/updates] gangs-2+!>(`gangs:v6:g`gangs))
  ::
  ++  ga-agent
    |=  [=(pole knot) =sign:agent:gall]
    ^+  ga-core
    ?+    pole  ~|(bad-agent-take/pole !!)
      ::
          [%invite ~]
        ?>  ?=(%poke-ack -.sign)
        :: ?~  p.sign  ga-core
        :: %-  (slog leaf/"Failed to invite {<ship>}" u.p.sign)
        ga-core
      ::
          [%preview inv=?(~ [%invite ~])]
        ?+    -.sign  ~|(weird-take/[pole -.sign] !!)
        ::
          %kick  ga-core  ::  kick for single response sub, just take it
        ::
            %watch-ack
          ?~  p.sign  ga-core
          ::TODO  report retrieval failure
          %-  (slog u.p.sign)
          ga-core
        ::
            %fact
          ?>  ?=(%group-preview-2 p.cage.sign)
          =+  !<(preview=preview-response:v6:g q.cage.sign)
          =.  err.gang
            ?:  ?=(%& -.preview)  ~
            ::  preview error
            `p.preview
          =.  pev.gang
            ?:  ?=(%& -.preview)
              ::  preview
              `p.preview
            ~
          =.  cor  ga-give-update
          =/  =path  (snoc ga-area %preview)
          =?  cor  ?=(%& -.preview)
            =*  pev  p.preview
            %-  emil
            :~  :: v0
                ::
                [%give %fact ~[path] group-preview+!>((to-preview-2 pev))]
                [%give %kick ~[path] ~]
                ::  v1
                ::
                [%give %fact ~[[%v1 path]] group-preview-1+!>(`preview:v5:g`pev)]
                [%give %kick ~[[%v1 path]] ~]
            ==
          =.  cor
            =/  pev=preview-response:v6:g  preview
            (emit %give %fact ~[[%v2 path]] group-preview-2+!>(pev))
          =.  cor
            (emit %give %kick ~[[%v2 path]] ~)
          ?:  from-self  ga-core
          ?~  pev.gang   ga-core
          ?~  vit.gang   ga-core
          ::  only send invites if this came from ga-invite and we
          ::  aren't already in the group somehow
          ?~  inv.pole   ga-core
          ?:  (~(has by groups) flag)  ga-core
          (ga-activity %group-invite src.bowl)
          ::
        ==
      ::
          [%join %add ~]
        ?>  ?=(%poke-ack -.sign)
        ?>  ?=(^ cam.gang)
        ?^  p.sign
          =.  progress.u.cam.gang  %error
          %-  (slog leaf/"Joining failed" u.p.sign)
          ga-core
        =.  progress.u.cam.gang  %watching
        =/  =net:g  [%sub now.bowl |]
        =|  =group:g
        =?  meta.group  ?=(^ pev.gang)  meta.u.pev.gang
        =.  groups  (~(put by groups) flag net group)
        ::
        =.  cor
          go-abet:(go-sub:(go-abed:group-core flag) & |)
        ga-core
      ::
          [%knock ~]
        ?>  ?=(%poke-ack -.sign)
        ?>  ?=(^ cam.gang)
        ?^  p.sign
          =.  progress.u.cam.gang  %error
          %-  (slog leaf/"Knocking failed" u.p.sign)
          ga-core
        =.  cor  ga-give-update
        ga-core
      ::
          [%rescind ~]
        ?>  ?=(%poke-ack -.sign)
        ?^  p.sign
          ?>  ?=(^ cam.gang)
          =.  progress.u.cam.gang  %error
          %-  (slog leaf/"Rescind failed" u.p.sign)
          ga-core
        ga-core
    ==
  ::
  ++  ga-watched
    |=  p=(unit tang)
    ?~  cam.gang  ga-core
    ?^  p
      %-  (slog leaf/"Failed to join" u.p)
      =.  progress.u.cam.gang  %error
      ga-core
    ga-core
  ::
  ++  ga-invite
    |=  =invite:g
    ^+  ga-core
    ::  prevent spamming invites
    ?.  =(~ vit.gang)  ga-core
    ?:  (~(has by groups) p.invite)  ga-core
    %-  (log |.("received invite: {<invite>}"))
    ?:  &(?=(^ cam.gang) ?=(%knocking progress.u.cam.gang))
      %-  (log |.("was knocking: {<gang>}"))
      ::  we only allow adding ourselves if this poke came from the host
      ?>  =(p.flag src.bowl)
      (ga-start-join join-all.u.cam.gang)
    =.  vit.gang  `invite
    =.  cor  (get-preview:ga-pass &)
    =.  cor  ga-give-update
    ga-core
  ::
  ++  ga-invite-reject
    ^+  ga-core
    =.  vit.gang  ~
    =.  cor  ga-give-update
    ga-core
  --
--

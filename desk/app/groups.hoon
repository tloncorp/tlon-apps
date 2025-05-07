::  groups: agent for managing group membership, metadata and permissions
::
::  groups agent can act both as a group server and 
::  as a client to remote groups. unlike channels, this agent it is 
::  not separated into two distinct client and server agents, but
::  rather achieves the separation with two cores:
::  the server core +se-core and client core +go-core.
::
/-  g=groups, ha=hark, h=heap, d=channels, c=chat,
    tac=contacts-0, activity
/-  meta
/+  default-agent, verb, dbug
/+  ver=groups-ver, v=volume, s=subscriber, imp=import-aid, logs
/+  of
/+  neg=negotiate
::  performance, keep warm
/+  groups-json
/*  desk-bill  %bill  /desk/bill
=/  verbose  |
::
%-  %-  agent:neg
    :+  notify=|
      [~.groups^%1 ~ ~]
    %-  my
    :~  %groups^[~.groups^%1 ~ ~]
        %channels-server^[~.channels^%1 ~ ~]
    ==
%-  agent:dbug
%+  verb  |
::
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  current-state
    $:  %7
        groups=net-groups:v7:g
        previews=(map flag preview:g)
        =volume:v
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
      :: log   ~(. logs [our.bowl /logs])
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
    ::TODO enable logging
    `this
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
++  server  dap.bowl
::
++  submit-activity
  |=  =action:activity
  ^+  cor
  ::XX this probably accounts for old ships, but is it still necessary?
  ::
  ?.  .^(? %gu /(scot %p our.bowl)/activity/(scot %da now.bowl)/$)
    cor
  %-  emit
  =/  =cage  [%activity-action !>(`action:activity`action)]
  [%pass /activity/submit %agent [our.bowl %activity] %poke cage]
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+    mark  ~|(bad-mark+mark !!)
      %noun
    ?+    q.vase  !!      
      %reset-all-perms  reset-all-perms
    ::XX review is this necessary
      ::   [%group-wake flag:g]
      :: =+  ;;(=flag:g +.q.vase)
      :: ?.  |(=(our src):bowl =(p.flag src.bowl))
      ::   cor
      :: ?~  g=(~(get by groups) flag)
      ::   cor
      :: go-abet:(go-safe-sub:(go-abed:group-core:cor flag) |)
    ::XX review, what is going on here? 
        %pimp-ready
      ?-  pimp
        ~         cor(pimp `&+~)
        [~ %& *]  cor
        [~ %| *]  (run-import p.u.pimp)
      ==
    ==
    ::
        %group-command
      =+  !<(=c-groups:v7:g vase)
      ?-    -.c-groups
          %create
        ~&  %group-command-create
        =/  =flag:g  [our.bowl name.create-group.c-groups]
        se-abet:(se-c-create:se-core flag create-group.c-groups)
      ::
          %join
        ?>  =(our.bowl p.flag.c-groups)
        =*  server-core  (se-abed:se-core flag.c-groups)
        se-abet:(se-join:server-core token.c-groups)
      ::
          %group
        =*  server-core  (se-abed:se-core flag.c-groups)
        se-abet:(se-c-group:server-core c-group.c-groups)
      ==
    ::
        %group-action-1
      =+  !<(=a-groups:v7:g vase)
      ?-    -.a-groups
          %join
        go-abet:(go-join:go-core [flag token]:a-groups)
      ::
          %group
        =*  group-core  (go-abed:go-core flag.a-groups)
        go-abet:(go-a-group:group-core a-group.a-groups)
      ==
      ::XX is this used for anything important?
      ::   [%group-wake flag:g]
      :: =+  ;;(=flag:g +.q.vase)
      :: ?.  |(=(our src):bowl =(p.flag src.bowl))
      ::   cor
      :: ?~  g=(~(get by groups) flag)
      ::   cor
      :: go-abet:(go-safe-sub:(go-abed:group-core:cor flag) |)
    ::
    ::XX this is quite unreadable. what is going on here?
    ::  XX verify this is in use. if so, 
    ::  introduce a standalone command to do this
    ::   %reset-all-perms  reset-all-perms
    ::   ::XX verify this is used at all
    ::   %reset-group-perms
    :: =+  !<(=flag:g vase)
    :: =/  val  (~(get by groups) flag)
    :: ?~  val
    ::   cor
    :: ((reset-group-perms cor) [flag u.val] cor)
  ::XX  replace with $a-groups %leave poke
    ::   %group-leave
    :: =+  !<(=flag:g vase)
    :: ?>  from-self
    :: ?<  =(our.bowl p.flag)
    :: go-abet:(go-leave:(go-abed:group-core flag) &)
  ::XX use the $c-groups %create poke
    ::   %group-create
    :: ?>  from-self
    :: =+  !<(=create:g vase)
    :: ?>  ((sane %tas) name.create)
    :: =/  =flag:g  [our.bowl name.create-group]
    :: =/  =fleet:g
    ::   %-  ~(run by members.create)
    ::   |=  sects=(set sect:g)
    ::   ^-  vessel:fleet:g
    ::   [sects *time]
    :: =/  =group:g
    ::   :*  fleet
    ::       ~  ~  ~  ~  ~  ~  ~
    ::       cordon.create
    ::       secret.create
    ::       :*  title.create
    ::           description.create
    ::           image.create
    ::           cover.create
    ::       ==
    ::       ~
    ::   ==
    :: =.  groups  (~(put by groups) flag *net:g group)
    :: =.  cor  (give-invites flag ~(key by members.create))
    :: go-abet:(go-init:(go-abed:group-core flag) ~)
    ::
    ::   $?  %group-action-3
    ::       %group-action-2
    ::       %group-action-1
    ::       %group-action-0
    ::   ==
    :: =+  !<(action-2=action:v2:g vase)
    :: =/  =action:g
    ::   ?.  ?=(%create -.q.q.action-2)  action-2
    ::   ~|("group action %create poke unsupported, use %group-create" !!)
    :: $(mark %group-action-4, vase !>(`action:v5:g`action))
    :: ::
    ::     %group-action-4
    :: =+  !<(action=action:v5:g vase)
    :: =.  p.q.action  now.bowl
    :: =/  group-core  (go-abed:group-core p.action)
    :: ?:  &(!=(our.bowl p.p.action) from-self)
    ::   go-abet:(go-proxy:group-core q.action)
    :: go-abet:(go-update:group-core q.action)
  ::XX 
    ::   %group-invite
    :: =+  !<(=invite:g vase)
    :: ?:  =(q.invite our.bowl)
    ::   :: invitee
    ::   ga-abet:(ga-invite:(ga-abed:gang-core p.invite) invite)
    :: :: inviter
    :: =/  cage  group-invite+!>(invite)
    :: (emit [%pass /gangs/invite %agent [q.invite dap.bowl] %poke cage])
  ::XX  replace with $a-groups %join
    ::   %group-join
    :: ?>  from-self
    :: =+  !<(=join:g vase)
    :: ga-abet:(ga-start-join:(ga-abed:gang-core flag.join) join-all.join)
  ::XX deprecated, remove
    ::   %group-knock
    :: ?>  from-self
    :: =+  !<(=flag:g vase)
    :: ga-abet:ga-knock:(ga-abed:gang-core flag)
  ::XX deprecated, remove
    ::   %group-rescind
    :: ?>  from-self
    :: =+  !<(=flag:g vase)
    :: ga-abet:ga-rescind:(ga-abed:gang-core flag)
  ::XX deprecated, remove
    ::   %group-cancel
    :: ?>  from-self
    :: =+  !<(=flag:g vase)
    :: ga-abet:ga-cancel:(ga-abed:gang-core flag)
  ::XX deprecated, remove
    ::   %invite-decline
    :: ?>  from-self
    :: =+  !<(=flag:g vase)
    :: ga-abet:ga-invite-reject:(ga-abed:gang-core flag)
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
    ::XX this need to be migrated for tickets
    :: =.  xeno
    ::   %+  roll  ~(tap by xeno:bak)
    ::   |=  [[=flag:g =gang:g] =_xeno]
    ::   %+  ~(put by xeno)  flag
    ::   ?.  (~(has by xeno) flag)
    ::     gang(cam ~)
    ::   =/  hav  (~(got by xeno) flag)
    ::   :^    cam.hav
    ::       ?~(pev.hav pev.gang pev.hav)
    ::     ?~(vit.hav vit.gang vit.hav)
    ::   ~
    ::  restore the groups we were in, taking care to re-establish
    ::  subscriptions to the group, and to tell %channels to re-establish
    ::  its subscriptions to the groups' channels as well.
    ::
    ::TODO rewrite, code below could be improved
    :: =.  cor
    ::   %+  roll  ~(tap by groups:bak)
    ::   |=  [[=flag:g gr=[=net:g =group:g]] =_cor]
    ::   ?:  (~(has by groups.cor) flag)
    ::     cor
    ::   =.  groups.cor  (~(put by groups.cor) flag gr)
    ::   =/  gc  (go-abed:go-core:cor flag)
    ::   =.  gc  (go-safe-sub:gc |)
    ::   =.  cor  go-abet:gc
    ::   =?  cor  =(p.flag our.bowl)
    ::     (emil:cor go-wake-members:go-pass:goc)
    ::   %-  emil:cor
    ::   %-  join-channels:go-pass:goc
    ::   ~(tap in ~(key by channels.group.gr))
    =.  volume
      :+  base.volume:bak
        (~(uni by area.volume:bak) area.volume)
      (~(uni by chan.volume:bak) chan.volume)
    cor
  ==
::
++  channels-scry
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
      =/  =c-groups:v7:g  [%group flag [%channel nest %del-roles readers.channel]]
      =/  cage  group-command-7+!>(c-groups)
      [%pass wire %agent dock %poke cage]
    ^-  card
    =/  =path  (welp (channels-scry nest) /perm/noun)
    =/  perms  .^(perm:d %gx path)
    ::TODO version channel commands
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
  =?  old  ?=(%5 -.old)  (state-5-to-6 old)
  =?  old  ?=(%6 -.old)  (state-6-to-7 old)
  ::
  ?>  ?=(%7 -.old)
  =.  state  old
  inflate-io
  ::
  ::
  +$  versioned-state
    $%  state-7
        state-6
        state-5
        state-4
        state-3
        state-2
        state-1
        state-0
    ==
  +$  state-0
    $:  %0
        groups=net-groups:v0:g
        xeno=gangs:v0:g
        shoal=(map flag:g dude:gall)
    ==
  ::
  +$  state-1
    $:  %1
      groups=net-groups:v0:g
      ::
        $=  volume
        $:  base=level:v
            area=(map flag:g level:v)  ::  override per group
            chan=(map nest:g level:v)  ::  override per channel
        ==
      ::
        xeno=gangs:v0:g
        ::  graph -> agent
        shoal=(map flag:g dude:gall)
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
  +$  state-6
    $:  %6
        groups=net-groups:v6:g
        =volume:v
        xeno=gangs:v6:g
        =^subs:s
        =pimp:imp
    ==
  ::
  +$   state-7  current-state
  ::
  ++  state-0-to-1
    |=  state-0
    ^-  state-1
    [%1 groups [*level:v ~ ~] xeno shoal]
  ::
  ++  state-1-to-2
    |=  state-1
    ^-  state-2
    [%2 (v2:groups:v0:ver groups) volume xeno shoal]
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
        (~(run by groups) v5:net-group:v2:ver)
        volume
        (~(run by xeno) v5:gang:v2:ver)
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
        (~(run by xeno) v6:gang:v5:ver)
        subs
        ~
    ==
  ::
  ++  state-6-to-7
    |=  state-6
    ^-  state-7
    !!
  --
::
++  inflate-io
  ^+  cor
  ::
  =.  cor  (watch-contacts |)
  =.  cor  (watch-channels |)
  ::
  =.  cor
    %+  roll
      ~(tap by groups)
    |=  [[=flag:g *] =_cor]
    go-abet:(go-safe-sub:(go-abed:go-core:cor flag) |)
  cor
::
++  watch
  |=  =(pole knot)
  ^+  cor
  ~|  watch-path=`path`pole
  ?+  pole  ~|(bad-watch-path+pole !!)
  ::
    ::
    ::  server paths
    ::
      [%server %groups name=@ rest=*]
    se-abet:(se-watch:(se-abed:se-core [our.bowl name.pole]) rest.pole)
  ::
      [%server %groups name=@ %preview ~]
    ?:  (~(has by groups) our.bowl name.pole)
      se-abet:(se-watch:(se-abed:se-core [our.bowl name.pole]) /preview)
    =/  =preview-update:g  ~
    =.  cor  
      (emit %give %fact ~ group-preview-update+!>(preview-update))
    (emit %give %kick ~ ~)
  ::
    ::
    ::  client paths
    ::
  ::
    [%v1 %groups ~]  cor
  ::
      [%v1 %groups ship=@ name=@ rest=*]
    =/  ship=@p  (slav %p ship.pole)
    go-abet:(go-watch:(go-abed:go-core ship name.pole) %v1 rest.pole)
  ::
      :: deprecated
      [%groups %ui ~]  cor
      :: deprecated
      [%gangs %updates ~]  cor
  ::
    :: deprecated
    [%epic ~]  (give %fact ~ epic+!>(okay:g))
  ==
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ~&  peek+pole
  ::  compatibility
  ::
  :: =>
  ::   |%
    :: ++  xeno-2
    ::   ^-  gangs:v2:g
    ::   (~(run by xeno) v2:gang:v6:ver)
    :: ::
    :: ++  xeno-5
    ::   ^-  gangs:v5:g
    ::   (~(run by xeno) v5:gang:v6:ver)
    :: ::
    :: ++  xeno-6
    ::   ^-  gangs:v6:g
    ::   xeno
    ::
    :: ++  groups-light-2
    ::   ^-  groups:v2:g
    ::   %-  ~(run by groups)
    ::   |=  [=net:v6:g =group:v6:g]
    ::   (v2:group:v6:ver (drop-fleet:v6 group bowl))
    :: ::
    :: ++  groups-light-ui-0
    ::   ^-  groups-ui:v2:g
    ::   %-  ~(urn by groups)
    ::   |=  [=flag:g [=net:v6:g =group:v6:g]]
    ::   =*  status  (read-status:neg bowl [p.flag %groups])
    ::   (v0:group-ui:v6:g flag net (drop-fleet:v6 group bowl) status)
    :: ::
    :: ++  groups-light-ui-2
    ::   ^-  groups-ui:v2:g
    ::   %-  ~(urn by groups)
    ::   |=  [=flag:g [=net:v6:g =group:v6:g]]
    ::   =*  status  (read-status:neg bowl [p.flag %groups])
    ::   (v2:group-ui:v6:g flag net (drop-fleet:v6 group bowl) status)
    :: ::
    :: ++  groups-light-ui-5
    ::   ^-  groups-ui:v5:g
    ::   %-  ~(run by groups)
    ::   |=  [=net:v6:g =group:v6:g]
    ::   (v5:group-ui:v6 net (drop-fleet:v6 group))
    :: --
  ::
  ?+    pole  [~ ~]
  ::
    ::
    ::  client paths
    ::
  ::
      [%x %v1 %init ~]
  =/  groups-ui-2=groups-ui:v2:g
    %-  ~(run by groups)
    (curr group-ui:v2:group:v7:ver our.bowl)
  =/  gangs-2=gangs:v2:g  ~
  ``noun+!>([groups-ui-2 gangs-2])
  ::
     [%x ver=?(%v0 %v1) %groups ship=@ name=@ rest=*]
    =+  ship=(slav %p ship.pole)
    =*  flag  [ship name.pole]
    =+  net-group=(~(get by groups) flag)
    ?~  net-group  [~ ~]
    ?.  ?=(~ rest.pole)
      ::  deprecated
      ?:  ?=([%v1 ~] rest.pole)
        $(pole [%x ver %groups ship name ~]:pole)
      (go-peek:(go-abed:go-core ship name.pole) ver.pole rest.pole)
    ?-    ver.pole
    ::
        %v0
      ``group-ui+!>((group-ui:v2:group:v7:ver u.net-group our.bowl))
    ::
        %v1
      ``group-ui-1+!>((group-ui:group:v7:ver u.net-group our.bowl))
    ==
  ::
      ::  deprecated
      [%x %groups ship=@ name=@ rest=*]
    $(pole [%x %v0 %groups ship.pole name.pole rest.pole])
  ::
      [%u %groups ship=@ name=@ %noun ~]
    =+  ship=(slav %p ship.pole)
    ``loob+!>((~(has by groups) [ship name.pole]))
  ::
    :: [%x %gangs ~]  ``gangs+!>(xeno-2)
    :: [%x %v1 %gangs ~]  ``gangs-1+!>(xeno-5)
    :: [%x %v2 %gangs ~]  ``gangs-2+!>(xeno-6)
  ::
    :: [%x %init ~]  ``noun+!>([groups-light-2 xeno-2])
    :: [%x %init %v0 ~]  ``noun+!>([groups-light-ui-0 xeno-2])
    :: [%x %init %v1 ~]  ``noun+!>([groups-light-ui-2 xeno-2])
    :: [%x %v2 %init ~]  ``noun+!>([groups-light-ui-5 xeno-5])
    :: [%x %v3 %init ~]  ``noun+!>([groups-light-ui-5 xeno-6])
  ::
    :: [%x %groups %light ~]  ``groups+!>(groups-light-2)
    :: [%x %groups %light %v0 ~]  ``groups-ui-v0+!>(groups-light-ui-0)
    :: [%x %groups %light %v1 ~]  ``groups-ui+!>(groups-light-ui-2)
  ::
    ::   [%x %groups ~]
    :: =*  groups-2
    ::   %-  ~(run by groups)
    ::   |=  [net:g =group:g]
    ::   (v2:group:v6:ver group)
    :: ``groups+!>(groups-2)
  ::
    ::   [%x %v1 %groups ~]
    :: ``groups-1+!>(`groups:v5:g`(~(run by groups) tail))
  ::
    ::   [%x %groups %v0 ~]
    :: ``groups-ui-v0+!>((~(urn by groups) v0:group-ui:v6:ver))
  ::
    ::   [%x %groups %v1 ~]
    :: ``groups-ui+!>((~(urn by groups) v2:group-ui:v6:ver))
  ::
    ::   [%x %groups ship=@ name=@ rest=*]
    :: =/  ship  (slav %p ship.pole)
    :: =*  flag  [ship name.pole]
    :: =/  group  (~(get by groups) flag)
    :: ?~  group  [~ ~]
    :: ?~  rest.pole
    ::   ``group+!>((v2:group:v6:ver +.u.group))
    :: ?+    rest.pole
    ::     (go-peek:(go-abed:group-core ship name.pole) rest.pole)
    ::   ::
    :: ::
    ::     [%v0 ~]
    ::   ``group-ui-v0+!>((v0:group-ui:v6:ver flag u.group))
    :: ::
    ::     [%v1 ~]
    ::   ``group-ui+!>((v2:group-ui:v6:ver flag u.group))
    :: ::
    ::     [%v2 ~]
    ::   ``group-ui-1+!>((v5:group-ui:v6:ver u.group))
    :: ==
  ::
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
      [%x %volume app=@ ship=@ name=@ ~]
    =/  =ship    (slav %p ship.pole)
    =/  =nest:g  [app.pole ship name.pole]
    :^  ~  ~  %volume-value
    !>  ^-  value:v
    ?^  vol=(~(get by chan.volume) nest)
      u.vol
    ::NOTE  searching through all groups like this is... inefficient,
    ::      but the alternative is depending on the dude knowing what
    ::      group the nest belongs to and scrying that out of it...
    ::
    =/  groups=(list [=flag:g net:g group:g])
      ~(tap by groups)
    |-
    ?~  groups  ~
    ?.  (~(has by channels.i.groups) nest)
      $(groups t.groups)
    (~(gut by area.volume) flag.i.groups ~)
  ==
::
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ~|  `wire`pole
  ?+    pole  ~|(bad-agent-take/pole !!)
      ~   cor
      [%epic ~]  cor
      [%logs ~]  cor
      [%groups ~]  cor
      [%activity %submit *]  cor
      [%channels %role ~]  cor
      ::TODO confirm this is safe to remove after lib-negotiate
      ::     migration
      :: [%cast ship=@ name=@ ~]  cor
  ::
    ::XX remove?
    ::   [%hi ship=@ ~]
    :: =/  =ship  (slav %p ship.pole)
    :: (take-hi ship sign)
  ::
    ::   [%gangs %invite ~]
    :: ?>  ?=(%poke-ack -.sign)
    :: ?~  p.sign  cor
    :: %.  cor
    :: (slog leaf/"Error giving invite" u.p.sign)
  ::
    ::   [%groups ship=@ name=@ %proxy ~]
    :: ?>  ?=(%poke-ack -.sign)
    :: ::  whether it's an ack or nack, nothing to do on our end
    :: ?~  p.sign  cor
    :: %-  (slog leaf/"Error forwarding poke" u.p.sign)
    :: cor
  ::
      [%groups ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    ?:  ?&  ?=(%kick -.sign)
            !(~(has by groups) ship name.pole)
        ==
      cor
    go-abet:(go-agent:(go-abed:go-core ship name.pole) rest.pole sign)
  ::
    ::   [%gangs %index ship=@ ~]
    :: (take-gang-index (slav %p ship.pole) sign)
  ::
    ::   [%gangs ship=@ name=@ rest=*]
    :: =/  =ship  (slav %p ship.pole)
    :: ga-abet:(ga-agent:(ga-abed:gang-core ship name.pole) rest.pole sign)
  ::XX remove?
    ::   [%chan app=@ ship=@ name=@ rest=*]
    :: =/  =ship  (slav %p ship.pole)
    :: =/  =nest:g  [app.pole ship name.pole]
    :: (take-chan nest sign)
  ::
      [%channels ~]
    (take-channels sign)
  ::
      [%contacts ~]
    (take-contacts sign)
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
        .^(? %gu (channels-scry nest))
      ==
    cor
  ==
::
::  does not overwite if wire and dock exist.  maybe it should
::  leave/rewatch if the path differs?
::
++  safe-watch
  |=  [=wire =dock =path]
  |=  delay=?
  ^+  cor
  ?:  (~(has by wex.bowl) wire dock)  cor
  =^  caz=(list card)  subs
    (~(subscribe s [subs bowl]) wire dock path delay)
  (emil caz)
::
++  watch-channels
  (safe-watch /channels [our.bowl %channels] /v1)
::
++  take-channels
  |=  =sign:agent:gall
  ?+    -.sign  cor
  ::
      %kick
    (watch-channels &)
  ::
      %fact
    =+  !<(=r-channels:d q.cage.sign)
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
    ::NOTE  this is inefficient, but %leave, unlike %join and %create,
    ::      does not carry group information. thus, we have
    ::      to comb through our groups to find matches.
    ::      there is at least one other place where this happens,
    ::      so it might be worth doing something about it.
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
++  watch-contacts
  ::TODO update for new %contacts endpoint
  (safe-watch /contacts [our.bowl %contacts] /news)
::
++  take-contacts
  |=  =sign:agent:gall
  ?+  -.sign  cor
      %kick
    (watch-contacts &)
  ::
      %watch-ack
    cor
  ::
      %fact
    cor
    ::TODO update for new %contact types
    ::XX update for tickets
    :: =+  !<(=update-0:tac q.cage.sign)
    :: ?~  con.update-0  cor
    :: %-  emil
    :: %+  turn  ~(tap in groups.con.update-0)
    :: |=  =flag:g
    :: [%pass /gangs/(scot %p p.flag)/[q.flag]/preview %agent [p.flag dap.bowl] %watch /v1/groups/(scot %p p.flag)/[q.flag]/preview]
  ==
::
++  from-self  =(our src):bowl
::  +se-core: group server core
::
++  se-core
  |_  [=flag:g =log:g =group:g gone=_|]
  +*  ads  admissions.group
      ad  ~(. ad-core admissions.group)
  ::
  ++  se-core  .
  ::  +se-abed: init
  ::
  ++  se-abed
    |=  =flag:g
    ^+  se-core
    ?>  =(p.flag our.bowl)
    ~|  flag=flag
    =/  [=net:g =group:g]  (~(got by groups) flag)
    ?>  ?=(%pub -.net)
    se-core(flag flag, log log.net, group group)
  ::  +se-abet: final
  ::
  ++  se-abet
    ^+  cor
    ?>  =(p.flag our.bowl)
    %_  cor  groups
      ?:  gone  
        (~(del by groups) flag)
      (~(put by groups) flag [%pub log] group)
    ==
  ::  +se-area: group base path
  ++  se-area  `path`/[q.flag]
  ::  +se-sub-wire: group updates wire
  ++  se-sub-wire  `path`(weld se-area /updates)
  ::
  ++  se-subscription-paths
    ^-  (list path)
    %+  skim  ~(tap in (~(gas in *(set path)) (turn ~(val by sup.bowl) tail)))
    |=  =path
    =((scag 3 path) se-sub-wire)
  ::  +se-update: record and send group update
  ::
  ++  se-update
    |=  =u-group:g
    ^+  se-core
    =/  =time
      |-
      =/  reply  (get:log-on:g log now.bowl)
      ?~  reply  now.bowl
      $(now.bowl `@da`(add now.bowl ^~((div ~s1 (bex 16)))))
    =/  =update:g  [time u-group]
    :: =.  log  (put:log-on:g log now.bowl [%meta *data:meta])
    (se-give-update update)
  ::  +se-pass: server cards core
  ::
  ++  se-pass
    |%
    --
  ::  +se-is-admin: check whether the ship has admin rights
  ::
  ++  se-is-admin
    |=  =ship
    ^-  ?
    ?:  =(ship p.flag)  &
    =/  =seat:g  (~(got by seats.group) ship)
    !=(~ (~(int in roles.seat) admins.group))
  ::  +se-admins: the set of members with admin rights
  ::
  ++  se-admins
    %+  roll  ~(tap by seats.group)
    |=  [[who=ship =seat:g] out=(set ship)]
    ?:  =(~ (~(int in roles.seat) admins.group))
      out
    (~(put in out) who)
  ::  +se-channel-hosts: set of ships hosting a group channel
  ::
  ++  se-channel-hosts
    ^-  (set ship)
    %-  ~(gas in *(set ship))
    %+  turn
      ~(tap by channels.group)
    |=  [=nest:g *]
    p.q.nest
  ::  +se-is-member: check whether the ship is a member
  ::
  ++  se-is-member  ~(has by seats.group)
  ::  +se-give-update: send an update to subscribers
  ::
  ++  se-give-update
    |=  =update:g
    ^+  se-core
    =/  paths  se-subscription-paths
    ?:  =(~ paths)
      se-core
    ::TODO define convenience emit, emil and give 
    ::     in +go-core and +se-core
    =.  cor  (give %fact paths group-update+!>(update))
    se-core
  ::  +se-c-create: create a group
  ::
  ++  se-c-create
    |=  [=flag:g create=create-group:g]
    ?>  ((sane %tas) name.create)
    =/  =flag:g  [our.bowl name.create]
    =/  =admissions:g
      %*  .  *admissions:g
        privacy  privacy.create
        banned   banned.create
      ==
    =/  =group:g
      :*  meta.create
          admissions
          ~  ::  seats
          ~  ::  roles
          ~  ::  admins
          ~  ::  channels
          ~  ::  active-channels
          ~  ::  sections
          ~  ::  section-order
          ~  ::  flagged-content
      ==
    =.  groups  (~(put by groups) flag [%pub *log:g] group)
    =.  se-core  se-init:(se-abed:se-core flag)
    ::XX this is modeled after %channels-server.
    ::   make sure this is actually used by the client
    ::   before introducing it in %groups
    ::   
    =/  cage  group-update+!>([%create group])
    =/  =path  /[q.flag]/create
    =.  cor  (give %fact ~[path] cage)
    =.  cor  (give %kick ~[path] ~)
    se-core
  ::  +se-init: initialize a group
  ::
  ++  se-init
    ^+  se-core
    =.  roles.group
      %+  ~(put by roles.group)  %admin
      ^-  role:g
      =;  meta=data:meta
        [meta ~]
      :*  'Admin'
          'Admins can add and remove channels and edit metadata' 
          ''
          ''
      ==
    =.  admins.group  (~(put in admins.group) %admin)
    =.  sections.group
      %+  ~(put by sections.group)  %default
      ^-  section:g
      :-  ['Sectionless' '' '' '']
      ::XX lexical ordering
      %+  murn  ~(tap by channels.group)
      |=  [=nest:g =channel:g]
      ^-  (unit nest:g)
      ?.  =(section.channel %default)
        ~
      `nest
    =.  section-order.group  (~(push of section-order.group) %default)
    =/  our=seat:g  (~(gut by seats.group) our.bowl *seat:g)
    =.  roles.our  (~(put in roles.our) %admin)
    =.  seats.group  (~(put by seats.group) our.bowl our)
    se-core
  ::  +se-c-delete: delete the group
  ::
  ++  se-c-delete
    se-core(gone &)
  ::  +se-join: handle join request
  ::
  ++  se-join
    |=  =token:g
    ^+  se-core
    =.  admissions.group  
      (ad-join:ad src.bowl token)
    (se-c-seat (silt src.bowl ~) [%add ~])
  ::  +se-c-group: execute the group command
  ::
  ++  se-c-group
    |=  =c-group:g
    ^+  se-core
    =*  se-src-is-admin  (se-is-admin src.bowl)
    ::XX disallow commands from banned ships?
    ::XX who can ban ships. make sure the host can't
    ::   ban itself, and rank is not in effect for the host
    ::
    ?-    -.c-group
        %meta
      ?>  se-src-is-admin
      ?:  =(meta.group meta.c-group)  se-core
      =.  meta.group  meta.c-group
      (se-update %meta meta.group)
    ::
        %entry
      (se-c-entry c-entry.c-group)
    ::
        %seat
      ?>  se-src-is-admin
      (se-c-seat [ships c-seat]:c-group)
    ::
        %role
      ?>  se-src-is-admin
      (se-c-role [role-id c-role]:c-group)
    ::
        %channel
      ?>  se-src-is-admin
      (se-c-channel [nest c-channel]:c-group)
    ::
        %section
      ?>  se-src-is-admin
      (se-c-section [section-id c-section]:c-group)
    :: 
        %flag-content
      ?>  se-src-is-admin
      (se-c-flag-content [nest post-key src]:c-group)
    ::
        %delete
      ?>  from-self
      se-c-delete
  ==
  ::  +se-c-entry: execute an entry command
  ::
  ++  se-c-entry
    |=  =c-entry:g
    ^+  se-core
    ?-  -.c-entry
      %privacy  (se-c-entry-privacy privacy.c-entry)
      %ban      (se-c-entry-ban c-ban.c-entry)
      %token    (se-c-entry-token c-token.c-entry)
    ==
  ::  +se-c-entry-privacy: execute a privacy command
  ::
  ++  se-c-entry-privacy
    |=  =privacy:g
    ^+  se-core
    ::TODO use admissions core
    =.  ads  (set-privacy:ad privacy)
    (se-update [%entry %privacy privacy])
  ::  +se-c-entry-ban: execute an entry ban command
  ::
  ++  se-c-entry-ban
    |=  =c-ban:g
    ^+  se-core
    =*  banned  banned.admissions.group
    ?-    -.c-ban
        %add-ships
      =.  ships.banned
        (~(uni in ships.banned) ships.c-ban)
      (se-update [%entry %ban %add-ships ships.c-ban])
    ::
        %del-ships
      =.  ships.banned
        (~(dif in ships.banned) ships.c-ban)
      (se-update [%entry %ban %del-ships ships.c-ban])
    ::
        %add-ranks
      =.  ranks.banned
        (~(uni in ranks.banned) ranks.c-ban)
      (se-update [%entry %ban %add-ranks ranks.c-ban])
    ::
        %del-ranks
      =.  ranks.banned
        (~(dif in ranks.banned) ranks.c-ban)
      (se-update [%entry %ban %del-ranks ranks.c-ban])
    ==
  ::  +se-c-entry-token: execute an entry token command
  ::
  ++  se-c-entry-token
    |=  =c-token:g
    ^+  se-core
    !!
  ::  +se-c-seat: execute a seat command
  ::
  ++  se-c-seat
    |=  [ships=(set ship) =c-seat:g]
    ^+  se-core
    =/  user-join  =(ships [src.bowl ~ ~])
    ::
    ?-    -.c-seat
        %add
      ::XX prevent re-adding a seat
      =.  seats.group
        %-  ~(uni by seats.group)
        %-  malt
        ^-  (list [ship seat:g])
        %+  turn  ~(tap in ships)
        |=  =ship
        ::  ships added by admins have default joined time
        =/  joined  ?:(user-join now.bowl *time)
        ::  preserve roles
        =/  seat  (~(gut by seats.group) ship *seat:g)
        [ship [roles.seat joined]]
      ::
      =.  se-core
        %+  roll  ~(tap in ships)
        |=  [=ship =_se-core]
        =+  seat=(~(got by seats.group) ship)
        (se-update:se-core %seat ship [%add seat])
      se-core
    ::
        %del
      ?<  ?|  (~(has in ships) our.bowl)
              !=(~ (~(int in ships) se-channel-hosts))
          ==
      =.  seats.group
        %+  roll  ~(tap in ships)
        |=  [=ship =_seats.group]
        (~(del by seats) ship)
      %+  roll  ~(tap in ships)
      |=  [=ship =_se-core]
      (se-update:se-core %seat ship [%del ~])
    ::
        %add-roles
      =.  roles.c-seat  (~(int in roles.c-seat) ~(key by roles.group))
      ?:  =(~ roles.c-seat)  se-core
      =.  seats.group
        %-  ~(urn by seats.group)
        |=  [=ship =seat:g]
        ?.  (~(has in ships) ship)  seat
        seat(roles (~(uni in roles.seat) roles.c-seat))
      %+  roll  ~(tap in ships)
      |=  [=ship =_se-core]
      (se-update:se-core %seat ship [%add-roles roles.c-seat])
    ::
        %del-roles
      =.  seats.group
        %-  ~(urn by seats.group)
        |=  [=ship =seat:g]
        ?.  (~(has in ships) ship)  seat
        seat(roles (~(dif in roles.seat) roles.c-seat))
      %+  roll  ~(tap in ships)
      |=  [=ship =_se-core]
      (se-update:se-core %seat ship [%del-roles roles.c-seat])
    ==
  ::  +se-c-role: execute a role command
  ::
  ++  se-c-role
    |=  [=role-id:g =c-role:g]
    ^+  se-core
    ?.  |(?=(%add -.c-role) (~(has by roles.group) role-id))
      se-core
    ?-    -.c-role
        %add
      =/  =role:g
        [meta.c-role ~]
      =.  roles.group  (~(put by roles.group) role-id role)
      (se-update %role role-id [%add meta.c-role])
    ::
        %edit
      ?>  (~(has by roles.group) role-id)
      =.  roles.group
        %+  ~(jab by roles.group)  role-id
        |=  =role:g
        role(meta meta.c-role)
      (se-update %role role-id [%edit meta.c-role])
    ::
        %del
      =.  roles.group  (~(del by roles.group) role-id)
      ::  remove the role from seats
      ::
      =/  old-role-id=(set role-id:g)  (sy role-id ~)
      =.  seats.group
        %-  ~(urn by seats.group)
        |=  [* =seat:g]
        seat(roles (~(dif in roles.seat) old-role-id))
      ::  remove the role from channels
      ::
      =/  channels  ~(tap by channels.group)
      =.  se-core
        |-
        ?~  channels  se-core
        =*  next  $(channels t.channels)
        =/  [=nest:g =channel:g]  i.channels
        ::  repair readers as needed
        ::
        =.  se-core  (se-channel-del-roles nest old-role-id)
        next
      (se-update %role role-id [%del ~])
    ::
        %set-admin
      ?>  (~(has by roles.group) role-id)
      =.  admins.group  (~(put in admins.group) role-id)
      (se-update %role role-id [%set-admin ~])
    ::
        %del-admin
      ?>  (~(has by roles.group) role-id)
      =.  admins.group  (~(del in admins.group) role-id)
      (se-update %role role-id [%del-admin ~])
    ==
  ::  +se-c-channel: execute a channel command
  ::
  ++  se-c-channel
    |=  [=nest:g =c-channel:g]
    ^+  se-core
    =*  by-ch  ~(. by channels.group)
    =*  chan  channel.c-channel
    ?.  |(?=(%add -.c-channel) (has:by-ch nest))  se-core
    ?-    -.c-channel
        %add
      =.  sections.group  (se-section-add-channel nest chan)
      =.  channels.group  (put:by-ch nest chan)
      (se-update %channel nest [%add chan])
    ::
        %edit
      =.  sections.group  (se-section-add-channel nest chan)
      =.  channels.group  (put:by-ch nest chan)
      (se-update %channel nest [%edit chan])
    ::
        %del
      =/  =channel:g   (got:by-ch nest)
      =.  sections.group
        ?.  (~(has by sections.group) section.channel)  
          sections.group
        %+  ~(jab by sections.group)  section.channel
        |=(=section:g section(order (~(del of order.section) nest)))
      =.  channels.group  (del:by-ch nest)
      (se-update %channel nest [%del ~])
    ::
        %add-roles
      ::XX the overall strategy seems to no-op instead of crashing
      ::   like below.
      ?>  =(~ (~(dif in roles.c-channel) ~(key by roles.group)))
      =/  =channel:g  (got:by-ch nest)
      =.  readers.channel  (~(uni in readers.channel) roles.c-channel)
      =.  channels.group  (put:by-ch nest channel)
      (se-update %channel nest [%add-roles roles.c-channel])
    ::
        %del-roles
      =.  se-core  (se-channel-del-roles nest roles.c-channel)
      (se-update %channel nest [%del-roles roles.c-channel])
    ::
        %section
      =/  =channel:g  (got:by-ch nest)
      ?>  (~(has by sections.group) section-id.c-channel)
      =.  section.channel   section-id.c-channel
      =.  channels.group  (put:by-ch nest channel)
      ::  add the channel to section in order, by first
      ::  removing it.
      ::
      ::XX  this seems at odds with logic in %add and %edit above?
      ::
      =.  sections.group
        %+  ~(jab by sections.group)  section.channel
        |=(=section:g section(order (~(del of order.section) nest)))
      =.  sections.group
        %+  ~(jab by sections.group)  section.channel
        |=(=section:g section(order (~(push of order.section) nest)))
      (se-update %channel nest [%section section-id.c-channel])
    ==
  ::  +se-channel-del-roles: remove roles from channel readers
  ::
  ++  se-channel-del-roles
    |=  [=nest:g roles=(set role-id:g)]
    ^+  se-core
    =.  channels.group
      %+  ~(jab by channels.group)  nest
      |=  =channel:g
      channel(readers (~(dif in readers.channel) roles))
    se-core
  ::  +se-section-add-channel: add channel to section
  ::
  ++  se-section-add-channel
    |=  [=nest:g =channel:g]
    ^+  sections.group
    ?.  (~(has by sections.group) section.channel)
      sections.group
    %+  ~(jab by sections.group)  section.channel
    |=(=section:g section(order (~(push of order.section) nest)))
  ::  +se-c-section: execute a section command
  ::
  ++  se-c-section
    |=  [=section-id:g =c-section:g]
    ^+  se-core
    ?-    -.c-section
        %add
      =/  =section:g  [meta.c-section ~]
      =.  sections.group  (~(put by sections.group) section-id section)
      =.  section-order.group  (~(push of section-order.group) section-id)
      (se-update %section section-id [%add meta.c-section])
    ::
        %edit
      =.  sections.group
        %+  ~(jab by sections.group)  section-id
        |=  =section:g
        section(meta meta.c-section)
      (se-update %section section-id [%edit meta.c-section])
    ::
        %del
      ?<  =(%default section-id)
      =.  sections.group
        (~(del by sections.group) section-id)
      =.  section-order.group
        (~(del of section-order.group) section-id)
      =.  channels.group
        %-  ~(run by channels.group)
        |=  =channel:g
        %_  channel  section
          ?:  =(section-id section.channel)
            %default
          section.channel
        ==
      (se-update %section section-id [%del ~])
    ::
        %move
      =.  section-order.group
        (~(into of section-order.group) idx.c-section section-id)
      (se-update %section section-id [%move idx.c-section])
    ::
        %move-nest
      ?.  (~(has by sections.group) section-id)  se-core
      =/  =section:g  (~(got by sections.group) section-id)
      ?.  (~(has of order.section) nest.c-section)  se-core
      =.  order.section
        (~(into of order.section) [idx nest]:c-section)
      =.  sections.group  (~(put by sections.group) section-id section)
      (se-update %section section-id [%move-nest [idx nest]:c-section])
    ==
  ++  se-c-flag-content
    |=  [=nest:g =post-key:g src=ship]
    ^+  se-core
    ::TODO make flagged-content a jug
    =/  posts  
      (~(gut by flagged-content.group) nest *(map post-key:g flaggers:g))
    =/  flaggers=(unit flaggers:g)  (~(get by posts) post-key)
    =/  channel-flagged
      %+  ~(put by posts)  post-key
      ?~  flaggers  (sy ~[src])
      (~(put in u.flaggers) src)
    =.  flagged-content.group  (~(put by flagged-content.group) nest channel-flagged)
    (se-update %flag-content nest post-key src)
  ::
  ++  se-watch
    |=  =path
    ^+  se-core
    ?+    path  ~|(se-watch-bad+path !!)
        [%updates ~]
      ?>  (se-is-member src.bowl)
      se-core
    ::
        [%updates after=@ ~]
      ?>  (se-is-member src.bowl)
      =*  after  (slav %da i.t.path)
      (se-watch-updates after)
    ::
      [%preview rest=*]  (se-preview t.path)
    ==
  ::
  ++  se-watch-updates
    |=  =@da
    ^+  se-core
    =/  =log:g  (lot:log-on:g log `da ~)
    =.  cor  (give %fact ~ %group-logs !>(log))
    se-core
  ::
  ++  se-preview
    |=  =path
    ^+  se-core
    =/  allow=?
      ?.  ?=(%secret privacy.admissions.group)  &
      ::  a secret group requires an access token
      ::
      ?:  ?=(~ path)  |
      ?>  ?=([token=@ ~] path)
      =+  token=(slav %uv i.path)
      ::TICKETS
      |
    ?>  allow
    =/  =preview:g
      =,  group
      :*  flag
          meta
          now.bowl
          ~(wyt by seats)
          public-token.admissions
      ==
    =.  cor  (give %fact ~ group-preview-3+!>(preview))
    =.  cor  (give %kick ~ ~)
    se-core
  --
::  +go-core: group client core
::
++  go-core
  |_  [=flag:g net=[=time init=_|] =group:g gone=_|]
  ++  go-core  .
  ::  +go-abed: init
  ::
  ++  go-abed
    |=  f=flag:g
    ^+  go-core
    ~|  flag=f
    =/  [=net:g =group:g]  (~(got by groups) f)
    ::  hosted group adapter
    ::
    =/  =$>(%sub net:g)
      ?:  ?=(%sub -.net)  net
      =/  item=(unit [=time *])
        (ram:log-on:g log.net)
      [%sub ?~(item *time time.u.item) &]
    go-core(flag f, group group, net +.net)
  ::  +go-abet: final
  ::
  ++  go-abet
    ^+  cor
    %_  cor  groups
      ?:  gone  
        (~(del by groups) flag)
      (~(put by groups) flag [%sub time.net init.net] group)
    ==
  ::  +go-area: group base path
  ++  go-area  `path`/(scot %p p.flag)/[q.flag]
  ::  +go-sub-wire: group updates wire
  ++  go-sub-wire  `path`(weld go-area /updates)
  ::  +go-activity: notify about a group event
  ::
  ++  go-activity
    =,  activity
    |=  $=  concern
        $%  [%join =ship]
            [%kick =ship]
            [%flag-post key=message-key =nest:d group=flag:g]
            [%flag-reply key=message-key parent=message-key =nest:d group=flag:g]
            [%role =ship roles=(set role-id:g)]
            ::TICKETS
            :: [%ask =ship]
        ==
    ^+  go-core
    =.  cor
      %-  submit-activity
      ^-  action
      =,  concern
      :-  %add
      ?-  -.concern
        ::TICKETS
        :: %ask   [%group-ask ^flag ship]
        %join  [%group-join ^flag ship]
        %kick  [%group-kick ^flag ship]
        ::TODO port %activity to new %groups types
        %role  [%group-role ^flag ship (~(run in roles) |=(=role-id:g `sect:v0:g`role-id))]
        %flag-post  [%flag-post key nest group]
        %flag-reply  [%flag-reply key parent nest group]
      ==
    go-core
  ::  +go-is-admin: check whether the ship has admin rights
  ::
  ++  go-is-admin
    |=  =ship
    ^-  ?
    ?:  =(ship p.flag)  &
    =/  =seat:g  (~(got by seats.group) ship)
    !=(~ (~(int in roles.seat) admins.group))
  ::  go-our-host: check whether we are the host
  ::
  ++  go-our-host  =(p.flag our.bowl)
  ::  +go-channel-hosts: set of ships hosting a group channel
  ::
  ++  go-channel-hosts
    ^-  (set ship)
    %-  ~(gas in *(set ship))
    %+  turn
      ~(tap by channels.group)
    |=  [=nest:g *]
    p.q.nest
  ::  +go-pass: cards core
  ::
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
      =/  =wire  (snoc go-area %command)
      =/  =dock  [p.flag server]
      =/  =cage
        group-command-1+!>([%group flag %seat (silt our.bowl ~) %del ~])
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
      ::XX version channels types
      =/  action=a-channels:d  [%channel nes %leave ~]
      =/  =cage  channel-action+!>(action)
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
      ::XX version channels types
      =/  action=a-channels:d  [%channel nes %join flag]
      =/  =cage  ['channel-action' !>(action)]
      =/  =wire  (snoc go-area %join-channels)
      `[%pass wire %agent dock %poke cage]
    ::
    --
  ::  +go-has-sub: check if we are subscribed to the group
  ++  go-has-sub
    (~(has by wex.bowl) [(snoc go-area %updates) p.flag server])
  ::  +go-safe-sub: safely subscribe to the group for updates
  ::
  ++  go-safe-sub
    |=  delay=?
    ^+  go-core
    ?:  go-has-sub  go-core
    (go-start-updates |)
  ::  +go-start-updates: subscribe to the group for updates
  ::
  ++  go-start-updates
    |=  delay=?
    ^+  go-core
    =.  cor
      %.  delay
      %^  safe-watch  go-sub-wire  [p.flag server]
      /updates/(scot %da time.net)
    go-core
  ::  +go-join: join a group
  ::
  ++  go-join
    |=  [=flag:g =token:g]
    ^+  go-core
    =/  =wire  (weld go-area(flag flag) /join)
    =.  cor  (emit %pass wire %agent [p.flag server] %poke group-command+!>([%join flag token]))
    go-core
  ::  +go-leave: leave a group and cancel all channel subscriptions
  ::
  ++  go-leave
    |=  remove-self=?
    ^+  go-core
    =.  cor
      (submit-activity [%del %group flag])
    ::NOTE  we leave all channels, not just those that
    ::      are joined, as this is robust to bugs
    ::      in active channels tracking.
    ::
    =/  channels  ~(tap in ~(key by channels.group))
    =.  cor  (emil (leave-channels:go-pass channels))
    ::
    =?  cor  remove-self
      (emit remove-self:go-pass)
    go-core(gone &)
  ::  +go-a-group: execute group action
  ::
  ++  go-a-group
    |=  =a-group:g
    ^+  go-core
    ?>  from-self
    ?+  -.a-group  (go-send-command [%group flag `c-group:g`a-group])
      %leave  (go-leave &)
    ==
  ::  +go-send-command:  send command to the group host
  ::
  ++  go-send-command
    |=  =c-groups:g
    ^+  go-core
    ?>  from-self
    ?>  ?=(%group -.c-groups)
    =/  =cage  channel-command+!>(c-groups)
    =.  cor  (emit %pass go-area %agent [p.flag server] %poke cage)
    go-core
  ::
  ++  go-agent
    |=  [=wire =sign:agent:gall]
    ^+  go-core
    ?+  wire  ~|(go-agent-bad+wire !!)
        [%join ~]     (go-take-join sign)
        [%updates ~]  (go-take-update sign)
        ::XX what is this and why is this necessary?
        :: [%wake ~]     go-core
    ::
      ::XX wire this up
      ::   [?(%join-channels %leave-channels) ~]
      :: ?>  ?=(%poke-ack -.sign)
      :: ?~  p.sign
      ::   go-core
      :: %.  go-core
      :: ?-    i.wire
      ::   ::
      ::       %join-channels
      ::     (slog leaf/"Failed to join channel" u.p.sign)
      ::   ::
      ::       %leave-channels
      ::     (slog leaf/"Failed to leave channel" u.p.sign)
      :: ==
    ::
    ==
  ++  go-take-join
    |=  =sign:agent:gall
    ^+  go-core
    ~|(%unimplemented !!)
  ::
  ++  go-take-update
    |=  =sign:agent:gall
    ^+  go-core
    ?+   -.sign  ~|(%go-take-update-bad !!)
        %watch-ack
      ::XX this establishes a connection to the group host.
      ::   if we decide to keep group join status, here
      ::   we should mark the join complete
      go-core
    ::
        %fact
      =*  cage  cage.sign
      ?>  =(%group-update p.cage)
      (go-u-group !<(group-update:g q.cage))
    ==
  ::  +go-u-group: apply group update
  ::
  ++  go-u-group
    |=  update=group-update:g
    ^+  go-core
    ?>  (gth time.update time.net)
    =.  time.net  time.update
    =*  u-group  u-group.update
    ?-  -.u-group
      %meta          (go-u-meta data.u-group)
      %entry         (go-u-entry u-entry.u-group)
      %seat          (go-u-seat [ship u-seat]:u-group)
      %role          (go-u-role [role-id u-role]:u-group)
      %channel       (go-u-channel [nest u-channel]:u-group)
      %section       (go-u-section [section-id u-section]:u-group)
      %flag-content  (go-u-flag-content [nest post-key src]:u-group)
      %del           (go-leave |)
    ==
  ::  +go-u-meta: apply meta update
  ::
  ++  go-u-meta
    |=  meta=data:meta
    ^+  go-core
    =.  go-core  (go-response [%meta meta])
    ?:  go-our-host  go-core
    ::
    =.  meta.group  meta
    go-core
  ::  +go-u-entry: apply entry update
  ::
  ++  go-u-entry
    |=  =u-entry:g
    ^+  go-core
    ?-  -.u-entry
      %privacy  (go-u-entry-privacy privacy.u-entry)
      %ban      (go-u-entry-ban u-ban.u-entry)
      %token    (go-u-entry-token u-token.u-entry)
    ==
  ::  +go-u-entry-privacy: apply privacy update
  ::
  ++  go-u-entry-privacy
    |=  =privacy:g
    ^+  go-core
    =.  go-core  (go-response [%entry %privacy privacy])
    ?:  go-our-host  go-core
    ::
    =.  privacy.admissions.group  privacy
    go-core
  ::  +go-u-entry-ban: apply entry ban update
  ::
  ++  go-u-entry-ban
    |=  u-ban=u-ban:g
    ^+  go-core
    =.  go-core  (go-response [%entry %ban u-ban])
    ?:  go-our-host  go-core
    ::
    ::TODO use operations in admissions core
    =*  banned  banned.admissions.group
    ?-    -.u-ban
        %add-ships
      =.  ships.banned
        (~(uni in ships.banned) ships.u-ban)
      go-core
    ::
        %del-ships
      =.  ships.banned
        (~(dif in ships.banned) ships.u-ban)
      go-core
    ::
        %add-ranks
      =.  ranks.banned
        (~(uni in ranks.banned) ranks.u-ban)
      go-core
    ::
        %del-ranks
      =.  ranks.banned
        (~(dif in ranks.banned) ranks.u-ban)
      go-core
    ==
  ::  +go-u-entry-token: apply entry token update
  ::
  ++  go-u-entry-token
    |=  =u-token:g
    ^+  go-core
    !!
  ::  +go-u-seat: apply seat update
  ::
  ++  go-u-seat
    |=  [=ship =u-seat:g]
    ^+  go-core
    ?-    -.u-seat
        %add
      =.  go-core  (go-response %seat ship [%add seat.u-seat])
      =?  go-core  !=(joined.seat.u-seat *@da)
        (go-activity %join ship)
      ?:  go-our-host  go-core
      ::
      =.  seats.group  
        (~(put by seats.group) ship seat.u-seat)
      go-core
    ::
        %del
      =+  leave==(ship our.bowl)
      =.  go-core  (go-response %seat ship [%del ~])
      ::XX make sure the host can't kick himself
      =.  go-core  (go-activity %kick ship)
      ?:  go-our-host  go-core
      ::
      =.  seats.group
        (~(del by seats.group) ship)
      =?  go-core  leave  (go-leave |)
      go-core
    ::
        %add-roles
      =.  go-core  (go-response %seat ship [%add-roles roles.u-seat])
      =.  go-core  (go-activity %role ship roles.u-seat)
      ?:  go-our-host  go-core
      ::
      =.  seats.group
        %+  ~(jab by seats.group)  ship
        |=  =seat:g
        seat(roles (~(uni in roles.seat) roles.u-seat))
      go-core
    ::
        %del-roles
      =.  go-core  (go-response %seat ship [%del-roles roles.u-seat])
      =.  go-core  (go-activity %role ship roles.u-seat)
      ?:  go-our-host  go-core
      ::
      =.  seats.group
        %+  ~(jab by seats.group)  ship
        |=  =seat:g
        seat(roles (~(dif in roles.seat) roles.u-seat))
      go-core
    ==
  ::  +go-u-role: apply role update
  ::
  ++  go-u-role
    |=  [=role-id:g =u-role:g]
    ^+  go-core
    ::TODO review updates in other places. do we no-op
    ::     when a resource does not exist?
    ::
    ?.  |(?=(%add -.u-role) (~(has by roles.group) role-id))
      go-core
    ?-    -.u-role
        %add
      =.  go-core  (go-response %role role-id [%add meta.u-role])
      ?:  go-our-host  go-core
      ::
      =/  =role:g
        [meta.u-role ~]
      =.  roles.group  (~(put by roles.group) role-id role)
      go-core
    ::
        %edit
      =.  go-core  (go-response %role role-id [%edit meta.u-role])
      ?:  go-our-host  go-core
      ::
      =.  roles.group
        %+  ~(jab by roles.group)  role-id
        |=  =role:g
        role(meta meta.u-role)
      go-core
    ::
        %del
      =.  go-core  (go-response %role role-id [%del ~])
      =/  old-role-id=(set role-id:g)  (sy role-id ~)
      ::  remove the role from channels
      ::
      =/  channels  ~(tap by channels.group)
      =.  go-core
        |-
        ?~  channels  go-core
        =*  next  $(channels t.channels)
        =/  [=nest:g =channel:g]  i.channels
        ::  repair readers as needed
        ::
        =.  go-core  (go-channel-del-roles nest old-role-id)
        ::  repair writers as needed
        ::
        ::  not host
        ?:  !=(our.bowl p.q.nest)  next
        =+  .^(has=? %gu (channels-scry nest))
        ::  missing channel
        ?.  has  next
        ::  unsupported channel
        ?.  ?=(?(%chat %heap %diary) p.nest)  next
        ::TODO migrate channels to new types
        =/  old-sect=(set sect:v0:g)  (sy `sect:v0:g`role-id ~)
        =/  cmd=c-channels:d  [%channel nest %del-writers old-sect]
        =/  cage  channel-command+!>(cmd)
        =/  dock  [p.q.nest %channels-server]
        =.  cor  (emit %pass /channels/role %agent dock %poke cage)
        next
      ?:  go-our-host  go-core
      ::
      =.  roles.group  (~(del by roles.group) role-id)
      =.  seats.group
        %-  ~(urn by seats.group)
        |=  [* =seat:g]
        seat(roles (~(dif in roles.seat) old-role-id))
      go-core
    ::
        %set-admin
      =.  go-core  (go-response %role role-id [%set-admin ~])
      ?:  go-our-host  go-core
      ::
      =.  admins.group  (~(put in admins.group) role-id)
      go-core
    ::
        %del-admin
      =.  go-core  (go-response %role role-id [%del-admin ~])
      ?:  go-our-host  go-core
      ::
      =.  admins.group  (~(del in admins.group) role-id)
      go-core
    ==
  ::  +go-u-channel: apply channel update
  ::
  ++  go-u-channel
    |=  [=nest:g =u-channel:g]
    ^+  go-core
    =*  by-ch  ~(. by channels.group)
    =*  chan  channel.u-channel
    ?.  |(?=(%add -.u-channel) (has:by-ch nest))  go-core
    ?-    -.u-channel
        %add
      =.  go-core  (go-response %channel nest [%add chan])
      ?:  go-our-host  go-core
      ::
      =.  sections.group  (go-section-add-channel nest chan)
      =.  channels.group  (put:by-ch nest chan)
      go-core
    ::
        %edit
      =.  go-core  (go-response %channel nest [%edit chan])
      ?:  go-our-host  go-core
      ::
      =.  sections.group  (go-section-add-channel nest chan)
      =.  channels.group  (put:by-ch nest chan)
      go-core
    ::
        %del
      =.  go-core  (go-response %channel nest [%del ~])
      ?:  go-our-host  go-core
      ::
      =/  =channel:g   (got:by-ch nest)
      =.  sections.group
        ?.  (~(has by sections.group) section.channel)  
          sections.group
        %+  ~(jab by sections.group)  section.channel
        |=(=section:g section(order (~(del of order.section) nest)))
      =.  channels.group  (del:by-ch nest)
      go-core
    ::
        %add-roles
      ?>  =(~ (~(dif in roles.u-channel) ~(key by roles.group)))
      =.  go-core  (go-response %channel nest [%add-roles roles.u-channel])
      ?:  go-our-host  go-core
      ::
      =.  channels.group
        %+  ~(jab by channels.group)  nest
        |=  =channel:g
        channel(readers (~(uni in readers.channel) roles.u-channel))
      go-core
    ::
        %del-roles
      =.  go-core  (go-response %channel nest [%del-roles roles.u-channel])
      ?:  go-our-host  go-core
      ::
      =.  go-core  (go-channel-del-roles nest roles.u-channel)
      go-core
    ::
        %section
      =.  go-core  (go-response %channel nest [%section section.u-channel])
      ?:  go-our-host  go-core
      ::
      =/  =channel:g  (got:by-ch nest)
      ?>  (~(has by sections.group) section.u-channel)
      =.  section.channel   section.u-channel
      =.  channels.group  (put:by-ch nest channel)
      =.  sections.group
        %+  ~(jab by sections.group)  section.channel
        |=(=section:g section(order (~(push of order.section) nest)))
      go-core
    ==
  ::  +go-channel-del-roles: remove roles from channel readers
  ::
  ++  go-channel-del-roles
    |=  [=nest:g roles=(set role-id:g)]
    ^+  go-core
    =.  channels.group
      %+  ~(jab by channels.group)  nest
      |=  =channel:g
      channel(readers (~(dif in readers.channel) roles))
    go-core
  ::  +go-section-add-channel: add channel to section
  ::
  ++  go-section-add-channel
    |=  [=nest:g =channel:g]
    ^+  sections.group
    ?.  (~(has by sections.group) section.channel)  
      sections.group
    %+  ~(jab by sections.group)  section.channel
    |=(=section:g section(order (~(push of order.section) nest)))
  ::  +go-u-section: apply section update
  ::
  ++  go-u-section
    |=  [=section-id:g =u-section:g]
    ^+  go-core
    ?-    -.u-section
        %add
      =.  go-core  (go-response %section section-id [%add meta.u-section])
      ?:  go-our-host  go-core
      ::
      =/  =section:g  [meta.u-section ~]
      =.  sections.group  (~(put by sections.group) section-id section)
      =.  section-order.group  (~(push of section-order.group) section-id)
      go-core
    ::
        %edit
      =.  go-core  (go-response %section section-id [%edit meta.u-section])
      ?:  go-our-host  go-core
      ::
      =.  sections.group
        %+  ~(jab by sections.group)  section-id
        |=  =section:g
        section(meta meta.u-section)
      go-core
    ::
        %del
      =.  go-core  (go-response %section section-id [%del ~])
      ?:  go-our-host  go-core
      ::
      ?<  =(%default section-id)
      =.  sections.group
        (~(del by sections.group) section-id)
      =.  section-order.group
        (~(del of section-order.group) section-id)
      =.  channels.group
        %-  ~(run by channels.group)
        |=  =channel:g
        %_  channel  section
          ?:  =(section-id section.channel)
            %default
          section.channel
        ==
      go-core
    ::
        %move
      =.  go-core  
        (go-response %section section-id [%move idx.u-section])
      ?:  go-our-host  go-core
      ::
      =.  section-order.group
        (~(into of section-order.group) idx.u-section section-id)
      go-core
    ::
        %move-nest
      =.  go-core  
        (go-response %section section-id [%move-nest [idx nest]:u-section])
      ?:  go-our-host  go-core
      ::
      ?.  (~(has by sections.group) section-id)  go-core
      =/  =section:g  (~(got by sections.group) section-id)
      ?.  (~(has of order.section) nest.u-section)  go-core
      =.  order.section
        (~(into of order.section) [idx nest]:u-section)
      =.  sections.group  (~(put by sections.group) section-id section)
      go-core
    ==
  ::  +go-u-flag-content: apply flag content update
  ::
  ++  go-u-flag-content
    |=  [=nest:g =post-key:g src=ship]
    ^+  go-core
    =.  go-core  (go-response %flag-content nest post-key src)
    ?:  go-our-host  go-core
    ::
    ::TODO make flagged-content a jug
    =/  posts  
      (~(gut by flagged-content.group) nest *(map post-key:g flaggers:g))
    =/  flaggers=(unit flaggers:g)  (~(get by posts) post-key)
    =/  channel-flagged
      %+  ~(put by posts)  post-key
      ?~  flaggers  (sy ~[src])
      (~(put in u.flaggers) src)
    =.  flagged-content.group  (~(put by flagged-content.group) nest channel-flagged)
    ::  do not notify about flagged content if we reported it,
    ::  or we are not an admin.
    ::
    ?:  |(from-self !(go-is-admin our.bowl))  go-core
    =/  new-message-id  [src post.post-key]
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
  ::  +go-response: send response to our subscribers
  ::
  ++  go-response
    |=  =r-group:g
    ^+  go-core
    =/  =r-groups:g  [%group flag r-group]
    ::
    =/  v1-paths  ~[/v1/groups (weld /v1/groups go-area)]
    ::XX use conversion functions from 'latest'
    =/  r-groups-7=r-groups:v7:g  r-groups
    =.  cor  (give %fact v1-paths group-response-1+!>(r-groups-7))
    ::
    =/  v0-paths  ~[/groups/ui]
    =/  action-2=action:v2:g
      (v2:action:r-group:v7:ver r-group)
    =.  cor  (give %fact v0-paths group-action-3+!>(action-2))
    go-core
  ::  +go-peek: handle a group scry request
  ::
  ++  go-peek
    |=  [ver=?(%v0 %v1) =(pole knot)]
    ^-  (unit (unit cage))
    ?+    pole  ~|(bad-go-peek+pole !!)
      ::XX find out which ones were ever used by anything
      ::   and restore them
      ::   [%hosts ~]
      :: `ships+!>(go-channel-hosts)
      :: ::
      ::   [%fleet %ships ~]
      :: `ships+!>(~(key by fleet.group))
      :: ::
      ::   [%fleet ship=@ %vessel ~]
      :: =/  src  (slav %p ship.pole)
      :: `noun+!>((~(got by fleet.group) src))
      :: ::
      ::   [%fleet ship=@ %is-bloc ~]
      :: =/  src  (slav %p ship.pole)
      :: `loob+!>((~(has in go-bloc-who) src))
      :: ::
      ::   [%fleet ship=@ %is-ban ~]
      :: =/  src  (slav %p ship.pole)
      :: `loob+!>((go-is-banned src))
      ::
      ::   [%channel app=@ ship=@ name=@ rest=*]
      :: =/  nes=nest:g  [app.pole (slav %p ship.pole) name.pole]
      :: ?+    rest.pole  ~
      ::     [%can-read member=@ ~]
      ::   ?~  channel=(~(get by channels.group) nes)
      ::     `loob+!>(`?`|)
      ::   =/  member  (slav %p member.rest.pole)
      ::   `loob+!>((go-can-read member u.channel))
      ::   ::
      ::     [%can-write member=@ ~]
      ::   =/  member  (slav %p member.rest.pole)
      ::   =-  `noun+!>(-)
      ::   ?:  |((go-is-banned member) !(~(has by fleet.group) member))  ~
      ::   %-  some
      ::   :-  bloc=(~(has in go-bloc-who) member)
      ::   sects=sects:(~(got by fleet.group) member)
      :: ==
      ::
          [%can-read ~]
        [~ ~]
      ::   [%can-read ~]
      :: :+  ~  %noun
      :: !>  ^-  $-([ship nest:g] ?)
      :: |=  [=ship =nest:g]
      :: ?~  cha=(~(get by channels.group) nest)  |
      :: (go-can-read ship u.cha)
    ==
  ::  +go-watch: handle a group subscription request
  ::
  ++  go-watch
    |=  [ver=?(%v0 %v1) =(pole knot)]
    ^+  go-core
    ?+    pole  ~|(bad-go-watch+pole !!)
      ::
        [%updates rest=*]
      ?>  ?=(?(%v0 %v1) ver)
      ~|(%unimplemented !!)
      :: (go-pub ver rest.pole)
    ::
        :: [%ui ~]       ?>(?=(?(%v0 %v1) ver) go-core)
    ==
  :: ::
  :: ++  go-preview
  ::   |=  ver=?(%v0 %v1 %v2)
  ::   ~|(%go-preview-not-implemented !!)
    :: =/  allow=?
    ::   ?-  -.cordon.group
    ::       %afar  &
    ::       %open  !secret.group  :: should never be secret
    ::     ::
    ::         %shut
    ::       ::  allow previews of a private group:
    ::       ::  (1) if it is *not* secret, or
    ::       ::  (2) the viewer is on the invitation list
    ::       ::
    ::       ?|  !secret.group
    ::           (~(has in pend.cordon.group) src.bowl)
    ::       ==
    ::     ==
    :: ::  access control: crash if we are on v0, v1
    :: ::  and we disallow the preview
    :: ::
    :: ?<  &(?=(%v0 %v1) !allow)
    :: =/  =preview:g
    ::   =,  group
    ::   [flag meta cordon now.bowl secret.group ~(wyt by fleet)]
    :: =.  cor
    ::   ?-    ver
    ::       %v0
    ::     (emit %give %fact ~ group-preview+!>((to-preview-2 preview)))
    ::   ::
    ::       %v1
    ::     =/  =preview:v5:g  preview
    ::     (emit %give %fact ~ group-preview-1+!>(preview))
    ::   ::
    ::       %v2
    ::     ?.  allow
    ::       ?:  secret.group
    ::         ::  conceal secret group
    ::         ::
    ::         =/  pev=preview-response:v6:g  |+%missing
    ::         (emit %give %fact ~ group-preview-2+!>(pev))
    ::       =/  pev=preview-response:v6:g  |+%forbidden
    ::       (emit %give %fact ~ group-preview-2+!>(pev))
    ::     ::
    ::     =/  pev=preview-response:v6:g  &+preview
    ::     (emit %give %fact ~ group-preview-2+!>(pev))
    ::   ==
    :: =.  cor
    ::   (emit %give %kick ~ ~)
    :: go-core
  ::  +go-can-read: check if a ship has read permission to a channel
  ::
  ::XX verify that we mean to allow non-member ships to read
  ::   from visible channels
  ::
  :: ++  go-can-read
  ::   |=  [=ship =channel:g]
  ::   ^-  ?
  ::   ::XX update for tickets
  ::   :: =/  open  =(-.cordon.group %open)
  ::   =+  open=|
  ::   =/  seat  (~(get by seats.group) ship)
  ::   =/  visible  =(~ readers.channel)
  ::   ?:  (go-is-banned src)  |
  ::   ?:  ?|  (~(has in go-admins) ship)
  ::           &(open visible)
  ::           &(!=(~ seat) visible)
  ::       ==
  ::     &
  ::   ?~  seat  |
  ::   !=(~ (~(int in readers.channel) roles.u.seat))
  ::  +go-agent: handle group-specific subscription update
  ::
  ::  +go-up-groups: apply groups update
  ::
  :: ++  go-u-groups
  ::   |=  =sign:agent:gall
  ::   ^+  go-core
  ::   ::XX why do we go-sub on poke-ack, the remaining case?
  ::   ?+    -.sign  (go-sub | &)
  ::       %kick
  ::     ?>  ?=(%sub -.net)
  ::     (go-sub !load.net &)
  ::   ::
  ::       %watch-ack
  ::     ::XX update for tickets
  ::     :: =?  cor  (~(has by xeno) flag)
  ::     ::   ga-abet:(ga-watched:(ga-abed:gang-core flag) p.sign)
  ::     %.  go-core
  ::     ?~  p.sign  same
  ::     (slog leaf/"Failed subscription" u.p.sign)
  ::   ::
  ::       %fact
  ::     =*  cage  cage.sign
  ::     ::  XX: does init need to be handled specially?
  ::     ?+  p.cage  ~|(bad-mark+p.cage !!)
  ::       %group-log-4     (go-apply-log !<(log:g q.cage))
  ::       %group-update-4  (go-update !<(update:g q.cage))
  ::       %group-init-4    (go-fact-init !<(init:g q.cage))
  ::     ==
  ::   ==
  ::
  ::
  ::  +go-apply-logs: update group state from logs
  ::
  :: ++  go-apply-logs
  ::   |=  =log:g
  ::   %+  roll  (tap:log-on:g log)
  ::   |=  [[=time =u-group:g] go=_go-core]
  ::   (go-u-group:go time update)
  ::
  :: ++  go-fact-init
  ::   |=  [=time gr=group:g]
  ::   =.  group  gr
  ::   =.  net  [%sub time &]
  ::   =/  create=diff:v5:g  [%create group]
  ::   =/  readable-channels
  ::     %-  ~(gas in *(set nest:g))
  ::     %+  murn  ~(tap in channels.group)
  ::     |=  [ch=nest:g =channel:g]
  ::     ?.  (go-can-read our.bowl channel)  ~
  ::     [~ ch]
  ::   =.  cor
  ::     (give %fact ~[/groups /groups/ui] group-action-3+!>(`action:v2:g`[flag now.bowl (to-diff-2 create)]))
  ::   =.  cor
  ::     (give %fact ~[/groups /groups/ui] gang-gone+!>(flag))
  ::   =.  cor
  ::     (give %fact ~[/v1/groups /v1/groups/ui] group-action-4+!>(`action:v5:g`[flag now.bowl create]))
  ::   =.  cor
  ::     (give %fact ~[/v1/groups /v1/groups/ui] gang-gone+!>(flag))
  ::   =.  cor
  ::     (emil (join-channels:go-pass ~(tap in readable-channels)))
  ::   go-core
  ::
  :: ++  go-give-update
  ::   |=  [=time =diff:g]
  ::   ^+  go-core
  ::   =/  v0-paths=(set path)
  ::     %+  roll  ~(val by sup.bowl)
  ::     |=  [[=ship =path] out=(set path)]
  ::     ?.  =((scag 4 path) (snoc go-area %updates))
  ::       out
  ::     (~(put in out) path)
  ::   =.  v0-paths  (~(put in v0-paths) (snoc go-area %ui))
  ::   =/  v1-paths=(set path)
  ::     %+  roll  ~(val by sup.bowl)
  ::     |=  [[=ship =path] out=(set path)]
  ::     ?.  =((scag 5 path) (snoc `^path`[%v1 go-area] %updates))
  ::       out
  ::     (~(put in out) path)
  ::   =.  v1-paths  (~(put in v1-paths) (snoc `path`[%v1 go-area] %ui))
  ::   ::
  ::   =/  diff-2=diff:v2:g
  ::     ?:  ?=(%create -.diff)
  ::       diff(p (to-group-2 p.diff))
  ::     diff
  ::   =.  cor  %^  give  %fact
  ::              ~[/groups /groups/ui]
  ::            group-action-3+!>(`action:v2:g`[flag time diff-2])
  ::   =.  cor  %^  give  %fact
  ::              ~(tap in v0-paths)
  ::            group-update-3+!>(`update:v2:g`[time diff-2])
  ::   =.  cor  %^  give  %fact
  ::              ~[/v1/groups /v1/groups/ui]
  ::            group-action-4+!>(`action:v5:g`[flag time diff])
  ::   =.  cor  %^  give  %fact
  ::              ~(tap in v1-paths)
  ::            group-update-4+!>(`update:v5:g`[time diff])
  ::   go-core
  :: ::
  :: ++  go-tell-update
  ::   |=  [=time =diff:g]
  ::   ^+  go-core
  ::   =.  go-core  (go-give-update time diff)
  ::   ?.  ?=(%pub -.net)
  ::     go-core
  ::   =.  p.net
  ::     (put:log-on:g p.net time diff)
  ::   go-core
  ::XX repurpose as server update.
  ::   update application should be in +go-u-groups
  --
  ::  +ad-core: admissions core
  ::
  ++  ad-core
    |_  admissions:g
    ++  admissions  +<
    ++  set-privacy
      |=  =privacy:g
      ^+  admissions
      %_  admissions  privacy
        privacy
      ==
    ++  ad-is-banned
      |=  =ship
      ^-  ?
      ?|  (~(has in ranks.banned) (clan:title ship))
          (~(has in ships.banned) ship)
      ==
    ++  ad-join
      |=  [=ship =token:g]
      ^+  admissions
      ?<  (ad-is-banned ship)
      !!
    --
--

::  groups: agent for managing group membership, metadata and permissions
::
::  groups agent can act both as a group server and
::  as a subscriber to remote groups. unlike channels, this agent is
::  not separated into two distinct subscriber and server agents, but
::  rather achieves this separation with two distinct cores:
::  the server core +se-core and client core +go-core.
::
/-  g=groups, c=chat, d=channels,
    activity
/-  meta
/+  default-agent, verb, dbug
/+  gv=groups-ver, v=volume, s=subscriber, imp=import-aid, logs,
    t=contacts
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
        %channels^[~.channels^%1 ~ ~]
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
        =foreigns:v7:g
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
  ++  on-save  !>([state ~])
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
    %-  (slog term tang)
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
  ~&  groups-poke+[mark src.bowl]
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
        =/  =flag:g  [our.bowl name.create-group.c-groups]
        ?<  (~(has by groups) flag)
        ?>  from-self
        se-abet:(se-c-create:se-core flag create-group.c-groups)
      ::
          %group
        =/  server-core  (se-abed:se-core flag.c-groups)
        se-abet:(se-c-group:server-core c-group.c-groups)
      ::
          %join
        =*  server-core  (se-abed:se-core flag.c-groups)
        se-abet:(se-c-join:server-core token.c-groups)
      ::
          %ask
        =*  server-core  (se-abed:se-core flag.c-groups)
        se-abet:(se-c-ask:server-core story.c-groups)
      ::
          %leave
        =*  server-core  (se-abed:se-core flag.c-groups)
        se-abet:se-c-leave:server-core
      ==
    ::
        %group-action-4
      =+  !<(=a-groups:v7:g vase)
      ?-    -.a-groups
          %group
        =/  group-core  (go-abed:go-core flag.a-groups)
        go-abet:(go-a-group:group-core a-group.a-groups)
      ::
          %invite
        =/  group-core  (go-abed:go-core flag.a-groups)
        go-abet:(go-a-invite:group-core a-invite.a-groups)
      ::
          %leave
        =/  group-core  (go-abed:go-core flag.a-groups)
        go-abet:(go-leave:group-core &)
      ==
    ::
        ::  deprecated
        %group-action-3
      =+  !<(=action:v2:g vase)
      ~&  group-action-3+action
      =*  flag  p.action
      =*  diff  q.q.action
      ?:  ?=(%del -.diff)
        ?>  =(p.flag our.bowl)
        =/  =c-groups:g
          [%group flag [%delete ~]]
        $(+< group-command+!>(c-groups))
      ?:  ?=(%secret -.diff)
        =/  =group:v7:g  +:(~(got by groups) flag)
        ?:  p.diff
          ::  enable group secrecy
          ::
          =/  =a-groups:v7:g  [%group flag [%entry %privacy %secret]]
          $(+< group-action-4+!>(a-groups))
        ::  disable group secrecy
        ::
        ?:  ?=(?(%public %private) privacy.admissions.group)  cor
        ::  group is secret, make it private
        =/  =a-groups:v7:g  [%group flag [%entry %privacy %private]]
        $(+< group-action-4+!>(a-groups))
      ::  translate the shut cordon poke:
      ::  1. pending operations translate into appropiate seat commands.
      ::  2. ask operations translate into foreign ask actionts.
      ::
      ?:  ?=([%cordon %shut *] diff)
        =*  cordon-diff  p.p.diff
        ?-  -.cordon-diff
            %add-ships
          ?-    p.cordon-diff
              %ask
            ::  enforce
            ?>  =(q.cordon-diff (silt our.bowl ~))
            =/  =a-foreigns:v7:g
              [%foreign flag %ask ~]
            $(+< group-foreign-1+!>(a-foreigns))
          ::
              %pending
            =/  =a-group:v7:g
              [%seat q.cordon-diff %add ~]
            $(+< group-action-4+!>(`a-groups:v7:g`[%group flag a-group]))
          ==
        ::
            %del-ships
          ?-    p.cordon-diff
              %ask
            ?>  =(q.cordon-diff (silt our.bowl ~))
            =/  =a-foreigns:v7:g
              [%foreign flag %cancel ~]
            $(+< group-foreign-1+!>(a-foreigns))
          ::
              %pending
            =/  =a-group:v7:g
              [%seat q.cordon-diff %del ~]
            $(+< group-action-4+!>(`a-groups:v7:g`[%group flag a-group]))
          ==
        ==
      =/  a-group-list=(list a-group:v7:g)
        (a-group:v7:diff:v2:gv diff)
      ?:  =(~ a-group-list)  cor
      %+  roll  a-group-list
      |=  [=a-group:v7:g =_cor]
      =/  =a-groups:v7:g  [%group flag a-group]
      ^$(+< group-action-4+!>(a-groups))
    ::
        ::  deprecated
        %group-leave
      =+  !<(=flag:g vase)
      ?>  from-self
      ?<  =(our.bowl p.flag)
      go-abet:(go-leave:(go-abed:go-core flag) &)
    ::
    ::  foreign groups interface
    ::
        %group-foreign-action-1
      =+  !<(=a-foreigns:v7:g vase)
      ~&  group-foreign-action-1+a-foreigns
      ?-    -.a-foreigns
          %foreign
        =/  foreign-core  (fi-abed:fi-core flag.a-foreigns)
        fi-abet:(fi-a-foreign:foreign-core a-foreign.a-foreigns)
      ::
          %invite
        =/  foreign-core  (fi-abed:fi-core flag.invite.a-foreigns)
        fi-abet:(fi-invite:foreign-core invite.a-foreigns)
      ==
    ::
    ::  deprecated gang interface
    ::
    ::
        %group-join
      ?>  from-self
      =+  !<(=join:v0:g vase)
      ~|  f=flag.join
      =/  =foreign:v7:g  (~(got by foreigns) flag.join)
      =/  tok=(unit token:g)
        ?~  invites.foreign  ~
        token.i.invites.foreign
      fi-abet:(fi-join:(fi-abed:fi-core flag.join) tok)
    ::
        %group-knock
      ?>  from-self
      =+  !<(=flag:g vase)
      =/  =a-foreigns:v7:g
        [%foreign flag %ask ~]
      $(+< foreign-action-1+!>(a-foreigns))
    ::
        %group-rescind
      ?>  from-self
      =+  !<(=flag:g vase)
      =/  =a-foreigns:v7:g
        [%foreign flag %cancel ~]
      $(+< foreign-action-1+!>(a-foreigns))
    ::
        %group-cancel
      =+  !<(=flag:g vase)
      ?>  from-self
      fi-abet:fi-cancel:(fi-abed:fi-core flag)
    ::
        %group-invite
      =+  !<(invite-0=invite:v0:g vase)
      ?:  =(q.invite-0 our.bowl)
        ::  invitee, deprecated
        ::
        ~|(group-invite-deprecated+%invitee !!)
      :: inviter
      ::
      ?>  (~(has by groups) p.invite-0)
      ~&  group-invite+invite-0
      =/  =a-invite:v7:g  [q.invite-0 ~ ~]
      $(+< group-action-4+!>(`a-groups:v7:g`[%invite p.invite-0 a-invite]))
    ::
        %invite-decline
      =+  !<(=flag:g vase)
      ?>  from-self
      ~|  f=flag
      =/  =foreign:v7:g  (~(got by foreigns) flag)
      ::  backward compatibility: decline all invites
      ::
      %+  roll  invites.foreign
      |=  [=invite:g =_cor]
      =/  =a-foreigns:v7:g
        [%foreign flag %decline token.invite]
      (poke:cor group-foreign-action-1+!>(a-foreigns))
    ::
  ::
  ::
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
    :: =/  bak
    ::   (load -:!>(*[versioned-state:load _okay:g]) +>.old-state.egg-any)
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
    :: =.  volume
    ::   :+  base.volume:bak
    ::     (~(uni by area.volume:bak) area.volume)
    ::   (~(uni by chan.volume:bak) chan.volume)
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
::TODO examine whether this should execute in the client
::     component or in the server component
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
      =/  =c-groups:v7:g  [%group flag [%channel nest %del-readers readers.channel]]
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
  =+  !<([old=any-state *] vase)
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
  +$  any-state
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
    [%2 (v2:groups:v0:gv groups) volume xeno shoal]
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
        (~(run by groups) v5:net-group:v2:gv)
        volume
        (~(run by xeno) v5:gang:v2:gv)
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
        (~(run by xeno) v6:gang:v5:gv)
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
  ::
      [%server %groups ship=@ name=@ rest=*]
    =+  ship=(slav %p ship.pole)
    ?>  =(our.bowl ship)
    se-abet:(se-watch:(se-abed:se-core [our.bowl name.pole]) rest.pole)
  ::
      [%server %groups ship=@ name=@ %preview ~]
    =+  ship=(slav %p ship.pole)
    ?>  =(our.bowl ship)
    ?:  (~(has by groups) our.bowl name.pole)
      se-abet:(se-watch:(se-abed:se-core [our.bowl name.pole]) /preview)
    =/  =preview-update:v7:g  ~
    =.  cor
      (emit %give %fact ~ group-preview-3+!>(preview-update))
    (emit %give %kick ~ ~)
  ::
      [%server %groups %index ~]
    se-abet:se-watch-index:se-core
  ::
    ::
    ::  client paths
    ::
  ::
    [%v1 %groups ~]  cor
  ::
    ::  deprecated
    [%groups %ui ~]  cor
  ::
      [%v1 %foreigns ship=@ name=@ rest=*]
    =+  ship=(slav %p ship.pole)
    fi-abet:(fi-watch:(fi-abed:fi-core ship name.pole) %v1 rest.pole)
  ::
      [%v1 %foreigns %index ship=@ ~]
    =+  ship=(slav %p ship.pole)
    fi-abet:(fi-watch-index:fi-core %v1 ship)
  ::
      ::  deprecated
      [%gangs ship=@ name=@ %preview ~]
    $(pole /v1/foreigns/[ship.pole]/[name.pole]/preview)
  ::
      ::  deprecated
      [%gangs %index ship=@ ~]
    $(pole /v1/foreigns/index/[ship.pole])
  ::
    ::  deprecated
    [%gangs %updates ~]  cor
  ::
     ::TODO  rename to channels in the new API
     [%chan app=@ ship=@ name=@ rest=*]
    =/  ship=@p  (slav %p ship.pole)
    =/  =nest:g  [app.pole ship name.pole]
    (watch-chan nest)
  ::
    :: deprecated
    [%epic ~]  (give %fact ~ epic+!>(okay:g))
  ==
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ~&  peek+pole
  ?+    pole  [~ ~]
  ::
    ::
    ::  client paths
    ::
  ::
      ::  deprecated
      [%x %init %v1 ~]
      =/  net-groups-7=net-groups:v7:g
        %-  ~(run by groups)
        |=  [=net:v7:g =group:v7:g]
        :-  net
        (drop-seats:group:v7:gv group our.bowl)
      =/  groups-light-ui-2  (~(run by net-groups-7) group-ui:v2:group:v7:gv)
      ::  we filter out foreigns which are %done,
      ::  since completed gangs are removed after
      ::  the group join in old groups.
      ::
      =/  gangs-2
        %-  ~(gas by *(map flag:g gang:v2:g))
        %+  murn  ~(tap by foreigns)
        |=  [=flag:g =foreign:g]
        ?:  ?&  ?=(^ progress.foreign)
                ?=(%done u.progress.foreign)
            ==
          ~
        %-  some
        :-  flag
        (gang:v2:foreign:v7:gv foreign)
    ``noun+!>([groups-light-ui-2 gangs-2])
  ::
       [%x ver=?(%v0 %v1 %v2) %groups ~]
    =/  groups-7=groups:v7:g  (~(run by groups) tail)
    ?-    ver.pole
        %v0  ``groups+!>((~(run by groups-7) v2:group:v7:gv))
        %v1  ``groups-1+!>((~(run by groups-7) v5:group:v7:gv))
        %v2  ``groups-2+!>(groups-7)
    ==
  ::
      [%x ver=?(%v0 %v1 %v2) %light %groups ~]
    =/  groups-7=groups:v7:g
      %-  ~(run by groups)
      |=  [=net:v7:g =group:v7:g]
      (drop-seats:group:v7:gv group our.bowl)
    ?-    ver.pole
        %v0  ``groups+!>((~(run by groups-7) v2:group:v7:gv))
        %v1  ``groups-1+!>((~(run by groups-7) v5:group:v7:gv))
        %v2  ``groups-2+!>(groups-7)
    ==
  ::
      [%x ver=?(%v0 %v1 %v2) %ui %groups ~]
    =/  net-groups-7=net-groups:v7:g  groups
    ?-    ver.pole
        %v0  ``groups-ui+!>((~(run by net-groups-7) group-ui:v2:group:v7:gv))
        %v1  ``groups-ui-1+!>((~(run by net-groups-7) group-ui:v5:group:v7:gv))
        %v2  ``groups-ui-2+!>((~(run by net-groups-7) group-ui:group:v7:gv))
    ==
  ::
    ::  deprecated
    [%x %groups ~]  $(pole /x/v0/groups)
    ::  deprecated
    [%x %groups %light ~]  $(pole /x/v0/light/groups)
  ::
      [%x ver=?(%v0 %v1 %v2) %groups ship=@ name=@ rest=*]
    =+  ship=(slav %p ship.pole)
    =/  =flag:g  [ship name.pole]
    =+  net-group=(~(get by groups) flag)
    ?~  net-group  [~ ~]
    ?.  ?=(~ rest.pole)
      (go-peek:(go-abed:go-core ship name.pole) ver.pole rest.pole)
    ?-    ver.pole
        %v0
      ``group+!>((v2:group:v7:gv +.u.net-group))
    ::
        %v1
      ``group-1+!>((v5:group:v7:gv +.u.net-group))
    ::
        %v2
      ``group-2+!>(`group:v7:g`+.u.net-group)
    ==
  ::
      [%x ver=?(%v0 %v1 %v2) %ui %groups ship=@ name=@ rest=*]
    =+  ship=(slav %p ship.pole)
    =*  flag  [ship name.pole]
    =+  net-group=(~(get by groups) flag)
    ?~  net-group  [~ ~]
    ?.  ?=(~ rest.pole)
      ?:  ?=([%v1 ~] rest.pole)
        ::  deprecated
        $(pole [%x ver %ui %groups ship name ~]:pole)
      ~|(peek-bad-path+pole !!)
    ?-    ver.pole
        %v0
      ``group-ui+!>((group-ui:v2:group:v7:gv u.net-group))
    ::
        %v1
      ``group-ui-1+!>((group-ui:v5:group:v7:gv u.net-group))
    ::
        %v2
      ``group-ui-2+!>((group-ui:group:v7:gv u.net-group))
    ==
  ::
      ::  deprecated
      [%x %groups ship=@ name=@ rest=*]
    $(pole [%x %v0 %ui %groups ship.pole name.pole rest.pole])
  ::
      [%u %groups ship=@ name=@ ~]
    =+  ship=(slav %p ship.pole)
    ``noun+!>((~(has by groups) [ship name.pole]))
  ::
      [%x ver=?(%v1) %foreigns ~]
    ``foreigns-1+!>(`foreigns:v7:g`foreigns)
  ::
      [%x ver=?(%v1) %foreigns ship=@ name=@ ~]
    =+  ship=(slav %p ship.pole)
    =/  =flag:g  [ship name.pole]
    ?~  far=(~(get by foreigns) flag)  [~ ~]
    ``foreign-1+!>(`foreign:v7:g`u.far)
  ::
      ::  deprecated, update /lib/notify
      [%x %gangs ~]
     :: we filter out foreigns which are %done,
     :: since completed gangs were removed in old groups.
     ::
    =/  gangs-2
      %-  ~(gas by *(map flag:g gang:v2:g))
      %+  murn  ~(tap by foreigns)
      |=  [=flag:g =foreign:g]
      ?:  ?&  ?=(^ progress.foreign)
              ?=(%done u.progress.foreign)
          ==
        ~
      %-  some
      :-  flag
      (gang:v2:foreign:v7:gv foreign)
    ``gangs+!>(gangs-2)
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
  ?+    pole  ~|(bad-agent-take+pole !!)
      ~   cor
      [%epic ~]  cor
      [%logs ~]  cor
      [%activity %submit *]  cor
      ::TODO prune during the migration
      :: [%cast ship=@ name=@ ~]  cor
  ::
      [%server %groups ship=@ name=@ rest=*]
    =+  ship=(slav %p ship.pole)
    se-abet:(se-agent:(se-abed:se-core ship name.pole) rest.pole sign)
  ::
      [%groups ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    ::  ignore kicks for groups we already left
    ::
    ?:  ?&  ?=(%kick -.sign)
            !(~(has by groups) ship name.pole)
        ==
      cor
    ::  ignore leave command acks for groups
    ::  we already left
    ::
    ?:  ?&  ?=([%command %leave ~] rest.pole)
            !(~(has by groups) ship name.pole)
        ==
      cor
    go-abet:(go-agent:(go-abed:go-core ship name.pole) rest.pole sign)
  ::
      [%foreigns ship=@ name=@ rest=*]
    =/  ship  (slav %p ship.pole)
    ?:  ?&  ?=(%kick -.sign)
            !(~(has by foreigns) ship name.pole)
        ==
      ::  ignore kicks for non-existent foreigns
      ::
      cor
    fi-abet:(fi-agent:(fi-abed:fi-core ship name.pole) rest.pole sign)
  ::
      [%foreigns %index ship=@ ~]
    =+  ship=(slav %p ship.pole)
    fi-abet:(fi-take-index:fi-core ship sign)
  ::
      [%chan app=@ ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    =/  =nest:g  [app.pole ship name.pole]
    (take-chan nest sign)
  ::
      [%channels ~]
    (take-channels sign)
  ::
    [%channels %perms ~]  cor
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
::  +watch-chan: handle channel preview request
::TODO this would be located better under +go-core
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
  ?.  %+  go-can-read:(go-abed:go-core flag)
        src.bowl
      (~(got by channels.group) nest)
    $(gs t.gs)
  ::TODO migrate to new types
  =/  =preview:channel:v2:g
    =,  group
    =*  ad  admissions
    =/  secret=?  ?=(%secret privacy.ad)
    =/  preview-2=preview:v2:g
      :*  flag
          meta
          (cordon:v2:admissions:v7:gv seats ad)
          now.bowl
          secret
      ==
    :*  nest
        meta:(~(got by channels.group) nest)
        preview-2
    ==
  =.  cor  (emit %give %fact ~ channel-preview+!>(preview))
  (emit %give %kick ~ ~)
::
++  take-chan
  |=  [=nest:g =sign:agent:gall]
  =/  =wire  =,(nest /chan/[p]/(scot %p p.q)/[q.q])
  ^+  cor
  ?+    -.sign  ~|(bad-chan-take/[-.sign nest] !!)
      %kick
    (emit %give %kick ~[wire] ~)
  ::
      %watch-ack
    ?~  p.sign  cor
    :: TODO: propagate upwards
    %-  (slog leaf/"Failed to fetch group" u.p.sign)
    cor
  ::
      %fact
    ?>  =(%channel-preview p.cage.sign)
    =+  !<(=preview:channel:v2:g q.cage.sign)
    =.  cor  (emit %give %fact ~[wire] cage.sign)
    (emit %give %kick ~[wire] ~)
  ==
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
  (safe-watch /contacts [our.bowl %contacts] /v1/news)
::  +take-contacts: get favourite group previews for a contact
::
++  take-contacts
  |=  =sign:agent:gall
  ^+  cor
  ?+  -.sign  cor
      %kick
    (watch-contacts &)
  ::
      %watch-ack
    cor
  ::
      %fact
    =+  !<(=update:t q.cage.sign)
    ?~  con.update  cor
    =/  groups=(set $>(%flag value:t))
      (~(gos cy:t con.update) groups+%flag)
    ?:  =(~ groups)  cor  ::TMI
    %-  emil  %-  zing
    %+  turn  ~(tap in groups)
    |=  val=$>(%flag value:t)
    preview:fi-pass:(fi-abed:fi-core p.val)
  ==
::
++  from-self  =(our src):bowl
::  +se-core: group server core
::
++  se-core
  |_  [=flag:g =log:g =group:g gone=_|]
  ::
  +*  ad  admissions.group
  ::
  ++  se-core  .
  ++  emit  |=(=card se-core(cor cor(cards [card cards])))
  ++  give  |=(=gift:agent:gall (emit %give gift))
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
    =?  se-core  gone
      (se-update [%delete ~])
    %_  cor  groups
      ?:  gone
        (~(del by groups) flag)
      (~(put by groups) flag [%pub log] group)
    ==

  ::  +se-area: group base path
  ++  se-area  `path`/server/groups/(scot %p p.flag)/[q.flag]
  ::  +se-sub-path: group updates path
  ++  se-sub-path  `path`(weld se-area /updates)
  ::
  ++  se-subscription-paths
    ^-  (list path)
    %+  skim  ~(tap in (~(gas in *(set path)) (turn ~(val by sup.bowl) tail)))
    |=  =path
    =((scag ^~((lent se-sub-path)) path) se-sub-path)
  ::
  ++  se-admin-subscription-paths
    ^-  (list path)
    %+  skim  ~(tap in (~(gas in *(set path)) (turn ~(val by sup.bowl) tail)))
    |=  =path
    ?.  =((scag 4 path) se-sub-path)  |
    =/  rest=^path  (slag 4 path)
    ?.  ?=([ship=@ *] rest)  |
    =/  ship  (slav %p i.rest)
    (~(has in admins.group) ship)
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
    =.  log  (put:log-on:g log update)
    ~&  se-update+u-group
    (se-give-update update)
  ::  +se-pass: server cards core
  ::
  ++  se-pass
    |%
    --
  ::  +se-is-joined: check if the ship has already joined the group
  ::
  ++  se-is-joined
    |=  =ship
    ^-  ?
    ?~  seat=(~(get by seats.group) ship)  |
    ?:  =(*@da joined.u.seat)  |
    &
  ::  +se-is-admin: check whethert the ship has admin rights
  ::
  ++  se-is-admin
    |=  =ship
    ^-  ?
    ?:  =(ship p.flag)  &
    ?~  seat=(~(get by seats.group) ship)  |
    !=(~ (~(int in roles.u.seat) admins.group))
  ::  +se-admins: the set of members with admin rights
  ::
  ++  se-admins
    =-  (~(put in -) our.bowl)
    %+  roll  ~(tap by seats.group)
    |=  [[who=ship =seat:g] out=(set ship)]
    ?:  =(~ (~(int in roles.seat) admins.group))
      out
    (~(put in out) who)
 ::
 ++  se-is-banned
    |=  =ship
    ?:  =(our.bowl ship)  |
    =*  banned  banned.admissions.group
    ?|  (~(has in ships.banned) ship)
        ?&  !(se-is-admin ship)
            (~(has in ranks.banned) (clan:title ship))
        ==
    ==
  ::  +se-channel-hosts: set of ships hosting a group channel
  ::
  ++  se-channel-hosts
    ^-  (set ship)
    %-  ~(gas in *(set ship))
    %+  turn
      ~(tap by channels.group)
    |=  [=nest:g *]
    p.q.nest
  ::  +se-is-member: check whether the ship has a seat
  ::
  ++  se-is-member  ~(has by seats.group)
  ::  +se-give-update: send an update to subscribers
  ::
  ++  se-give-update
    |=  =update:g
    ^+  se-core
    ::  update +go-core
    ::
    =.  cor
      go-abet:(go-u-group:(go-abed:go-core flag) update)
    ::  update subscribers: either everyone
    ::  or admins only.
    ::
    =/  paths
      ?:  (se-is-admin-update u-group.update)
        se-admin-subscription-paths
      se-subscription-paths
    ?:  =(~ paths)
      se-core
    (give %fact paths group-update+!>(update))
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
      %*  .  *group:g
        meta  meta.create
        admissions  admissions
      ==
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
    =/  =seat:g  (~(gut by seats.group) our.bowl *seat:g)
    =.  joined.seat  now.bowl
    =.  roles.seat  (~(put in roles.seat) %admin)
    =.  seats.group  (~(put by seats.group) our.bowl seat)
    =.  groups  (~(put by groups) flag [%pub *log:g] group)
    ::TODO invite all the ships on the guest list.
    ::
    (se-update:(se-abed flag) [%create group])
  ::  +se-c-delete: delete the group
  ::
  ++  se-c-delete
    se-core(gone &)
  ::  +se-join: handle group join request
  ::
  ::  a ship can join the group if she has a valid token.
  ::  for a public group no token is required for entry.
  ::  a private or secret group requires a valid token issued by
  ::  the group host.
  ::
  ::  a banned ship can not enter the group.
  ::
  ::  re-joining the group with valid credentials is vacuous.
  ::
  ++  se-c-join
    |=  tok=(unit token:g)
    ^+  se-core
    =^  access=?  ad
      (se-admit src.bowl tok)
    ~|  %se-c-join-access-denied
    ?>  access
    ?:  (se-is-joined src.bowl)  se-core
    (se-c-seat (sy src.bowl ~) [%add ~])
  ::  +se-c-ask: handle a group ask request
  ::
  ::  a ship can request to join the group. for a public group,
  ::  the request is automatically approved. for a private group,
  ::  the request is visible to admins, who can then approve or deny.
  ::  denying an ask request does not result in the ship ban.
  ::
  ::  if a user has already joined the group, the ask request is vacuous.
  ::
  ++  se-c-ask
    |=  story=(unit story:s:g) ::XX something is messed up with story imports
    ^+  se-core
    ?<  (se-is-banned src.bowl)
    ?:  (se-is-joined src.bowl)  se-core
    ?:  ?=(%public privacy.ad)
      ::  public group: wait until we receive the ask watch
      se-core
    ::  private group: record in requests
    ::
    =.  requests.ad  (~(put by requests.ad) src.bowl story)
    (se-update %entry %ask [%add src.bowl story])
  ::  +se-c-leave: handle a group leave request
  ::
  ::  a client is in some way registered by the group host
  ::  in the following cases:
  ::  (1) he is already in the group,
  ::  (2) he is in the process of joining the group and has a registered seat,
  ::  (3) he has issued a group ask request.
  ::
  ::  if the client then wishes to forfeit that registration,
  ::  he can issue a group leave request. the group host then:
  ::  1. deletes the client's seat and kicks
  ::     any outstanding group subscriptions.
  ::  2. deletes the client's ask request and kicks
  ::     any outstanding ask subscriptions.
  ::
  ++  se-c-leave
    ^+  se-core
    ?:  (~(has by seats.group) src.bowl)
      (se-c-seat (sy src.bowl ~) [%del ~])
    ?:  (~(has by requests.ad) src.bowl)
      =.  requests.ad  (~(del by requests.ad) src.bowl)
      =.  se-core  (se-update %entry %ask %del (sy src.bowl ~))
      (give %kick ~[(weld se-area /ask/(scot %p src.bowl))] ~)
    se-core
  ::  +se-admit: verify and register .ship entry with .token
  ::
  ++  se-admit
    |=  [=ship tok=(unit token:g)]
    ^-  [? _ad]
    =*  deny   [| ad]
    ?:  (se-is-banned ship)  deny
    ?:  &(=(~ tok) ?=(%public privacy.ad))
      [& ad]
    ?~  tok  deny
    ::TODO referrals
    =/  meta=(unit token-meta:g)  (~(get by tokens.ad) u.tok)
    ?~  meta  deny
    ?:  (gth now.bowl expiry.u.meta)  deny
    ?-    -.scheme.u.meta
      %forever  [& ad]
    ::
        %limited
      ?.  (gth count.scheme.u.meta 0)  deny
      =/  =claim-scheme:g  [%limited (dec count.scheme.u.meta)]
      :-  &
      %_  ad  tokens
        (~(put by tokens.ad) u.tok u.meta(scheme claim-scheme))
      ==
    ::
        %personal
      ?.  =(ship ship.scheme.u.meta)  deny
      :-  &
      %_  ad  tokens
        (~(del by tokens.ad) u.tok)
      ==
    ==
  ::  +se-c-group: execute the group command
  ::
  ++  se-c-group
    |=  =c-group:g
    ^+  se-core
    ::TODO  commands that change permissions/seats should re-evaluate
    ::      subscriptions, and kick subscriptions from people that are
    ::      no longer allowed.
    ::
    ?<  (se-is-banned src.bowl)
    =*  se-src-is-admin  (se-is-admin src.bowl)
    ::
    ?-    -.c-group
        %meta
      ?>  se-src-is-admin
      ?:  =(meta.group meta.c-group)  se-core
      =.  meta.group  meta.c-group
      (se-update %meta meta.group)
    ::
        %entry
      ?>  se-src-is-admin
      (se-c-entry c-entry.c-group)
    ::
        %seat
      ?>  se-src-is-admin
      (se-c-seat [ships c-seat]:c-group)
    ::
        %role
      ?>  se-src-is-admin
      (se-c-role [roles c-role]:c-group)
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
      ::TODO who should be able to flag?
      :: ?>  se-src-is-admin
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
      %token    +:(se-c-entry-token c-token.c-entry) ::XX a nicer/more general pattern?
      %ask      (se-c-entry-ask [ships c-ask]:c-entry)
    ==
  ::  +se-c-entry-privacy: execute a privacy command
  ::
  ::TODO if a ship is on the requests list in admissions,
  ::     and the type of the group changes to public,
  ::     all the requesting ships are automatically granted entry.
  ::
  ++  se-c-entry-privacy
    |=  =privacy:g
    ^+  se-core
    =.  privacy.ad  privacy
    (se-update [%entry %privacy privacy])
  ::  +se-c-entry-ban: execute an entry ban command
  ::
  ::  the entry ban command is used to forbid a ship or a class of
  ::  ships of certain rank from joining the group, requesting to join
  ::  the group, or executing any commands on the group host.
  ::
  ::  the ship and rank blacklists do not affect the group host.
  ::  it is illegal to execute any $c-ban commands that affects
  ::  the group host in any way.
  ::
  ::  the rank blacklist does not affect admins. it is illegal
  ::  for an admin to execute a $c-ban command that affect
  ::  another admin ship.
  ::
  ::
  ++  se-c-entry-ban
    |=  =c-ban:g
    ^+  se-core
    ::  disallow operations affecting the host
    ?<  ?|  ?&  ?=(?(%add-ships %del-ships) -.c-ban)
                (~(has in ships.c-ban) our.bowl)
            ==
            ?&  ?=(%set -.c-ban)
                (~(has in ships.c-ban) our.bowl)
            ==
        ==
    ::  disallow operations on admins unless executed by the host
    ?>  ?|  =(p.flag src.bowl)
        ?!  ?|  ?&  ?=(?(%add-ships %del-ships) -.c-ban)
                !=(~ (~(int in se-admins) ships.c-ban))
                ==
                ?&  ?=(%set -.c-ban)
                    !=(~ (~(int in se-admins) ships.c-ban))
                ==
            ==
        ==
    =*  banned  banned.ad
    ?-    -.c-ban
        %set
      =.  ships.banned  ships.c-ban
      =.  ranks.banned  ranks.c-ban
      =.  se-core  se-check-banned
      (se-update [%entry %ban %set [ships ranks]:c-ban])
    ::
        %add-ships
      =.  ships.banned
        (~(uni in ships.banned) ships.c-ban)
      =.  se-core  se-check-banned
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
      =.  se-core  se-check-banned
      (se-update [%entry %ban %add-ranks ranks.c-ban])
    ::
        %del-ranks
      =.  ranks.banned
        (~(dif in ranks.banned) ranks.c-ban)
      (se-update [%entry %ban %del-ranks ranks.c-ban])
    ==
  ::  +se-check-banned: enforce bans in group seats and requests
  ::
  ++  se-check-banned
    ^+  se-core
    ::  delete banned members
    ::
    =/  del-ships=(set ship)
      %+  roll  ~(tap in ~(key by seats.group))
      |=  [=ship ships=(set ship)]
      ?.  (se-is-banned ship)  ships
      (~(put in ships) ship)
    =?  se-core  !=(~ del-ships)
      (se-c-seat del-ships [%del ~])
    ::  deny banned ships
    ::
    =/  deny-ships=(set ship)
      %+  roll  ~(tap in ~(key by requests.ad))
      |=  [=ship ships=(set ship)]
      ?.  (se-is-banned ship)  ships
      (~(put in ships) ship)
    =?  se-core  !=(~ deny-ships)
      (se-c-entry-ask deny-ships %deny)
    se-core
  ::  +se-c-entry-token: execute an entry token command
  ::
  ++  se-c-entry-token
    |=  =c-token:g
    ^-  [(unit token:g) _se-core]
    ~&  se-c-entry-token+c-token
    ?-    -.c-token
        %add
      =*  c-token-add  c-token-add.c-token
      =/  =token:g
        =+  i=(end 7 eny.bowl)
        |-  ?.  (~(has by tokens.ad) i)  i
        $(i +(i))
      =/  =token-meta:g
        =,  c-token-add
        :*  scheme
            (add now.bowl (fall expiry ~d365))
            label
        ==
      ::TODO implement referrals
      :: =?  referrals.ad  referral.c-token-add
      ::   (~(put ju referrals.ad) src.bowl)
      =.  tokens.ad
        (~(put by tokens.ad) token token-meta)
      :-  `token
      (se-update [%entry %token %add token token-meta])
    ::
        %del
      ?>  (~(has by tokens.ad) token.c-token)
      =.  tokens.ad
        (~(del by tokens.ad) token.c-token)
      :-  ~
      (se-update [%entry %token %del token.c-token])
    ==
  ::  +se-c-entry-ask: approve or deny a set of ask request
  ::
  ::  an admin can approve or deny ask requests.
  ::
  ::  if a request is approved the host issues
  ::  an access token to the requester.
  ::
  ::  if a request is denied the host kicks the requester
  ::  and deletes the request.
  ::
  ::
  ++  se-c-entry-ask
    |=  [ships=(set ship) c-ask=?(%approve %deny)]
    ^+  se-core
    ?-    c-ask
        %approve
      =/  reqs=(set ship)
        (~(int in ~(key by requests.ad)) ships)
      ?:  =(~ reqs)  se-core
      =.  se-core
        %+  roll  ~(tap in reqs)
        |=  [=ship =_se-core]
        ::XX broken tiscom strikes again
        =.  requests.admissions.group.se-core
          (~(del by requests.admissions.group.se-core) ship)
        =^  tok=(unit token:g)  se-core
          (se-c-entry-token:se-core %add [personal+ship ~ ~ |])
        =/  =cage  group-token+!>(tok)
        =/  =path  (weld se-area /ask/(scot %p ship))
        ~&  se-c-entry-ask-approve+ship
        =.  se-core
          (give:se-core %fact ~[path] cage)
        (give:se-core %kick ~[path] ~)
      (se-update:se-core [%entry %ask %del reqs])
    ::
        %deny
      =/  reqs=(set ship)
        (~(int in ~(key by requests.ad)) ships)
      ?:  =(~ reqs)  se-core
      =.  se-core
        %+  roll  ~(tap in reqs)
        |=  [=ship =_se-core]
        =.  requests.admissions.group.se-core
          (~(del by requests.admissions.group.se-core) ship)
        =.  se-core
          (give:se-core %kick ~[(weld se-area /ask/(scot %p ship))] ~)
        se-core
      (se-update:se-core [%entry %ask %del reqs])
    ==
  ::  +se-c-seat: execute a seat command
  ::
  ::  seats are used to manage group membership.
  ::  a seat can be created in two ways: when a user joins
  ::  the group, and when group members are manually added
  ::  by a group admin.
  ::
  ::  the case of a user join can be detected by verifying
  ::  that the ship set contains only the ship originating
  ::  the request. the joined time for a user join is .now.bowl.
  ::
  ::  group seats can also be added by a group admin. this allows,
  ::  for instance, for pre-populating member roles ahead of time.
  ::  seats manually added have a default joined time.
  ::
  ++  se-c-seat
    |=  [ships=(set ship) =c-seat:g]
    ^+  se-core
    =/  user-join  =(ships (sy src.bowl ~))
    ::
    ?-    -.c-seat
        %add
      =.  seats.group
        %-  ~(uni by seats.group)
        %-  malt
        ^-  (list [ship seat:g])
        %+  turn  ~(tap in ships)
        |=  =ship
        ::  ships added by admins have default joined time
        =/  joined  ?:(user-join now.bowl *time)
        :-  ship
        %*(. (~(gut by seats.group) ship *seat:g) joined joined)
      ::
      =.  se-core
        %+  roll  ~(tap in ships)
        |=  [=ship =_se-core]
        ::XX why does =, se-core not work here?
        =.  requests.admissions.group.se-core
          (~(del by requests.admissions.group.se-core) ship)
        =+  seat=(~(got by seats.group.se-core) ship)
        (se-update:se-core %seat (sy ship ~) [%add seat])
      ::  send invites to manually added ships
      ::
      =?  se-core  !user-join  (se-send-invites flag ships)
      se-core
    ::
        %del
      ~|  %se-c-seat-delete-channel-host
      ?<  ?|  (~(has in ships) our.bowl)
              !=(~ (~(int in ships) se-channel-hosts))
          ==
      ::TODO if any of the ships was pending and invited,
      ::     cancel their tokens.
      ::
      =.  seats.group
        %-  ~(rep in ships)
        |=  [=ship =_seats.group]
        (~(del by seats) ship)
      ::  kick out deleted members from the groups updates path
      ::
      =/  kicks
        %+  roll  ~(tap by sup.bowl)
        |=  [[* [=ship =path]] paths=(list path)]
        ?.  (~(has in ships) ship)  paths
        ?.  ?=([%server %groups ship=@ name=@ %updates time=@ ~] path)
          paths
        [path paths]
      ::  nb: we send seat deletion update before kicking,
      ::  so that deleted members will not attempt to re-establish
      ::  the subscription.
      ::
      =?  se-core  !=(~ kicks)  (emit [%give %kick kicks ~])
      (se-update:se-core %seat ships [%del ~])
    ::
        %add-roles
      =.  roles.c-seat
        (~(int in ~(key by roles.group)) roles.c-seat)
      ?:  =(~ roles.c-seat)  se-core
      =.  seats.group
        %-  ~(rep in ships)
        |=  [=ship =_seats.group]
        =+  seat=(~(got by seats) ship)
        =.  seat
          seat(roles (~(uni in roles.seat) roles.c-seat))
        (~(put by seats) ship seat)
      (se-update:se-core %seat ships [%add-roles roles.c-seat])
    ::
        %del-roles
      =.  seats.group
        %-  ~(rep in ships)
        |=  [=ship =_seats.group]
        =+  seat=(~(got by seats) ship)
        =.  seat
          seat(roles (~(dif in roles.seat) roles.c-seat))
        (~(put by seats) ship seat)
      (se-update:se-core %seat ships [%del-roles roles.c-seat])
    ==
  ::  +se-send-invites: invite ships
  ::
  ++  se-send-invites
    |=  [=flag:g ships=(set ship)]
    ^+  se-core
    %+  roll  ~(tap in ships)
    |=  [=ship =_se-core]
    =*  her  +<-
    =*  acc  +<+
    =,  se-core
    =/  =wire  (weld se-area /invite/(scot %p her))
    ~&  inviting+her
    =^  tok=(unit token:g)  acc
      ?:  ?=(%public privacy.ad)
        ::XX  returning just a unit compiles,
        ::    uncovering a compiler bug!
        [~ acc]
      (se-c-entry-token [%add personal+her ~ ~ |])
    ~&  inviting-2+her
    =/  =invite:g
        :*  flag
            now.bowl
            our.bowl
            tok
            ~  ::  note
            se-preview
        ==
    =/  =a-foreigns:v7:g
      [%invite invite]
    =/  cage  foreign-action-1+!>(a-foreigns)
    ::XX modifying cor here does not work, even though we
    ::   exposed the namespace with tiscom above.
    ::
    (emit [%pass wire %agent [her dap.bowl] %poke cage])
  ::  +se-c-role: execute a role command
  ::
  ::  roles determine member permissions. there are currently
  ::  three kinds of permissions in groups:
  ::
  ::  1. permission to read a channel, stored in .readers in a $channel
  ::  2. permission to write to a channel, stored in the channels agent
  ::  3. admin permissions to manage the group, stored in .admins in a $group
  ::
  ::  these permissions do not affect the group host, who always
  ::  possesses full power to access and administer the group.
  ::
  ::  only the group host can change the set of admin roles.
  ::
  ++  se-c-role
    |=  [roles=(set role-id:g) =c-role:g]
    ^+  se-core
    ::  forbid duplicate roles
    ?<  ?&  ?=(%add -.c-role)
            =(roles (~(int in ~(key by roles.group)) roles))
        ==
    ::  forbid anyone but the group host to change admin roles
    ?<  ?&  !=(p.flag src.bowl)
            ?=(?(%set-admin %del-admin) -.c-role)
        ==
    ?-    -.c-role
        %add
      =/  =role:g
        [meta.c-role ~]
      =.  roles.group
        %-  ~(rep in roles)
        |=  [=role-id:g =_roles.group]
        (~(put by roles) role-id role)
      (se-update %role roles [%add meta.c-role])
    ::
        %edit
      =.  roles.group
        %-  ~(rep in roles)
        |=  [=role-id:g =_roles.group]
        =+  role=(~(got by roles) role-id)
        =.  role  role(meta meta.c-role)
        (~(put by roles) role-id role)
      (se-update %role roles [%edit meta.c-role])
    ::
        %del
        =.  roles.group
          %-  ~(rep in roles)
          |=  [=role-id:g =_roles.group]
          (~(del by roles) role-id)
        =.  seats.group
          %-  ~(urn by seats.group)
          |=  [* =seat:g]
          seat(roles (~(dif in roles.seat) roles))
      ::  remove roles from channels
      ::
      =/  channels  ~(tap by channels.group)
      =.  se-core
        |-
        ?~  channels  se-core
        =*  next  $(channels t.channels)
        =/  [=nest:g =channel:g]  i.channels
        ::  repair readers as needed
        ::
        =.  se-core  (se-channel-del-roles nest roles)
        ::  repair writers as needed
        ::
        ::  not host
        ?:  !=(our.bowl p.q.nest)  next
        =+  .^(has=? %gu (channels-scry nest))
        ::  missing channel
        ?.  has  next
        ::  unsupported channel
        ?.  ?=(?(%chat %heap %diary) p.nest)  next
        =/  cmd=c-channels:d
          [%channel nest %del-writers (sects:v2:roles:v7:gv roles)]
        =/  cage  channel-command+!>(cmd)
        =/  dock  [p.q.nest %channels-server]
        =.  se-core  (emit %pass /channels/perms %agent dock %poke cage)
        next
      (se-update %role roles [%del ~])
    ::
        %set-admin
      =.  admins.group  (~(uni in admins.group) roles)
      (se-update %role roles [%set-admin ~])
    ::
        %del-admin
      =.  admins.group  (~(dif in admins.group) roles)
      (se-update %role roles [%del-admin ~])
    ==
  ::  +se-c-channel: execute a channel command
  ::
  ++  se-c-channel
    |=  [=nest:g =c-channel:g]
    ^+  se-core
    =*  by-ch  ~(. by channels.group)
    =*  chan  channel.c-channel
    ~&  se-c-chanel+[c-channel ~(key by channels.group)]
    ?<  &(?=(%add -.c-channel) (has:by-ch nest))
    ?-    -.c-channel
        %add
      =.  added.chan  now.bowl
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
        %add-readers
      ::  forbid adding non-existent roles as readers
      ::
      ?>  =(~ (~(dif in roles.c-channel) ~(key by roles.group)))
      =/  =channel:g  (got:by-ch nest)
      =.  readers.channel  (~(uni in readers.channel) roles.c-channel)
      =.  channels.group  (put:by-ch nest channel)
      (se-update %channel nest [%add-readers roles.c-channel])
    ::
        %del-readers
      =.  se-core  (se-channel-del-roles nest roles.c-channel)
      (se-update %channel nest [%del-readers roles.c-channel])
    ::
        %section
      =/  =channel:g  (got:by-ch nest)
      ?>  (~(has by sections.group) section-id.c-channel)
      =.  section.channel   section-id.c-channel
      =.  channels.group  (put:by-ch nest channel)
      ::  add the channel to section in order, by first
      ::  removing it.
      ::
      =.  sections.group
        %+  ~(jab by sections.group)  section.channel
        |=(=section:g section(order (~(push of order.section) nest)))
      (se-update %channel nest [%section section-id.c-channel])
    ==
  ::CONTINUE
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
    ?<  (se-is-banned src.bowl)
    ?+    path  ~|(se-watch-bad+path !!)
        [%updates ship=@ after=@ ~]
      =/  ship   (slav %p i.t.path)
      =/  after  (slav %da i.t.t.path)
      ?>  =(ship src.bowl)
      ?>  (se-is-member src.bowl)
      (se-watch-updates ship after)
    ::
      [%preview rest=*]  (se-watch-preview t.path)
    ::
        [%token ship=@ ~]
      =+  ship=(slav %p i.t.path)
      ?>  (se-is-admin src.bowl)
      (se-watch-token ship)
    ::
        [%ask ship=@ ~]
      =+  ship=(slav %p i.t.path)
      (se-watch-ask ship)
    ==
  ::
  ++  se-watch-updates
    |=  [=ship =@da]
    ^+  se-core
    ~&  se-watch-updates+[ship da]
    =/  =log:g  (lot:log-on:g log `da ~)
    ::  filter out admin updates
    ::
    =?  log  !(se-is-admin ship)
      (se-log-exclude log se-is-admin-update)
    (give %fact ~ group-log+!>(log))
  ::  +se-log-exclude: exclusively filter update log
  ::
  ++  se-log-exclude
    |=  [=log:g fit=$-(u-group:g ?)]
    ^+  log
    %+  gas:log-on:g  *log:g
    %+  skip  (tap:log-on:g log)
    |=  [=time =u-group:g]
    (fit u-group)
  ::  +se-watch-index: handle index request
  ::
  ++  se-watch-index
    ^+  se-core
    =;  =cage
      =.  se-core  (emit %give %fact ~ cage)
      (emit %give %kick ~ ~)
    :-  %group-previews-1
    !>  ^-  previews:v7:g
    %-  ~(gas by *previews:v7:g)
    %+  murn  ~(tap by groups)
    |=  [=flag:g =net:g =group:g]
    ^-  (unit [flag:g preview:v7:g])
    ?.  &(=(our.bowl p.flag) !?=(%secret privacy.admissions.group))
      ~
    `[flag se-preview]
  ::  +se-is-admin-u-group: check if group update is restricted
  ::
  ++  se-is-admin-update
    |=  =u-group:g
    ?+  u-group  |
      [%entry %ask *]  &
      [%entry %token *]  &
    ==
  ::
  ++  se-watch-preview
    |=  =path
    ^+  se-core
    =/  allow=?
      ?.  ?=(%secret privacy.ad)  &
      ::
      ?:  ?=(~ path)  |
      ?>  ?=([token=@ ~] path)
      =+  token=(slav %uv i.path)
      ::  TODO a secret group requires an access token.
      ::       for now, reject as in old %groups
      ::
      |
    =/  =preview-update:g
      ?.  allow  ~
      `se-preview
    =.  se-core
      (give %fact ~ group-preview-3+!>(`preview-update:v7:g`preview-update))
    (give %kick ~ ~)
  ::  +se-preview: the group preview
  ::
  ++  se-preview
    =,  group
    :*  flag
        meta
        now.bowl
        ~(wyt by seats)
        privacy.admissions
    ==
  ::  +se-watch-token: ask for a personal token for a ship
  ::
  ++  se-watch-token
    |=  =ship
    ^+  se-core
    =^  tok=(unit token:g)  se-core
      (se-c-entry-token %add [personal+ship ~ ~ &])
    =.  se-core  (give %fact ~ group-token+!>(tok))
    (give %kick ~ ~)
  ::  +se-watch-ask: handle a group ask request
  ::
  ++  se-watch-ask
    |=  =ship
    ^+  se-core
    ?.  =(%public privacy.ad)  ::TMI
      :: for a private group we wait until the request is approved
      se-core
    ::  for a public group we send back an invite
    ::
    =.  se-core  (give %fact ~ group-token+!>(~))
    (give %kick ~ ~)
  ++  se-agent
    |=  [=path =sign:agent:gall]
    ^+  se-core
    ?+    path  ~|(se-agent-bad-path+path !!)
        [%invite ship=@ ~]
      =+  ship=(slav %p i.t.path)
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  se-core
      %-  (slog leaf+"failed to invite ship {<ship>}" u.p.sign)
      se-core
    ==
  --
::  +go-core: group client core
::
++  go-core
  |_  [=flag:g =net:g =group:g gone=_|]
  +*  ad  admissions.group
  ::
  ++  go-core  .
  ::  +go-abed: init
  ::
  ++  go-abed
    |=  f=flag:g
    ^+  go-core
    ~|  flag=f
    =/  [=net:g =group:g]  (~(got by groups) f)
    go-core(flag f, group group, net net)
  ::  +go-abet: final
  ::
  ++  go-abet
    ^+  cor
    =.  groups
      ?:  gone
        (~(del by groups) flag)
      (~(put by groups) flag net group)
    ?.  gone  cor
    =.  go-core  (go-response [%delete ~])
    =?  cor  !go-our-host  (emil leave-subs:go-pass)
    cor
  ::  +go-area: group base path
  ++  go-area  `path`/groups/(scot %p p.flag)/[q.flag]
  ::  go-server-path: group server base path
  ++  go-server-path  `path`/server/groups/(scot %p p.flag)/[q.flag]
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
            [%ask =ship]
        ==
    ^+  go-core
    =.  cor
      %-  submit-activity
      ^-  action
      =,  concern
      ::TODO port %activity to new %groups types
      :-  %add
      ?-  -.concern
        %ask   [%group-ask ^flag ship]
        %join  [%group-join ^flag ship]
        %kick  [%group-kick ^flag ship]
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
  ::  +go-is-banned: check whether the ship is banned
  ::
 ++  go-is-banned
    |=  =ship
    =*  banned  banned.admissions.group
    ?|  (~(has in ranks.banned) (clan:title ship))
        (~(has in ships.banned) ship)
    ==
  ::  go-our-host: check whether we are the host
  ::
  ++  go-our-host  ?=(%pub -.net)
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
    ++  request-token
      |=  =ship
      ^-  card
      =/  =wire  (weld go-area /invite/(scot %p ship)/token)
      =/  =dock  [p.flag server]
      =/  =path  (weld go-server-path /token/(scot %p ship))
      [%pass wire %agent dock %watch path]
    ::
    ++  leave-subs
      ^-  (list card)
      =/  =wire  (snoc go-area %updates)
      =/  =dock  [p.flag dap.bowl]
      =^  caz=(list card)  subs
        (~(unsubscribe s [subs bowl]) wire dock)
      caz
    ::
    ++  leave-group
      ^-  card
      =/  =wire  (weld go-area /command/leave)
      =/  =dock  [p.flag server]
      [%pass wire %agent dock %poke group-command+!>(`c-groups:g`[%leave flag])]
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
      =/  =cage  channel-action+!>(action)
      =/  =wire  (snoc go-area %join-channels)
      `[%pass wire %agent dock %poke cage]
    --
  ::  +go-has-sub: check if we are subscribed to the group
  ::
  ++  go-has-sub
    (~(has by wex.bowl) [(snoc go-area %updates) p.flag server])
  ::  +go-safe-sub: safely subscribe to the group for updates
  ::
  ++  go-safe-sub
    |=  delay=?
    ^+  go-core
    ?:  |(go-has-sub go-our-host)  go-core
    (go-start-updates delay)
  ::  +go-start-updates: subscribe to the group for updates
  ::
  ++  go-start-updates
    |=  delay=?
    ^+  go-core
    ?>  ?=(%sub -.net)
    ::TODO use the last heard time from logs
    =.  cor
      %.  delay
      %^  safe-watch  go-sub-wire  [p.flag server]
      (weld go-server-path /updates/(scot %p our.bowl)/(scot %da time.net))
    go-core
  ::  +go-join: join a group
  ::
  ++  go-join
    |=  [=flag:g =token:g]
    ^+  go-core
    =/  =wire  (weld go-area(flag flag) /join)
    =.  cor
      (emit %pass wire %agent [p.flag server] %poke group-command+!>([%join flag token]))
    go-core
  ::  +go-leave: leave a group and cancel all channel subscriptions
  ::
  ++  go-leave
    |=  send-leave=?
    ^+  go-core
    =.  cor
      (submit-activity [%del %group flag])
    ::NOTE  we leave all channels, not just those that
    ::      are joined, as this is robust to bugs
    ::      in active channels tracking.
    ::
    =/  channels  ~(tap in ~(key by channels.group))
    =.  cor  (emil (leave-channels:go-pass channels))
    =?  cor  send-leave  (emit leave-group:go-pass)
    ::
    go-core(gone &)
  ::  +go-preview: generate the preview of the group
  ::
  ++  go-preview
    ^-  preview:v7:g
    :*  flag
        meta.group
        now.bowl
        ~(wyt by seats.group)
        privacy.ad
    ==
  ::  +go-a-invite: send an invite
  ::
  ++  go-a-invite
    |=  =a-invite:g
    ?:  &(?=(~ token.a-invite) !?=(%public privacy.ad))
      ::  if we don't have a suitable token for a non-public group,
      ::  we are going to request it
      ::
      ::  TODO: this loses the note.a-invite.
      ::
      =.  cor  (emit (request-token:go-pass ship.a-invite))
      go-core
    =/  =wire
      %+  weld  go-area
      /invite/(scot %p ship.a-invite)
    =/  =invite:v7:g
      :*  flag
          now.bowl
          our.bowl
          token.a-invite
          note.a-invite
          go-preview
      ==
    =.  invited.ad
      (~(put by invited.ad) ship.a-invite [now.bowl token.a-invite])
    =.  cor
      =/  =cage
        group-foreign-action-1+!>(`a-foreigns:v7:g`[%invite invite])
      ~&  go-invite+ship.a-invite
      %^  emit  %pass  wire
      [%agent [ship.a-invite dap.bowl] %poke cage]
    go-core

  ::  +go-a-group: execute group action
  ::
  ++  go-a-group
    |=  =a-group:g
    ~&  go-a-group+-.a-group
    ^+  go-core
    ?>  from-self
    (go-send-command /command `c-group:g`a-group)
  ::  +go-send-command:  send command to the group host
  ::
  ++  go-send-command
    |=  [=wire =c-group:g]
    ^+  go-core
    ?>  from-self
    =/  =^wire  (weld go-area wire)
    =/  =cage  group-command+!>([%group flag c-group])
    =.  cor  (emit %pass wire %agent [p.flag server] %poke cage)
    go-core
  ::
  ++  go-agent
    |=  [=wire =sign:agent:gall]
    ^+  go-core
    ?+    wire  ~|(go-agent-bad+wire !!)
        [%updates ~]  (go-take-update sign)
    ::
        ::  poked group host with a command
        ::
        [%command ~]
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  go-core
      ::XX log failure
      %-  (slog u.p.sign)
      go-core
    ::
        ::  invited a ship to the group
        ::
        [%invite ship=@ ~]
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  go-core
      ::XX log failure
      %-  (slog u.p.sign)
      go-core
    ::
        ::  requested a personal invite token for the ship
        ::
        [%invite ship=@ %token ~]
      ::TODO good practice - include useful info in crashes
      ::
      ~|  go-agent-bad-invite+-.sign
      ?+    -.sign  !!
        %kick       go-core  ::  single-shot watch
      ::
          %watch-ack
        %.  go-core
        ?~  p.sign  same
        (slog leaf/"Failed invite token subscription" u.p.sign)
      ::
          %fact
        =*  cage  cage.sign
        ?>  ?=(%group-token p.cage)
        =+  !<(=token:g q.cage)
        =+  ship=(slav %p i.t.wire)
        (go-a-invite ship `token ~)
      ==
    ::
        ::  joined or left channels
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
    ::XX enable imports
    :: [%wake ~]     go-core
    ::
    ::
    ==
  ::
  ++  go-take-update
    |=  =sign:agent:gall
    ^+  go-core
    ?+   -.sign  ~|(go-take-update-bad+-.sign !!)
      %kick  (go-safe-sub &)
    ::
        %watch-ack
      ~&  go-take-update+%watch-ack
      =?  cor  (~(has by foreigns) flag)
        fi-abet:(fi-watched:(fi-abed:fi-core flag) p.sign)
      ::TODO think about this failure mode: we obtained a seat
      ::     in the group, but we could not establish a subscription.
      ::     this means the host rejected us, and we should probably
      ::     exit and clean up the group.
      ::
      %.  go-core
      ?~  p.sign  same
      ::TODO  log, and consider threading error back
      ::      into foreigns for client use.
      (slog leaf/"Failed subscription" u.p.sign)
    ::
        %fact
      =*  cage  cage.sign
      ~&  go-take-fact+p.cage
      ?+  p.cage  ~|(go-take-update-bad-fact+p.cage !!)
        %group-log     (go-apply-log !<(log:g q.cage))
        %group-update  (go-u-group !<(update:g q.cage))
      ==
    ==
  ::  +go-apply-log: apply group log
  ::
  ++  go-apply-log
    |=  =log:g
    ?~  log  go-core
    =/  init=?  ?>(?=(%sub -.net) =(time.net *@da))
    =.  go-core
      %+  roll  (tap:log-on:g log)
      |=  [=update:g =_go-core]
      ::  we need to filter our past kicks upon joining
      ::
      =*  u-group  u-group.update
      ?:  ?&  init
              ?=(%seat -.u-group)
              (~(has in ships.u-group) our.bowl)
              ?=([%del ~] u-seat.u-group)
          ==
        go-core
      (go-u-group:go-core update)
    ?.  init  go-core
    ::  join the channels upon initial group log
    ::
    =/  readable-channels
      %-  ~(gas in *(set nest:g))
      %+  murn  ~(tap in channels.group)
      |=  [=nest:g =channel:g]
      ?.  (go-can-read our.bowl channel)  ~
      `nest
    ~&  join-channels+~(tap in readable-channels)
    =.  cor
      (emil (join-channels:go-pass ~(tap in readable-channels)))
    go-core
  ::  +go-u-group: apply group update
  ::
  ++  go-u-group
    |=  =update:g
    ^+  go-core
    =?  net  ?=(%sub -.net)
      ?>  (gte time.update time.net)
      [%sub time.update]
    =*  u-group  u-group.update
    ~&  go-u-group+[time.update -.u-group]
    ?-  -.u-group
      %create        (go-u-create group.u-group)
      %meta          (go-u-meta data.u-group)
      %entry         (go-u-entry u-entry.u-group)
      %seat          (go-u-seat [ships u-seat]:u-group)
      %role          (go-u-role [roles u-role]:u-group)
      %channel       (go-u-channel [nest u-channel]:u-group)
      %section       (go-u-section [section-id u-section]:u-group)
      %flag-content  (go-u-flag-content [nest post-key src]:u-group)
      %delete        (go-leave |)
    ==
  ::  +go-u-create: apply initial update
  ::
  ++  go-u-create
    |=  gr=group:g
    ^+  go-core
    =.  go-core  (go-response [%create gr])
    ?:  go-our-host  go-core
    ::
    ?>  ?=(%sub -.net)
    =.  group  gr
    go-core
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
      %ask      (go-u-entry-ask u-ask.u-entry)
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
    |=  =u-ban:g
    ^+  go-core
    =.  go-core  (go-response [%entry %ban u-ban])
    ?:  go-our-host  go-core
    ::
    =*  banned  banned.admissions.group
    ?-    -.u-ban
        %set
      =.  ships.banned  ships.u-ban
      =.  ranks.banned  ranks.u-ban
      go-core
    ::
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
  ::  +go-u-entry-ask: apply entry requests update
  ::
  ++  go-u-entry-ask
    |=  =u-ask:g
    ^+  go-core
    =.  go-core  (go-response [%entry %ask u-ask])
    =?  go-core  ?=(%add -.u-ask)
      (go-activity %ask ship.u-ask)
    ?:  go-our-host  go-core
    ?-    -.u-ask
        %add
      =.  requests.ad  (~(put by requests.ad) [ship story]:u-ask)
      go-core
    ::
        %del
      =.  requests.ad
        %+  roll  ~(tap in ships.u-ask)
        |=  [=ship =_requests.ad]
        (~(del by requests.ad) ship)
      go-core
    ==
  ::  +go-u-entry-token: apply entry token update
  ::
  ++  go-u-entry-token
    |=  =u-token:g
    ^+  go-core
    =.  go-core  (go-response [%entry %token u-token])
    ?:  go-our-host  go-core
    ::
    ?-    -.u-token
        %add
      =.  tokens.ad
        (~(put by tokens.ad) [token meta]:u-token)
      go-core
    ::
        %del
      ::TODO if a token we had used for inviting someone to the group
      ::     has been revoked, we should signal to the invitee.
      ::
      ?>  (~(has by tokens.ad) token.u-token)
      =.  tokens.ad  (~(del by tokens.ad) token.u-token)
      go-core
    ==
  ::  +go-u-seat: apply seat update
  ::
  ++  go-u-seat
    |=  [ships=(set ship) =u-seat:g]
    ^+  go-core
    ~&  go-u-seat+u-seat
    ?-    -.u-seat
        %add
      =.  go-core  (go-response %seat ships [%add seat.u-seat])
      =?  go-core  !=(joined.seat.u-seat *@da)
        %-  ~(rep in ships)
        |=  [=ship =_go-core]
        (go-activity:go-core %join ship)
      ?:  go-our-host  go-core
      ::
      =.  seats.group
        %-  ~(rep in ships)
        |=  [=ship =_seats.group]
        (~(put by seats) ship seat.u-seat)
      go-core
    ::
        %del
      =+  leave=(~(has in ships) our.bowl)
      =.  go-core  (go-response %seat ships [%del ~])
      =.  go-core
        %-  ~(rep in ships)
        |=  [=ship =_go-core]
        ::  only notify about ships which had actually joined the group
        ::
        ?~  seat=(~(get by seats.group) ship)  go-core
        ?:  =(*@da joined.u.seat)  go-core
        (go-activity:go-core %kick ship)
      ?:  go-our-host  go-core
      ::
      =.  seats.group
        %-  ~(rep in ships)
        |=  [=ship =_seats.group]
        (~(del by seats.group) ship)
      =?  go-core  leave  (go-leave |)
      go-core
    ::
        %add-roles
      =.  go-core  (go-response %seat ships [%add-roles roles.u-seat])
      =.  go-core
        %-  ~(rep in ships)
        |=  [=ship =_go-core]
        =+  seat=(~(got by seats.group) ship)
        ?:  =(~ (~(dif in roles.u-seat) roles.seat))  go-core
        (go-activity:go-core %role ship roles.u-seat)
      ?:  go-our-host  go-core
      ::
      =.  seats.group
        %-  ~(rep in ships)
        |=  [=ship =_seats.group]
        =+  seat=(~(got by seats) ship)
        =.  seat
          seat(roles (~(uni in roles.seat) roles.u-seat))
        (~(put by seats) ship seat)
      go-core
    ::
        %del-roles
      =.  go-core  (go-response %seat ships [%del-roles roles.u-seat])
      =.  go-core
        %-  ~(rep in ships)
        |=  [=ship =_go-core]
        =+  seat=(~(got by seats.group) ship)
        ?:  =(~ (~(int in roles.u-seat) roles.seat))  go-core
        (go-activity:go-core %role ship roles.u-seat)
      ?:  go-our-host  go-core
      ::
      =.  seats.group
        %-  ~(rep in ships)
        |=  [=ship =_seats.group]
        =+  seat=(~(got by seats) ship)
        =.  seat
          seat(roles (~(dif in roles.seat) roles.u-seat))
        (~(put by seats) ship seat)
      go-core
    ==
  ::  +go-u-role: apply role update
  ::
  ++  go-u-role
    |=  [roles=(set role-id:g) =u-role:g]
    ^+  go-core
    ::TODO review updates in other places. do we no-op
    ::     when a resource does not exist?
    ::
    ?.  ?|  ?=(%add -.u-role)
            =(roles (~(int in ~(key by roles.group)) roles))
        ==
      go-core
    ?-    -.u-role
        %add
      =.  go-core  (go-response %role roles [%add meta.u-role])
      ?:  go-our-host  go-core
      ::
      =/  =role:g
        [meta.u-role ~]
      =.  roles.group
        %-  ~(rep in roles)
        |=  [=role-id:g =_roles.group]
        (~(put by roles) role-id role)
      go-core
    ::
        %edit
      =.  go-core  (go-response %role roles [%edit meta.u-role])
      ?:  go-our-host  go-core
      ::
      =.  roles.group
        %-  ~(rep in roles)
        |=  [=role-id:g =_roles.group]
        =+  role=(~(got by roles) role-id)
        =.  role  role(meta meta.u-role)
        (~(put by roles) role-id role)
      go-core
    ::
        %del
      =.  go-core  (go-response %role roles [%del ~])
      ?:  go-our-host  go-core
      ::
      =.  roles.group
        %-  ~(rep in roles)
        |=  [=role-id:g =_roles.group]
        (~(del by roles) role-id)
      =.  seats.group
        %-  ~(urn by seats.group)
        |=  [* =seat:g]
        seat(roles (~(dif in roles.seat) roles))
      ::  remove roles from channels
      ::
      =/  channels  ~(tap by channels.group)
      =.  go-core
        |-
        ?~  channels  go-core
        =*  next  $(channels t.channels)
        =/  [=nest:g =channel:g]  i.channels
        ::  repair readers as needed
        ::
        =.  go-core  (go-channel-del-roles nest roles)
        ::  repair writers as needed
        ::
        ::  not host
        ?:  !=(our.bowl p.q.nest)  next
        =+  .^(has=? %gu (channels-scry nest))
        ::  missing channel
        ?.  has  next
        ::  unsupported channel
        ?.  ?=(?(%chat %heap %diary) p.nest)  next
        =/  cmd=c-channels:d
          [%channel nest %del-writers (sects:v2:roles:v7:gv roles)]
        =/  cage  channel-command+!>(cmd)
        =/  dock  [p.q.nest %channels-server]
        =.  cor  (emit %pass /channels/perms %agent dock %poke cage)
        next
      go-core
    ::
        %set-admin
      =.  go-core  (go-response %role roles [%set-admin ~])
      ?:  go-our-host  go-core
      ::
      =.  admins.group  (~(uni in admins.group) roles)
      go-core
    ::
        %del-admin
      =.  go-core  (go-response %role roles [%del-admin ~])
      ?:  go-our-host  go-core
      ::
      =.  admins.group  (~(dif in admins.group) roles)
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
        %add-readers
      ?>  =(~ (~(dif in roles.u-channel) ~(key by roles.group)))
      =.  go-core  (go-response %channel nest [%add-readers roles.u-channel])
      ?:  go-our-host  go-core
      ::
      =.  channels.group
        %+  ~(jab by channels.group)  nest
        |=  =channel:g
        channel(readers (~(uni in readers.channel) roles.u-channel))
      go-core
    ::
        %del-readers
      =.  go-core  (go-response %channel nest [%del-readers roles.u-channel])
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
    ~&  go-response+r-group
    ::  v1 response
    ::
    =/  r-groups-7=r-groups:v7:g  [flag r-group]
    =/  v1-paths  ~[/v1/groups [%v1 go-area]]
    =.  cor  (give %fact v1-paths group-response-1+!>(r-groups-7))
    ::  v0 backcompat
    ::
    =/  diffs-2=(list diff:v2:g)
      (diff:v2:r-group:v7:gv r-group [seats admissions]:group)
    =.  cor
      %+  roll  diffs-2
      |=  [=diff:v2:g =_cor]
      =/  action-2=action:v2:g  [flag now.bowl diff]
      (give:cor %fact ~[/groups/ui] group-action-3+!>(action-2))
    go-core
  ::  +go-peek: handle group scry request
  ::
  ++  go-peek
    |=  [ver=?(%v0 %v1 %v2) =(pole knot)]
    ^-  (unit (unit cage))
    ~&  go-peek+[ver pole]
    ::TODO some of these should be versioned, at least
    ::     those used by the client.
    ::
    ?+    pole  ~|(bad-go-peek+pole !!)
    ::
      ::  local preview
      [%preview ~]
    ``noun+!>(go-preview)
    ::
      ::
      ::  seats queries
      ::
        [%seats %ships ~]
      ``ships+!>(~(key by seats.group))
    ::
        [%seats ship=@ ~]
      =+  ship=(slav %p ship.pole)
      ``noun+!>((~(got by seats.group) ship))
    ::
        [%seats ship=@ %is-admin ~]
      =+  ship=(slav %p ship.pole)
      ``noun+!>((go-is-admin ship))
    ::
        [%seats ship=@ %is-banned ~]
      =+  ship=(slav %p ship.pole)
      ``noun+!>((go-is-banned ship))
    ::
      ::
      ::  channels queries
      ::
        [%channels app=@ ship=@ name=@ rest=*]
      =/  =nest:g  [app.pole (slav %p ship.pole) name.pole]
      ?+    rest.pole  [~ ~]
          [%can-read ship=@ ~]
        ::TODO maybe %loob mark, here and elseweher
        ?~  channel=(~(get by channels.group) nest)
          ``noun+!>(|)
        =+  ship=(slav %p ship.rest.pole)
        ::TODO this was producing a gate for a reason (channels agent
        ::     perm recheck perf)
        ``noun+!>((go-can-read ship u.channel))
        ::
          [%can-write ship=@ ~]
        =+  ship=(slav %p ship.rest.pole)
        ^-  (unit (unit cage))
        :: =-  ``noun+!>(-)
        ?~  seat=(~(get by seats.group) ship)  [~ ~]
        ?:  (go-is-banned ship)  [~ ~]
        =-  ``noun+!>(-)
        %-  some
        :-  admin=(go-is-admin ship)
        roles=roles.u.seat
      ==
    ::
      ::
      ::  admissions queries
      ::
        [%entry %tokens ~]
      ``noun+!>(tokens.ad)
    ==
  ++  go-can-read
    |=  [=ship =channel:g]
    ^-  ?
    =/  public=?  ?=(%public privacy.admissions.group)
    =/  open  =(~ readers.channel)
    =/  seat  (~(get by seats.group) ship)
    ?:  (go-is-banned ship)  |
    ::  allow to read the channel in case:
    ::  (1) the ship is admin
    ::  (2) the channel is public and open
    ::  (3) the ship is a member and the channel is open
    ::  (4) the ship has a reader role explicitly
    ::
    ?:  ?|  (go-is-admin ship)
            &(public open)
            &(!=(~ seat) open)
        ==
      &
    ?~  seat  |
    !=(~ (~(int in readers.channel) roles.u.seat))
  --
::  +fi-core: foreign group and invites core
::
++  fi-core
  |_  [=flag:g foreign:g]
  ::
  ++  fi-core  .
  ::  +fi-abed: init
  ::
  ++  fi-abed
    |=  f=flag:g
    ^+  fi-core
    ~|  flag=f
    =/  far=foreign:g  (~(gut by foreigns) f [~ ~ ~ ~])
    fi-core(flag f, +<+ far)
  ::  +fi-abet: final
  ::
  ++  fi-abet
    ^+  cor
    =.  foreigns  (~(put by foreigns) flag +<+)
    ::TODO figure out the foreign lifetime logic after designining
    ::     new endpoints for the client
    ::
    =?  foreigns  ?=([~ %done] progress)
      (~(del by foreigns) flag)
    =.  fi-core  fi-give-update
    cor
  ::  +fi-give-update: give foreigns update
  ::
  ++  fi-give-update
    =/  foreigns  (~(put by foreigns) flag +<+)
    =/  gangs-2
      (~(run by foreigns) gang:v2:foreign:v7:gv)
    =.  cor  (give %fact ~[/gangs/updates] gangs+!>(gangs-2))

    fi-core
  ::
  ++  fi-activity
    =,  activity
    |=  concern=[%group-invite =ship]
    ^+  fi-core
    =.  cor
      %-  submit-activity
      ^-  action
      [%add %group-invite ^flag ship.concern]
    fi-core
  ::  +fi-area: foreign base path
  ++  fi-area  `path`/foreigns/(scot %p p.flag)/[q.flag]
  ::  +fi-server-path: group server base path
  ++  fi-server-path  `path`/server/groups/(scot %p p.flag)/[q.flag]
  ::  +fi-pass: cards core
  ::
  ++  fi-pass
    |%
    ++  leave-group
      ^-  card
      =/  =wire  (weld fi-area /command/leave)
      =/  =dock  [p.flag server]
      [%pass wire %agent dock %poke group-command+!>(`c-groups:g`[%leave flag])]
    ::
    ++  join
      |=  tok=(unit token:g)
      ^-  card
      =/  =wire  (weld fi-area /join/[?~(tok %public (scot %uv u.tok))])
      =/  =cage
        group-command+!>(`c-groups:g`[%join flag tok])
      [%pass wire %agent [p.flag server] %poke cage]
    ::
    ++  ask
      |=  story=(unit story:s:g)
      ^-  (list card)
      =/  =wire  (weld fi-area /join/ask)
      =/  =path  (weld fi-server-path /ask)
      =/  =cage
        group-command+!>(`c-groups:g`[%ask flag story])
      :~  [%pass wire %agent [p.flag server] %poke cage]
          [%pass wire %agent [p.flag server] %watch path]
      ==
    ::
    ++  preview
      ^-  (list card)
      =/  =wire
        (welp fi-area /preview)
      =/  =dock  [p.flag dap.bowl]
      =/  =path  (weld fi-server-path /preview)
      =/  watch  [%pass wire %agent dock %watch path]
      ::  clean up the old sub before watching again
      :~  [%pass wire %agent dock %leave ~]
          watch
      ==
    ::
    ++  get-index
      |=  =ship
      ^-  (list card)
      =/  =wire  /foreigns/index/(scot %p ship)
      =/  =dock  [ship server]
      =/  =path  /server/groups/index
      ::  clean up the old sub before watching again
      :~  [%pass wire %agent dock %leave ~]
          [%pass wire %agent dock %watch path]
      ==
    --
  ::  +fi-a-foreign: execute foreign group action
  ::
  ++  fi-a-foreign
    |=  =a-foreign:g
    ^+  fi-core
    ~&  fi-a-foreign+-.a-foreign
    ?>  from-self
    ?-  -.a-foreign
      %join     (fi-join token.a-foreign)
      %ask      (fi-ask story.a-foreign)
      %cancel   fi-cancel
      %decline  (fi-decline token.a-foreign)
    ==
  ::  +fi-join: join the group
  ::
  ::
  ++  fi-join
    |=  tok=(unit token:g)
    ^+  fi-core
    =.  cor  (emit (initiate:neg [p.flag server]))
    ::TODO  fix the case of a failed group subscription.
    ::      if a subscription failed, the group will persist,
    ::      but it won't be possible to restart the subscription
    ::
    ?:  (~(has by groups) flag)  fi-core
    ?:  ?&  ?=(^ progress)
            ?=(?(%join %watch %done) u.progress)
        ==
      ::  join already in progress
      fi-core
    =.  progress  `%join
    =.  token  tok
    =.  cor  (emit (join:fi-pass tok))
    fi-core
  ::  +fi-ask: ask to join the group
  ::
  ++  fi-ask
    |=  story=(unit story:s:g)
    ^+  fi-core
    =.  cor  (emit (initiate:neg [p.flag server]))
    ?:  (~(has by groups) flag)  fi-core
    ?:  ?&  ?=(^ progress)
            ?=(?(%ask %join %watch %done) u.progress)
        ==
      ::  join already in progress
      fi-core
    =.  progress  `%ask
    =.  token  ~
    =.  cor  (emil (ask:fi-pass story))
    fi-core
  ::  +fi-watched: complete group subscription
  ::
  ++  fi-watched
    |=  p=(unit tang)
    ^+  fi-core
    ?~  progress
      ::NOTE  the $foreign in state might be "stale", if it's no longer
      ::      tracking progress it's safe for it to ignore $group subscription
      ::      updates.
      fi-core
    ?^  p
      %-  (slog leaf/"Failed to join" u.p)
      =.  progress  `%error
      fi-core
    =.  progress  `%done
    fi-core
  ::  +fi-cancel: cancel a group join in progress
  ::
  ++  fi-cancel
    ^+  fi-core
    =+  pro=progress  ::TMI
    ?:  ?=(~ pro)  fi-core
    ?-    u.pro
        ?(%ask %join)
      =.  cor  (emit leave-group:fi-pass)
      =.  progress  ~
      fi-core
    ::
          %watch
        ::XX  make sure this is the logic we want
        =.  cor  go-abet:(go-leave:(go-abed:go-core flag) &)
        =.  progress  ~
        fi-core
    ::
          %error
        =.  progress  ~
        fi-core
    ::
        ::TODO should never be hit as long as we delete
        ::     foreigns on done. log because it is unexpected.
        %done  fi-core
    ==
  ::  +fi-invite: receive a group invitation
  ::
  ++  fi-invite
    |=  =invite:g
    ^+  fi-core
    :: guard against invite spoofing
    ?>  =(from.invite src.bowl)
    =.  invites  [invite(time now.bowl) invites]
    ::  make sure we keep the latest preview
    ::
    =.  preview
      ?~  preview  `preview.invite
      ?:  (gte time.preview.invite time.u.preview)
        `preview.invite
      preview
    ::  we have knocked and we have received.
    ::  assume an invite from the host to be the ask response
    ::  from the host.
    ::
    ?:  ?&  ?=(^ progress)
            ?=(%ask u.progress)
            =(src.bowl p.flag)
        ==
      (fi-join token.invite)
    =.  fi-core  (fi-activity %group-invite src.bowl)
    fi-core
  ::  +fi-decline: reject a group invitation
  ::
  ++  fi-decline
    |=  tok=(unit token:g)
    ^+  fi-core
    =.  invites
      %+  skip  invites
      |=(=invite:g =(token.invite tok))
    fi-core
  ::  +fi-watch: handle watch request
  ::
  ++  fi-watch
    |=  =(pole knot)
    ~&  fi-watch+pole
    ^+  fi-core
    ?+    pole  ~|(bad-fi-watch+pole !!)
    ::
        [%preview ~]
      =.  cor  (emil preview:fi-pass)
      fi-core
    ==
  ::  +fi-watch-index: handle index watch request
  ::
  ++  fi-watch-index
    |=  [ver=?(%v0 %v1) =ship]
    ^+  fi-core
    =.  cor  (emil (get-index:fi-pass ship))
    fi-core
  ::TODO unfortunate inherintance from old groups:
  ::     since updates are sent out in +fi-abet,
  ::     any calls to fi-agent will send out the whole update,
  ::     even though no foreign group might be change. we
  ::     should rather manually generate updates at the points
  ::     that foreigns is affected.
  ::
  ::  +fi-agent: receive foreign sign
  ::
  ++  fi-agent
    |=  [=(pole knot) =sign:agent:gall]
    ^+  fi-core
    ~&  fi-agent+pole
    ?+    pole  ~|(fi-agent-bad+pole !!)
    ::
        ::  sent an invite to .ship with .token
        ::
        [%invite ship=@ token=@ ~]
      =/  ship  (slav %p ship.pole)
      =/  token  (slav %uv token.pole)
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  fi-core
      %-  (slog u.p.sign)
      fi-core
    ::
        ::  poked the host to join with .token
        ::
        [%join token=@ ~]
      ?>  ?=(%poke-ack -.sign)
      ::  we weren't trying to join, ignore
      ?.  &(?=(^ progress) =(%join u.progress))  fi-core
      ?^  p.sign
        %-  (slog u.p.sign)
        =.  progress  `%error
        fi-core
      =.  progress  `%watch
      =/  =net:g  [%sub *@da]
      =|  =group:g
      =?  meta.group  ?=(^ preview)  meta.u.preview
      =.  groups  (~(put by groups) flag [net group])
      =.  cor
        go-abet:(go-safe-sub:(go-abed:go-core flag) |)
      fi-core
    ::
        ::  asked to join the group
        ::
        [%join %ask ~]
      ?.  &(?=(^ progress) =(%ask u.progress))
        ::  we aren't asking anymore, ignore
        fi-core
      ?-    -.sign
          %poke-ack
        ?^  p.sign
          %-  (slog u.p.sign)
          =.  progress  `%error
          fi-core
        fi-core
      ::
          %kick
        ::  a kick from the host indicates a rejection
        ::
        ::XX log this
        =.  progress  `%error
        fi-core
      ::
          %watch-ack
        ?^  p.sign
          %-  (slog u.p.sign)
          =.  progress  `%error
          fi-core
        fi-core
      ::
          %fact
        ?>  =(%group-token p.cage.sign)
        =+  !<(tok=(unit token:g) q.cage.sign)
        (fi-join tok)
      ==
    ::
        ::  requested a group preview
        ::
        [%preview ~]
      ?+    -.sign  ~|(bad-fi-agent-preview+[pole -.sign] !!)
      ::
        %kick  fi-core  :: single-shot subscription
      ::
          %watch-ack
        ?~  p.sign  fi-core
        %-  (slog u.p.sign)
        fi-core
      ::
          %fact
        ?>  ?=(%group-preview-3 p.cage.sign)
        =+  !<(=preview-update:v7:g q.cage.sign)
        ::TODO do we want to notify the client about unavailable previews?
        ::     we should check in what circumstances does the client
        ::     request for a preview.
        ::
        =.  preview  preview-update
        =.  cor
          =/  path-0  /gangs/(scot %p p.flag)/[q.flag]/preview
          =/  path-1  (snoc fi-area %preview)
          =?  cor  ?=(^ preview)
            %-  emil
            :~  :: v0
                ::
                [%give %fact ~[path-0] group-preview+!>((v2:preview:v7:gv u.preview))]
                [%give %kick ~[path-0] ~]
            ==
          %-  emil
          :~  ::  v1
              ::
              :^  %give  %fact
                ~[path-1]
              group-preview-3+!>(`preview-update:v7:g`preview-update)
              [%give %kick ~[path-1] ~]
          ==
        fi-core
      ==
    ==
  ::  +fi-take-index: receive ship index
  ::
  ++  fi-take-index
    |=  [=ship =sign:agent:gall]
    ^+  fi-core
    ?+    -.sign  ~|(fi-take-index-bad+-.sign !!)
      %kick  fi-core  ::  single-shot subscription
    ::
        %watch-ack
      ?~  p.sign  fi-core
      %-  (slog u.p.sign)
      fi-core
    ::
        %fact
      ?>  ?=(%group-previews-1 p.cage.sign)
      =+  !<(=previews:v7:g q.cage.sign)
      ::  v1
      ::
      =/  path-1  /v1/foreigns/index/(scot %p ship)
      =.  cor  %-  emil
        :~  :^  %give  %fact
              ~[path-1]
            group-previews-1+!>(`previews:v7:g`previews)
          ::
            [%give %kick ~[path-1] ~]
        ==
      ::  v0
      ::
      =/  path-0  /gangs/index/(scot %p ship)
      =/  previews-2=previews:v2:g
        (~(run by previews) v2:preview:v7:gv)
      =.  cor  %-  emil
        :~  :^  %give  %fact
              ~[path-0]
            group-previews+!>(previews-2)
          ::
            [%give %kick ~[path-0] ~]
        ==
      fi-core
    ==
  --
--

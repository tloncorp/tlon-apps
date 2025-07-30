::  groups: agent for managing group membership, metadata and permissions
::
::  groups agent can act both as a group server and
::  as a subscriber to remote groups. unlike channels, this agent is
::  not separated into two distinct subscriber and server agents, but
::  rather achieves this separation with two distinct cores:
::  the server core +se-core and client core +go-core.
::
/-  g=groups, gv=groups-ver, c=chat, d=channels, s=story,
    activity
/-  meta
/+  default-agent, verb, dbug
/+  gc=groups-conv, v=volume, s=subscriber, imp=import-aid, logs,
    t=contacts
/+  of
/+  neg=negotiate, discipline
::  performance, keep warm
/+  groups-json
::
::
/%  m-noun               %noun
/%  m-group              %group
/%  m-group-1            %group-1
/%  m-group-2            %group-2
/%  m-groups             %groups
/%  m-groups-1           %groups-1
/%  m-groups-2           %groups-2
/%  m-groups-ui          %groups-ui
/%  m-groups-ui-1        %groups-ui-1
/%  m-groups-ui-2        %groups-ui-2
/%  m-group-preview      %group-preview
/%  m-group-preview-3    %group-preview-3
/%  m-group-previews     %group-previews
/%  m-group-previews-1   %group-previews-1
/%  m-group-update       %group-update
/%  m-group-log          %group-log
/%  m-group-token        %group-token
/%  m-channel-preview    %channel-preview
/%  m-channel-preview-1  %channel-preview-1
/%  m-group-response-1   %group-response-1
/%  m-group-action-3     %group-action-3
/%  m-gangs              %gangs
/%  m-foreign-1          %foreign-1
/%  m-foreigns-1         %foreigns-1
::
%-  %-  discipline
  :+  ::  marks
      ::
      :~  :+  %noun               &  -:!>(*vale:m-noun)
          :+  %group              &  -:!>(*vale:m-group)
          :+  %group-1            &  -:!>(*vale:m-group-1)
          :+  %group-2            &  -:!>(*vale:m-group-2)
        ::
          :+  %groups             &  -:!>(*vale:m-groups)
          :+  %groups-1           &  -:!>(*vale:m-groups-1)
          :+  %groups-2           &  -:!>(*vale:m-groups-2)
        ::
          :+  %groups-ui          &  -:!>(*vale:m-groups-ui)
          :+  %groups-ui-1        &  -:!>(*vale:m-groups-ui-1)
          :+  %groups-ui-2        &  -:!>(*vale:m-groups-ui-2)
        ::
          :+  %group-preview      &  -:!>(*vale:m-group-preview)
          :+  %group-preview      &  -:!>(*vale:m-group-preview)
          :+  %group-preview-3    &  -:!>(*vale:m-group-preview-3)
        ::
          :+  %group-previews     &  -:!>(*vale:m-group-previews)
          :+  %group-previews-1   &  -:!>(*vale:m-group-previews-1)
        ::
          :+  %group-update       &  -:!>(*vale:m-group-update)
          :+  %group-log          &  -:!>(*vale:m-group-log)
        ::
          :+  %group-token        &  -:!>(*vale:m-group-token)
        ::
          :+  %channel-preview    &  -:!>(*vale:m-channel-preview)
          :+  %channel-preview-1  &  -:!>(*vale:m-channel-preview-1)
        ::
          :+  %group-response-1   &  -:!>(*vale:m-group-response-1)
          :+  %group-action-3     &  -:!>(*vale:m-group-action-3)
        ::
          :+  %gangs              &  -:!>(*vale:m-gangs)
        ::
          :+  %foreign-1          &  -:!>(*vale:m-foreign-1)
          :+  %foreigns-1         &  -:!>(*vale:m-foreigns-1)
      ==
    ::  facts
    ::
    :~  [/server/groups/$/$/updates/$/$ %group-update %group-log ~]
        [/server/groups/$/$/token/$ %group-token ~]
        [/server/groups/$/$/ask/$ %group-token ~]
        [/server/groups/$/$/preview %group-preview-3 ~]
        [/server/groups/index %group-previews-1 ~]
      ::
        [/v1/groups %group-response-1 ~]
        [/groups/ui %group-action-3 ~]
      ::
        [/chan/$/$/$ %channel-preview ~]
        [/v1/channels/$/$/$/preview %channel-preview-1 ~]
      ::
        [/gangs/index/$ %group-previews ~]
        [/gangs/updates %gangs ~]
        [/gangs/$/$/preview %group-preview ~]
      ::
        [/v1/foreigns/$/$/preview %group-preview-3 ~]
        [/v1/foreigns/index/$ %group-previews-1 ~]
    ==
  ::  scries
  ::
  :~  [/x/init/v1 %noun]
      [/x/v2/init %noun]
    ::
      [/x/v0/groups %groups]
      [/x/v1/groups %groups-1]
      [/x/v2/groups %groups-2]
    ::
      [/x/v2/groups/$/$/channels/can-read %noun]
      [/x/v2/groups/$/$/channels/$/$/$/can-write %noun]
      [/x/groups/$/$/seats/$ %noun]
    ::
      [/x/v0/light/groups %groups]
      [/x/v1/light/groups %groups-1]
      [/x/v2/light/groups %groups-2]
    ::
      [/x/v0/ui/groups %groups-ui]
      [/x/v1/ui/groups %groups-ui-1]
      [/x/v2/ui/groups %groups-ui-2]
    ::
      [/x/v0/ui/groups/$/$ %group-ui]
      [/x/v1/ui/groups/$/$ %group-ui-1]
      [/x/v2/ui/groups/$/$ %group-ui-2]
    ::
      [/x/v0/groups/$/$ %group]
      [/x/v1/groups/$/$ %group-1]
      [/x/v2/groups/$/$ %group-2]
    ::
      [/x/v1/foreigns %foreigns-1]
      [/x/v1/foreigns/$/$ %foreign-1]
    ::
      [/x/groups/$/$/v1 %group-ui]  ::  deprecated
  ==
=/  verbose  |
::
%-  %-  agent:neg
    :+  notify=|
      [~.groups^%1 ~ ~]
    %-  my
    :~  %groups^[~.groups^%1 ~ ~]
        %channels^[~.channels^%2 ~ ~]
        %channels-server^[~.channels^%2 ~ ~]
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
        groups=net-groups:v7:gv
        =channels-index:v7:gv
        =foreigns:v7:gv
        =^subs:s
        =pimp:imp
    ==
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
  ?.  .^(? %gu /(scot %p our.bowl)/activity/(scot %da now.bowl)/$)
    cor
  %-  emit
  =/  =cage  activity-action+!>(`action:activity`action)
  [%pass /activity/submit %agent [our.bowl %activity] %poke cage]
::  |l: logging core
::
++  l
  |_  flow=(unit @t)
  ++  fail
    |=  [desc=term =tang]
    =/  =card
      (~(fail logs our.bowl /logs) desc tang deez)
    %-  %-  %*(. slog pri 3)  [leaf+"fail" tang]
    |*  etc=*
    =.  cor  (emit card)
    etc
  ::
  ++  tell
    |=  [vol=volume:logs =echo:logs]
    =/  =card
      (~(tell logs our.bowl /logs) vol echo deez)
    =/  pri
      ?-  vol
        %dbug  0
        %info  1
        %warn  2
        %crit  3
      ==
    %-  %-  %*(. slog pri pri)  echo
    |*  etc=*
    =.  cor  (emit card)
    etc
  ::  +deez: log message details
  ::
  ++  deez
    ^-  (list (pair @t json))
    =;  l=(list (unit (pair @t json)))
      (murn l same)
    :~  ?~(flow ~ `%flow^s+u.flow)
    ==
  --
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+    mark  ~|(bad-mark+mark !!)
      %noun
    ?+    q.vase  !!
        [%group-wake flag:g]
      =+  ;;(=flag:g +.q.vase)
      ?.  |(=(our src):bowl =(p.flag src.bowl))
        cor
      ?~  g=(~(get by groups) flag)
        cor
      go-abet:(go-safe-sub:(go-abed:go-core flag) |)
    ::
        %pimp-ready
      ?-  pimp
        ~         cor(pimp `&+~)
        [~ %& *]  cor
        [~ %| *]  (run-import p.u.pimp)
      ==
    ==
    ::
        %group-command
      =+  !<(=c-groups:v7:gv vase)
      ?-    -.c-groups
          %create
        =/  =flag:g  [our.bowl name.create-group.c-groups]
        ?<  (~(has by groups) flag)
        =.  cor  se-abet:(se-c-create:se-core flag create-group.c-groups)
        fi-abet:(fi-join:(fi-abed:fi-core flag) ~)
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
      =+  !<(=a-groups:v7:gv vase)
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
      ?>  from-self
      =+  !<(=action:v2:gv vase)
      =*  flag  p.action
      =*  diff  q.q.action
      ?:  ?=(%del -.diff)
        ?>  =(p.flag our.bowl)
        =/  =c-groups:g
          [%group flag [%delete ~]]
        $(+< group-command+!>(c-groups))
      ?:  ?=(%secret -.diff)
        =/  =group:v7:gv  +:(~(got by groups) flag)
        ?:  p.diff
          ::  enable group secrecy
          ::
          =/  =a-groups:v7:gv  [%group flag [%entry %privacy %secret]]
          $(+< group-action-4+!>(a-groups))
        ::  disable group secrecy
        ::
        ?:  ?=(?(%public %private) privacy.admissions.group)  cor
        ::  group is secret, make it private
        =/  =a-groups:v7:gv  [%group flag [%entry %privacy %private]]
        $(+< group-action-4+!>(a-groups))
      ::  translate the shut cordon poke:
      ::  1. pending operations translate into entry pending commands.
      ::  2. ask operations translate into foreign ask actions, if it is
      ::     a client request, or into entry ask commands if it is an
      ::     admin request.
      ::
      ?:  ?=([%cordon %shut *] diff)
        =*  cordon-diff  p.p.diff
        ?-  -.cordon-diff
            %add-ships
          ?-    p.cordon-diff
              %ask
            ::  only allow client ask requests
            ?>  =(q.cordon-diff (silt our.bowl ~))
            =/  =a-foreigns:v7:gv
              [%foreign flag %ask ~]
            $(+< group-foreign-1+!>(a-foreigns))
          ::
              %pending
            =/  =a-group:v7:gv
              [%entry %pending q.cordon-diff %add ~]
            $(+< group-action-4+!>(`a-groups:v7:gv`[%group flag a-group]))
          ==
        ::
            %del-ships
          ?-    p.cordon-diff
              %ask
            ?:  =(q.cordon-diff (silt our.bowl ~))
              ::  client: cancel our own ask request
              ::
              =/  =a-foreigns:v7:gv
              [%foreign flag %cancel ~]
              $(+< group-foreign-1+!>(a-foreigns))
            ::  admin: deny ask requests
            ::
            =/  =a-group:v7:gv
              [%entry %ask q.cordon-diff %deny]
            $(+< group-action-4+!>([%group flag a-group]))
          ::
              %pending
            =/  =a-group:v7:gv
              [%entry %pending q.cordon-diff %del ~]
            $(+< group-action-4+!>(`a-groups:v7:gv`[%group flag a-group]))
          ==
        ==
      =/  a-group-list=(list a-group:v7:gv)
        (a-group:v7:diff:v2:gc diff)
      ?:  =(~ a-group-list)  cor
      %+  roll  a-group-list
      |=  [=a-group:v7:gv =_cor]
      =/  =a-groups:v7:gv  [%group flag a-group]
      ^$(+< group-action-4+!>(a-groups))
    ::
        ::  deprecated
        %group-leave
      ?>  from-self
      =+  !<(=flag:g vase)
      ?<  =(our.bowl p.flag)
      go-abet:(go-leave:(go-abed:go-core flag) &)
    ::
    ::  foreign groups interface
    ::
        %group-foreign-1
      =+  !<(=a-foreigns:v7:gv vase)
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
        %group-join
      ?>  from-self
      =+  !<(=join:v0:gv vase)
      ~|  f=flag.join
      =/  =foreign:v7:gv  (~(got by foreigns) flag.join)
      =/  tok=(unit token:g)
        ?~  invites.foreign  ~
        token.i.invites.foreign
      fi-abet:(fi-join:(fi-abed:fi-core flag.join) tok)
    ::
        %group-knock
      ?>  from-self
      =+  !<(=flag:g vase)
      =/  =a-foreigns:v7:gv
        [%foreign flag %ask ~]
      $(+< group-foreign-1+!>(a-foreigns))
    ::
        %group-rescind
      ?>  from-self
      =+  !<(=flag:g vase)
      =/  =a-foreigns:v7:gv
        [%foreign flag %cancel ~]
      $(+< group-foreign-1+!>(a-foreigns))
    ::
        %group-cancel
      ?>  from-self
      =+  !<(=flag:g vase)
      fi-abet:fi-cancel:(fi-abed:fi-core flag)
    ::
        %group-invite
      ?>  from-self
      =+  !<(invite-0=invite:v0:gv vase)
      ?:  =(q.invite-0 our.bowl)
        ::  invitee, deprecated
        ::
        ~|(group-invite-deprecated+%invitee !!)
      :: inviter
      ::
      ?>  (~(has by groups) p.invite-0)
      =/  =a-invite:v7:gv  [q.invite-0 ~ ~]
      $(+< group-action-4+!>(`a-groups:v7:gv`[%invite p.invite-0 a-invite]))
    ::
        %invite-decline
      =+  !<(=flag:g vase)
      ?>  from-self
      ~|  f=flag
      =/  =foreign:v7:gv  (~(got by foreigns) flag)
      ::  backward compatibility: decline all invites
      ::
      %+  roll  invites.foreign
      |=  [=invite:g =_cor]
      =/  =a-foreigns:v7:gv
        [%foreign flag %decline token.invite]
      (poke:cor group-foreign-1+!>(a-foreigns))
  ::
    %reset-all-perms  reset-all-perms
  ::
      %reset-group-perms
    =+  !<(=flag:g vase)
    =/  val  (~(get by groups) flag)
    ?~  val
      cor
    ((reset-group-perms cor) [flag u.val] cor)
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
    ::  we may (in some hosting circumstances) have been bound to serve
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
    =/  bak  (load -:!>([*any-state:load ~]) +>.old-state.egg-any)
    ::  restore any previews & invites we might've had
    ::
    =.  foreigns
      %+  roll  ~(tap by foreigns:bak)
      |=  [[=flag:g far=foreign:g] =_foreigns]
      %+  ~(put by foreigns)  flag
      ?.  (~(has by foreigns) flag)
        far(lookup ~, progress ~, token ~)
      =/  hav  (~(got by foreigns) flag)
      ::  merge foreign:
      ::  1. join invite lists
      ::  2. preserve current lookup, progress and token
      ::  3. prefer current preview
      ::
      :*  (weld invites.hav invites.far)
          lookup.hav
          ?~(preview.hav preview.far preview.hav)
          progress.hav
          token.hav
      ==
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
      =+  goc=(go-abed:go-core:cor flag)
      =.  goc  (go-safe-sub:goc |)
      =.  cor  go-abet:goc
      ::  wake our members if we are the host
      ::
      =?  cor  =(p.flag our.bowl)
        (emil:cor go-wake-members:go-pass:goc)
      %-  emil:cor
      %-  join-channels:go-pass:goc
      ~(tap in ~(key by channels.group.gr))
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
      =/  =c-groups:g  [%group flag [%channel nest %del-readers readers.channel]]
      =/  cage  group-command+!>(c-groups)
      [%pass wire %agent dock %poke cage]
    ^-  card
    =/  =path  (welp (channels-scry nest) /perm/noun)
    =/  perms  .^(perm:d %gx path)
    =/  =c-channels:d  [%channel nest %del-writers writers.perms]
    =/  =wire  /channels/command
    =/  =dock  [our.bowl %channels-server]
    =/  =cage  channel-command+!>(c-channels)
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
  ::  v4 -> v5: leave all /epic subscriptions
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
  ::  v4 -> v5: initialize $group .active-channels
  ::
  =?  cor  ?=(%4 -.old)
    (emit [%pass /load/active-channels %arvo %b %wait now.bowl])
  =?  old  ?=(%4 -.old)  (state-4-to-5 old)
  =?  old  ?=(%5 -.old)  (state-5-to-6 old)
  =^  caz-6-to-7=(list card)  old
    ?.  ?=(%6 -.old)  [~ old]
    (state-6-to-7 old)
  =?  cor  !=(~ caz-6-to-7)  (emil caz-6-to-7)
  ?>  ?=(%7 -.old)
  =.  state  old
  inflate-io
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
        groups=net-groups:v0:gv
        xeno=gangs:v0:gv
        shoal=(map flag:g dude:gall)
    ==
  ::
  +$  state-1
    $:  %1
      groups=net-groups:v0:gv
      ::
        $=  volume
        $:  base=level:v
            area=(map flag:g level:v)  ::  override per group
            chan=(map nest:g level:v)  ::  override per channel
        ==
      ::
        xeno=gangs:v0:gv
        ::  graph -> agent
        shoal=(map flag:g dude:gall)
    ==
  ::
  +$  state-2
    $:  %2
        groups=net-groups:v2:gv
      ::
        $=  volume
        $:  base=level:v
            area=(map flag:g level:v)  ::  override per group
            chan=(map nest:g level:v)  ::  override per channel
        ==
      ::
        xeno=gangs:v2:gv
        ::  graph -> agent
        shoal=(map flag:g dude:gall)
    ==
  ::
  +$  state-3
    $:  %3
        groups=net-groups:v2:gv
        =volume:v
        xeno=gangs:v2:gv
        ::  graph -> agent
        shoal=(map flag:g dude:gall)
        =^subs:s
    ==
  ::
  +$  state-4
    $:  %4
        groups=net-groups:v2:gv
        =volume:v
        xeno=gangs:v2:gv
        ::  graph -> agent
        shoal=(map flag:g dude:gall)
        =^subs:s
        =pimp:imp
    ==
  ::
  +$  state-5
    $:  %5
        groups=net-groups:v5:gv
        =volume:v
        xeno=gangs:v5:gv
        ::  graph -> agent
        shoal=(map flag:g dude:gall)
        =^subs:s
        =pimp:imp
    ==
  ::
  +$  state-6
    $:  %6
        groups=net-groups:v5:gv
        =volume:v
        xeno=gangs:v6:gv
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
    [%2 (v2:groups:v0:gc groups) volume xeno shoal]
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
        (~(run by groups) v5:net-group:v2:gc)
        volume
        (~(run by xeno) v5:gang:v2:gc)
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
        (~(run by xeno) v6:gang:v5:gc)
        subs
        ~
    ==
  ::
  ++  state-6-to-7
    |=  state-6
    ^-  (quip card state-7)
    ::  clean up old /cast subscriptions
    ::
    =|  caz=(list card)
    =.  caz
      %+  roll  ~(tap by wex.bowl)
      |=  [[[=wire =dock] *] =_caz]
      ?.  ?=([%cast @ @ ~] wire)  caz
      :_  caz
      [%pass wire %agent dock %leave ~]
    ::  clean up old /contact subscription
    ::
    =.  caz
      %+  roll  ~(tap by wex.bowl)
      |=  [[[=wire =dock] *] =_caz]
      ?.  ?=([%contact ~] wire)  caz
      :_  caz
      [%pass wire %agent dock %leave ~]
    ::  schedule foreigns and admissions migration
    ::
    =.  caz
      :-  [%pass /load/v7/foreigns %arvo %b %wait now.bowl]
      :-  [%pass /load/v7/admissions %arvo %b %wait now.bowl]
      caz
    =/  channels-index=(map nest:g flag:g)
      %-  ~(gas by *(map nest:g flag:g))
      %-  zing
      %+  turn  ~(tap by groups)
      |=  [=flag:g [* =group:v6:gv]]
      ^-  (list [nest:g flag:g])
      (turn ~(tap in ~(key by channels.group)) (late flag))
    ::  clean up stray gangs caused by invite poke response
    ::  in old groups.
    ::
    =.  xeno
      %-  my
      %+  murn  ~(tap by xeno)
      |=  [=flag:g =gang:v6:gv]
      ^-  (unit (pair flag:g gang:v6:gv))
      ?~  group=(~(get by groups) flag)
        `[flag gang]
      ?:  ?=(%pub -<.u.group)  ~
      `[flag gang]
    :-  caz
    :*  %7
        (~(run by groups) v7:net-group:v5:gc)
        channels-index
        (~(run by xeno) v7:gang:v6:gc)
        subs
        ~  ::  pimp
    ==
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
    |=  [[=flag:g [=net:g *]] =_cor]
    ::  only resubscribe to remote groups
    ?:  ?=(%pub -.net)  cor
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
    =/  =preview-update:v7:gv  ~
    =.  cor
      (emit %give %fact ~ group-preview-3+!>(preview-update))
    (emit %give %kick ~ ~)
  ::
    [%server %groups %index ~]  server-watch-index
  ::
    ::
    ::  client paths
    ::
  ::
    [%v1 %groups ~]  ?>(from-self cor)
  ::
      [ver=?(%v0 %v1) %channels app=@ ship=@ name=@ rest=*]
    ?>  from-self
    =/  ship=@p  (slav %p ship.pole)
    =/  =nest:g  [app.pole ship name.pole]
    =/  =flag:g  (~(got by channels-index) nest)
    go-abet:(go-watch:(go-abed:go-core flag) ver.pole +.pole)
  ::
      ::  deprecated
      [%chan app=@ ship=@ name=@ rest=*]
    ?>  ?=(~ rest.pole)
    $(pole [%v0 %channels app ship name %preview rest]:pole)
  ::
    ::  deprecated
    [%groups %ui ~]  ?>(from-self cor)
  ::
      [%v1 %foreigns %index ship=@ ~]
    =+  ship=(slav %p ship.pole)
    fi-abet:(fi-watch-index:fi-core %v1 ship)
  ::
      [%v1 %foreigns ship=@ name=@ rest=*]
    =+  ship=(slav %p ship.pole)
    fi-abet:(fi-watch:(fi-abed:fi-core ship name.pole) %v1 rest.pole)
  ::
      ::  deprecated
      [%gangs ship=@ name=@ %preview ~]
    ?>  from-self
    $(pole /v1/foreigns/[ship.pole]/[name.pole]/preview)
  ::
      ::  deprecated
      [%gangs %index ship=@ ~]
    ?>  from-self
    $(pole /v1/foreigns/index/[ship.pole])
  ::
    ::  deprecated
    [%gangs %updates ~]  ?>(from-self cor)
  ::
    :: deprecated
    [%epic ~]  (give %fact ~ epic+!>(okay:g))
  ==
::  +server-watch-index: handle groups index watch request
::
++  server-watch-index
  ^+  cor
  =;  =cage
    =.  se-core  (emit %give %fact ~ cage)
    (emit %give %kick ~ ~)
  :-  %group-previews-1
  !>  ^-  previews:v7:gv
  %-  ~(gas by *previews:v7:gv)
  %+  murn  ~(tap by groups)
  |=  [=flag:g =net:g =group:g]
  ^-  (unit [flag:g preview:v7:gv])
  ?.  &(=(our.bowl p.flag) !?=(%secret privacy.admissions.group))
    ~
  =/  sc  (se-abed:se-core flag)
  ?:  (se-is-banned:sc src.bowl)  ~
  `[flag se-preview:sc]
::
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+    pole  [~ ~]
  ::
    ::
    ::  client paths
    ::
  ::
      ::  deprecated
      [%x %init %v1 ~]
    =/  net-groups-7=net-groups:v7:gv
      %-  ~(run by groups)
      |=  [=net:v7:gv =group:v7:gv]
      :-  net
      (drop-seats:group:v7:gc group our.bowl)
    =/  groups-light-ui-2
      %-  ~(urn by net-groups-7)
      |=  [=flag:g =net:v7:gv =group:v7:gv]
      =/  =status:neg
        (read-status:neg bowl [p.flag %groups])
      (group-ui:v2:group:v7:gc status net group)
    ::  we filter out foreigns which are %done,
    ::  since completed gangs are removed after
    ::  the group join in old groups.
    ::
    =/  gangs-2
      %-  ~(gas by *(map flag:g gang:v2:gv))
      %+  murn  ~(tap by foreigns)
      |=  [=flag:g =foreign:g]
      ?:  ?&  ?=(^ progress.foreign)
              ?=(%done u.progress.foreign)
          ==
        ~
      %-  some
      :-  flag
      (gang:v2:foreign:v7:gc foreign)
    ``noun+!>([groups-light-ui-2 gangs-2])
  ::
      [%x %v2 %init ~]
    =/  groups-light-ui-7=(map flag:v7:gv group-ui:v7:gv)
      %-  ~(urn by groups)
      |=  [=flag:g =net:v7:gv =group:v7:gv]
      =*  light-group  (drop-seats:group:v7:gc group our.bowl)
      =+  (group-ui:group:v7:gc net light-group)
      ::  recompute member count after dropping seats
      ::TODO is this correct in other scries?
      ::
      -(member-count ~(wyt by seats.group))
    ``noun+!>([groups-light-ui-7 `foreigns:v7:gv`foreigns])
  ::
       [%x ver=?(%v0 %v1 %v2) %groups ~]
    =/  groups-7=groups:v7:gv  (~(run by groups) tail)
    ?-    ver.pole
        %v0  ``groups+!>((~(run by groups-7) v2:group:v7:gc))
        %v1  ``groups-1+!>((~(run by groups-7) v5:group:v7:gc))
        %v2  ``groups-2+!>(groups-7)
    ==
  ::
      [%x ver=?(%v0 %v1 %v2) %light %groups ~]
    =/  groups-7=groups:v7:gv
      %-  ~(run by groups)
      |=  [=net:v7:gv =group:v7:gv]
      (drop-seats:group:v7:gc group our.bowl)
    ?-    ver.pole
        %v0  ``groups+!>((~(run by groups-7) v2:group:v7:gc))
        %v1  ``groups-1+!>((~(run by groups-7) v5:group:v7:gc))
        %v2  ``groups-2+!>(groups-7)
    ==
  ::
      [%x ver=?(%v0 %v1 %v2) %ui %groups ~]
    =/  net-groups-7=net-groups:v7:gv  groups
    ?-    ver.pole
        %v0
      =-  ``groups-ui+!>(-)
      %-  ~(urn by net-groups-7)
      |=  [=flag:g =net:v7:gv =group:v7:gv]
      =/  =status:neg
        (read-status:neg bowl [p.flag %groups])
      (group-ui:v2:group:v7:gc status net group)
    ::
      %v1  ``groups-ui-1+!>((~(run by net-groups-7) group-ui:v5:group:v7:gc))
      %v2  ``groups-ui-2+!>((~(run by net-groups-7) group-ui:group:v7:gc))
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
      ``group+!>((v2:group:v7:gc +.u.net-group))
    ::
        %v1
      ``group-1+!>((v5:group:v7:gc +.u.net-group))
    ::
        %v2
      ``group-2+!>(`group:v7:gv`+.u.net-group)
    ==
  ::
      [%x ver=?(%v0 %v1 %v2) %ui %groups ship=@ name=@ rest=*]
    =+  ship=(slav %p ship.pole)
    =/  =flag:g  [ship name.pole]
    =+  net-group=(~(get by groups) flag)
    ?~  net-group  [~ ~]
    ?.  ?=(~ rest.pole)
      ?:  ?=([%v1 ~] rest.pole)
        ::  deprecated
        $(pole [%x ver %ui %groups ship name ~]:pole)
      $(pole [%x ver %groups ship name rest]:pole)
    ?-    ver.pole
        %v0
      =/  =status:neg
        (read-status:neg bowl [p.flag %groups])
      ``group-ui+!>((group-ui:v2:group:v7:gc status u.net-group))
    ::
        %v1
      ``group-ui-1+!>((group-ui:v5:group:v7:gc u.net-group))
    ::
        %v2
      ``group-ui-2+!>((group-ui:group:v7:gc u.net-group))
    ==
  ::
      ::  deprecated
      [%x %groups ship=@ name=@ rest=*]
    $(pole [%x %v0 %ui %groups ship.pole name.pole rest.pole])
  ::
      [%u %groups ship=@ name=@ ~]
    =+  ship=(slav %p ship.pole)
    ``loob+!>((~(has by groups) [ship name.pole]))
  ::
      [%x ver=?(%v1) %foreigns ~]
    ``foreigns-1+!>(`foreigns:v7:gv`foreigns)
  ::
      [%x ver=?(%v1) %foreigns ship=@ name=@ ~]
    =+  ship=(slav %p ship.pole)
    =/  =flag:g  [ship name.pole]
    ?~  far=(~(get by foreigns) flag)  [~ ~]
    ``foreign-1+!>(`foreign:v7:gv`u.far)
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
      [%groups ~]  cor
      [%activity %submit *]  cor
  ::
      [%server %groups ship=@ name=@ rest=*]
    =+  ship=(slav %p ship.pole)
    se-abet:(se-agent:(se-abed:se-core ship name.pole) rest.pole sign)
  ::
      [%groups ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    ::  ignore responses after we have left the group
    ::
    ?:  ?&  !(~(has by groups) ship name.pole)
            ?|  ?=(%kick -.sign)
                ?=(%fact -.sign)
                ?=([%command %leave ~] rest.pole)
                ?=([%leave-channels ~] rest.pole)
            ==

        ==
      cor
    go-abet:(go-agent:(go-abed:go-core ship name.pole) rest.pole sign)
  ::
      [%foreigns %index ship=@ ~]
    =+  ship=(slav %p ship.pole)
    fi-abet:(fi-take-index:fi-core ship sign)
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
      [%chan app=@ ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    =/  =nest:g  [app.pole ship name.pole]
    ?~  flag=(~(get by channels-index) nest)
      ~|(channel-group-not-found+nest !!)
    =/  =path
      %+  weld
        /v0/groups/(scot %p p.u.flag)/[q.u.flag]
      `path`[%channels +.pole]
    $(pole path)
  ::
      [%channels ~]
    (take-channels sign)
  ::
    [%channels %command ~]  cor
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
      :: v4 -> v5
      :: initialize .active-channels in $group
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
  ::
      ::  v6 -> v7 migrate .foreigns
      [%load %v7 %foreigns ~]
    ::  refresh preview for each foreign group
    ::
    =.  cor
      %+  roll  ~(tap in ~(key by foreigns))
      |=  [=flag:g =_cor]
      =/  fc  (fi-abed:fi-core:cor flag)
      fi-abet:(fi-safe-preview:fc |)
    ::  for each group join in progress:
    ::  %ask: we have requested an entry, repeat the request.
    ::  %join: we have poked to join the group, repeat the request
    ::         if an invitation is present. otherwise set error.
    ::  %watch: we have issued a watch to the group. there should already
    ::          be a group entry. if there is, resubscribe. if there is
    ::          not, set error.
    ::  %done: do nothing.
    ::  %error: do nothing.
    ::
    %+  roll  ~(tap by foreigns)
    |=  [[=flag:g far=foreign:g] =_cor]
    ?~  progress.far  cor
    ?:  ?=(?(%done %error) u.progress.far)  cor
    =*  fc  (fi-abed:fi-core:cor flag)
    =.  cor  fi-abet:fi-cancel:fc
    =<  fi-abet
    ?-    u.progress.far
      %ask  (fi-ask:fc ~)
    ::
        %join
      ?~  invites.far  fi-error:fc
      (fi-join:fc token.i.invites.far)
    ::
        %watch
      ?.  (~(has by groups) flag)
        ::  group is not found
        fi-error:fc
      =.  cor
        go-abet:(go-safe-sub:(go-abed:go-core:cor flag) |)
      ::NB  cor has changed, we need to resolve +fi-core anew
      (fi-abed:fc flag)
    ==
  ::
      ::  v6 -> v7 migrate each .groups
      ::
      [%load %v7 %admissions ~]
    ::  host: send an invite to each ship on the pending list in
    ::  .admissions.$group.
    ::
    ::
    %+  roll  ~(tap by groups)
    |=  [[=flag:g [=net:g =group:g]] =_cor]
    ?.  ?=(%pub -.net)  cor
    =<  se-abet
    %-  se-compat-send-invites:(se-abed:se-core:cor flag)
    ~(key by pending.admissions.group)
  ::
      ::
      ::  v6 -> v7 migrate invitations
      ::
      ::  some ships might be behind at the time of migration.
      ::  we give them a chance to update and resend an invitation
      ::
      [%server host=@ name=@ %invite %retry ship=@ retry=@ delay=@ ~]
    =+  host=(slav %p host.pole)
    =+  name=name.pole
    =/  =flag:g  [host name]
    ?.  (~(has by groups) flag)  cor
    =/  ship=@p    (slav %p ship.pole)
    =/  retry=@ud  (slav %ud retry.pole)
    =/  delay=@dr  (slav %dr delay.pole)
    ?:  =(0 retry)  cor
    ?:  (can-poke:neg bowl ship %groups)
      =<  se-abet
      (se-send-invites:(se-abed:se-core flag) (sy ship ~))
    =.  retry  (dec retry)
    =.  delay  (mul 2 delay)
    =/  =wire  ^~
      %+  weld  /server/(scot %p our.bowl)/[q.flag]
      /invite/retry/(scot %p ship)/(scot %ud retry)/(scot %dr delay)
    (emit [%pass wire %arvo %b %wait (add now.bowl delay)])
  ==
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
    ?.  =(%channel-response-2 p.cage.sign)  cor
    =+  !<(=r-channels:v7:old:d q.cage.sign)
    =*  rc  r-channel.r-channels
    ?+    -.rc  cor
        %create
      =*  flag  group.perm.rc
      ?.  (~(has by groups) flag)  cor
      =+  group=(~(got by groups) flag)
      %_  cor  groups
        %+  ~(put by groups)  flag
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
        %leave
      ?~  flag=(~(get by channels-index) nest.r-channels)
        cor
      =+  net-group=(~(get by groups) u.flag)
      ?~  net-group  cor
      =*  group  u.net-group
      ?>  (~(has by channels.group) nest.r-channels)
      =.  groups
        %+  ~(put by groups)  u.flag
        %_  group  active-channels
          (~(del in active-channels.group) nest.r-channels)
        ==
      cor
    ==
  ==
::
++  watch-contacts
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
    =+  !<(=response:t q.cage.sign)
    ?.  ?=(%peer -.response)  cor
    =/  groups=(unit (set $>(%flag value:t)))
      (~(ges cy:t con.response) groups+%flag)
    ?:  |(?=(~ groups) =(~ u.groups))  cor  ::TMI
    %+  roll  ~(tap in u.groups)
    |=  [val=$>(%flag value:t) =_cor]
    fi-abet:(fi-watch:(fi-abed:fi-core:cor p.val) %v1 /preview)
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
    =*  sub-len  ^~((lent se-sub-path))
    ?.  =((scag sub-len path) se-sub-path)  |
    =/  rest=^path  (slag sub-len path)
    ?.  ?=([ship=@ time=@ ~] rest)  |
    =/  ship  (slav %p i.rest)
    ::XX cache this with ~+?
    (se-is-admin ship)
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
    ::  update subscribers: either everyone
    ::  or admins only.
    ::
    =/  paths
      ?:  (se-is-admin-update u-group.update)
        se-admin-subscription-paths
      se-subscription-paths
    ?:  =(~ paths)  se-core
    (give %fact paths group-update+!>(update))
  ::  +se-c-create: create a group
  ::
  ++  se-c-create
    |=  [=flag:g create=create-group:g]
    ?>  from-self
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
      %+  murn  (sort ~(tap by channels.group) aor)
      |=  [=nest:g =channel:g]
      ^-  (unit nest:g)
      ?.  =(section.channel %default)
        ~
      `nest
    =.  section-order.group  (~(push of section-order.group) %default)
    ::  populate group members and their roles
    ::
    ::  TODO  this should use +se-c-seat to create new seats
    ::        so that any new logic implemented there is also
    ::        executed at the group creation. likewise, to populate the roles
    ::        we should use +se-c-role.
    ::
    =.  group
      %+  roll  ~(tap by members.create)
      |=  [[=ship roles=(set role-id:g)] =_group]
      =/  =seat:g  (~(gut by seats.group) ship *seat:g)
      =.  joined.seat  now.bowl
      =.  roles.seat  roles
      =.  seats.group  (~(put by seats.group) ship seat)
      =.  roles.group
        %-  ~(gas by roles.group)
        %+  turn  ~(tap in roles)
        |=  =role-id:g
        [role-id *role:g]
      group
    ::  populate the admin seat. nb this must follow group memember
    ::  seats population above, otherwise the group host might lose the
    ::  admin role.
    ::
    =/  =seat:g  (~(gut by seats.group) our.bowl *seat:g)
    =.  roles.seat  (~(put in roles.seat) %admin)
    =.  seats.group  (~(put by seats.group) our.bowl seat)
    ::
    =.  groups  (~(put by groups) flag [%pub *log:g] group)
    =+  se-core=(se-abed flag)
    =.  se-core  (se-update:se-core [%create group])
    (se-send-invites:se-core ~(key by members.create))
  ::  +se-c-delete: delete the group
  ::
  ++  se-c-delete
    ^+  se-core
    =.  channels-index
      %+  roll  ~(tap in ~(key by channels.group))
      |=  [=nest:g =_channels-index]
      (~(del by channels-index) nest)
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
    ::XX  se-is-banned should be at top level.
    ?<  (se-is-banned src.bowl)
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
    ?<  ?=(%secret privacy.ad)
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
  ::  a client is considered registered by the group host
  ::  in the following cases:
  ::  (1) he has already joined group,
  ::  (2) he is in the process of joining the group and has registered a seat,
  ::  (3) he has a record in the requests set.
  ::  (4) he has a record in the pending set.
  ::
  ::  if the client then wishes to forfeit that registration,
  ::  he can issue a group leave request. the group host then:
  ::  1. removes all channels hosted by the client and subsequently
  ::     deletes the client's seat and kicks any outstanding group subscriptions.
  ::     the host also cleans up the pending and request records.
  ::     (this is handled in +se-c-seat.)
  ::  2. deletes the client's ask request and kicks
  ::     any outstanding ask subscriptions.
  ::  3. delete the client's pending record.
  ::
  ++  se-c-leave
    ^+  se-core
    ?<  (se-is-banned src.bowl)
    ::  delete the seat of the leaving member, unless he is the host
    ::
    ?:  &((~(has by seats.group) src.bowl) !=(p.flag src.bowl))
      =.  se-core
        %+  roll  ~(tap by channels.group)
        |=  [[=nest:g *] =_se-core]
        ?.  =(p.q.nest src.bowl)  se-core
        (se-c-channel:se-core nest %del ~)
      (se-c-seat (sy src.bowl ~) [%del ~])
    =?  se-core  (~(has by pending.ad) src.bowl)
      =.  pending.ad  (~(del by pending.ad) src.bowl)
      (se-update %entry %pending %del (sy src.bowl ~))
    =?  se-core  (~(has by requests.ad) src.bowl)
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
    ?:  =(p.flag ship)  [& ad]
    ?:  (se-is-banned ship)  deny
    ?:  &(=(~ tok) ?=(%public privacy.ad))
      [& ad]
    ::XX  this is a special case to enable robust v6 -> v7 migration
    ::    of private group invitations. the shut cordon pending set
    ::    is migrated, but at the time of migration of the group host
    ::    the recipient might not have updated yet, thus the newly minted
    ::    invitation is going to be lost. the recipient will
    ::    subsequently attempt to join the group with an empty token, which we allow
    ::    here, but only if the user is in the pending set. once the migration
    ::    sets in the network this should be removed.
    ::
    ?:  &(=(~ tok) (~(has by pending.ad) ship))
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
    =*  se-src-is-admin   (se-is-admin src.bowl)
    =*  se-src-is-member  (se-is-member src.bowl)
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
      ?>  se-src-is-member
      (se-c-flag-content [nest plan src]:c-group)
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
      %token    +:(se-c-entry-token c-token.c-entry)
      %pending  (se-c-entry-pending [ships c-pending]:c-entry)
      %ask      (se-c-entry-ask [ships c-ask]:c-entry)
    ==
  ::  +se-c-entry-privacy: execute a privacy command
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
  ::  for an admin to execute a $c-ban command that affects
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
      =.  se-core  se-enforce-banned
      (se-update [%entry %ban %set [ships ranks]:c-ban])
    ::
        %add-ships
      =.  ships.banned
        (~(uni in ships.banned) ships.c-ban)
      =.  se-core  se-enforce-banned
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
      =.  se-core  se-enforce-banned
      (se-update [%entry %ban %add-ranks ranks.c-ban])
    ::
        %del-ranks
      =.  ranks.banned
        (~(dif in ranks.banned) ranks.c-ban)
      (se-update [%entry %ban %del-ranks ranks.c-ban])
    ==
  ::  +se-enforce-banned: enforce bans in group seats and requests
  ::
  ++  se-enforce-banned
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
    ::TODO purge banned ships from the pending set
    ::
    se-core
  ::  +se-c-entry-token: execute an entry token command
  ::
  ++  se-c-entry-token
    |=  =c-token:g
    ^-  [(unit token:g) _se-core]
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
      ::TODO if a token we had used for inviting someone to the group
      ::     has been revoked, we should signal to the invitee.
      ::
      ?>  (~(has by tokens.ad) token.c-token)
      =.  tokens.ad
        (~(del by tokens.ad) token.c-token)
      :-  ~
      (se-update [%entry %token %del token.c-token])
    ==
  ::  +se-c-entry-pending: add or delete ships from the pending set
  ::
  ::  a ship can be granted entry to the group by virtue of its record
  ::  in the pending ships set. the pending set allows for pre-assigning
  ::  member roles that are assigned when the ship joins the group.
  ::
  ::  currently, if a ship is in the pending set, it is granted entry with an
  ::  empty token - see the logic and comment in +se-admit. this is to
  ::  enable better compatibility with old groups.
  ::
  ::  if a ship is added to the pending list but is already recorded
  ::  in the requests list, her request is first approved. nonetheless,
  ::  we still send an invitation to be robust against requesters losing
  ::  the ask subscription. TODO is that even possible?
  ::
  ::  a ship that is banned can not be added to the pending list.
  ::
  ++  se-c-entry-pending
    |=  [ships=(set ship) =c-pending:g]
    ^+  se-core
    ?<  ?&  ?=(%add -.c-pending)
            (~(any in ships) se-is-banned)
        ==
    ?-    -.c-pending
        %add
      =.  ad
        %+  roll  ~(tap in ships)
        |=  [=ship =_ad]
        =/  roles=(set role-id:g)
          (~(gut by pending.ad) ship *(set role-id:g))
        =.  pending.ad
          (~(put by pending.ad) ship (~(uni in roles) roles.c-pending))
        ad
      ::  approve outstanding ask requests for pending ships
      =.  se-core  (se-c-entry-ask ships %approve)
      =.  se-core  (se-send-invites ships)
      (se-update [%entry %pending %add ships roles.c-pending])
    ::
        %edit
      =.  pending.ad
        %+  roll  ~(tap in ships)
        |=  [=ship =_pending.ad]
        =/  roles=(unit (set role-id:g))
          (~(get by pending) ship)
        ?~  roles  pending
        (~(put by pending) ship roles.c-pending)
      (se-update [%entry %pending %add ships roles.c-pending])
    ::
        %del
      =.  pending.ad
        %+  roll  ~(tap in ships)
        |=  [=ship =_pending.ad]
        (~(del by pending) ship)
      (se-update [%entry %pending %del ships])
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
        =.  requests.admissions.group.se-core
          (~(del by requests.admissions.group.se-core) ship)
        =^  tok=(unit token:g)  se-core
          (se-c-entry-token:se-core %add [personal+ship ~ ~ |])
        =/  =cage  group-token+!>(tok)
        =/  =path  (weld se-area /ask/(scot %p ship))
        =.  se-core
          (give:se-core %fact ~[path] cage)
        (give:se-core %kick ~[path] ~)
      (se-update [%entry %ask %del reqs])
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
      (se-update [%entry %ask %del reqs])
    ==
  ::  +se-c-seat: execute a seat command
  ::
  ::  seats are used to manage group membership.
  ::  seats can be created in two ways: when a user joins
  ::  the group or when group members are manually added
  ::  by a group admin.
  ::
  ::  the case of a user join can be detected by verifying
  ::  that the ship set contains only the ship originating
  ::  the request. the joined time for a user join is .now.bowl.
  ::
  ::  group seats can also be added manually by a group admin. this
  ::  is indended only as an escape hatch - pre-populating group
  ::  members should be done using the %pending variant of $c-entry.
  ::
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
        ::  create a seat for each ship.
        ::
        ::  we first delete the ship from requests.
        ::  next, we check whether the ship has pre-assigned
        ::  roles in .pending.ad, use those, and remove the ship
        ::  from the pending set. finally, a new seat is created.
        ::  the roles set of the seat is a union of existing and
        ::  pre-assigned roles.
        ::
        %+  roll  ~(tap in ships)
        |=  [=ship =_se-core]
        =*  ad  admissions.group.se-core
        ::TODO kick from /ask sub
        =.  requests.ad
          (~(del by requests.ad) ship)
        =/  roles  (~(get by pending.ad) ship)
        =?  pending.ad  ?=(^ roles)
          (~(del by pending.ad) ship)
        =+  seat=(~(got by seats.group.se-core) ship)
        =?  roles.seat  ?=(^ roles)
          (~(uni in roles.seat) u.roles)
        (se-update:se-core %seat (sy ship ~) [%add seat])
      ::  send invites to manually added ships
      ::
      =?  se-core  !user-join  (se-send-invites ships)
      se-core
    ::
        %del
      ~|  %se-c-seat-delete-channel-host
      ?<  ?|  (~(has in ships) our.bowl)
              !=(~ (~(int in ships) se-channel-hosts))
          ==
      ::  clean up ask and pending record
      ::
      =.  pending.ad   (~(del by pending.ad) ship)
      ::TODO kick from /ask  sub
      =.  requests.ad  (~(del by requests.ad) ship)
      ::TODO if any of the ships was pending and invited,
      ::     cancel their tokens.
      ::
      =.  seats.group
        %-  ~(rep in ships)
        |=  [=ship =_seats.group]
        (~(del by seats) ship)
      ::  kick out deleted members from /updates subscription
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
    |=  ships=(set ship)
    ^+  se-core
    ::TODO record each invited ship in .invited.ad?
    %+  roll  ~(tap in ships)
    |=  [=ship =_se-core]
    =*  her  +<-
    =*  acc  +<+
    =,  se-core
    =/  =wire  (weld se-area /invite/(scot %p her))
    =^  tok=(unit token:g)  acc
      ?:  ?=(%public privacy.ad)
        [~ acc]
      (se-c-entry-token [%add personal+her ~ ~ |])
    =/  =invite:g
        :*  flag
            now.bowl
            our.bowl
            tok
            ~  ::  note
            se-preview
        ==
    =/  =a-foreigns:v7:gv
      [%invite invite]
    =/  cage  group-foreign-1+!>(a-foreigns)
    (emit [%pass wire %agent [her dap.bowl] %poke cage])
  ::  +se-compat-send-invites: send invites in compatible manner
  ::
  ::  if a ship is in sync, we send the invitation as usual.
  ::  if a ship is behind, we schedule a retry with a number
  ::  of trials and increasing delay time.
  ::
  ++  se-compat-send-invites
    |=  ships=(set ship)
    =^  ivl=(list ship)  se-core
      %+  roll  ~(tap in ships)
      |=  [=ship ivl=(list ship) =_se-core]
      ?.  (can-poke:neg bowl ship %groups)
        ::  retry .retry times with doubling .delay
        ::
        =+  delay=~h1
        =+  retry=8
        =/  =wire  ^~
          %+  weld  /server/(scot %p our.bowl)/[q.flag]
          /invite/retry/(scot %p ship)/(scot %ud retry)/(scot %dr delay)
        :-  ivl
        (emit [%pass wire %arvo %b %wait (add now.bowl delay)])
      :-  [ship ivl]
      se-core
    ?:  =(~ ivl)  se-core
    (se-send-invites (sy ivl))
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
          [%channel nest %del-writers (sects:v2:roles:v7:gc roles)]
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
    ::TODO the client should stop trying to add duplicate channels.
    ::     this should be an assertion, but is currently triggered on
    ::     wayfinding group creation.
    ::
    ?:  &(?=(%add -.c-channel) (has:by-ch nest))  se-core
    ?-    -.c-channel
        %add
      =.  added.chan  now.bowl
      =.  sections.group  (se-section-add-channel nest chan)
      =.  channels.group  (put:by-ch nest chan)
      =.  channels-index
        (~(put by channels-index) nest flag)
      (se-update %channel nest [%add chan])
    ::
        %edit
      =/  old=channel:g  (got:by-ch nest)
      ::  preserve original timestamp
      =.  added.chan  added.old
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
      =.  channels-index
        (~(del by channels-index) nest)
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
      =.  sections.group
        %+  ~(jab by sections.group)  section.channel
        |=(=section:g section(order (~(del of order.section) nest)))
      =.  section.channel   section-id.c-channel
      =.  channels.group  (put:by-ch nest channel)
      =.  sections.group
        %+  ~(jab by sections.group)  section.channel
        |=(=section:g section(order (~(push of order.section) nest)))
      (se-update %channel nest [%section section-id.c-channel])
    ::
        %join
      =.  channels.group
        %+  ~(jab by channels.group)  nest
        |=  =channel:g
        channel(join join.c-channel)
      (se-update %channel nest [%join join.c-channel])
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
      (se-update %section section-id [%move-nest [nest idx]:c-section])
    ==
  ++  se-c-flag-content
    |=  [=nest:g =plan:g src=ship]
    ^+  se-core
    =/  posts
      (~(gut by flagged-content.group) nest *(jug plan:g ship))
    =/  channel-flagged
      (~(put ju posts) plan src)
    =.  flagged-content.group
      (~(put by flagged-content.group) nest channel-flagged)
    (se-update %flag-content nest plan src)
  ::
  ++  se-watch
    |=  =path
    ^+  se-core
    ?<  (se-is-banned src.bowl)
    ?+    path  ~|(se-watch-bad+path !!)
        ::  receive updates since .after time
        ::
        [%updates ship=@ after=@ ~]
      =/  ship   (slav %p i.t.path)
      =/  after  (slav %da i.t.t.path)
      ?>  =(ship src.bowl)
      ?>  (se-is-member src.bowl)
      (se-watch-updates ship after)
    ::
      ::  fetch group preview
      ::
      [%preview rest=*]  (se-watch-preview t.path)
    ::
        ::  request token for a ship
        ::
        [%token ship=@ ~]
      =+  ship=(slav %p i.t.path)
      ?>  (se-is-admin src.bowl)
      (se-watch-token ship)
    ::
        ::  ask for access token
        ::
        [%ask ship=@ ~]
      =+  ship=(slav %p i.t.path)
      ?>  =(ship src.bowl)
      (se-watch-ask ship)
    ==
  ::
  ++  se-watch-updates
    |=  [=ship =@da]
    ^+  se-core
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
  ::  +se-is-admin-u-group: check if group update is restricted
  ::
  ++  se-is-admin-update
    |=  =u-group:g
    ?+  u-group  |
      [%entry %token *]    &
      [%entry %pending *]  &
      [%entry %ask *]      &
    ==
  ::
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
      (give %fact ~ group-preview-3+!>(`preview-update:v7:gv`preview-update))
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
      %-  %+  ~(tell l ~)  %crit
          [leaf+"failed to invite ship {<ship>}" u.p.sign]
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
        ?:  go-our-host  groups
        (~(del by groups) flag)
      (~(put by groups) flag net group)
    ?.  gone  cor
    =.  go-core  (go-response [%delete ~])
    (emil leave-subs:go-pass)
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
        %role  [%group-role ^flag ship (~(run in roles) |=(=role-id:g `sect:v0:gv`role-id))]
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
      ::TODO use versioned channel api
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
      ::TODO use version channels types
      =/  action=a-channels:d  [%channel nes %join flag]
      =/  =cage  channel-action-1+!>(action)
      =/  =wire  (snoc go-area %join-channels)
      `[%pass wire %agent dock %poke cage]
    ::
    ++  preview-channel
      |=  =nest:g
      ^-  (list card)
      =*  ship  p.q.nest
      =/  =wire
        %+  weld  go-area
        /channels/[p.nest]/(scot %p ship)/[q.q.nest]/preview
      =/  =dock  [ship %groups]
      =/  =path
        /v1/channels/[p.nest]/(scot %p ship)/[q.q.nest]/preview
      :~  [%pass wire %agent dock %leave ~]
          [%pass wire %agent dock %watch path]
      ==
    ::
    ++  go-wake-members
      ^-  (list card)
      %+  turn
        ~(tap in (~(del in ~(key by seats.group)) our.bowl))
      |=  who=ship
      ^-  card
      =/  =wire  (snoc go-area %wake)
      =/  =cage  noun+!>([%group-wake flag])
      [%pass wire %agent [who dap.bowl] %poke cage]
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
    =+  log=~(. l `'group-join')
    ?:  go-has-sub  go-core
    %-  (tell:log %dbug leaf+"+go-safe-sub subscribing to {<flag>}" ~)
    (go-start-updates delay)
  ::  +go-start-updates: subscribe to the group for updates
  ::
  ++  go-start-updates
    |=  delay=?
    ^+  go-core
    =/  sub-time=@da
      ?:  ?=(%pub -.net)  *@da
      time.net
    =.  cor
      %.  delay
      %^  safe-watch  go-sub-wire  [p.flag server]
      (weld go-server-path /updates/(scot %p our.bowl)/(scot %da sub-time))
    go-core
  ::  +go-leave: leave the group and all channel subscriptions
  ::
  ++  go-leave
    |=  send-leave=?
    ^+  go-core
    ?>  from-self
    =.  cor
      (submit-activity [%del %group flag])
    ::NOTE  we leave all channels, not just those that
    ::      are joined, as this is robust to bugs
    ::      in active channels tracking.
    ::
    =/  channels  ~(tap in ~(key by channels.group))
    =.  cor  (emil (leave-channels:go-pass channels))
    =?  cor  send-leave  (emit leave-group:go-pass)
    go-core(gone &)
  ::  +go-preview: generate the preview of the group
  ::
  ++  go-preview
    ^-  preview:v7:gv
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
    ?>  from-self
    ?:  =(ship.a-invite src.bowl)  go-core
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
    =/  =invite:v7:gv
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
        group-foreign-1+!>(`a-foreigns:v7:gv`[%invite invite])
      %^  emit  %pass  wire
      [%agent [ship.a-invite dap.bowl] %poke cage]
    go-core

  ::  +go-a-group: execute group action
  ::
  ++  go-a-group
    |=  =a-group:g
    ^+  go-core
    ?>  from-self
    (go-send-command /command/[-.a-group] `c-group:g`a-group)
  ::  +go-send-command:  send command to the group host
  ::
  ++  go-send-command
    |=  [=wire =c-group:g]
    ^+  go-core
    ?>  from-self
    =/  =^wire  (weld go-area wire)
    =/  =cage  group-command+!>(`c-groups:g`[%group flag c-group])
    =.  cor  (emit %pass wire %agent [p.flag server] %poke cage)
    go-core
  ::  +go-watch: handle group watch request
  ::
  ++  go-watch
    |=  [ver=?(%v0 %v1) =(pole knot)]
    ^+  go-core
    ?<  (go-is-banned src.bowl)
    ?+    pole  ~|(go-bad-watch+pole !!)
        [%channels app=@ ship=@ name=@ %preview ~]
      =+  ship=(slav %p ship.pole)
      =/  =nest:g  [app.pole ship name.pole]
      ?.  =(ship.pole our.bowl)
        ::  proxy the request to the channel host
        =.  cor  (emil (preview-channel:go-pass nest))
        go-core
      =+  chan=(~(get by channels.group) nest)
      ?~  chan  ~|(go-watch-bad-channel-preview+nest !!)
      ::TODO verify this: if a ship has permissions to read
      ::     a channel, this implies she can also preview a (secret) group.
      ::
      ?>  (go-can-read src.bowl u.chan)
      =/  =channel-preview:v7:gv
        :*  nest
            meta.u.chan
            go-preview
        ==
      (go-give-channel-preview channel-preview &)
    ==
  ::  +go-give-channel-preview: give channel preview to subscribers
  ::
  ++  go-give-channel-preview
    |=  [=channel-preview:g watch=?]
    ^+  go-core
    =*  nest  nest.channel-preview
    ::  v0
    ::
    =/  preview-2
      (v2:channel-preview:v7:gc channel-preview)
    =/  path-0=path  ?:  watch  ~
      /chan/[p.nest]/(scot %p p.q.nest)/[q.q.nest]
    =.  cor  (emit %give %fact ~[path-0] channel-preview+!>(preview-2))
    =?  cor  watch  (emit %give %kick ~[path-0] ~)
    ::  v1
    ::
    =/  preview-7=channel-preview:v7:gv  channel-preview
    =/  path-1=path  ?:  watch  ~
      /v1/channels/[p.nest]/(scot %p p.q.nest)/[q.q.nest]/preview
    =.  cor  (emit %give %fact ~[path-1] channel-preview-1+!>(preview-7))
    =?  cor  watch  (emit %give %kick ~[path-1] ~)
    go-core
  ++  go-agent
    |=  [=wire =sign:agent:gall]
    ^+  go-core
    ?+    wire  ~|(go-agent-bad+wire !!)
        ::  waked up subscribers after an import
        ::
        [%wake ~]
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  go-core
      %-  (fail:l %poke-ack 'failed subscriber wake' u.p.sign)
      go-core
    ::
      [%updates ~]  (go-take-update sign)
    ::
        ::  poked group host with a command
        ::
        [%command cmd=@t ~]
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  go-core
      %-  (fail:l %poke-ack leaf+"group command {<cmd.i.t.wire>} failed" u.p.sign)
      go-core
    ::
        ::  invited a ship to the group
        ::
        [%invite ship=@ ~]
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  go-core
      %-  (fail:l %poke-ack 'failed to invite a ship' u.p.sign)
      go-core
    ::
        ::  requested a personal invite token for a ship
        ::
        [%invite ship=@ %token ~]
      ~|  go-agent-bad-invite+-.sign
      ?+    -.sign  !!
        %kick       go-core  ::  single-shot watch
      ::
          %watch-ack
        ?~  p.sign  go-core
        %-  (fail:l %watch-ack 'failed invite token request' u.p.sign)
        go-core
      ::
          %fact
        =*  cage  cage.sign
        ?>  ?=(%group-token p.cage)
        =+  !<(tok=(unit token:g) q.cage)
        =+  ship=(slav %p i.t.wire)
        (go-a-invite ship tok ~)
      ==
    ::
        ::  joined or left channels
        ::
        [?(%join-channels %leave-channels) ~]
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  go-core
      ?-    i.wire
        ::
            %join-channels
          %-  (fail:l %poke-ack 'failed to join channels' u.p.sign)
          go-core
        ::
            %leave-channels
          %-  (fail:l %poke-ack 'failed to leave channels' u.p.sign)
          go-core
      ==
    ::
        ::  requested a channel preview
        [%channels app=@ ship=@ name=@ %preview ~]
      ?+    -.sign  ~|(go-agent-bad-channels+-.sign !!)
          %kick
        =+  ship=(slav %p i.t.t.wire)
        =/  =nest:g  [i.t i.t.t i.t.t.t]:wire
        =/  path-0=path
          /chan/[p.nest]/(scot %p p.q.nest)/[q.q.nest]
        =/  path-1=path
          /v1/channels/[p.nest]/(scot %p p.q.nest)/[q.q.nest]/preview
        =.  cor  (emit %give %kick ~[path-0 path-1] ~)
        go-core
      ::
          %watch-ack
        ?~  p.sign  go-core
        %-  (fail:l %watch-ack 'failed channel preview request' u.p.sign)
        go-core
      ::
          %fact
        =+  !<(=channel-preview:v7:gv q.cage.sign)
        (go-give-channel-preview channel-preview |)
      ==
    ==
  ::
  ++  go-take-update
    |=  =sign:agent:gall
    ^+  go-core
    ?+   -.sign  ~|(go-take-update-bad+-.sign !!)
      %kick  (go-safe-sub &)
    ::
        %watch-ack
      =+  log=~(. l `'group-join')
      =?  cor  (~(has by foreigns) flag)
        fi-abet:(fi-watched:(fi-abed:fi-core flag) p.sign)
      ?^  p.sign
        %-  (fail:log %watch-ack 'group watch failed' u.p.sign)
        ?:  (~(has by foreigns) flag)
          ::  join in progress, leave the group to allow re-joining
          (go-leave &)
        ::TODO we should probably try resubscribing with a delay
        go-core
      go-core
    ::
        %fact
      =*  cage  cage.sign
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
    =.  go-core
      %+  roll  (tap:log-on:g log)
      |=  [=update:g =_go-core]
      (go-u-group:go-core update)
    =?  net  ?=(%sub -.net)
      [%sub time.net &]
    ::  join the channels upon initial group log
    ::
    =/  readable-channels
      %-  ~(gas in *(set nest:g))
      %+  murn  ~(tap in channels.group)
      |=  [=nest:g =channel:g]
      ?.  (go-can-read our.bowl channel)  ~
      `nest
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
      [%sub time.update init.net]
    =*  u-group  u-group.update
    ?-  -.u-group
      %create        (go-u-create group.u-group)
      %meta          (go-u-meta data.u-group)
      %entry         (go-u-entry u-entry.u-group)
      %seat          (go-u-seat [ships u-seat]:u-group)
      %role          (go-u-role [roles u-role]:u-group)
      %channel       (go-u-channel [nest u-channel]:u-group)
      %section       (go-u-section [section-id u-section]:u-group)
      %flag-content  (go-u-flag-content [nest plan src]:u-group)
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
      %pending  (go-u-entry-pending u-pending.u-entry)
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
  ::  +go-u-entry-pending: apply entry pending update
  ::
  ++  go-u-entry-pending
    |=  =u-pending:g
    ^+  go-core
    =.  go-core  (go-response [%entry %pending u-pending])
    ?:  go-our-host  go-core
    ?-    -.u-pending
        %add
      =.  pending.ad
        %+  roll  ~(tap in ships.u-pending)
        |=  [=ship =_pending.ad]
        =/  roles=(set role-id:g)
          (~(gut by pending) ship *(set role-id:g))
        (~(put by pending) ship (~(uni in roles) roles.u-pending))
      go-core
    ::
        %edit
      =.  pending.ad
        %+  roll  ~(tap in ships.u-pending)
        |=  [=ship =_pending.ad]
        =/  roles=(unit (set role-id:g))
          (~(get by pending) ship)
        ::TODO consider crashing?
        ?~  roles  pending
        (~(put by pending) ship roles.u-pending)
      go-core
    ::
        %del
      =.  pending.ad
        %+  roll  ~(tap in ships.u-pending)
        |=  [=ship =_pending.ad]
        (~(del by pending) ship)
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
  ::  +go-u-seat: apply seat update
  ::
  ++  go-u-seat
    |=  [ships=(set ship) =u-seat:g]
    ^+  go-core
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
      ::  leave the group if our seat has been deleted, but
      ::  only if the group has been already initialized.
      ::  otherwise any past kicks stored in the group log
      ::  would kick us out on a subsequent rejoin.
      ::
      =/  init=?  ?:(?=(%sub -.net) init.net &)
      =?  go-core  &(leave init)  (go-leave |)
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
        =/  =c-channels:d
          [%channel nest %del-writers (sects:v2:roles:v7:gc roles)]
        =/  cage  channel-command+!>(c-channels)
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
      =.  cor  (emil (join-channels:go-pass nest ~))
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
      ::TODO should we leave the channel here to match logic in %add
      ::     above?
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
    ::
        %join
      =.  go-core  (go-response %channel nest [%join join.u-channel])
      ?:  go-our-host  go-core
      =.  channels.group
        %+  ~(jab by channels.group)  nest
        |=  =channel:g
        channel(join join.u-channel)
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
        (go-response %section section-id [%move-nest [nest idx]:u-section])
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
    |=  [=nest:g =plan:g src=ship]
    ^+  go-core
    =.  go-core  (go-response %flag-content nest plan src)
    ?:  go-our-host  go-core
    ::
    =/  posts
      (~(gut by flagged-content.group) nest *(jug plan:g ship))
    =/  channel-flagged
      (~(put ju posts) plan src)
    =.  flagged-content.group
      (~(put by flagged-content.group) nest channel-flagged)
    ::  only notify about flagged contant if it has been reported
    ::  by someone else and we are an admin
    ::
    ?.  &(!from-self (go-is-admin our.bowl))  go-core
    =/  new-message-id  [src p.plan]
    =/  kind-from-nest=kind:d
      ?:  =(p.nest %chat)  %chat
      ?:  =(p.nest %heap)  %heap
      ?:  =(p.nest %diary)  %diary
      ~|  "Invalid nest kind"  !!
    =/  converted-nest=nest:d  [kind-from-nest p.q.nest q.q.nest]
    =.  go-core
       ?~  q.plan
          %+  go-activity  %flag-post
          :*  [new-message-id p.plan]
              converted-nest
              flag
          ==
        =/  new-reply-message-id=message-id:activity  [src u.q.plan]
        %+  go-activity  %flag-reply
        :*  [new-reply-message-id u.q.plan]
            [new-message-id p.plan]
            converted-nest
            flag
        ==
    go-core
  ::  +go-response: send response to our subscribers
  ::
  ++  go-response
    |=  =r-group:g
    ^+  go-core
    ::  v1 response
    ::
    =/  r-groups-7=r-groups:v7:gv  [flag r-group]
    =/  v1-paths  ~[/v1/groups [%v1 go-area]]
    =.  cor  (give %fact v1-paths group-response-1+!>(r-groups-7))
    ::  v0 backcompat
    ::
    =/  diffs-2=(list diff:v2:gv)
      (diff:v2:r-group:v7:gc r-group [seats admissions]:group)
    =.  cor
      %+  roll  diffs-2
      |=  [=diff:v2:gv =_cor]
      =/  action-2=action:v2:gv  [flag now.bowl diff]
      (give:cor %fact ~[/groups/ui] group-action-3+!>(action-2))
    go-core
  ::  +go-peek: handle group scry request
  ::
  ++  go-peek
    |=  [ver=?(%v0 %v1 %v2) =(pole knot)]
    ^-  (unit (unit cage))
    ::TODO some of these should be versioned, at least
    ::     those used by the client.
    ::
    ?+    pole  ~|(go-peek-bad+pole !!)
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
      ?~  seat=(~(get by seats.group) ship)  [~ ~]
      ``noun+!>(u.seat)
    ::
        [%seats ship=@ %is-admin ~]
      =+  ship=(slav %p ship.pole)
      ``loob+!>((go-is-admin ship))
    ::
        [%seats ship=@ %is-banned ~]
      =+  ship=(slav %p ship.pole)
      ``loob+!>((go-is-banned ship))
    ::
      ::
      ::  channels queries
      ::
        [%channels app=@ ship=@ name=@ rest=*]
      =/  =nest:g  [app.pole (slav %p ship.pole) name.pole]
      ?+    rest.pole  [~ ~]
          [%can-read ship=@ ~]
        ?~  channel=(~(get by channels.group) nest)
          ``loob+!>(|)
        =+  ship=(slav %p ship.rest.pole)
        ``loob+!>((go-can-read ship u.channel))
        ::
          [%can-write ship=@ ~]
        =+  ship=(slav %p ship.rest.pole)
        ^-  (unit (unit cage))
        ?~  seat=(~(get by seats.group) ship)  [~ ~]
        ?:  (go-is-banned ship)  [~ ~]
        =-  ``noun+!>(-)
        %-  some
        :-  admin=(go-is-admin ship)
        roles=roles.u.seat
      ==
    ::
        [%channels %can-read ~]
      =-  ``noun+!>(-)
      ^-  $-([ship nest:gv] ?)
      |=  [=ship =nest:gv]
      ?~  chan=(~(get by channels.group) nest)  |
      (go-can-read ship u.chan)
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
    =/  far=foreign:g  (~(gut by foreigns) f [~ ~ ~ ~ ~])
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
      (~(run by foreigns) gang:v2:foreign:v7:gc)
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
  ::  +fi-server-path: groups server base path
  ++  fi-server-path  `path`/server/groups/(scot %p p.flag)/[q.flag]
  ::  +fi-preview-path: groups server preview path
  ++  fi-preview-path  `path`/server/groups/(scot %p p.flag)/[q.flag]/preview
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
      |=  story=(unit story:s:g)  ::XX something is broken with story import
      ^-  (list card)
      =/  =wire  (weld fi-area /ask)
      =/  =path  (weld fi-server-path /ask/(scot %p our.bowl))
      =/  =cage
        group-command+!>(`c-groups:g`[%ask flag story])
      :~  [%pass wire %agent [p.flag server] %poke cage]
          [%pass wire %agent [p.flag server] %watch path]
      ==
    ::
    ++  leave-ask
      ^-  card
      =/  =wire  (weld fi-area /join/ask)
      [%pass wire %agent [p.flag server] %leave ~]
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
    =+  log=~(. l `%group-join)
    =.  cor  (emit (initiate:neg [p.flag server]))
    =+  net-group=(~(get by groups) flag)
    ::  leave the ask subscription in case it has not yet closed
    ::
    =?  cor  ?=([~ %ask] progress)
      (emit leave-ask:fi-pass)
    ?:  ?&  ?=(^ progress)
            ?=(?(%join %watch %done) u.progress)
        ==
      ::  join already in progress
      fi-core
    =.  progress  `%join
    =.  token  tok
    %-  (tell:log %dbug leaf+"+fi-join with token {<tok>}" ~)
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
    =+  l=~(. l `'group-join')
    ?~  progress
      ::NOTE  the $foreign in state might be "stale", if it's no longer
      ::      tracking progress it's safe for it to ignore $group subscription
      ::      updates.
      fi-core
    ?^  p
      %-  (fail:l %watch-ack leaf+"failed to join the group {<flag>}" ~)
      =.  progress  `%error
      fi-core
    %-  (tell:l %dbug leaf+"group {<flag>} joined successfully" ~)
    =.  progress  `%done
    fi-core
  ::  +fi-error: end a foreign sequence with an error
  ::  TODO log based on progress
  ::
  ++  fi-error
    ^+  fi-core
    =.  progress  `%error
    fi-core
  ::  +fi-cancel: cancel a group join in progress
  ::
  ++  fi-cancel
    ^+  fi-core
    =+  pro=progress  ::TMI
    ?:  ?=(~ pro)  fi-core
    ?-    u.pro
        %ask
      =.  cor  (emit leave-ask:fi-pass)
      =.  progress  ~
      fi-core
    ::
        %join
      =.  cor  (emit leave-group:fi-pass)
      =.  progress  ~
      fi-core
    ::
        %watch
      =.  cor  go-abet:(go-leave:(go-abed:go-core flag) &)
      =.  progress  ~
      fi-core
    ::
        %error
      =.  progress  ~
      fi-core
    ::
        ::NB  should never be hit as long as we delete
        ::    foreigns on done.
        %done
      %-  (tell:l %warn 'cancel invoked on a %done foreign group' ~)
      fi-core
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
    |=  [ver=?(%v1) =(pole knot)]
    ?>  from-self
    ^+  fi-core
    ?+    pole  ~|(bad-fi-watch+pole !!)
    ::
        [%preview ~]
      =.  lookup  `%preview
      (fi-safe-preview |)
    ==
  ::  +fi-safe-preview: safely subscribe for a group preview
  ::
  ++  fi-safe-preview
    |=  delay=?
    ^+  fi-core
    =.  lookup  `%preview
    =/  =wire  (weld fi-area /preview)
    =/  =dock  [p.flag dap.bowl]
    =^  caz=(list card)  subs
      (~(unsubscribe s [subs bowl]) wire dock)
    =.  cor  (emil caz)
    =.  cor  %.  delay
      (safe-watch (weld fi-area /preview) [p.flag dap.bowl] fi-preview-path)
    fi-core
  ::  +fi-watch-index: handle index watch request
  ::
  ++  fi-watch-index
    |=  [ver=?(%v0 %v1) =ship]
    ^+  fi-core
    ?>  from-self
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
        ::  poked with token to join the group
        ::
        [%join token=@ ~]
      =+  log=~(. l `'group-join')
      ?>  ?=(%poke-ack -.sign)
      ::  we aren't joining anymore, ignore
      ?.  &(?=(^ progress) =(%join u.progress))  fi-core
      ?^  p.sign
        %-  (tell:log %warn 'group join with token failed' u.p.sign)
        =.  progress  `%error
        fi-core
      =.  progress  `%watch
      ?:  (~(has by groups) flag)
        ::  accomodate rejoin, useful particularly for joining
        ::  a self-hosted group.
        ::
        =.  cor
          go-abet:(go-safe-sub:(go-abed:go-core flag) |)
        fi-core
      =/  =net:g  [%sub *@da |]
      =|  =group:g
      =?  meta.group  ?=(^ preview)  meta.u.preview
      ?<  (~(has by groups) flag)
      =.  groups  (~(put by groups) flag [net group])
      =.  cor
        go-abet:(go-safe-sub:(go-abed:go-core flag) |)
      fi-core
    ::
        ::  asked to join the group
        ::
        [%ask ~]
      =+  log=~(. l `'group-join')
      ?.  &(?=(^ progress) =(%ask u.progress))
        ::  we aren't asking anymore, ignore
        fi-core
      ?-    -.sign
          %poke-ack
        ?^  p.sign
          %-  (tell:log %warn 'group ask failed' u.p.sign)
          =.  progress  `%error
          fi-core
        fi-core
      ::
          %kick
        %-  (tell:log %warn 'group ask kicked' ~)
        =.  progress  `%error
        fi-core
      ::
          %watch-ack
        ?^  p.sign
          %-  (fail:log %watch-ack 'group ask watch' u.p.sign)
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
      =+  log=~(. l `'group-preview')
      ?+    -.sign  ~|(fi-agent-bad-preview+[pole -.sign] !!)
          %kick
        ?~  lookup
          %-  (tell:log %warn 'unexpected preview kick' ~)
          fi-core
        ?:  ?=(%preview u.lookup)
          %-  (tell:log %info 'retrying preview after kick' ~)
          (fi-safe-preview &)
        fi-core
      ::
          %watch-ack
        =+  lok=lookup
        ?>  ?=([~ %preview] lok)
        ?~  p.sign  fi-core
        =.  lookup  `%error
        %-  (fail:log 'watch-ack' 'group preview watch' u.p.sign)
        fi-core
      ::
          %fact
        ?>  ?=(%group-preview-3 p.cage.sign)
        =+  !<(=preview-update:v7:gv q.cage.sign)
        =+  lok=lookup
        ?>  ?=([~ %preview] lok)
        =.  lookup  `%done
        =.  preview  preview-update
        =.  cor
          =/  path-0  /gangs/(scot %p p.flag)/[q.flag]/preview
          =/  path-1  [%v1 (snoc fi-area %preview)]
          =?  cor  ?=(^ preview)
            %-  emil
            :~  :: v0
                ::
                [%give %fact ~[path-0] group-preview+!>((v2:preview:v7:gc u.preview))]
                [%give %kick ~[path-0] ~]
            ==
          %-  emil
          :~  ::  v1
              ::
              :^  %give  %fact
                ~[path-1]
              group-preview-3+!>(`preview-update:v7:gv`preview-update)
              [%give %kick ~[path-1] ~]
          ==
        fi-core
      ==
    ::
        :: command poke
        [%command *]
      =+  log=~(. l `'foreign-group-command')
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  fi-core
      %-  (fail:log 'poke-ack' 'foreign group command' u.p.sign)
      fi-core
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
      =+  !<(=previews:v7:gv q.cage.sign)
      =.  foreigns
        %+  roll  ~(tap by previews)
        |=  [[=flag:gv =preview:v7:gv] =_foreigns]
        =+  far=(~(gut by foreigns) flag *foreign:v7:gv)
        (~(put by foreigns) flag far(preview `preview))
      ::  v1
      ::
      =/  path-1  /v1/foreigns/index/(scot %p ship)
      =.  cor  %-  emil
        :~  :^  %give  %fact
              ~[path-1]
            group-previews-1+!>(`previews:v7:gv`previews)
          ::
            [%give %kick ~[path-1] ~]
        ==
      ::  v0
      ::
      =/  path-0  /gangs/index/(scot %p ship)
      =/  previews-2=previews:v2:gv
        (~(run by previews) v2:preview:v7:gc)
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

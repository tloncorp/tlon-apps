::  presence: short-lived personal activity indication
::
::    contexts are paths refering to dms, channels and groups.
::    participants subscribe to the context host at a personalized path.
::    participants poke the context host with presence, containing
::    display and timeout deets, and optional disclosure set.
::    context host fans the update out to participants as a fact.
::
::    presence is considered "owned" by the host of the context, in the
::    same way that channel contents and group metadata are.
::    dms are an exception here too: when poking ourselves with an action,
::    we put the counterparty in the context, but when subscribing to the
::    counterparty, we put ourselves in the context, because that's the
::    context _from their perspective_.
::
::    we use personalized subscription paths so that two parties can
::    communicate presence to each other in a public channel without
::    signalling that presence to all channel members. the channel host
::    still acts as intermediary, but does not store the presence unless it
::    itself is in the disclosure set.
::
::    context hosts do not give initial facts to subscribers. timing out of
::    presences does not get propagated to subscribers, but explicit %clear
::    does. (the latter goes out to _all_ subscribers, regardless of the
::    disclosure set of the prior presence.)
::
::    we do not solve for clock skew, instead respecting the received
::    timestamps and timeouts as-is, and ignoring any that have expired
::    by the time we receive them. if it's in the future, treat it as now.
::
::    we use both /context and /context-2 wire prefixes interchangeably,
::    because at some point during this agent's lifecycle we needed to
::    re-establish some subscriptions on a new flow, to work around ames-gall
::    bugs. we always _send_ the newest wire format, but must check for and
::    accept either.
::
::TODO  make chat, channels clear %typing whenever we receive a msg?
::TODO  discipline
::
/-  *presence, cv=channels-ver, gv=groups-ver, av=activity-ver
/+  dbug, verb, logs
::
|%
::NOTE  .want contains a [ship context] pair, because for ease-of-use we
::      specify the context as it exists _on their end_ (which is relevant for
::      the dm case).
::      wires only contain the context, because src.bowl indicates the ship.
+$  state-2
  $:  %2
      =places
      :: ships=(jug ship context)
    ::
      want=(set [ship context])   ::  desired outgoing subs
      subs=(jug context ship)     ::  real incoming subs
      tries=(map [ship context] @ud)  ::  consecutive sub nacks
      ::TODO  wack=(set ship)     ::  waiting for acks (load prevention)
  ==
::
+$  card  card:agent:gall
::
++  max-tries  5
::
++  default-timeout
  |=  =topic
  ^-  @dr
  ?-  topic
    %typing     ~s30
    %computing  ~m1
    %other      ~s30
  ==
::
++  context-host
  |=  [=context our=@p]
  ^-  ship
  ?+  context  !!
    [%dm @ ~]                          our
    [%channel kind=@ ship=@ name=@ ~]  (slav %p i.t.t.context)
    [%group ship=@ term=@ ~]           (slav %p i.t.context)
  ==
::
+$  membership
  ::  what it takes to participate in a context, once resolved
  ::
  $%  [%any ~]
      [%dm peer=ship]
      [%channel group=flag:gv kind=@tas host=ship name=@tas]
      [%group =flag:gv]
  ==
::
++  resolve-context
  ::  the context-level half of the participant check: resolves the
  ::  channel to its group and confirms we know it. done once per
  ::  context so per-ship checks don't repeat these scries.
  ::
  |=  [=context =bowl:gall]
  ^-  (each membership term)
  ?+  context  &+[%any ~]
      [%dm @ ~]
    ?~  peer=(slaw %p i.t.context)  |+%presence-bad-path
    &+[%dm u.peer]
  ::
      [%channel @ @ @ ~]
    ?~  host=(slaw %p i.t.t.context)  |+%presence-bad-path
    =*  kind  i.t.context
    =*  name  i.t.t.t.context
    =/  group=(unit flag:gv)  (group-for-channel kind u.host name bowl)
    ?~  group  |+%presence-unknown-channel
    ?.  (has-group u.group bowl)  |+%presence-unknown-channel-group
    &+[%channel u.group kind u.host name]
  ::
      [%group @ @ ~]
    ?~  host=(slaw %p i.t.context)  |+%presence-bad-path
    =/  =flag:gv  [u.host i.t.t.context]
    ?.  (has-group flag bowl)  |+%presence-unknown-group
    &+[%group flag]
  ==
::
++  member-error
  ::  the per-ship half: why .who may not participate, if at all
  ::
  |=  [who=ship =membership =bowl:gall]
  ^-  (unit term)
  ?-  -.membership
      %any  ~
      %dm   ?:(=(who peer.membership) ~ `%presence-not-dm-counterparty)
      %group
    ?:((has-seat flag.membership who bowl) ~ `%presence-not-group-member)
  ::
      %channel
    ::  the channel host can always read its own channel, whatever its
    ::  roles say, mirroring +can-read:perms in /lib/channel-utils
    ::
    ?:  =(who host.membership)  ~
    =,  membership
    ?:  (can-read group kind host name who bowl)  ~
    `%presence-cannot-read-channel
  ==
::
++  participant-error
  ::  why .who may not participate in .context, if at all.
  ::  we are the context host here. the term ends up in the nack tang
  ::  the subscriber receives, so it should say what went wrong.
  ::
  |=  [who=ship =context =bowl:gall]
  ^-  (unit term)
  =/  res  (resolve-context context bowl)
  ?:  ?=(%| -.res)  `p.res
  (member-error who p.res bowl)
::
++  context-readable
  ::  whether we, as a subscriber, should still expect the host to accept
  ::  our subscription to .context. for channels, the channel must still
  ::  be in its group, and readable by us, per our local %groups. channels
  ::  that were deleted from their group (or that we lost read access to)
  ::  may linger in %channels; their hosts nack us forever.
  ::
  |=  [=context =bowl:gall]
  ^-  ?
  ?.  ?=([%channel @ @ @ ~] context)  &
  ?~  host=(slaw %p i.t.t.context)  |
  =*  kind  i.t.context
  =*  name  i.t.t.t.context
  =/  group=(unit flag:gv)  (group-for-channel kind u.host name bowl)
  ?~  group  |
  ?.  (has-group u.group bowl)  |
  (can-read u.group kind u.host name our.bowl bowl)
::
++  has-group
  |=  [=flag:gv =bowl:gall]
  ^-  ?
  =/  base=path  /(scot %p our.bowl)/groups/(scot %da now.bowl)
  ?.  .^(? %gu (weld base /$))  |
  .^(? %gu (weld base /groups/(scot %p p.flag)/[q.flag]))
::
++  has-seat
  ::  callers check +has-group first
  |=  [=flag:gv who=ship =bowl:gall]
  ^-  ?
  =;  seat
    ?=(^ seat)
  .^  (unit seat:v7:gv)  %gx
    %+  weld  /(scot %p our.bowl)/groups/(scot %da now.bowl)
    /groups/(scot %p p.flag)/[q.flag]/seats/(scot %p who)/noun
  ==
::
++  can-read
  ::  whether .who may read channel [kind host name] of .group, according
  ::  to our %groups. false if the channel is no longer part of the group.
  ::  callers check +has-group first.
  ::
  |=  [group=flag:gv kind=@tas host=ship name=@tas who=ship =bowl:gall]
  ^-  ?
  .^  ?  %gx
    %+  weld  /(scot %p our.bowl)/groups/(scot %da now.bowl)
    %+  weld  /v2/groups/(scot %p p.group)/[q.group]
    /channels/[kind]/(scot %p host)/[name]/can-read/(scot %p who)/loob
  ==
::
++  group-for-channel
  |=  [kind=@tas =ship name=@tas =bowl:gall]
  ^-  (unit flag:gv)
  =/  base=path  /(scot %p our.bowl)/channels/(scot %da now.bowl)
  =/  channel=path  (weld base /v4/[kind]/(scot %p ship)/[name])
  ?.  .^(? %gu (weld base /$))  ~
  ?.  .^(? %gu channel)  ~
  =+  .^(=perm:v9:cv %gx (weld channel /perm/channel-perm))
  `group.perm
::
++  put-presence
  |=  [=places key =timing =display]
  ^+  places
  %+  ~(put by places)  context
  =+  tos=(~(gut by places) context *topics)
  %+  ~(put by tos)  topic
  =+  pes=(~(gut by tos) topic *people)
  (~(put by pes) ship timing display)
::
++  del-presence
  |=  [=places key]
  ^+  places
  =/  tos  (~(gut by places) context *topics)
  =/  pes  (~(gut by tos) topic *people)
  =.  pes  (~(del by pes) ship)
  =.  tos  ?:  =(~ pes)  (~(del by tos) topic)
           (~(put by tos) topic pes)
  ?:  =(~ tos)  (~(del by places) context)
  (~(put by places) context tos)
::
++  cancel-expire
  |=  [=places key]
  ^-  (list card)
  =/  tos  (~(gut by places) context *topics)
  =/  pes  (~(gut by tos) topic *people)
  ?~  pre=(~(get by pes) ship)  ~
  =/  end=@da
    %+  add  since.u.pre
    (fall timeout.u.pre (default-timeout topic))
  :_  ~
  :+  %pass
    [%expire (scot %p ship) topic context]
  [%arvo %b %rest end]
::
++  give-update
  |=  [subs=(jug context ship) disclose=(set ship) upd=update-1]
  ^-  (list card)
  =/  =key  ?-(-.upd %set key.upd, %clear key.upd)
  =/  s
    ?:  =(~ disclose)  (~(get ju subs) context.key)
    (~(int in disclose) (~(get ju subs) context.key))
  ?:  =(~ s)  ~
  =/  paz=(list path)
    %+  turn  ~(tap in s)
    |=(s=ship `path`[%context (scot %p s) context.key])
  [%give %fact paz %presence-update-1 !>(upd)]~
::
++  revalidate
  ::  subscribers are only checked when they subscribe. before fanning out
  ::  to .context, kick and forget any that may no longer participate in
  ::  it (reader roles changed, left or removed from the group, channel
  ::  deleted). a kicked subscriber re-checks on its own end and either
  ::  drops the context or resubscribes and gets a nack that says why.
  ::
  |=  [=context subs=(jug context ship) =bowl:gall]
  ^-  [(list card) _subs]
  ::  resolve the context once; only the per-ship check runs in the loop
  ::
  =/  res  (resolve-context context bowl)
  =/  bad=(list ship)
    %+  skip  ~(tap in (~(get ju subs) context))
    |=  who=ship
    ?:  ?=(%| -.res)  |
    =(~ (member-error who p.res bowl))
  ::NOTE  not ?~, which would narrow .bad and make +roll nest-fail
  ?:  =(~ bad)  [~ subs]
  :_  %+  roll  bad
      |=([who=ship s=_subs] (~(del ju s) context who))
  :~  %^  tell:~(. logs [bowl /logs])  %info
        ~['kicking subscribers that lost access' >[context=context ships=bad]<]
      ~
    ::
      :+  %give  %kick
      :_  ~
      %+  turn  bad
      |=(who=ship `path`[%context (scot %p who) context])
  ==
::
++  give-response
  |=  res=response-1
  ^-  card
  [%give %fact ~[/v1] %presence-response-1 !>(`response-1`res)]
::
++  await-setup
  |=  [wen=@da wat=(unit [s=ship c=context])]
  ^-  card
  =;  =wire  [%pass wire %arvo %b %wait wen]
  [%setup ?~(wat ~ [(scot %p s.u.wat) c.u.wat])]
::
++  dm-contexts
  |=  =bowl:gall
  ^-  (set [ship context])
  %.  (late /dm/(scot %p our.bowl))
  %~  run  in
  .^  (set ship)  %gx
    /(scot %p our.bowl)/chat/(scot %da now.bowl)/dm/ships
  ==
::
++  channel-contexts
  ::  every channel in our %channels that we can still read, per +can-read.
  ::  see +context-readable for why we filter.
  ::
  |=  =bowl:gall
  ^-  (set [ship context])
  =/  chans=channels:v9:cv
    .^  channels:v9:cv  %gx
      /(scot %p our.bowl)/channels/(scot %da now.bowl)/v4/channels/channels-4
    ==
  %-  ~(gas in *(set [ship context]))
  %+  murn  ~(tap by chans)
  |=  [=nest:v9:cv =channel:v9:cv]
  ^-  (unit [ship context])
  ?.  ?&  (has-group group.perm.channel bowl)
          (can-read group.perm.channel kind.nest ship.nest name.nest our.bowl bowl)
      ==
    ~
  `[ship.nest /channel/[kind.nest]/(scot %p ship.nest)/[name.nest]]
::
++  watch-context
  |=  [our=ship who=ship =context]
  ^-  card
  ?<  =(our who)
  ::NOTE  we watch-as, so the publisher will attempt conversion.
  ::      this will work as long as we're aligned or behind the publisher.
  ::      ⚠️ if we're ahead and ask about a mark they don't know,
  ::      conversion will fail, we will get get kicked!
  :+  %pass      [%context-2 context]
  :+  %agent     [who %presence]
  :+  %watch-as  %presence-update-1
  [%context (scot %p our) context]
::
++  leave-context
  |=  [who=ship =context]
  :~  [%pass [%context context] %agent [who %presence] %leave ~]
      [%pass [%context-2 context] %agent [who %presence] %leave ~]
  ==
::
++  inflate
  |=  [=bowl:gall want=(set [ship context])]
  ^-  (list card)
  ;:  weld
    ::  leave contexts that we have but don't want
    ::
    %+  murn  ~(tap by wex.bowl)
    |=  [[=wire =ship =term] *]
    ^-  (unit card)
    ?.  ?=([?(%context %context-2) *] wire)  ~
    =*  context  t.wire
    ?:  (~(has in want) ship context)  ~
    `[%pass wire %agent [ship term] %leave ~]
  ::
    ::  watch contexts that we don't have but want
    ::
    %+  murn  ~(tap in want)
    |=  [=ship =context]
    ^-  (unit card)
    ?:  =(ship our.bowl)  ~  ::  don't subscribe to ourselves
    ?:  ?|  (~(has by wex.bowl) [%context context] ship dap.bowl)
            (~(has by wex.bowl) [%context-2 context] ship dap.bowl)
        ==
      ~
    `(watch-context our.bowl ship context)
  ::
    ::  ensure we have local subs in place
    ::
    %+  murn
      ^-  (list [wire dude:gall path])
      :~  [/activity/all %activity /v4]  ::TODO  would be nice to watch "smaller"
      ==
    |=  [=wire =dude:gall =path]
    ^-  (unit card)
    ?:  (~(has by wex.bowl) wire our.bowl dude)  ~
    `[%pass wire %agent [our.bowl dude] %watch path]
  ==
--
::
=|  state-2
=*  state  -
::
%-  agent:dbug
%^  verb  |  %warn
::
^-  agent:gall
|_  =bowl:gall
+*  this  .
    log   ~(. logs [bowl /logs])
++  on-init
  ^-  (quip card _this)
  :_  this
  :~  (tell:log %dbug ~['on-init: scheduling initial setup'] ~)
      (await-setup now.bowl ~)
  ==
::
++  on-save  !>(state)
::
++  on-load
  |=  ole=vase
  |^  ^-  (quip card _this)
      =/  old  !<(versioned-state ole)
      =?  old  ?=(%0 -.old)  [%1 places.old want.old subs.old ~]
      =^  caz  old
        ?.  ?=(%1 -.old)  [~ old]
        :_  old(- %2)
        ::  due to a gall-ames bug, if the remote agent wasn't running yet when
        ::  we first sent out subscription, it blocks the flow indefinitely,
        ::  even once the agent on the other side is running.
        ::  now that presence agent is running on all up-to-date ships,
        ::  re-start unacked subs on a fresh flow, to work around that bug.
        ::
        %-  zing
        %+  turn  ~(tap by wex.bowl)
        |=  [[=wire =ship =term] acked=? =path]
        ^-  (list card)
        ?:  acked                  ~
        ?.  =(%presence term)      ~
        ?.  ?=([%context *] wire)  ~
        :~  [%pass wire %agent [ship term] %leave ~]
            (watch-context our.bowl ship t.wire)
        ==
      ?>  ?=(%2 -.old)
      :_  this(state old)
      :*  (tell:log %dbug ~['on-load: scheduling setup' >`@ud`~(wyt in want)< >`@ud`~(wyt by subs)<] ~)
          (await-setup now.bowl ~)
          caz
      ==
  ::
  +$  versioned-state  $%(state-0 state-1 state-2)
  ::
  +$  state-1
    $:  %1
        =^places
        want=(set [ship context])
        subs=(jug context ship)
        tries=(map [ship context] @ud)
    ==
  ::
  +$  state-0
    $:  %0
        =^places
        want=(set [ship context])
        subs=(jug context ship)
    ==
  --
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ~|  mark=mark
  ?+  mark  !!
      %presence-action-1
    =+  !<(act=action-1 vase)
    ?>  =(src our):bowl
    ?:  ?=(%nuke -.act)
      ::TODO  response?
      [~ this(places (~(del by places) context.act))]
    =;  =cage
      =/  =key     ?-(-.act %set key.act, %clear key.act)
      =/  host=@p  (context-host context.key our.bowl)
      [[%pass [%context-2 context.key] %agent [host dap.bowl] %poke cage]~ this]
    :-  %presence-command-1
    !>  ^-  command-1
    ?-  -.act
      %set    act(timeout [now.bowl timeout.act])
      %clear  act
    ==
  ::
      %presence-command-1
    =+  !<(cmd=command-1 vase)
    =/  =key  ?-(-.cmd %set key.cmd, %clear key.cmd)
    ~|  [context=context.key src=src.bowl]
    ::  only acceptable if we are the context host,
    ::  and the sender could be a participant,
    ::  and it's a presence for the sender
    ::
    ?>  =(our.bowl (context-host context.key our.bowl))
    ?>  |(!?=([%dm *] context.key) =(our src):bowl)
    ?>  =(src.bowl ship.key)
    ::  for non-dm contexts, verify participant membership
    ::
    ?^  err=?:(?=([%dm *] context.key) ~ (participant-error src.bowl context.key bowl))
      ~|(u.err !!)
    ::  subscribers are only checked when they subscribe. before fanning
    ::  out, kick any that have since lost access (reader roles changed,
    ::  left or got removed from the group, channel deleted).
    ::
    =^  kicks=(list card)  subs  (revalidate context.key subs bowl)
    ?-  -.cmd
        %set
      ::  ack but no-op on timed out presence
      ::
      =?  since.timing.cmd  (gth since.timing.cmd now.bowl)
        now.bowl
      =/  end=@da
        %+  add  since.timing.cmd
        (fall timeout.timing.cmd (default-timeout topic.key.cmd))
      ?:  (gth now.bowl end)
        ::TODO  maybe delete existing one at key?
        [kicks this]
      =/  fus=(list card)
        %+  give-update
          (~(del ju subs) context.key.cmd src.bowl)
        [disclose.cmd %set +>.cmd]
      ::  an empty disclose means public, which includes ourselves.
      ::  without this, the host's own client never sees presence
      ::  for contexts it hosts.
      ::
      ?.  |(=(~ disclose.cmd) (~(has in disclose.cmd) our.bowl))
        [(weld kicks fus) this]
      ::TODO  send response too?
      :_  this(places (put-presence places +>.cmd))
      %+  weld  kicks
      :+  (give-response %here +>.cmd)
        :+  %pass
          ::TODO  +key-wire
          [%expire (scot %p ship.key.cmd) topic.key.cmd context.key.cmd]
        [%arvo %b %wait end]
      fus
    ::
        %clear
      ::TODO  no-op if we didn't have it anyway
      :_  this(places (del-presence places key.cmd))
      ;:  weld
        kicks
        (cancel-expire places key.cmd)
        [(give-response %gone key.cmd)]~
        %+  give-update
          (~(del ju subs) context.key.cmd src.bowl)
        [~ %clear key.cmd]
      ==
    ==
  ==
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?+  path  !!
      [%v1 ~]
    ?>  =(src our):bowl
    :_  this
    [%give %fact ~ %presence-response-1 !>(`response-1`[%init places])]~
  ::
      [%context @ *]
    ::  context watch paths must be properly personalized
    ::
    ?.  =(`src.bowl (slaw %p i.t.path))
      ~|(%presence-bad-path !!)
    ::  verify the subscriber is a participant in this context.
    ::  the hint ends up in the subscriber's nack tang.
    ::
    ?^  err=(participant-error src.bowl t.t.path bowl)
      ~|(u.err !!)
    =.  subs  (~(put ju subs) t.t.path src.bowl)
    ::NOTE  no initial fact, since all data is short-lived,        ::REVIEW
    ::      and we don't want to hot-loop on mark incompatibility  ::REVIEW
    :_  this
    [(tell:log %dbug ~['on-watch: incoming context sub' >src.bowl< >t.t.path<] ~)]~
  ==
::
++  on-leave
  |=  =path
  ^-  (quip card _this)
  ?+  path  [~ this]
      [%context @ *]
    =.  subs  (~(del ju subs) t.t.path src.bowl)
    [~ this]
  ==
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ~|  wire=wire
  ?+  wire  ~|(%strange-wire !!)
      [%logs ~]
    ::  acks from pokes we send to the logs agent; nothing to do.
    ::  on nack, slog it so we don't lose the error silently.
    ::
    ?.  ?=(%poke-ack -.sign)  [~ this]
    ?~  p.sign  [~ this]
    %-  (slog (rap 3 dap.bowl ': logs poke nacked' ~) u.p.sign)
    [~ this]
  ::
      [%activity %all ~]
    ?-  -.sign
      %poke-ack  ~|(%unexpeced-poke-ack !!)
    ::
        %kick
      ::  re-do setup after brief wait, preventing hot-looping.
      ::  particularly important here because it's a local subscription.
      ::
      :_  this
      :~  (tell:log %dbug ~['local sub kicked, rescheduling setup' >wire<] ~)
          (await-setup (add now.bowl ~s30) ~)
      ==
    ::
        %watch-ack
      ?~  p.sign  :_(this [(tell:log %dbug ~['local sub ack ok' >wire<] ~)]~)
      %-  (slog (rap 3 dap.bowl ' rejected by local for ' (spat wire) ~) u.p.sign)
      :_  this
      [(fail:log %warn ~['local sub nacked' >wire=wire<] u.p.sign ~)]~
    ::
        %fact
      ?.  ?=(%activity-update-4 p.cage.sign)
        :_  this
        [(tell:log %warn ~['/activity/all: unexpected mark' >p.cage.sign<] ~)]~
      =+  !<(upd=update:v8:av q.cage.sign)
      =/  news=(unit [add=? source=$>(?(%channel %dm) source:v8:av)])
        ?+  upd  ~
          [%add [?(%channel %dm) *] *]  `[& source.upd]
          [%del [?(%channel %dm) *]]    `[| source.upd]
        ==
      ?~  news  [~ this]
      =/  new=(unit [ship context])
        =*  src  source.u.news
        ?-  -.source.u.news
          %channel  =,  nest.src
                    ?:  =(our.bowl ship)        ~
                    `[ship /channel/[kind]/(scot %p ship)/[name]]
          %dm       ?.  ?=(%ship -.whom.src)    ~
                    ?:  =(our.bowl p.whom.src)  ~
                    `[p.whom.src /dm/(scot %p our.bowl)]
        ==
      ?~  new  [~ this]
      ?:  &(add.u.news !(~(has in want) u.new))
        :_  this(want (~(put in want) u.new))
        :~  (tell:log %dbug ~['/activity/all: registering new context' >u.new<] ~)
            (watch-context our.bowl u.new)
        ==
      ?:  &(!add.u.news (~(has in want) u.new))
        =.  tries  (~(del by tries) u.new)
        :_  this(want (~(del in want) u.new))
        :-  (tell:log %dbug ~['channels/all: removing context' >u.new<] ~)
        (leave-context u.new)
      [~ this]
    ==
  ::
      [?(%context %context-2) *]
    =*  context  t.wire
    ?-  -.sign
        %poke-ack
      ?~  p.sign
        :_  this
        [(tell:log %dbug ~['context poke acked' >src.bowl< >context<] ~)]~
      %-  (slog (rap 3 dap.bowl ': poke-nacked by ' (scot %p src.bowl) ~) u.p.sign)
      :_  this
      [(fail:log %warn ~['context poke nacked' >[src=src.bowl context=context]<] u.p.sign ~)]~
    ::
        %kick
      ::  resubscribe after brief wait, prevent hot-looping
      ::
      :_  this
      :~  (tell:log %dbug ~['context sub kicked, rescheduling' >src.bowl< >context<] ~)
          (await-setup (add now.bowl ~s15) `[src.bowl context])
      ==
    ::
        %watch-ack
      ?~  p.sign
        =.  tries  (~(del by tries) [src.bowl context])
        :_  this
        [(tell:log %dbug ~['context sub ack ok' >src.bowl< >context<] ~)]~
      ::  nacked. the nack may be transient (host hasn't synced the
      ::  group or channel yet, or our own %groups hasn't caught up), so
      ::  retry with linear backoff. the retry wake re-checks whether we
      ::  can still read the context, and drops it if not. after
      ::  +max-tries consecutive nacks, drop the desire so we don't
      ::  retry forever; the next full setup starts a fresh cycle if
      ::  the context is still relevant.
      ::
      ::  none of this is a crash on our end, so we only ever +tell.
      ::  keep the message texts stable, dashboards filter on them.
      ::
      =/  try=@ud  +((~(gut by tries) [src.bowl context] 0))
      ?:  (gth try max-tries)
        =.  want   (~(del in want) [src.bowl context])
        =.  tries  (~(del by tries) [src.bowl context])
        :_  this
        =-  [(tell:log %warn - ~)]~
        :*  'context sub nacked, giving up'
            >[src=src.bowl context=context tries=max-tries]<
            u.p.sign
        ==
      =.  tries  (~(put by tries) [src.bowl context] try)
      :_  this
      :~  (await-setup (add now.bowl (mul try ~m5)) `[src.bowl context])
          =-  (tell:log %info - ~)
          :*  'context sub nacked, will retry'
              >[src=src.bowl context=context try=try]<
              u.p.sign
          ==
      ==
    ::
        %fact
      ?.  ?=(%presence-update-1 p.cage.sign)
        ::NOTE  unexpected because we %watch-as in +watch-context
        :_  this
        [(tell:log %warn ~['context fact: unexpected mark' >p.cage.sign<] ~)]~
      =+  !<(upd=update-1 q.cage.sign)
      ::  only allow updates for the same context
      ?.  ?|  &(?=(%set -.upd) =(context.key.upd context))
              &(?=(%clear -.upd) =(context.key.upd context))
          ==
        :_  this
        [(tell:log %warn ~['context fact: wire/context mismatch' >wire< >upd<] ~)]~
      ::  translate dm context from peer's perspective to ours
      ::
      =/  theirs=^context  /dm/(scot %p our.bowl)
      =/  ours=^context    /dm/(scot %p src.bowl)
      =.  upd
        ?-  -.upd
          %set    ?:(=(theirs context.key.upd) upd(context.key ours) upd)
          %clear  ?:(=(theirs context.key.upd) upd(context.key ours) upd)
        ==
      ?-  -.upd
          %set
        =?  since.timing.upd  (gth since.timing.upd now.bowl)
          now.bowl
        =/  end=@da
          %+  add  since.timing.upd
          (fall timeout.timing.upd (default-timeout topic.key.upd))
        ?:  (gth now.bowl end)
          ::TODO  maybe delete existing one at key?
          :_  this
          [(tell:log %dbug ~['context fact: %set already expired' >key.upd<] ~)]~
        :_  this(places (put-presence places +.upd))
        :~  (tell:log %dbug ~['context fact: %set applied' >key.upd< >end<] ~)
            (give-response %here +.upd)
            :+  %pass
              ::TODO  +key-wire
              [%expire (scot %p ship.key.upd) topic.key.upd context.key.upd]
            [%arvo %b %wait end]
        ==
      ::
          %clear
        ::TODO  no-op if we didn't have it anyway
        :_  this(places (del-presence places key.upd))
        ;:  weld
          (cancel-expire places key.upd)
          :~  (tell:log %dbug ~['context fact: %clear applied' >key.upd<] ~)
              (give-response %gone key.upd)
          ==
        ==
      ==
    ==
  ==
::
++  on-arvo
  |=  [=wire sign=sign-arvo]
  ^-  (quip card _this)
  ~|  wire=wire
  ?+  wire  ~|(%strange-wire !!)
      [%setup ?(~ ^)]
    ?>  ?=([%behn %wake *] sign)
    ?^  error.sign
      ::TODO  log formally
      %.  [~ this]
      (slog (rap 3 dap.bowl ': failed wake on ' (spat wire) ~) u.error.sign)
    ?~  t.wire
      ::  ensure we .want all relevant contexts, then inflate fully.
      ::  this implicitly drops any contexts not in +channel- or +dm-contexts!
      ::
      =/  dms=(set [ship context])    (dm-contexts bowl)
      =/  chans=(set [ship context])  (channel-contexts bowl)
      =.  want  (~(uni in dms) chans)
      ::  prune retry counts for contexts we no longer want
      ::
      =.  tries
        %+  roll  ~(tap by tries)
        |=  [[k=[ship context] n=@ud] acc=(map [ship context] @ud)]
        ?.  (~(has in want) k)  acc
        (~(put by acc) k n)
      =/  cards=(list card)  (inflate bowl want)
      :_  this
      %+  weld
        ^-  (list card)
        :~  (tell:log %dbug ~['setup: starting full inflate'] ~)
            (tell:log %dbug ~['setup: dm-contexts' >dms<] ~)
            (tell:log %dbug ~['setup: channel-contexts count' >`@ud`~(wyt in chans)<] ~)
            (tell:log %dbug ~['setup: want total' >`@ud`~(wyt in want)<] ~)
            (tell:log %dbug ~['setup: inflate produced cards' >`@ud`(lent cards)<] ~)
        ==
      cards
    ::  set up subscription for a specific context
    ::
    =/  =ship  (slav %p i.t.wire)
    ?<  =(ship our.bowl)  ::  don't subscribe to ourselves
    =*  context  t.t.wire
    ::  the desire may have been dropped (context left) between the nack
    ::  retry being scheduled and firing. don't resubscribe in that case.
    ::
    ?.  (~(has in want) [ship context])
      =.  tries  (~(del by tries) [ship context])
      :_  this
      [(tell:log %dbug ~['setup(specific): no longer wanted, skipping' >ship< >context<] ~)]~
    ::  likewise if we can no longer read it: the channel was deleted from
    ::  its group, or we lost read access. the host would keep nacking us.
    ::  if access comes back, the next activity event in the channel (any
    ::  post) re-registers it via /activity/all, as does any full setup.
    ::
    ?.  (context-readable context bowl)
      =.  want   (~(del in want) [ship context])
      =.  tries  (~(del by tries) [ship context])
      :_  this
      [(tell:log %info ~['context sub no longer readable, dropping' >[src=ship context=context]<] ~)]~
    ?:  ?|  (~(has by wex.bowl) [%context context] ship dap.bowl)
            (~(has by wex.bowl) [%context-2 context] ship dap.bowl)
        ==
      :_  this
      [(tell:log %dbug ~['setup(specific): already subscribed, skipping' >ship< >context<] ~)]~
    :_  this
    :~  (tell:log %dbug ~['setup(specific): subscribing' >ship< >context<] ~)
        (watch-context our.bowl ship context)
    ==
  ::
      [%expire @ topic *]
    ::TODO  +wire-key
    =/  =ship    (slav %p i.t.wire)
    =*  topic    i.t.t.wire
    =*  context  t.t.t.wire
    =*  key      [context ship topic]
    ::  every %set arms its own expiry timer without cancelling prior ones,
    ::  so a stale timer may fire while fresher %sets keep the entry alive.
    ::  only delete once the entry has actually expired.
    ::
    =/  tos  (~(gut by places) context *topics)
    =/  pes  (~(gut by tos) topic *people)
    ?~  pre=(~(get by pes) ship)
      [~ this]
    =/  end=@da
      %+  add  since.u.pre
      (fall timeout.u.pre (default-timeout topic))
    ?:  (gth end now.bowl)
      [~ this]
    =.  places   (del-presence places key)
    [[(give-response %gone key)]~ this]
  ==
::
++  on-fail
  |=  [=term =tang]
  ^-  (quip card _this)
  ::TODO  want to ~(del in want) if ?=(%fact term) but don't know the wire...
  :_  this
  [(~(on-fail logs bowl /logs) term tang)]~
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  ~
      [%x %v1 %init ~]
    ``presence-response-1+!>(`response-1`[%init places])
  ==
--

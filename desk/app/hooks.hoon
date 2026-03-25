/-  h=hooks, c=channels
/+  default-agent, hk=hooks, strandio
=>
  |%
  +$  card  card:agent:gall
  +$  current-state  hook-state-0:h
  --
=|  current-state
=*  state  -
^-  agent:gall
=<
  |_  =bowl:gall
  +*  this  .
      def  ~(. (default-agent this %|) bowl)
      cor  ~(. +> [bowl ~])
  ++  on-init
    ^-  (quip card _this)
    =^  cards  state
      abet:init:cor
    [cards this]
  ++  on-save  !>(state)
  ++  on-load
    |=  old=vase
    ^-  (quip card _this)
    =^  cards  state
      abet:(load:cor old)
    [cards this]
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
  ++  on-peek
    |=  =path
    (peek:cor path)
  ++  on-leave  on-leave:def
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    =^  cards  state
      abet:(agent:cor wire sign)
    [cards this]
  ++  on-arvo
    |=  [=wire =sign-arvo]
    ^-  (quip card _this)
    =^  cards  state
      abet:(arvo:cor wire sign-arvo)
    [cards this]
  ++  on-fail  on-fail:def
  --
::
|_  [=bowl:gall cards=(list card)]
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  init-state
  ^-  current-state
  [%0 *(map hook-id:h hook-def:h) *(map hitch-id:h hitch:h) *(map run-id:h run-log:h) *(map run-id:h pending-run:h) *(map path firehose-sub:h) [100 50 1.024]]
++  is-local  =(src.bowl our.bowl)
++  hook-visible
  |=  def=hook-def:h
  ^-  ?
  ?:  is-local
    &
  ?-  -.visibility.def
    %private  |
    %public  &
    %ships  (~(has in ships.visibility.def) src.bowl)
  ==
++  visible-hooks
  ^-  (map hook-id:h hook-def:h)
  ?:  is-local
    hooks.state
  %+  roll  ~(tap by hooks.state)
  |=  [[hid=hook-id:h def=hook-def:h] acc=(map hook-id:h hook-def:h)]
  ?:  (hook-visible def)
    (~(put by acc) hid def)
  acc
::  compile hook source, caching the result on the hook-def
::
++  compile-hook
  |=  def=hook-def:h
  ^-  hook-def:h
  =/  result=(each vase tang)  (compile-hook:hk src.def)
  ?:  ?=(%| -.result)
    def(compiled ~)
  def(compiled `p.result)
::  recompile all hooks (needed after load since vases don't
::  survive upgrades)
::
++  recompile-all
  ^+  cor
  =.  hooks.state
    %+  roll  ~(tap by hooks.state)
    |=  [[hid=hook-id:h def=hook-def:h] acc=(map hook-id:h hook-def:h)]
    (~(put by acc) hid (compile-hook def))
  cor
++  load
  |=  old=vase
  ^+  cor
  =.  state  !<(=hook-state-0:h old)
  =.  cor  recover-orphaned-runs
  =.  cor  recompile-all
  start-watches
++  init
  ^+  cor
  =.  state  init-state
  start-watches
++  start-watches
  ^+  cor
  ::  %channels on /v3 is the firehose: gives channel-response-4
  ::  facts (r-channels:c) for all channel events
  =.  cor  (watch-firehose %channels /firehose/channels [our.bowl %channels] /v3)
  ::  groups agent for group-level config changes
  (watch-firehose %groups /firehose/groups [our.bowl %groups] /v1/groups)
++  safe-watch
  |=  [=wire =dock =path]
  ^+  cor
  ?:  (~(has by wex.bowl) wire dock)
    cor
  (emit %pass wire %agent dock %watch path)
++  watch-firehose
  |=  [source=firehose-source:h =wire =dock =path]
  ^+  cor
  =.  firehoses.state
    (~(put by firehoses.state) wire [source wire dock path |])
  (safe-watch wire dock path)
++  set-firehose-live
  |=  [wire=path live=?]
  ^+  cor
  ?~  sub=(~(get by firehoses.state) wire)
    cor
  =.  firehoses.state
    (~(put by firehoses.state) wire u.sub(live live))
  cor
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?>  =(src.bowl our.bowl)
  ?>  =(mark %noun)
  =+  action=!<(hook-action:h vase)
  ?-  -.action
    %add-hook
      =/  def=hook-def:h  (compile-hook hook.action)
      =.  hooks.state  (~(put by hooks.state) id.def def)
      notify-hooks
    %remove-hook
      =.  hooks.state  (~(del by hooks.state) id.action)
      notify-hooks
    %update-hook
      =/  def=hook-def:h  (compile-hook hook.action)
      =.  hooks.state  (~(put by hooks.state) id.action def)
      notify-hooks
    %add-hitch
      =.  hitches.state  (~(put by hitches.state) id.hitch.action hitch.action)
      notify-hitches
    %remove-hitch
      =.  hitches.state  (~(del by hitches.state) id.action)
      notify-hitches
    %update-hitch
      ?~  hit=(~(get by hitches.state) id.action)
        cor
      =.  hitches.state
        (~(put by hitches.state) id.action (apply-hitch-patch:hk u.hit patch.action))
      notify-hitches
    %enable-hitch
      (set-hitch-enabled id.action &)
    %disable-hitch
      (set-hitch-enabled id.action |)
    %run
      (dispatch-manual-run id.action [%run `req-id.action] ?~(args.action !>(~) u.args.action))
    %run-chain
      (dispatch-chain req-id.action caller.action hitches.action event.action)
    %test-run
      (dispatch-manual-run id.action [%test ~] event.action)
  ==
++  set-hitch-enabled
  |=  [id=hitch-id:h enabled=?]
  ^+  cor
  ?~  hit=(~(get by hitches.state) id)
    cor
  =.  hitches.state
    (~(put by hitches.state) id u.hit(enabled enabled))
  notify-hitches
++  watch
  |=  =(pole knot)
  ^+  cor
  ?.  is-local
    cor
  ?+  pole  cor
      [%hooks ~]
    (give %fact ~ %noun !>(hooks.state))
      [%hitches ~]
    (give %fact ~ %noun !>(hitches.state))
      [%runs ~]
    (give %fact ~ %noun !>(runs.state))
      [%v1 ~]
    (give %fact ~ %noun !>(state))
      [%v1 %hooks ~]
    (give %fact ~ %noun !>(hooks.state))
      [%v1 %hitches ~]
    (give %fact ~ %noun !>(hitches.state))
      [%v1 %runs ~]
    (give %fact ~ %noun !>(runs.state))
      [%v1 %runs hitch=@ ~]
    (give %fact ~ %noun !>((runs-for-hitch (slav %uv hitch.pole))))
      [%v1 %response term=@ rid=@ ~]
    cor
  ==
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?:  is-local
    ?+  pole  [~ ~]
        [%x %hooks ~]
      ``noun+!>(hooks.state)
        [%x %v1 %hooks ~]
      ``noun+!>(hooks.state)
        [%x %hitches ~]
      ``noun+!>(hitches.state)
        [%x %runs ~]
      ``noun+!>(runs.state)
        [%x %state ~]
      ``noun+!>(state)
        [%x %v1 ~]
      ``noun+!>(state)
    ==
  ?+  pole  [~ ~]
      [%x %hooks ~]
    ``noun+!>(visible-hooks)
      [%x %v1 %hooks ~]
    ``noun+!>(visible-hooks)
  ==
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+  pole  cor
      [%firehose *]
    =/  src  ;;(firehose-source:h (snag 1 `(list @ta)`pole))
    ?+  -.sign  cor
      %watch-ack
        (set-firehose-live pole &)
      %kick
        =.  cor  (set-firehose-live pole |)
        (rewatch pole)
      %fact
        (ingest-firehose src cage.sign)
      ==
  ==
++  rewatch
  |=  wire=path
  ^+  cor
  ?~  sub=(~(get by firehoses.state) wire)
    cor
  (safe-watch wire dock.u.sub path.u.sub)
::  normalize channel-response-4 (r-channels:c) from /v3 firehose
::
++  normalize-channels
  |=  cage=cage
  ^-  (unit firehose-event:h)
  ?.  =(%channel-response-4 p.cage)
    ~
  =/  rc=r-channels:c  !<(=r-channels:c q.cage)
  =/  =nest:c  nest.rc
  =/  res=term
    ?+  -.r-channel.rc  -.r-channel.rc
        %post
      ?-  -.r-post.r-channel.rc
        %set     ?:  ?=(%| -.post.r-post.r-channel.rc)  %del
                 %add
        %reply   %reply
        %reacts  %react
        %essay   %edit
      ==
    ==
  `[%channels res `[%channels nest] q.cage now.bowl]
++  normalize-firehose
  |=  [source=firehose-source:h cage=cage]
  ^-  (unit firehose-event:h)
  ?-  source
    %channels
      (normalize-channels cage)
    %groups
      `[%groups p.cage ~ q.cage now.bowl]
    %contacts
      `[%contacts p.cage ~ q.cage now.bowl]
    %activity
      `[%activity p.cage ~ q.cage now.bowl]
    %cron
      `[%cron p.cage ~ q.cage now.bowl]
    %webhook
      `[%webhook p.cage ~ q.cage now.bowl]
    %command
      `[%command p.cage ~ q.cage now.bowl]
  ==
++  ingest-firehose
  |=  [source=firehose-source:h cage=cage]
  ^+  cor
  ?~  event=(normalize-firehose source cage)
    cor
  (dispatch-firehose u.event)
++  dispatch-firehose
  |=  event=firehose-event:h
  ^+  cor
  %+  roll  ~(tap by hitches.state)
  |=  [[hid=hitch-id:h hit=hitch:h] co=_cor]
  ?.  (hitch-matches:hk hit event)
    co
  ?~  trig=(matching-trigger triggers.hit event)
    co
  (dispatch-hitch:co hid u.trig body.event [%run ~])
++  matching-trigger
  |=  [trigs=(list trigger:h) event=firehose-event:h]
  ^-  (unit trigger:h)
  ?~  trigs
    ~
  ?.  (trigger-matches:hk i.trigs event)
    $(trigs t.trigs)
  `i.trigs
++  dispatch-manual-run
  |=  [hid=hitch-id:h kind=pending-kind:h event=vase]
  ^+  cor
  =/  trig=trigger:h  [%command `%manual]
  (dispatch-hitch hid trig event kind)
++  dispatch-chain
  |=  [rid=req-id:h caller=term hids=(list hitch-id:h) event=vase]
  ^+  cor
  ?~  hids
    cor
  (dispatch-hitch i.hids [%command `%chain] event [%chain rid caller t.hids event])
++  dispatch-hitch
  |=  [hid=hitch-id:h trig=trigger:h event=vase kind=pending-kind:h]
  ^+  cor
  ?~  hit=(~(get by hitches.state) hid)
    cor
  ?~  def=(~(get by hooks.state) hook-id.u.hit)
    cor
  =/  rid  fresh-run-id
  =/  run=run-log:h
    :*  rid
        hid
        now.bowl
        ~
        trig
        event
        %running
        ~
        ~
    ==
  =.  runs.state  (~(put by runs.state) rid run)
  =.  pending.state
    (~(put by pending.state) rid [rid hid trig now.bowl kind])
  =.  cor  notify-runs
  ?~  compiled.u.def
    ::  hook failed to compile, mark run as crashed immediately
    =/  output=hook-output:h
      [[%error 'hook not compiled' ~] !>(~) ~]
    (complete-run rid [rid hid trig now.bowl kind] run output &)
  ::  build inline strand from cached compiled gate, run via %lard
  ::  this avoids recompiling the hook source on every execution
  =/  gate  [p.u.compiled.u.def .*(q:hk-subject:hk q.u.compiled.u.def)]
  =/  =shed:khan
    =/  m  (strand:rand ,vase)
    ^-  form:m
    %-  pure:m
    (slam gate !>([event config.u.hit state.u.hit]))
  (emit %pass /run/(scot %uv rid) %arvo %k %lard q.byk.bowl shed)
++  fresh-run-id
  ^-  run-id:h
  =/  base=run-id:h  (end 7 eny.bowl)
  |-
  ?:  |((~(has by runs.state) base) (~(has by pending.state) base))
    $(base +(base))
  base
++  arvo
  |=  [=(pole knot) =sign-arvo]
  ^+  cor
  ?+  pole  cor
      [%run rid=@ ~]
    (finish-run (slav %uv rid.pole) sign-arvo)
      [%cron hid=@ name=@ ~]
    (dispatch-hitch (slav %uv hid.pole) [%cron `(slav %tas name.pole)] !>(~) [%run ~])
  ==
++  finish-run
  |=  [rid=run-id:h =sign-arvo]
  ^+  cor
  ?~  pending-run=(~(get by pending.state) rid)
    cor
  ?~  run=(~(get by runs.state) rid)
    cor
  ?>  ?=([%khan %arow *] sign-arvo)
  =/  =(avow:khan cage)  p.sign-arvo
  ?:  ?=(%| -.avow)
    =/  output=hook-output:h
      [[%error 'thread crashed' `p.avow] !>(~) ~]
    (complete-run rid u.pending-run u.run output &)
  =/  output=hook-output:h  !<(=hook-output:h q.p.avow)
  (complete-run rid u.pending-run u.run output |)
++  response-path
  |=  [caller=term rid=req-id:h]
  ^-  path
  /v1/response/(scot %tas caller)/(scot %uv rid)
++  runs-for-hitch
  |=  hid=hitch-id:h
  ^-  (map run-id:h run-log:h)
  %+  roll  ~(tap by runs.state)
  |=  [[rid=run-id:h run=run-log:h] acc=(map run-id:h run-log:h)]
  ?:  =(hid hitch-id.run)
    (~(put by acc) rid run)
  acc
++  prune-hitch-runs
  |=  hid=hitch-id:h
  ^+  cor
  =/  ordered=(list [run-id:h run-log:h])
    %+  sort
      %+  skim  ~(tap by runs.state)
      |=  [rid=run-id:h run=run-log:h]
      =(hid hitch-id.run)
    |=  [[* a=run-log:h] [* b=run-log:h]]
    (gth started-at.a started-at.b)
  =/  extras=(list [run-id:h run-log:h])
    (slag max-runs-per-hitch.limits.state ordered)
  =.  runs.state
    %+  roll  extras
    |=  [[rid=run-id:h *] acc=(map run-id:h run-log:h)]
    (~(del by acc) rid)
  cor
++  complete-run
  |=  [rid=run-id:h pending-run=pending-run:h run=run-log:h output=hook-output:h crashed=?]
  ^+  cor
  =/  final=run-log:h
    run(status ?:(crashed %crashed %done), ended-at `now.bowl, output `output, logs (limit-logs:hk limits.state logs.output))
  =.  runs.state  (~(put by runs.state) rid final)
  =.  pending.state  (~(del by pending.state) rid)
  =.  cor  (prune-hitch-runs hitch-id.pending-run)
  =.  cor  notify-runs
  =/  hid=hitch-id:h  hitch-id.pending-run
  ?:  =(%test -.kind.pending-run)
    cor
  ?~  hit=(~(get by hitches.state) hid)
    cor
  =.  hitches.state
    (~(put by hitches.state) hid u.hit(state state.output))
  =.  cor  notify-hitches
  ?-  -.kind.pending-run
    %run
      ?~  req-id.kind.pending-run
        cor
      (give %fact ~[(response-path %hooks u.req-id.kind.pending-run)] %noun !>(`invocation-response:h`[%run final]))
    %test
      cor
    %chain
      ?-  -.result.output
        %error
          (give %fact ~[(response-path caller.kind.pending-run req-id.kind.pending-run)] %noun !>(`invocation-response:h`[%chain req-id.kind.pending-run result.output]))
        %success
          =/  next-event=vase  ?~(out.result.output event.kind.pending-run u.out.result.output)
          ?~  remaining.kind.pending-run
            (give %fact ~[(response-path caller.kind.pending-run req-id.kind.pending-run)] %noun !>(`invocation-response:h`[%chain req-id.kind.pending-run result.output]))
          (dispatch-hitch i.remaining.kind.pending-run [%command `%chain] next-event [%chain req-id.kind.pending-run caller.kind.pending-run t.remaining.kind.pending-run next-event])
      ==
  ==
++  recover-orphaned-runs
  ^+  cor
  %+  roll  ~(tap by pending.state)
  |=  [[rid=run-id:h pending-run=pending-run:h] co=_cor]
  ?~  run=(~(get by runs.state.co) rid)
    co
  =/  output=hook-output:h
    [[%error 'run orphaned by restart' ~] !>(~) ~]
  =.  runs.state.co
    (~(put by runs.state.co) rid u.run(status %crashed, ended-at `now.bowl, output `output, logs ~))
  =.  pending.state.co  (~(del by pending.state.co) rid)
  (prune-hitch-runs:co hitch-id.pending-run)
++  notify-hooks
  ^+  cor
  =.  cor  (give %fact ~[/v1] %noun !>(state))
  (give %fact ~[/v1/hooks] %noun !>(hooks.state))
++  notify-hitches
  ^+  cor
  =.  cor  (give %fact ~[/v1] %noun !>(state))
  (give %fact ~[/v1/hitches] %noun !>(hitches.state))
++  notify-runs
  ^+  cor
  =.  cor  (give %fact ~[/v1] %noun !>(state))
  (give %fact ~[/v1/runs] %noun !>(runs.state))
--

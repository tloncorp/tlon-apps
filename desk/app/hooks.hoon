/-  h=hooks
/+  default-agent, hk=hooks
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
      abet:(init:cor)
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
  [%0 *(map hook-id:h hook-def:h) *(map hitch-id:h hitch:h) *(map run-id:h run-log:h) *(map run-id:h pending-run:h) *(map firehose-source:h firehose-sub:h) [100 50 1.024]]
++  load
  |=  old=vase
  ^+  cor
  =.  state  !<(=hook-state-0:h old)
  start-watches
++  init
  ^+  cor
  =.  state  init-state
  start-watches
++  start-watches
  ^+  cor
  =.  cor  (watch-firehose %channels /firehose/channels [our.bowl %channels-server] /v1/all)
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
    (~(put by firehoses.state) source [source path |])
  (safe-watch wire dock path)
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?>  =(mark %noun)
  =+  !<(=hook-action:h vase)
  ?-  -.action
    %add-hook
      =.  hooks.state  (~(put by hooks.state) id.hook.action hook.action)
      (notify-hooks)
    %remove-hook
      =.  hooks.state  (~(del by hooks.state) id.action)
      (notify-hooks)
    %update-hook
      =.  hooks.state  (~(put by hooks.state) id.action hook.action)
      (notify-hooks)
    %add-hitch
      =.  hitches.state  (~(put by hitches.state) id.hitch.action hitch.action)
      (notify-hitches)
    %remove-hitch
      =.  hitches.state  (~(del by hitches.state) id.action)
      (notify-hitches)
    %update-hitch
      ?~  hit=(~(get by hitches.state) id.action)
        cor
      =.  hitches.state
        (~(put by hitches.state) id.action (apply-hitch-patch:hk u.hit patch.action))
      (notify-hitches)
    %enable-hitch
      (set-hitch-enabled id.action &)
    %disable-hitch
      (set-hitch-enabled id.action |)
    %run
      (dispatch-manual-run id.action [%run `req-id.action] ?~(args.action !>(~) u.args.action))
    %run-chain
      (dispatch-chain req-id.action hitches.action event.action)
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
  (notify-hitches)
++  watch
  |=  =(pole knot)
  ^+  cor
  ?+  pole  cor
      [%hooks ~]
    (give %fact ~ %noun !>(hooks.state))
      [%hitches ~]
    (give %fact ~ %noun !>(hitches.state))
      [%runs ~]
    (give %fact ~ %noun !>(runs.state))
      [%v1 ~]
    (give %fact ~ %noun !>(state))
      [%v1 %runs hitch=@ ~]
    (give %fact ~ %noun !>(runs.state))
      [%v1 %response term=@ rid=@ ~]
    cor
  ==
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+  pole  [~ ~]
      [%x %hooks ~]
    ``noun+!>(hooks.state)
      [%x %hitches ~]
    ``noun+!>(hitches.state)
      [%x %runs ~]
    ``noun+!>(runs.state)
      [%x %state ~]
    ``noun+!>(state)
  ==
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+  pole  cor
      [%firehose %channels ~]
    ?-  -.sign
      %watch-ack  cor
      %kick
        (rewatch %channels)
      %fact
        (ingest-firehose %channels q.sign)
      ==
      [%firehose %groups ~]
    ?-  -.sign
      %watch-ack  cor
      %kick
        (rewatch %groups)
      %fact
        (ingest-firehose %groups q.sign)
      ==
  ==
++  rewatch
  |=  source=firehose-source:h
  ^+  cor
  ?~  sub=(~(get by firehoses.state) source)
    cor
  =/  dock
    ?-  source
      %channels  [our.bowl %channels-server]
      %groups  [our.bowl %groups]
      %contacts  [our.bowl %contacts]
      %activity  [our.bowl %activity]
      %cron  [our.bowl %hooks]
      %webhook  [our.bowl %hooks]
      %command  [our.bowl %hooks]
    ==
  (safe-watch path.sub dock path.sub)
++  ingest-firehose
  |=  [source=firehose-source:h =cage]
  ^+  cor
  =/  event=firehose-event:h
    [source p.cage ~ q.cage now.bowl]
  (dispatch-firehose event)
++  dispatch-firehose
  |=  event=firehose-event:h
  ^+  cor
  %+  roll  ~(tap by hitches.state)
  |=  [[hid=hitch-id:h hit=hitch:h] cor=_cor]
  ?~  trig=(matching-trigger triggers.hit event)
    cor
  (dispatch-hitch hid u.trig body.event [%run ~])
++  matching-trigger
  |=  [trigs=(list trigger:h) event=firehose-event:h]
  ^-  (unit trigger:h)
  ?~  trigs
    ~
  ?:(trigger-matches:hk i.trigs event `i.trigs $(trigs t.trigs))
++  dispatch-manual-run
  |=  [hid=hitch-id:h kind=pending-kind:h event=vase]
  ^+  cor
  =/  trig=trigger:h  [%command `%manual]
  (dispatch-hitch hid trig event kind)
++  dispatch-chain
  |=  [rid=req-id:h hids=(list hitch-id:h) event=vase]
  ^+  cor
  ?~  hids
    cor
  (dispatch-hitch i.hids [%command `%chain] event [%chain rid %hooks t.hids event])
++  dispatch-hitch
  |=  [hid=hitch-id:h trig=trigger:h event=vase kind=pending-kind:h]
  ^+  cor
  ?~  hit=(~(get by hitches.state) hid)
    cor
  ?~  def=(~(get by hooks.state) hook-id.u.hit)
    cor
  =/  rid=run-id:h  (fresh-run-id)
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
  =.  cor  (notify-runs)
  =/  input=thread-input:h
    [event config.u.hit state.u.hit def hid]
  =/  fard=(fyrd:khan cage)
    [q.byk.bowl %hooks-run %noun !>(input)]
  (emit %pass /run/(scot %uv rid) %arvo %k %fard fard)
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
    (complete-run rid u.pending-run u.run output)
  =/  =cage  p.avow
  =/  output=hook-output:h  !<(=hook-output:h q.cage)
  (complete-run rid u.pending-run u.run output)
++  complete-run
  |=  [rid=run-id:h pending-run=pending-run:h run=run-log:h output=hook-output:h]
  ^+  cor
  =/  final=run-log:h
    run(status ?:(?=(%error -.result.output) %crashed %done), ended-at `now.bowl, output `output, logs (limit-logs:hk limits.state logs.output))
  =.  runs.state  (~(put by runs.state) rid final)
  =.  pending.state  (~(del by pending.state) rid)
  =.  cor  (notify-runs)
  =/  hid=hitch-id:h  hitch-id.pending-run
  ?:  =(%test -.kind.pending-run)
    cor
  ?~  hit=(~(get by hitches.state) hid)
    cor
  =.  hitches.state
    (~(put by hitches.state) hid u.hit(state state.output))
  =.  cor  (notify-hitches)
  ?-  -.kind.pending-run
    %run
      ?~  req-id.kind.pending-run
        cor
      (give %fact ~[/v1/response/hooks/(scot %uv u.req-id.kind.pending-run)] %noun !>(`invocation-response:h`[%run final]))
    %test
      cor
    %chain
      ?-  -.result.output
        %error
          (give %fact ~[/v1/response/(scot %tas caller.kind.pending-run)/(scot %uv req-id.kind.pending-run)] %noun !>(`invocation-response:h`[%chain req-id.kind.pending-run result.output]))
        %success
          =/  next-event=vase  ?~(out.result.output event.kind.pending-run u.out.result.output)
          ?~  remaining.kind.pending-run
            (give %fact ~[/v1/response/(scot %tas caller.kind.pending-run)/(scot %uv req-id.kind.pending-run)] %noun !>(`invocation-response:h`[%chain req-id.kind.pending-run result.output]))
          (dispatch-hitch i.remaining.kind.pending-run [%command `%chain] next-event [%chain req-id.kind.pending-run caller.kind.pending-run t.remaining.kind.pending-run next-event])
      ==
  ==
++  notify-hooks
  ^+  cor
  (give %fact ~[/hooks /v1] %noun !>(hooks.state))
++  notify-hitches
  ^+  cor
  (give %fact ~[/hitches /v1] %noun !>(hitches.state))
++  notify-runs
  ^+  cor
  (give %fact ~[/runs /v1] %noun !>(runs.state))
--

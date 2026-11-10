::  Two heads; emitted provider/network cards never leave the fixture.
::  Each step boots the agent from saved state on the ship it plays, with a
::  fresh bowl, so ~zod's and ~nec's heads share nothing but what a test
::  hands between them. Optional live bindings are absent: scries answer %.n.
/-  h=harness, w=harness-workspace, adapter=harness-adapter, *harness-store
/+  *test, *test-agent, rpc=harness-peer-rpc, defaults=harness-defaults, work=harness-workspace,
    hl=harness, effects=harness-effects
/=  head  /app/harness
|%
++  t0  ~2026.9.14
++  boot
  |=  [saved=state-0 our=@p src=@p now=@da]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (set-bowl %*(. *bowl our our, src src, dap %harness, now now))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  *  bind:m  (do-load head `!>(saved))
  (pure:m ~)
::
++  saved
  =/  m  (mare ,state-0)
  ^-  form:m
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-0 vase))
::
++  fixture
  |=  other=@p
  ^-  state-0
  =/  saved=state-0  *state-0
  =.  saved  saved(defaults builtin-config:defaults, local-mcp-seen 1, welcome-seen 1)
  =.  provider-keys.saved  (my ~[['openai-device' 'fixture-subscription']])
  =.  peers.saved  (my ~[[other [~[%workspace %peers] ~ 0 ~]]])
  =/  created
    %:  apply:work
      workspace.saved
      [& [0v0 'Owner'] 0v0]
      [%task-create 'task' '' 'A bounded part of the goal' 'Return a checked result.']
      ~2026.9.14
    ==
  ?>  ?=(%& -.created)
  saved(workspace p.created)
::  Bodies of the session's completed tool calls, oldest last.
::
++  tool-replies
  |=  [st=state-0 sid=@t]
  ^-  (list @t)
  %+  murn  log:(~(got by sessions.st) sid)
  |=(e=event:h ?:(?=(%tool-completed -.e) `body.e ~))
::
++  has
  |=  [hay=@t needle=tape]
  ^-  ?
  ?=(^ (find needle (trip hay)))
::
++  test-peer-context-identifies-the-authenticated-home-and-local-boundary
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (boot (fixture ~nec) ~zod ~nec t0)
  ;<  *  bind:m
    %+  do-poke  %harness-a2a-0
    !>(`a2a:h`[%ask 0v1 %text 'Complete the supplied home task.'])
  ;<  next=state-0  bind:m  saved
  =/  v  (play:hl log:(~(got by sessions.next) 'peer--~nec'))
  =/  missing
    %+  skip
      ^-  (list @t)
      :~  'running on ~zod'  'authenticated request from ~nec'  'Workspace records are ship-local'
          'call_peer_tool'  'current id and version'  'without changing trust'
      ==
    |=(part=@t (has system.config.v (trip part)))
  (ex-equal !>(missing) !>(*(list @t)))
++  test-active-peer-work-rejects-overlap-and-deduplicates-the-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (boot (fixture ~nec) ~zod ~nec t0)
  ;<  *  bind:m
    (do-poke %harness-a2a-0 !>(`a2a:h`[%ask 0v1 %text 'Finish this task.']))
  ;<  before=state-0  bind:m  saved
  ;<  duplicate=(list card)  bind:m
    (do-poke %harness-a2a-0 !>(`a2a:h`[%ask 0v1 %text 'Finish this task.']))
  ;<  repeated=state-0  bind:m  saved
  ;<  overlap=(list card)  bind:m
    %+  do-poke  %harness-a2a-0
    !>(`a2a:h`[%ask 0v2 %text 'Another assignment must not replace active work.'])
  ;<  rejected=state-0  bind:m  saved
  ;<  ~  bind:m  (ex-equal !>(sessions.repeated) !>(sessions.before))
  ;<  ~  bind:m  (ex-equal !>(sessions.rejected) !>(sessions.before))
  ;<  ~  bind:m  (ex-equal !>(serving.rejected) !>(serving.before))
  ;<  ~  bind:m  (ex-cards duplicate ~)
  ::  Only the count is pinned: one rejection, whatever its shape.
  (ex-equal !>((lent overlap)) !>(1))
++  test-peer-failure-replies-do-not-forward-private-provider-details
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  (fixture ~nec)
  =/  cfg  defaults.saved
  =/  admission=admitted-input:h
    :*  0v1  [%peer ~nec 0v1]  `~nec  `[%peer ~nec 0v1]  ~2026.9.14
        [%user 'Check the assigned work']
    ==
  =.  sessions.saved
    %-  my
    :~  :*  'peer--~nec'
            :*  :~  [%llm-failed 0 'provider error: overloaded_error SYNTHETIC_SECRET']
                    [%llm-requested 0 %turn]
                    [%input-received admission]
                    [%config-replaced cfg]
                ==
                1
            ==
        ==
    ==
  =.  serving.saved  (my ~[['peer--~nec' ~[[~nec 0v1]]]])
  ;<  ~  bind:m  (boot saved ~zod ~zod t0)
  ;<  caz=(list card)  bind:m
    (do-poke %harness-action !>(`action:h`[%config 'peer--~nec' cfg ~s30]))
  ::  The failure answers poked back to the peer, among the other cards.
  =/  replies
    %+  murn  caz
    |=  =card
    ^-  (unit @t)
    ?.  ?=([%pass * %agent * %poke %harness-a2a-0 *] card)  ~
    =/  msg  !<(a2a:h +.+.+.+.+.+.card)
    ?.  ?=([%answer * [%| *]] msg)  ~
    `p.result.msg
  ;<  ~  bind:m  (ex-equal !>(=(~ replies)) !>(|))
  ?>  ?=(^ replies)
  ;<  ~  bind:m  (ex-equal !>((has i.replies "SYNTHETIC_SECRET")) !>(|))
  (ex-equal !>((has i.replies "temporarily unavailable")) !>(&))
::  Pure checks of the effect executor; no agent involved.
::
++  call
  |=  [action=@t args=@t]
  (en:json:html (pairs:enjs:format ~[['action' %s action] ['args' (need (de:json:html args))]]))
++  test-peer-call-encodes-an-object-once-and-rejects-invalid-shapes
  =/  =bowl:gall  *bowl:gall
  =/  executor  ~(. effects [bowl ~])
  =/  invoke
    |=  raw=@t
    (peer-rpc-card:executor 'source' 1 ['call' 'call_peer_tool' raw])
  =/  valid  (invoke '{"ship":"~nec","name":"workspace","arguments":{"action":"help","args":{}}}')
  ?>  ?=(^ valid)
  ?>  ?=([%pass * %agent * %poke * *] u.valid)
  =/  effect  !<(effect:h +.+.+.+.+.+.u.valid)
  ?>  ?=(%peer-rpc -.act.effect)
  ;:  weld
      %+  expect-eq
        !>((need (de:json:html '{"action":"help","args":{}}')))
      !>((need (de:json:html args.act.effect)))
      (expect-eq !>(~) !>((invoke 'not-json')))
      (expect-eq !>(~) !>((invoke '{"ship":"~nec","name":"workspace"}')))
      (expect-eq !>(~) !>((invoke '{"ship":"~nec","name":"workspace","arguments":"{}"}')))
      (expect-eq !>(~) !>((invoke '{"ship":"~nec","name":"workspace","arguments":[]}')))
  ==
++  test-tracked-ask-carries-the-authenticated-home-reference
  =/  =bowl:gall  *bowl:gall
  =.  bowl  bowl(our ~zod)
  =/  executor  ~(. effects [bowl ~])
  =/  invoke
    |=  raw=@t
    (ask-peer-card:executor 'source' 1 ['call' 'ask_peer' raw])
  =/  linked  (invoke '{"ship":"~nec","prompt":"Verify the result","task":"task-1"}')
  ?>  ?=(^ linked)
  ?>  ?=([%pass * %agent * %poke * *] u.linked)
  =/  effect  !<(effect:h +.+.+.+.+.+.u.linked)
  ?>  ?=(%ask-peer -.act.effect)
  =/  plain  (invoke '{"ship":"~nec","prompt":"Check the weather"}')
  ?>  ?=(^ plain)
  ?>  ?=([%pass * %agent * %poke * *] u.plain)
  =/  plain-effect  !<(effect:h +.+.+.+.+.+.u.plain)
  ?>  ?=(%ask-peer -.act.plain-effect)
  ;:  weld
      (expect-eq !>(~nec) !>(ship.act.effect))
      (expect !>(?=(^ (find (trip '"home":"~zod"') (trip prompt.act.effect)))))
      (expect !>(?=(^ (find (trip '"id":"task-1"') (trip prompt.act.effect)))))
      (expect !>(?=(^ (find "Verify the result" (trip prompt.act.effect)))))
      (expect-eq !>('Check the weather') !>(prompt.act.plain-effect))
      (expect-eq !>(~) !>((invoke '{"ship":"~nec","prompt":"Check","task":null}')))
      (expect-eq !>(~) !>((invoke '{"ship":"~nec","prompt":"Check","task":42}')))
      (expect-eq !>(~) !>((invoke '{"ship":"~nec","prompt":"Check","task":""}')))
  ==
::  Deliver one direct workspace request from .source to the head on .our,
::  then run the admitted tool call as the owner after a reload.
++  receive
  |=  [saved=state-0 our=@p source=@p id=@uv action=@t args=@t revoke=?]
  =/  m  (mare ,state-0)
  ^-  form:m
  ;<  ~  bind:m  (boot saved our source t0)
  =/  arguments  (call action args)
  ;<  *  bind:m
    (do-poke %harness-rpc-0 !>(`peer-rpc:h`[%invoke id t0 'workspace' arguments]))
  ;<  pending=state-0  bind:m  ^saved
  =/  sid  (cat 3 'peer-tool--' (scot %p source))
  ?.  (~(has by peer-active.pending) sid)  (pure:m pending)
  =?  pending  revoke  pending(peers ~)
  ;<  ~  bind:m  (set-src our)
  ;<  *  bind:m  (do-load head `!>(pending))
  =/  req=tool-request:adapter
    :*  sid  next-req:(~(got by sessions.pending) sid)
        [(call-id:rpc id t0) 'workspace' arguments]
    ==
  ;<  *  bind:m  (do-poke %harness-tool !>(req))
  ^saved
++  test-trusted-peers-claim-and-complete-home-tasks-in-both-directions
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  a=state-0  bind:m
    %:  receive
      (fixture ~nec)
      ~zod
      ~nec
      0v1
      'task-claim'
      '{"id":"task","version":1}'
      |
    ==
  ;<  b=state-0  bind:m
    %:  receive
      (fixture ~zod)
      ~nec
      ~zod
      0v2
      'task-claim'
      '{"id":"task","version":1}'
      |
    ==
  ;<  done=state-0  bind:m
    %:  receive
      a
      ~zod
      ~nec
      0v3
      'task-update'
      '{"id":"task","version":2,"status":"done","outcome":"Checked result"}'
      |
    ==
  ;<  denied=state-0  bind:m
    %:  receive
      b
      ~nec
      ~zod
      0v4
      'task-update'
      '{"id":"task","version":2,"status":"done"}'
      &
    ==
  =/  first  (~(got by tasks.workspace.a) 'task')
  =/  second  (~(got by tasks.workspace.b) 'task')
  ;<  ~  bind:m  (ex-equal !>(status.first) !>(%claimed))
  ;<  ~  bind:m  (ex-equal !>(status.second) !>(%claimed))
  ;<  ~  bind:m  (ex-equal !>(label:(need claimant.first)) !>('Agent on ~nec'))
  ;<  ~  bind:m  (ex-equal !>(label:(need claimant.second)) !>('Agent on ~zod'))
  ;<  ~  bind:m  (ex-equal !>(status:(~(got by tasks.workspace.done) 'task')) !>(%done))
  ;<  ~  bind:m
    %+  ex-equal
      !>(outcome:(~(got by tasks.workspace.done) 'task'))
    !>('Checked result')
  ;<  ~  bind:m  (ex-equal !>(tasks.workspace.denied) !>(tasks.workspace.b))
  ;<  ~  bind:m  (ex-equal !>(projects.workspace.done) !>(~))
  (ex-equal !>(requests.work-controls.done) !>(~))
++  test-malformed-work-arguments-give-an-actionable-shape-without-writing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  (fixture ~nec)
  ;<  next=state-0  bind:m  (receive saved ~zod ~nec 0v1 'task' '"not-an-object"' |)
  =/  replies  (tool-replies next 'peer-tool--~nec')
  ;<  ~  bind:m  (ex-equal !>(=(~ replies)) !>(|))
  ?>  ?=(^ replies)
  ;<  ~  bind:m  (ex-equal !>(workspace.next) !>(workspace.saved))
  ;<  ~  bind:m  (ex-equal !>((has i.replies "top-level action")) !>(&))
  (ex-equal !>((has i.replies (trip '{"action":"help","args":{}}'))) !>(&))
::
++  test-direct-request-replay-keeps-its-receipt-and-cannot-change-the-work
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  first=state-0  bind:m
    %:  receive
      (fixture ~nec)
      ~zod
      ~nec
      0v1
      'task-claim'
      '{"id":"task","version":1}'
      |
    ==
  ;<  repeated=state-0  bind:m
    %:  receive
      first
      ~zod
      ~nec
      0v1
      'task-claim'
      '{"id":"task","version":1}'
      |
    ==
  ;<  changed=state-0  bind:m
    %:  receive
      first
      ~zod
      ~nec
      0v1
      'task-update'
      '{"id":"task","version":2,"status":"done"}'
      |
    ==
  ;<  ~  bind:m  (ex-equal !>(workspace.repeated) !>(workspace.first))
  ;<  ~  bind:m  (ex-equal !>(workspace.changed) !>(workspace.first))
  ;<  ~  bind:m  (ex-equal !>(sessions.repeated) !>(sessions.first))
  ;<  ~  bind:m  (ex-equal !>(sessions.changed) !>(sessions.first))
  ;<  ~  bind:m  (ex-equal !>(peer-receipts.repeated) !>(peer-receipts.first))
  (ex-equal !>(peer-receipts.changed) !>(peer-receipts.first))
::  Run one peer effect from a coordinator session waiting on that tool call.
::
++  outgoing
  |=  [saved=state-0 name=@t args=@t act=action:h]
  =/  m  (mare ,state-0)
  ^-  form:m
  =/  cfg  defaults.saved(tools ~[%peers])
  =/  call=tool-call:h  ['call' name args]
  =.  sessions.saved
    %-  my
    :~  :*  'coordinator'
            :*  :~  [%tool-requested-2 1 'call' name]
                    [%llm-completed 0 %tool-calls [1 1] [%assistant '' ~[call]]]
                    [%input-received [0v1 [%poke ~zod] `~zod ~ t0 [%user 'Pursue the goal']]]
                    [%config-replaced cfg]
                ==
                1
            ==
        ==
    ==
  ;<  ~  bind:m  (boot saved ~zod ~zod t0)
  ;<  *  bind:m  (do-poke %harness-effect !>(`effect:h`[1 act]))
  ^saved
++  test-outgoing-work-needs-reciprocal-grants-but-discovery-does-not
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  trusted  (fixture ~nec)
  =/  untrusted  trusted(peers ~)
  =/  plain  trusted(peers (my ~[[~nec [~ ~ 0 ~]]]))
  =/  args  '{"ship":"~nec","name":"workspace","arguments":{}}'
  =/  act=action:h  [%peer-rpc 'coordinator' 'call' ~nec `'workspace' '{}']
  ;<  allowed=state-0  bind:m  (outgoing trusted 'call_peer_tool' args act)
  ;<  denied=state-0  bind:m  (outgoing untrusted 'call_peer_tool' args act)
  ;<  no-work=state-0  bind:m  (outgoing plain 'call_peer_tool' args act)
  ;<  discovered=state-0  bind:m
    %:  outgoing
      untrusted
      'list_peer_tools'
      '{"ship":"~nec"}'
      [%peer-rpc 'coordinator' 'call' ~nec ~ '{}']
    ==
  ;<  no-ask=state-0  bind:m
    %:  outgoing
      untrusted
      'ask_peer'
      '{"ship":"~nec","prompt":"Do this work"}'
      [%ask-peer 'coordinator' 'call' ~nec 'Do this work']
    ==
  ;<  ~  bind:m  (ex-equal !>(~(wyt by asks.allowed)) !>(1))
  ;<  ~  bind:m  (ex-equal !>(asks.denied) !>(~))
  ;<  ~  bind:m  (ex-equal !>(asks.no-work) !>(~))
  ;<  ~  bind:m  (ex-equal !>(~(wyt by asks.discovered)) !>(1))
  ;<  ~  bind:m  (ex-equal !>(asks.no-ask) !>(~))
  %+  ex-equal
    !>((lien log:(~(got by sessions.denied) 'coordinator') |=(e=event:h ?=(%tool-completed -.e))))
  !>(&)
::  A result for an outstanding peer call arrives from ~nec after ~nec's grant
::  was revoked.
++  revoked-result
  |=  name=@t
  =/  m  (mare ,~)
  ^-  form:m
  =/  args
    '{"ship":"~nec","name":"workspace","arguments":{},"prompt":"Do this work"}'
  =/  =action:h
    ?:  =('ask_peer' name)  [%ask-peer 'coordinator' 'call' ~nec 'Do this work']
    [%peer-rpc 'coordinator' 'call' ~nec ?:(=('list_peer_tools' name) ~ `'workspace') '{}']
  ;<  pending=state-0  bind:m  (outgoing (fixture ~nec) name args action)
  =/  rows  ~(tap by asks.pending)
  ;<  ~  bind:m  (ex-equal !>(=(~ rows)) !>(|))
  ?>  ?=(^ rows)
  =/  id  p.i.rows
  =.  peers.pending  ~
  ;<  ~  bind:m  (boot pending ~zod ~nec t0)
  ;<  *  bind:m
    ?:  =('ask_peer' name)
      (do-poke %harness-a2a-0 !>(`a2a:h`[%answer id [%& 'Remote response']]))
    (do-poke %harness-rpc-0 !>(`peer-rpc:h`[%result id [%& 'Remote response']]))
  ;<  settled=state-0  bind:m  saved
  =/  replies  (tool-replies settled 'coordinator')
  ;<  ~  bind:m  (ex-equal !>(=(~ replies)) !>(|))
  ?>  ?=(^ replies)
  ;<  ~  bind:m  (ex-equal !>(asks.settled) !>(~))
  ;<  ~  bind:m  (ex-equal !>(=('Remote response' i.replies)) !>(=('list_peer_tools' name)))
  (ex-equal !>(workspace.settled) !>(workspace.pending))
++  test-revocation-rejects-peer-work-results-without-retrying
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (revoked-result 'ask_peer')
  ;<  ~  bind:m  (revoked-result 'call_peer_tool')
  (revoked-result 'list_peer_tools')
++  test-peer-timeout-preserves-uncertainty-and-never-resends
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  pending=state-0  bind:m
    %:  outgoing
      (fixture ~nec)
      'ask_peer'
      '{"ship":"~nec","prompt":"Do this work"}'
      [%ask-peer 'coordinator' 'call' ~nec 'Do this work']
    ==
  =/  rows  ~(tap by asks.pending)
  ;<  ~  bind:m  (ex-equal !>(=(~ rows)) !>(|))
  ?>  ?=(^ rows)
  =/  id  p.i.rows
  ;<  ~  bind:m  (boot pending ~zod ~zod ~2026.9.14..00.03.00)
  ;<  *  bind:m  (do-arvo `wire`[%a2a-timeout (scot %uv id) ~] [%behn %wake ~])
  ;<  next=state-0  bind:m  saved
  =/  replies  (tool-replies next 'coordinator')
  ;<  ~  bind:m  (ex-equal !>(=(~ replies)) !>(|))
  ?>  ?=(^ replies)
  ;<  ~  bind:m  (ex-equal !>(asks.next) !>(~))
  ;<  ~  bind:m  (ex-equal !>((has i.replies "may still be running")) !>(&))
  ;<  ~  bind:m  (ex-equal !>((has i.replies "Do not resend or reassign")) !>(&))
  (ex-equal !>((has i.replies "Read the home task")) !>(&))
--

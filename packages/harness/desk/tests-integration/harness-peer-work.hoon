::  Two heads; emitted provider/network cards never leave the fixture.
::  Each step boots the agent from saved state on the ship it plays, with a
::  fresh bowl, so ~zod's and ~nec's heads share nothing but what a test
::  hands between them. Optional live bindings are absent: scries answer %.n.
/-  h=harness, w=harness-workspace, adapter=harness-adapter, t=harness-tlon, *harness-store,
    renew=harness-oauth
/+  *test, *test-agent, rpc=harness-peer-rpc, defaults=harness-defaults, work=harness-workspace,
    hl=harness, effects=harness-effects, failure=harness-failure, j=harness-workspace-json
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
  ;<  ~  bind:m  (ex-equal !>((has i.replies "temporarily unavailable")) !>(&))
  %+  ex-equal  !>(i.replies)
  !>((public-message:failure 'provider error: overloaded_error SYNTHETIC_SECRET'))
::  The person-facing halt text invites a retry; a peer's model would spend it
::  on this owner's provider account.
::
++  test-a-peer-ask-stopped-by-the-loop-guard-is-not-invited-to-retry
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  start  (fixture ~nec)
  =/  cfg  defaults.start
  =/  admission=admitted-input:h
    :*  0v1  [%peer ~nec 0v1]  `~nec  `[%peer ~nec 0v1]  t0
        [%user 'Use the tool.']
    ==
  ::  Three refused results and a fourth refused call still open.
  =/  refused  'rejected: tool is not granted for this session'
  =/  events=(list event:h)
    %-  flop
    ^-  (list event:h)
    :~  [%config-replaced cfg]
        [%input-received admission]
        [%llm-requested 0 %turn]
        [%llm-completed 0 %tool-calls [10 2] [%assistant '' ~[['1' 'no_such_tool' '{}']]]]
        [%tool-completed '1' 'no_such_tool' refused]
        [%llm-requested 1 %turn]
        [%llm-completed 1 %tool-calls [10 2] [%assistant '' ~[['2' 'no_such_tool' '{}']]]]
        [%tool-completed '2' 'no_such_tool' refused]
        [%llm-requested 2 %turn]
        [%llm-completed 2 %tool-calls [10 2] [%assistant '' ~[['3' 'no_such_tool' '{}']]]]
        [%tool-completed '3' 'no_such_tool' refused]
        [%llm-requested 3 %turn]
        [%llm-completed 3 %tool-calls [10 2] [%assistant '' ~[['4' 'no_such_tool' '{}']]]]
    ==
  =.  sessions.start  (my ~[['peer--~nec' [events 4]]])
  =.  serving.start  (my ~[['peer--~nec' ~[[~nec 0v1]]]])
  ;<  ~  bind:m  (boot start ~zod ~zod t0)
  ;<  caz=(list card)  bind:m
    (do-poke %harness-action !>(`action:h`[%retry 'peer--~nec']))
  ;<  halted=state-0  bind:m  saved
  =/  log  log:(~(got by sessions.halted) 'peer--~nec')
  ?>  ?=([[%halted *] *] log)
  ;<  ~  bind:m  (ex-equal !>((has reason.i.log "4 tool calls in a row failed")) !>(&))
  ;<  ~  bind:m  (ex-equal !>((guarded:hl reason.i.log)) !>(&))
  =/  answers
    %+  murn  caz
    |=  =card
    ^-  (unit [ship a2a:h])
    ?.  ?=([%pass * %agent [@ %harness] %poke %harness-a2a-0 *] card)  ~
    =/  msg  !<(a2a:h +.+.+.+.+.+.card)
    ?.  ?=(%answer -.msg)  ~
    `[-.-.+.+.+.card msg]
  %+  ex-equal  !>(answers)
  !>  ^-  (list [ship a2a:h])
  ~[[~nec [%answer 0v1 [%| 'Remote work stopped before finishing.']]]]
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
::  Only the owner holds %tlon and %code. The Tlon hand reports ~bus as a
::  trusted ship and ~nec holds an explicit grant; both grants list %tlon and
::  %code, as grants saved before that rule do. ~lux owns the bot unless a
::  test names another owner.
::
++  guest-grants  `(list tool-grant:h)`~[%tlon %code %workspace %peers [%mcp 'kernel-browser']]
++  guest-fixture
  ^-  state-0
  =/  s  (fixture ~nec)
  s(peers (my ~[[~nec [guest-grants ~ 0 ~]]]))
++  trust-boot
  |=  [saved=state-0 src=@p owner=@p]
  (trust-boot-with saved src owner (my ~[[~bus guest-grants]]))
++  trust-boot-with
  |=  [saved=state-0 src=@p owner=@p trusted=(map @p (list tool-grant:h))]
  =/  m  (mare ,~)
  ^-  form:m
  =/  =peer-trust:t  [[& `owner trusted %mentions ~ ~] |]
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src src, dap %harness, now t0))
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ^-  (unit vase)
    ?:  ?=([%gu @ %harness-tlon @ %$ ~] path)  `!>(&)
    ?:  ?=([%gx @ %harness-tlon @ %peer-trust %noun ~] path)  `!>(peer-trust)
    `!>(|)
  ;<  *  bind:m  (do-load head `!>(saved))
  (pure:m ~)
++  holds
  |=  [tools=(list tool-grant:h) grant=tool-grant:h]
  ^-  ?
  (lien tools |=(held=tool-grant:h =(held grant)))
::  Model-backed peer work: the tools a fresh ask's conversation is given,
::  and what the head authorizes for an outstanding call in a conversation
::  saved with the grant's full tool list.
::
++  asked-tools
  |=  [src=@p owner=@p]
  =/  m  (mare ,(list tool-grant:h))
  ^-  form:m
  ;<  ~  bind:m  (trust-boot guest-fixture src owner)
  ;<  *  bind:m  (do-poke %harness-a2a-0 !>(`a2a:h`[%ask 0v1 %text 'Do the work.']))
  ;<  next=state-0  bind:m  saved
  (pure:m tools.config:(play:hl log:(~(got by sessions.next) (cat 3 'peer--' (scot %p src)))))
::  A peer conversation saved with the grant's full tool list and one
::  outstanding call.
++  peer-call
  |=  [src=@p name=@t]
  ^-  state-0
  =/  s  guest-fixture
  =/  sid  (cat 3 'peer--' (scot %p src))
  =/  call=tool-call:h  ['call' name '{}']
  =.  sessions.s
    %+  ~(put by sessions.s)  sid
    :_  1
    :~  [%tool-requested-2 1 'call' name]
        [%llm-completed 0 %tool-calls [1 1] [%assistant '' ~[call]]]
        [%input-received [0v1 [%peer src 0v1] `src `[%peer src 0v1] t0 [%user 'Do the work.']]]
        [%config-replaced defaults.s(tools guest-grants)]
    ==
  s
++  outstanding
  |=  [src=@p owner=@p name=@t]
  =/  m  (mare ,(unit tool-authority:adapter))
  ^-  form:m
  =/  sid  (cat 3 'peer--' (scot %p src))
  ;<  ~  bind:m  (trust-boot (peer-call src name) src owner)
  ;<  ~  bind:m  (set-src ~zod)
  ;<  =cage  bind:m  (got-peek `path`~[%x %tool-call sid '1' %call])
  (pure:m ;;((unit tool-authority:adapter) q.q.cage))
++  ex-peer-work
  |=  [src=@p owner=@p held=?]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  fresh=(list tool-grant:h)  bind:m  (asked-tools src owner)
  ;<  work=(unit tool-authority:adapter)  bind:m  (outstanding src owner 'workspace')
  ;<  tlon=(unit tool-authority:adapter)  bind:m  (outstanding src owner 'tlon')
  =/  granted  ?~(work ~ tools.u.work)
  ;<  ~  bind:m  (ex-equal !>([src (holds fresh %tlon) (holds fresh %code)]) !>([src held held]))
  ;<  ~  bind:m  (ex-equal !>([src (holds fresh %workspace)]) !>([src &]))
  ;<  ~  bind:m  (ex-equal !>([src (holds granted %tlon) (holds granted %code)]) !>([src held held]))
  ;<  ~  bind:m  (ex-equal !>([src (holds granted %workspace)]) !>([src &]))
  (ex-equal !>([src ?=(^ tlon)]) !>([src held]))
++  test-peers-other-than-the-owner-are-not-offered-tlon-or-code-for-peer-work
  %-  eval-mare
  ;<  ~  bind:(mare ,~)  (ex-peer-work ~bus ~lux |)
  (ex-peer-work ~nec ~lux |)
++  test-owner-keeps-tlon-and-code-for-peer-work
  %-  eval-mare
  (ex-peer-work ~nec ~nec &)
::  Peer RPC: discovery, a fresh invocation, and the repeat of an invocation
::  whose receipt completed before this rule.
::
++  rpc-result
  |=  cards=(list card)
  ^-  (unit (each @t @t))
  ?~  cards  ~
  ?.  ?=([%pass * %agent * %poke %harness-rpc-0 *] i.cards)  $(cards t.cards)
  =/  msg  !<(peer-rpc:h +.+.+.+.+.+.i.cards)
  ?.  ?=(%result -.msg)  $(cards t.cards)
  `result.msg
++  rpc-poke
  |=  [saved=state-0 src=@p owner=@p message=peer-rpc:h]
  =/  m  (mare ,[(unit (each @t @t)) state-0])
  ^-  form:m
  ;<  ~  bind:m  (trust-boot saved src owner)
  ;<  caz=(list card)  bind:m  (do-poke %harness-rpc-0 !>(message))
  ;<  next=state-0  bind:m  ^saved
  (pure:m [(rpc-result caz) next])
++  discovered
  |=  [src=@p owner=@p name=@t]
  =/  m  (mare ,?)
  ^-  form:m
  =/  query  (en:json:html (pairs:enjs:format ~[['name' %s name]]))
  ;<  [result=(unit (each @t @t)) *]  bind:m  (rpc-poke guest-fixture src owner [%tools 0v1 query])
  ?>  ?=([~ %& *] result)
  (pure:m (has p.u.result :(weld "\"name\":\"" (trip name) "\"")))
++  completed
  |=  src=@p
  ^-  state-0
  =/  s  guest-fixture
  =/  sid  (cat 3 'peer-tool--' (scot %p src))
  =/  receipts=(list [[@p ask-id:h] peer-receipt:h])
    :~  [[src 0v9] [t0 'tlon' '{}' sid `[%& 'done']]]
        [[src 0v8] [t0 'run_js' '{}' sid `[%& 'ran']]]
    ==
  s(peer-receipts (malt receipts))
++  ex-rpc
  |=  [src=@p owner=@p held=?]
  =/  m  (mare ,~)
  ^-  form:m
  =/  refused  `(unit (each @t @t))``[%| 'tool or resource is not granted to your ship']
  ;<  tlon=?  bind:m  (discovered src owner 'tlon')
  ;<  code=?  bind:m  (discovered src owner 'run_js')
  ;<  work=?  bind:m  (discovered src owner 'workspace')
  ;<  ~  bind:m  (ex-equal !>([src tlon code work]) !>([src held held &]))
  ;<  [fresh=(unit (each @t @t)) a=state-0]  bind:m
    (rpc-poke guest-fixture src owner [%invoke 0v1 t0 'tlon' '{}'])
  ;<  [script=(unit (each @t @t)) b=state-0]  bind:m
    (rpc-poke guest-fixture src owner [%invoke 0v2 t0 'run_js' '{}'])
  ;<  [repeat=(unit (each @t @t)) *]  bind:m
    (rpc-poke (completed src) src owner [%invoke 0v9 t0 'tlon' '{}'])
  ;<  [rerun=(unit (each @t @t)) *]  bind:m
    (rpc-poke (completed src) src owner [%invoke 0v8 t0 'run_js' '{}'])
  ;<  ~  bind:m  (ex-equal !>([src =(refused fresh) =(refused script)]) !>([src !held !held]))
  ;<  ~  bind:m  (ex-equal !>([src (~(has by peer-receipts.a) [src 0v1])]) !>([src held]))
  ;<  ~  bind:m  (ex-equal !>([src (~(has by peer-receipts.b) [src 0v2])]) !>([src held]))
  =/  replayed  `(unit (each @t @t))``[%& 'done']
  =/  reran  `(unit (each @t @t))``[%& 'ran']
  ;<  ~  bind:m  (ex-equal !>([src repeat]) !>([src ?:(held replayed refused)]))
  (ex-equal !>([src rerun]) !>([src ?:(held reran refused)]))
++  test-peers-other-than-the-owner-cannot-discover-invoke-or-replay-tlon-or-code
  %-  eval-mare
  ;<  ~  bind:(mare ,~)  (ex-rpc ~bus ~lux |)
  (ex-rpc ~nec ~lux |)
++  test-owner-discovers-is-admitted-for-and-replays-tlon-and-code-over-rpc
  %-  eval-mare
  (ex-rpc ~nec ~nec &)
::  Announcements match what is enforced. A grant announced before this rule
::  still listed %tlon and %code; the next sync corrects it.
::
++  announced
  |=  [saved=state-0 owner=@p]
  =/  m  (mare ,[sent=(map @p (unit peer-grant:h)) next=state-0])
  ^-  form:m
  ;<  ~  bind:m  (trust-boot saved ~zod owner)
  ;<  caz=(list card)  bind:m  (do-poke %harness-action !>(`action:h`[%peer-refresh ~]))
  ;<  next=state-0  bind:m  ^saved
  =/  sent
    %-  malt
    %+  murn  caz
    |=  =card
    ^-  (unit [@p (unit peer-grant:h)])
    ?.  ?=([%pass [%peer-access %status ~] %agent * %poke %harness-access-0 *] card)  ~
    =/  msg  !<(peer-access-message:h +.+.+.+.+.+.card)
    ?.  ?=(%status -.msg)  ~
    `[;;(@p -.-.+.+.+.card) grant.msg]
  (pure:m [sent next])
++  ex-announced
  |=  [sent=(map @p (unit peer-grant:h)) who=@p held=?]
  =/  m  (mare ,~)
  ^-  form:m
  =/  grant  (~(get by sent) who)
  ?>  ?=([~ ~ *] grant)
  =/  tools  tools.u.u.grant
  ;<  ~  bind:m
    ?:  held  (pure:m ~)
    (ex-equal !>((holds tools [%mcp 'kernel-browser'])) !>(|))
  %+  ex-equal
    !>([who (holds tools %tlon) (holds tools %code)])
  !>([who held held])
++  test-peers-other-than-the-owner-are-announced-grants-without-owner-only-tools
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [sent=(map @p (unit peer-grant:h)) next=state-0]  bind:m  (announced guest-fixture ~lux)
  ;<  ~  bind:m  (ex-announced sent ~bus |)
  ;<  ~  bind:m  (ex-announced sent ~nec |)
  ;<  ~  bind:m  (ex-announced sent ~lux &)
  =/  saved  (~(got by announced-access.next) ~bus)
  (ex-equal !>([(holds tools.saved %tlon) (holds tools.saved %workspace)]) !>([| &]))
++  test-a-grant-announced-before-the-rule-is-corrected-on-the-next-sync
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  guest-fixture
  =.  announced-access.s  (my ~[[~bus [guest-grants ~ 0 ~]] [~nec [guest-grants ~ 0 ~]]])
  ;<  [sent=(map @p (unit peer-grant:h)) *]  bind:m  (announced s ~lux)
  ;<  ~  bind:m  (ex-announced sent ~bus |)
  (ex-announced sent ~nec |)
::  A run_js script that was running when its grant stopped counting still
::  completes when its watchdog fires, so the conversation keeps answering.
::
++  finished-js
  |=  [src=@p owner=@p]
  =/  m  (mare ,[body=(list @t) waiting=?])
  ^-  form:m
  =/  sid  (cat 3 'peer--' (scot %p src))
  =/  s  (peer-call src 'run_js')
  =.  jobs.s  (my ~[[%harness-js-fixture [sid 'call' (add t0 ~s30)]]])
  ;<  ~  bind:m  (trust-boot s ~zod owner)
  ;<  *  bind:m  (do-arvo /jsdog/harness-js-fixture [%behn %wake ~])
  ;<  next=state-0  bind:m  saved
  =/  log  log:(~(got by sessions.next) sid)
  =/  body
    %+  murn  log
    |=(e=event:h ?:(&(?=(%tool-completed -.e) =('call' call-id.e)) `body.e ~))
  (pure:m [body (~(has in wait:(play:hl log)) 'call')])
++  test-a-guests-run-js-that-lost-its-grant-completes-and-does-not-wedge
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [body=(list @t) waiting=?]  bind:m  (finished-js ~bus ~lux)
  (ex-equal !>([body waiting]) !>([~['rejected: run_js is no longer authorized'] |]))
++  test-the-owners-run-js-completes-with-its-result
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [body=(list @t) waiting=?]  bind:m  (finished-js ~nec ~nec)
  (ex-equal !>([body waiting]) !>([~['error: js thread exceeded its time limit'] |]))
::  Peer work addressed to this ship is refused before any request is sent,
::  whoever owns the bot. ~nec's conversation holds %peers and asks for the
::  call; ~bus, a trusted ship, is the granted destination that is sent.
::
++  peer-targets
  |=  cards=(list card)
  ^-  (list @p)
  %+  murn  cards
  |=  =card
  ^-  (unit @p)
  ?.  ?=([%pass * %agent [@ %harness] %poke ?(%harness-rpc-0 %harness-a2a-0) *] card)  ~
  `;;(@p -.-.+.+.+.card)
++  addressed
  |=  [owner=@p to=@p name=@t]
  =/  m  (mare ,[sent=(list @p) asks=@ud answered=?])
  ^-  form:m
  =/  =action:h
    ?:  =('ask_peer' name)  [%ask-peer 'peer--~nec' 'call' to 'Do the work.']
    [%peer-rpc 'peer--~nec' 'call' to `'tlon' '{}']
  ;<  ~  bind:m  (trust-boot (peer-call ~nec name) ~zod owner)
  ;<  caz=(list card)  bind:m  (do-poke %harness-effect !>(`effect:h`[1 action]))
  ;<  next=state-0  bind:m  saved
  =/  answered
    %+  lien  log:(~(got by sessions.next) 'peer--~nec')
    |=(e=event:h &(?=(%tool-completed -.e) =('call' call-id.e)))
  (pure:m [(peer-targets caz) ~(wyt by asks.next) answered])
++  ex-self-addressed
  |=  [owner=@p name=@t]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  control=[sent=(list @p) asks=@ud answered=?]  bind:m  (addressed owner ~bus name)
  ;<  ~  bind:m  (ex-equal !>([owner name control]) !>([owner name [~[~bus] 1 |]]))
  ;<  self=[sent=(list @p) asks=@ud answered=?]  bind:m  (addressed owner ~zod name)
  (ex-equal !>([owner name self]) !>([owner name [~ 0 &]]))
++  test-a-peer-tool-call-addressed-to-this-ship-is-refused
  %-  eval-mare
  ;<  ~  bind:(mare ,~)  (ex-self-addressed ~lux 'call_peer_tool')
  (ex-self-addressed ~zod 'call_peer_tool')
++  test-a-peer-ask-addressed-to-this-ship-is-refused
  %-  eval-mare
  ;<  ~  bind:(mare ,~)  (ex-self-addressed ~lux 'ask_peer')
  (ex-self-addressed ~zod 'ask_peer')
::  A peer request whose authenticated source is this ship is refused and
::  admits no work, whoever owns the bot.
::
++  invoked-from-this-ship
  |=  [owner=@p name=@t]
  =/  m  (mare ,[@t refused=? receipt=?])
  ^-  form:m
  ;<  [result=(unit (each @t @t)) next=state-0]  bind:m
    (rpc-poke guest-fixture ~zod owner [%invoke 0v1 t0 name '{}'])
  =/  refused  =(`[%| 'no grant for your ship'] result)
  (pure:m [name refused (~(has by peer-receipts.next) [~zod 0v1])])
++  ex-from-this-ship
  |=  owner=@p
  =/  m  (mare ,~)
  ^-  form:m
  ;<  admin=[@t ? ?]  bind:m  (invoked-from-this-ship owner 'harness_admin')
  ;<  tlon=[@t ? ?]  bind:m  (invoked-from-this-ship owner 'tlon')
  ;<  code=[@t ? ?]  bind:m  (invoked-from-this-ship owner 'run_js')
  ;<  ~  bind:m  (trust-boot guest-fixture ~zod owner)
  ;<  caz=(list card)  bind:m
    (do-poke %harness-a2a-0 !>(`a2a:h`[%ask 0v2 %text 'Do the work.']))
  ;<  next=state-0  bind:m  saved
  =/  asked  (~(has by sessions.next) 'peer--~zod')
  =/  serving  (~(has by serving.next) 'peer--~zod')
  =/  answers
    %+  murn  caz
    |=  =card
    ^-  (unit [ship a2a:h])
    ?.  ?=([%pass * %agent [@ %harness] %poke %harness-a2a-0 *] card)  ~
    `[;;(@p -.-.+.+.+.card) !<(a2a:h +.+.+.+.+.+.card)]
  ;<  ~  bind:m
    %+  ex-equal
      !>([owner answers])
    !>([owner `(list [ship a2a:h])`~[[~zod [%answer 0v2 [%| 'no grant for your ship']]]]])
  %+  ex-equal
    !>([owner admin tlon code asked serving])
  !>([owner ['harness_admin' & |] ['tlon' & |] ['run_js' & |] | |])
++  test-a-peer-request-from-this-ship-is-refused
  %-  eval-mare
  ;<  ~  bind:(mare ,~)  (ex-from-this-ship ~lux)
  (ex-from-this-ship ~zod)
::  This ship holds no peer grant even when it is listed as a peer or as a
::  Tlon trusted ship. ~nec's conversation calls current_time on .to; ~lux
::  owns the bot.
::
++  timed
  |=  [s=state-0 trusted=(map @p (list tool-grant:h)) to=@p]
  =/  m  (mare ,[sent=(list @p) asks=@ud answered=?])
  ^-  form:m
  =/  =action:h  [%peer-rpc 'peer--~nec' 'call' to `'current_time' '{}']
  ;<  ~  bind:m  (trust-boot-with s ~zod ~lux trusted)
  ;<  caz=(list card)  bind:m  (do-poke %harness-effect !>(`effect:h`[1 action]))
  ;<  next=state-0  bind:m  saved
  =/  answered
    %+  lien  log:(~(got by sessions.next) 'peer--~nec')
    |=(e=event:h &(?=(%tool-completed -.e) =('call' call-id.e)))
  (pure:m [(peer-targets caz) ~(wyt by asks.next) answered])
++  test-this-ship-listed-as-a-peer-or-a-trusted-ship-holds-no-grant
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  (peer-call ~nec 'call_peer_tool')
  =/  listed  s(peers (~(put by peers.s) ~zod [~[%workspace %peers] ~ 0 ~]))
  =/  trusted  (my ~[[~bus guest-grants] [~zod guest-grants]])
  ;<  control=[(list @p) @ud ?]  bind:m  (timed listed trusted ~bus)
  ;<  peer=[(list @p) @ud ?]  bind:m  (timed listed (my ~[[~bus guest-grants]]) ~zod)
  ;<  trust=[(list @p) @ud ?]  bind:m  (timed s trusted ~zod)
  %+  ex-equal
    !>([control peer trust])
  !>([[~[~bus] 1 |] [~ 0 &] [~ 0 &]])
::  A peer input from this ship never answers as the owner, even when this
::  ship is the owner, so a peer conversation stored with such an input gets
::  neither the owner's tools nor the owner's skills on its next request.
::  ~nec, owning the bot and asking it, is the control.
::
++  skill-desc  'Fixture skill shared with owners only'
++  llm-bodies
  |=  cards=(list card)
  ^-  (list @t)
  %+  murn  cards
  |=  c=card
  ^-  (unit @t)
  ?.  ?=([%pass [%llm *] %arvo %i %request *] c)  ~
  =/  sent=http-card:renew  c
  ?~  body.request.sent  ~
  `q.u.body.request.sent
::  The next model request of a peer conversation stored with an unanswered
::  input from .src, driven by a configuration refresh or, with .local, by a
::  plain local prompt.
::
++  next-request
  |=  [src=@p owner=@p local=?]
  =/  m  (mare ,[names=(list @t) body=@t])
  ^-  form:m
  =/  s  guest-fixture
  =/  sid  (cat 3 'peer--' (scot %p src))
  =/  cfg
    %=  defaults.s
      tools  ~[%code %skills %workspace]
      url  'https://openrouter.ai/api/v1/chat/completions'
      key  'fixture-key'
    ==
  =/  input=admitted-input:h
    [0v1 [%peer src 0v1] `src `[%peer src 0v1] t0 [%user 'Do the work.']]
  =.  skills.s  (my ~[['fixture-skill' [skill-desc 'Follow the fixture.']]])
  =.  sessions.s  (my ~[[sid [~[[%input-received input] [%config-replaced cfg]] 1]]])
  =.  serving.s  (my ~[[sid ~[[src 0v1]]]])
  ;<  ~  bind:m  (trust-boot s ~zod owner)
  ;<  caz=(list card)  bind:m
    ?.  local  (do-poke %harness-action !>(`action:h`[%config sid cfg ~s30]))
    (do-poke %harness-action !>(`action:h`[%send sid 'Continue.']))
  =/  bodies  (llm-bodies caz)
  ;<  ~  bind:m  (ex-equal !>([src (lent bodies)]) !>([src 1]))
  ?>  ?=(^ bodies)
  =/  tools  (get:j (need (de:json:html i.bodies)) 'tools')
  =/  names=(list @t)
    ?.  ?=([~ %a *] tools)  ~
    (turn p.u.tools |=(entry=json (string:j (need (get:j entry 'function')) 'name')))
  (pure:m [names i.bodies])
++  owner-held
  |=  [names=(list @t) body=@t]
  ^-  [admin=? code=? skill=?]
  :+  (lien names |=(name=@t =('harness_admin' name)))
    (lien names |=(name=@t =('run_js' name)))
  (has body (trip skill-desc))
++  test-a-peer-input-from-this-ship-never-holds-the-owners-tools
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  owner=[(list @t) @t]  bind:m  (next-request ~nec ~nec |)
  ;<  self=[(list @t) @t]  bind:m  (next-request ~zod ~zod |)
  %+  ex-equal
    !>([(owner-held owner) (owner-held self)])
  !>([[& & &] [| | |]])
++  test-a-peer-conversation-of-this-ship-never-sees-the-owners-skills
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  owner=[(list @t) body=@t]  bind:m  (next-request ~nec ~nec &)
  ;<  self=[(list @t) body=@t]  bind:m  (next-request ~zod ~zod &)
  %+  ex-equal
    !>([(has body.owner (trip skill-desc)) (has body.self (trip skill-desc))])
  !>([& |])
::  A tool listing or access check addressed to this ship is still sent, and
::  is answered with no grant as for any other ship.
::
++  self-poke
  |=  cards=(list card)
  ^-  (list cage)
  %+  murn  cards
  |=  =card
  ^-  (unit cage)
  ?.  ?=([%pass * %agent [@ %harness] %poke *] card)  ~
  ?.  =(~zod -.-.+.+.+.card)  ~
  `+.+.+.+.+.card
++  reported
  |=  [owner=@p name=@t]
  =/  m  (mare ,[@t body=@t asks=@ud])
  ^-  form:m
  =/  =action:h
    ?:  =('check_peer' name)  [%check-peer 'peer--~nec' 'call' ~zod]
    [%peer-rpc 'peer--~nec' 'call' ~zod ~ '{}']
  ;<  ~  bind:m  (trust-boot (peer-call ~nec name) ~zod owner)
  ;<  sent=(list card)  bind:m  (do-poke %harness-effect !>(`effect:h`[1 action]))
  =/  request  (self-poke sent)
  ;<  ~  bind:m  (ex-equal !>([name (lent request)]) !>([name 1]))
  ?>  ?=(^ request)
  ;<  reply=(list card)  bind:m  (do-poke i.request)
  =/  response  (self-poke reply)
  ;<  ~  bind:m  (ex-equal !>([name (lent response)]) !>([name 1]))
  ?>  ?=(^ response)
  ;<  *  bind:m  (do-poke i.response)
  ;<  next=state-0  bind:m  saved
  =/  replies  (tool-replies next 'peer--~nec')
  (pure:m [name ?~(replies '' i.replies) ~(wyt by asks.next)])
++  ex-reported
  |=  owner=@p
  =/  m  (mare ,~)
  ^-  form:m
  ;<  listing=[@t body=@t asks=@ud]  bind:m  (reported owner 'list_peer_tools')
  ;<  check=[@t body=@t asks=@ud]  bind:m  (reported owner 'check_peer')
  %+  ex-equal
    !>([owner listing check(body (has body.check "\"allowed\":false"))])
  !>([owner ['list_peer_tools' 'peer error: no grant for your ship' 0] ['check_peer' & 0]])
++  test-a-listing-or-check-addressed-to-this-ship-reports-no-grant
  %-  eval-mare
  ;<  ~  bind:(mare ,~)  (ex-reported ~lux)
  (ex-reported ~zod)
--

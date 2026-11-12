::  Drive the real head with fixture Iris responses; cards stay local.
/-  h=harness, *harness-store, renew=harness-oauth
/+  *test-agent, policy=harness-defaults, hl=harness, j=harness-provider-wire
/=  head  /app/harness
|%
++  requests
  |=  cards=(list card)
  ^-  (list http-card:renew)
  %+  murn  cards
  |=  c=card
  ^-((unit http-card:renew) ?:(?=([%pass [%llm *] %arvo %i %request *] c) `c ~))
++  fixture
  ^-  state-0
  =/  s  *state-0
  =/  cfg  builtin-config:policy
  =.  cfg
    cfg(url 'https://openrouter.ai/api/v1/chat/completions', model 'fixture', zdr &, tools ~)
  %=  s
    knowledge  knowledge.s(enabled.dreaming.maintenance &, due.dreaming.maintenance `~2026.10.8)
    defaults  cfg
    summary-models  [`cfg(model 'compaction-fixture') `cfg(model 'lcm-fixture')]
    local-mcp-seen  1
    provider-keys  (my ~[['openrouter' 'fixture-key']])
    sessions  %-  my
              ~[['first' [~[[%config-replaced cfg]] 0]] ['second' [~[[%config-replaced cfg]] 0]]]
  ==
++  response
  |=  text=@t
  ^-  client-response:iris
  =/  message  (pairs:enjs:format ~[['role' %s 'assistant'] ['content' %s text]])
  =/  choice  (pairs:enjs:format ~[['message' message] ['finish_reason' %s 'stop']])
  =/  body  (en:json:html (pairs:enjs:format ~[['choices' %a ~[choice]]]))
  [%finished [200 ~] `['application/json' (as-octs:mimes:html body)]]
::  Load saved state on ~zod at ~2026.10.7; every scry answers %.n.
::
++  setup
  |=  saved=state-0
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now ~2026.10.7)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  *  bind:m  (do-load head `!>(saved))
  (pure:m ~)
::
++  get-state
  =/  m  (mare ,state-0)
  ^-  form:m
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-0 vase))
::  Snapshot and restore everything, to branch two calls off one agent.
::
++  get-all
  =/  m  (mare ,state)
  ^-  form:m
  |=(s=state &+[s s])
++  set-all
  |=(s=state (jab-state |=(* s)))
::
++  do-send
  |=  [sid=@t text=@t]
  (do-poke %harness-action !>(`action:h`[%send sid text]))
::
++  do-reply
  |=  [=wire text=@t]
  (do-arvo wire [%iris %http-response (response text)])
::  Send a turn to 'first' and complete its single model request.
::
++  do-turn
  |=  [text=@t answer=@t]
  =/  m  (mare ,[sent=(list card) completed=(list card)])
  ^-  form:m
  ;<  sent=(list card)       bind:m  (do-send 'first' text)
  =/  request  (snag 0 (requests sent))
  ;<  completed=(list card)  bind:m  (do-reply wire.request answer)
  (pure:m sent completed)
::  Advance to the memory wake and fire it.
::
++  do-wake
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  saved=state-0  bind:m  get-state
  =/  at  (need wake.knowledge.saved)
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now at)))
  (do-arvo /memory-work/(scot %da at) [%behn %wake ~])
::
++  test-background-capture-is-independent-of-active-turn-and-shared-on-admission
  (eval-mare independent)
++  test-dreaming-is-off-by-default-and-reload-does-not-start-inference
  (eval-mare disabled)
++  test-conversation-events-do-not-postpone-the-memory-watchdog
  (eval-mare stable-wake)
++  stable-wake
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~                bind:m  (setup fixture)
  ;<  *                bind:m  (do-turn 'Provisioning requires privacy.' 'Understood.')
  ;<  *                bind:m  do-wake
  ;<  before=state-0   bind:m  get-state
  ;<  ~                bind:m
    (jab-bowl |=(b=bowl b(now (add (need wake.knowledge.before) ~s1))))
  ;<  *                bind:m  (do-send 'second' 'Continue.')
  ;<  after=state-0    bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>(?=(^ pending.knowledge.before)) !>(&))
  (ex-equal !>(wake.knowledge.after) !>(wake.knowledge.before))
++  disabled
  =/  m  (mare ,~)
  ^-  form:m
  =/  initial  fixture
  =.  enabled.dreaming.maintenance.knowledge.initial  |
  =.  due.dreaming.maintenance.knowledge.initial  ~
  ;<  ~                     bind:m  (setup initial)
  ;<  [* completed=(list card)]  bind:m  (do-turn 'Continue.' 'Reply.')
  ;<  saved=state-0         bind:m  get-state
  ;<  =agent                bind:m  get-agent
  ;<  reloaded=(list card)  bind:m  (do-load agent `!>(saved))
  ;<  after=state-0         bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>((requests completed)) !>(~))
  ;<  ~  bind:m  (ex-equal !>((requests reloaded)) !>(~))
  ;<  ~  bind:m  (ex-equal !>(wake.knowledge.after) !>(~))
  ;<  ~  bind:m  (ex-equal !>(next.knowledge.after) !>(0))
  %+  ex-equal
    !>((~(has by buffered.dreaming.maintenance.knowledge.after) 'first'))
  !>(&)
++  independent
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~                     bind:m  (setup fixture)
  ;<  [sent=(list card) completed=(list card)]  bind:m
    (do-turn 'Provisioning requires privacy.' 'Understood.')
  ;<  saved=state-0         bind:m  get-state
  ;<  working=(list card)   bind:m  do-wake
  =/  extraction  (snag 0 (requests working))
  ;<  work-state=state-0    bind:m  get-state
  ;<  *                     bind:m  (do-send 'first' 'Now continue the conversation.')
  ;<  before=state-0        bind:m  get-state
  =/  fact=@t
    '[{"name":"provisioning","revision":0,"text":"Provisioning requires privacy.","aliases":[],"general":false,"event":2,"quote":"requires privacy"}]'
  ;<  captured=(list card)  bind:m  (do-reply wire.extraction fact)
  ;<  after=state-0         bind:m  get-state
  ::  The fence and the cross-session turn both branch off the captured agent.
  ;<  pre=state             bind:m  get-all
  ;<  *                     bind:m
    (do-poke %harness-action !>(`action:h`[%fence 'first']))
  ;<  fence-state=state-0   bind:m  get-state
  ;<  ~                     bind:m  (set-all pre)
  ;<  peek=cage             bind:m  (got-peek /x/memory/provisioning)
  =/  record  !<(json q.peek)
  ;<  cross=(list card)     bind:m  (do-send 'second' 'What does provisioning require?')
  =/  recalled  (snag 0 (requests cross))
  =/  text  q:(need body.request.recalled)
  =/  found  (find "Provisioning requires privacy." (trip text))
  ;<  ~  bind:m  (ex-equal !>((lent (requests sent))) !>(1))
  ;<  ~  bind:m  (ex-equal !>((requests completed)) !>(~))
  ;<  ~  bind:m  (ex-equal !>(next.knowledge.saved) !>(0))
  ;<  ~  bind:m
    (ex-equal !>(model.config:(need pending.knowledge.work-state)) !>('lcm-fixture'))
  ;<  ~  bind:m  (ex-equal !>((snag 3 wire.extraction)) !>(%memory))
  ;<  ~  bind:m  (ex-equal !>((requests captured)) !>(~))
  ;<  ~  bind:m  (ex-equal !>(sessions.after) !>(sessions.before))
  ;<  ~  bind:m
    %+  ex-equal
      !>((~(got by cursors.knowledge.fence-state) 'first'))
    !>(log:(~(got by sessions.after) 'first'))
  ;<  ~  bind:m
    (ex-equal !>((~(has by records.knowledge.after) 'provisioning')) !>(&))
  ;<  ~  bind:m
    (ex-equal !>((str:j record 'text')) !>('Provisioning requires privacy.'))
  (ex-equal !>(?=(^ found)) !>(&))
++  test-reload-timeout-and-late-responses-preserve-the-conversation
  (eval-mare timeout)
++  timeout
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~                     bind:m  (setup fixture)
  ;<  *                     bind:m
    (do-turn 'Provisioning requires privacy.' 'Understood.')
  ;<  working=(list card)   bind:m  do-wake
  =/  extraction  (snag 0 (requests working))
  ;<  pending=state-0       bind:m  get-state
  ;<  reloaded=(list card)  bind:m  (do-load head `!>(pending))
  ;<  restored=state-0      bind:m  get-state
  ;<  expired=(list card)   bind:m  do-wake
  ;<  retry=state-0         bind:m  get-state
  ;<  late=(list card)      bind:m  (do-reply wire.extraction '[]')
  ;<  after=state-0         bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>(sessions.after) !>(sessions.pending))
  ;<  ~  bind:m  (ex-equal !>(pending.knowledge.restored) !>(pending.knowledge.pending))
  ;<  ~  bind:m  (ex-equal !>(pending.knowledge.after) !>(~))
  ;<  ~  bind:m  (ex-equal !>(head.knowledge.after) !>(1))
  ;<  ~  bind:m  (ex-equal !>(next.knowledge.after) !>(2))
  ;<  ~  bind:m  (ex-equal !>(knowledge.after) !>(knowledge.retry))
  ;<  ~  bind:m  (ex-equal !>((requests reloaded)) !>(~))
  ;<  ~  bind:m  (ex-equal !>((requests expired)) !>(~))
  (ex-equal !>((requests late)) !>(~))
++  test-optout-excludes-cancelled-turns-after-reenabling
  (eval-mare optout)
++  optout
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (setup fixture)
  ;<  *  bind:m  (do-send 'first' '/memory off')
  ;<  *  bind:m  (do-send 'first' 'PRIVATE_OPT_OUT_EVIDENCE')
  ;<  *  bind:m  (do-poke %harness-action !>(`action:h`[%cancel 'first']))
  ;<  *  bind:m  (do-send 'first' '/memory on')
  ;<  *  bind:m  (do-turn 'Provisioning requires privacy.' 'Understood.')
  ;<  working=(list card)  bind:m  do-wake
  =/  extraction  (snag 0 (requests working))
  =/  text  q:(need body.request.extraction)
  =/  private-found  (find "PRIVATE_OPT_OUT_EVIDENCE" (trip text))
  =/  public-found  (find "Provisioning requires privacy." (trip text))
  ;<  ~  bind:m  (ex-equal !>(private-found) !>(~))
  (ex-equal !>(?=(^ public-found)) !>(&))
++  compaction-fixture
  ^-  state-0
  =/  initial  fixture
  =/  cfg  defaults.initial
  =/  log=(list event:h)
    :~  [%config-replaced cfg]
        :-  %input-received
        :*  0v1  [%poke ~zod]  `~zod  ~  ~2026.10.7
            [%user 'Provisioning requires privacy. Keep this constraint for future projects.']
        ==
        [%llm-requested 0 %turn]
        [%llm-routed 0 cfg]
        [%llm-completed 0 %stop [1 1] [%assistant 'Understood; I will respect that constraint.' ~]]
        [%input-received [0v2 [%poke ~zod] `~zod ~ ~2026.10.7 [%user 'Now review the plan.']]]
        [%llm-requested 1 %turn]
        [%llm-routed 1 cfg]
        [%llm-completed 1 %stop [1 1] [%assistant 'The plan is ready for review.' ~]]
    ==
  %=  initial
    sessions  (my ~[['first' [(flop log) 2]]])
    enabled.dreaming.maintenance.knowledge  |
    due.dreaming.maintenance.knowledge  ~
  ==
++  compact-answer
  |=  memories=json
  %-  en:json:html
  (pairs:enjs:format ~[['summary' %s 'Provision privately.'] ['memories' memories]])
++  compact-facts
  ^-  json
  %-  need
  %-  de:json:html
  '[{"name":"provisioning","revision":0,"text":"Provisioning requires privacy.","aliases":[],"general":false,"event":2,"quote":"requires privacy"}]'
++  compact-case
  |=  [mode=@t memories=json expected=@ud]
  =/  m  (mare ,~)
  ^-  form:m
  =/  initial  compaction-fixture
  =?  disabled.knowledge.initial  =('off' mode)  (silt ~['first'])
  ;<  ~                      bind:m  (setup initial)
  ;<  started=(list card)    bind:m
    (do-poke %harness-action !>(`action:h`[%compact 'first']))
  =/  request  (snag 0 (requests started))
  ;<  dispatched=state-0     bind:m  get-state
  =?  barrier.knowledge.dispatched  =('forgotten' mode)  +(barrier.knowledge.dispatched)
  ;<  =agent                 bind:m  get-agent
  ;<  *                      bind:m  (do-load agent `!>(dispatched))
  ;<  completed=(list card)  bind:m
    (do-reply wire.request ?:(=('off' mode) 'Provision privately.' (compact-answer memories)))
  ;<  after=state-0          bind:m  get-state
  =/  view  (play:hl log:(~(got by sessions.after) 'first'))
  =/  text  q:(need body.request.request)
  =/  extra  (find "Memory evidence:" (trip text))
  =/  checkpoint
    %+  skim  log:(~(got by sessions.after) 'first')
    |=(e=event:h ?=(%checkpoint-completed -.e))
  ?>  ?=(^ checkpoint)
  ;<  ~  bind:m  (ex-equal !>((lent (requests started))) !>(1))
  ;<  ~  bind:m  (ex-equal !>((requests completed)) !>(~))
  ;<  ~  bind:m  (ex-equal !>(err.view) !>(~))
  ;<  ~  bind:m  (ex-equal !>(pending.view) !>(~))
  ;<  ~  bind:m  (ex-equal !>(compactions.maintenance.knowledge.after) !>(~))
  ;<  ~  bind:m  (ex-equal !>(~(wyt by records.knowledge.after)) !>(expected))
  ;<  ~  bind:m  (ex-equal !>(?=(^ extra)) !>(!=('off' mode)))
  ;<  ~  bind:m  (ex-equal !>(enabled.dreaming.maintenance.knowledge.after) !>(|))
  ;<  ~  bind:m  (ex-equal !>(wake.knowledge.after) !>(~))
  %+  ex-equal
    !>(?>(?=(%checkpoint-completed -.i.checkpoint) summary.i.checkpoint))
  !>('Provision privately.')
++  test-compaction-captures-original-evidence-in-one-request-with-dreaming-off
  (eval-mare (compact-case 'on' compact-facts 1))
++  test-invalid-memory-proposals-do-not-discard-a-valid-checkpoint
  (eval-mare (compact-case 'on' [%s 'invalid'] 0))
++  test-compaction-capture-survives-reload-and-respects-forgetting
  (eval-mare (compact-case 'forgotten' compact-facts 0))
++  test-conversation-optout-keeps-compaction-tool-free-without-capture
  (eval-mare (compact-case 'off' compact-facts 0))
--

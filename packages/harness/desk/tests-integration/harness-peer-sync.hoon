::  Opt-in full agent: -test /=harness=/tests-integration/harness-peer-sync
::  Steps that must not read other agents run under a scry gate that answers
::  nothing, so any scry fails the step with "blocking on scry".
/-  h=harness, *harness-store
/+  *test-agent
/=  head  /app/harness
|%
++  t0  ~2026.9.8
::  Load saved state, with .src as the source. Scries during the load
::  answer %.n.
::
++  setup
  |=  [src=ship saved=state-0]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src src, dap %harness, now t0)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  *  bind:m  (do-load head `!>(saved))
  (pure:m ~)
::
++  no-scries  (set-scry-gate |=(path ~))
::  Each action meets a freshly loaded agent. The poke may scry only when
::  allowed; otherwise any scry fails it.
::
++  do-action
  |=  [saved=state-0 act=action:h scries=?]
  =/  m  (mare ,[(list card) state-0])
  ^-  form:m
  ;<  ~  bind:m  (setup ~zod saved(local-mcp-seen 1))
  ;<  ~  bind:m  ?:(scries (pure:(mare ,~) ~) no-scries)
  ;<  caz=(list card)  bind:m  (do-poke %harness-action !>(act))
  ;<  save=vase  bind:m  get-save
  (pure:m [caz !<(state-0 save)])
::
++  test-local-grant-and-revocation-announce-once
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [first=(list card) one=state-0]  bind:m
    (do-action *state-0 [%grant ~nec [~[%web] ~ 0 ~]] &)
  ;<  [same=(list card) two=state-0]  bind:m
    (do-action one [%grant ~nec [~[%web] ~ 0 ~]] |)
  ;<  [removed=(list card) three=state-0]  bind:m
    (do-action two [%revoke ~nec] &)
  ;<  ~  bind:m  (ex-cards first (ex-poke-wire /peer-access/status) ~)
  ;<  ~  bind:m  (ex-cards same ~)
  ;<  ~  bind:m  (ex-cards removed (ex-poke-wire /peer-access/status) ~)
  (ex-equal !>(announced-access.three) !>(~))
::
++  test-routine-acknowledgements-do-not-read-other-agents
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ::  Even an undiscovered/absent MCP agent must not add callback scries.
  ;<  ~  bind:m  (setup ~zod %*(. *state-0 local-mcp-seen 0))
  ;<  ~  bind:m  no-scries
  ;<  *  bind:m  (do-agent /acp/ack [~zod %acp] [%poke-ack ~])
  (pure:m ~)
::
++  test-existing-remote-report-does-not-refresh-local-permissions
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved=state-0  *state-0
  =.  local-mcp-seen.saved  1
  =.  remote-access.saved  (my ~[[~nec [~ ~2026.9.7]]])
  ;<  ~  bind:m  (setup ~nec saved)
  ;<  ~  bind:m  no-scries
  ;<  *  bind:m  (do-poke %harness-access-0 !>(`peer-access-message:h`[%status ~ ~]))
  (pure:m ~)
--

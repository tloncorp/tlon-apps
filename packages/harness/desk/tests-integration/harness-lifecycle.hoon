::  Session cleanup through the full head. Emitted effects are inspected, never
::  delivered.
/-  h=harness, *harness-store
/+  *test-agent, policy=harness-defaults, hl=harness
/=  head  /app/harness
|%
::  Every scry is refused.
::
++  setup
  |=  saved=state-0
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now ~2026.10.1)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  *  bind:m  (do-load head `!>(saved))
  (pure:m ~)
++  do-action
  |=  =action:h
  (do-poke %harness-action !>(action))
++  saved
  =/  m  (mare ,state-0)
  ^-  form:m
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-0 vase))
++  count
  |=  [cards=(list card) match=$-(card ?)]
  (lent (skim cards match))
::
++  fixture
  ^-  state-0
  =/  saved  *state-0
  =/  config  builtin-config:policy
  =.  defaults.saved  config(tools ~[%web])
  =/  root=session:h  [~[[%config-replaced defaults.saved]] 1]
  =/  child=session:h
    :_  1
    :~  [%input-received [0v1 [%subagent 'source' 'delegate'] ~ ~ ~2026.10.1 [%user 'Child work']]]
        [%config-replaced defaults.saved]
    ==
  =.  sessions.saved
    (my ~[['source' root] ['child' child] ['independent' root]])
  =.  subs.saved  (my ~[['child' ['source' 'delegate']]])
  =.  timers.saved
    %-  my
    :~  [['source' %wake] [~2026.10.2 ~ 'Source timer']]
        [['child' %wake] [~2026.10.2 ~ 'Child timer']]
        [['independent' %wake] [~2026.10.2 ~ 'Other timer']]
    ==
  =.  jobs.saved
    %-  my
    ~[[%source-job ['source' 'script' ~2026.10.2]] [%other-job ['independent' 'script' ~2026.10.2]]]
  =.  asks.saved
    (my ~[[0v1 ['source' 'ask' ~nec]] [0v2 ['independent' 'ask' ~nec]]])
  =.  local-mcp.saved
    %-  my
    :~  [['source' 'native'] [1 'fixture' 0v1 0 '']]
        [['independent' 'native'] [1 'fixture' 0v1 0 '']]
    ==
  saved
::
++  test-fence-retires-descendant-work-and-keeps-source-configuration
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  initial  fixture
  ;<  ~  bind:m  (setup initial)
  ;<  *  bind:m  (do-action [%fence 'source'])
  ;<  saved=state-0  bind:m  saved
  =/  child  (play:hl log:(~(got by sessions.saved) 'child'))
  ;<  ~  bind:m
    %+  ex-equal
      !>((~(got by sessions.saved) 'source'))
    !>((~(got by sessions.initial) 'source'))
  ;<  ~  bind:m
    %+  ex-equal
      !>((~(got by sessions.saved) 'independent'))
    !>((~(got by sessions.initial) 'independent'))
  ;<  ~  bind:m  (ex-equal !>(tools.config.child) !>(~))
  ;<  ~  bind:m  (ex-equal !>(items.child) !>(~[[%user 'Child work']]))
  ;<  ~  bind:m  (ex-equal !>(subs.saved) !>(~))
  ;<  ~  bind:m
    %+  ex-equal
      !>(timers.saved)
    !>((my ~[[['independent' %wake] [~2026.10.2 ~ 'Other timer']]]))
  ;<  ~  bind:m
    %+  ex-equal
      !>(jobs.saved)
    !>((my ~[[%other-job ['independent' 'script' ~2026.10.2]]]))
  ;<  ~  bind:m  (ex-equal !>(asks.saved) !>((my ~[[0v2 ['independent' 'ask' ~nec]]])))
  %+  ex-equal
    !>(local-mcp.saved)
  !>((my ~[[['independent' 'native'] [1 'fixture' 0v1 0 '']]]))
::
++  test-delete-withdraws-each-waiter-once-and-keeps-unrelated-work
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  initial  fixture
  ;<  ~  bind:m  (setup initial)
  ;<  caz=(list card)  bind:m  (do-action [%delete 'source'])
  ;<  saved=state-0  bind:m  saved
  =/  stopped
    (count caz |=(c=card ?=([%pass [%jsstop %source-job ~] *] c)))
  =/  watchdogs
    (count caz |=(c=card ?=([%pass [%jsdog %source-job ~] %arvo %b %rest *] c)))
  =/  timers
    (count caz |=(c=card ?=([%pass [%timer %source %wake ~] %arvo %b %rest *] c)))
  =/  native
    (count caz |=(c=card ?=([%pass [%local-mcp %source *] %agent * %leave ~] c)))
  ;<  ~  bind:m  (ex-equal !>((~(has by sessions.saved) 'source')) !>(|))
  ;<  ~  bind:m  (ex-equal !>((~(has by sessions.saved) 'child')) !>(&))
  ;<  ~  bind:m
    %+  ex-equal
      !>((~(got by sessions.saved) 'independent'))
    !>((~(got by sessions.initial) 'independent'))
  ;<  ~  bind:m  (ex-equal !>(stopped) !>(1))
  ;<  ~  bind:m  (ex-equal !>(watchdogs) !>(1))
  ;<  ~  bind:m  (ex-equal !>(timers) !>(1))
  ;<  ~  bind:m  (ex-equal !>(native) !>(1))
  ;<  ~  bind:m
    %+  ex-equal
      !>(jobs.saved)
    !>((my ~[[%other-job ['independent' 'script' ~2026.10.2]]]))
  ;<  ~  bind:m  (ex-equal !>(asks.saved) !>((my ~[[0v2 ['independent' 'ask' ~nec]]])))
  %+  ex-equal
    !>(timers.saved)
  !>((my ~[[['independent' %wake] [~2026.10.2 ~ 'Other timer']]]))
::
++  test-forks-retain-selected-history-after-source-deletion
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  initial  fixture
  =/  source=session:h
    :_  7
    :~  [%llm-completed 0 %stop [3 2] [%assistant 'Retain this answer' ~]]
        [%config-replaced defaults.initial]
    ==
  =.  sessions.initial  (~(put by sessions.initial) 'source' source)
  ;<  ~  bind:m  (setup initial)
  ;<  *  bind:m  (do-action [%fork 'source' 'copy'])
  ;<  *  bind:m  (do-action [%fork-at 'source' 'branch' 2])
  ;<  *  bind:m  (do-action [%delete 'source'])
  ;<  saved=state-0  bind:m  saved
  =/  expected=session:h  [[[%forked 'source' 2 ~ ~] log.source] 7]
  ;<  ~  bind:m  (ex-equal !>((~(got by sessions.saved) 'copy')) !>(expected))
  ;<  ~  bind:m  (ex-equal !>((~(got by sessions.saved) 'branch')) !>(expected))
  (ex-equal !>((~(has by sessions.saved) 'source')) !>(|))
--

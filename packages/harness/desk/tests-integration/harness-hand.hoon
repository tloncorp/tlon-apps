::  Hand admission through the full head, driven by test-agent; no card is
::  delivered and every scry answers %.n.
/-  h=harness, hh=harness-hand, *harness-store
/+  *test-agent, policy=harness-defaults, hd=harness-hand, hl=harness
/=  head  /app/harness
|%
++  t0  ~2026.10.1
::
++  fixture
  ^-  state-0
  =/  saved  *state-0
  =.  saved
    %=  saved
      defaults  builtin-config:policy
      local-mcp-seen  1
      provider-keys  (my ~[['openrouter' 'fixture-key']])
    ==
  =.  url.defaults.saved  'https://openrouter.ai/api/v1/chat/completions'
  =/  events=(list event:h)
    :~  [%llm-requested 0 %turn]
        [%input-admitted [%user 'Running']]
        [%config-replaced defaults.saved]
    ==
  =.  sessions.saved  (my ~[['source' [events 1]] ['other' [events 1]]])
  =.  bindings.hands.saved
    %-  my
    :~  ['source' ['fixture' 'source-room' 'source' ~['alice'] &]]
        ['other' ['fixture' 'other-room' 'other' ~['alice'] &]]
    ==
  =/  running  (apply:hd hands.saved [%observe 'source' 'running' 'alice' 'Running'] t0)
  ?>  ?=(%& -.running)
  =/  queued  (apply:hd db.p.running [%observe 'source' 'waiting' 'alice' 'Waiting'] t0)
  ?>  ?=(%& -.queued)
  =/  unrelated
    %^  apply:hd
      db.p.queued
      [%observe 'other' 'unrelated' 'alice' 'Other work']
    t0
  ?>  ?=(%& -.unrelated)
  saved(hands (start:hd db.p.unrelated 'source' (input-id:hd 'source' 'running')))
::  One running observation whose turn has three refused tool results and
::  a fourth refused call still open, with nothing queued behind it.
::
++  halting
  ^-  state-0
  =/  saved  *state-0
  =.  saved
    %=  saved
      defaults  builtin-config:policy
      local-mcp-seen  1
      provider-keys  (my ~[['openrouter' 'fixture-key']])
    ==
  =.  url.defaults.saved  'https://openrouter.ai/api/v1/chat/completions'
  =/  refused  'rejected: tool is not granted for this session'
  =/  events=(list event:h)
    %-  flop
    ^-  (list event:h)
    :~  [%config-replaced defaults.saved]
        [%input-admitted [%user 'Use the tool.']]
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
  =.  sessions.saved  (my ~[['source' [events 4]]])
  =.  bindings.hands.saved
    (my ~[['source' ['fixture' 'source-room' 'source' ~['alice'] &]]])
  =/  running  (apply:hd hands.saved [%observe 'source' 'running' 'alice' 'Use the tool.'] t0)
  ?>  ?=(%& -.running)
  saved(hands (start:hd db.p.running 'source' (input-id:hd 'source' 'running')))
::  Load a fixture as ~zod with every scry answered %.n.
::
++  start-with
  |=  saved=state-0
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now t0)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  *  bind:m  (do-load head `!>(saved))
  (pure:m ~)
++  setup  (start-with fixture)
::
++  get-state
  =/  m  (mare ,state-0)
  ^-  form:m
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-0 vase))
::
++  cancels
  |=  cards=(list card)
  (lien cards |=(=card ?=([%pass * %arvo %i %cancel-request *] card)))
::
++  test-stop-preserves-receipts-and-replay-cannot-cancel-new-work
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  stop=request:hh  ['stop' [%observe 'source' 'stop-event' 'alice' '/stop']]
  =/  running  (input-id:hd 'source' 'running')
  =/  waiting  (input-id:hd 'source' 'waiting')
  =/  stop-id  (input-id:hd 'source' 'stop-event')
  =/  unrelated  (input-id:hd 'other' 'unrelated')
  ;<  ~      bind:m  setup
  ;<  *      bind:m  (do-poke %harness-hand !>(stop))
  ;<  saved=state-0  bind:m  get-state
  ;<  *      bind:m  (do-poke %harness-action !>(`action:h`[%send 'source' 'New work']))
  ;<  before=state-0  bind:m  get-state
  ::  The new work is in flight, so a replayed stop has something to cancel.
  =/  current  (play:hl log:(~(got by sessions.before) 'source'))
  ;<  ~  bind:m  (ex-equal !>(?=(^ pending.current)) !>(&))
  ;<  replayed=(list card)  bind:m  (do-poke %harness-hand !>(stop))
  ;<  after=state-0  bind:m  get-state
  ;<  ~  bind:m
    (ex-equal !>(phase:(~(got by observations.hands.saved) running)) !>(%cancelled))
  ;<  ~  bind:m  (ex-equal !>(kind:(~(got by outbox.hands.saved) running)) !>(%cancelled))
  ;<  ~  bind:m
    (ex-equal !>(phase:(~(got by observations.hands.saved) waiting)) !>(%cancelled))
  ;<  ~  bind:m
    (ex-equal !>(phase:(~(got by observations.hands.saved) stop-id)) !>(%completed))
  ;<  ~  bind:m  (ex-equal !>(kind:(~(got by outbox.hands.saved) stop-id)) !>(%reply))
  ;<  ~  bind:m  (ex-equal !>(queue.hands.saved) !>(`(list input-id:h)`~[unrelated]))
  ;<  ~  bind:m  (ex-equal !>(hands.after) !>(hands.before))
  ;<  ~  bind:m  (ex-equal !>(sessions.after) !>(sessions.before))
  (ex-equal !>((cancels replayed)) !>(|))
::  The fourth refused call halts the turn. Its observation gets one
::  terminal failure publication, and a fresh message starts a new turn.
::
++  test-loop-guard-halt-publishes-one-failure-asking-for-a-new-message
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  running  (input-id:hd 'source' 'running')
  =/  next  (input-id:hd 'source' 'next')
  =/  expected=@t
    'I stopped before finishing this. You can ask me to try again in a new message.'
  ;<  ~  bind:m  (start-with halting)
  ;<  *  bind:m  (do-poke %harness-action !>(`action:h`[%retry 'source']))
  ;<  halted=state-0  bind:m  get-state
  =/  log  log:(~(got by sessions.halted) 'source')
  ;<  ~  bind:m  (ex-equal !>(?=([[%halted *] *] log)) !>(&))
  ;<  ~  bind:m  (ex-equal !>(~(wyt by outbox.hands.halted)) !>(1))
  =/  published  (~(got by outbox.hands.halted) running)
  ;<  ~  bind:m  (ex-equal !>(kind.published) !>(%failure))
  ;<  ~  bind:m  (ex-equal !>(status.published) !>(%pending))
  ;<  ~  bind:m  (ex-equal !>(body.published) !>(expected))
  ;<  ~  bind:m
    (ex-equal !>(phase:(~(got by observations.hands.halted) running)) !>(%failed))
  ;<  ~  bind:m  (ex-equal !>((~(has by active.hands.halted) 'source')) !>(|))
  =/  again=request:hh  ['next' [%observe 'source' 'next' 'alice' 'Try again.']]
  ;<  *  bind:m  (do-poke %harness-hand !>(again))
  ;<  after=state-0  bind:m  get-state
  =/  current  (play:hl log:(~(got by sessions.after) 'source'))
  ;<  ~  bind:m  (ex-equal !>(?=(^ pending.current)) !>(&))
  ;<  ~  bind:m  (ex-equal !>((~(get by active.hands.after) 'source')) !>(`next))
  (ex-equal !>((~(got by outbox.hands.after) running)) !>(published))
::  Retry halts the same turn again, but its observation already settled.
::
++  test-retry-after-loop-guard-halt-does-not-publish-again
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  running  (input-id:hd 'source' 'running')
  =/  claim=request:hh  ['claim' [%claim 'fixture' running 'worker']]
  ;<  ~  bind:m  (start-with halting)
  ;<  *  bind:m  (do-poke %harness-action !>(`action:h`[%retry 'source']))
  ;<  *  bind:m  (do-poke %harness-hand !>(claim))
  ;<  claimed=state-0  bind:m  get-state
  ;<  *  bind:m  (do-poke %harness-action !>(`action:h`[%retry 'source']))
  ;<  after=state-0  bind:m  get-state
  =/  halts
    %+  skim  log:(~(got by sessions.after) 'source')
    |=(=event:h ?=(%halted -.event))
  ;<  ~  bind:m  (ex-equal !>((lent halts)) !>(2))
  ;<  ~  bind:m  (ex-equal !>(status:(~(got by outbox.hands.after) running)) !>(%claimed))
  (ex-equal !>(hands.after) !>(hands.claimed))
--

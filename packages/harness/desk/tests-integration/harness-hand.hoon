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
::  Load the fixture as ~zod with every scry answered %.n.
::
++  setup
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now t0)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  *  bind:m  (do-load head `!>(fixture))
  (pure:m ~)
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
--

::  Hand admission through the full head, driven by test-agent; no card is
::  delivered and every scry answers %.n.
/-  h=harness, hh=harness-hand, t=harness-tlon, adapter=harness-adapter, *harness-store
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
::  One conversation several speakers share. .running is the actor of the
::  input in flight; each of .waiting is queued in order after it. Another
::  conversation has its own queued input.
::
++  shared
  |=  [hand=@t actors=(list @t) running=@t waiting=(list [event=@t actor=@t])]
  ^-  state-0
  =/  saved  fixture
  =.  hands.saved  *state:hh
  =.  bindings.hands.saved
    %-  my
    :~  ['source' [hand 'source-room' 'source' actors &]]
        ['other' ['fixture' 'other-room' 'other' ~['alice'] &]]
    ==
  =/  admit
    |=  [db=state:hh binding=@t event=@t actor=@t]
    ^-  state:hh
    =/  res  (apply:hd db [%observe binding event actor event] t0)
    ?>  ?=(%& -.res)
    db.p.res
  =/  db  (admit hands.saved 'source' 'running' running)
  =.  db
    %+  roll  waiting
    |=  [[event=@t actor=@t] db=_db]
    (admit db 'source' event actor)
  =.  db  (admit db 'other' 'unrelated' 'alice')
  saved(hands (start:hd db 'source' (input-id:hd 'source' 'running')))
::  ~nec owns the bot; the Tlon hand grants every speaker it is asked about.
::
++  owner-scry
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%gu @ %harness-tlon @ %$ ~] path)  `!>(&)
  ?:  ?=([%gx @ %harness-tlon @ %peer-trust %noun ~] path)
    `!>(`peer-trust:t`[[& `~nec ~ %mentions ~ ~] |])
  ?:  ?|  ?=([%gx @ %harness-tlon @ %authority @ %noun ~] path)
          ?=([%gx @ %harness-tlon @ %authority @ @ %noun ~] path)
      ==
    `!>(`hand-authority:adapter`[& ~])
  ?:  ?=([%gx @ %harness-tlon @ %context @ @ %noun ~] path)  `!>(`(unit @t)`~)
  `!>(|)
++  load
  |=  [saved=state-0 scry=$-(path (unit vase))]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now t0)))
  ;<  ~  bind:m  (set-scry-gate scry)
  ;<  *  bind:m  (do-load head `!>(saved))
  (pure:m ~)
++  phase-of
  |=  [saved=state-0 event=@t]
  ^-  phase:hh
  phase:(~(got by observations.hands.saved) (input-id:hd 'source' event))
++  observe
  |=  [event=@t actor=@t text=@t]
  (do-poke %harness-hand !>(`request:hh`[event [%observe 'source' event actor text]]))
::  bob's stop leaves alice's running turn and waiting input alone. alice's
::  own stop cancels her turn and her input, and bob's input then runs.
::
++  test-guest-stop-cancels-only-the-guests-work
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved
    (shared 'fixture' ~['alice' 'bob'] 'alice' ~[['waiting' 'alice'] ['bob-waiting' 'bob']])
  ;<  ~  bind:m  (load saved |=(path `!>(|)))
  ;<  guest=(list card)  bind:m  (observe 'bob-stop' 'bob' '/stop')
  ;<  after-guest=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>((cancels guest)) !>(|))
  ;<  ~  bind:m  (ex-equal !>((phase-of after-guest 'running')) !>(%running))
  ;<  ~  bind:m  (ex-equal !>((phase-of after-guest 'waiting')) !>(%queued))
  ;<  ~  bind:m  (ex-equal !>((phase-of after-guest 'bob-waiting')) !>(%cancelled))
  ;<  ~  bind:m  (ex-equal !>((phase-of after-guest 'bob-stop')) !>(%queued))
  ;<  ~  bind:m  (load saved |=(path `!>(|)))
  ;<  own=(list card)  bind:m  (observe 'alice-stop' 'alice' '/stop')
  ;<  after-own=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>((cancels own)) !>(&))
  ;<  ~  bind:m  (ex-equal !>((phase-of after-own 'running')) !>(%cancelled))
  ;<  ~  bind:m  (ex-equal !>((phase-of after-own 'waiting')) !>(%cancelled))
  ;<  ~  bind:m  (ex-equal !>((phase-of after-own 'bob-waiting')) !>(%running))
  %+  ex-equal  !>(queue.hands.after-own)
  !>(~[(input-id:hd 'other' 'unrelated') (input-id:hd 'source' 'alice-stop')])
::  The owner's stop cancels the turn in flight and every speaker's waiting
::  input, as a local stop does.
::
++  test-owner-stop-cancels-the-running-turn
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved
    (shared 'tlon' ~['~nec' '~bus' '~dev'] '~bus' ~[['waiting' '~bus'] ['dev-waiting' '~dev']])
  ;<  ~  bind:m  (load saved owner-scry)
  ;<  out=(list card)  bind:m  (observe 'owner-stop' '~nec' '/stop')
  ;<  after=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>((cancels out)) !>(&))
  ;<  ~  bind:m  (ex-equal !>((phase-of after 'running')) !>(%cancelled))
  ;<  ~  bind:m  (ex-equal !>((phase-of after 'waiting')) !>(%cancelled))
  (ex-equal !>((phase-of after 'dev-waiting')) !>(%cancelled))
::  Revoking alice cancels her turn and her waiting input; bob's input runs
::  next, and timers and the other conversation's work stay.
::
++  test-fence-actor-cancels-one-speakers-work-and-others-continue
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved
    (shared 'fixture' ~['alice' 'bob'] 'alice' ~[['waiting' 'alice'] ['bob-waiting' 'bob']])
  =.  timers.saved
    (my ~[[['source' %check] *timer:h]])
  ;<  ~  bind:m  (load saved |=(path `!>(|)))
  ;<  idle=(list card)  bind:m
    (do-poke %harness-action !>(`action:h`[%fence-actor 'source' 'carol']))
  ;<  untouched=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>((cancels idle)) !>(|))
  ;<  ~  bind:m  (ex-equal !>(hands.untouched) !>(hands.saved))
  ;<  out=(list card)  bind:m
    (do-poke %harness-action !>(`action:h`[%fence-actor 'source' 'alice']))
  ;<  after=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>((cancels out)) !>(&))
  ;<  ~  bind:m  (ex-equal !>((phase-of after 'running')) !>(%cancelled))
  ;<  ~  bind:m  (ex-equal !>((phase-of after 'waiting')) !>(%cancelled))
  ;<  ~  bind:m  (ex-equal !>((phase-of after 'bob-waiting')) !>(%running))
  ;<  ~  bind:m  (ex-equal !>(timers.after) !>(timers.saved))
  (ex-equal !>(queue.hands.after) !>(~[(input-id:hd 'other' 'unrelated')]))
--

::  Hand admission through the full head, driven by test-agent; no card is
::  delivered and every scry answers %.n.
/-  h=harness, hh=harness-hand, t=harness-tlon, adapter=harness-adapter, c=harness-cron,
    ac=acp, renew=harness-oauth, *harness-store
/+  *test-agent, policy=harness-defaults, hd=harness-hand, hl=harness,
    command=harness-command, schedule=harness-schedule, mem=harness-memory,
    work-help=harness-work-help
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
::  Every read of the saved state also checks the head's index.
::
++  get-state
  =/  m  (mare ,state-0)
  ^-  form:m
  ;<  ~  bind:m  ex-index
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-0 vase))
::
::  The head's index equals the derivation of the ledger it holds.
::
++  ex-index
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ledger=cage  bind:m  (got-peek /x/hand-state)
  ;<  index=cage  bind:m  (got-peek /x/hand-index)
  (ex-equal q.index !>((reindex:hd !<(state:hh q.ledger))))
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
  ;<  ~      bind:m  ex-index
  ;<  *      bind:m  (do-poke %harness-hand !>(stop))
  ;<  ~      bind:m  ex-index
  ;<  saved=state-0  bind:m  get-state
  ;<  *      bind:m  (do-poke %harness-action !>(`action:h`[%send 'source' 'New work']))
  ;<  ~      bind:m  ex-index
  ;<  before=state-0  bind:m  get-state
  ::  The new work is in flight, so a replayed stop has something to cancel.
  =/  current  (play:hl log:(~(got by sessions.before) 'source'))
  ;<  ~  bind:m  (ex-equal !>(?=(^ pending.current)) !>(&))
  ;<  replayed=(list card)  bind:m  (do-poke %harness-hand !>(stop))
  ;<  ~  bind:m  ex-index
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
    `!>(`peer-trust:t`[[& `~nec ~ %mentions ~ ~ ~ ~] |])
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
::  Revoking alice cancels her turn, the subagent it started and her waiting
::  input; bob's input runs next, and timers and the other conversation's
::  work stay.
::
++  test-fence-actor-cancels-one-speakers-work-and-others-continue
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved
    (shared 'fixture' ~['alice' 'bob'] 'alice' ~[['waiting' 'alice'] ['bob-waiting' 'bob']])
  =.  timers.saved
    (my ~[[['source' %check] *timer:h]])
  =/  child=session:h
    :_  1
    :~  [%input-received [0v1 [%subagent 'source' 'delegate'] ~ ~ t0 [%user 'Child work']]]
        [%config-replaced defaults.saved(tools ~[%web])]
    ==
  =.  sessions.saved  (~(put by sessions.saved) 'child' child)
  =.  subs.saved  (my ~[['child' ['source' 'delegate']]])
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
  ;<  ~  bind:m
    %+  ex-equal
      !>(tools.config:(play:hl log:(~(got by sessions.after) 'child')))
    !>(*(list tool-grant:h))
  ;<  ~  bind:m  (ex-equal !>(subs.after) !>(~))
  (ex-equal !>(queue.hands.after) !>(~[(input-id:hd 'other' 'unrelated')]))
::  The owner's stop of alice's turn ends the subagent it started, so none
::  is left working once alice's turn no longer runs.
::
++  test-a-stopped-turn-leaves-no-subagent-working
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  (shared 'fixture' ~['alice' 'bob'] 'alice' ~)
  =/  child=session:h
    :_  1
    :~  [%input-received [0v1 [%subagent 'source' 'delegate'] ~ ~ t0 [%user 'Child work']]]
        [%config-replaced defaults.saved(tools ~[%web])]
    ==
  =.  sessions.saved  (~(put by sessions.saved) 'child' child)
  =.  subs.saved  (my ~[['child' ['source' 'delegate']]])
  ;<  ~  bind:m  (load saved |=(path `!>(|)))
  ;<  *  bind:m  (do-poke %harness-action !>(`action:h`[%cancel 'source']))
  ;<  after=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>((phase-of after 'running')) !>(%cancelled))
  ;<  ~  bind:m
    %+  ex-equal
      !>(tools.config:(play:hl log:(~(got by sessions.after) 'child')))
    !>(*(list tool-grant:h))
  (ex-equal !>(subs.after) !>(~))
::  An idle shared channel session and an idle DM, both bound to the Tlon
::  hand. The hand lets only ~nec, the owner, change either; ~bus keeps
::  /work in their own DM.
::
++  conversations
  ^-  state-0
  =/  saved  fixture
  =/  idle=(list event:h)  ~[[%config-replaced defaults.saved]]
  =.  sessions.saved  (my ~[['room' [idle 1]] ['dm' [idle 1]]])
  =.  hands.saved  *state:hh
  =.  bindings.hands.saved
    %-  my
    :~  ['room' ['tlon' 'chat/~lux/test' 'room' ~['*'] &]]
        ['dm' ['tlon' 'dm/~bus' 'dm' ~['~bus'] &]]
    ==
  saved
++  settings-scry
  |=  =path
  ^-  (unit vase)
  =/  parts=(list @ta)  path
  ?:  ?=([%gx @ %harness-tlon @ %settings @ @ %noun ~] parts)
    `!>(=('~nec' i.t.t.t.t.t.t.parts))
  ?.  ?=([%gx @ %harness-tlon @ %work @ @ %noun ~] parts)  (owner-scry path)
  `!>(|(=('dm' i.t.t.t.t.t.parts) =('~nec' i.t.t.t.t.t.t.parts)))
::  .who says .text in .sid; the session's log afterwards, newest first.
::
++  say
  |=  [sid=@t who=@t text=@t]
  =/  m  (mare ,(list event:h))
  ^-  form:m
  ;<  ~  bind:m  (load conversations settings-scry)
  ;<  *  bind:m  (do-poke %harness-hand !>(`request:hh`[text [%observe sid text who text]]))
  ;<  after=state-0  bind:m  get-state
  (pure:m log:(~(got by sessions.after) sid))
++  reply
  |=  log=(list event:h)
  ^-  (unit @t)
  =/  done
    (skim log |=(=event:h ?=(%command-completed -.event)))
  ?~  done  ~
  ?>  ?=(%command-completed -.i.done)
  `body.i.done
++  model
  |=  log=(list event:h)
  ^-  @t
  model:config:(play:hl log)
::  A refused command records only its input and the refusal: the session,
::  memories, memory switch and work are unchanged and no model is asked.
::
++  ex-refused
  |=  [sid=@t who=@t text=@t]
  =/  m  (mare ,~)
  ^-  form:m
  =/  start  conversations
  =/  before  log:(~(got by sessions.start) sid)
  ;<  log=(list event:h)  bind:m  (say sid who text)
  ;<  after=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>((reply log)) !>(`refused:command))
  ;<  ~  bind:m  (ex-equal !>(?=([[%command-completed *] [%input-received *] *] log)) !>(&))
  ;<  ~  bind:m  (ex-equal !>((slag 2 log)) !>(before))
  ;<  ~  bind:m
    %+  ex-equal  !>([records general disabled cursors]:knowledge.after)
    !>([records general disabled cursors]:knowledge.start)
  (ex-equal !>(workspace.after) !>(workspace.start))
::
++  test-a-guest-cannot-change-a-shared-channels-model
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (ex-refused 'room' '~bus' '/model other-model')
  (ex-refused 'room' '~bus' '/model default')
::
++  test-a-guest-cannot-compact-or-change-memory-in-a-shared-channel
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (ex-refused 'room' '~bus' '/compact')
  ;<  ~  bind:m  (ex-refused 'room' '~bus' '/memory off')
  ;<  ~  bind:m  (ex-refused 'room' '~bus' '/memory on')
  ;<  ~  bind:m  (ex-refused 'room' '~bus' '/remember note text')
  ;<  ~  bind:m  (ex-refused 'room' '~bus' '/forget note')
  (ex-refused 'room' '~bus' '/work projects')
::
++  test-the-owner-can-change-a-shared-channels-model
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  log=(list event:h)  bind:m  (say 'room' '~nec' '/model other-model')
  ;<  ~  bind:m  (ex-equal !>((model log)) !>('other-model'))
  (ex-equal !>(=((reply log) `refused:command)) !>(|))
::
++  test-a-dm-partner-cannot-change-their-dms-model
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (ex-refused 'dm' '~bus' '/model other-model')
  (ex-refused 'dm' '~bus' '/model default')
::
++  test-a-dm-partner-cannot-compact-or-switch-memory-in-their-dm
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (ex-refused 'dm' '~bus' '/compact')
  ;<  ~  bind:m  (ex-refused 'dm' '~bus' '/memory off')
  (ex-refused 'dm' '~bus' '/memory on')
::
++  test-a-dm-partner-cannot-remember-or-forget-in-their-dm
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (ex-refused 'dm' '~bus' '/remember note text')
  (ex-refused 'dm' '~bus' '/forget note')
::  /work answers to the partner's own Workspace permissions, and reading
::  commands stay open.
::
++  test-a-dm-partner-keeps-work-and-reading-commands
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  start  conversations
  ;<  log=(list event:h)  bind:m  (say 'dm' '~bus' '/work')
  ;<  ~  bind:m  (ex-equal !>((reply log)) !>(`overview:work-help))
  ;<  log=(list event:h)  bind:m  (say 'dm' '~bus' '/memory')
  ;<  ~  bind:m  (ex-equal !>((reply log)) !>(`'No matching shared memories.'))
  ;<  log=(list event:h)  bind:m  (say 'dm' '~bus' '/model')
  (ex-equal !>((reply log)) !>(`(cat 3 'Model: ' (model-label:command defaults.start))))
::
++  test-a-guest-can-read-status-in-a-shared-channel
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  start  conversations
  ;<  log=(list event:h)  bind:m  (say 'room' '~bus' '/status')
  ;<  ~  bind:m  (ex-equal !>(=((reply log) `refused:command)) !>(|))
  ;<  log=(list event:h)  bind:m  (say 'room' '~bus' '/model')
  (ex-equal !>((reply log)) !>(`(cat 3 'Model: ' (model-label:command defaults.start))))
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
  ;<  ~  bind:m  ex-index
  ;<  *  bind:m  (do-poke %harness-action !>(`action:h`[%retry 'source']))
  ;<  ~  bind:m  ex-index
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
  ;<  ~  bind:m  ex-index
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
  ;<  ~  bind:m  ex-index
  ;<  claimed=state-0  bind:m  get-state
  ;<  *  bind:m  (do-poke %harness-action !>(`action:h`[%retry 'source']))
  ;<  ~  bind:m  ex-index
  ;<  after=state-0  bind:m  get-state
  =/  halts
    %+  skim  log:(~(got by sessions.after) 'source')
    |=(=event:h ?=(%halted -.event))
  ;<  ~  bind:m  (ex-equal !>((lent halts)) !>(2))
  ;<  ~  bind:m  (ex-equal !>(status:(~(got by outbox.hands.after) running)) !>(%claimed))
  (ex-equal !>(hands.after) !>(hands.claimed))
::  Each owner route that changes the ledger keeps the head's index equal to
::  its derivation: hand pokes, cancel, fence and session delete.
::
++  test-head-index-follows-every-ledger-route
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  more=request:hh  ['more' [%observe 'source' 'more' 'alice' 'More']]
  =/  again=request:hh  ['again' [%observe 'source' 'again' 'alice' 'Again']]
  =/  later=request:hh  ['later' [%observe 'other' 'later' 'alice' 'Later']]
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  ex-index
  ;<  *  bind:m  (do-poke %harness-hand !>(more))
  ;<  ~  bind:m  ex-index
  ;<  *  bind:m  (do-poke %harness-action !>(`action:h`[%cancel 'source']))
  ;<  ~  bind:m  ex-index
  ;<  cancelled=state-0  bind:m  get-state
  ;<  ~  bind:m
    %+  ex-equal
      !>(phase:(~(got by observations.hands.cancelled) (input-id:hd 'source' 'more')))
    !>(%cancelled)
  ;<  *  bind:m  (do-poke %harness-hand !>(again))
  ;<  *  bind:m  (do-poke %harness-hand !>(later))
  ;<  ~  bind:m  ex-index
  ;<  *  bind:m  (do-poke %harness-action !>(`action:h`[%fence 'source']))
  ;<  ~  bind:m  ex-index
  ;<  *  bind:m  (do-poke %harness-action !>(`action:h`[%delete 'other']))
  ;<  ~  bind:m  ex-index
  ;<  deleted=state-0  bind:m  get-state
  %+  ex-equal
    !>(phase:(~(got by observations.hands.deleted) (input-id:hd 'other' 'later')))
  !>(%cancelled)
::  The head's binding writes keep the bindings of each session in its
::  index: bind, register, enable and remove.
::
++  test-head-index-lists-each-sessions-bindings
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  config=binding:hh  ['fixture' 'third-room' 'other' ~['alice'] &]
  =/  ask
    |=  =action:hh
    (do-poke %harness-hand !>(`request:hh`[-.action action]))
  =/  listed
    |=  sid=@t
    =/  n  (mare ,(set @t))
    ^-  form:n
    ;<  index=cage  bind:n  (got-peek /x/hand-index)
    (pure:n (~(get ju sessions:!<(index:hh q.index)) sid))
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  ex-index
  ;<  *  bind:m  (ask [%bind 'third' config])
  ;<  *  bind:m  (ask [%register config])
  ;<  ~  bind:m  ex-index
  ;<  other=(set @t)  bind:m  (listed 'other')
  ;<  ~  bind:m  (ex-equal !>(other) !>((silt ~['other' 'third' 'hand--0'])))
  ;<  *  bind:m  (ask [%enable 'third' |])
  ;<  ~  bind:m  ex-index
  ;<  *  bind:m  (ask [%remove 'hand--0'])
  ;<  ~  bind:m  ex-index
  ;<  other=(set @t)  bind:m  (listed 'other')
  (ex-equal !>(other) !>((silt ~['other' 'third'])))
::  The head's answer to one hand request.
::
++  hand-result
  |=  [id=@t cards=(list card)]
  ^-  (list (each json @t))
  %+  murn  cards
  |=  =card
  ^-  (unit (each json @t))
  ?.  ?=([%give %fact * %noun *] card)  ~
  ?.  =(~[/hands/[id]] paths.p.card)  ~
  `;;((each json @t) q.q.cage.p.card)
::  BINDINGS bindings, each with its own session, the first FULL of them
::  holding PER waiting inputs. No session exists, so none can start.
::
++  waiting
  |=  [bindings=@ud full=@ud per=@ud]
  ^-  state-0
  =/  saved  *state-0
  =/  b  0
  |-
  ?:  =(b bindings)  saved
  =/  id  (cat 3 'b' (scot %ud b))
  =.  bindings.hands.saved
    (~(put by bindings.hands.saved) id ['fixture' id id ~['alice'] &])
  =/  k  0
  =.  saved
    |-
    ?:  |((gte b full) =(k per))  saved
    =/  event  (scot %ud k)
    =/  input  (input-id:hd id event)
    =.  observations.hands.saved
      (~(put by observations.hands.saved) input [id event 'alice' 'text' t0 %queued])
    =.  queue.hands.saved  (snoc queue.hands.saved input)
    $(k +(k))
  $(b +(b))
::  The waiting limits still refuse, with the text they always had.
::
++  test-the-ninth-waiting-input-on-a-binding-is-refused
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  ninth=request:hh  ['ninth' [%observe 'b0' 'ninth' 'alice' 'Ninth']]
  ;<  ~  bind:m  (start-with (waiting 1 1 8))
  ;<  cards=(list card)  bind:m  (do-poke %harness-hand !>(ninth))
  %+  ex-equal
    !>((hand-result 'ninth' cards))
  !>(`(list (each json @t))`~[[%| 'This binding or session has reached its waiting-work limit']])
::
++  test-the-129th-waiting-input-on-the-ship-is-refused
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  next=request:hh  ['next' [%observe 'b16' 'next' 'alice' 'Next']]
  ;<  ~  bind:m  (start-with (waiting 17 16 8))
  ;<  saved=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>((lent queue.hands.saved)) !>(128))
  ;<  cards=(list card)  bind:m  (do-poke %harness-hand !>(next))
  %+  ex-equal
    !>((hand-result 'next' cards))
  !>(`(list (each json @t))`~[[%| 'Admission queue is full; retry the same source event later']])
::  Loading a saved ledger rebuilds the index before anything reads it: a
::  pending publication is runnable and a schedule whose run is unfinished
::  is busy.
::
++  test-load-rebuilds-the-index
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  fixture
  =/  done  (input-id:hd 'other' 'done')
  =.  observations.hands.saved
    (~(put by observations.hands.saved) done ['other' 'done' 'alice' 'Done' t0 %completed])
  =.  outbox.hands.saved
    %+  ~(put by outbox.hands.saved)  done
    [done 'other' 'fixture' 'other-room' 'other' %reply 'Reply' %pending '' '' ~]
  =/  job=job:c
    :*  %prompt  'UTC'  'source-room'  'source'  'source'  'every hour'  *pattern:c
        'Prompt'  ~  t0  `1  %active  ''  `(input-id:hd 'source' 'running')
    ==
  ;<  ~  bind:m  (start-with saved)
  ;<  ~  bind:m  ex-index
  ;<  ledger=cage  bind:m  (got-peek /x/hand-state)
  ;<  index=cage  bind:m  (got-peek /x/hand-index)
  =/  loaded=indexed:hh  [!<(state:hh q.ledger) !<(index:hh q.index)]
  ;<  ~  bind:m
    %+  ex-equal
      !>((turn (pending-publications:hd loaded 'fixture') |=([id=input-id:h *] id)))
    !>(`(list input-id:h)`~[done])
  (ex-equal !>((busy:schedule job loaded)) !>(&))
::  352 completed observations of 'big' whose 512-byte source events are
::  control characters, each escaped as \u00XX; listing them all takes more
::  than an ACP payload.
::
++  escaped-history
  ^-  state-0
  =/  saved  fixture
  =.  bindings.hands.saved
    (~(put by bindings.hands.saved) 'big' ['fixture' 'big-room' 'other' ~['alice'] |])
  =/  n=@ud  0
  |-
  ?:  =(352 n)  saved
  =/  event  (end [3 512] (cat 3 (scot %ud n) (fil 3 512 0x1)))
  =/  =observation:hh  ['big' event 'alice' 'Hello' (add t0 (mul n ~s1)) %completed]
  %=  $
    n  +(n)
    observations.hands.saved
      (~(put by observations.hands.saved) (input-id:hd 'big' event) observation)
  ==
::
++  test-status-and-enable-replies-fit-an-acp-payload-at-any-history
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  =update:v1:ac
    :*  %messages  'fixture'  %agent
        :~  [1 t0 '{"jsonrpc":"2.0","id":1,"method":"harness/hand","params":{"status":{"binding":"big"}}}']
            [2 t0 '{"jsonrpc":"2.0","id":2,"method":"harness/hand","params":{"enable":{"id":"big","enabled":true}}}']
        ==
    ==
  ;<  ~  bind:m  (start-with escaped-history)
  ;<  cards=(list card)  bind:m
    (do-agent /acp/watch [~zod %acp] [%fact %acp-update-1 !>(update)])
  =/  sent=(list @t)
    %+  murn  cards
    |=  =card
    ^-  (unit @t)
    ?.  ?=([%pass [%acp %send ~] %agent * %poke %acp-action-1 *] card)  ~
    =/  [pass=* wire=* agent=* target=* poke=* mark=* data=vase]  card
    =/  action  !<(action:v1:ac data)
    ?>  ?=(%send -.action)
    `payload.action
  ;<  ~  bind:m  (ex-equal !>((lent sent)) !>(2))
  =/  result
    |=  payload=@t
    ^-  (map @t json)
    =/  value  ((ot:dejs:format ~[result+same]) (need (de:json:html payload)))
    ?>(?=(%o -.value) p.value)
  =/  status  (result (snag 0 sent))
  ::  An enable answers with the binding's fields; its rows are in %status.
  =/  enabled  (result (snag 1 sent))
  ;<  ~  bind:m
    (ex-equal !>((ni:dejs:format (~(got by status) 'observationCount'))) !>(352))
  ;<  ~  bind:m  (ex-equal !>((~(get by enabled) 'enabled')) !>(`[%b &]))
  ;<  ~  bind:m
    %+  ex-equal
      !>([(~(has by enabled) 'observations') (~(has by enabled) 'observationCount')])
    !>([| |])
  ::  max-payload-bytes in %acp.
  (ex-equal !>((levy sent |=(payload=@t (lte (met 3 payload) 1.048.576)))) !>(&))
::  The owner ~nec's DM beside the shared channel and ~bus's DM, all on the
::  Tlon hand; the adapter answers that only the owner's DM is its lane. The
::  owner stated a general preference in their DM.
::
++  owned
  ^-  state-0
  =/  saved  conversations
  =/  preference
    %:  save:mem
      everything:mem  knowledge.saved  'owner-style'  0
      [`'Prefer replies in haiku.' ~ & & ['owner' 0v1 1 t0 '~nec']]
    ==
  ?>  ?=(%& -.preference)
  =.  knowledge.saved  p.preference
  =.  sessions.saved  (~(put by sessions.saved) 'owner' [~[[%config-replaced defaults.saved]] 1])
  =.  bindings.hands.saved
    (~(put by bindings.hands.saved) 'owner' ['tlon' 'dm/~nec' 'owner' ~['~nec'] &])
  saved
++  lane-scry
  |=  =path
  ^-  (unit vase)
  =/  parts=(list @ta)  path
  ?:  ?=([%gx @ %harness-tlon @ %admin @ %noun ~] parts)
    `!>(=('owner' i.t.t.t.t.t.parts))
  (settings-scry path)
++  hear
  |=  [sid=@t who=@t event=@t text=@t]
  (do-poke %harness-hand !>(`request:hh`[event [%observe sid event who text]]))
++  model-requests
  |=  cards=(list card)
  ^-  (list [=wire body=@t])
  %+  murn  cards
  |=  c=card
  ^-  (unit [=wire body=@t])
  ?.  ?=([%pass [%llm *] %arvo %i %request *] c)  ~
  =/  sent=http-card:renew  c
  `[wire.sent q:(need body.request.sent)]
++  answer
  |=  [text=@t calls=(list [id=@t name=@t args=@t])]
  ^-  sign-arvo
  =/  message
    %-  pairs:enjs:format
    :~  ['role' %s 'assistant']
        ['content' %s text]
        :-  'tool_calls'
        :-  %a
        %+  turn  calls
        |=  [id=@t name=@t args=@t]
        %-  pairs:enjs:format
        :~  ['id' %s id]  ['type' %s 'function']
            ['function' (pairs:enjs:format ~[['name' %s name] ['arguments' %s args]])]
        ==
    ==
  =/  choice
    %-  pairs:enjs:format
    ~[['message' message] ['finish_reason' %s ?~(calls 'stop' 'tool_calls')]]
  =/  body  (en:json:html (pairs:enjs:format ~[['choices' %a ~[choice]]]))
  [%iris %http-response %finished [200 ~] `['application/json' (as-octs:mimes:html body)]]
++  mentions
  |=  [cards=(list card) text=@t]
  ^-  ?
  =/  sent  (model-requests cards)
  ?>  ?=(^ sent)
  ?=(^ (find (trip text) (trip body.i.sent)))
++  tool-result
  |=  log=(list event:h)
  ^-  @t
  =/  done  (skim log |=(=event:h ?=(%tool-completed -.event)))
  ?>  ?=(^ done)
  ?>  ?=(%tool-completed -.i.done)
  body.i.done
::  The owner saves a fact in their DM. In the channel, neither a guest's
::  message nor the owner's own recalls it, /memory does not list it and
::  the model's read answers as if it did not exist; the DM recalls it. The
::  guest's turn does carry the owner's preference, without its source.
::
++  test-a-fact-learned-in-the-owners-dm-is-not-seen-in-a-channel
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (load owned lane-scry)
  ;<  *  bind:m  (hear 'owner' '~nec' 'save' '/remember falcon The falcon codeword is vexillum.')
  ;<  saved=state-0  bind:m  get-state
  ;<  guest=(list card)  bind:m  (hear 'room' '~bus' 'guest' 'What is the falcon codeword?')
  =/  first  (snag 0 (model-requests guest))
  ;<  tool=(list card)  bind:m
    %+  do-arvo  wire.first
    (answer '' ~[['read-1' 'memory' '{"operation":"read","name":"falcon"}']])
  ;<  after-tool=state-0  bind:m  get-state
  ;<  *  bind:m  (do-arvo wire:(snag 0 (model-requests tool)) (answer 'I do not know.' ~))
  ;<  *  bind:m  (hear 'room' '~bus' 'search' '/memory falcon')
  ;<  searched=state-0  bind:m  get-state
  ;<  ~  bind:m  (load owned lane-scry)
  ;<  *  bind:m  (hear 'owner' '~nec' 'save' '/remember falcon The falcon codeword is vexillum.')
  ;<  own=(list card)  bind:m  (hear 'room' '~nec' 'own' 'Remind me of the falcon codeword.')
  ;<  *  bind:m  (load owned lane-scry)
  ;<  *  bind:m  (hear 'owner' '~nec' 'save' '/remember falcon The falcon codeword is vexillum.')
  ;<  dm=(list card)  bind:m  (hear 'owner' '~nec' 'ask' 'What is the falcon codeword?')
  ;<  ~  bind:m
    %+  ex-equal  !>(sid.source.value:(~(got by records.knowledge.saved) 'falcon'))
    !>('owner')
  ;<  ~  bind:m  (ex-equal !>((mentions guest 'vexillum')) !>(|))
  ;<  ~  bind:m  (ex-equal !>((mentions guest 'Prefer replies in haiku.')) !>(&))
  ;<  ~  bind:m  (ex-equal !>((mentions guest '[source: ~nec; owner#')) !>(|))
  ;<  ~  bind:m
    %+  ex-equal  !>((tool-result log:(~(got by sessions.after-tool) 'room')))
    !>('error: No memory has that name.')
  ;<  ~  bind:m
    %+  ex-equal  !>((reply log:(~(got by sessions.searched) 'room')))
    !>(`'No matching shared memories.')
  ;<  ~  bind:m  (ex-equal !>((mentions own 'vexillum')) !>(|))
  (ex-equal !>((mentions dm 'vexillum')) !>(&))
::  A fact the owner saves over ACP has no conversation, so only the
::  owner's own conversations see it: a local session does, and a channel, a
::  subagent the channel started, a fork of the channel and a peer session
::  do not.
::
++  test-a-fact-saved-over-acp-is-seen-only-by-the-owners-conversations
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  owned
  =/  idle=(list event:h)  ~[[%config-replaced defaults.saved]]
  =/  child=(list event:h)
    [[%input-received [0v1 [%subagent 'room' 'call'] ~ ~ t0 [%user 'Child work']]] idle]
  =/  peer=(list event:h)
    [[%input-received [0v2 [%peer ~bus *ask-id:h] `~bus ~ t0 [%user 'Peer work']]] idle]
  =.  sessions.saved
    %-  ~(gas by sessions.saved)
    :~  ['local' [idle 1]]
        ['child' [child 2]]
        ['peer-session' [peer 2]]
    ==
  ;<  ~  bind:m  (load saved lane-scry)
  =/  frame
    '{"jsonrpc":"2.0","id":1,"method":"harness/memory/save","params":{"name":"falcon","text":"The falcon codeword is vexillum.","revision":"0"}}'
  =/  =update:v1:ac  [%messages 'owner-ui' %agent ~[[1 t0 frame]]]
  ;<  *  bind:m  (do-agent /acp/watch [~zod %acp] [%fact %acp-update-1 !>(update)])
  ;<  acp=state-0  bind:m  get-state
  ;<  guest=(list card)  bind:m  (hear 'room' '~bus' 'guest' 'What is the falcon codeword?')
  ;<  *  bind:m  (do-arvo wire:(snag 0 (model-requests guest)) (answer 'I do not know.' ~))
  ;<  *  bind:m  (do-poke %harness-action !>(`action:h`[%fork 'room' 'room-fork']))
  =/  ask  |=(sid=@t (do-poke %harness-action !>(`action:h`[%send sid 'What is the falcon codeword?'])))
  ;<  fork=(list card)  bind:m  (ask 'room-fork')
  ;<  sub=(list card)  bind:m  (ask 'child')
  ;<  remote=(list card)  bind:m  (ask 'peer-session')
  ;<  local=(list card)  bind:m  (ask 'local')
  ;<  ~  bind:m
    (ex-equal !>(sid.source.value:(~(got by records.knowledge.acp) 'falcon')) !>(''))
  ;<  ~  bind:m  (ex-equal !>((mentions guest 'vexillum')) !>(|))
  ;<  ~  bind:m  (ex-equal !>((mentions fork 'vexillum')) !>(|))
  ;<  ~  bind:m  (ex-equal !>((mentions sub 'vexillum')) !>(|))
  ;<  ~  bind:m  (ex-equal !>((mentions remote 'vexillum')) !>(|))
  (ex-equal !>((mentions local 'vexillum')) !>(&))
::  .saved with one fact from .sid by .actor; general when .general.
::
++  seed
  |=  [saved=state-0 name=@t body=@t sid=@t actor=@t general=?]
  ^-  state-0
  =/  result
    %:  save:mem
      everything:mem  knowledge.saved  name  0
      [`body ~ general & [sid 0v1 1 t0 actor]]
    ==
  ?>  ?=(%& -.result)
  saved(knowledge p.result)
::  The owner's fixture with a fact the owner saved over ACP, which only the
::  owner's private conversations see.
::
++  secret
  ^-  state-0
  (seed owned 'acp-secret' 'The vault code is vexillum.' '' '~zod' |)
++  idle
  |=  saved=state-0
  ^-  session:h
  [~[[%config-replaced defaults.saved]] 1]
++  test-conflicting-bindings-make-the-owners-dm-narrow
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  conflicted  secret
  =.  bindings.hands.conflicted
    (~(put by bindings.hands.conflicted) 'owner-side' ['fixture' 'side-room' 'owner' ~['alice'] &])
  ;<  ~  bind:m  (load secret lane-scry)
  ;<  plain=(list card)  bind:m  (hear 'owner' '~nec' 'ask' 'What is the vault code?')
  ;<  ~  bind:m  (load conflicted lane-scry)
  ;<  both=(list card)  bind:m  (hear 'owner' '~nec' 'ask' 'What is the vault code?')
  ;<  ~  bind:m  (ex-equal !>((mentions plain 'vexillum')) !>(&))
  (ex-equal !>((mentions both 'vexillum')) !>(|))
::  A local session with two completed exchanges, bound to another hand that
::  has sent nothing yet.
::
++  compactable
  |=  bound=?
  ^-  state-0
  =/  saved  (seed owned 'provisioning-code' 'Provisioning requires privacy; the code is vexillum.' '' '~zod' |)
  =/  cfg  defaults.saved
  =/  log=(list event:h)
    :~  [%config-replaced cfg]
        :-  %input-received
        :*  0v1  [%poke ~zod]  `~zod  ~  t0
            [%user 'Provisioning requires privacy. Keep this constraint for future projects.']
        ==
        [%llm-requested 0 %turn]
        [%llm-routed 0 cfg]
        [%llm-completed 0 %stop [1 1] [%assistant 'Understood; I will respect that constraint.' ~]]
        [%input-received [0v2 [%poke ~zod] `~zod ~ t0 [%user 'Now review the plan.']]]
        [%llm-requested 1 %turn]
        [%llm-routed 1 cfg]
        [%llm-completed 1 %stop [1 1] [%assistant 'The plan is ready for review.' ~]]
    ==
  =.  sessions.saved  (~(put by sessions.saved) 'kept' [(flop log) 2])
  ?.  bound  saved
  =.  bindings.hands.saved
    (~(put by bindings.hands.saved) 'kept' ['fixture' 'side-room' 'kept' ~['alice'] &])
  saved
::  A hand's first input decides the reach, even when it is /compact: the
::  summary request is built from the session with that input in it.
::
++  test-compact-as-a-hands-first-input-uses-the-admitted-history
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (load (compactable |) lane-scry)
  ;<  local=(list card)  bind:m
    (do-poke %harness-action !>(`action:h`[%send 'kept' '/compact']))
  ;<  ~  bind:m  (load (compactable &) lane-scry)
  ;<  handed=(list card)  bind:m
    (do-poke %harness-hand !>(`request:hh`['first' [%observe 'kept' 'first' 'alice' '/compact']]))
  ;<  ~  bind:m  (ex-equal !>((mentions local 'vexillum')) !>(&))
  (ex-equal !>((mentions handed 'vexillum')) !>(|))
++  webhook
  |=  text=@t
  ^-  inbound-request:eyre
  :*  |  |  [%ipv4 .127.0.0.1]
      %'POST'  '/harness-api/webhook/hook'  ~
      `(as-octs:mimes:html (en:json:html (pairs:enjs:format ~[['text' %s text]])))
  ==
::  Outside text delivered by a webhook is not the owner's conversation: it
::  does not recall a private fact, and the model's read, save and forget of
::  it answer as if it were not there or refuse.
::
++  test-a-webhook-session-cannot-recall-read-change-or-forget-a-private-fact
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  secret
  =.  sessions.saved  (~(put by sessions.saved) 'hook' (idle saved))
  ;<  ~  bind:m  (load saved lane-scry)
  ;<  asked=(list card)  bind:m
    (do-poke %handle-http-request !>([`@ta`%hook-1 (webhook 'What is the vault code?')]))
  =/  first  (snag 0 (model-requests asked))
  ;<  *  bind:m
    %+  do-arvo  wire.first
    %+  answer  ''
    :~  ['read-1' 'memory' '{"operation":"read","name":"acp-secret"}']
        ['save-1' 'memory' '{"operation":"save","name":"acp-secret","text":"Changed.","revision":"2"}']
        ['forget-1' 'memory' '{"operation":"forget","name":"acp-secret","revision":"2"}']
    ==
  ;<  after=state-0  bind:m  get-state
  =/  results
    %+  murn  log:(~(got by sessions.after) 'hook')
    |=  =event:h
    ^-  (unit [@t @t])
    ?.  ?=(%tool-completed -.event)  ~
    `[call-id.event body.event]
  ;<  ~  bind:m  (ex-equal !>((mentions asked 'vexillum')) !>(|))
  ;<  ~  bind:m
    %+  ex-equal  !>((~(got by records.knowledge.after) 'acp-secret'))
    !>((~(got by records.knowledge.saved) 'acp-secret'))
  =/  expected=(map @t @t)
    %-  malt
    ^-  (list [@t @t])
    :~  ['read-1' 'error: No memory has that name.']
        ['save-1' 'error: That memory name is not available.']
        ['forget-1' 'error: That memory name is not available.']
    ==
  (ex-equal !>(`(map @t @t)`(malt results)) !>(expected))
::  A webhook turn answers no one, so though the place rule would let it
::  change what its own conversation learned, it saves and forgets nothing.
::
++  test-a-webhook-turns-memory-tool-cannot-save-or-forget
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  (seed owned 'hook-note' 'The hook fires hourly.' 'hook' '~zod' |)
  =.  sessions.saved  (~(put by sessions.saved) 'hook' (idle saved))
  =/  revision  (scot %ud revision:(~(got by records.knowledge.saved) 'hook-note'))
  ;<  ~  bind:m  (load saved lane-scry)
  ;<  asked=(list card)  bind:m
    (do-poke %handle-http-request !>([`@ta`%hook-1 (webhook 'Note this.')]))
  ;<  *  bind:m
    %+  do-arvo  wire:(snag 0 (model-requests asked))
    %+  answer  ''
    :~  ['save-1' 'memory' '{"operation":"save","name":"fresh-note","text":"Noted.","revision":"0"}']
        :+  'forget-1'  'memory'
        (rap 3 '{"operation":"forget","name":"hook-note","revision":"' revision '"}' ~)
    ==
  ;<  after=state-0  bind:m  get-state
  =/  results
    %+  murn  log:(~(got by sessions.after) 'hook')
    |=  =event:h
    ^-  (unit [@t @t])
    ?.  ?=(%tool-completed -.event)  ~
    `[call-id.event body.event]
  =/  refusal  (cat 3 'error: ' refused-memory:command)
  ;<  ~  bind:m
    %+  ex-equal  !>(`(map @t @t)`(malt results))
    !>(`(map @t @t)`(malt ~[['save-1' refusal] ['forget-1' refusal]]))
  (ex-equal !>(records.knowledge.after) !>(records.knowledge.saved))
::  A turn in the unbound session 'hook' starts from .first, the webhook's
::  text or the owner's poke; the other arrives while its model request is
::  out, and that request's answer saves a fact. The save's result, and the
::  state after.
::
++  interleaved-save
  |=  first=?(%webhook %owner)
  =/  m  (mare ,[result=@t after=state-0])
  ^-  form:m
  =/  saved  owned
  =.  sessions.saved  (~(put by sessions.saved) 'hook' (idle saved))
  =/  hook  (do-poke %handle-http-request !>([`@ta`%hook-1 (webhook 'Note this.')]))
  =/  owner  (do-poke %harness-action !>(`action:h`[%send 'hook' 'Owner here.']))
  ;<  ~  bind:m  (load saved lane-scry)
  ;<  asked=(list card)  bind:m  ?:(?=(%webhook first) hook owner)
  ;<  *  bind:m  ?:(?=(%webhook first) owner hook)
  ;<  *  bind:m
    %+  do-arvo  wire:(snag 0 (model-requests asked))
    %+  answer  ''
    ~[['save-1' 'memory' '{"operation":"save","name":"fresh-note","text":"Noted.","revision":"0"}']]
  ;<  after=state-0  bind:m  get-state
  (pure:m [(tool-result log:(~(got by sessions.after) 'hook')) after])
::  The webhook's turn answers the webhook, though the owner spoke while
::  its model request was out: its save changes nothing.
::
++  test-a-webhook-turn-cannot-save-after-the-owner-speaks-mid-turn
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [result=@t after=state-0]  bind:m  (interleaved-save %webhook)
  =/  start=state-0  owned
  ;<  ~  bind:m  (ex-equal !>(result) !>((cat 3 'error: ' refused-memory:command)))
  (ex-equal !>(records.knowledge.after) !>(records.knowledge.start))
::  The owner's turn answers the owner, though a webhook arrived while its
::  model request was out: its save still lands.
::
++  test-the-owners-turn-still-saves-after-a-webhook-arrives-mid-turn
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [result=@t after=state-0]  bind:m  (interleaved-save %owner)
  ;<  ~  bind:m  (ex-equal !>(=('error: ' (end [3 7] result))) !>(|))
  %+  ex-equal  !>(body.value:(~(got by records.knowledge.after) 'fresh-note'))
  !>(`'Noted.')
::  A subagent's reach comes from the head's own walk to its root: one
::  started from the owner's DM sees what the DM sees, one from a channel
::  does not.
::
++  test-a-subagent-takes-its-roots-reach-through-the-heads-walk
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  secret
  =/  child
    |=  parent=@t
    ^-  session:h
    :_  2
    :~  [%input-received [0v1 [%subagent parent 'call'] ~ ~ t0 [%user 'Child work']]]
        [%config-replaced defaults.saved]
    ==
  =.  sessions.saved
    (~(gas by sessions.saved) ~[['dm-child' (child 'owner')] ['room-child' (child 'room')]])
  =.  turns.knowledge.saved
    (~(gas by turns.knowledge.saved) ~[['owner' [0v0 ~ '~nec' ~]] ['room' [0v0 ~ '~bus' ~]]])
  =/  ask  |=(sid=@t (do-poke %harness-action !>(`action:h`[%send sid 'What is the vault code?'])))
  ;<  ~  bind:m  (load saved lane-scry)
  ;<  dm=(list card)  bind:m  (ask 'dm-child')
  ;<  room=(list card)  bind:m  (ask 'room-child')
  ;<  ~  bind:m  (ex-equal !>((mentions dm 'vexillum')) !>(&))
  (ex-equal !>((mentions room 'vexillum')) !>(|))
::  Without the Tlon adapter there is no lane answer, so the owner's DM gets
::  the narrow reach.
::
++  test-the-owners-dm-is-narrow-while-the-adapter-is-not-running
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  stopped
    |=  =path
    ^-  (unit vase)
    ?:  ?=([%gu @ %harness-tlon @ %$ ~] path)  `!>(|)
    (lane-scry path)
  ;<  ~  bind:m  (load secret stopped)
  ;<  asked=(list card)  bind:m  (hear 'owner' '~nec' 'ask' 'What is the vault code?')
  (ex-equal !>((mentions asked 'vexillum')) !>(|))
::  An owner's preference saved in the channel reaches a subagent of the
::  channel. The subagent's tool cannot move it into the subagent's own
::  conversation, so the fact keeps its place and its text.
::
++  test-a-subagent-of-a-channel-cannot-move-the-channels-preference
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  (seed owned 'room-style' 'Prefer replies in haiku form.' 'room' '~nec' &)
  =.  sessions.saved
    %+  ~(put by sessions.saved)  'room-child'
    :_  2
    :~  [%input-received [0v1 [%subagent 'room' 'call'] ~ ~ t0 [%user 'Child work']]]
        [%config-replaced defaults.saved]
    ==
  =.  turns.knowledge.saved  (~(put by turns.knowledge.saved) 'room' [0v0 ~ '~bus' ~])
  ;<  ~  bind:m  (load saved lane-scry)
  ;<  sent=(list card)  bind:m
    (do-poke %harness-action !>(`action:h`[%send 'room-child' 'Write a short note.']))
  ;<  saving=(list card)  bind:m
    %+  do-arvo  wire:(snag 0 (model-requests sent))
    %+  answer  ''
    ~[['save-1' 'memory' '{"operation":"save","name":"room-style","text":"Haiku banned.","revision":"2"}']]
  ;<  after=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>((mentions sent 'room-style: Prefer replies in haiku form.')) !>(&))
  ;<  ~  bind:m
    %+  ex-equal  !>((tool-result log:(~(got by sessions.after) 'room-child')))
    !>('error: This conversation cannot change a memory learned in another place.')
  ;<  ~  bind:m
    %+  ex-equal  !>((~(got by records.knowledge.after) 'room-style'))
    !>((~(got by records.knowledge.saved) 'room-style'))
  (ex-equal !>((mentions saving 'room-style: Haiku banned.')) !>(|))
::  .who asks in .sid of .saved and the model answers by saving a new fact
::  and forgetting .name, which that place learned; the tool results by call
::  id, and the state after.
::
++  memory-writes
  |=  [saved=state-0 sid=@t who=@t name=@t]
  (memory-writes-with lane-scry saved sid who name)
++  memory-writes-with
  |=  [scry=$-(path (unit vase)) saved=state-0 sid=@t who=@t name=@t]
  =/  m  (mare ,[results=(map @t @t) after=state-0])
  ^-  form:m
  =/  revision  (scot %ud revision:(~(got by records.knowledge.saved) name))
  ;<  ~  bind:m  (load saved scry)
  ;<  asked=(list card)  bind:m  (hear sid who 'ask' 'Keep a note of this.')
  ;<  *  bind:m
    %+  do-arvo  wire:(snag 0 (model-requests asked))
    %+  answer  ''
    :~  ['save-1' 'memory' '{"operation":"save","name":"fresh-note","text":"Noted.","revision":"0"}']
        :+  'forget-1'  'memory'
        (rap 3 '{"operation":"forget","name":"' name '","revision":"' revision '"}' ~)
    ==
  ;<  after=state-0  bind:m  get-state
  =/  results
    %+  murn  log:(~(got by sessions.after) sid)
    |=  =event:h
    ^-  (unit [@t @t])
    ?.  ?=(%tool-completed -.event)  ~
    `[call-id.event body.event]
  (pure:m [(malt results) after])
::  A turn that answers someone other than the owner saves and forgets
::  nothing through the memory tool, though the place rule would let it.
::
++  ex-memory-writes-refused
  |=  [saved=state-0 sid=@t who=@t name=@t]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [results=(map @t @t) after=state-0]  bind:m  (memory-writes saved sid who name)
  =/  refusal  (cat 3 'error: ' refused-memory:command)
  ;<  ~  bind:m
    (ex-equal !>(results) !>(`(map @t @t)`(malt ~[['save-1' refusal] ['forget-1' refusal]])))
  (ex-equal !>(records.knowledge.after) !>(records.knowledge.saved))
::  Both writes succeeded: the new fact is saved and .name forgotten.
::
++  ex-memory-writes-saved
  |=  [results=(map @t @t) after=state-0 name=@t]
  =/  m  (mare ,~)
  ^-  form:m
  =/  failed  |=(call=@t =('error: ' (end [3 7] (~(got by results) call))))
  ;<  ~  bind:m  (ex-equal !>([(failed 'save-1') (failed 'forget-1')]) !>([| |]))
  ;<  ~  bind:m
    %+  ex-equal  !>(body.value:(~(got by records.knowledge.after) 'fresh-note'))
    !>(`'Noted.')
  (ex-equal !>(body.value:(~(got by records.knowledge.after) name)) !>(~))
::
++  test-a-guests-memory-tool-cannot-save-or-forget-in-a-channel
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  (seed owned 'room-note' 'The room meets on Fridays.' 'room' '~bus' |)
  (ex-memory-writes-refused saved 'room' '~bus' 'room-note')
::
++  test-a-dm-partners-memory-tool-cannot-save-or-forget-in-their-dm
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  (seed owned 'dm-note' 'Bus likes tea.' 'dm' '~bus' |)
  (ex-memory-writes-refused saved 'dm' '~bus' 'dm-note')
::  The owner's turns in their DM still save and forget, by command and by
::  the memory tool, and still change the DM's model.
::
++  test-the-owners-turns-still-save-and-forget
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  (seed owned 'owner-note' 'Owner likes tea.' 'owner' '~nec' |)
  ;<  [results=(map @t @t) after=state-0]  bind:m
    (memory-writes saved 'owner' '~nec' 'owner-note')
  ;<  ~  bind:m  (ex-memory-writes-saved results after 'owner-note')
  ;<  ~  bind:m  (load owned lane-scry)
  ;<  *  bind:m  (hear 'owner' '~nec' 'save' '/remember falcon The falcon codeword is vexillum.')
  ;<  remembered=state-0  bind:m  get-state
  ;<  *  bind:m  (hear 'owner' '~nec' 'forget' '/forget falcon')
  ;<  forgotten=state-0  bind:m  get-state
  ;<  *  bind:m  (hear 'owner' '~nec' 'model' '/model other-model')
  ;<  changed=state-0  bind:m  get-state
  ;<  ~  bind:m
    %+  ex-equal  !>(body.value:(~(got by records.knowledge.remembered) 'falcon'))
    !>(`'The falcon codeword is vexillum.')
  ;<  ~  bind:m  (ex-equal !>(body.value:(~(got by records.knowledge.forgotten) 'falcon')) !>(~))
  (ex-equal !>((model log:(~(got by sessions.changed) 'owner'))) !>('other-model'))
::  A run of .actor's schedule in their DM, .sid, which already learned
::  .name; the hand answers that no speaker changes a run's settings. The
::  run's memory writes.
::
++  scheduled-writes
  |=  [actor=@t sid=@t name=@t]
  =/  m  (mare ,[results=(map @t @t) after=state-0])
  ^-  form:m
  =/  saved  (seed owned name 'A fact the DM learned.' sid actor |)
  =/  source=binding:hh  ['tlon' (cat 3 'dm/' actor) sid ~[actor] &]
  =/  args
    %-  pairs:enjs:format
    :~  ['schedule' %s '* * * * *']  ['timezone' %s 'UTC']  ['prompt' %s 'Check status']
        ['runs' %s '2']
    ==
  =/  job  (create:schedule [%add 0v1 sid actor %prompt args] source ~ t0)
  =/  run  run-sid.job
  =.  schedules.saved  (my ~[[0v1 job]])
  =.  sessions.saved  (~(put by sessions.saved) run (idle saved))
  =.  bindings.hands.saved  (~(put by bindings.hands.saved) run source(sid run))
  =/  scry
    |=  =path
    ^-  (unit vase)
    ?:  ?=([%gx @ %harness-tlon @ %settings @ @ %noun ~] path)  `!>(|)
    (lane-scry path)
  (memory-writes-with scry saved run actor name)
::  A run of the owner's schedule answers for the owner.
::
++  test-the-owners-scheduled-run-still-saves-and-forgets
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [results=(map @t @t) after=state-0]  bind:m
    (scheduled-writes '~nec' 'owner' 'owner-note')
  (ex-memory-writes-saved results after 'owner-note')
::  A run of anyone else's schedule answers for them, so it saves and
::  forgets nothing.
::
++  test-another-ships-scheduled-run-cannot-save-or-forget
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  before  (seed owned 'dm-note' 'A fact the DM learned.' 'dm' '~bus' |)
  ;<  [results=(map @t @t) after=state-0]  bind:m
    (scheduled-writes '~bus' 'dm' 'dm-note')
  =/  refusal  (cat 3 'error: ' refused-memory:command)
  ;<  ~  bind:m
    (ex-equal !>(results) !>(`(map @t @t)`(malt ~[['save-1' refusal] ['forget-1' refusal]])))
  (ex-equal !>(records.knowledge.after) !>(records.knowledge.before))
::  The channel facts a multi-term search ranks: five fillers' worth of
::  common terms, and two facts that tie when no private count is used.
::  .private adds an owner fact that shares one of the terms.
::
++  searchable
  |=  private=?
  ^-  state-0
  =/  fillers=(list [word=@t count=@ud])
    ~[['golf' 11] ['alpha' 12] ['bravo' 12] ['charlie' 13] ['delta' 13] ['echo' 20]]
  =/  saved
    %+  roll  fillers
    |=  [[word=@t count=@ud] saved=_owned]
    %+  roll  (gulf 1 count)
    |=  [n=@ud saved=_saved]
    =/  tag  (crip (a-co:co n))
    (seed saved (rap 3 word '-' tag ~) (rap 3 word ' filler ' tag ~) 'room' '~bus' |)
  =.  saved  (seed saved 'pair-b' 'alpha bravo' 'room' '~bus' |)
  =.  saved  (seed saved 'pair-a' 'golf echo' 'room' '~bus' |)
  ?.  private  saved
  (seed saved 'secret-echo' 'echo private' '' '~zod' |)
::  A channel's search answers the same whether or not a private fact shares
::  its terms: no count that includes unseen facts orders or scores it.
::
++  test-a-private-save-does-not-change-a-channels-search-order
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  query  '/memory alpha bravo charlie delta echo golf'
  ;<  ~  bind:m  (load (searchable |) lane-scry)
  ;<  *  bind:m  (hear 'room' '~bus' 'search' query)
  ;<  before=state-0  bind:m  get-state
  ;<  ~  bind:m  (load (searchable &) lane-scry)
  ;<  *  bind:m  (hear 'room' '~bus' 'search' query)
  ;<  after=state-0  bind:m  get-state
  =/  answer-of  |=(saved=state-0 (reply log:(~(got by sessions.saved) 'room')))
  =/  first  (answer-of before)
  ;<  ~  bind:m  (ex-equal !>(?=(^ first)) !>(&))
  (ex-equal !>((answer-of after)) !>(first))
::  ~bus's DM sees the channel's fact, but even the operator's own prompt
::  there cannot replace or forget it with /remember or /forget; the fact is
::  unchanged and the channel still lists it.
::
++  test-a-non-owner-dm-cannot-save-over-or-forget-a-channel-fact
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  (seed owned 'standup' 'Standup is at nine.' 'room' '~nec' |)
  =/  refusal  `'This conversation cannot change a memory learned in another place.'
  =/  send  |=(text=@t (do-poke %harness-action !>(`action:h`[%send 'dm' text])))
  ;<  ~  bind:m  (load saved lane-scry)
  ;<  *  bind:m  (send '/remember standup Standup is cancelled.')
  ;<  saving=state-0  bind:m  get-state
  ;<  *  bind:m  (send '/forget standup')
  ;<  forgetting=state-0  bind:m  get-state
  ;<  *  bind:m  (hear 'room' '~bus' 'read' '/memory standup')
  ;<  after=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>((reply log:(~(got by sessions.saving) 'dm'))) !>(refusal))
  ;<  ~  bind:m  (ex-equal !>((reply log:(~(got by sessions.forgetting) 'dm'))) !>(refusal))
  ;<  ~  bind:m
    %+  ex-equal  !>((~(got by records.knowledge.after) 'standup'))
    !>((~(got by records.knowledge.saved) 'standup'))
  (ex-equal !>((reply log:(~(got by sessions.after) 'room'))) !>(`'Shared memories:\0astandup: Standup is at nine.\0a'))
::  When the adapter's trust read fails, the reach is still built and it is
::  narrow: no preference qualifies as the owner's, so the channel's
::  admitted owner preference is not rendered, and the read still answers.
::
++  test-a-reach-built-while-the-adapter-read-fails-is-narrow
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  owned
  =.  turns.knowledge.saved
    (~(put by turns.knowledge.saved) 'room' [0v0 ~ '~bus' ~[':owner-style']])
  ::  A trust answer of the wrong shape makes the read crash inside the head.
  =/  failing
    |=  =path
    ^-  (unit vase)
    ?:  ?=([%gx @ %harness-tlon @ %peer-trust %noun ~] path)  `!>(%malformed)
    (lane-scry path)
  =/  shown
    |=  =cage
    ^-  ?
    ?=(^ (find "Prefer replies in haiku." (trip (en:json:html !<(json q.cage)))))
  ;<  ~  bind:m  (load saved lane-scry)
  ;<  working=cage  bind:m  (got-peek /x/snapshot/room)
  ;<  ~  bind:m  (load saved failing)
  ;<  failed=cage  bind:m  (got-peek /x/snapshot/room)
  ;<  ~  bind:m  (ex-equal !>((shown working)) !>(&))
  (ex-equal !>((shown failed)) !>(|))
--

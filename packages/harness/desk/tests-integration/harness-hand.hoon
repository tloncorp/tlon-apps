::  Hand admission through the full head, driven by test-agent; no card is
::  delivered and every scry answers %.n.
/-  h=harness, hh=harness-hand, t=harness-tlon, adapter=harness-adapter, *harness-store
/+  *test-agent, policy=harness-defaults, hd=harness-hand, hl=harness,
    command=harness-command
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
::  hand. The hand lets only ~nec, the owner, change the channel, and ~bus
::  change their own DM.
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
  ?.  ?=([%gx @ %harness-tlon @ %settings @ @ %noun ~] parts)  (owner-scry path)
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
++  test-a-dm-partner-keeps-their-commands
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  log=(list event:h)  bind:m  (say 'dm' '~bus' '/model other-model')
  ;<  ~  bind:m  (ex-equal !>((model log)) !>('other-model'))
  ;<  log=(list event:h)  bind:m  (say 'dm' '~bus' '/memory off')
  (ex-equal !>(=((reply log) `refused:command)) !>(|))
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

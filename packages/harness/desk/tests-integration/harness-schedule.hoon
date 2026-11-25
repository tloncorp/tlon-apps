::  Full-agent persistence and timer checks; emitted cards are never executed.
::  -test /=harness=/tests-integration/harness-schedule
/-  c=harness-cron, hh=harness-hand, h=harness, ac=acp, renew=harness-oauth,
    adapter=harness-adapter, t=harness-tlon, *harness-store
/+  *test-agent, schedule=harness-schedule, defaults=harness-defaults, hl=harness,
    tools=harness-tools, auth=harness-auth, hd=harness-hand
/=  head  /app/harness
|%
++  t0  ~2026.9.9
++  job
  ^-  schedule:c
  =/  act=action:c
    :*  %add  0v1  'source-binding'  'alice'  %prompt
        %-  pairs:enjs:format
        :~  ['schedule' %s '* * * * *']  ['timezone' %s 'UTC']  ['prompt' %s 'Check status']
            ['runs' %s '2']
        ==
    ==
  (create:schedule act ['fixture-chat' 'room' 'source' ~['alice'] &] ~ ~2026.9.9)
++  fixture
  ^-  state-0
  =/  s=state-0  *state-0
  =/  cfg  builtin-config:defaults
  =.  defaults.s  cfg(tools ~)
  =.  sessions.s
    %-  my
    :~  ['source' [~[[%config-replaced defaults.s]] 1]]
        ['schedule-0v1' [~[[%config-replaced defaults.s]] 2]]
    ==
  =.  bindings.hands.s
    %-  my
    :~  ['source-binding' ['fixture-chat' 'room' 'source' ~['alice'] &]]
        ['schedule-0v1' ['fixture-chat' 'room' 'schedule-0v1' ~['alice'] &]]
    ==
  s
::  Every scry answers %.n, as the old sandbox did: among others, %gu says
::  %harness-tlon isn't running.
::
++  prepare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now t0)))
  (set-scry-gate |=(path `!>(|)))
::  Load from saved state. Loading opens the ACP subscription that frames
::  arrive on.
::
++  setup
  |=  s=state-0
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  prepare
  ;<  *  bind:m  (do-load head `!>(s))
  (pure:m ~)
::  Reload, then fire the schedule wake the load set a tick later, as behn
::  does once every agent on the desk has loaded.
::
++  reload
  |=  s=state-0
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  =bowl  bind:m  get-bowl
  ;<  loaded=(list card)  bind:m  (do-load head `!>(s))
  ;<  ~  bind:m  (wait ~s1)
  ;<  woken=(list card)  bind:m
    (do-arvo /schedules/(scot %da +(now.bowl)) [%behn %wake ~])
  (pure:m (weld loaded woken))
::  Every read of the saved state also checks that the head's index equals
::  the derivation of its ledger.
::
++  get-state
  =/  m  (mare ,state-0)
  ^-  form:m
  ;<  ledger=cage  bind:m  (got-peek /x/hand-state)
  ;<  index=cage  bind:m  (got-peek /x/hand-index)
  ;<  ~  bind:m  (ex-equal q.index !>((reindex:hd !<(state:hh q.ledger))))
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-0 vase))
++  do-frame
  |=  payload=@t
  =/  =update:v1:ac  [%messages 'fixture' %agent ~[[1 t0 payload]]]
  (do-agent /acp/watch [~zod %acp] [%fact %acp-update-1 !>(update)])
++  test-delete-detaches-hands-and-cancels-source-and-run-schedules
  %-  eval-mare
  ;<  ~  bind:(mare ,~)  (delete-detaches 'source')
  (delete-detaches 'schedule-0v1')
++  delete-detaches
  |=  sid=@t
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  fixture
  =.  schedules.s  (my ~[[0v1 job]])
  ;<  ~  bind:m  (setup s)
  =/  payload
    %-  en:json:html
    %-  pairs:enjs:format
    :~  ['jsonrpc' %s '2.0']  ['id' %n '1']  ['method' %s 'session/delete']
        ['params' (pairs:enjs:format ~[['sessionId' %s sid]])]
    ==
  ;<  out=(list card)  bind:m  (do-frame payload)
  ;<  next=state-0     bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>((~(has by sessions.next) sid)) !>(|))
  ;<  ~  bind:m  (ex-equal !>(state:(~(got by schedules.next) 0v1)) !>(%cancelled))
  ;<  ~  bind:m  (ex-equal !>(enabled:(~(got by bindings.hands.next) 'schedule-0v1')) !>(|))
  ;<  ~  bind:m
    %+  ex-equal
      !>((lien ~(val by bindings.hands.next) |=(b=binding:hh &(=(sid sid.b) enabled.b))))
    !>(|)
  (ex-equal !>((requests out)) !>(~))
++  test-reload-replaces-one-timer-without-spending-budget
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  fixture
  =/  job  job
  =.  schedules.s  (my ~[[0v1 job]])
  =.  schedule-wake.s  `next.job
  ;<  ~                bind:m  prepare
  ;<  out=(list card)  bind:m  (do-load head `!>(s))
  ;<  next=state-0     bind:m  get-state
  ::  The saved wake is cancelled and exactly one fresh one is set, a tick
  ::  after the load.
  =/  at  next.job
  ;<  ~  bind:m
    %+  ex-cards  (timers out)
    :~  (ex-arvo /schedules/(scot %da at) %b %rest at)
        (ex-arvo /schedules/(scot %da +(t0)) %b %wait +(t0))
    ==
  ;<  ~  bind:m  (ex-equal !>(schedules.next) !>(schedules.s))
  (ex-equal !>(schedule-wake.next) !>(`+(t0)))
::  Gall reloads a desk's agents one by one, so the head can load while the
::  Tlon hand still runs its previous code, which serves no per-speaker
::  authority. Loading must not read it: any read of that path fails here.
::
++  test-reload-reads-no-hand-authority-before-the-hand-reloads
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  fixture
  =.  bindings.hands.s
    %-  my
    :~  ['source-binding' ['tlon' 'room' 'source' ~['alice'] &]]
        ['schedule-0v1' ['tlon' 'room' 'schedule-0v1' ~['alice'] &]]
    ==
  =/  j  job
  =.  hand.j  'tlon'
  =.  schedules.s  (my ~[[0v1 j]])
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now t0)))
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ^-  (unit vase)
    ?:  ?=([%gu @ %harness-tlon @ %$ ~] path)  `!>(&)
    ?:  ?=([%gx @ %harness-tlon @ %authority @ %noun ~] path)
      `!>(`hand-authority:adapter`[& ~])
    ?:  ?=([%gx @ %harness-tlon *] path)  ~
    `!>(|)
  ;<  out=(list card)  bind:m  (do-load head `!>(s))
  ;<  next=state-0     bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>(schedules.next) !>(schedules.s))
  (ex-equal !>(schedule-wake.next) !>(`+(t0)))
++  timers
  |=  cards=(list card)
  (skim cards |=(=card ?=([%pass [%schedules *] %arvo %b *] card)))
++  test-delete-cancels-running-and-queued-input-without-publishing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  fixture
  =.  sessions.s
    %+  ~(put by sessions.s)
      'source'
    :*  :~  [%llm-requested 0 %turn]  [%input-admitted [%user 'Running input']]
            [%config-replaced defaults.s]
        ==
        1
    ==
  =.  observations.hands.s
    %-  my
    :~  [0v1 ['source-binding' 'running' 'alice' 'Running input' ~2026.9.9 %running]]
        [0v2 ['source-binding' 'queued' 'alice' 'Queued input' ~2026.9.9 %queued]]
    ==
  =.  active.hands.s  (my ~[['source' 0v1]])
  =.  queue.hands.s  ~[0v2]
  ;<  ~                bind:m  (setup s)
  ;<  out=(list card)  bind:m  (do-poke %harness-action !>(`action:h`[%delete 'source']))
  ;<  next=state-0     bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>((~(has by sessions.next) 'source')) !>(|))
  ;<  ~  bind:m  (ex-equal !>(active.hands.next) !>(~))
  ;<  ~  bind:m  (ex-equal !>(queue.hands.next) !>(~))
  ;<  ~  bind:m  (ex-equal !>(phase:(~(got by observations.hands.next) 0v1)) !>(%cancelled))
  ;<  ~  bind:m  (ex-equal !>(phase:(~(got by observations.hands.next) 0v2)) !>(%cancelled))
  ;<  ~  bind:m  (ex-equal !>(status:(~(got by outbox.hands.next) 0v1)) !>(%abandoned))
  (ex-equal !>((requests out)) !>(~))
++  test-scheduled-work-keeps-bookkeeping-and-human-reply-context
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  fixture
  =/  cfg  defaults.s(tools ~[%workspace])
  =.  sessions.s  (~(put by sessions.s) 'source' [~[[%config-replaced cfg]] 1])
  =/  act=action:c
    :*  %add  0v2  'source-binding'  'alice'  %prompt
        %-  pairs:enjs:format
        ~[['at' %s '2026-09-09T00:01:17Z'] ['prompt' %s 'Finish the task and report the result']]
    ==
  ;<  ~             bind:m  (setup s)
  ;<  *             bind:m  (do-poke %harness-cron !>(`request:c`['fixture' act]))
  ;<  next=state-0  bind:m  get-state
  =/  v  (play:hl log:(~(got by sessions.next) 'schedule-0v2'))
  =/  has
    |=  text=tape
    ?=(^ (find text (trip system.config.v)))
  ;<  ~  bind:m  (ex-equal !>((tool-granted:tools 'workspace' tools.config.v)) !>(&))
  ;<  ~  bind:m  (ex-equal !>(next:(~(got by schedules.next) 0v2)) !>(~2026.9.9..00.01.17))
  ;<  ~  bind:m  (ex-equal !>((tool-granted:tools 'calculate' tools.config.v)) !>(&))
  ;<  ~  bind:m  (ex-equal !>((tool-granted:tools 'schedule_once' tools.config.v)) !>(|))
  ;<  ~  bind:m  (ex-equal !>((tool-granted:tools 'harness_admin' tools.config.v)) !>(|))
  ;<  ~  bind:m  (ex-equal !>((has "Your final message goes directly to the human")) !>(&))
  ;<  ~  bind:m  (ex-equal !>((has "maintain its records silently")) !>(&))
  ;<  ~  bind:m
    %+  ex-equal
      !>((has "Internal task references in the brief are for tools only"))
    !>(&)
  ;<  ~  bind:m  (ex-equal !>((has "both work records and the reply")) !>(&))
  (ex-equal !>(items.v) !>(~))
++  test-reads-and-acks-with-an-active-schedule-do-not-read-authority
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  fixture
  =/  job  job
  =.  tools.job  ~[%admin]
  =.  schedules.s  (my ~[[0v1 job]])
  ::  A real actor makes live grant evaluation consult the identity boundary.
  ::  Loading may validate it; the subsequent read and ACK must not do so.
  =.  sessions.s
    %+  ~(put by sessions.s)
      'source'
    :*  :~  [%input-received [0v9 [%acp 'fixture'] `~zod ~ ~2026.9.9 [%user 'fixture']]]
            [%config-replaced defaults.s]
        ==
        1
    ==
  ;<  ~              bind:m  (setup s)
  ;<  ready=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>(state:(~(got by schedules.ready) 0v1)) !>(%active))
  ::  From here any attempted scry, authority included, fails the step.
  ;<  ~                 bind:m  (set-scry-gate |=(path ~))
  ;<  ack=(list card)   bind:m  (do-agent /acp/ack [~zod %acp] [%poke-ack ~])
  ;<  read=(list card)  bind:m
    (do-frame '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}')
  ;<  next=state-0      bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>(schedules.next) !>(schedules.ready))
  ;<  ~  bind:m  (ex-equal !>(schedule-wake.next) !>(schedule-wake.ready))
  ;<  ~  bind:m  (ex-equal !>((lent read)) !>(2))
  (ex-equal !>(ack) !>(~))
++  test-overdue-tlon-schedule-waits-while-adapter-is-stopped
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  fixture
  =.  bindings.hands.s
    %-  my
    :~  ['source-binding' ['tlon' 'room' 'source' ~['alice'] &]]
        ['schedule-0v1' ['tlon' 'room' 'schedule-0v1' ~['alice'] &]]
    ==
  =/  j  job
  =.  hand.j  'tlon'
  =.  schedules.s  (my ~[[0v1 j]])
  ;<  ~             bind:m  prepare
  ;<  ~             bind:m  (wait ~d1)
  ;<  *             bind:m  (do-load head `!>(s))
  ;<  next=state-0  bind:m  get-state
  =/  kept  (~(got by schedules.next) 0v1)
  ;<  ~  bind:m  (ex-equal !>(state.kept) !>(%active))
  ;<  ~  bind:m  (ex-equal !>(remaining.kept) !>(remaining.j))
  (ex-equal !>(observations.hands.next) !>(~))
++  test-added-tools-preserve-schedule-ceilings-and-revocation-pauses
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  fixture
  =/  cfg  defaults.s(tools ~[%web %workspace])
  =.  sessions.s  (~(put by sessions.s) 'source' [~[[%config-replaced cfg]] 1])
  =/  j  job
  =.  tools.j  ~[%web]
  =.  schedules.s  (my ~[[0v1 j]])
  ;<  ~             bind:m  (setup s)
  ;<  next=state-0  bind:m  get-state
  =.  sessions.next
    %+  ~(put by sessions.next)
      'source'
    [~[[%config-replaced cfg(tools ~[%workspace])]] 1]
  ;<  *                bind:m  (reload next)
  ;<  revoked=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>(state:(~(got by schedules.next) 0v1)) !>(%active))
  ;<  ~  bind:m  (ex-equal !>(tools:(~(got by schedules.next) 0v1)) !>(~[%web]))
  (ex-equal !>(state:(~(got by schedules.revoked) 0v1)) !>(%paused))
++  test-edit-is-versioned-and-delete-retains-history
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  fixture
  =.  schedules.s  (my ~[[0v1 job]])
  =/  args
    %-  pairs:enjs:format
    :~  ['schedule' %s '0 9 * * *']  ['timezone' %s 'UTC']  ['prompt' %s 'Check deployment status']
        ['runs' %s '5']
    ==
  =/  =request:c  ['edit' [%edit 0v1 (sham job) args]]
  ;<  ~                  bind:m  (setup s)
  ;<  *                  bind:m  (do-poke %harness-cron !>(request))
  ;<  next=state-0       bind:m  get-state
  ;<  *                  bind:m  (do-poke %harness-cron !>(request))
  ;<  unchanged=state-0  bind:m  get-state
  ;<  *                  bind:m  (do-poke %harness-cron !>(`request:c`['delete' [%delete 0v1]]))
  ;<  final=state-0      bind:m  get-state
  ;<  ~  bind:m
    %+  ex-equal
      !>(prompt:(~(got by schedules.next) 0v1))
    !>('Check deployment status')
  ;<  ~  bind:m  (ex-equal !>(remaining:(~(got by schedules.next) 0v1)) !>(5))
  ;<  ~  bind:m  (ex-equal !>(schedules.unchanged) !>(schedules.next))
  ;<  ~  bind:m  (ex-equal !>(schedules.final) !>(~))
  ;<  ~  bind:m  (ex-equal !>((~(has by sessions.final) 'schedule-0v1')) !>(&))
  (ex-equal !>(enabled:(~(got by bindings.hands.final) 'schedule-0v1')) !>(|))
::  A schedule's run gets a binding of its own, and a ledger past 256
::  bindings, enabled and disabled, still binds each new one.
++  test-schedules-are-added-on-a-ledger-past-256-bindings
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  fixture
  =.  bindings.hands.s
    %-  ~(gas by bindings.hands.s)
    %+  turn  (gulf 1 300)
    |=  k=@ud
    ^-  [@t binding:hh]
    =/  id  (cat 3 'seeded-' (scot %ud k))
    [id ['fixture-chat' (cat 3 'room/' (scot %ud k)) id ~['alice'] =(0 (mod k 2))]]
  =/  add
    |=  id=@uv
    ^-  request:c
    :-  'add'
    :*  %add  id  'source-binding'  'alice'  %prompt
        %-  pairs:enjs:format
        :~  ['schedule' %s '0 9 * * *']  ['timezone' %s 'UTC']  ['prompt' %s 'Check status']
            ['runs' %s '5']
        ==
    ==
  ;<  ~               bind:m  (setup s)
  ;<  *               bind:m  (do-poke %harness-cron !>((add 0v2)))
  ;<  added=state-0   bind:m  get-state
  ;<  *               bind:m  (do-poke %harness-cron !>(`request:c`['cancel' [%cancel 0v2]]))
  ;<  *               bind:m  (do-poke %harness-cron !>(`request:c`['clear' [%clear 0v2]]))
  ;<  cleared=state-0  bind:m  get-state
  ;<  *               bind:m  (do-poke %harness-cron !>((add 0v3)))
  ;<  again=state-0   bind:m  get-state
  =/  enabled
    |=  [next=state-0 id=@t]
    (bind (~(get by bindings.hands.next) id) |=(b=binding:hh enabled.b))
  ;<  ~  bind:m  (ex-equal !>(state:(~(got by schedules.added) 0v2)) !>(%active))
  ;<  ~  bind:m  (ex-equal !>((enabled added 'schedule-0v2')) !>(`&))
  ;<  ~  bind:m  (ex-equal !>((~(has by schedules.cleared) 0v2)) !>(|))
  ;<  ~  bind:m  (ex-equal !>((enabled cleared 'schedule-0v2')) !>(`|))
  ;<  ~  bind:m  (ex-equal !>(state:(~(got by schedules.again) 0v3)) !>(%active))
  ;<  ~  bind:m  (ex-equal !>((enabled again 'schedule-0v3')) !>(`&))
  (ex-equal !>(~(wyt by bindings.hands.again)) !>(304))
++  requests
  |=  cards=(list card)
  ^-  (list http-card:renew)
  %+  murn
    cards
  |=  =card
  ^-((unit http-card:renew) ?:(?=([%pass [%llm *] %arvo %i %request *] card) `card ~))
++  failed-fixture
  ^-  state-0
  =/  s  fixture
  =/  j  job
  =.  last.j  `0v9
  =.  schedules.s  (my ~[[0v1 j]])
  =/  cfg  defaults.s(url device-url:auth, model 'fixture-model')
  =/  input=admitted-input:h
    :*  0v9  [%hand run-sid.j hand.j destination.j 'tick' actor.j]  ~  `[%hand run-sid.j]  ~2026.9.9
        [%user prompt.j]
    ==
  =/  log=(list event:h)
    :~  [%llm-failed 2 'http error 401: token_expired']
        [%llm-requested 2 %turn]
        [%tool-completed 'status' 'current_time' '2026-09-09T00:00:00Z']
        [%tool-requested 'status' 'current_time']
        [%llm-completed 1 %tool-calls [0 0] [%assistant '' ~[['status' 'current_time' '{}']]]]
        [%llm-requested 1 %turn]
        [%input-received input]
        [%config-replaced cfg]
    ==
  =.  sessions.s  (~(put by sessions.s) run-sid.j [log 3])
  =.  provider-keys.s  (my ~[['openai-device' 'current-subscription-token']])
  =.  observations.hands.s  (my ~[[0v9 [run-sid.j 'tick' actor.j prompt.j ~2026.9.9 %failed]]])
  =.  outbox.hands.s
    %-  my
    :~  :*  0v9
            :*  0v9  run-sid.j  hand.j  destination.j  run-sid.j  %failure  'Authentication failed'
                %delivered  'worker'  'failure-post'  ~
            ==
        ==
    ==
  s
++  test-retry-uses-shared-login-preserves-budget-and-publishes-once
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  failed-fixture
  =/  =request:c  ['retry' [%retry 0v1 0v9]]
  ;<  ~                      bind:m  (setup s)
  ;<  retried=(list card)    bind:m  (do-poke %harness-cron !>(request))
  ;<  next=state-0           bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>((lent (requests retried))) !>(1))
  =/  http  (snag 0 (requests retried))
  ;<  duplicate=(list card)  bind:m  (do-poke %harness-cron !>(request))
  =/  success=client-response:iris
    :*  %finished  [200 ~]
        :-  ~
        :*  'text/event-stream'
            %-  as-octs:mimes:html
            'data: {"type":"response.output_item.done","item":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Deployment is healthy."}]}}\0a\0adata: {"type":"response.completed","response":{"usage":{"input_tokens":30,"output_tokens":5}}}\0a\0a'
        ==
    ==
  ;<  *                bind:m  (do-arvo wire.http [%iris %http-response success])
  ;<  final=state-0    bind:m  get-state
  =/  j  (~(got by schedules.final) 0v1)
  =/  publication  (~(got by outbox.hands.final) (need last.j))
  ;<  *                bind:m  (do-arvo wire.http [%iris %http-response success])
  ;<  repeated=state-0  bind:m  get-state
  ;<  ~  bind:m
    %+  ex-equal
      !>  %+  lien
            header-list.request.http
          |=  [key=@t value=@t]
          &(=('authorization' key) =('Bearer current-subscription-token' value))
    !>(&)
  ;<  ~  bind:m  (ex-equal !>(remaining.j) !>(2))
  ;<  ~  bind:m  (ex-equal !>(next.j) !>(next:(~(got by schedules.s) 0v1)))
  ;<  ~  bind:m  (ex-equal !>((requests duplicate)) !>(~))
  ;<  ~  bind:m
    %+  ex-equal
      !>(items:(play:hl log:(~(got by sessions.next) run-sid.j)))
    !>(items:(play:hl log:(~(got by sessions.s) run-sid.j)))
  ;<  ~  bind:m  (ex-equal !>(kind.publication) !>(%reply))
  ;<  ~  bind:m  (ex-equal !>(body.publication) !>('Deployment is healthy.'))
  ;<  ~  bind:m  (ex-equal !>(status.publication) !>(%pending))
  ;<  ~  bind:m  (ex-equal !>(~(wyt by outbox.hands.final)) !>(2))
  (ex-equal !>(outbox.hands.repeated) !>(outbox.hands.final))
++  test-retry-refuses-uncertain-delivery-and-revoked-authority
  %-  eval-mare
  ;<  ~  bind:(mare ,~)  (retry-refused %.y)
  (retry-refused %.n)
++  retry-refused
  |=  uncertain=?
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  failed-fixture
  =/  pub  (~(got by outbox.hands.s) 0v9)
  =?  outbox.hands.s  uncertain  (my ~[[0v9 pub(status %uncertain)]])
  =?  bindings.hands.s  !uncertain
    %+  ~(put by bindings.hands.s)
      'source-binding'
    ['fixture-chat' 'room' 'source' ~['alice'] |]
  ;<  ~                    bind:m  (setup s)
  ;<  retried=(list card)  bind:m
    (do-poke %harness-cron !>(`request:c`['retry' [%retry 0v1 0v9]]))
  ;<  final=state-0        bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>((requests retried)) !>(~))
  (ex-equal !>(last:(~(got by schedules.final) 0v1)) !>(`0v9))
++  tool-fixture
  |=  [name=@t args=@t actor=@t]
  ^-  state-0
  =/  s  fixture
  =/  job  job
  =/  cfg  defaults.s
  =/  call=tool-call:h  ['control' name args]
  =/  input=admitted-input:h
    :*  0v8  [%hand 'source-binding' 'fixture-chat' 'room' 'human-request' actor]  ~
        `[%hand 'source-binding']  ~2026.9.9  [%user 'Manage my schedule']
    ==
  =/  log=(list event:h)
    :~  [%tool-requested-2 4 'control' name]
        [%llm-completed 3 %tool-calls [0 0] [%assistant '' ~[call]]]  [%llm-requested 3 %turn]
        [%input-received input]  [%config-replaced cfg]
    ==
  =.  sessions.s  (~(put by sessions.s) 'source' [log 4])
  =.  observations.hands.s
    %-  my
    ~[[0v8 ['source-binding' 'human-request' actor 'Manage my schedule' ~2026.9.9 %running]]]
  =.  active.hands.s  (my ~[['source' 0v8]])
  =.  schedules.s
    %-  my
    :~  [0v1 job]  [0v2 job(actor 'bob', run-sid 'schedule-0v2', prompt 'PRIVATE-BOB')]
        [0v3 job(binding 'elsewhere', run-sid 'schedule-0v3', prompt 'PRIVATE-ROOM')]
    ==
  s
++  do-tool
  |=  [name=@t args=@t]
  =/  req=tool-request:adapter  ['source' 4 ['control' name args]]
  (do-poke %harness-tool !>(req))
++  test-tool-list-hides-other-users-and-other-conversations
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~                bind:m  (setup (tool-fixture 'cron_list' '{}' 'alice'))
  ;<  out=(list card)  bind:m  (do-tool 'cron_list' '{}')
  =/  body=@t
    =/  fact  (need (lien-card out))
    !<(@t q.cage.sign.fact)
  ;<  ~  bind:m  (ex-equal !>(?=(^ (find "Check status" (trip body)))) !>(&))
  (ex-equal !>(?=(~ (find "PRIVATE" (trip body)))) !>(&))
++  lien-card
  |=  cards=(list card)
  ^-  (unit [dt=%give sign=[tag=%fact paths=(list path) cage=cage]])
  ?~  cards  ~
  ?:  ?=([%give %fact * *] i.cards)  `i.cards
  $(cards t.cards)
++  test-tools-refuse-other-actors-cross-binding-and-revoked-callers
  %-  eval-mare
  %-  tools-refused
  %-  zing
  %+  turn  `(list @t)`~['alice' 'mallory']
  |=  actor=@t
  %+  turn  `(list @t)`~['cron_remove' 'cron_delete' 'cron_update' 'cron_retry']
  |=(name=@t [actor name])
++  tools-refused
  |=  cases=(list [actor=@t name=@t])
  =/  m  (mare ,~)
  ^-  form:m
  ?~  cases  (pure:m ~)
  =/  args  '{"id":"0v2","revision":"0v0","input":"0v9","args":{}}'
  ;<  ~                bind:m  (setup (tool-fixture name.i.cases args actor.i.cases))
  ;<  before=state-0   bind:m  get-state
  ;<  out=(list card)  bind:m  (do-tool name.i.cases args)
  ;<  next=state-0     bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>(schedules.next) !>(schedules.before))
  ;<  ~  bind:m  (ex-equal !>((requests out)) !>(~))
  (tools-refused t.cases)
++  test-permissioned-human-can-delete-own-schedule
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  args  '{"id":"0v1"}'
  ;<  ~             bind:m  (setup (tool-fixture 'cron_delete' args 'alice'))
  ;<  *             bind:m  (do-tool 'cron_delete' args)
  ;<  next=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>((~(has by schedules.next) 0v1)) !>(|))
  ;<  ~  bind:m  (ex-equal !>((~(has by schedules.next) 0v2)) !>(&))
  (ex-equal !>((~(has by schedules.next) 0v3)) !>(&))
::  Tlon conversations, with ~nec as the bot's owner. The scry gate answers
::  for the Tlon hand: the owner's lane has no ceiling, anyone else's lane is
::  limited to its conversation tools, and only the owner's DM administers.
::
+$  lane  [actor=@p dm=? ceiling=(unit (list tool-grant:h))]
++  owner-dm  'dm/~nec'
++  bus-dm  'dm/~bus'
++  room  'chat/~lux/test'
++  room-thread  (rap 3 room '/' (scot %da t0) ~)
++  trusted-ceiling  `(list tool-grant:h)`~[%tlon-read %tlon-write]
++  allowed-ceiling  `(list tool-grant:h)`~[%web %tlon-read %tlon-write]
++  tlon-scry
  |=  lanes=(map @t lane)
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%gu @ %harness-tlon @ %$ ~] path)  `!>(&)
  ?:  ?=([%gx @ %harness-tlon @ %peer-trust %noun ~] path)
    `!>(`peer-trust:t`[[& `~nec ~ %mentions ~ ~ ~ ~] |])
  ?:  ?|  ?=([%gx @ %harness-tlon @ %authority @ %noun ~] path)
          ?=([%gx @ %harness-tlon @ %authority @ @ %noun ~] path)
      ==
    =/  found  (~(get by lanes) (snag 5 `(list @ta)`path))
    `!>(`hand-authority:adapter`?~(found [| ~] [& ceiling.u.found]))
  ?:  ?=([%gx @ %harness-tlon @ %admin @ %noun ~] path)
    =/  found  (~(get by lanes) (snag 5 `(list @ta)`path))
    `!>(?~(found | &(=(~nec actor.u.found) dm.u.found)))
  ?:  ?=([%gx @ %harness-tlon @ %context @ @ %noun ~] path)  `!>(`(unit @t)`~)
  `!>(|)
++  tlon-lane
  |=  [actor=@p address=@t ceiling=(unit (list tool-grant:h))]
  ^-  lane
  [actor =('dm/' (end [3 3] address)) ceiling]
++  tlon-job
  |=  [actor=@p address=@t]
  ^-  schedule:c
  =/  who  (scot %p actor)
  =/  act=action:c
    :*  %add  0v1  'source-binding'  who  %prompt
        %-  pairs:enjs:format
        :~  ['schedule' %s '* * * * *']  ['timezone' %s 'UTC']  ['prompt' %s 'Check status']
            ['runs' %s '2']
        ==
    ==
  (create:schedule act ['tlon' address 'source' ~[who] &] ~ t0)
::  A human's Tlon message with one outstanding model call. .jobs are the
::  caller's own schedules in this conversation.
::
++  tlon-fixture
  |=  [actor=@p address=@t name=@t args=@t jobs=(map @uv schedule:c)]
  ^-  state-0
  =/  s  fixture
  =/  who  (scot %p actor)
  =/  call=tool-call:h  ['control' name args]
  =/  input=admitted-input:h
    :*  0v8  [%hand 'source-binding' 'tlon' address 'human-request' who]  ~
        `[%hand 'source-binding']  t0  [%user 'Manage my schedule']
    ==
  =/  log=(list event:h)
    :~  [%tool-requested-2 4 'control' name]
        [%llm-completed 3 %tool-calls [0 0] [%assistant '' ~[call]]]  [%llm-requested 3 %turn]
        [%input-received input]  [%config-replaced defaults.s]
    ==
  =.  sessions.s  (~(put by sessions.s) 'source' [log 4])
  =.  bindings.hands.s
    %-  my
    :~  ['source-binding' ['tlon' address 'source' ~[who] &]]
        ['schedule-0v1' ['tlon' address 'schedule-0v1' ~[who] &]]
    ==
  =.  observations.hands.s
    (my ~[[0v8 ['source-binding' 'human-request' who 'Manage my schedule' t0 %running]]])
  =.  active.hands.s  (my ~[['source' 0v8]])
  =.  schedules.s  jobs
  s
++  tlon-setup
  |=  [s=state-0 lanes=(map @t lane)]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now t0)))
  ;<  ~  bind:m  (set-scry-gate (tlon-scry lanes))
  ;<  *  bind:m  (do-load head `!>(s))
  (pure:m ~)
::  The scheduling result the head returns to the model for this call.
::
++  tool-body
  |=  cards=(list card)
  ^-  (unit @t)
  ?~  cards  ~
  ?.  ?=([%give %fact *] i.cards)  $(cards t.cards)
  ?.  ?=([[%tools @ ~] ~] paths.p.i.cards)  $(cards t.cards)
  `!<(@t q.cage.p.i.cards)
::  Grants the head resolves for this turn are the catalog the model sees.
::
++  ex-offered
  |=  [expected=? actor=@p address=@t ceiling=(unit (list tool-grant:h))]
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  (tlon-fixture actor address 'tlon_read_history' '{}' ~)
  ;<  ~  bind:m  (tlon-setup s (my ~[['source' (tlon-lane actor address ceiling)]]))
  ;<  =cage  bind:m  (got-peek /x/tool-call/source/4/control)
  =/  authority  ;;((unit tool-authority:adapter) q.q.cage)
  ;<  ~  bind:m  (ex-equal !>(?=(^ authority)) !>(&))
  =/  granted  ?~(authority ~ tools.u.authority)
  ;<  ~  bind:m  (ex-equal !>((tool-granted:tools 'cron_add' granted)) !>(expected))
  (ex-equal !>((lien granted |=(g=tool-grant:h =(%cron g)))) !>(expected))
++  test-owner-is-offered-scheduling-in-dm-and-channel
  %-  eval-mare
  ;<  ~  bind:(mare ,~)  (ex-offered & ~nec owner-dm ~)
  (ex-offered & ~nec room ~)
++  test-trusted-ship-is-not-offered-scheduling-in-dm
  %-  eval-mare
  (ex-offered | ~bus bus-dm `trusted-ceiling)
++  test-trusted-ship-is-not-offered-scheduling-in-channel
  %-  eval-mare
  (ex-offered | ~bus room `trusted-ceiling)
++  test-allowed-ship-is-not-offered-scheduling-in-dm
  %-  eval-mare
  (ex-offered | ~bus bus-dm `allowed-ceiling)
++  test-allowed-ship-is-not-offered-scheduling-in-channel
  %-  eval-mare
  (ex-offered | ~bus room `allowed-ceiling)
::  The head asks only the hand's ceiling, whoever the actor is.
::
++  test-no-ceiling-or-a-ceiling-with-cron-is-offered-scheduling
  %-  eval-mare
  ;<  ~  bind:(mare ,~)  (ex-offered & ~bus room ~)
  (ex-offered & ~bus room `~[%cron %tlon-read %tlon-write])
++  test-a-ceiling-without-cron-is-not-offered-scheduling-and-calls-are-refused
  %-  eval-mare
  =/  ceiling  `(list tool-grant:h)`~[%admin %tlon %web %code %tlon-read %tlon-write]
  ;<  ~  bind:(mare ,~)  (ex-offered | ~nec room `ceiling)
  (ex-refused room `ceiling refused-calls)
++  test-trusted-ship-is-not-offered-scheduling-in-channel-thread
  %-  eval-mare
  (ex-offered | ~bus room-thread `trusted-ceiling)
::  A call the catalog did not offer reaches the scheduler only if forged;
::  it must still change nothing and tell the model why.
::
++  refused-calls
  ^-  (list [name=@t args=@t])
  :~  ['cron_add' '{"schedule":"* * * * *","timezone":"UTC","prompt":"Forged","runs":"1"}']
      ['cron_list' '{}']
      ['cron_remove' '{"id":"0v1"}']
  ==
++  ex-refused
  |=  [address=@t ceiling=(unit (list tool-grant:h)) cases=(list [name=@t args=@t])]
  =/  m  (mare ,~)
  ^-  form:m
  ?~  cases  (pure:m ~)
  =/  s
    (tlon-fixture ~bus address name.i.cases args.i.cases (my ~[[0v1 (tlon-job ~bus address)]]))
  ;<  ~                bind:m  (tlon-setup s (my ~[['source' (tlon-lane ~bus address ceiling)]]))
  ;<  before=state-0   bind:m  get-state
  ;<  out=(list card)  bind:m  (do-tool name.i.cases args.i.cases)
  ;<  next=state-0     bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>([name.i.cases schedules.next]) !>([name.i.cases schedules.before]))
  ;<  ~  bind:m
    %+  ex-equal
      !>([name.i.cases (tool-body out)])
    !>([name.i.cases `'error: No authorized outstanding schedule request in this hand conversation'])
  (ex-refused address ceiling t.cases)
++  test-trusted-ship-scheduling-calls-are-refused-in-dm
  %-  eval-mare
  (ex-refused bus-dm `trusted-ceiling refused-calls)
++  test-trusted-ship-scheduling-calls-are-refused-in-channel
  %-  eval-mare
  (ex-refused room `trusted-ceiling refused-calls)
++  test-allowed-ship-scheduling-calls-are-refused-in-dm
  %-  eval-mare
  (ex-refused bus-dm `allowed-ceiling refused-calls)
++  test-allowed-ship-scheduling-calls-are-refused-in-channel
  %-  eval-mare
  (ex-refused room `allowed-ceiling refused-calls)
++  test-trusted-ship-scheduling-calls-are-refused-in-channel-thread
  %-  eval-mare
  (ex-refused room-thread `trusted-ceiling refused-calls)
::  The owner creates, lists, changes and cancels through the model tools.
::
++  owner-manages
  |=  address=@t
  =/  m  (mare ,~)
  ^-  form:m
  =/  lanes  (my ~[['source' (tlon-lane ~nec address ~)]])
  =/  add  '{"schedule":"0 9 * * *","timezone":"UTC","prompt":"Owner work","runs":"3"}'
  ;<  ~              bind:m  (tlon-setup (tlon-fixture ~nec address 'cron_add' add ~) lanes)
  ;<  *              bind:m  (do-tool 'cron_add' add)
  ;<  added=state-0  bind:m  get-state
  =/  created  ~(val by schedules.added)
  ;<  ~  bind:m
    %+  ex-equal
      !>(?~(created ~ `[actor state prompt]:i.created))
    !>(`['~nec' %active 'Owner work'])
  =/  job  (tlon-job ~nec address)
  ;<  ~  bind:m  (tlon-setup (tlon-fixture ~nec address 'cron_list' '{}' (my ~[[0v1 job]])) lanes)
  ;<  listed=(list card)  bind:m  (do-tool 'cron_list' '{}')
  ;<  ~  bind:m
    (ex-equal !>(?=(^ (find "Check status" (trip (fall (tool-body listed) ''))))) !>(&))
  =/  update
    %-  en:json:html
    %-  pairs:enjs:format
    :~  ['id' %s '0v1']  ['revision' %s (scot %uv (sham job))]
        :-  'args'
        %-  pairs:enjs:format
        :~  ['schedule' %s '0 9 * * *']  ['timezone' %s 'UTC']  ['prompt' %s 'Changed work']
            ['runs' %s '2']
        ==
    ==
  ;<  ~  bind:m
    (tlon-setup (tlon-fixture ~nec address 'cron_update' update (my ~[[0v1 job]])) lanes)
  ;<  *                bind:m  (do-tool 'cron_update' update)
  ;<  updated=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>(prompt:(~(got by schedules.updated) 0v1)) !>('Changed work'))
  =/  remove  '{"id":"0v1"}'
  ;<  ~  bind:m
    (tlon-setup (tlon-fixture ~nec address 'cron_remove' remove (my ~[[0v1 job]])) lanes)
  ;<  *                bind:m  (do-tool 'cron_remove' remove)
  ;<  removed=state-0  bind:m  get-state
  (ex-equal !>(state:(~(got by schedules.removed) 0v1)) !>(%cancelled))
++  test-owner-manages-schedules-in-dm
  %-  eval-mare
  (owner-manages owner-dm)
++  test-owner-manages-schedules-in-channel
  %-  eval-mare
  (owner-manages room)
::  The owner's native and ACP schedule methods still create jobs for the
::  owner's own Tlon conversation.
::
++  test-owner-native-and-acp-schedule-paths-still-create
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  lanes  (my ~[['source' (tlon-lane ~nec room ~)]])
  =/  args
    %-  pairs:enjs:format
    :~  ['schedule' %s '0 9 * * *']  ['timezone' %s 'UTC']  ['prompt' %s 'Native work']
        ['runs' %s '1']
    ==
  =/  act=action:c  [%add 0v5 'source-binding' '~nec' %prompt args]
  ;<  ~               bind:m  (tlon-setup (tlon-fixture ~nec room 'calculate' '{}' ~) lanes)
  ;<  *               bind:m  (do-poke %harness-cron !>(`request:c`['native' act]))
  ;<  native=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>(state:(~(got by schedules.native) 0v5)) !>(%active))
  =/  payload
    %-  en:json:html
    %-  pairs:enjs:format
    :~  ['jsonrpc' %s '2.0']  ['id' %n '7']  ['method' %s 'harness/cron/add']
        :-  'params'
        %-  pairs:enjs:format
        :~  ['id' %s '0v6']  ['binding' %s 'source-binding']  ['actor' %s '~nec']
            ['kind' %s 'prompt']  ['args' args]
        ==
    ==
  ;<  *            bind:m  (do-frame payload)
  ;<  acp=state-0  bind:m  get-state
  (ex-equal !>(state:(~(got by schedules.acp) 0v6)) !>(%active))
::  The owner's own methods cannot create a Tlon job for another actor.
::
++  test-owner-methods-reject-a-tlon-job-for-a-non-owner-actor
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  lanes  (my ~[['source' (tlon-lane ~bus bus-dm `trusted-ceiling)]])
  =/  args
    %-  pairs:enjs:format
    :~  ['schedule' %s '0 9 * * *']  ['timezone' %s 'UTC']  ['prompt' %s 'For bus']
        ['runs' %s '1']
    ==
  =/  act=action:c  [%add 0v5 'source-binding' '~bus' %prompt args]
  ;<  ~                bind:m  (tlon-setup (tlon-fixture ~bus bus-dm 'calculate' '{}' ~) lanes)
  ;<  out=(list card)  bind:m  (do-poke %harness-cron !>(`request:c`['native' act]))
  ;<  next=state-0     bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>((~(has by schedules.next) 0v5)) !>(|))
  ;<  ~  bind:m
    %+  ex-equal
      !>((cron-result out))
    !>(`(unit (each json @t))``[%| 'This conversation is not permitted to schedule'])
  =/  payload
    %-  en:json:html
    %-  pairs:enjs:format
    :~  ['jsonrpc' %s '2.0']  ['id' %n '7']  ['method' %s 'harness/cron/add']
        :-  'params'
        %-  pairs:enjs:format
        :~  ['id' %s '0v6']  ['binding' %s 'source-binding']  ['actor' %s '~bus']
            ['kind' %s 'prompt']  ['args' args]
        ==
    ==
  ;<  sent=(list card)  bind:m  (do-frame payload)
  ;<  acp=state-0       bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>((~(has by schedules.acp) 0v6)) !>(|))
  ;<  ~  bind:m
    %+  ex-equal
      !>(?=(^ (find "This conversation is not permitted to schedule" (acp-sent sent))))
    !>(&)
  ::  A hand that does not answer is an outage, not a refusal.
  ;<  ~                    bind:m  (tlon-setup (tlon-fixture ~bus bus-dm 'calculate' '{}' ~) ~)
  ;<  down=(list card)     bind:m  (do-poke %harness-cron !>(`request:c`['native' act]))
  %+  ex-equal
    !>((cron-result down))
  !>(`(unit (each json @t))``[%| 'Source hand authority is unavailable'])
++  acp-sent
  |=  cards=(list card)
  ^-  tape
  %-  zing
  %+  murn  cards
  |=  =card
  ^-  (unit tape)
  ?.  ?=([%pass [%acp %send ~] %agent * %poke %acp-action-1 *] card)  ~
  =/  [pass=* wire=* agent=* target=* poke=* mark=* data=vase]  card
  =/  action  !<(action:v1:ac data)
  ?.  ?=(%send -.action)  ~
  `(trip payload.action)
::  A second hand's binding cannot schedule on a Tlon session whose hand
::  ceiling forbids it; a session bound only through another hand still can.
::
++  test-another-hands-binding-cannot-schedule-on-a-forbidden-tlon-session
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  lanes  (my ~[['source' (tlon-lane ~bus bus-dm `trusted-ceiling)]])
  =/  args
    %-  pairs:enjs:format
    :~  ['schedule' %s '0 9 * * *']  ['timezone' %s 'UTC']  ['prompt' %s 'Through bridge']
        ['runs' %s '1']
    ==
  =/  act=action:c  [%add 0v5 'bridge-binding' '~bus' %prompt args]
  =/  bridge=binding:hh  ['bridge' bus-dm 'source' ~['~bus'] &]
  =/  s  (tlon-fixture ~bus bus-dm 'calculate' '{}' ~)
  =.  bindings.hands.s  (~(put by bindings.hands.s) 'bridge-binding' bridge)
  ;<  ~               bind:m  (tlon-setup s lanes)
  ;<  *               bind:m  (do-poke %harness-cron !>(`request:c`['native' act]))
  ;<  shared=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>((~(has by schedules.shared) 0v5)) !>(|))
  =.  bindings.hands.s  (my ~[['bridge-binding' bridge]])
  ;<  ~             bind:m  (tlon-setup s lanes)
  ;<  *             bind:m  (do-poke %harness-cron !>(`request:c`['native' act]))
  ;<  only=state-0  bind:m  get-state
  (ex-equal !>(state:(~(got by schedules.only) 0v5)) !>(%active))
++  cron-result
  |=  cards=(list card)
  ^-  (unit (each json @t))
  ?~  cards  ~
  ?.  ?=([%give %fact *] i.cards)  $(cards t.cards)
  ?.  ?=([[%crons @ ~] ~] paths.p.i.cards)  $(cards t.cards)
  `!<((each json @t) q.cage.p.i.cards)
::  A Tlon job whose actor is not the owner must not run, and shows as paused
::  rather than cancelled or removed.
::
++  test-existing-non-owner-schedule-pauses-and-does-not-run
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  fixture
  =/  bus
    =/  j  (tlon-job ~bus bus-dm)
    j(binding 'bus-binding', sid 'bus-source', run-sid 'schedule-0v1')
  =/  nec
    =/  j  (tlon-job ~nec owner-dm)
    j(binding 'nec-binding', sid 'nec-source', run-sid 'schedule-0v2')
  =/  gone  bus(binding 'gone-binding', run-sid 'schedule-0v3')
  =.  sessions.s
    %-  my
    :~  ['bus-source' [~[[%config-replaced defaults.s]] 1]]
        ['nec-source' [~[[%config-replaced defaults.s]] 1]]
        ['schedule-0v1' [~[[%config-replaced defaults.s]] 1]]
        ['schedule-0v2' [~[[%config-replaced defaults.s]] 1]]
    ==
  =.  bindings.hands.s
    %-  my
    :~  ['bus-binding' ['tlon' bus-dm 'bus-source' ~['~bus'] &]]
        ['nec-binding' ['tlon' owner-dm 'nec-source' ~['~nec'] &]]
        ['schedule-0v1' ['tlon' bus-dm 'schedule-0v1' ~['~bus'] &]]
        ['schedule-0v2' ['tlon' owner-dm 'schedule-0v2' ~['~nec'] &]]
    ==
  =.  schedules.s  (my ~[[0v1 bus] [0v2 nec] [0v3 gone]])
  =/  lanes
    %-  my
    :~  ['bus-source' (tlon-lane ~bus bus-dm `trusted-ceiling)]
        ['nec-source' (tlon-lane ~nec owner-dm ~)]
    ==
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now t0)))
  ;<  ~  bind:m  (set-scry-gate (tlon-scry lanes))
  ;<  ~  bind:m  (wait ~d1)
  ;<  *  bind:m  (reload s)
  ;<  next=state-0  bind:m  get-state
  =/  ran
    |=  run=@t
    (lien ~(val by observations.hands.next) |=(o=observation:hh =(run binding.o)))
  ;<  ~  bind:m  (ex-equal !>((ran 'schedule-0v2')) !>(&))
  ;<  ~  bind:m  (ex-equal !>(state:(~(got by schedules.next) 0v1)) !>(%paused))
  ;<  ~  bind:m
    %+  ex-equal
      !>(reason:(~(got by schedules.next) 0v1))
    !>('The source conversation is not permitted to schedule; cancel this schedule to clear it')
  ;<  ~  bind:m
    %+  ex-equal
      !>(reason:(~(got by schedules.next) 0v3))
    !>('Source hand or conversation authority changed; explicit rescheduling is required')
  ;<  ~  bind:m  (ex-equal !>(remaining:(~(got by schedules.next) 0v1)) !>(remaining.bus))
  (ex-equal !>((ran 'schedule-0v1')) !>(|))
::  The owner's DM schedule and reminder carry %code among their saved grants,
::  and their source conversation does not grant it. A scheduled run never
::  holds %code, so both stay active and the schedule still runs.
::
++  test-saved-code-does-not-pause
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ::  What the owner's DM turn holds when its conversation grants %code.
  =/  held=(list tool-grant:h)
    :~  [%clay ~]  %web  %curl  %skills  %skill-write  %author  %subagents  %peers  %corpus
        %workspace  %code  %tlon  %tlon-read  %tlon-write  %admin  %cron
    ==
  =/  work  (tlon-job ~nec owner-dm)
  =.  tools.work  held
  =/  note
    =/  act=action:c
      :*  %add  0v2  'source-binding'  '~nec'  %reminder
          (pairs:enjs:format ~[['at' %s '2026-09-11T00:00:00Z'] ['text' %s 'Stand up']])
      ==
    (create:schedule act ['tlon' owner-dm 'source' ~['~nec'] &] held t0)
  =/  s  (tlon-fixture ~nec owner-dm 'calculate' '{}' (my ~[[0v1 work] [0v2 note]]))
  =.  sessions.s  (~(put by sessions.s) 'schedule-0v2' [~[[%config-replaced defaults.s]] 1])
  =.  bindings.hands.s
    (~(put by bindings.hands.s) 'schedule-0v2' ['tlon' owner-dm 'schedule-0v2' ~['~nec'] &])
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now t0)))
  ;<  ~  bind:m  (set-scry-gate (tlon-scry (my ~[['source' (tlon-lane ~nec owner-dm ~)]])))
  ;<  ~  bind:m  (wait ~d1)
  ;<  *  bind:m  (reload s)
  ;<  next=state-0  bind:m  get-state
  =/  kept  |=(id=@uv [state reason]:(~(got by schedules.next) id))
  ;<  ~  bind:m  (ex-equal !>((kept 0v1)) !>([%active '']))
  ;<  ~  bind:m  (ex-equal !>((kept 0v2)) !>([%active '']))
  %+  ex-equal
    !>  %+  lien  ~(val by observations.hands.next)
        |=(o=observation:hh =('schedule-0v1' binding.o))
  !>(&)
::  A conversation, and a subagent started from it, stay inside the hand's
::  ceiling. The hand's ceiling for another actor carries neither %tlon nor
::  %code (harness-tlon-authority); here the head is given one, and the
::  owner's conversation none.
::
++  delegated-tools
  |=  [actor=@p address=@t ceiling=(unit (list tool-grant:h))]
  =/  m  (mare ,[parent=(list tool-grant:h) child=(list tool-grant:h)])
  ^-  form:m
  =/  granted  `(list tool-grant:h)`~[%subagents %tlon %code %workspace]
  =/  lanes  (my ~[['source' (tlon-lane actor address ceiling)]])
  =/  with-grants
    |=  [s=state-0 sid=@t]
    ^-  state-0
    =/  found  (~(got by sessions.s) sid)
    =.  log.found  (snoc (snip log.found) [%config-replaced defaults.s(tools granted)])
    s(sessions (~(put by sessions.s) sid found))
  ::  The parent's own outstanding hand call shows its grants.
  ;<  ~  bind:m
    (tlon-setup (with-grants (tlon-fixture actor address 'workspace' '{}' ~) 'source') lanes)
  ;<  own=cage  bind:m  (got-peek /x/tool-call/source/4/control)
  ::  A child of an outstanding run_subagent call, with its own hand call.
  =/  s  (tlon-fixture actor address 'run_subagent' '{}' ~)
  =/  child  (delegated-id:hl 'source' 'control' | `4)
  =/  call=tool-call:h  ['call' 'workspace' '{}']
  =.  sessions.s
    %+  ~(put by sessions.s)  child
    :_  1
    :~  [%tool-requested-2 1 'call' 'workspace']
        [%llm-completed 0 %tool-calls [1 1] [%assistant '' ~[call]]]
        [%input-received [0v1 [%subagent 'source' 'control'] ~ ~ t0 [%user 'Child work']]]
        [%config-replaced defaults.s]
    ==
  ;<  ~  bind:m  (tlon-setup (with-grants (with-grants s 'source') child) lanes)
  ;<  sub=cage  bind:m  (got-peek `path`~[%x %tool-call child '1' %call])
  =/  tools-of
    |=  =cage
    ^-  (list tool-grant:h)
    =/  authority  ;;((unit tool-authority:adapter) q.q.cage)
    ?~(authority ~ tools.u.authority)
  (pure:m [(tools-of own) (tools-of sub)])
++  ex-delegated
  |=  [held=? actor=@p address=@t ceiling=(unit (list tool-grant:h))]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [parent=(list tool-grant:h) child=(list tool-grant:h)]  bind:m
    (delegated-tools actor address ceiling)
  =/  holds
    |=  [tools=(list tool-grant:h) grant=tool-grant:h]
    (lien tools |=(g=tool-grant:h =(g grant)))
  %+  ex-equal
    !>  :~  [(holds parent %tlon) (holds parent %code) (holds parent %workspace)]
            [(holds child %tlon) (holds child %code) (holds child %workspace)]
        ==
  !>(~[[held held &] [held held &]])
++  guest-ceiling  `(list tool-grant:h)`~[%subagents %workspace %tlon-read %tlon-write]
++  test-subagent-stays-within-its-parent-conversations-ceiling
  %-  eval-mare
  ;<  ~  bind:(mare ,~)  (ex-delegated | ~bus bus-dm `guest-ceiling)
  (ex-delegated | ~bus room `guest-ceiling)
++  test-owner-and-owner-subagents-keep-tlon-and-code
  %-  eval-mare
  ;<  ~  bind:(mare ,~)  (ex-delegated & ~nec owner-dm ~)
  (ex-delegated & ~nec room ~)
::  Snapshots the head gave its schedule subscribers in one event.
::
++  feed
  |=  cards=(list card)
  ^-  (list schedules:c)
  %+  murn  cards
  |=  =card
  ^-  (unit schedules:c)
  ?.  ?=([%give %fact [[%v1 %schedule-events ~] ~] %harness-schedules-1 *] card)
    ~
  `!<(schedules:c q.cage.p.card)
++  test-new-schedule-subscriber-alone-gets-the-full-set
  %-  eval-mare
  ;<  ~  bind:(mare ,~)  (ex-initial-set ~)
  (ex-initial-set (my ~[[0v1 job]]))
++  ex-initial-set
  |=  jobs=schedules:c
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  fixture
  =.  schedules.s  jobs
  ;<  ~                bind:m  (setup s)
  ;<  out=(list card)  bind:m  (do-watch /v1/schedule-events)
  ;<  *                bind:m  (do-leave /v1/schedule-events)
  (ex-cards out ~[(ex-fact ~ %harness-schedules-1 !>(jobs))])
++  test-foreign-ship-cannot-watch-schedules
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (setup fixture)
  (ex-fail ((do-as ~nec) (do-watch /v1/schedule-events)))
::  Reads change no schedule, so they must not wake subscribers.
::
++  test-each-schedule-change-gives-one-snapshot-and-reads-give-none
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  act=action:c
    :*  %add  0v2  'source-binding'  'alice'  %prompt
        %-  pairs:enjs:format
        ~[['at' %s '2026-09-09T00:01:17Z'] ['prompt' %s 'Finish the task and report the result']]
    ==
  =/  poke
    |=  =action:c
    (do-poke %harness-cron !>(`request:c`['feed' action]))
  ;<  ~                    bind:m  (setup fixture)
  ;<  added=(list card)    bind:m  (poke act)
  ;<  created=state-0      bind:m  get-state
  ;<  listed=(list card)   bind:m  (poke [%list ~])
  ;<  stopped=(list card)  bind:m  (poke [%cancel 0v2])
  ;<  cancelled=state-0    bind:m  get-state
  ;<  cleared=(list card)  bind:m  (poke [%clear 0v2])
  ;<  ~  bind:m  (ex-equal !>(state:(~(got by schedules.created) 0v2)) !>(%active))
  ;<  ~  bind:m  (ex-equal !>(state:(~(got by schedules.cancelled) 0v2)) !>(%cancelled))
  ;<  ~  bind:m  (ex-equal !>((feed added)) !>(~[schedules.created]))
  ;<  ~  bind:m  (ex-equal !>((feed listed)) !>(`(list schedules:c)`~))
  ;<  ~  bind:m  (ex-equal !>((feed stopped)) !>(~[schedules.cancelled]))
  (ex-equal !>((feed cleared)) !>(`(list schedules:c)`~[~]))
++  test-an-admitted-run-gives-one-snapshot
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  fixture
  =/  job  job
  =.  schedules.s  (my ~[[0v1 job]])
  ;<  ~               bind:m  (setup s)
  ::  Loading wakes a tick later for upkeep; that wake sets the job's own.
  ;<  loaded=state-0  bind:m  get-state
  =/  tick  (need schedule-wake.loaded)
  ;<  ~               bind:m  (jab-bowl |=(b=bowl b(now tick)))
  ;<  *               bind:m  (do-arvo /schedules/(scot %da tick) [%behn %wake ~])
  ;<  ready=state-0   bind:m  get-state
  =/  at  (need schedule-wake.ready)
  ;<  ~                bind:m  (jab-bowl |=(b=bowl b(now at)))
  ;<  out=(list card)  bind:m  (do-arvo /schedules/(scot %da at) [%behn %wake ~])
  ;<  next=state-0     bind:m  get-state
  =/  ran  (~(got by schedules.next) 0v1)
  ;<  ~  bind:m  (ex-equal !>(remaining.ran) !>((dec remaining.job)))
  ;<  ~  bind:m  (ex-equal !>(?=(^ last.ran)) !>(&))
  (ex-equal !>((feed out)) !>(~[schedules.next]))
::
::  The hand grants authority to .speaker alone: a question about anyone
::  else, or with no speaker, gets none.
::
++  speaker-scry
  |=  speaker=@ta
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%gx @ %harness-tlon @ %authority @ @ %noun ~] path)
    =/  asked  (snag 6 `(list @ta)`path)
    `!>(`hand-authority:adapter`?:(=(speaker asked) [& ~] [| ~]))
  ?:  ?=([%gx @ %harness-tlon @ %authority @ %noun ~] path)
    `!>(`hand-authority:adapter`[| ~])
  ((tlon-scry ~) path)
++  speaker-setup
  |=  [s=state-0 speaker=@ta]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now t0)))
  ;<  ~  bind:m  (set-scry-gate (speaker-scry speaker))
  ;<  *  bind:m  (do-load head `!>(s))
  (pure:m ~)
++  test-turn-authority-is-asked-for-the-running-inputs-speaker
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  (tlon-fixture ~bus room 'tlon_read_history' '{}' ~)
  =/  granted
    |=  =cage
    ?=(^ ;;((unit tool-authority:adapter) q.q.cage))
  ;<  ~  bind:m  (speaker-setup s '~bus')
  ;<  own=cage  bind:m  (got-peek /x/tool-call/source/4/control)
  ;<  ~  bind:m  (speaker-setup s '~nec')
  ;<  other=cage  bind:m  (got-peek /x/tool-call/source/4/control)
  (ex-equal !>([(granted own) (granted other)]) !>([& |]))
++  test-scheduled-run-authority-is-asked-for-the-jobs-actor
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ::  ~nec's input is running in the source conversation; ~bus made the job.
  =/  job  (tlon-job ~bus room)
  =/  s  (tlon-fixture ~nec room 'calculate' '{}' (my ~[[0v1 job]]))
  =.  bindings.hands.s
    %+  ~(put by bindings.hands.s)  'source-binding'
    ['tlon' room 'source' ~['~nec' '~bus'] &]
  =/  peek  /x/cron-authority/[run-sid.job]
  ;<  ~  bind:m  (speaker-setup s '~bus')
  ;<  own=cage  bind:m  (got-peek peek)
  ;<  ~  bind:m  (speaker-setup s '~nec')
  ;<  other=cage  bind:m  (got-peek peek)
  (ex-equal !>([;;(? q.q.own) ;;(? q.q.other)]) !>([& |]))
::  The hand grants only ~zod, our ship. A local ACP or poke prompt is the
::  operator's; a timer, peer or idle hand input, even one naming ~zod, is not.
::
++  test-only-a-local-prompt-is-answered-as-the-operator
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  base  (tlon-fixture ~bus room 'tlon_read_history' '{}' ~)
  =/  as-input
    |=  [source=input-source:h actor=(unit @p)]
    ^-  state-0
    =/  log  log:(~(got by sessions.base) 'source')
    =/  edited=(list event:h)
      %+  turn  log
      |=  =event:h
      ?.  ?=(%input-received -.event)  event
      event(source.input source, actor.input actor)
    %=  base
      sessions  (~(put by sessions.base) 'source' [edited 4])
      active.hands  ~
    ==
  =/  granted
    |=  s=state-0
    =/  m  (mare ,?)
    ^-  form:m
    ;<  ~  bind:m  (speaker-setup s '~zod')
    ;<  =cage  bind:m  (got-peek /x/tool-call/source/4/control)
    (pure:m ?=(^ ;;((unit tool-authority:adapter) q.q.cage)))
  ;<  poke=?  bind:m  (granted (as-input [%poke ~zod] `~zod))
  ;<  acp=?  bind:m  (granted (as-input [%acp 'client'] `~zod))
  ;<  timer=?  bind:m  (granted (as-input [%timer %check] ~))
  ;<  peer=?  bind:m  (granted (as-input [%peer ~zod 0v1] `~zod))
  ;<  idle-hand=?  bind:m
    (granted (as-input [%hand 'source-binding' 'tlon' room 'e' '~zod'] `~zod))
  ::  A running hand input is its actor's, whatever the log says.
  =/  running  (as-input [%poke ~zod] `~zod)
  ;<  hand=?  bind:m  (granted running(active.hands active.hands.base))
  %+  ex-equal
    !>([poke acp timer peer idle-hand hand])
  !>([& & | | | |])
::  The owner's administrative DM turn holds all of these; a child is never
::  given them, so its saved config must not claim them either.
++  test-child-config-saves-only-tools-a-child-can-hold
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  (tlon-fixture ~nec owner-dm 'run_subagent' '{}' ~)
  ;<  ~  bind:m  (tlon-setup s (my ~[['source' (tlon-lane ~nec owner-dm ~)]]))
  ;<  *  bind:m
    (do-poke %harness-effect !>(`effect:h`[4 [%spawn 'source' 'control' 'Child work' ~]]))
  ;<  next=state-0  bind:m  get-state
  =/  child  (~(get by sessions.next) (delegated-id:hl 'source' 'control' | `4))
  ;<  ~  bind:m  (ex-equal !>(?=(^ child)) !>(&))
  ?>  ?=(^ child)
  =/  saved  tools.config:(play:hl log.u.child)
  =/  holds  |=(grant=tool-grant:h (lien saved |=(g=tool-grant:h =(g grant))))
  %+  ex-equal
    !>  :~  (holds %subagents)  (holds %admin)  (holds %cron)  (holds %tlon-read)
            (holds %tlon-write)  (holds %workspace)
        ==
  !>(~[| | | | | &])
--

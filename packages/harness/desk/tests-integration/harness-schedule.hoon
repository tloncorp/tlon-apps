::  Full-agent persistence and timer checks; emitted cards are never executed.
::  -test /=harness=/tests-integration/harness-schedule
/-  c=harness-cron, hh=harness-hand, h=harness, ac=acp, renew=harness-oauth,
    adapter=harness-adapter, *harness-store
/+  *test-agent, schedule=harness-schedule, defaults=harness-defaults, hl=harness,
    tools=harness-tools, auth=harness-auth
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
++  get-state
  =/  m  (mare ,state-0)
  ^-  form:m
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
  ::  The saved wake is cancelled and exactly one fresh one is set.
  =/  at  next.job
  ;<  ~  bind:m
    %+  ex-cards  (timers out)
    :~  (ex-arvo /schedules/(scot %da at) %b %rest at)
        (ex-arvo /schedules/(scot %da at) %b %wait at)
    ==
  ;<  ~  bind:m  (ex-equal !>(schedules.next) !>(schedules.s))
  (ex-equal !>(schedule-wake.next) !>(schedule-wake.s))
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
  ;<  *                bind:m  (do-load head `!>(next))
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
--

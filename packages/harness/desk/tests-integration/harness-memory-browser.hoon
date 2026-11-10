::  Owner ACP memory management through the full head; cards stay local.
/-  *harness-store, ac=acp, m=harness-memory
/+  *test-agent, j=harness-provider-wire, admin=harness-admin, mem=harness-memory,
    policy=harness-defaults
/=  head  /app/harness
|%
++  response
  |=  cards=(list card)
  ^-  json
  ?~  cards  !!
  =/  card  i.cards
  ?:  ?=([%pass [%acp %send ~] %agent * %poke %acp-action-1 *] card)
    =/  [pass=* wire=* agent=* target=* poke=* mark=* data=vase]  card
    =/  action  !<(action:v1:ac data)
    ?>  ?=(%send -.action)
    (need (de:json:html payload.action))
  ?:  ?=([%pass [%admin %result ~] %agent * %poke %harness-admin-result *] card)
    =/  [pass=* wire=* agent=* target=* poke=* mark=* data=vase]  card
    =/  decoded  !<([@t @t] data)
    (need (de:json:html +.decoded))
  $(cards t.cards)
::  Load saved state at now. Loading opens the ACP subscription that the
::  frames below arrive on.
::
++  setup
  |=  [now=@da saved=state-0]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now now)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  *  bind:m  (do-load head `!>(saved))
  (pure:m ~)
::
++  do-frame
  |=  [connection=@t method=@t params=json]
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  b=bowl  bind:m  get-bowl
  =/  frame
    %-  en:json:html
    %-  pairs:enjs:format
    :~  ['jsonrpc' %s '2.0']  ['id' %n '1']
        ['method' %s method]  ['params' params]
    ==
  =/  =update:v1:ac  [%messages connection %agent ~[[1 now.b frame]]]
  (do-agent /acp/watch [~zod %acp] [%fact %acp-update-1 !>(update)])
::
++  get-state
  =/  m  (mare ,state-0)
  ^-  form:m
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-0 vase))
::
::  One saved memory whose evidence names ~nec.
::
++  memory-fixture
  ^-  state-0
  =/  saved=state-0  *state-0
  =.  saved  saved(defaults builtin-config:policy, local-mcp-seen 1)
  =/  =source:m  ['evidence' 0v1 7 ~2026.10.7 '~nec']
  =/  seeded  (save:mem knowledge.saved 'project' 0 [`'Keep the plan clear.' ~ | | source])
  ?>  ?=(%& -.seeded)
  saved(knowledge p.seeded)
::
++  exercise
  |=  [connection=@t operation=@t]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~                bind:m  (setup ~2026.10.7 memory-fixture)
  ;<  before=state-0   bind:m  get-state
  =/  params
    %-  pairs:enjs:format
    :~  ['name' %s 'project']  ['revision' %s '1']
        ['text' %s 'Use concrete examples.']  ['actor' %s '~nec']
        ['sessionId' %s 'forged']
    ==
  ;<  caz=(list card)  bind:m
    (do-frame connection (cat 3 'harness/memory/' operation) params)
  ;<  after=state-0    bind:m  get-state
  =/  reply  (response caz)
  =/  denied  ?=(^ (decode:admin connection))
  =/  write  &(!denied |(=('save' operation) =('forget' operation)))
  =/  record  (~(got by records.knowledge.after) 'project')
  ;<  ~  bind:m  (ex-equal !>(sessions.after) !>(sessions.before))
  ;<  ~  bind:m  (ex-equal !>(jobs.knowledge.after) !>(jobs.knowledge.before))
  ;<  ~  bind:m  (ex-equal !>(pending.knowledge.after) !>(pending.knowledge.before))
  ;<  ~  bind:m
    ?.  write
      (ex-equal !>(knowledge.after) !>(knowledge.before))
    ;<  ~  bind:m  (ex-equal !>(revision.record) !>(2))
    ;<  ~  bind:m  (ex-equal !>(actor.source.value.record) !>('~zod'))
    ;<  ~  bind:m  (ex-equal !>(sid.source.value.record) !>(''))
    (ex-equal !>(barrier.knowledge.after) !>(?:(=('forget' operation) 1 0)))
  ;<  ~  bind:m  (ex-equal !>(?=(^ (get:j reply 'error'))) !>(denied))
  (ex-equal !>(?=(^ (get:j reply 'result'))) !>(!denied))
::
++  test-owner-list-is-read-only
  (eval-mare (exercise 'memory-owner-fixture' 'list'))
++  test-owner-save-uses-verified-attribution
  (eval-mare (exercise 'memory-owner-fixture' 'save'))
++  test-owner-forget-invalidates-capture
  (eval-mare (exercise 'memory-owner-fixture' 'forget'))
++  test-model-admin-cannot-browse-owner-memory
  (eval-mare (exercise (connection:admin ['model' 1 'tool']) 'list'))
++  test-model-admin-cannot-write-owner-memory
  (eval-mare (exercise (connection:admin ['model' 1 'tool']) 'save'))
::
::  One retained memory; disabling starts from dreaming on with a job pending.
::
++  dreaming-fixture
  |=  [configure=? value=json]
  ^-  state-0
  =/  saved=state-0  *state-0
  =.  saved  saved(defaults builtin-config:policy, local-mcp-seen 1)
  =/  seed
    %:  save:mem
      knowledge.saved
      'retained'
      0
      [`'Retain this saved fact.' ~ | & ['' 0v0 0 ~2026.10.9 '~zod']]
    ==
  ?>  ?=(%& -.seed)
  =.  knowledge.saved  p.seed
  ?.  &(configure =([%b |] value))
    saved
  =/  job  *job:m
  =.  job  job(sid 'first', config builtin-config:policy)
  %=  saved
    enabled.dreaming.maintenance.knowledge  &
    due.dreaming.maintenance.knowledge  `~2026.10.10
    pending.knowledge  `[7 job builtin-config:policy 0 ~2026.10.9..00.02.00 ~]
    jobs.knowledge  (my ~[[7 job]])
    head.knowledge  7
    next.knowledge  8
  ==
::
++  dreaming-case
  |=  [connection=@t configure=? value=json]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~                bind:m  (setup ~2026.10.9 (dreaming-fixture configure value))
  ;<  before=state-0   bind:m  get-state
  =/  params  (pairs:enjs:format ~[['enabled' value]])
  =/  method
    ?:(configure 'harness/memory/dreaming/configure' 'harness/memory/dreaming')
  ;<  caz=(list card)  bind:m  (do-frame connection method params)
  ;<  after=state-0    bind:m  get-state
  ::  Reload the result to check the setting and its wake persist.
  ;<  =agent           bind:m  get-agent
  ;<  *                bind:m  (do-load agent `!>(after))
  ;<  reloaded=state-0  bind:m  get-state
  =/  reply  (response caz)
  =/  denied  |(?=(^ (decode:admin connection)) &(configure !?=(%b -.value)))
  =/  enabled  &(!denied configure =([%b &] value))
  ;<  ~  bind:m  (ex-equal !>(sessions.after) !>(sessions.before))
  ;<  ~  bind:m  (ex-equal !>(records.knowledge.after) !>(records.knowledge.before))
  ;<  ~  bind:m  (ex-equal !>(enabled.dreaming.maintenance.knowledge.after) !>(enabled))
  ;<  ~  bind:m  (ex-equal !>(enabled.dreaming.maintenance.knowledge.reloaded) !>(enabled))
  ;<  ~  bind:m  (ex-equal !>(?=(^ (get:j reply 'error'))) !>(denied))
  ;<  ~  bind:m  (ex-equal !>(?=(^ (get:j reply 'result'))) !>(!denied))
  ;<  ~  bind:m  (ex-equal !>(wake.knowledge.after) !>(?:(enabled `~2026.10.10 ~)))
  ;<  ~  bind:m  (ex-equal !>(wake.knowledge.reloaded) !>(wake.knowledge.after))
  ?.  |(denied !configure)
    (pure:m ~)
  (ex-equal !>(knowledge.after) !>(knowledge.before))
::
++  test-owner-dreaming-read-is-read-only
  (eval-mare (dreaming-case 'owner' | [%b &]))
++  test-owner-enables-global-dreaming-with-a-persisted-daily-wake
  (eval-mare (dreaming-case 'owner' & [%b &]))
++  test-owner-can-disable-dreaming-without-removing-memories
  (eval-mare (dreaming-case 'owner' & [%b |]))
++  test-dreaming-rejects-nonboolean-values
  (eval-mare (dreaming-case 'owner' & [%s 'false']))
++  test-model-admin-cannot-read-dreaming-settings
  (eval-mare (dreaming-case (connection:admin ['model' 1 'tool']) | [%b &]))
++  test-model-admin-cannot-enable-dreaming
  (eval-mare (dreaming-case (connection:admin ['model' 1 'tool']) & [%b &]))
--

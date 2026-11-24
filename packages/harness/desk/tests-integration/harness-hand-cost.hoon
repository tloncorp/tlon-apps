::  Per-event ledger reads with 20,000 finished records, over 20 bindings and
::  over MANY. Timings are printed for comparison, not asserted.
::  -test /=harness=/tests-integration/harness-hand-cost
/-  h=harness, hh=harness-hand, t=harness-tlon, cr=harness-cron, dv=channels-ver,
    ad=harness-adapter, *harness-store
/+  *test-agent, tst=test, policy=harness-defaults, hd=harness-hand,
    sl=harness-schedule, tp=harness-tlon-policy, si=harness-session-index,
    corpus-lib=harness-corpus
/=  head  /app/harness
/=  adapter  /app/harness-tlon
|%
++  size  20.000
++  nb  20
::  Bindings, adapter lanes and sessions of a bot addressed in that many
::  conversations. The thresholds were set at 5,000; this size keeps the
::  suite quick.
++  many  1.000
::  Conversations whose hand-off requests the head replays.
++  sampled  100
++  t0  ~2026.10.1
++  now  (add t0 ~d30)
++  sent  (add t0 ~d20)
++  bid  |=(k=@ud `@t`(cat 3 'b' (scot %ud k)))
++  sid  |=(k=@ud `@t`(cat 3 'sid' (scot %ud k)))
++  chan  |=(k=@ud `@tas`(cat 3 'c' (scot %ud k)))
++  addr  |=(k=@ud `@t`(cat 3 'chat/~zod/' (chan k)))
++  speaker  (scot %p ~nec)
++  config
  |=  k=@ud
  ^-  binding:hh
  ['tlon' (addr k) (sid k) ~[speaker] &]
++  pad
  |=  [n=@ud a=@t]
  ^-  @t
  (end [3 n] (cat 3 a (fil 3 n 'x')))
::  One finished record as admission, start, finish, claim and a delivered
::  receipt leave it.
++  record
  |=  [i=@ud k=@ud]
  ^-  [id=input-id:h =observation:hh =publication:hh =control:hh]
  =/  at=@da  (add t0 (mul i ~s1))
  =/  event  (rap 3 (addr k) '/' (scot %ud i) ~)
  =/  id  (input-id:hd (bid k) event)
  =/  ext  (rap 3 (addr k) '/' (scot %da at) ~)
  :*  id
      [(bid k) event speaker (pad 300 'message ') at %completed]
      :*  id  (bid k)  'tlon'  (addr k)  (sid k)  %reply  (pad 1.500 'reply ')  %delivered
          'harness-tlon'  ext  ~[[at %delivered 'harness-tlon' ext] [at %claimed 'harness-tlon' '']]
      ==
      [1 ~]
  ==
++  client-id  (rap 3 (scot %p ~zod) '/' (scot %da sent) ~)
++  claimed-id  id:(record size 1)
::  SIZE finished records over N bindings.
++  filled
  |=  n=@ud
  ^-  state:hh
  =/  db=state:hh  *state:hh
  =.  bindings.db  (malt (turn (gulf 0 (dec n)) |=(k=@ud [(bid k) (config k)])))
  =/  i=@ud  0
  |-  ^-  state:hh
  ?:  =(i size)  db
  =/  r  (record i (mod i n))
  %=  $
    i  +(i)
    observations.db  (~(put by observations.db) id.r observation.r)
    outbox.db  (~(put by outbox.db) id.r publication.r)
    controls.db  (~(put by controls.db) id.r control.r)
  ==
::  .filled over NB bindings, plus one claimed publication (b1), two pending
::  (b2, b3), one running input (b4), two queued (b5, b6), and in b7 an
::  uncertain publication with a pending one behind it.
++  ledger
  ^-  state:hh
  =/  db=state:hh  (filled nb)
  =/  claimed  (record size 1)
  =.  publication.claimed
    publication.claimed(status %claimed, external client-id, receipts ~[[sent %claimed 'harness-tlon' '']])
  =/  pending-a  (record (add size 1) 2)
  =/  pending-b  (record (add size 2) 3)
  =.  publication.pending-a  publication.pending-a(status %pending, worker '', external '', receipts ~)
  =.  publication.pending-b  publication.pending-b(status %pending, worker '', external '', receipts ~)
  =/  running  (record (add size 3) 4)
  =/  queued-a  (record (add size 4) 5)
  =/  queued-b  (record (add size 5) 6)
  =/  uncertain  (record (add size 6) 7)
  =/  blocked  (record (add size 7) 7)
  =.  publication.uncertain  publication.uncertain(status %uncertain, receipts ~)
  =.  publication.blocked  publication.blocked(status %pending, worker '', external '', receipts ~)
  =.  observations.db
    %-  ~(gas by observations.db)
    :~  [id.claimed observation.claimed]
        [id.pending-a observation.pending-a]
        [id.pending-b observation.pending-b]
        [id.running observation.running(phase %running)]
        [id.queued-a observation.queued-a(phase %queued)]
        [id.queued-b observation.queued-b(phase %queued)]
        [id.uncertain observation.uncertain]
        [id.blocked observation.blocked]
    ==
  =.  outbox.db
    %-  ~(gas by outbox.db)
    :~  [id.claimed publication.claimed]
        [id.pending-a publication.pending-a]
        [id.pending-b publication.pending-b]
        [id.uncertain publication.uncertain]
        [id.blocked publication.blocked]
    ==
  =.  controls.db  (~(put by controls.db) id.claimed [1 ~])
  =.  active.db  (my ~[[(sid 4) id.running]])
  =.  queue.db  ~[id.queued-a id.queued-b]
  db
++  schedule
  ^-  schedule:cr
  :*  (bid 0)  speaker  'tlon'  0v0  %prompt  'UTC'  (addr 0)  (sid 0)  (sid 0)
      'every hour'  *pattern:cr  'Prompt'  ~  (add now ~d1)  `5  %active  ''  ~
  ==
++  test-library-readers
  =/  db  ledger
  =/  index  ~>  %bout.[1 'cost-reindex']  (reindex:hd db)
  =/  indexed=indexed:hh  [db index]
  =/  job  (job-value:sl schedule)
  =/  pending  ~>  %bout.[1 'cost-pending-publications']  (pending-publications:hd indexed 'tlon')
  =/  outbox  ~>  %bout.[1 'cost-outbox-json']  (outbox-json:hd indexed 'tlon')
  =/  page  ~>  %bout.[1 'cost-publications-json']  (publications-json:hd indexed 'tlon' ~ 4)
  =/  busy  ~>  %bout.[1 'cost-schedule-busy']  (busy:sl job indexed)
  =/  clear  ~>  %bout.[1 'cost-schedule-clearable']  (clearable:sl job(state %cancelled) indexed)
  =/  listed  ~>  %bout.[1 'cost-schedule-list-json']  (list-json:sl (my ~[[0v7 schedule]]) indexed ~)
  =/  lens
    ~>  %bout.[1 'cost-lens-window']
    %+  skim  (~(gut by recent.index) 'tlon' ~)
    |=(id=input-id:h (gth at:(~(got by observations.db) id) t0))
  =/  admitted
    ~>  %bout.[1 'cost-admission']
    (apply-indexed:hd indexed [%observe (bid 4) 'cost-new' speaker (pad 300 'new ')] now)
  =/  bound
    ~>  %bout.[1 'cost-bind-existing']
    (apply-indexed:hd indexed [%bind (bid 0) (config 0)] now)
  =/  detached
    ~>  %bout.[1 'cost-detach-session']  (detach-session-indexed:hd indexed (sid 2) now)
  ?>  ?=(%& -.admitted)
  ?>  ?=(%& -.bound)
  ?>  ?=(%a -.outbox)
  ;:  weld
    (expect-eq:tst !>((add size 8)) !>(~(wyt by observations.db)))
    (expect-eq:tst !>(8) !>(~(wyt in open.index)))
    (expect-eq:tst !>(3) !>((lent pending)))
    (expect-eq:tst !>(5) !>((lent p.outbox)))
    (expect-eq:tst !>(|) !>(busy))
    (expect-eq:tst !>(&) !>(clear))
    (expect-eq:tst !>(64) !>((lent lens)))
    (expect-eq:tst !>((reindex:hd db.ledger.p.admitted)) !>(index.ledger.p.admitted))
    (expect-eq:tst !>((reindex:hd db.detached)) !>(index.detached))
    (expect-eq:tst !>(%abandoned) !>(status:(~(got by outbox.db.detached) id:(record (add size 1) 2))))
  ==
::
++  adapter-state
  |=  [n=@ud lensed=?]
  ^-  state-3:t
  =/  s=state-3:t  *state-3:t
  =/  ks  (gulf 0 (dec n))
  %=  s
    owner-initialized  1
    policy  [& `~nec ~ %mentions ~ ~]
    lens  ?.(lensed *lens-sync:t [& `~nec `@da`0 ~ ''])
    routes  (malt (turn ks |=(k=@ud [(sid k) [(bid k) %ready]])))
    lanes  (malt (turn ks |=(k=@ud [(sid k) [[%channel [%chat ~zod (chan k)] ~] 0 ~]])))
    deliveries  (my ~[[claimed-id [1 %send %uncertain client-id]]])
  ==
++  adapter-scry
  |=  ledger=indexed:hh
  |=  =path
  ^-  (unit vase)
  ?:  (lien path |=(a=@ta =(%hand-state a)))  `!>(db.ledger)
  ?:  (lien path |=(a=@ta =(%hand-index a)))  `!>(index.ledger)
  ?:  (lien path |=(a=@ta =(%cron-session a)))  `!>(`(unit schedule:cr)`~)
  ?:  (lien path |=(a=@ta =(%run a)))  `!>(`(unit json)`~)
  ?:  (lien path |=(a=@ta =(%head a)))
    `!>(`[revision=@ud view=view:h next=(unit step:h)]`[0 *view:h ~])
  ::  harness-tlon-steward covers the Steward lease.
  ?:  ?=([%gu @ %steward @ %$ ~] path)  `!>(|)
  ?:  ?=([%gu *] path)  `!>(&)
  `!>(|)
++  adapter-start
  |=  [ledger=indexed:hh n=@ud lensed=?]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now now)))
  ;<  ~  bind:m  (set-scry-gate (adapter-scry ledger))
  ;<  *  bind:m  (do-load adapter `!>((adapter-state n lensed)))
  ;<  ~  bind:m
    %-  jab-bowl
    |=  b=bowl
    =.  wex.b  (~(put by wex.b) [/head ~zod %harness] [& /hand-events])
    b(wex (~(put by wex.b) [/publications ~zod %channels] [& /v3]))
  (pure:m ~)
++  step  form:(mare ,(list card))
++  timed-step
  |=  [label=@t f=step]
  ^-  step
  |=  s=state
  ~>  %bout.[1 label]
  (f s)
++  hand-pokes
  |=  cards=(list card)
  ^-  (list action:hh)
  %+  murn  cards
  |=  =card
  ^-  (unit action:hh)
  ?.  ?=([%pass * %agent * %poke %harness-hand *] card)  ~
  =/  [pass=* wire=* agent=* who=* poke=* mark=* data=vase]  card
  `act:!<(request:hh data)
++  head-pokes
  |=  cards=(list card)
  ^-  (list action:h)
  %+  murn  cards
  |=  =card
  ^-  (unit action:h)
  ?.  ?=([%pass * %agent * %poke %harness-action *] card)  ~
  =/  [pass=* wire=* agent=* who=* poke=* mark=* data=vase]  card
  `!<(action:h data)
++  proof
  ^-  r-channels:v9:dv
  =/  post=post:v9:dv  *post:v9:dv
  =.  post  post(author ~zod, sent sent)
  [[%chat ~zod (chan 1)] [%post (add t0 ~d21) [%set %& post]]]
++  test-adapter-readers
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  db  ledger
  =/  indexed=indexed:hh  [db (reindex:hd db)]
  ;<  ~  bind:m  (adapter-start indexed nb |)
  ;<  reconciled=(list card)  bind:m
    %+  timed-step  'cost-adapter-reconcile'
    (do-agent /head [~zod %harness] [%fact %noun !>(%changed)])
  ;<  confirmed=(list card)  bind:m
    %+  timed-step  'cost-adapter-confirmed'
    (do-agent /publications [~zod %channels] [%fact %channel-response-4 !>(proof)])
  ;<  ~  bind:m  (adapter-start indexed nb &)
  ;<  lensed=(list card)  bind:m
    %+  timed-step  'cost-adapter-reconcile-lens-on'
    (do-agent /head [~zod %harness] [%fact %noun !>(%changed)])
  ::  b2 and b3 are claimed; b7's pending publication waits behind its
  ::  uncertain send.
  =/  claims  |=(cards=(list card) (skim (hand-pokes cards) |=(a=action:hh ?=(%claim -.a))))
  ;<  ~  bind:m  (ex-equal !>((lent (claims reconciled))) !>(2))
  ;<  ~  bind:m  (ex-equal !>((lent (claims lensed))) !>(2))
  =/  native  (rap 3 (addr 1) '/' (scot %da (add t0 ~d21)) ~)
  %+  ex-equal  !>((hand-pokes confirmed))
  !>(`(list action:hh)`~[[%receipt-at 'tlon' claimed-id 'harness-tlon' 1 %delivered native]])
::
++  head-state
  |=  [n=@ud db=state:hh]
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
  =.  sessions.saved  (malt (turn (gulf 0 (dec n)) |=(k=@ud [(sid k) [events 1]])))
  saved(hands db, schedules (my ~[[0v7 schedule]]), schedule-wake `(add now ~d1))
++  test-head-reload-and-events
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  db  ledger
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now now)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  *  bind:m  (timed-step 'cost-head-reload' (do-load head `!>((head-state nb db))))
  ;<  *  bind:m
    %+  timed-step  'cost-head-observe-poke'
    %+  do-poke  %harness-hand
    !>(`request:hh`['observe' [%observe (bid 4) 'cost-event' speaker (pad 300 'new ')]])
  ;<  bound=(list card)  bind:m
    %+  timed-step  'cost-head-bind-existing'
    (do-poke %harness-hand !>(`request:hh`['bind' [%bind (bid 0) (config 0)]]))
  ;<  ledger=cage  bind:m  (got-peek /x/hand-state)
  ;<  index=cage  bind:m  (got-peek /x/hand-index)
  ;<  ~  bind:m  (ex-equal q.index !>((reindex:hd !<(state:hh q.ledger))))
  =/  result
    %+  murn  bound
    |=  =card
    ^-  (unit (each json @t))
    ?.  ?=([%give %fact * %noun *] card)  ~
    ?.  =(~[/hands/bind] paths.p.card)  ~
    `;;((each json @t) q.q.cage.p.card)
  ?>  ?=([[%& %o *] ~] result)
  (ex-equal !>((~(has by p.p.i.result) 'observations')) !>(|))
::  SIZE finished records on one disabled binding, as an export finds it.
::
++  one-binding
  ^-  state:hh
  =/  db=state:hh  *state:hh
  =/  cfg  (config 0)
  =.  bindings.db  (my ~[[(bid 0) cfg(enabled |)]])
  =/  i=@ud  0
  |-  ^-  state:hh
  ?:  =(i size)  db
  =/  r  (record i 0)
  %=  $
    i  +(i)
    observations.db  (~(put by observations.db) id.r observation.r)
    outbox.db  (~(put by outbox.db) id.r publication.r)
    controls.db  (~(put by controls.db) id.r control.r)
  ==
::  The result a %harness-hand poke gave, from its /hands/<request> fact.
::
++  hand-reply
  |=  [request=@t cards=(list card)]
  ^-  (each json @t)
  =/  found
    %+  murn  cards
    |=  =card
    ^-  (unit (each json @t))
    ?.  ?=([%give %fact * %noun *] card)  ~
    ?.  =(~[/hands/[request]] paths.p.card)  ~
    `;;((each json @t) q.q.cage.p.card)
  ?>  ?=([* ~] found)
  i.found
++  test-head-export-requests
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  db  one-binding
  =/  digest  (archive-digest:hd db (bid 0))
  =/  ask
    |=  =action:hh
    (do-poke %harness-hand !>(`request:hh`[-.action action]))
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now now)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  *  bind:m  (do-load head `!>((head-state nb db)))
  ;<  paged=(list card)  bind:m
    (timed-step 'cost-head-records-page' (ask [%records (bid 0) ~ 1]))
  ;<  archived=(list card)  bind:m
    (timed-step 'cost-head-archive' (ask [%archive (bid 0)]))
  ;<  retired=(list card)  bind:m
    (timed-step 'cost-head-retire' (ask [%retire (bid 0) digest 'archive.jsonl']))
  =/  page  (hand-reply 'records' paged)
  =/  archive  (hand-reply 'archive' archived)
  ?>  ?=(%& -.page)
  ?>  ?=(%& -.archive)
  =/  listed
    %.  p.page
    (ot:dejs:format ~[digest+so:dejs:format records+(ar:dejs:format same)])
  =/  counted
    %.  p.archive
    (ot:dejs:format ~[digest+so:dejs:format records+ni:dejs:format])
  ;<  ~  bind:m  (ex-equal !>([-.listed (lent +.listed)]) !>([(scot %uv digest) 1]))
  ;<  ~  bind:m  (ex-equal !>(counted) !>([(scot %uv digest) size]))
  ;<  ~  bind:m  (ex-equal !>(-:(hand-reply 'retire' retired)) !>(%&))
  ;<  ledger=cage  bind:m  (got-peek /x/hand-state)
  (ex-equal !>(~(wyt by observations:!<(state:hh q.ledger))) !>(0))
::  The Tlon hand is live and every conversation runs with no ceiling, so
::  execution authority takes both of its binding walks.
::
++  live-scry
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%gu @ %harness-tlon @ %$ ~] path)  `!>(&)
  ?:  ?=([%gx @ %harness-tlon @ %peer-trust %noun ~] path)
    `!>(`peer-trust:t`[[& `~nec ~ %mentions ~ ~] |])
  ?:  ?|  ?=([%gx @ %harness-tlon @ %authority @ %noun ~] path)
          ?=([%gx @ %harness-tlon @ %authority @ @ %noun ~] path)
      ==
    `!>(`hand-authority:ad`[& ~])
  ?:  ?=([%gx @ %harness-tlon @ %admin @ %noun ~] path)  `!>(|)
  ?:  ?=([%gx @ %harness-tlon @ %context @ @ %noun ~] path)  `!>(`(unit @t)`~)
  `!>(|)
::  A live schedule from conversation K, not yet due, with its own run.
++  live-schedule
  |=  k=@ud
  ^-  schedule:cr
  =/  job=schedule:cr  schedule
  job(binding (bid k), destination (addr k), sid (sid k), run-sid (cat 3 'run-' (sid k)))
++  live-schedules  8
::  N conversations over the ledger DB. Conversations 1 to 9 are idle, 1 to
::  JOBS each have a live schedule, and conversation N has a session but no
::  binding yet, as the adapter leaves a new one before binding it.
++  crowded-head
  |=  [db=state:hh n=@ud jobs=@ud]
  ^-  state-0
  =/  saved  (head-state n db)
  =/  idle=(list event:h)  ~[[%config-replaced defaults.saved]]
  =.  sessions.saved
    %-  ~(gas by sessions.saved)
    (turn (snoc (gulf 1 9) n) |=(k=@ud [(sid k) [idle 1]]))
  =.  schedules.saved
    ?:  =(0 jobs)  ~
    (malt (turn (gulf 1 jobs) |=(k=@ud [`@uv`k (live-schedule k)])))
  saved(schedule-wake ~)
::  What the adapter asks of the head when the Tlon hand is turned off.
++  hand-off-requests
  |=  n=@ud
  ^-  (list action:hh)
  (turn (gulf 0 (dec n)) |=(k=@ud [%enable (bid k) |]))
++  fence-requests
  |=  n=@ud
  ^-  (list action:h)
  (turn (gulf 0 (dec n)) |=(k=@ud [%fence (sid k)]))
::  The head's half of turning the hand off: conversation K's disable and
::  fence, as the adapter sends them, each its own event.
++  hand-off
  |=  ks=(list @ud)
  =/  m  (mare ,(list card))
  ^-  form:m
  ?~  ks  (pure:m ~)
  ;<  *  bind:m
    (do-poke %harness-hand !>(`request:hh`['off' [%enable (bid i.ks) |]]))
  ;<  *  bind:m  (do-poke %harness-action !>(`action:h`[%fence (sid i.ks)]))
  (hand-off t.ks)
++  llm-requests
  |=  cards=(list card)
  ^-  @ud
  (lent (skim cards |=(=card ?=([%pass [%llm *] %arvo %i %request *] card))))
++  saved-head
  =/  m  (mare ,state-0)
  ^-  form:m
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-0 vase))
::  The head's half of turning the hand off is one %enable poke for each
::  conversation, each answered with its status.
::
::  The head's and the adapter's events over MANY conversations share one
::  ledger, since building it is most of a test's time.
++  test-crowded-events
  =/  db  (filled many)
  %+  weld  (eval-mare (crowded-head-events db many live-schedules sampled))
  (eval-mare (crowded-adapter-events db))
::  N conversations over DB and JOBS live schedules. The first OFF
::  conversations are turned off, timed together. The projections a message
::  updates because sessions changed are timed again alone, with the
::  message's own inputs.
++  crowded-head-events
  |=  [db=state:hh n=@ud jobs=@ud off=@ud]
  =/  m  (mare ,~)
  ^-  form:m
  =/  tag  |=(row=@t (rap 3 row '-' (scot %ud n) '-' (scot %ud jobs) ~))
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now now)))
  ;<  ~  bind:m  (set-scry-gate live-scry)
  ;<  *  bind:m  (do-load head `!>((crowded-head db n jobs)))
  ;<  ~  bind:m  (wait ~s1)
  ;<  *  bind:m
    %+  timed-step  (tag 'cost-crowded-schedule-poll')
    (do-arvo /schedules/(scot %da +(now)) [%behn %wake ~])
  ;<  polled=state-0  bind:m  saved-head
  ;<  ~  bind:m
    %+  ex-equal
      !>((turn ~(val by schedules.polled) |=(job=schedule:cr state.job)))
    !>((reap jobs %active))
  ::  The first message pays any one-time upkeep.
  ;<  *  bind:m
    %+  do-poke  %harness-hand
    !>(`request:hh`['warm' [%observe (bid 9) 'cost-warm' speaker 'Hello']])
  ;<  before=state-0  bind:m  saved-head
  ;<  message=(list card)  bind:m
    %+  timed-step  (tag 'cost-crowded-head-message')
    %+  do-poke  %harness-hand
    !>(`request:hh`['message' [%observe (bid 8) 'cost-message' speaker 'Hello']])
  ;<  ~  bind:m  (ex-equal !>((llm-requests message)) !>(1))
  ;<  after=state-0  bind:m  saved-head
  =/  modified
    ~>  %bout.[1 (tag 'cost-crowded-message-session-index')]
    (update:si sessions.before sessions.after modified.before now)
  =/  synced
    ~>  %bout.[1 (tag 'cost-crowded-message-corpus-sync')]
    (sync:corpus-lib corpus.before sessions.after)
  ;<  ~  bind:m  (ex-equal !>(~(key by modified)) !>(~(key by modified.after)))
  ;<  bound=(list card)  bind:m
    %+  timed-step  (tag 'cost-crowded-head-new-bind')
    (do-poke %harness-hand !>(`request:hh`['bind' [%bind (bid n) (config n)]]))
  ;<  ~  bind:m  (ex-equal !>(-:(hand-reply 'bind' bound)) !>(%&))
  ;<  *  bind:m
    %+  timed-step  (rap 3 (tag 'cost-crowded-head-hand-off') '-first-' (scot %ud off) ~)
    (hand-off (gulf 0 (dec off)))
  ;<  after=state-0  bind:m  saved-head
  %+  ex-equal
    !>((lent (skim ~(val by bindings.hands.after) |=(b=binding:hh enabled.b))))
  !>(+((sub n off)))
::  The adapter's half: a head notification walks every route, and turning
::  the hand off withdraws every conversation in one event.
::
++  crowded-adapter-events
  |=  db=state:hh
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (adapter-start [db (reindex:hd db)] many |)
  ;<  *  bind:m
    %+  timed-step  'cost-crowded-adapter-notification'
    (do-agent /head [~zod %harness] [%fact %noun !>(%changed)])
  ;<  =vase  bind:m  get-save
  ;<  ~  bind:m  (ex-equal !>(~(wyt by routes:!<(state-3:t vase))) !>(many))
  =/  off  policy:(adapter-state many |)
  ;<  cards=(list card)  bind:m
    %+  timed-step  'cost-crowded-adapter-hand-off'
    %+  do-poke  %noun
    !>(`request:ad`['off' [%n '1'] 'harness/tlon/configure' `(policy-json:tp off(enabled |))])
  =/  disables  (skim (hand-pokes cards) |=(a=action:hh ?=(%enable -.a)))
  =/  fences  (skim (head-pokes cards) |=(a=action:h ?=(%fence -.a)))
  ;<  ~  bind:m  (ex-equal !>((silt disables)) !>((silt (hand-off-requests many))))
  (ex-equal !>((silt fences)) !>((silt (fence-requests many))))
--

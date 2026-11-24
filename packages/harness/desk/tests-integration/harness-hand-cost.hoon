::  Per-event ledger reads with 20,000 finished records. Timings are printed
::  for comparison, not asserted.
::  -test /=harness=/tests-integration/harness-hand-cost
/-  h=harness, hh=harness-hand, t=harness-tlon, cr=harness-cron, dv=channels-ver,
    *harness-store
/+  *test-agent, tst=test, policy=harness-defaults, hd=harness-hand,
    sl=harness-schedule
/=  head  /app/harness
/=  adapter  /app/harness-tlon
|%
++  size  20.000
++  nb  20
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
::  SIZE finished records over NB bindings, plus one claimed publication
::  (b1), two pending (b2, b3), one running input (b4), two queued (b5, b6),
::  and in b7 an uncertain publication with a pending one behind it.
++  ledger
  ^-  state:hh
  =/  db=state:hh  *state:hh
  =.  bindings.db  (malt (turn (gulf 0 (dec nb)) |=(k=@ud [(bid k) (config k)])))
  =/  i=@ud  0
  =.  db
    |-  ^-  state:hh
    ?:  =(i size)  db
    =/  r  (record i (mod i nb))
    %=  $
      i  +(i)
      observations.db  (~(put by observations.db) id.r observation.r)
      outbox.db  (~(put by outbox.db) id.r publication.r)
      controls.db  (~(put by controls.db) id.r control.r)
    ==
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
      'every hour'  *pattern:cr  'Prompt'  ~  (add now ~d1)  5  %active  ''  ~
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
  |=  lensed=?
  ^-  state-5:t
  =/  s=state-5:t  *state-5:t
  =/  ks  (gulf 0 (dec nb))
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
  ?:  ?=([%gu *] path)  `!>(&)
  `!>(|)
++  adapter-start
  |=  [ledger=indexed:hh lensed=?]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now now)))
  ;<  ~  bind:m  (set-scry-gate (adapter-scry ledger))
  ;<  *  bind:m  (do-load adapter `!>((adapter-state lensed)))
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
  ;<  ~  bind:m  (adapter-start indexed |)
  ;<  reconciled=(list card)  bind:m
    %+  timed-step  'cost-adapter-reconcile'
    (do-agent /head [~zod %harness] [%fact %noun !>(%changed)])
  ;<  confirmed=(list card)  bind:m
    %+  timed-step  'cost-adapter-confirmed'
    (do-agent /publications [~zod %channels] [%fact %channel-response-4 !>(proof)])
  ;<  ~  bind:m  (adapter-start indexed &)
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
  |=  db=state:hh
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
  =.  sessions.saved  (malt (turn (gulf 0 (dec nb)) |=(k=@ud [(sid k) [events 1]])))
  saved(hands db, schedules (my ~[[0v7 schedule]]), schedule-wake `(add now ~d1))
++  test-head-reload-and-events
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  db  ledger
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now now)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  *  bind:m  (timed-step 'cost-head-reload' (do-load head `!>((head-state db))))
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
  ;<  *  bind:m  (do-load head `!>((head-state db)))
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
--

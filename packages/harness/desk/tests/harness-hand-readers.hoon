::  Each reader that uses the index returns what its version walking the whole
::  ledger returned. The walking versions live only here.
/-  h=harness, hh=harness-hand, c=harness-cron
/+  *test, hd=harness-hand, schedule=harness-schedule
|%
++  t0  ~2026.10.1
++  config
  |=  [hand=@t sid=@t]
  ^-  binding:hh
  [hand (cat 3 'room-' sid) sid ~['alice'] &]
++  observation
  |=  [binding=@t n=@ud =phase:hh]
  ^-  observation:hh
  [binding (scot %ud n) 'alice' 'text' (add t0 (mul n ~s1)) phase]
++  publication
  |=  [id=input-id:h binding=@t hand=@t sid=@t kind=?(%reply %failure %cancelled) status=delivery-state:hh]
  ^-  publication:hh
  [id binding hand (cat 3 'room-' sid) sid kind 'body' status 'worker' 'external' ~]
::  A failed publication, a cancelled run with a pending notice, records of a
::  second hand, a publication without an observation, a running scheduled
::  input, and observations sharing a timestamp.
::
++  ledger
  ^-  state:hh
  =/  db=state:hh  *state:hh
  =.  bindings.db
    %-  my
    :~  ['b1' (config 'tlon' 's1')]
        ['b2' (config 'tlon' 's2')]
        ['c1' (config 'chat' 's3')]
        ['run' (config 'tlon' 'run')]
        ['off' 'tlon' 'room-s4' 's4' ~['alice'] |]
    ==
  =.  observations.db
    %-  my
    :~  [0v1 (observation 'b1' 1 %completed)]
        [0v2 (observation 'b1' 2 %completed)]
        [0v3 (observation 'b2' 3 %cancelled)]
        [0v4 (observation 'c1' 4 %completed)]
        [0v5 (observation 'c1' 5 %queued)]
        [0v6 (observation 'run' 6 %running)]
        [0v7 (observation 'b1' 7 %completed)]
        [0v8 (observation 'b2' 7 %completed)]
        [0v9 (observation 'run' 9 %completed)]
        [0vb (observation 'off' 10 %completed)]
        [0vc (observation 'gone' 11 %completed)]
    ==
  =.  outbox.db
    %-  my
    :~  [0v1 (publication 0v1 'b1' 'tlon' 's1' %reply %delivered)]
        [0v2 (publication 0v2 'b1' 'tlon' 's1' %failure %failed)]
        [0v3 (publication 0v3 'b2' 'tlon' 's2' %cancelled %pending)]
        [0v4 (publication 0v4 'c1' 'chat' 's3' %reply %pending)]
        [0v7 (publication 0v7 'b1' 'tlon' 's1' %reply %claimed)]
        [0v8 (publication 0v8 'b2' 'tlon' 's2' %reply %uncertain)]
        [0v9 (publication 0v9 'run' 'tlon' 'run' %reply %pending)]
        [0va (publication 0va 'b1' 'tlon' 's1' %reply %pending)]
        [0vb (publication 0vb 'off' 'tlon' 's4' %reply %pending)]
    ==
  =.  queue.db  ~[0v5]
  =.  active.db  (my ~[['run' 0v6]])
  db
++  indexed  `indexed:hh`[ledger (reindex:hd ledger)]
++  job
  |=  [run-sid=@t last=(unit input-id:h) state=?(%active %complete %cancelled)]
  ^-  job:c
  =/  base=schedule:c
    :*  'b1'  'alice'  'tlon'  0v0  %prompt  'UTC'  'room-s1'  's1'  run-sid
        'every hour'  *pattern:c  'Prompt'  ~  t0  0  state  ''  last
    ==
  (job-value:schedule base)
::  The walking versions, as they were before the index.
::
++  busy-walk
  |=  [job=job:c db=state:hh]
  ^-  ?
  ?:  &(?=(^ last.job) !(~(has by observations.db) u.last.job))  &
  ?|  %+  lien  ~(val by observations.db)
      |=  observation=observation:hh
      ?&  =(run-sid.job binding.observation)
          ?=(?(%queued %running) phase.observation)
      ==
      %+  lien  ~(val by outbox.db)
      |=  publication=publication:hh
      ?&  =(run-sid.job sid.publication)
          ?=(?(%pending %claimed %uncertain) status.publication)
      ==
  ==
++  clearable-walk
  |=  [job=job:c db=state:hh]
  ^-  ?
  ?.  |(=(%cancelled state.job) (used-up:schedule job))  |
  ?:  (busy-walk job db)  |
  ?~  last.job  =(%cancelled state.job)
  =/  last  (~(get by observations.db) u.last.job)
  ?~  last  |
  =(run-sid.job binding.u.last)
++  pending-walk
  |=  [db=state:hh hand=@t]
  ^-  (list [id=input-id:h pub=publication:hh])
  =/  pending
    %+  murn  ~(tap by outbox.db)
    |=  [id=input-id:h pub=publication:hh]
    ^-  (unit [at=@da id=input-id:h pub=publication:hh])
    ?.  &(=(hand hand.pub) =(%pending status.pub))  ~
    =/  obs  (~(get by observations.db) input.pub)
    ?~  obs  ~
    `[at.u.obs id pub]
  =.  pending
    %+  sort  pending
    |=  [a=[at=@da id=input-id:h pub=publication:hh] b=[at=@da id=input-id:h pub=publication:hh]]
    ?:  =(at.a at.b)  (lth id.a id.b)
    (lth at.a at.b)
  (turn pending |=([at=@da id=input-id:h pub=publication:hh] [id pub]))
++  outbox-walk
  |=  [db=state:hh hand=@t]
  ^-  json
  :-  %a
  %+  murn  ~(tap by outbox.db)
  |=  [id=input-id:h publication=publication:hh]
  ^-  (unit json)
  ?.  =(hand hand.publication)  ~
  ?:  (terminal:hd status.publication)  ~
  =/  config  (~(get by bindings.db) binding.publication)
  ?~  config  ~
  ?.  enabled.u.config  ~
  `(publication-json:hd db id publication)
++  publications-walk
  |=  [db=state:hh hand=@t after=(unit input-id:h) limit=@ud]
  ^-  json
  =/  ids=(list input-id:h)
    %-  sort
    :_  lth
    %+  murn  ~(tap by outbox.db)
    |=  [id=input-id:h publication=publication:hh]
    ^-  (unit input-id:h)
    ?.  &(=(hand hand.publication) !(terminal:hd status.publication))  ~
    ?:  &(?=(^ after) (lte id u.after))  ~
    =/  config  (~(get by bindings.db) binding.publication)
    ?~  config  ~
    ?.  enabled.u.config  ~
    `id
  =/  page  (scag (min (max 1 (min 4 limit)) (lent ids)) ids)
  =/  records=(list json)
    %+  turn  page
    |=  id=input-id:h
    (publication-json:hd db id (need (~(get by outbox.db) id)))
  %-  pairs:enjs:format
  :~  ['records' %a records]
      ['next' ?:((gth (lent ids) (lent page)) (id-json:hd (rear page)) ~)]
  ==
++  detach-walk
  |=  [db=state:hh sid=session-id:h now=@da]
  ^-  state:hh
  ?>  !(~(has by active.db) sid)
  =.  db  (cancel-queued:hd db sid ~)
  =.  bindings.db
    %+  roll  ~(tap by bindings.db)
    |=  [[id=@t config=binding:hh] bindings=(map @t binding:hh)]
    (~(put by bindings) id ?:(=(sid sid.config) config(enabled |) config))
  %+  roll  ~(tap by outbox.db)
  |=  [[id=input-id:h publication=publication:hh] ledger=_db]
  ?.  &(=(sid sid.publication) =(%pending status.publication))  ledger
  =.  publication
    %=  publication
      status  %abandoned
      receipts  [[now %abandoned '' ''] receipts.publication]
    ==
  =/  control  (get-control:hd ledger id)
  =.  control
    %=  control  resolutions
        :*  [now attempt.control %abandoned 'Conversation deleted before dispatch']
            resolutions.control
        ==
    ==
  %=  ledger
    outbox  (~(put by outbox.ledger) id publication)
    controls  (~(put by controls.ledger) id control)
  ==
::  The adapter's Lens selection before the index: newest 64 Tlon
::  observations after the cursor, by time only.
::
++  lens-walk
  |=  [db=state:hh after=@da]
  ^-  (list input-id:h)
  %+  turn
    %+  scag  64
    %+  sort
      %+  skim  ~(tap by observations.db)
      |=  [id=input-id:h observation=observation:hh]
      =/  binding  (~(get by bindings.db) binding.observation)
      ?&  ?=(^ binding)
          =('tlon' hand.u.binding)
          (gth at.observation after)
      ==
    |=  [left=[id=input-id:h observation=observation:hh] right=[id=input-id:h observation=observation:hh]]
    (gth at.observation.left at.observation.right)
  head
++  lens-indexed
  |=  [ledger=indexed:hh after=@da]
  ^-  (list input-id:h)
  %+  skim  (~(gut by recent.index.ledger) 'tlon' ~)
  |=(id=input-id:h (gth at:(~(got by observations.db.ledger) id) after))
::  The adapter's publication predicates, drawn from the whole outbox and
::  from the open records, in iteration order.
::
++  matching-walk
  |=  [db=state:hh ok=$-(publication:hh ?)]
  ^-  (list input-id:h)
  (murn ~(tap by outbox.db) |=([id=input-id:h p=publication:hh] ?:((ok p) `id ~)))
++  matching-indexed
  |=  [ledger=indexed:hh ok=$-(publication:hh ?)]
  ^-  (list input-id:h)
  %+  murn  ~(tap in open.index.ledger)
  |=  id=input-id:h
  =/  p  (~(get by outbox.db.ledger) id)
  ?:(&(?=(^ p) (ok u.p)) `id ~)
::
++  test-schedule-readers-agree
  =/  db  ledger
  =/  jobs=(list job:c)
    :~  (job 'run' `0v6 %active)
        (job 'run' `0v9 %complete)
        (job 'run' `0vd %active)
        (job 's2' `0v3 %cancelled)
        (job 's1' `0v2 %complete)
        (job 'c1' `0v4 %complete)
        (job 'quiet' ~ %cancelled)
    ==
  %-  zing
  %+  turn  jobs
  |=  =job:c
  ;:  weld
    (expect-eq !>((busy-walk job db)) !>((busy:schedule job indexed)))
    (expect-eq !>((clearable-walk job db)) !>((clearable:schedule job indexed)))
  ==
++  test-publication-readers-agree
  =/  db  ledger
  %-  zing
  %+  turn  `(list @t)`~['tlon' 'chat' 'none']
  |=  hand=@t
  ;:  weld
    (expect-eq !>((pending-walk db hand)) !>((pending-publications:hd indexed hand)))
    (expect-eq !>((outbox-walk db hand)) !>((outbox-json:hd indexed hand)))
    (expect-eq !>((publications-walk db hand ~ 4)) !>((publications-json:hd indexed hand ~ 4)))
    (expect-eq !>((publications-walk db hand ~ 1)) !>((publications-json:hd indexed hand ~ 1)))
    %+  expect-eq
      !>((publications-walk db hand `0v3 2))
    !>((publications-json:hd indexed hand `0v3 2))
  ==
++  test-detach-agrees
  =/  db  ledger
  %-  zing
  %+  turn  `(list @t)`~['s1' 's2' 's3' 's4']
  |=  sid=@t
  =/  detached  (detach-session-indexed:hd indexed sid t0)
  ;:  weld
    (expect-eq !>((detach-walk db sid t0)) !>(db.detached))
    (expect-eq !>((reindex:hd db.detached)) !>(index.detached))
  ==
++  test-adapter-selections-agree
  =/  db  ledger
  =/  unsettled
    |=  p=publication:hh
    &(=('tlon' hand.p) =('room-s2' address.p) ?=(?(%claimed %uncertain) status.p))
  =/  confirmable
    |=  p=publication:hh
    &(=('tlon' hand.p) =('worker' worker.p) ?=(?(%claimed %uncertain) status.p))
  ;:  weld
    (expect-eq !>((matching-walk db unsettled)) !>((matching-indexed indexed unsettled)))
    (expect-eq !>((matching-walk db confirmable)) !>((matching-indexed indexed confirmable)))
    ::  Equal timestamps are ordered by id only in the indexed version.
    %+  expect-eq
      !>((sort (lens-walk db (add t0 ~s3)) lth))
    !>((sort (lens-indexed indexed (add t0 ~s3)) lth))
    (expect-eq !>((sort (lens-walk db `@da`0) lth)) !>((sort (lens-indexed indexed `@da`0) lth)))
  ==
--

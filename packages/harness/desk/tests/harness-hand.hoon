/-  h=harness, hh=harness-hand
/+  *test, hd=harness-hand
|%
++  seed
  ^-  state:hh
  =/  cfg=binding:hh  ['chat' 'opaque/thread' 'session' ~['alice'] %.y]
  =/  res  (apply:hd *state:hh [%bind 'binding' cfg] ~2000.1.1)
  ?>  ?=(%& -.res)
  db.p.res
++  admitted
  ^-  state:hh
  =/  res  (apply:hd seed [%observe 'binding' 'message-1' 'alice' 'Hello'] ~2000.1.1)
  ?>  ?=(%& -.res)
  db.p.res
++  id  (input-id:hd 'binding' 'message-1')
++  completed
  ^-  state:hh
  (finish:hd (start:hd admitted 'session' id) 'session' %reply 'The answer')
++  claimed
  ^-  state:hh
  =/  res  (apply:hd completed [%claim 'chat' id 'worker-1'] ~2000.1.1)
  ?>  ?=(%& -.res)
  db.p.res
++  test-detach-cancels-queued-work-and-disables-admission
  =/  db  (detach-session:hd admitted 'session' ~2000.1.2)
  =/  res  (apply:hd db [%observe 'binding' 'new' 'alice' 'Hello'] ~2000.1.2)
  ;:  weld
      (expect-eq !>(~) !>(queue.db))
      (expect-eq !>(%cancelled) !>(phase:(~(got by observations.db) id)))
      (expect !>(!enabled:(~(got by bindings.db) 'binding')))
      (expect !>(?=(%| -.res)))
  ==
++  test-detach-abandons-only-undispatched-output
  =/  completed  completed
  =/  claimed  claimed
  =/  db  (detach-session:hd completed 'session' ~2000.1.2)
  =/  in-flight  (detach-session:hd claimed 'session' ~2000.1.2)
  ;:  weld
      (expect-eq !>(%abandoned) !>(status:(~(got by outbox.db) id)))
      (expect-eq !>(observations.completed) !>(observations.db))
      (expect-eq !>(outbox.claimed) !>(outbox.in-flight))
      (expect-eq !>(controls.claimed) !>(controls.in-flight))
      (expect-eq !>(db) !>((detach-session:hd db 'session' ~2000.1.3)))
      (expect-eq !>(completed) !>((detach-session:hd completed 'unrelated' ~2000.1.2)))
  ==
++  test-deduplicates-source-events
  =/  res  (apply:hd admitted [%observe 'binding' 'message-1' 'alice' 'Hello'] ~2000.1.2)
  ?>  ?=(%& -.res)
  (expect-eq !>(admitted) !>(db.p.res))
++  test-rejects-conflicting-replays
  =/  res  (apply:hd admitted [%observe 'binding' 'message-1' 'alice' 'Different'] ~2000.1.1)
  (expect !>(?=(%| -.res)))
++  test-rejects-ungranted-actors
  =/  res  (apply:hd seed [%observe 'binding' 'message-1' 'mallory' 'Hello'] ~2000.1.1)
  (expect !>(?=(%| -.res)))
++  test-one-active-input-per-session
  =/  running  (start:hd admitted 'session' id)
  %-  expect
  !>  ?&  =(`id (next:hd admitted 'session'))  =(~ (next:hd running 'session'))
          =(~ (next:hd admitted 'elsewhere'))
      ==
++  test-reply-is-separate-from-delivery
  =/  db  completed
  =/  pub  (need (~(get by outbox.db) id))
  =/  obs  (need (~(get by observations.db) id))
  %-  expect
  !>  ?&  =(%completed phase.obs)  =(%pending status.pub)  =('The answer' body.pub)
          =('opaque/thread' address.pub)  =(~ active.db)
      ==
++  test-claim-is-exclusive
  =/  other  (apply:hd claimed [%claim 'chat' id 'worker-2'] ~2000.1.1)
  =/  again  (apply:hd claimed [%claim 'chat' id 'worker-1'] ~2000.1.2)
  ?>  ?=(%& -.again)
  (expect !>(&(?=(%| -.other) =(claimed db.p.again))))
++  test-receipts-are-idempotent-and-terminal
  =/  done  (apply:hd claimed [%receipt 'chat' id 'worker-1' %delivered 'external-1'] ~2000.1.1)
  ?>  ?=(%& -.done)
  =/  again  (apply:hd db.p.done [%receipt 'chat' id 'worker-1' %delivered 'external-1'] ~2000.1.2)
  ?>  ?=(%& -.again)
  =/  conflict  (apply:hd db.p.done [%receipt 'chat' id 'worker-1' %failed ''] ~2000.1.2)
  (expect !>(&(=(db.p.done db.p.again) ?=(%| -.conflict))))
++  test-uncertain-delivery-cannot-be-retried
  =/  unknown  (apply:hd claimed [%receipt 'chat' id 'worker-1' %uncertain ''] ~2000.1.1)
  ?>  ?=(%& -.unknown)
  =/  again  (apply:hd db.p.unknown [%retry 'chat' id] ~2000.1.2)
  (expect !>(?=(%| -.again)))
++  test-delivery-retry-does-not-requeue-inference
  =/  baseline  completed
  =/  failed  (apply:hd claimed [%receipt 'chat' id 'worker-1' %failed ''] ~2000.1.1)
  ?>  ?=(%& -.failed)
  =/  again  (apply:hd db.p.failed [%retry 'chat' id] ~2000.1.2)
  ?>  ?=(%& -.again)
  %-  expect
  !>  ?&  =(~ queue.db.p.again)  =(~ active.db.p.again)
          =(observations.baseline observations.db.p.again)
      ==
++  test-disable-hides-undelivered-output
  =/  disabled  (apply:hd completed [%enable 'binding' %.n] ~2000.1.1)
  ?>  ?=(%& -.disabled)
  (expect-eq !>(`json`[%a ~]) !>((outbox-json:hd db.p.disabled 'chat')))
++  test-cancel-removes-queued-work
  =/  cancelled  (cancel-queued:hd admitted 'session')
  =/  obs  (need (~(get by observations.cancelled) id))
  (expect !>(&(=(~ queue.cancelled) =(%cancelled phase.obs))))
++  test-source-ids-are-namespaced
  (expect !>(!=((input-id:hd 'binding' 'message-1') (input-id:hd 'elsewhere' 'message-1'))))
++  test-disabled-binding-cannot-claim
  =/  disabled  (apply:hd completed [%enable 'binding' %.n] ~2000.1.1)
  ?>  ?=(%& -.disabled)
  =/  res  (apply:hd db.p.disabled [%claim 'chat' id 'worker-1'] ~2000.1.1)
  (expect !>(?=(%| -.res)))
++  test-unsettled-bindings-cannot-be-removed
  =/  queued  (apply:hd admitted [%remove 'binding'] ~2000.1.1)
  =/  pending  (apply:hd completed [%remove 'binding'] ~2000.1.1)
  (expect !>(&(?=(%| -.queued) ?=(%| -.pending))))
++  test-binding-destination-is-immutable
  =/  cfg=binding:hh  ['chat' 'different/thread' 'session' ~['alice'] %.y]
  =/  res  (apply:hd seed [%bind 'binding' cfg] ~2000.1.1)
  (expect !>(?=(%| -.res)))
++  test-failed-work-still-has-a-publication
  =/  db  (finish:hd (start:hd admitted 'session' id) 'session' %failure 'Work failed.')
  =/  pub  (need (~(get by outbox.db) id))
  =/  obs  (need (~(get by observations.db) id))
  (expect !>(&(=(%failed phase.obs) =(%failure kind.pub) =(%pending status.pub))))
++  fill
  |=  [db=state:hh binding=@t count=@ud]
  ^-  state:hh
  ?:  =(0 count)  db
  =/  res  (apply:hd db [%observe binding (scot %ud count) 'alice' 'queued'] ~2000.1.1)
  ?>  ?=(%& -.res)
  $(db db.p.res, count (dec count))
++  test-busy-binding-does-not-monopolize-admission
  =/  db  (fill seed 'binding' 8)
  =/  blocked  (apply:hd db [%observe 'binding' 'ninth' 'alice' 'No'] ~2000.1.1)
  =/  cfg=binding:hh  ['mail' 'mailbox' 'another-session' ~['alice'] %.y]
  =/  bound  (apply:hd db [%bind 'other' cfg] ~2000.1.1)
  ?>  ?=(%& -.bound)
  =/  accepted  (apply:hd db.p.bound [%observe 'other' 'first' 'alice' 'Yes'] ~2000.1.1)
  (expect !>(&(?=(%| -.blocked) ?=(%& -.accepted))))
++  test-session-quota-covers-multiple-bindings
  =/  db  (fill seed 'binding' 8)
  =/  cfg=binding:hh  ['chat' 'another-thread' 'session' ~['alice'] %.y]
  =/  bound  (apply:hd db [%bind 'two' cfg] ~2000.1.1)
  ?>  ?=(%& -.bound)
  =.  db  (fill db.p.bound 'two' 8)
  =/  third  (apply:hd db [%bind 'three' cfg] ~2000.1.1)
  ?>  ?=(%& -.third)
  =/  blocked  (apply:hd db.p.third [%observe 'three' 'first' 'alice' 'No'] ~2000.1.1)
  (expect !>(?=(%| -.blocked)))
++  test-recovery-fences-old-receipts
  =/  recovered
    %^  apply:hd
      claimed
      [%resolve 'chat' id 1 %failed '' 'Destination confirmed no message']
    ~2000.1.2
  ?>  ?=(%& -.recovered)
  =/  retried  (apply:hd db.p.recovered [%retry 'chat' id] ~2000.1.2)
  ?>  ?=(%& -.retried)
  =/  new-claim  (apply:hd db.p.retried [%claim 'chat' id 'worker-1'] ~2000.1.2)
  ?>  ?=(%& -.new-claim)
  =/  stale
    %^  apply:hd
      db.p.new-claim
      [%receipt-at 'chat' id 'worker-1' 1 %delivered 'late']
    ~2000.1.2
  =/  correct
    %^  apply:hd
      db.p.new-claim
      [%receipt-at 'chat' id 'worker-1' 3 %delivered 'new']
    ~2000.1.2
  (expect !>(&(?=(%| -.stale) ?=(%& -.correct))))
++  test-owner-can-abandon-without-pretending-delivery
  =/  baseline  completed
  =/  res
    %^  apply:hd
      claimed
      [%resolve 'chat' id 1 %abandoned '' 'Do not publish this answer']
    ~2000.1.2
  ?>  ?=(%& -.res)
  =/  db  db.p.res
  =/  pub  (need (~(get by outbox.db) id))
  =/  retried  (apply:hd db [%retry 'chat' id] ~2000.1.2)
  (expect !>(&(=(%abandoned status.pub) =(observations.db observations.baseline) ?=(%| -.retried))))
++  archivable
  ^-  state:hh
  =/  done  (apply:hd claimed [%receipt-at 'chat' id 'worker-1' 1 %delivered 'message'] ~2000.1.1)
  ?>  ?=(%& -.done)
  =/  disabled  (apply:hd db.p.done [%enable 'binding' %.n] ~2000.1.1)
  ?>  ?=(%& -.disabled)
  db.p.disabled
++  test-archive-requires-settled-disabled-binding
  =/  active  (apply:hd completed [%archive 'binding'] ~2000.1.1)
  =/  ready  (apply:hd archivable [%archive 'binding'] ~2000.1.1)
  (expect !>(&(?=(%| -.active) ?=(%& -.ready))))
++  test-retirement-preserves-replay-rejection
  =/  db  archivable
  =/  hash  (archive-digest:hd db 'binding')
  =/  stale  (apply:hd db [%retire 'binding' 0v0 'archive.jsonl'] ~2000.1.2)
  =/  done  (apply:hd db [%retire 'binding' hash 'archive.jsonl'] ~2000.1.2)
  ?>  ?=(%& -.done)
  =.  db  db.p.done
  =/  replay  (apply:hd db [%observe 'binding' 'message-1' 'alice' 'Hello'] ~2000.1.2)
  =/  cfg=binding:hh  ['chat' 'opaque/thread' 'session' ~['alice'] %.y]
  =/  reuse  (apply:hd db [%bind 'binding' cfg] ~2000.1.2)
  (expect !>(&(=(~ observations.db) =(~ outbox.db) ?=(%| -.stale) ?=(%| -.replay) ?=(%| -.reuse))))
++  test-generated-identities-do-not-require-tombstones
  =/  cfg=binding:hh  ['chat' 'opaque' 'session' ~['alice'] %.y]
  =/  first  (apply:hd *state:hh [%register cfg] ~2000.1.1)
  ?>  ?=(%& -.first)
  =/  removed  (apply:hd db.p.first [%remove 'hand--0'] ~2000.1.1)
  ?>  ?=(%& -.removed)
  =/  second  (apply:hd db.p.removed [%register cfg] ~2000.1.1)
  ?>  ?=(%& -.second)
  =/  db  db.p.second
  =/  reuse  (apply:hd db [%bind 'hand--0' cfg] ~2000.1.1)
  (expect !>(&(=(~ retired.db) (~(has by bindings.db) 'hand--1') ?=(%| -.reuse))))
++  test-retirement-preserves-other-bindings-and-allocator
  =/  cfg=binding:hh  ['mail' 'opaque' 'other-session' ~['alice'] %.y]
  =/  registered  (apply:hd archivable [%register cfg] ~2000.1.1)
  ?>  ?=(%& -.registered)
  =/  observed
    %^  apply:hd
      db.p.registered
      [%observe 'hand--0' 'mail-1' 'alice' 'Keep this']
    ~2000.1.1
  ?>  ?=(%& -.observed)
  =/  before  db.p.observed
  =/  done
    %^  apply:hd
      before
      [%retire 'binding' (archive-digest:hd before 'binding') 'archive.jsonl']
    ~2000.1.2
  ?>  ?=(%& -.done)
  =/  after  db.p.done
  =/  kept  (input-id:hd 'hand--0' 'mail-1')
  %-  expect
  !>  ?&  (~(has by bindings.after) 'hand--0')  (~(has by observations.after) kept)
          =(queue.before queue.after)  =(next-binding.before next-binding.after)
      ==
++  test-register-skips-detached-retained-identities
  =/  cfg=binding:hh  ['mail' 'opaque' 'session' ~['alice'] %.y]
  =/  obs=observation:hh  ['hand--1' 'event' 'alice' 'Kept' ~2000.1.1 %completed]
  =/  db  *state:hh
  =.  db
    db(observations (~(put by observations.db) (input-id:hd 'hand--1' 'event') obs), next-binding 1)
  =/  added  (apply:hd db [%register cfg] ~2000.1.2)
  ?>  ?=(%& -.added)
  (expect !>((~(has by bindings.db.p.added) 'hand--2')))
++  test-health-inspection-never-expires-a-claim
  =/  res  (apply:hd claimed [%health 'chat'] ~2030.1.1)
  ?>  ?=(%& -.res)
  (expect-eq !>(claimed) !>(db.p.res))
--

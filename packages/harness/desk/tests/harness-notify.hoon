/-  h=harness, hh=harness-hand
/+  *test, hd=harness-hand
|%
++  seed
  ^-  state:hh
  =/  cfg=binding:hh  ['chat' 'thread' 'head' ~['alice'] &]
  =/  result  (apply:hd *state:hh [%bind 'b' cfg] ~2026.9.6)
  ?>  ?=(%& -.result)
  db.p.result
++  notify
  |=  db=state:hh
  ^-  state:hh
  =/  result  (apply:hd db [%notify 'b' 'reminder' 'alice' '/forget literal text'] ~2026.9.6)
  ?>  ?=(%& -.result)
  db.p.result
++  test-notification-is-pending-delivery-not-inference
  =/  db  (notify seed)
  =/  id  (input-id:hd 'b' 'reminder')
  =/  pub  (~(got by outbox.db) id)
  %-  expect
  !>  ?&  =(~ queue.db)  =(~ active.db)  =(%completed phase:(~(got by observations.db) id))
          =(%pending status.pub)  =('/forget literal text' body.pub)  =('thread' address.pub)
      ==
++  test-duplicate-notification-does-not-repeat-delivery
  =/  db  (notify seed)
  (expect-eq !>(db) !>((notify db)))
++  test-notification-does-not-interrupt-existing-work
  =/  accepted  (apply:hd seed [%observe 'b' 'human' 'alice' 'working'] ~2026.9.6)
  ?>  ?=(%& -.accepted)
  =/  db  (start:hd db.p.accepted 'head' (input-id:hd 'b' 'human'))
  =/  after  (notify db)
  (expect !>(&(=(active.db active.after) =(~ queue.after) =(2 ~(wyt by observations.after)))))
++  test-notification-cannot-promote-queued-human-input
  =/  accepted  (apply:hd seed [%observe 'b' 'reminder' 'alice' '/forget literal text'] ~2026.9.6)
  ?>  ?=(%& -.accepted)
  =/  result
    %^  apply:hd
      db.p.accepted
      [%notify 'b' 'reminder' 'alice' '/forget literal text']
    ~2026.9.6
  (expect !>(?=(%| -.result)))
++  test-disabled-binding-rejects-notification
  =/  disabled  (apply:hd seed [%enable 'b' |] ~2026.9.6)
  ?>  ?=(%& -.disabled)
  =/  result  (apply:hd db.p.disabled [%notify 'b' 'r' 'alice' 'hello'] ~2026.9.6)
  (expect !>(?=(%| -.result)))
++  test-forged-actor-and-conflicting-text-are-rejected
  =/  db  (notify seed)
  =/  forged  (apply:hd db [%notify 'b' 'other' 'mallory' 'hello'] ~2026.9.6)
  =/  conflicting  (apply:hd db [%notify 'b' 'reminder' 'alice' 'changed'] ~2026.9.6)
  (expect !>(&(?=(%| -.forged) ?=(%| -.conflicting))))
--

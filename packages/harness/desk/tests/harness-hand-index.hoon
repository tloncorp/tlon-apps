/-  h=harness, hh=harness-hand
/+  *test, hd=harness-hand
|%
++  t0  ~2026.10.1
++  config
  |=  [hand=@t sid=@t]
  ^-  binding:hh
  [hand (cat 3 'room-' sid) sid ~['alice' 'bob'] &]
++  check
  |=  ledger=indexed:hh
  ^-  tang
  (expect-eq !>((reindex:hd db.ledger)) !>(index.ledger))
++  seen
  |=  ledger=indexed:hh
  ^-  [tang indexed:hh]
  [(check ledger) ledger]
++  go
  |=  [ledger=indexed:hh =action:hh now=@da]
  ^-  [tang indexed:hh]
  =/  applied  (apply-indexed:hd ledger action now)
  ?:  ?=(%| -.applied)  [~[leaf+(trip p.applied)] ledger]
  (seen ledger.p.applied)
++  bound
  |=  bindings=(list [id=@t hand=@t sid=@t])
  ^-  indexed:hh
  %+  roll  bindings
  |=  [[id=@t hand=@t sid=@t] ledger=indexed:hh]
  =/  applied  (apply-indexed:hd ledger [%bind id (config hand sid)] t0)
  ?>  ?=(%& -.applied)
  ledger.p.applied
::  Every production write to the ledger, through its indexed form.
::
++  test-index-equals-derivation-after-every-write
  =/  l  (bound ~[['one' 'chat' 's1'] ['two' 'chat' 's2'] ['three' 'other' 's3']])
  =/  id  |=([b=@t e=@t] (input-id:hd b e))
  =|  out=tang
  =^  e  l  (go l [%observe 'one' 'e1' 'alice' 'first'] t0)
  =.  out  (weld out e)
  =^  e  l  (go l [%observe 'one' 'e2' 'alice' 'second'] t0)
  =.  out  (weld out e)
  =^  e  l  (go l [%observe 'two' 'e3' 'alice' 'third'] t0)
  =.  out  (weld out e)
  =^  e  l  (go l [%notify 'three' 'n1' 'alice' 'notice'] t0)
  =.  out  (weld out e)
  =^  e  l  (seen (start-indexed:hd l 's1' (id 'one' 'e1')))
  =.  out  (weld out e)
  =^  e  l  (seen (finish-indexed:hd l 's1' %reply 'answer'))
  =.  out  (weld out e)
  =^  e  l  (seen (start-indexed:hd l 's2' (id 'two' 'e3')))
  =.  out  (weld out e)
  =^  e  l  (seen (finish-indexed:hd l 's2' %failure 'failed'))
  =.  out  (weld out e)
  =^  e  l  (seen (start-indexed:hd l 's1' (id 'one' 'e2')))
  =.  out  (weld out e)
  =^  e  l  (seen (finish-indexed:hd l 's1' %cancelled 'cancelled'))
  =.  out  (weld out e)
  =^  e  l  (seen (finish-indexed:hd l 's1' %reply 'nothing active'))
  =.  out  (weld out e)
  ::  Claims and receipts.
  =^  e  l  (go l [%claim 'chat' (id 'one' 'e1') 'worker'] t0)
  =.  out  (weld out e)
  =^  e  l  (go l [%receipt 'chat' (id 'one' 'e1') 'worker' %delivered 'sent'] t0)
  =.  out  (weld out e)
  =^  e  l  (go l [%claim 'chat' (id 'two' 'e3') 'worker'] t0)
  =.  out  (weld out e)
  =^  e  l  (go l [%receipt-at 'chat' (id 'two' 'e3') 'worker' 1 %failed ''] t0)
  =.  out  (weld out e)
  =^  e  l  (go l [%retry 'chat' (id 'two' 'e3')] t0)
  =.  out  (weld out e)
  =^  e  l  (go l [%claim 'chat' (id 'two' 'e3') 'worker'] t0)
  =.  out  (weld out e)
  =^  e  l  (go l [%receipt-at 'chat' (id 'two' 'e3') 'worker' 2 %uncertain ''] t0)
  =.  out  (weld out e)
  ::  Recovery to each outcome.
  =^  e  l  (go l [%resolve 'chat' (id 'two' 'e3') 2 %uncertain '' 'checking'] t0)
  =.  out  (weld out e)
  =^  e  l  (go l [%resolve 'chat' (id 'two' 'e3') 3 %failed '' 'not sent'] t0)
  =.  out  (weld out e)
  =^  e  l  (go l [%resolve 'chat' (id 'two' 'e3') 4 %delivered 'sent' 'found it'] t0)
  =.  out  (weld out e)
  =^  e  l  (go l [%resolve 'other' (id 'three' 'n1') 0 %abandoned '' 'dropped'] t0)
  =.  out  (weld out e)
  =^  e  l  (go l [%resolve 'chat' (id 'one' 'e2') 0 %abandoned '' 'dropped'] t0)
  =.  out  (weld out e)
  ::  Several queued inputs, one another session's and one another speaker's.
  =^  e  l  (go l [%observe 'one' 'e4' 'alice' 'fourth'] t0)
  =.  out  (weld out e)
  =^  e  l  (go l [%observe 'one' 'e5' 'alice' 'fifth'] t0)
  =.  out  (weld out e)
  =^  e  l  (go l [%observe 'two' 'e6' 'alice' 'sixth'] t0)
  =.  out  (weld out e)
  =^  e  l  (go l [%observe 'one' 'e7' 'bob' 'seventh'] t0)
  =.  out  (weld out e)
  =^  e  l  (seen (cancel-queued-indexed:hd l 's1' `'bob'))
  =.  out  (weld out e)
  =.  out
    %+  weld  out
    %+  expect-eq
      !>(`(list input-id:h)`~[(id 'one' 'e4') (id 'one' 'e5') (id 'two' 'e6')])
    !>(queue.db.l)
  =^  e  l  (seen (cancel-queued-indexed:hd l 's1' ~))
  =.  out  (weld out e)
  =.  out
    %+  weld  out
    (expect-eq !>(`(list input-id:h)`~[(id 'two' 'e6')]) !>(queue.db.l))
  ::  Detaching abandons undispatched output and cancels waiting work.
  =^  e  l  (seen (start-indexed:hd l 's2' (id 'two' 'e6')))
  =.  out  (weld out e)
  =^  e  l  (seen (finish-indexed:hd l 's2' %reply 'reply'))
  =.  out  (weld out e)
  =^  e  l  (go l [%observe 'two' 'e8' 'alice' 'eighth'] t0)
  =.  out  (weld out e)
  =^  e  l  (seen (detach-session-indexed:hd l 's2' t0))
  =.  out  (weld out e)
  =.  out
    %+  weld  out
    (expect-eq !>(%abandoned) !>(status:(~(got by outbox.db.l) (id 'two' 'e6'))))
  ::  Retirement deletes the binding's records.
  =/  digest  (archive-digest:hd db.l 'two')
  =^  e  l  (go l [%retire 'two' digest 'archive'] t0)
  =.  out  (weld out e)
  =.  out
    %+  weld  out
    (expect-eq !>(|) !>((~(has by observations.db.l) (id 'two' 'e3'))))
  =.  out  (weld out (expect-eq !>(~) !>(open.index.l)))
  out
::  Lens reads a hand's newest 64. Retiring the binding holding the newest
::  observation refills the window from the hand's other binding.
::
++  test-retire-refills-the-recent-window
  =/  l  (bound ~[['old' 'tlon' 'so'] ['new' 'tlon' 'sn']])
  =/  l
    %+  roll  (gulf 1 64)
    |=  [n=@ud ledger=_l]
    =/  applied
      %^  apply-indexed:hd  ledger
        [%notify 'old' (scot %ud n) 'alice' 'old']
      (add t0 (mul n ~s1))
    ?>  ?=(%& -.applied)
    ledger.p.applied
  =/  newest  (input-id:hd 'new' 'newest')
  =/  oldest  (input-id:hd 'old' '1')
  =^  e1  l  (go l [%notify 'new' 'newest' 'alice' 'new'] (add t0 ~m5))
  =/  before  (~(got by recent.index.l) 'tlon')
  =^  e2  l  (go l [%resolve 'tlon' newest 0 %abandoned '' 'dropped'] (add t0 ~m5))
  =^  e3  l  (go l [%enable 'new' |] (add t0 ~m5))
  =^  e4  l  (go l [%retire 'new' (archive-digest:hd db.l 'new') 'archive'] (add t0 ~m5))
  =/  after  (~(got by recent.index.l) 'tlon')
  =/  old-ids
    (turn (gulf 1 64) |=(n=@ud (input-id:hd 'old' (scot %ud n))))
  ;:  weld
    e1  e2  e3  e4
    (expect-eq !>(64) !>((lent before)))
    (expect-eq !>(`newest) !>(?~(before ~ `i.before)))
    (expect !>(=(~ (find ~[oldest] before))))
    (expect-eq !>((flop old-ids)) !>(after))
  ==
::  Two observations at the same time across position 64: the lower input id
::  is kept.
::
++  test-recent-ties-break-by-input-id
  =/  l  (bound ~[['b' 'tlon' 's']])
  =/  notify
    |=  [ledger=indexed:hh event=@t at=@da]
    ^-  indexed:hh
    =/  applied  (apply-indexed:hd ledger [%notify 'b' event 'alice' 'text'] at)
    ?>  ?=(%& -.applied)
    ledger.p.applied
  =.  l  (notify l 'tie-a' t0)
  =.  l  (notify l 'tie-b' t0)
  =.  l
    %+  roll  (gulf 1 63)
    |=  [n=@ud ledger=_l]
    (notify ledger (scot %ud n) (add t0 (mul n ~s1)))
  =/  a  (input-id:hd 'b' 'tie-a')
  =/  b  (input-id:hd 'b' 'tie-b')
  =/  window  (~(got by recent.index.l) 'tlon')
  =/  kept  (min a b)
  =/  dropped  (max a b)
  ;:  weld
    (check l)
    (expect-eq !>(64) !>((lent window)))
    (expect-eq !>(kept) !>((rear window)))
    (expect !>(=(~ (find ~[dropped] window))))
  ==
::  Finished records do not count against admission: a binding takes its
::  257th and a ship its 2,049th, as an observation and as a notice.
::
++  finished
  |=  [db=state:hh binding=@t count=@ud]
  ^-  state:hh
  =/  n=@ud  0
  |-
  ?:  =(n count)  db
  =/  event  (scot %ud n)
  =/  id  (input-id:hd binding event)
  =/  config  (~(got by bindings.db) binding)
  %=  $
    n  +(n)
    observations.db  (~(put by observations.db) id [binding event 'alice' 'text' t0 %completed])
      outbox.db
    %+  ~(put by outbox.db)  id
    [id binding hand.config address.config sid.config %reply 'reply' %delivered 'worker' 'sent' ~]
  ==
++  admits
  |=  [db=state:hh binding=@t]
  ^-  tang
  =/  ledger=indexed:hh  [db (reindex:hd db)]
  =/  observed  (apply-indexed:hd ledger [%observe binding 'new' 'alice' 'text'] t0)
  =/  notified  (apply-indexed:hd ledger [%notify binding 'notice' 'alice' 'text'] t0)
  ;:  weld
    (expect !>(?=(%& -.observed)))
    (expect !>(?=(%& -.notified)))
    ?.  ?=(%& -.observed)  ~
    (check ledger.p.observed)
  ==
++  test-a-binding-takes-its-257th-finished-record
  =/  db  db:(bound ~[['b' 'chat' 's']])
  (admits (finished db 'b' 256) 'b')
++  test-a-ship-takes-its-2049th-finished-record
  =/  ids  (turn (gulf 0 8) |=(n=@ud (cat 3 'b' (scot %ud n))))
  =/  db  db:(bound (turn ids |=(id=@t [id 'chat' id])))
  =.  db
    %+  roll  (scag 8 ids)
    |=  [id=@t db=_db]
    (finished db id 256)
  ;:  weld
    (expect-eq !>(2.048) !>(~(wyt by observations.db)))
    (admits db 'b8')
  ==
--

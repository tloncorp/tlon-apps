/-  h=harness, m=harness-memory
/+  *test, capture=harness-memory-capture, memory=harness-memory, json=harness-memory-json,
    policy=harness-defaults, hl=harness
|%
++  fresh
  ^-  session:h
  [~[[%config-replaced builtin-config:policy]] 0]
++  replies
  |=  [n=@ud sid=@t db=state:m session=session:h body=@t]
  ^-  [db=state:m session=session:h]
  ?:  =(0 n)  [db session]
  =/  id  +(next-req.session)
  =/  input=event:h
    :*  %input-received
        [`@uv`id [%poke ~zod] `~zod ~ ~2026.10.9 [%user 'I prefer concise explanations.']]
    ==
  =.  session
    %=  session
      log  [[%llm-completed id %stop [1 1] [%assistant body ~]] input log.session]
      next-req  id
    ==
  =.  db  (prepare:memory db sid log.session)
  =.  db  (enqueue:capture db sid session (play:hl log.session) ~2026.10.9)
  $(n (dec n))
++  due
  |=  db=state:m
  %+  dream:capture
    db(enabled.dreaming.maintenance &, due.dreaming.maintenance `~2026.10.9)
  ~2026.10.9
++  test-replies-only-buffer-evidence-until-the-scheduled-pass
  =/  before  (replies 5 'a' *state:m fresh 'Noted.')
  =/  after  (due db.before)
  =/  ready  (ready:capture after)
  ?>  ?=(^ ready.ready)
  =/  users  (skim evidence.job.u.ready.ready |=(e=evidence:m =('user' role.e)))
  ;:  weld
      (expect-eq !>(~) !>(jobs.db.before))
      (expect-eq !>(db.before) !>((dream:capture db.before ~2026.10.9)))
      (expect-eq !>(1) !>(next.after))
      (expect-eq !>(5) !>((lent users)))
      (expect-eq !>(~) !>(buffered.dreaming.maintenance.after))
      (expect-eq !>(`~2026.10.10) !>(due.dreaming.maintenance.after))
      (expect-eq !>(after) !>((dream:capture after ~2026.10.9)))
      (expect-eq !>(cursors.db.before) !>(cursors.after))
  ==
++  test-repeat-driving-and-nonfinal-events-do-not-buffer-twice
  =/  before  (replies 1 'a' *state:m fresh 'Noted.')
  =/  db  db.before
  =/  session  session.before
  =/  repeated  (enqueue:capture db 'a' session (play:hl log.session) ~2026.10.9)
  =/  events=(list event:h)
    :~  [%llm-completed 9 %tool-calls [1 1] [%assistant 'Working' ~[['call' 'read_file' '{}']]]]
        [%tool-completed 'call' 'read_file' 'Result']
        [%command-completed 0v9 'help' 'Commands']
        [%llm-failed 9 'Failed']
        [%cancelled ~ ~ 'Cancelled']
    ==
  ;:  weld
      (expect-eq !>(db) !>(repeated))
      %+  roll  events
      |=  [event=event:h checks=tang]
      =/  updated  session(log [event log.session])
      %+  weld  checks
      %+  expect-eq  !>(db)
      !>((enqueue:capture db 'a' updated (play:hl log.updated) ~2026.10.9))
  ==
++  test-scheduled-pass-is-bounded-and-coalesces-downtime
  =/  before  (replies 1 'a' *state:m fresh 'Noted.')
  =/  job  (~(got by buffered.dreaming.maintenance.db.before) 'a')
  =/  buffers=(map @t job:m)
    %+  roll  (gulf 0 11)
    |=  [n=@ud buffers=(map @t job:m)]
    =/  sid  (scot %ud n)
    (~(put by buffers) sid job(sid sid, sent (add ~2026.10.1 (mul ~d1 n))))
  =/  db  db.before(buffered.dreaming.maintenance buffers)
  =/  first  (due db)
  =/  second  (dream:capture first ~2026.10.20)
  ;:  weld
      (expect-eq !>(8) !>(next.first))
      (expect-eq !>(4) !>(~(wyt by buffered.dreaming.maintenance.first)))
      (expect-eq !>('0') !>(sid:(~(got by jobs.first) 0)))
      (expect-eq !>(12) !>(next.second))
      (expect-eq !>(~) !>(buffered.dreaming.maintenance.second))
      (expect-eq !>(`~2026.10.21) !>(due.dreaming.maintenance.second))
  ==
++  test-optout-and-forgetting-invalidate-unsubmitted-evidence
  =/  before  (replies 4 'a' *state:m fresh 'Noted.')
  =/  =source:m  ['a' 0v1 1 ~2026.10.9 '~zod']
  =/  off  (command:json db.before source 'memory' 'off')
  =/  on  (command:json db.off source 'memory' 'on')
  =/  after  (replies 1 'a' db.on session.before 'Noted.')
  =/  revoked  db.before(barrier +(barrier.db.before))
  =/  renewed  (replies 1 'a' revoked session.before 'Noted.')
  ;:  weld
      (expect-eq !>(~) !>(buffered.dreaming.maintenance.db.off))
      (expect-eq !>(0) !>(next:(due revoked)))
      (expect-eq !>(1) !>(next:(due db.after)))
      %+  expect-eq  !>(log.session.before)
      !>(stop:(~(got by buffered.dreaming.maintenance.db.renewed) 'a'))
  ==
++  test-one-extraction-does-not-drain-a-large-source-batch
  =/  source  (replies 20 'a' *state:m fresh 'Noted.')
  =/  db  (due db.source)
  =/  ready  (ready:capture db)
  ?>  ?=(^ ready.ready)
  =/  job  job.u.ready.ready
  =/  pending  (plan:capture db.ready id.u.ready.ready job builtin-config:policy ~2026.10.9)
  =/  finished  (finish:capture db.ready(pending `pending) | 'Done' [10 2])
  ;:  weld
      (expect-eq !>(1) !>(next.db))
      (expect !>(!=(log.job stop.job)))
      (expect-eq !>(~) !>(jobs.finished))
      (expect-eq !>(head.finished) !>(next.finished))
      (expect-eq !>(~) !>(ready:(ready:capture finished)))
  ==
++  test-silent-turns-preserve-the-strictest-batch-privacy
  =/  before  (replies 1 'a' *state:m fresh 'Noted.')
  =/  config  builtin-config:policy
  =/  private
    session.before(log [[%config-replaced config(zdr &)] log.session.before])
  =/  silent  (replies 1 'a' db.before private '')
  =/  public
    session.silent(log [[%config-replaced config(zdr |)] log.session.silent])
  =/  after  (replies 4 'a' db.silent public 'Noted.')
  =/  db  (due db.after)
  (expect !>(zdr.config:(~(got by jobs.db) 0)))
++  test-disabled-dreaming-does-not-retry-an-inflight-job
  =/  source  (replies 1 'a' *state:m fresh 'Noted.')
  =/  ready  (ready:capture (due db.source))
  ?>  ?=(^ ready.ready)
  =/  pending  (plan:capture db.ready 0 job.u.ready.ready builtin-config:policy ~2026.10.9)
  =/  db  db.ready(enabled.dreaming.maintenance |, pending `pending, jobs ~, head 1)
  =/  finished  (finish:capture db & 'Off' [1 1])
  ;:  weld
      (expect-eq !>(~) !>(pending.finished))
      (expect-eq !>(~) !>(jobs.finished))
      (expect-eq !>(1) !>(next.finished))
      (expect-eq !>(1) !>(head.finished))
  ==
--

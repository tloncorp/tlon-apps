::  Pure production hot-path timings. No prompts, network or agent evaluation.
::  -test /=harness=/tests-integration/harness-performance
/-  h=harness, hh=harness-hand, c=harness-corpus, w=harness-workspace, *harness-store
/+  *test, hl=harness, hs=harness-session, hd=harness-hand, ci=harness-corpus,
    si=harness-session-index, defaults=harness-defaults, j=harness-workspace-json
|%
++  work-fixture
  ^-  state:w
  =/  db=state:w  *state:w
  =/  count=@ud  2.048
  =/  body  (rap 3 (reap 32.768 'x'))
  |-  ^-  state:w
      ?:  =(0 count)  db
      =/  id  (cat 3 'record-' (scot %ud count))
      =/  at=@da  (add ~2026.9.10 (mul count ~s1))
      =.  tasks.db  (~(put by tasks.db) id ['' 'Task' '' 1 %open ~ '' ~ at])
      =?  db  (lte count 512)
        %=  db  artifacts
            %+  ~(put by artifacts.db)
              id
            [0v0 ~ 'Document' 1 (my ~[[1 [at [0v0 'Owner'] ['Document' body ~]]]]) ~ 0 |]
          recency  (~(put by recency.db) [%artifact id] at)
        ==
      $(count (dec count))
++  test-work-first-page-costs-at-record-capacity
  =/  db  work-fixture
  =/  owner=authority:w  [& [0v0 'Owner'] 0v0]
  =/  tasks
    ~>  %bout.[1 'perf-recent-task-page-2048']
    (read:j db owner 'tasks' [%o ~])
  =/  artifacts
    ~>  %bout.[1 'perf-recent-artifact-page-512-with-16MiB-bodies']
    (read:j db owner 'artifacts' [%o ~])
  =/  task-rows  (need (get:j tasks 'items'))
  =/  artifact-rows  (need (get:j artifacts 'items'))
  ?>  &(?=(%a -.task-rows) ?=(%a -.artifact-rows))
  ;:  weld
      (expect-eq !>(24) !>((lent p.task-rows)))
      (expect-eq !>(24) !>((lent p.artifact-rows)))
      (expect-eq !>('record-2.048') !>((string:j (snag 0 p.task-rows) 'id')))
      (expect-eq !>('record-512') !>((string:j (snag 0 p.artifact-rows) 'id')))
      (expect !>((lth (met 3 (en:json:html artifacts)) 16.384)))
  ==
++  history
  |=  turns=@ud
  ^-  (list event:h)
  =/  log=(list event:h)  ~[[%config-replaced builtin-config:defaults]]
  |-  ^-  (list event:h)
      ?:  =(0 turns)  log
      =/  id=@uv  `@uv`turns
      %=  $  turns  (dec turns)  log
          :*  [%command-completed id 'memory' 'No pinned notes.']
              [%input-received [id [%acp 'benchmark'] `~zod ~ ~2026.9.10 [%user '/memory']]]  log
          ==
      ==
++  fleet
  |=  count=@ud
  ^-  (map session-id:h session:h)
  =/  log  (history 256)
  =|  sessions=(map session-id:h session:h)
  |-  ^-  (map session-id:h session:h)
      ?:  =(0 count)  sessions
      =/  sid  (cat 3 'benchmark-' (scot %ud count))
      $(count (dec count), sessions (~(put by sessions) sid [log 1]))
++  interrupted-history
  |=  turns=@ud
  ^-  (list event:h)
  =|  log=(list event:h)
  |-  ^-  (list event:h)
      ?:  =(0 turns)  log
      =/  batch=(list event:h)
        :~  [%cancelled ~ ~ 'interrupted']
            [%tool-completed 'done' 'http_fetch' 'HTTP 200']
            :*  %llm-completed  turns  %tool-calls  [1 1]
                [%assistant '' ~[['done' 'http_fetch' '{}'] ['pending' 'http_fetch' '{}']]]
            ==
            [%input-admitted [%user 'check']]
        ==
      $(turns (dec turns), log (weld batch log))
++  test-hot-path-costs
  =/  saved=state-0  *state-0
  =.  sessions.saved  (fleet 128)
  =/  packed=vase  !>(saved)
  =/  validated
    ~>  %bout.[1 'perf-validate-full-store-128x513']
    !<(state-0 packed)
  =/  log  (history 4.096)
  =/  view
    ~>  %bout.[1 'perf-replay-8193-events']
    (play:hl log)
  =/  events=(list event:h)
    ~[[%tool-requested-2 1 'call' 'http_fetch'] [%tool-completed 'call' 'http_fetch' 'HTTP 200']]
  =/  advanced
    ~>  %bout.[1 'perf-advance-tool-batch-8193-events']
    (advance:hl events view)
  =/  snapshot
    ~>  %bout.[1 'perf-unchanged-snapshot-8193-events']
    (snapshot:hs [log 1] `8.193 (play:hl log))
  =/  full
    ~>  %bout.[1 'perf-first-history-page-8193-events']
    (history:hs [log 1] ~)
  =/  transcript
    ~>  %bout.[1 'perf-full-transcript-8193-events']
    (transcript:hl log)
  =/  interrupted  (interrupted-history 256)
  =/  cancelled
    ~>  %bout.[1 'perf-transcript-256-interrupted-exchanges']
    (transcript:hl interrupted)
  =/  corpus
    ~>  %bout.[1 'perf-initial-corpus-capture-128']
    (sync:ci *state:c sessions.saved)
  =/  next
    %+  ~(put by sessions.saved)
      'benchmark-1'
    [[[%memory-set 'note' `'updated'] (history 256)] 1]
  =/  modified
    ~>  %bout.[1 'perf-one-session-modified-index-128']
    (update:si sessions.saved next (seed:si sessions.saved) ~2026.9.10)
  =/  synced
    ~>  %bout.[1 'perf-one-session-corpus-sync-128']
    (sync:ci corpus next)
  ;:  weld
      (expect-eq !>(sessions.saved) !>(sessions.validated))
      (expect-eq !>(8.193) !>(revision.view))
      (expect-eq !>((play:hl (weld (flop events) log))) !>(advanced))
      (expect !>(?=(%o -.snapshot)))
      (expect !>(?=(^ before.full)))
      (expect-eq !>(`json`[%n '8154']) !>(before.full))
      (expect-eq !>(8.192) !>((lent transcript)))
      (expect-eq !>(1.024) !>((lent cancelled)))
      (expect-eq !>(128) !>(~(wyt by modified)))
      (expect-eq !>(128) !>(~(wyt by names.synced)))
  ==
++  ledger
  |=  count=@ud
  ^-  state:hh
  =|  db=state:hh
  |-  ^-  state:hh
      ?:  =(0 count)  db
      =/  id=@uv  `@uv`count
      =.  observations.db
        %+  ~(put by observations.db)
          id
        ['binding' 'event' 'actor' 'body' (add ~2026.9.10 (mul count ~s1)) %completed]
      =.  outbox.db
        %+  ~(put by outbox.db)
          id
        :*  id  'binding'  ?:(=(0 (mod count 2)) 'other-hand' 'one-hand')  'room'  'session'  %reply
            'retained output'  ?:(=(count 1) %pending %delivered)  ''  ''  ~
        ==
      $(count (dec count))
++  test-pending-frontier-with-retained-evidence
  =/  db  (ledger 2.048)
  =/  before
    ~>  %bout.[1 'perf-outbox-sort-all-2048']
    =/  sorted
      %+  sort  ~(tap by outbox.db)
      |=  [a=[@uv publication:hh] b=[@uv publication:hh]]
      (lth at:(~(got by observations.db) -.a) at:(~(got by observations.db) -.b))
    (skim sorted |=([id=@uv pub=publication:hh] &(=('one-hand' hand.pub) =(%pending status.pub))))
  =/  after
    ~>  %bout.[1 'perf-outbox-pending-frontier-2048']
    (pending-publications:hd db 'one-hand')
  (expect-eq !>(before) !>(after))
--

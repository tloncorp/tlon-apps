/-  m=harness-memory, h=harness
/+  *test, memory=harness-memory, capture=harness-memory-capture, policy=harness-defaults,
    hp=harness-provider, hl=harness
|%
++  input
  |=  [id=@uv text=@t]
  ^-  event:h
  [%input-received [id [%poke ~zod] `~zod ~ ~2026.10.7 [%user text]]]
++  session
  ^-  session:h
  :_  1
  :~  [%llm-completed 0 %stop [1 1] [%assistant 'Understood.' ~]]
      [%llm-routed 0 builtin-config:policy]
      [%llm-requested 0 %turn]
      (input 0v1 'Provisioning requires zero data retention.')
      [%config-replaced builtin-config:policy]
  ==
++  queued
  =/  db  (prepare:memory *state:m 'first' log:session)
  =.  db  db(enabled.dreaming.maintenance &, due.dreaming.maintenance `~2026.10.7)
  =.  db  (enqueue:capture db 'first' session (play:hl log:session) ~2026.10.7)
  (dream:capture db ~2026.10.7)
++  pending
  ^-  pending:m
  =/  ready  (ready:capture queued)
  ?>  ?=(^ ready.ready)
  (plan:capture db.ready id.u.ready.ready job.u.ready.ready builtin-config:policy ~2026.10.7)
++  answer
  '[{"name":"provisioning-privacy","revision":0,"text":"Provisioning requires zero data retention.","aliases":["privacy"],"general":false,"event":2,"quote":"zero data retention"}]'
++  test-completed-turn-is-queued-once-without-changing-the-transcript
  =/  db  queued
  =/  again  (enqueue:capture db 'first' session (play:hl log:session) ~2026.10.7)
  ;:  weld
      (expect-eq !>(db) !>(again))
      (expect-eq !>(1) !>(next.db))
      (expect-eq !>(~) !>(pending.db))
      (expect-eq !>(log:session) !>((~(got by cursors.db) 'first')))
  ==
++  test-capture-accepts-only-quoted-supplied-evidence
  =/  accepted  (accept:capture queued pending answer)
  ?>  ?=(%& -.accepted)
  =/  bad
    %^  accept:capture
      queued
      pending
    '[{"name":"invented","text":"An invented fact.","event":2,"quote":"never said this","aliases":[]}]'
  =/  assistant
    %^  accept:capture
      queued
      pending
    '[{"name":"invented","text":"An invented fact.","event":5,"quote":"Understood","aliases":[]}]'
  ;:  weld
      (expect !>((~(has by records.p.accepted) 'provisioning-privacy')))
      (expect !>(?=(%| -.bad)))
      (expect !>(?=(%| -.assistant)))
      (expect-eq !>(~['provisioning-privacy']) !>((choose:memory p.accepted 'privacy' '~zod')))
  ==
++  test-revocation-and-forgetting-fence-late-capture
  =/  db  queued
  =/  disabled  db(disabled (silt ~['first']))
  =/  forgotten  db(barrier 1)
  =/  revoked  (accept:capture disabled pending answer)
  =/  fenced  (accept:capture forgotten pending answer)
  ;:  weld
      (expect !>(?=(%| -.revoked)))
      (expect !>(?=(%| -.fenced)))
      (expect-eq !>(~) !>(ready:(ready:capture disabled)))
      (expect-eq !>(~) !>(ready:(ready:capture forgotten)))
  ==
++  test-evidence-is-clipped-and-collection-yields
  =/  db  queued
  =/  job  (~(got by jobs.db) 0)
  =.  job
    %=  job
      log  %+  weld
             (reap 40 `event:h`[%tool-completed 'id' 'read_file' (rap 3 (reap 8.192 'x'))])
           log.job
      at  (add at.job 40)
    ==
  =/  result  (collect:capture job)
  ;:  weld
      (expect !>(ready.result))
      (expect !>((lte bytes.job.result 8.192)))
      (expect !>((lte (lent evidence.job.result) 12)))
      (expect !>((gth (lent log.job.result) 5)))
      (expect !>((levy evidence.job.result |=(e=evidence:m (lte (met 3 text.e) 800)))))
  ==
++  test-memory-and-recalled-history-do-not-become-fresh-evidence
  =/  job  (~(got by jobs:queued) 0)
  ;:  weld
      (expect-eq !>(~) !>((excerpt:capture job [%tool-completed '1' 'memory' 'Remembered text'])))
      (expect-eq !>(~) !>((excerpt:capture job [%tool-completed '2' 'lcm_read' 'Older evidence'])))
      %+  expect-eq
        !>(~)
      !>((excerpt:capture job [%tool-completed '3' 'run_subagent' 'Assistant assertion']))
  ==
++  test-capture-payload-has-no-tools-or-injected-memory
  =/  view  (request:capture queued pending)
  =/  payload  (payload:hp view %memory ~)
  ?>  ?=(%o -.payload)
  ;:  weld
      (expect-eq !>(~) !>((~(get by p.payload) 'tools')))
      (expect-eq !>(~) !>(memory.view))
      (expect-eq !>(instruction:capture) !>(system.config.view))
      (expect !>((lte (completion-budget:hp %memory max-context.config.view) 1.024)))
  ==
++  test-empty-capture-and-bounded-retry-settle-independently
  =/  db  queued
  =.  db  db(pending `pending)
  =/  accepted  (accept:capture db pending '[]')
  ?>  ?=(%& -.accepted)
  =/  retried  (finish:capture db & 'failed' [3 1])
  =/  next  (ready:capture retried)
  ?>  ?=(^ ready.next)
  =/  plan
    (plan:capture db.next id.u.ready.next job.u.ready.next builtin-config:policy ~2026.10.7)
  =/  finished  (finish:capture db.next(pending `plan) & 'failed again' [3 1])
  ;:  weld
      (expect-eq !>(1) !>(head.retried))
      (expect-eq !>(2) !>(next.retried))
      (expect-eq !>(~) !>(pending.finished))
      (expect-eq !>(next.finished) !>(head.finished))
      (expect-eq !>([6 2]) !>(usage.finished))
  ==
++  test-disabled-turns-advance-the-cursor-without-retaining-capture-jobs
  =/  db  (prepare:memory *state:m 'first' log:session)
  =.  db  db(disabled (silt ~['first']))
  =/  off  (enqueue:capture db 'first' session (play:hl log:session) ~2026.10.7)
  ;:  weld
      (expect-eq !>(log:session) !>((~(got by cursors.off) 'first')))
      (expect-eq !>(~) !>(jobs.off))
      (expect-eq !>(0) !>(next.off))
  ==
++  test-compaction-uses-only-selected-original-events
  =/  db  queued
  =/  captured
    (compact:capture db 'first' 9 session ~[2] builtin-config:policy ~2026.10.7)
  ?>  ?=(^ captured)
  =/  evidence  evidence.job.u.captured
  ?>  ?=(^ evidence)
  =/  accepted  (accept:capture db u.captured answer)
  ;:  weld
      (expect-eq !>(1) !>((lent evidence)))
      (expect-eq !>('user') !>(role.i.evidence))
      (expect-eq !>(2) !>(event.source.i.evidence))
      (expect !>(?=(%& -.accepted)))
      %+  expect-eq  !>(~)
      !>((compact:capture db 'first' 9 session ~[1 3 4] builtin-config:policy ~2026.10.7))
  ==
++  test-compaction-does-not-revisit-evidence-before-a-memory-control-boundary
  =/  log=(list event:h)
    :~  (input 0v3 'Public new evidence.')
        [%command-completed 0v2 'memory' 'Shared memory is on. It applies to the next turn.']
        (input 0v2 '/memory   on')
        (input 0v1 'PRIVATE EVIDENCE')
        :*  %command-completed  0v0  'memory'
            'Shared memory is off for this conversation and its subagents.'
        ==
        [%config-replaced builtin-config:policy]
    ==
  =/  captured
    (compact:capture *state:m 'first' 9 [log 10] ~[1 2 3 4 5 6] builtin-config:policy ~2026.10.7)
  ?>  ?=(^ captured)
  =/  evidence  evidence.job.u.captured
  ?>  ?=(^ evidence)
  ;:  weld
      (expect-eq !>(1) !>((lent evidence)))
      (expect-eq !>('Public new evidence.') !>(text.i.evidence))
      (expect !>((boundary:capture [%memory-set 'name' ~])))
  ==
++  test-compaction-output-keeps-checkpoint-and-memory-validation-separate
  =/  empty  (compact-output:capture '{"summary":"A concise checkpoint.","memories":[]}')
  =/  bad  (compact-output:capture '{"summary":"A concise checkpoint.","memories":"wrong"}')
  =/  object  '{"summary":"A concise checkpoint.","memories":[]}'
  =/  fenced  (rap 3 '```json\0a' object '\0a```' ~)
  =/  prose  (rap 3 'Here is the checkpoint: ' object ' Done.' ~)
  =/  fenced-text  '```\0aFenced text.\0a```'
  ;:  weld
      (expect-eq !>('A concise checkpoint.') !>(summary.empty))
      (expect-eq !>('A concise checkpoint.') !>(summary.bad))
      (expect-eq !>(`'[]') !>(memories.empty))
      (expect-eq !>(['Plain summary.' ~]) !>((compact-output:capture ' Plain summary.\0a')))
      (expect-eq !>(`'[]') !>(memories:(compact-output:capture fenced)))
      (expect-eq !>('A concise checkpoint.') !>(summary:(compact-output:capture fenced)))
      (expect-eq !>('A concise checkpoint.') !>(summary:(compact-output:capture prose)))
      (expect-eq !>(`'[]') !>(memories:(compact-output:capture prose)))
      (expect-eq !>(['Fenced text.' ~]) !>((compact-output:capture fenced-text)))
      (expect-eq !>(['Mentions {braces} only.' ~]) !>((compact-output:capture 'Mentions {braces} only.')))
      (expect-eq !>(['' ~]) !>((compact-output:capture '{"summary":"cut off')))
      (expect-eq !>(['' ~]) !>((compact-output:capture '{"memories":[]}')))
      (expect-eq !>(['' ~]) !>((compact-output:capture ' \0a')))
  ==
--

/-  h=harness
/+  *test, report=harness-run-report, failure=harness-failure
|%
++  fixture
  ^-  session:h
  =/  config  *config:h
  =.  config
    %=  config  system  'System evidence'  key  'private-key'  headers
        ~[['Authorization' 'private-header']]  model  'test-model'
    ==
  :-  %-  flop
      ^-  (list event:h)
      :~  [%config-replaced config]
          [%input-received [0v1 [%acp 'owner'] ~ ~ ~2026.10.2 [%user 'First question']]]
          [%context-received 0v1 'Thread evidence']
          [%llm-requested 1 %turn]
          [%llm-reasoning 1 'endpoint' 'test-model' 'private-reasoning']
          :*  %llm-completed  1  %tool-calls  [10 5]
              [%assistant '' ~[['call' 'read_file' '{"path":"notes"}']]]
          ==
          [%tool-requested-2 2 'call' 'read_file']
          [%tool-completed 'call' 'read_file' 'Tool evidence']
          [%llm-requested 2 %turn]
          [%llm-completed 2 %stop [20 8] [%assistant 'First answer' ~]]
          [%input-received [0v2 [%acp 'owner'] ~ ~ ~2026.10.3 [%user 'Second question']]]
          [%llm-requested 3 %turn]
      ==
  4
::
++  field
  |=  [value=json key=@t]
  ^-  json
  ?>  ?=(%o -.value)
  (~(got by p.value) key)
::
++  test-input-boundary-keeps-completed-run-stable
  =/  found  (need (read:report fixture 0v1))
  ;:  weld
      (expect-eq !>(`json`[%s 'completed']) !>((field found 'status')))
      (expect-eq !>(`json`[%s 'First answer']) !>((field found 'reply')))
      (expect-eq !>(`json`[%s 'dispatching']) !>((field (need (read:report fixture 0v2)) 'status')))
      (expect-eq !>(`(unit json)`~) !>((read:report fixture 0v99)))
  ==
::
++  test-context-uses-first-dispatch-and-excludes-transport-secrets
  =/  found  (need (read:report fixture 0v1))
  =/  context  (field found 'context')
  =/  sources  (field context 'sources')
  ?>  ?=(%a -.sources)
  =/  previews  (turn p.sources |=(value=json (field value 'preview')))
  =/  contains
    |=  text=@t
    (lien previews |=(value=json =(value [%s text])))
  ;:  weld
      (expect !>((contains 'System evidence')))
      (expect !>((contains 'Thread evidence')))
      (expect !>(!(contains 'Tool evidence')))
      (expect !>(!(contains 'private-reasoning')))
      (expect !>(!(contains 'private-key')))
      (expect !>(!(contains 'private-header')))
  ==
::
++  test-tool-detail-and-unknown-timing
  =/  found  (need (read:report fixture 0v1))
  =/  tools  (field found 'tools')
  =/  runs  (field tools 'runs')
  ?>  ?=([%a ^] runs)
  ;:  weld
      (expect-eq !>(`json`[%n '1']) !>((field tools 'callCount')))
      (expect-eq !>(`json`[%s 'Tool evidence']) !>((field i.p.runs 'resultSummary')))
      (expect-eq !>(`json`~) !>((field i.p.runs 'durationMs')))
      (expect-eq !>(`json`~) !>((field (field found 'lifecycle') 'completedAt')))
  ==
::
++  test-provider-error-does-not-export-echoed-secrets
  =/  session  fixture
  =/  raw  'http error 401: private-key private-header private-provider-body'
  =.  log.session  [[%llm-failed 3 raw] log.session]
  =/  found  (need (read:report session 0v2))
  (expect-eq !>(`json`[%s (public-message:failure raw)]) !>((field found 'error')))
::
++  test-recent-page-uses-immutable-cursor
  =/  page  (recent:report fixture ~)
  =/  runs  (field page 'runs')
  ?>  ?=([%a ^] runs)
  =/  older  (recent:report fixture `11)
  =/  older-runs  (field older 'runs')
  ?>  ?=([%a ^] older-runs)
  ;:  weld
      (expect-eq !>(`json`[%s '0v2']) !>((field i.p.runs 'lensId')))
      (expect-eq !>(`json`[%s '0v1']) !>((field i.p.older-runs 'lensId')))
  ==
::
++  test-reused-tool-id-keeps-results-in-their-exchange
  =/  session  fixture
  =.  log.session
    %-  flop
    ^-  (list event:h)
    :~  [%input-received [0v1 [%acp 'owner'] ~ ~ ~2026.10.2 [%user 'Question']]]
        [%llm-requested 1 %turn]
        [%llm-completed 1 %tool-calls [0 0] [%assistant '' ~[['call' 'read' '{}']]]]
        [%tool-completed 'call' 'read' 'First result']
        [%llm-requested 2 %turn]
        [%llm-completed 2 %tool-calls [0 0] [%assistant '' ~[['call' 'read' '{}']]]]
        [%tool-completed 'call' 'read' 'error: Second result']
    ==
  =/  tools  (field (need (read:report session 0v1)) 'tools')
  =/  runs  (field tools 'runs')
  ?>  ?=([%a [* * ~]] runs)
  ;:  weld
      (expect-eq !>(`json`[%s 'First result']) !>((field i.p.runs 'resultSummary')))
      (expect-eq !>(`json`[%s 'error']) !>((field i.t.p.runs 'status')))
      (expect-eq !>(`json`[%n '2']) !>((field i.t.p.runs 'callIndex')))
      (expect !>(!=((field i.p.runs 'id') (field i.t.p.runs 'id'))))
  ==
::
++  test-missing-tool-receipt-cannot-borrow-reused-id-result
  =/  session  fixture
  =.  log.session
    %-  flop
    ^-  (list event:h)
    :~  [%input-received [0v1 [%acp 'owner'] ~ ~ ~2026.10.2 [%user 'Question']]]
        [%llm-requested 1 %turn]
        [%llm-completed 1 %tool-calls [0 0] [%assistant '' ~[['call' 'read' '{}']]]]
        [%llm-requested 2 %turn]
        [%llm-completed 2 %tool-calls [0 0] [%assistant '' ~[['call' 'read' '{}']]]]
        [%tool-completed 'call' 'read' 'Second result']
    ==
  =/  tools  (field (need (read:report session 0v1)) 'tools')
  =/  runs  (field tools 'runs')
  ?>  ?=([%a [* * ~]] runs)
  ;:  weld
      (expect-eq !>(`json`~) !>((field i.p.runs 'resultSummary')))
      (expect-eq !>(`json`[%s 'Second result']) !>((field i.t.p.runs 'resultSummary')))
  ==
::
++  test-tool-projection-is-bounded-with-complete-count
  =/  session  fixture
  =/  calls=(list tool-call:h)
    %+  turn  (gulf 1 13)
    |=(index=@ud [(scot %ud index) 'read' '{}'])
  =.  log.session
    %-  flop
    ^-  (list event:h)
    :~  [%input-received [0v1 [%acp 'owner'] ~ ~ ~2026.10.2 [%user 'Question']]]
        [%llm-requested 1 %turn]
        [%llm-completed 1 %tool-calls [0 0] [%assistant '' calls]]
    ==
  =/  found  (need (read:report session 0v1))
  =/  tools  (field found 'tools')
  =/  runs  (field tools 'runs')
  =/  called  (field tools 'called')
  ?>  ?=(%a -.runs)
  ?>  ?=(%a -.called)
  ;:  weld
      (expect-eq !>(`json`[%n '13']) !>((field tools 'callCount')))
      (expect-eq !>(`json`[%b &]) !>((field found 'truncated')))
      (expect-eq !>(12) !>((lent p.runs)))
      (expect-eq !>(12) !>((lent p.called)))
  ==
--

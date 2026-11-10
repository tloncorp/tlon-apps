/-  h=harness
/+  *test, hl=harness, hs=harness-session, hp=harness-provider, hj=harness-json
|%
++  test-outcome-waits-for-effects
  =/  v=view:h  *view:h
  =/  pending  (outcome:hl v(pending `[0 %turn]))
  =/  tools  (outcome:hl v(wait (silt ~['call'])))
  (expect !>(&(=(~ pending) =(~ tools))))
++  test-outcome-requires-a-final-answer
  =/  v=view:h  *view:h
  =/  expected=(unit outcome:h)  `[%failure 'Session ended without a response']
  (expect-eq !>(expected) !>((outcome:hl v)))
++  test-outcome-preserves-empty-reply
  =/  v=view:h  *view:h
  =/  expected=(unit outcome:h)  `[%reply '']
  (expect-eq !>(expected) !>((outcome:hl v(items ~[[%assistant '' ~]]))))
++  test-outcome-does-not-call-tool-requests-replies
  =/  v=view:h  *view:h
  =/  result  (outcome:hl v(items ~[[%assistant 'working' ~[['call' 'http_fetch' '{}']]]]))
  (expect !>(?=([~ %failure *] result)))
++  test-outcome-cancellation-survives-config-edit
  =/  v  (play:hl [[%config-replaced *config:h] interrupted-tools])
  =/  expected=(unit outcome:h)  `[%cancelled 'cancelled by client']
  (expect-eq !>(expected) !>((outcome:hl v)))
++  test-outcome-error-is-terminal
  =/  v=view:h  *view:h
  =/  expected=(unit outcome:h)  `[%failure 'provider failed']
  (expect-eq !>(expected) !>((outcome:hl v(err `'provider failed'))))
++  history
  ^-  (list event:h)
  %-  flop
  ^-  (list event:h)
  :~  [%config-replaced *config:h]
      [%input-admitted [%user 'one']]
      [%llm-completed 0 %stop [10 2] [%assistant 'first' ~]]
      [%input-admitted [%user 'two']]
      [%llm-completed 1 %stop [20 3] [%assistant 'second' ~]]
      [%input-admitted [%user 'three']]
      [%llm-completed 2 %stop [30 4] [%assistant 'third' ~]]
      [%input-admitted [%user 'four']]
      [%compaction-completed 3 'summary']
  ==
++  test-transcript-survives-compaction
  =/  context  items:(play:hl history)
  =/  transcript  (transcript-items:hl history)
  (expect !>(&(=(7 (lent transcript)) (lth (lent context) (lent transcript)))))
++  test-replay-order-and-usage
  =/  view  (play:hl history)
  =/  before  (play:hl (slag 1 history))
  =/  expected=(list item:h)
    :~  [%assistant 'first' ~]  [%user 'two']  [%assistant 'second' ~]  [%user 'three']
        [%assistant 'third' ~]  [%user 'four']
    ==
  %-  expect
  !>  ?&  =(expected items.view)  =(items.before (transcript-items:hl (slag 1 history)))
          =([60 9] total.view)  =(`'summary' summary.view)
      ==
++  check-advance
  |=  log=(list event:h)
  ^-  tang
  =/  expected  (play:hl log)
  =/  remaining  (flop log)
  =|  recorded=(list event:h)
  =|  checks=tang
  |-  ^-  tang
      =.  checks
        %+  weld  checks
        (expect-eq !>(expected) !>((advance:hl remaining (play:hl recorded))))
      ?~  remaining  checks
      $(remaining t.remaining, recorded [i.remaining recorded])
++  test-incremental-view-matches-replay-at-every-boundary
  ;:  weld
      (check-advance history)
      (check-advance interrupted-tools)
      %-  check-advance
      [[%input-admitted [%user 'continue']] [%config-replaced *config:h] interrupted-tools]
      %-  check-advance
      :~  [%llm-failed 0 'failed']  [%llm-reasoning 0 'provider' 'model' 'opaque']
          [%llm-requested 0 %turn]
      ==
  ==
++  test-stable-event-addresses
  %+  expect-eq
    !>(`(list @ud)`~[2 3 4 5 6 7 8])
  !>((turn (transcript:hl history) |=([at=@ud (unit input-id:h) item:h] at)))
++  test-branch-keeps-prefix
  =/  result  (branch:hs 'parent' [history 4] 3)
  ?>  ?=(%& -.result)
  =/  view  (play:hl log.p.result)
  %-  expect
  !>  ?&  =(`[from='parent' at=3] origin.view)  =(2 (lent items.view))  =(~ pending.view)
          =(~ (next:hs view ~ ~))
      ==
++  test-branch-rejects-invalid-point
  =/  out-of-range  (branch:hs 'parent' [history 4] 100)
  =/  user-message  (branch:hs 'parent' [history 4] 4)
  (expect !>(&(?=(%| -.out-of-range) ?=(%| -.user-message))))
++  test-branch-rejects-open-tool-exchange
  =/  log=(list event:h)
    ~[[%llm-completed 0 %tool-calls [1 1] [%assistant '' ~[['call' 'list_desk_files' '{}']]]]]
  =/  result  (branch:hs 'parent' [log 1] 1)
  (expect !>(?=(%| -.result)))
++  test-stream-rejects-unfinished-text
  =/  wire=@t  'data: {"choices":[{"delta":{"content":"partial"},"finish_reason":null}]}\0a\0a'
  =/  result  (parse-chat-sse:hp wire)
  (expect !>(?=(%| -.result)))
++  test-stream-joins-fragmented-tools
  =/  wire=@t
    %+  rap  3
    :~
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call","function":{"name":"list_desk_files","arguments":"{"}}]},"finish_reason":null}]}\0a\0a'
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"}"}}]},"finish_reason":"tool_calls"}]}\0a\0a'
    ==
  =/  result  (parse-chat-sse:hp wire)
  ?>  ?=(%& -.result)
  (expect-eq !>(`item:h`[%assistant '' ~[['call' 'list_desk_files' '{}']]]) !>(it.p.result))
++  test-response-format-selection-preserves-stream-errors
  =/  partial  'data: {"choices":[{"delta":{"content":"partial"},"finish_reason":null}]}\0a\0a'
  =/  rejected
    %^  cat
      3
      partial
    'data: {"error":{"code":"rate_limit","message":"Rate limit reached"}}\0a\0a'
  =/  err  (parse-chat-body:hp rejected)
  ?>  ?=(%| -.err)
  =/  plain  (parse-chat-body:hp '{"error":{"code":"rate_limit","message":"Rate limit reached"}}')
  ?>  ?=(%| -.plain)
  ;:  weld
      (expect-eq !>((parse-chat-sse:hp partial)) !>((parse-chat-body:hp partial)))
      (expect-eq !>(p.plain) !>(p.err))
  ==
++  test-response-format-selection-accepts-completed-json-and-streams
  =/  json
    '{"choices":[{"message":{"content":"checked"},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":2}}'
  =/  stream
    'data: {"choices":[{"delta":{"content":"checked"},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":2}}\0a\0a'
  (expect-eq !>((parse-chat-body:hp json)) !>((parse-chat-body:hp stream)))
++  test-incomplete-tool-response-reports-output-exhaustion
  =/  stream
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call","function":{"name":"workspace","arguments":"{"}}]},"finish_reason":"length"}]}\0a\0a'
  =/  result  (parse-chat-body:hp stream)
  ?>  ?=(%| -.result)
  (expect-eq !>('provider response reached its output limit during a tool call') !>(p.result))
++  interrupted-tools
  ^-  (list event:h)
  %-  flop
  ^-  (list event:h)
  :~  [%config-replaced *config:h]
      [%input-admitted [%user 'start']]
      :*  %llm-completed  0  %tool-calls  [1 1]
          :*  %assistant  ''
              :~  ['done' 'http_fetch' '{}']  ['pending' 'http_fetch' '{}']
                  ['undispatched' 'http_fetch' '{}']
              ==
          ==
      ==
      [%tool-requested 'done' 'http_fetch']
      [%tool-requested 'pending' 'http_fetch']
      [%tool-completed 'done' 'http_fetch' 'HTTP 200']
      [%cancelled ~ (silt ~['pending']) 'cancelled by client']
  ==
++  test-cancel-closes-all-unfinished-calls
  =/  v  (play:hl interrupted-tools)
  =/  results  (skim items.v |=(it=item:h ?=(%tool -.it)))
  %-  expect
  !>  ?&  =(3 (lent results))  =(~ wait.v)  =(~ pending.v)  =(~ (open-calls:hl items.v))
          =(~ (next:hs v ~ interrupted-tools))  =(items.v (transcript-items:hl interrupted-tools))
      ==
++  test-cancel-preserves-completed-results
  =/  v  (play:hl interrupted-tools)
  =/  results  (skim items.v |=(it=item:h ?=(%tool -.it)))
  ?>  ?=(^ results)
  (expect-eq !>(`item:h`[%tool 'done' 'http_fetch' 'HTTP 200']) !>(i.results))
++  test-new-input-after-cancel-does-not-repeat-tools
  =/  cfg=config:h  *config:h
  =.  max-context.cfg  100.000
  =/  log  [[%input-admitted [%user 'new request']] [%config-replaced cfg] interrupted-tools]
  =/  v  (play:hl log)
  (expect-eq !>(`(unit step:h)`[~ %turn ~]) !>((next:hs v ~ log)))
++  test-config-does-not-retry-provider-failure
  =/  log=(list event:h)
    :~  [%config-replaced *config:h]  [%llm-failed 0 'http error 401']
        [%input-admitted [%user 'hello']]
    ==
  =/  v  (play:hl log)
  (expect !>(&(=(`'http error 401' err.v) =(~ (next:hs v ~ log)))))
++  test-recorded-continuation-clears-prior-failure
  =/  log=(list event:h)
    ~[[%llm-requested 1 %turn] [%config-replaced *config:h] [%llm-failed 0 'http error 401']]
  (expect-eq !>(`(unit @t)`~) !>(err:(play:hl log)))
++  test-config-does-not-resume-cancelled-work
  =/  v  (play:hl [[%config-replaced *config:h] interrupted-tools])
  (expect-eq !>(`(unit step:h)`~) !>((next:hs v ~ ~)))
++  test-repeated-cancel-does-not-duplicate-receipts
  =/  log  [[%cancelled ~ ~ 'again'] interrupted-tools]
  (expect-eq !>((transcript-items:hl interrupted-tools)) !>((transcript-items:hl log)))
++  test-cancellation-projection-stays-with-its-exchange
  =/  log=(list event:h)
    :~  [%cancelled ~ ~ 'second interruption']
        [%tool-completed 'done' 'http_fetch' 'new result']
        :*  %llm-completed  1  %tool-calls  [0 0]
            [%assistant '' ~[['done' 'http_fetch' '{}'] ['pending' 'http_fetch' '{}']]]
        ==
        [%input-received [0v7 [%acp 'client'] `~zod ~ ~2026.10.2 [%user 'next']]]
        [%cancelled ~ ~ 'repeated interruption']
        [%config-replaced *config:h]
    ==
  =.  log  (weld log interrupted-tools)
  =/  closed
    %+  cancel-results:hl
      ~[[%assistant '' ~[['pending' 'http_fetch' '{}']]]]
    'second interruption'
  ?>  ?=(^ closed)
  =/  expected
    (turn closed |=(it=item:h [13 ~ it]))
  =/  added=(list [@ud (unit input-id:h) item:h])
    :~  [10 `0v7 [%user 'next']]
        [11 ~ [%assistant '' ~[['done' 'http_fetch' '{}'] ['pending' 'http_fetch' '{}']]]]
        [12 ~ [%tool 'done' 'http_fetch' 'new result']]
        [13 ~ i.closed]
    ==
  ;:  weld
      (expect-eq !>(expected) !>((transcript-event:hl 13 log)))
      %+  expect-eq
        !>(`(list [@ud (unit input-id:h) item:h])`~)
      !>((transcript-event:hl 9 (slag 4 log)))
      (expect-eq !>((weld (transcript:hl interrupted-tools) added)) !>((transcript:hl log)))
  ==
++  test-cancelled-tool-addresses-are-unique
  =/  rows  (transcript-json:hj interrupted-tools)
  ?>  ?=(%a -.rows)
  =/  ids
    %+  turn  p.rows
    |=  row=json
    ?>  ?=(%o -.row)
    (~(got by p.row) 'id')
  (expect-eq !>((lent ids)) !>((lent ~(tap in (silt ids)))))
++  test-idle-head-does-not-evaluate-provider-budget
  =/  v  (play:hl interrupted-tools)
  (expect-eq !>(`(unit step:h)`~) !>((decide:hl v |=(~ !!))))
++  test-head-accepts-an-independent-budget-policy
  =/  v  (play:hl (slag 1 history))
  =.  max-context.config.v  100
  =/  small  (decide:hl v |=(~ 0))
  =/  large  (decide:hl v |=(~ 1.000))
  (expect !>(&(?=([~ %turn ~] small) ?=([~ %compact ~] large))))
--

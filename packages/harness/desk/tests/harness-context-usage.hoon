/-  h=harness
/+  *test, hl=harness, hp=harness-provider, hs=harness-session,
    ctx=harness-context, cmd=harness-command, failure=harness-failure
|%
++  config
  ^-  config:h
  =/  cfg  *config:h
  cfg(url 'https://example.test/v1/chat/completions', model 'fixture', max-context 872.000)
++  history
  ^-  (list event:h)
  :~  [%tool-completed 'call' 'http_fetch' 'new evidence']
      [%llm-completed 2 %tool-calls [900.146 367] [%assistant '' ~[['call' 'http_fetch' '{}']]]]
      [%llm-routed 2 config]
      [%llm-requested 2 %turn]
      [%input-admitted [%user 'Read the evidence']]
      [%config-replaced config]
  ==
++  test-reported-usage-triggers-compaction-despite-small-byte-estimate
  =/  v  (play:hl history)
  =/  inspected  (inspect:hs [history 3] ~)
  %-  expect
  !>  ?&  (lth (estimate:hp v %turn ~) (input-budget:ctx max-context.config.v))
          (gte (est-tokens:hp v ~ history) 900.146)
          ?=([~ %compact ~] (next:hs v ~ history))
          ?=([~ %compact ~] next.inspected)
      ==
++  test-measurement-matches-the-request-boundary
  (expect-eq !>(`[at=3 usage=`usage:h`[900.146 367]]) !>((reported-usage:hp history config)))
++  test-growth-reserves-new-items-and-current-request-overhead
  =/  v  (play:hl history)
  =/  overhead  (encoded-bytes:hp v(items ~, summary ~) %turn ~)
  =/  encoded  (encoded-bytes:hp v(items (slag 1 items.v), summary ~) %turn ~)
  %+  expect-eq
    !>((add 900.146 (max 367 (sub encoded overhead))))
  !>((est-tokens:hp v ~ history))
++  test-parallel-tool-growth-can-cross-budget-before-next-response
  =/  body  (rap 3 (reap 10.000 'x'))
  =/  log
    :~  [%tool-completed 'second' 'http_fetch' body]
        [%tool-completed 'first' 'http_fetch' body]
        :*  %llm-completed  2  %tool-calls  [770.000 367]
            [%assistant '' ~[['first' 'http_fetch' '{}'] ['second' 'http_fetch' '{}']]]
        ==
        [%llm-routed 2 config]
        [%llm-requested 2 %turn]
        [%input-admitted [%user 'Read the evidence']]
        [%config-replaced config]
    ==
  =/  v  (play:hl log)
  %-  expect
  !>  ?&  (lth 770.000 (input-budget:ctx max-context.config.v))
          (lth (estimate:hp v %turn ~) (input-budget:ctx max-context.config.v))
          (gte (est-tokens:hp v ~ log) 790.000)
          ?=([~ %compact ~] (next:hs v ~ log))
      ==
++  test-latest-usage-is-not-cumulative-usage
  =/  log=(list event:h)
    :*  [%input-admitted [%user 'Continue']]
        [%llm-completed 3 %stop [100 10] [%assistant 'Done' ~]]
        [%llm-routed 3 config]
        [%llm-requested 3 %turn]
        history
    ==
  =/  v  (play:hl log)
  %-  expect
  !>  ?&  =(900.246 prompt.total.v)  (lth (est-tokens:hp v ~ log) 10.000)
          ?=([~ %turn ~] (next:hs v ~ log))
      ==
++  test-model-and-endpoint-changes-do-not-borrow-usage
  =/  v  (play:hl history)
  =/  model  v(model.config 'different')
  =/  endpoint  v(url.config 'https://other.test/v1/chat/completions')
  %-  expect
  !>  ?&  =(~ (reported-usage:hp history config.model))
          =(~ (reported-usage:hp history config.endpoint))
          =((estimate:hp model %turn ~) (est-tokens:hp model ~ history))
          =((estimate:hp endpoint %turn ~) (est-tokens:hp endpoint ~ history))
      ==
++  test-checkpoint-usage-does-not-measure-retained-context
  =/  log=(list event:h)
    [[%checkpoint-completed 3 'checkpoint' [800.000 200] ~] history]
  =/  simple=(list event:h)  [[%compaction-completed 3 'checkpoint'] history]
  %-  expect
  !>  ?&  =(~ (reported-usage:hp log config))
          =(~ (reported-usage:hp simple config))
      ==
++  test-missing-usage-uses-encoding-estimate
  =/  log=(list event:h)
    :~  [%input-admitted [%user 'Continue']]
        [%llm-completed 2 %stop [0 0] [%assistant 'Done' ~]]
        [%llm-routed 2 config]
        [%llm-requested 2 %turn]
        [%input-admitted [%user 'Read the evidence']]
        [%config-replaced config]
    ==
  =/  v  (play:hl log)
  (expect-eq !>((estimate:hp v %turn ~)) !>((est-tokens:hp v ~ log)))
++  test-newer-failed-request-does-not-replace-measured-route
  =/  cfg  config
  =/  log=(list event:h)
    :*  [%llm-failed 3 'provider error']
        [%llm-routed 3 cfg(model 'other')]
        [%llm-requested 3 %turn]
        history
    ==
  (expect-eq !>((reported-usage:hp history config)) !>((reported-usage:hp log config)))
++  test-inflight-input-is-unmeasured-growth
  =/  body  (rap 3 (reap 10.000 'x'))
  =/  =event:h  [%input-admitted [%user body]]
  =/  log  (weld (scag 2 history) [event (slag 2 history)])
  (expect !>((gte (est-tokens:hp (play:hl log) ~ log) (add 900.146 10.000))))
++  test-instructions-and-memory-are-not-counted-twice
  =/  v  (play:hl history)
  =/  body  (rap 3 (reap 8.000 'x'))
  =/  changed  v(memory (~(put by memory.v) 'reference' body), system.config body)
  (expect-eq !>((est-tokens:hp v ~ history)) !>((est-tokens:hp changed ~ history)))
++  test-context-report-labels-reported-usage
  =/  report  (context-report:cmd (play:hl history) ~ history)
  (expect !>((contains:failure report 'reported usage plus unmeasured context reserve')))
--

/-  h=harness, l=logs
/+  *test, observe=harness-observe, failure=harness-failure
|%
++  test-routine-events-are-silent
  =/  events=(list event:h)
    :~  [%llm-requested 1 %turn]
        [%llm-completed 1 %tool-calls [100 20] [%assistant 'private' ~[['c' 'calculate' '{}']]]]
        [%llm-reasoning 1 'private-url' 'model' 'private reasoning']
        [%tool-requested-2 1 'c' 'calculate']
        [%tool-completed 'c' 'calculate' 'private output']
        [%input-admitted [%user 'private prompt']]
        [%checkpoint-completed 1 'private summary' [100 20] ~]
    ==
  (expect !>((levy events |=(e=event:h =(~ (summary:observe e))))))
++  test-completion-has-only-numeric-request-usage
  =/  out  (need (summary:observe [%llm-completed 1 %stop [100 20] [%assistant 'PRIVATE_REPLY' ~]]))
  ;:  weld
      (expect-eq !>(%info) !>(level.out))
      (expect-eq !>('harness.turn.completed') !>(name.out))
      %+  expect-eq
        !>  ^-  log-data:l
            :~  ['request' %n '1']
                ['prompt_tokens' %n '100']
                ['completion_tokens' %n '20']
            ==
      !>(data.out)
  ==
++  test-failure-export-is-allowlisted
  =/  out  (need (summary:observe [%llm-failed 1 'http error 401: PRIVATE_KEY PRIVATE_PROMPT']))
  ;:  weld
      (expect-eq !>(%error) !>(level.out))
      (expect-eq !>(`log-data:l`~[['request' %n '1'] ['kind' %s 'authentication']]) !>(data.out))
      (expect !>(?=(^ (summary:observe [%compaction-failed 1 'private' [0 0]]))))
      (expect !>(?=(^ (summary:observe [%halted 'private']))))
      (expect !>(?=(^ (summary:observe [%cancelled ~ ~ 'private']))))
  ==
++  test-card-uses-shared-sink-without-private-session-name
  =/  =bowl:gall  *bowl:gall
  =.  bowl  bowl(our ~zod)
  =/  cards  (event:observe bowl 'PRIVATE_SESSION' [%llm-failed 1 'PRIVATE_KEY'])
  =/  card  (snag 0 cards)
  ?>  ?=([%pass [%telemetry ~] %agent [@ %logs] %poke %log-action-1 *] card)
  =/  action  !<(a-log:l +127.card)
  ?>  ?=(%log -.action)
  =/  data  (en:json:html (pairs:enjs:format data.action))
  ;:  weld
      (expect-eq !>(1) !>((lent cards)))
      (expect !>(!(contains:failure data 'private')))
  ==
++  test-crashes-export-no-stack-or-payload
  =/  card  (crash:observe *bowl:gall %poke ~[leaf+"PRIVATE_CREDENTIAL"])
  ?>  ?=([%pass [%telemetry ~] %agent * %poke %log-action-1 *] card)
  =/  action  !<(a-log:l +127.card)
  ?>  ?=(%log -.action)
  ;:  weld
      (expect-eq !>(`log-event:l`[%tell %error ~[leaf+"harness.agent.failed"]]) !>(event.action))
      %-  expect
      !>(!(contains:failure (en:json:html (pairs:enjs:format data.action)) 'PRIVATE_CREDENTIAL'))
  ==
--

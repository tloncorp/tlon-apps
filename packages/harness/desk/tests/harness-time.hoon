/-  h=harness
/+  *test, ht=harness-tools, effects=harness-effects, hp=harness-provider
|%
++  test-clock-is-advertised-on-both-provider-transports
  =/  =view:h  *view:h
  =.  tools.config.view  ~
  =/  ordinary  (en:json:html (payload:hp view %turn ~))
  =.  url.config.view  'https://chatgpt.com/backend-api/codex/responses'
  =/  responses  (en:json:html (payload:hp view %turn ~))
  (expect !>(&((find-sub:ht 'current_time' ordinary) (find-sub:ht 'current_time' responses))))
++  test-compaction-is-still-a-tool-free-summary
  =/  =view:h  *view:h
  (expect !>(!(find-sub:ht 'current_time' (en:json:html (payload:hp view %compaction ~)))))
++  test-clock-is-always-discoverable-without-a-grant
  =/  defs  (tool-defs:ht ~)
  ?>  ?=(%a -.defs)
  %-  expect
  !>(&((find-sub:ht 'current_time' (en:json:html defs)) =(~ (tool-family:ht 'current_time'))))
++  test-clock-is-authorized-without-grants-and-in-rehearsals
  %-  expect
  !>  ?&  (call-granted:ht ['clock' 'current_time' '{}'] ~)
          (tool-granted:ht 'current_time' (rehearsal-tools:ht ~))  !(tool-granted:ht 'http_fetch' ~)
      ==
++  test-clock-execution-uses-the-event-clock-not-model-arguments
  =/  =bowl:gall  *bowl:gall
  =.  now.bowl  ~2026.9.6..02.30.09
  =/  executor  ~(. effects [bowl ~])
  =/  event
    %^  run-tool:executor
      ['clock' 'current_time' '{"timezone":"made-up","now":"1900-01-01"}']
      ~
    ~
  ?>  ?=(%tool-completed -.event)
  =/  result  (need (de:json:html body.event))
  ?>  ?=(%o -.result)
  %-  expect
  !>  ?&  =(`[%s '2026-09-06T02:30:09Z'] (~(get by p.result) 'utc'))
          =(`[%s 'Sunday'] (~(get by p.result) 'weekday'))
          =(`[%s 'UTC'] (~(get by p.result) 'timezone'))
      ==
++  test-clock-unix-epoch
  =/  =bowl:gall  *bowl:gall
  =/  executor  ~(. effects [bowl ~])
  =/  result  (need (de:json:html (current-time:executor ~1970.1.1)))
  ?>  ?=(%o -.result)
  (expect-eq !>(`[%n '0']) !>((~(get by p.result) 'unixSeconds')))
--

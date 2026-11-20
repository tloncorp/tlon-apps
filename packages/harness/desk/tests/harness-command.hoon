/-  h=harness
/+  *test, cmd=harness-command, hl=harness, hs=harness-session, hj=harness-json,
    policy=harness-defaults
|%
++  test-command-whitespace-and-model-path
  =/  want=(unit command:cmd)  `['model' 'vendor/model']
  (expect-eq !>(want) !>((parse:cmd ' \09/model vendor/model\0a')))
++  test-paths-and-prose-are-not-commands
  %-  expect
  !>  ?&  ?=(~ (parse:cmd '/tmp/file'))
          ?=(~ (parse:cmd '//status'))
          ?=(~ (parse:cmd 'please /stop'))
          ?=(~ (parse:cmd '/'))
      ==
++  test-only-exact-stop-interrupts
  (expect !>(&((stopping:cmd '/stop\0a') !(stopping:cmd '/stop now') !(stopping:cmd '/stopping'))))
++  test-unknown-command-is-local
  =/  parsed  (need (parse:cmd '/unknown'))
  =/  result  (run:cmd parsed *view:h builtin-config:policy)
  %-  expect
  !>(&(=(~ config.result) =('Unknown command. Send /help for the available commands.' body.result)))
++  test-model-change-preserves-authority
  =/  cfg=config:h  builtin-config:policy
  =.  cfg
    cfg(system 'Keep me', tools ~[%clay], key 'fixture-secret', headers ~[['x-test' 'private']])
  =/  v=view:h  *view:h
  =/  result  (run:cmd ['model' 'vendor/other'] v(config cfg) builtin-config:policy)
  =/  expected  cfg(model 'vendor/other', max-context 800.000)
  (expect-eq !>(`expected) !>(config.result))
++  test-default-model-preserves-instructions-and-tools
  =/  cfg=config:h  builtin-config:policy
  =.  cfg  cfg(system 'Keep me', tools ~[%clay])
  =/  defaults
    %=  cfg  url  'https://example.test/api'  model  'new'  headers  ~[['x-test' 'fixture']]
      max-context  123.456
    ==
  =/  v=view:h  *view:h
  =/  result  (run:cmd ['model' 'default'] v(config cfg) defaults)
  (expect-eq !>(`defaults) !>(config.result))
++  test-command-model-validation
  =/  result  (run:cmd ['model' 'two names'] *view:h builtin-config:policy)
  (expect-eq !>(`(unit config:h)`~) !>(config.result))
++  test-command-replay-has-no-inference-or-usage
  =/  log=(list event:h)
    :~  [%command-completed 0v1 'help' help:cmd]
        [%input-received [0v1 [%acp 'fixture'] ~ ~ ~2000.1.1 [%user '/help']]]
        [%config-replaced builtin-config:policy]
    ==
  ?>  ?=(^ log)
  =/  v  (play:hl log)
  =/  branch  (branch:hs 'fixture' [log 0] 3)
  =/  projected  (event-json:hj i.log)
  %-  expect
  !>  ?&  =(~ (next:hs v ~ log))  =([0 0] total.v)  =(2 (lent (transcript:hl log)))
          ?=([~ %reply *] (outcome:hl v))  ?=(%& -.branch)  ?=(%o -.projected)
      ==
--

/-  h=harness
/+  *test, cmd=harness-command, hl=harness, hs=harness-session, hj=harness-json,
    policy=harness-defaults, ht=harness-tools
|%
++  disconnected  |=(slot=@t |)
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
  =/  result  (run:cmd parsed *view:h builtin-config:policy disconnected)
  %-  expect
  !>(&(=(~ config.result) =('Unknown command. Send /help for the available commands.' body.result)))
++  test-model-change-preserves-authority
  =/  cfg=config:h  builtin-config:policy
  =.  cfg
    cfg(system 'Keep me', tools ~[%clay], key 'fixture-secret', headers ~[['x-test' 'private']])
  =/  v=view:h  *view:h
  =/  result  (run:cmd ['model' 'vendor/other'] v(config cfg) builtin-config:policy disconnected)
  =/  expected  cfg(model 'vendor/other', max-context 800.000)
  (expect-eq !>(`expected) !>(config.result))
++  test-qualified-model-switches-to-openai-subscription
  =/  cfg=config:h  builtin-config:policy
  =.  cfg  cfg(key 'router-only', headers ~[['x-provider' 'router-only']])
  =.  cfg  cfg(url 'https://openrouter.ai/api/v1/chat/completions')
  =/  v=view:h  *view:h
  =.  config.v  cfg
  =/  connected  |=(slot=@t =('openai-device' slot))
  =/  out  (run:cmd ['model' 'openai/gpt-6.1-sol'] v cfg connected)
  =/  selected  (need config.out)
  ;:  weld
      (expect-eq !>('Model set to: openai / gpt-6.1-sol') !>(body.out))
      (expect-eq !>('https://chatgpt.com/backend-api/codex/responses') !>(url.selected))
      (expect-eq !>('') !>(key.selected))
      (expect-eq !>(~) !>(headers.selected))
  ==
++  test-openrouter-qualified-model-retains-vendor-prefix
  =/  cfg=config:h  builtin-config:policy
  =.  cfg  cfg(url 'https://openrouter.ai/api/v1/chat/completions')
  =/  v=view:h  *view:h
  =/  out  (run:cmd ['model' 'openrouter/openai/gpt-6.1-sol'] v(config cfg) cfg disconnected)
  (expect-eq !>('Model set to: openrouter / openai/gpt-6.1-sol') !>(body.out))
++  test-unavailable-provider-keeps-current-model
  =/  cfg=config:h  builtin-config:policy
  =.  cfg  cfg(url 'https://openrouter.ai/api/v1/chat/completions')
  =/  v=view:h  *view:h
  =/  out  (run:cmd ['model' 'openai/gpt-6.1-sol'] v(config cfg) cfg disconnected)
  (expect-eq !>(`(unit config:h)`~) !>(config.out))
++  test-default-model-preserves-instructions-and-tools
  =/  cfg=config:h  builtin-config:policy
  =.  cfg  cfg(system 'Keep me', tools ~[%clay])
  =/  defaults
    %=  cfg  url  'https://example.test/api'  model  'new'  headers  ~[['x-test' 'fixture']]
      max-context  123.456
    ==
  =/  v=view:h  *view:h
  =/  result  (run:cmd ['model' 'default'] v(config cfg) defaults disconnected)
  (expect-eq !>(`defaults) !>(config.result))
++  test-status-reports-the-turns-tools-not-the-saved-grants
  =/  cfg=config:h  builtin-config:policy
  =/  v=view:h  *view:h
  =.  config.v  cfg(tools ~[%clay])
  =/  granted=(list tool-grant:h)  ~[%clay %web %admin]
  =/  owner  (evaluate:cmd ['status' ''] v cfg ~ ~ granted & disconnected)
  =/  other  (evaluate:cmd ['status' ''] v cfg ~ ~ ~ | disconnected)
  =/  line  'Tool grants: 3 (owner turn: saved grants do not limit it, except Run JS)\0a'
  ;:  weld
      (expect-eq !>(~) !>(events.owner))
      (expect !>((find-sub:ht line body.owner)))
      (expect !>((find-sub:ht 'Tool grants: 0\0a' body.other)))
  ==
++  test-model-change-saves-the-saved-grants-not-the-turns-tools
  =/  cfg=config:h  builtin-config:policy
  =/  v=view:h  *view:h
  =.  config.v  cfg(tools ~[%clay])
  =/  result  (evaluate:cmd ['model' 'vendor/other'] v cfg ~ ~ ~[%clay %web %admin] & disconnected)
  ?>  ?=([[%config-replaced *] ~] events.result)
  (expect-eq !>(`(list tool-grant:h)`~[%clay]) !>(tools.config.i.events.result))
++  test-command-model-validation
  =/  result  (run:cmd ['model' 'two names'] *view:h builtin-config:policy disconnected)
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

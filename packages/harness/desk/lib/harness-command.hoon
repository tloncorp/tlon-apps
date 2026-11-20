::  Human conversation commands: pure parsing, policy changes and replies.
::  Only ingress calls this module. Tool output and model-generated text are
::  never interpreted as commands. No credentials, I/O or execution authority.
/-  h=harness
/+  hp=harness-provider, failure=harness-failure, context=harness-context, memory=harness-memory,
    policy=harness-defaults
|%
+$  command  [name=@t arg=@t]
++  whitespace
  |=(c=@tD |(=(32 c) =(9 c) =(10 c) =(13 c)))
++  trim
  |=  text=tape
  ^-  tape
  =/  left
    |-  ^-  tape
        ?~  text  ~
        ?.((whitespace i.text) text $(text t.text))
  %-  flop
  =/  right  (flop left)
  |-  ^-  tape
      ?~  right  ~
      ?.  (whitespace i.right)  right
      $(right t.right)
++  parse
  |=  text=@t
  ^-  (unit command)
  =/  chars  (trim (trip text))
  ?~  chars  ~
  ?.  =('/' i.chars)  ~
  =/  tail  t.chars
  =|  reversed-name=tape
  |-  ^-  (unit command)
      ?:  |(?=(~ tail) (whitespace i.tail))
        ?~  reversed-name  ~
        `[(rap 3 (flop reversed-name)) (rap 3 (trim tail))]
      ::  Paths, URLs and // escapes are ordinary text, not unknown commands.
      ?.  |(&(=('-' i.tail) !=(~ reversed-name)) &((gte i.tail 'a') (lte i.tail 'z')))  ~
      $(tail t.tail, reversed-name [i.tail reversed-name])
++  stopping
  |=  text=@t
  =(`[name='stop' arg=''] (parse text))
++  help
  ^-  @t
  %+  rap  3
  :~  '/help — list commands\0a'
      '/status — model, tool grants and token usage\0a'
      '/model — show this conversation\'s model\0a'
      '/model <id> — change model within the current provider\0a'
      '/model default — use the default provider and model\0a'
      '/context — inspect context budgets and checkpoint usage\0a'
      '/compact — summarize older exchanges, keeping the recent turn\0a'
      '/memory [query|on|off] — inspect or control shared memory\0a'
      '/remember <name> <text> — save or replace a shared memory\0a'
      '/forget <name> — forget a memory (source history is retained)\0a'
      '/work — manage projects, tasks and artifact review in this conversation\0a'
      '/stop — cancel current and queued work\0a\0a'
      'Only /compact calls a model (to summarize history). '
      'Only /stop interrupts active work. '
      'Model changes preserve instructions and tool permissions.'
  ==
++  context-report
  |=  [view=view:h skills=(map @t skill:h) log=(list event:h)]
  ^-  @t
  %+  rap  3
  :~  'Context estimate: '
      (scot %ud (est-tokens:hp view skills log))
      ?:  ?=(^ (reported-usage:hp log config.view))
        ' tokens (reported usage plus unmeasured context reserve)'
      ' tokens (encoded bytes / 4; no matching usage report)'
      '\0aConfigured model window: '  (scot %ud max-context.config.view)  ' (catalog or fallback)'
      '\0aInput budget: '  (scot %ud (input-budget:context max-context.config.view))
      '\0aRetained-tail target: '
      (scot %ud (tail-budget:context max-context.config.view))
      ' (complete exchanges; approximate)'
      '\0aOutput reserve: '  (scot %ud (output-budget:context max-context.config.view))
      '\0aEstimation margin: '  (scot %ud (div max-context.config.view 10))
      '\0aActive items: '  (scot %ud (lent items.view))
      '\0aCheckpoint: '  ?~(summary.view 'none' 'present; source transcript retained')
      '\0aSelected memories: '  (scot %ud (lent ~(tap by memory.view)))  '/6, '
      %+  scot
        %ud
      %-  bytes:memory
      memory.view
      ' bytes'
      '\0aCompaction tokens: '  (scot %ud prompt.compact-usage.view)  ' input, '
      (scot %ud completion.compact-usage.view)  ' output'
  ==
::  Command effects are nouns, not agent actions. The head records these and
::  the acknowledgement in one admission; all hands get the same semantics.
++  evaluate
  |=  [parsed=command view=view:h defaults=config:h skills=(map @t skill:h) log=(list event:h)]
  ^-  [events=(list event:h) body=@t]
  |^
    ?:  =('context' name.parsed)
      [~ ?:(=('' arg.parsed) (context-report view skills log) 'Usage: /context')]
    ?:  =('compact' name.parsed)  [~ 'Usage: /compact']
    =/  result  (run parsed view defaults)
    [?~(config.result ~ ~[[%config-replaced u.config.result]]) body.result]
  --
++  model-label
  |=  config=config:h
  (rap 3 (provider-for-url:hp url.config) ' / ' model.config ~)
++  run
  |=  [parsed=command view=view:h defaults=config:h]
  ^-  [config=(unit config:h) body=@t]
  ?+  name.parsed  [~ 'Unknown command. Send /help for the available commands.']
    %help  [~ ?:(=('' arg.parsed) help 'Usage: /help')]
      %stop
    :*  ~
        ?:  =('' arg.parsed)
          'Stopped. External actions already started may still have taken effect.'
        'Usage: /stop'
    ==
  ::
      %status
    ?.  =('' arg.parsed)  [~ 'Usage: /status']
    :-  ~
    %+  rap  3
    :~  'Model: '  (model-label config.view)
        '\0aTool grants: '  (scot %ud (lent tools.config.view))
        '\0aRecorded tokens: '  (scot %ud prompt.total.view)  ' input, '
        (scot %ud completion.total.view)  ' output'
        ?~(err.view '' (cat 3 '\0aLast failure: ' (public-message:failure u.err.view)))
    ==
  ::
      %model
    ?:  =('' arg.parsed)  [~ (cat 3 'Model: ' (model-label config.view))]
    =/  =config:h  config.view
    ?:  =('default' arg.parsed)
      =.  config
        %=  config
          url  url.defaults
          model  model.defaults
          key  ''
          headers  headers.defaults
          max-context  max-context.defaults
        ==
      [`config (cat 3 'Using default model: ' (model-label config))]
    ?:  |((gth (met 3 arg.parsed) 256) (lien (trip arg.parsed) whitespace))
      [~ 'Usage: /model <model-id> or /model default']
    ::  Keep a known context size for the same model. A typed, uncatalogued
    ::  model gets the same conservative fallback as the settings client.
    =.  config
      %=  config
        model  arg.parsed
        max-context  ?:(=(arg.parsed model.config) max-context.config fallback-context:policy)
      ==
    [`config (cat 3 'Model set to: ' (model-label config))]
  ==
++  advertised
  ^-  json
  %-  pairs:enjs:format
  :~  ['sessionUpdate' %s 'available_commands_update']
      :-  'availableCommands'
      :-  %a
      %+  turn
        ^-  (list [name=@t description=@t hint=@t])
        :~  ['help' 'List conversation commands' '']
            ['status' 'Show model, tool grants and token usage' '']
            ['model' 'Show or change this conversation\'s model' 'model-id | default']
            ['context' 'Inspect context budgets and checkpoint usage' '']
            ['compact' 'Summarize older exchanges using the current provider' '']
            ['memory' 'Inspect or control shared memory' '[query|on|off]']
            ['remember' 'Save or replace a shared memory' 'name text']
            ['forget' 'Forget a memory without erasing source history' 'name']
            :*  'work'  'Read work or prepare a human-confirmed change'
                'action JSON | confirm id | reject id | result id'
            ==
            ['stop' 'Cancel current and queued work' '']
        ==
      |=  [name=@t description=@t hint=@t]
      %-  pairs:enjs:format
      %+  weld  ~[['name' %s name] ['description' %s description]]
      ?:  =('' hint)  ~
      ~[['input' (pairs:enjs:format ~[['hint' %s hint]])]]
  ==
--

::  Opt-in: -test /=harness=/tests-integration/harness-drive
::  Execute one batch against a saved fixture. Inspect cards through
::  test-agent and never deliver them to agents or network services.
/-  h=harness, *harness-store
/+  *test-agent, hl=harness, defaults=harness-defaults
/=  head  /app/harness
|%
++  test-tool-batch-shares-edits-and-preserves-deferred-identities
  (eval-mare tool-batch)
::
++  tool-batch
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved=state-0  *state-0
  =/  config  builtin-config:defaults
  =.  tools.config  ~[%skills %skill-write %author %web %code]
  =/  calls=(list tool-call:h)
    :~  ['write' 'write_skill' '{"name":"sample","description":"Sample","body":"First body"}']
        ['read-first' 'read_skill' '{"name":"sample"}']
        ['propose' 'propose_skill' '{"name":"sample","description":"Sample","body":"Second body"}']
        ['commit' 'commit_skill' '{"name":"sample"}']
        ['read-second' 'read_skill' '{"name":"sample"}']
        ['delete' 'delete_skill' '{"name":"sample"}']
        ['read-deleted' 'read_skill' '{"name":"sample"}']
        ['stage' 'propose_skill' '{"name":"draft","description":"Draft","body":"Unpublished"}']
        ['discard' 'discard_skill' '{"name":"draft"}']
        ['rejected' 'curl' '{"url":"https://example.com/"}']
        ['fetch' 'http_fetch' '{"url":"https://example.com/"}']
        ['script' 'run_js' '{"code":"return 1;"}']
    ==
  =/  log=(list event:h)
    :~  [%llm-completed 6 %tool-calls [0 0] [%assistant '' calls]]
        [%config-replaced config]
    ==
  =.  sessions.saved  (~(put by sessions.saved) 'batch' [log 7])
  ;<  ~  bind:m
    (jab-bowl |=(b=bowl b(our ~zod, src ~zod, dap %harness, now ~2026.10.1)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  *  bind:m  (do-load head `!>(saved))
  ;<  result=(list card)  bind:m
    (do-poke %harness-action !>(`action:h`[%retry 'batch']))
  ;<  =vase  bind:m  get-save
  =/  after  !<(state-0 vase)
  =/  session  (~(got by sessions.after) 'batch')
  =/  completed
    %+  murn  (flop log.session)
    |=  event=event:h
    ^-  (unit [id=@t body=@t])
    ?.  ?=(%tool-completed -.event)  ~
    `[call-id.event body.event]
  =/  expected=(list [id=@t body=@t])
    :~  ['write' 'skill \'sample\' written']
        ['read-first' 'First body']
        ['propose' 'skill \'sample\' staged — rehearse it before committing']
        ['commit' 'skill \'sample\' committed to the live library']
        ['read-second' 'Second body']
        ['delete' 'skill \'sample\' deleted']
        ['read-deleted' 'error: no such skill: sample']
        ['stage' 'skill \'draft\' staged — rehearse it before committing']
        ['discard' 'staged skill \'draft\' discarded']
        ['rejected' 'rejected: tool is not granted for this session']
    ==
  =/  requested
    %+  skim  (flop log.session)
    |=(event=event:h ?=(%tool-requested-2 -.event))
  =/  expected-requests=(list event:h)
    :~  [%tool-requested-2 7 'fetch' 'http_fetch']
        [%tool-requested-2 7 'script' 'run_js']
    ==
  =/  deferred
    %+  murn  result
    |=  =card
    ^-  (unit wire)
    ?.  ?=([%pass * *] card)  ~
    ?.  |(?=([%tool-2 *] p.card) ?=([%runjs *] p.card))  ~
    `p.card
  ;<  ~  bind:m  (ex-equal !>(completed) !>(expected))
  ;<  ~  bind:m  (ex-equal !>(requested) !>(expected-requests))
  ;<  ~  bind:m  (ex-equal !>(skills.after) !>(~))
  ;<  ~  bind:m  (ex-equal !>(staged.after) !>(~))
  ;<  ~  bind:m  (ex-equal !>(next-req.session) !>(7))
  (ex-equal !>(deferred) !>(~[/tool-2/batch/7/fetch /runjs/batch/script]))
--

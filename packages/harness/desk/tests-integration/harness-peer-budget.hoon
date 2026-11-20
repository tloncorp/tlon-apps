::  Exercise the owner reset endpoint against saved fixture logs, without
::  executing emitted inference/network cards or touching a running session.
::  Opt-in: -test /=harness=/tests-integration/harness-peer-budget
::  Full-agent virtual evaluation is slow; keep it out of the fast suite.
/-  h=harness, ac=acp, *harness-store
/+  *test-agent, peers=harness-peer-policy, defaults=harness-defaults, hl=harness
/=  head  /app/harness
|%
++  fixture
  ^-  state-0
  =/  saved=state-0  *state-0
  =.  defaults.saved  builtin-config:defaults
  =.  peers.saved  (my ~[[~nec [~ ~ 100 ~]]])
  =.  sessions.saved
    %-  my
    :~  :*  'peer--~nec'
            :*  :~  [%llm-completed 0 %stop [100 20] [%assistant 'Retain this reply' ~]]
                    [%config-replaced defaults.saved]
                ==
                1
            ==
        ==
    ==
  saved
::  Load saved state as ~zod and deliver one JSON-RPC frame on the ACP
::  subscription the load opens. Optional live bindings are absent in this
::  fixture, so every scry answers %.n.
++  invoke
  |=  [saved=state-0 method=@t params=json]
  =/  m  (mare ,state-0)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, dap %harness)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  *  bind:m  (do-load head `!>(saved))
  ;<  =bowl  bind:m  get-bowl
  =/  payload
    %-  en:json:html
    (pairs:enjs:format ~[['jsonrpc' %s '2.0'] ['id' %n '1'] ['method' %s method] ['params' params]])
  =/  =update:v1:ac  [%messages 'budget-fixture' %agent ~[[1 now.bowl payload]]]
  ;<  *  bind:m  (do-agent /acp/watch [~zod %acp] [%fact %acp-update-1 !>(update)])
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-0 vase))
++  reset-params
  |=  [saved=state-0 ship=@p]
  %-  pairs:enjs:format
  :~  ['ship' %s (scot %p ship)]
      ['revision' %s (revision:peers peers.saved ~ peer-base.saved peer-limits.saved)]
  ==
++  test-reset-keeps-history-grants-and-limit-and-survives-reload
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  fixture
  ;<  next=state-0  bind:m  (invoke saved 'harness/peers/reset' (reset-params saved ~nec))
  =/  baseline  (fall (~(get by peer-budget-resets.next) ~nec) 0)
  =/  v  (play:hl log:(need (~(get by sessions.next) 'peer--~nec')))
  ;<  reloaded=state-0  bind:m  (invoke next(acp-through ~) 'harness/peers' ~)
  ;<  ~  bind:m  (ex-equal !>(baseline) !>(120))
  ;<  ~  bind:m  (ex-equal !>((used:peers (add prompt.total.v completion.total.v) baseline)) !>(0))
  ;<  ~  bind:m  (ex-equal !>(sessions.next) !>(sessions.saved))
  ;<  ~  bind:m  (ex-equal !>(peers.next) !>(peers.saved))
  ;<  ~  bind:m  (ex-equal !>(peer-limits.next) !>(peer-limits.saved))
  (ex-equal !>(peer-budget-resets.reloaded) !>(peer-budget-resets.next))
++  test-invalid-and-stale-resets-do-not-change-counts
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  fixture
  ;<  invalid=state-0  bind:m  (invoke saved 'harness/peers/reset' (reset-params saved ~bud))
  ;<  stale=state-0  bind:m
    %^  invoke
      saved
      'harness/peers/reset'
    (pairs:enjs:format ~[['ship' %s '~nec'] ['revision' %s 'stale']])
  (ex-equal !>(&(=(~ peer-budget-resets.invalid) =(~ peer-budget-resets.stale))) !>(&))
++  test-deleting-peer-session-clears-only-its-reset-baseline
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  fixture
  =.  peer-budget-resets.saved  (my ~[[~nec 120] [~bud 7]])
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, dap %harness)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  *  bind:m  (do-load head `!>(saved))
  ;<  *  bind:m  (do-poke %harness-action !>(`action:h`[%delete 'peer--~nec']))
  ;<  =vase  bind:m  get-save
  =/  next  !<(state-0 vase)
  %+  ex-equal
    !>(&(!(~(has by sessions.next) 'peer--~nec') =((my ~[[~bud 7]]) peer-budget-resets.next)))
  !>(&)
--

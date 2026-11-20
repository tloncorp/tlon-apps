::  ACP admission and response ordering through the full head. Cards are
::  inspected through test-agent and never delivered to other agents.
/-  *harness-store, h=harness, ac=acp
/+  *test-agent, policy=harness-defaults, hl=harness, j=harness-workspace-json
/=  head  /app/harness
|%
++  t0  ~2026.10.1
::
++  fixture
  ^-  state-0
  =/  saved  *state-0
  saved(defaults builtin-config:policy, local-mcp-seen 1)
::  Loading opens the ACP subscription that the frames below arrive on.
::
++  setup
  |=  saved=state-0
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now t0)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  *  bind:m  (do-load head `!>(saved))
  (pure:m ~)
::
++  do-update
  |=  =update:v1:ac
  (do-agent /acp/watch [~zod %acp] [%fact %acp-update-1 !>(update)])
::
++  get-state
  =/  m  (mare ,state-0)
  ^-  form:m
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-0 vase))
::  JSON-RPC frames sent to the connection, among the other cards.
::
++  frames
  |=  cards=(list card)
  ^-  (list json)
  %+  murn  cards
  |=  =card
  ^-  (unit json)
  ?.  ?=([%pass [%acp %send ~] %agent * %poke %acp-action-1 *] card)  ~
  =/  [pass=* wire=* agent=* target=* poke=* mark=* data=vase]  card
  =/  action  !<(action:v1:ac data)
  ?>  ?=(%send -.action)
  (de:json:html payload.action)
::
++  acknowledgements
  |=  cards=(list card)
  %+  skim  cards
  |=(=card ?=([%pass [%acp %ack ~] %agent * %poke %acp-action-1 *] card))
::
++  test-batch-admits-requests-in-order-and-ignores-replay
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  =update:v1:ac
    :*  %messages  'fixture'  %agent
        :~  [1 t0 '{']
            [2 t0 '{"jsonrpc":"2.0","method":"session/new","params":{"name":"ignored"}}']
            :*  3  t0
                '{"jsonrpc":"2.0","id":1,"method":"session/new","params":{"name":"alpha"}}'
            ==
            [4 t0 '{"jsonrpc":"2.0","id":2,"method":"unknown"}']
            [5 t0 '{"jsonrpc":"2.0","id":3,"method":"session/list"}']
        ==
    ==
  ;<  ~                     bind:m  (setup fixture)
  ;<  admitted=(list card)  bind:m  (do-update update)
  ;<  saved=state-0         bind:m  get-state
  =/  replies  (frames admitted)
  ;<  ~                     bind:m  (ex-equal !>((lent replies)) !>(4))
  ;<  replayed=(list card)  bind:m  (do-update update)
  ;<  ~  bind:m  (ex-equal !>(~(wyt by sessions.saved)) !>(1))
  ;<  ~  bind:m  (ex-equal !>((~(has by sessions.saved) 'alpha')) !>(&))
  ;<  ~  bind:m  (ex-equal !>((~(got by acp-through.saved) 'fixture')) !>(5))
  ;<  ~  bind:m  (ex-equal !>((lent (acknowledgements admitted))) !>(5))
  ;<  ~  bind:m  (ex-equal !>((need (get:j (snag 0 replies) 'id'))) !>(`json`[%n '1']))
  ;<  ~  bind:m
    %+  ex-equal
      !>((string:j (need (get:j (snag 0 replies) 'result')) 'sessionId'))
    !>('alpha')
  ;<  ~  bind:m
    (ex-equal !>((string:j (snag 1 replies) 'method')) !>('session/update'))
  ;<  ~  bind:m
    %+  ex-equal
      !>((need (get:j (need (get:j (snag 2 replies) 'error')) 'code')))
    !>(`json`[%n '-32601'])
  ;<  ~  bind:m  (ex-equal !>((need (get:j (snag 3 replies) 'id'))) !>(`json`[%n '3']))
  (ex-cards replayed ~)
::
++  test-cancel-notification-needs-no-id-and-null-id-gets-a-reply
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  fixture
  =/  events=(list event:h)
    :~  [%llm-requested 0 %turn]
        [%input-admitted [%user 'Pending']]
        [%config-replaced defaults.saved]
    ==
  =.  sessions.saved  (~(put by sessions.saved) 'alpha' [events 1])
  =/  =update:v1:ac
    :*  %messages  'fixture'  %agent
        :~  :*  1  t0
                '{"jsonrpc":"2.0","method":"session/cancel","params":{"sessionId":"alpha"}}'
            ==
            [2 t0 '{"jsonrpc":"2.0","id":null,"method":"initialize"}']
        ==
    ==
  ;<  ~                      bind:m  (setup saved)
  ;<  cancelled=(list card)  bind:m  (do-update update)
  ;<  after=state-0          bind:m  get-state
  =/  replies  (frames cancelled)
  ;<  ~  bind:m  (ex-equal !>((lent replies)) !>(1))
  =/  view  (play:hl log:(~(got by sessions.after) 'alpha'))
  ;<  ~  bind:m  (ex-equal !>(?=(^ cancelled.view)) !>(&))
  ;<  ~  bind:m  (ex-equal !>(pending.view) !>(~))
  ;<  ~  bind:m  (ex-equal !>((need (get:j (snag 0 replies) 'id'))) !>(`json`~))
  (ex-equal !>(?=(^ (get:j (snag 0 replies) 'result'))) !>(&))
--

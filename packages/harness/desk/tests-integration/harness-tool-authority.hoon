::  Pending tool replies retain their generation and live authority boundaries.
/-  h=harness, *harness-store
/+  *test-agent, policy=harness-defaults, hl=harness
/=  head  /app/harness
|%
::  Every scry is refused.
::
++  setup
  |=  saved=state-0
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now ~2026.10.1)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  *  bind:m  (do-load head `!>(saved))
  (pure:m ~)
::  Gall holds a subscription to the MCP proxy on this wire, so its kick is
::  deliverable.
::
++  subscribed
  |=  [generation=@ud call-id=@t]
  =/  request-id=@ta  (cat 3 'harness-' (scot %uv (sham ['source' generation call-id])))
  %-  jab-bowl
  |=  b=bowl
  =/  key  [/local-mcp/source/(scot %ud generation)/[call-id] ~zod %mcp-proxy]
  b(wex (~(put by wex.b) key [& /http-response/[request-id]]))
++  do-kick
  |=  generation=@ud
  (do-agent /local-mcp/source/(scot %ud generation)/call [~zod %mcp-proxy] [%kick ~])
::
++  fixture
  ^-  state-0
  =/  saved  *state-0
  =/  config  builtin-config:policy
  =.  config  config(tools ~[[%mcp 'fixture']])
  =/  server=mcp-server:h  ['Fixture' 'urbit://~zod/mcp-proxy' ~ &]
  =/  events=(list event:h)
    :~  [%tool-requested-2 2 'call' 'call_mcp_tool']
        :*  %llm-completed  1  %tool-calls  [1 1]
            :*  %assistant  ''
                ~[['call' 'call_mcp_tool' '{"server":"fixture","name":"read","arguments":{}}']]
            ==
        ==
        [%llm-requested 1 %turn]
        [%input-admitted [%user 'Read the result']]
        [%config-replaced config]
    ==
  %*  .  saved
    defaults  config
    local-mcp-seen  1
    sessions  (my ~[['source' [events 2]]])
    mcp-servers  (my ~[['fixture' server]])
    local-mcp  (my ~[[['source' 'call'] [2 'fixture' (sham server) 200 'Completed']]])
  ==
::
++  test-stale-mcp-sign-cannot-consume-a-current-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (setup fixture)
  ::  A subscription from the superseded generation is still open.
  ;<  ~  bind:m  (subscribed 1 'call')
  ;<  old=vase  bind:m  get-save
  ;<  caz=(list card)  bind:m  (do-kick 1)
  ;<  new=vase  bind:m  get-save
  =/  before  !<(state-0 old)
  =/  after  !<(state-0 new)
  ;<  ~  bind:m  (ex-equal !>(sessions.after) !>(sessions.before))
  ;<  ~  bind:m  (ex-equal !>(local-mcp.after) !>(local-mcp.before))
  (ex-cards caz ~)
::
++  test-mcp-completion-rechecks-grants-and-server-identity
  %-  zing
  %+  turn  `(list term)`~[%grant %disabled %configuration]
  |=  change=term
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  initial  fixture
  =/  session  (~(got by sessions.initial) 'source')
  =/  config  config:(play:hl log.session)
  =?  sessions.initial  =(%grant change)
    %+  ~(put by sessions.initial)
      'source'
    session(log [[%config-replaced config(tools ~)] log.session])
  =/  server  (~(got by mcp-servers.initial) 'fixture')
  =?  mcp-servers.initial  =(%disabled change)
    (~(put by mcp-servers.initial) 'fixture' server(enabled |))
  =?  mcp-servers.initial  =(%configuration change)
    (~(put by mcp-servers.initial) 'fixture' server(url 'urbit://~nec/mcp-proxy'))
  ;<  ~  bind:m  (setup initial)
  ;<  ~  bind:m  (subscribed 2 'call')
  ;<  *  bind:m  (do-kick 2)
  ;<  completed=vase  bind:m  get-save
  =/  saved  !<(state-0 completed)
  =/  view  (play:hl log:(~(got by sessions.saved) 'source'))
  =/  receipt  (rear items.view)
  ?>  ?=(%tool -.receipt)
  ::  The kick ended that subscription; reopen it so a duplicate completion
  ::  sign can be delivered and shown to be inert.
  ;<  ~  bind:m  (subscribed 2 'call')
  ;<  caz=(list card)  bind:m  (do-kick 2)
  ;<  repeated=vase  bind:m  get-save
  =/  after-repeat  !<(state-0 repeated)
  ;<  ~  bind:m
    %+  ex-equal
      !>(body.receipt)
    !>('rejected: local MCP access or server configuration changed')
  ;<  ~  bind:m  (ex-equal !>(local-mcp.saved) !>(~))
  ;<  ~  bind:m  (ex-equal !>(sessions.after-repeat) !>(sessions.saved))
  (ex-cards caz ~)
--

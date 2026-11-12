::  Both MCP transports project catalogs before recording model-visible receipts.
/-  h=harness, *harness-store
/+  *test-agent, policy=harness-defaults, hl=harness, w=harness-provider-wire, mcp=harness-mcp
/=  head  /app/harness
/=  fixture  /tests/harness-mcp-discovery
|%
::  Load saved state with src as given; every scry answers %.n, as the old
::  sandbox did.
::
++  setup
  |=  [src=ship saved=state-0]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src src, now ~2026.9.25)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  *  bind:m  (do-load head `!>(saved))
  (pure:m ~)
::
++  get-state
  =/  m  (mare ,state-0)
  ^-  form:m
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-0 vase))
::
::  Each name is asked of a freshly loaded agent.
::
++  test-peer-discovery-is-paged-and-does-not-create-transcript-events
  %-  zing
  %+  turn  `(list @t)`~['' 'read_skill' 'harness_admin']
  |=(name=@t (eval-mare (peer-discovery name)))
++  peer-discovery
  |=  name=@t
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved=state-0  *state-0
  =.  saved  saved(local-mcp-seen 1, peers (my ~[[~nec [~[%skills] ~ 0 ~]]]))
  ;<  ~  bind:m  (setup ~nec saved)
  =/  args  (en:json:html (pairs:enjs:format ~[['name' %s name]]))
  ;<  response=(list card)  bind:m
    (do-poke %harness-rpc-0 !>(`peer-rpc:h`[%tools 0v1 args]))
  ;<  stored=state-0  bind:m  get-state
  =/  replies
    %+  murn
      response
    |=  c=card
    ?:(?=([%pass * %agent * %poke %harness-rpc-0 *] c) `!<(peer-rpc:h +127.c) ~)
  =/  reply  (snag 0 replies)
  ?>  ?=(%result -.reply)
  ?>  ?=(%& -.result.reply)
  =/  catalog  (need (de:json:html p.result.reply))
  =/  rows  (need (get:w catalog 'tools'))
  ?>  ?=(%a -.rows)
  =/  correct
    ?:  =('' name)
      (levy p.rows |=(row=json =(~ (get:w row 'inputSchema'))))
    ?:  =('harness_admin' name)  =(~ p.rows)
    &(=(1 (lent p.rows)) ?=(^ (get:w (snag 0 p.rows) 'inputSchema')))
  ;<  ~  bind:m  (ex-equal !>(sessions.stored) !>(sessions.saved))
  (ex-equal !>(correct) !>(&))
++  test-tool-transports-preserve-results-and-page-discovery
  ^-  tang
  %-  zing
  %+  turn
    ^-  (list [? @t])
    :~  [& '']  [& 'tool-44']  [| '']  [| 'tool-44']  [& 'large']  [| 'large']  [& 'schema']
        [| 'schema']  [| 'peer']
    ==
  |=  [local=? name=@t]
  (eval-mare (exchange local name))
::  The mcp-proxy response subscription a saved local call is waiting on.
::
++  local-sub
  |=  [sid=@t generation=@ud call-id=@t]
  =/  m  (mare ,~)
  ^-  form:m
  =/  =wire  /local-mcp/[sid]/(scot %ud generation)/[call-id]
  =/  request-id=@ta  (cat 3 'harness-' (scot %uv (sham [sid generation call-id])))
  %-  jab-bowl
  |=  b=bowl
  b(wex (~(put by wex.b) [wire ~zod %mcp-proxy] [& /http-response/[request-id]]))
++  exchange
  |=  [local=? name=@t]
  =/  m  (mare ,~)
  ^-  form:m
  =/  peer=?  =('peer' name)
  =/  cfg  builtin-config:policy
  =.  cfg
    %=  cfg  key  'fixture-key'  url  'https://example.test/v1/chat/completions'  tools
        ~[[%mcp 'fixture']]
    ==
  =?  cfg  peer  cfg(tools ~[%peers])
  =/  server=mcp-server:h  ['Fixture' 'https://example.test/mcp' ~ &]
  =/  large=?  |(peer =('large' name) =('schema' name))
  =/  tool  ?:(&(large !=('schema' name)) 'call_mcp_tool' 'list_mcp_tools')
  =?  tool  peer  'call_peer_tool'
  =/  args  (en:json:html (pairs:enjs:format ~[['server' %s 'fixture'] ['name' %s name]]))
  =?  args  peer  '{"ship":"~nec","name":"read_skill","arguments":{}}'
  =/  log=(list event:h)
    :~  [%tool-requested-2 1 'call' tool]
        [%llm-completed 0 %tool-calls [1 1] [%assistant '' ~[['call' tool args]]]]
        [%llm-requested 0 %turn]
        [%input-admitted [%user 'Find a tool.']]
        [%config-replaced cfg]
    ==
  =/  raw  (en:json:html (source:fixture 45 ''))
  =?  raw  =('schema' name)
    =/  def  (put:w (tool:fixture 0) 'name' [%s 'schema'])
    =.  def  (put:w def 'description' [%s (rap 3 (reap 60.000 'x'))])
    %-  en:json:html
    (pairs:enjs:format ~[['id' %n '1'] ['result' (pairs:enjs:format ~[['tools' %a ~[def]]])]])
  =/  saved=state-0  *state-0
  =.  saved
    %=  saved  defaults  cfg  local-mcp-seen  1  mcp-servers  (my ~[['fixture' server]])  sessions
        (my ~[['fixture' [log 1]]])
    ==
  =?  saved  peer
    saved(peers (my ~[[~nec [~[%skills] ~ 0 ~]]]), asks (my ~[[0v1 ['fixture' 'call' ~nec]]]))
  =?  saved  local
    saved(local-mcp (my ~[[['fixture' 'call'] [1 'fixture' (sham server) 200 raw]]]))
  ;<  ~  bind:m  (setup ?:(peer ~nec ~zod) saved)
  ;<  *  bind:m
    ?:  peer
      (do-poke %harness-rpc-0 !>(`peer-rpc:h`[%result 0v1 [%& raw]]))
    ?:  local
      ;<  ~  bind:(mare ,(list card))  (local-sub 'fixture' 1 'call')
      (do-agent /local-mcp/fixture/1/call [~zod %mcp-proxy] [%kick ~])
    =/  response=client-response:iris
      [%finished [200 ~] `['application/json' (as-octs:mimes:html raw)]]
    (do-arvo /tool-2/fixture/1/call [%iris %http-response response])
  ;<  retained=state-0  bind:m  get-state
  =/  view  (play:hl log:(~(got by sessions.retained) 'fixture'))
  =/  receipt  (rear items.view)
  ?>  ?=(%tool -.receipt)
  ?:  large
    =/  expected  (cat 3 'HTTP 200\0a\0a' raw)
    =?  expected  =('schema' name)  (receipt:mcp args expected)
    =?  expected  peer  raw
    ;<  ~  bind:m  (ex-equal !>((gth (met 3 body.receipt) 48.000)) !>(&))
    ;<  ~  bind:m  (ex-equal !>(body.receipt) !>(expected))
    (ex-equal !>(~(wyt by local-mcp.retained)) !>(0))
  =/  rpc  (need (de:json:html (rsh 3^10 body.receipt)))
  =/  result  (need (get:w rpc 'result'))
  =/  tools  (need (get:w result 'tools'))
  ?>  ?=(%a -.tools)
  ;<  ~  bind:m  (ex-equal !>((lent p.tools)) !>(?:(=('' name) 45 1)))
  ;<  ~  bind:m  (ex-equal !>((str:w (rear p.tools) 'name')) !>('tool-44'))
  ;<  ~  bind:m
    (ex-equal !>(?=(^ (get:w (rear p.tools) 'inputSchema'))) !>(!=('' name)))
  (ex-equal !>(~(wyt by local-mcp.retained)) !>(0))
--

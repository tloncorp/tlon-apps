::  Concrete effect bindings: ship reads, HTTP/MCP, timers and peer/self pokes.
::  This door receives a bowl and the MCP registry, never the session store.
::  Callers must authorize tools and record intent before emitting these cards;
::  result handlers in the agent fence late receipts before appending events.
::  Sync reads return a result noun; async helpers describe cards, not a loop.
/-  h=harness, spider
/+  ht=harness-tools, tbjs=thread-builder-js, local-mcp=harness-local-mcp,
    calculator=harness-calculate, mcp=harness-mcp, pages=harness-pages
|_  [=bowl:gall mcp-servers=(map mcp-server-id:h mcp-server:h)]
+$  card  card:agent:gall
::  +run-js-poke: a run_js tool call becomes a poke to ourselves
::
++  run-js-poke
  |=  [sid=session-id:h generation=@ud call-id=@t code=@t]
  ^-  card
  :*  %pass  `wire`[%runjs `@ta`sid `@ta`call-id ~]
      %agent  [our.bowl dap.bowl]  %poke
      %harness-effect  !>(`effect:h`[generation [%run-js sid call-id code]])
  ==
::  QuickJS/WASM executor. The head owns the job record
::  and authorizes admission; this binding only builds the Spider effects.
++  js-cards
  |=  [tid=@ta code=@t deadline=@da gap=@dr]
  ^-  (list card)
  ::  gap arms an in-thread jinx (CPU-time) bound so a non-yielding loop
  ::  bails mid-event; deadline is the yielding-hang Behn watchdog. gap 0
  ::  means no limit: no jinx (handled in tbjs) and no watchdog.
  =/  =shed:khan  (tbjs code gap)
  =/  args=inline-args:spider  [~ `tid [our.bowl q.byk.bowl da+now.bowl] shed]
  :+  [%pass `wire`[%jswatch tid ~] %agent [our.bowl %spider] %watch /thread-result/[tid]]
    [%pass `wire`[%jspoke tid ~] %agent [our.bowl %spider] %poke %spider-inline !>(args)]
  ?:  =(`@dr`0 gap)  ~
  ~[[%pass `wire`[%jsdog tid ~] %arvo %b %wait deadline]]
::  +rehearse-poke: a rehearse_skill tool call becomes a poke to ourselves
::
++  rehearse-poke
  |=  [sid=session-id:h generation=@ud call-id=@t name=@t input=@t]
  ^-  card
  :*  %pass  `wire`[%reh `@ta`sid `@ta`call-id ~]
      %agent  [our.bowl dap.bowl]  %poke
      %harness-effect  !>(`effect:h`[generation [%rehearse sid call-id name input]])
  ==
::
++  wait-card
  |=  [sid=session-id:h name=@ta at=@da]
  ^-  card
  [%pass `wire`[%timer `@ta`sid name ~] %arvo %b %wait at]
::
++  rest-card
  |=  [sid=session-id:h name=@ta at=@da]
  ^-  card
  [%pass `wire`[%timer `@ta`sid name ~] %arvo %b %rest at]
::  Synchronous tools return their completion event immediately.
::  The supplied skill library includes earlier writes in the same batch.
::
++  run-tool
  |=  [call=tool-call:h skills=(map @t skill:h) tools=(list tool-grant:h)]
  ^-  event:h
  ?.  (call-granted:ht call tools)
    [%tool-completed id.call name.call 'rejected: tool or path is not granted for this session']
  =/  body=@t
    ?+  name.call  (cat 3 'unknown tool: ' name.call)
      %'calculate'  (evaluate:calculator args.call)
      %'current_time'  (current-time now.bowl)
      %'read_desk_file'  (read-desk-file args.call)
      %'list_desk_files'  (list-desk-files args.call)
      %'read_skill'  (read-skill args.call skills)
        %'list_desk_scopes'
      %-  en:json:html
      :-  %a
      %+  turn  (clay-scopes:ht tools)
      |=  scope=path
      ^-  json
      [%s (crip (spud scope))]
    ::
        %'list_mcp_servers'
      %-  en:json:html
      :-  %a
      %+  murn  ~(tap by mcp-servers)
      |=  [id=mcp-server-id:h server=mcp-server:h]
      ^-  (unit json)
      ?.  &(enabled.server (mcp-granted:ht id tools))  ~
      `(pairs:enjs:format ~[['id' %s id] ['name' %s name.server]])
    ==
  [%tool-completed id.call name.call body]
::
++  current-time
  |=  now=@da
  ^-  @t
  =/  =date  (yore now)
  =/  pad
    |=  number=@ud
    ^-  tape
    ?:  (lth number 10)  "0{(a-co:co number)}"
    (a-co:co number)
  =/  utc=@t
    %-  crip
    "{(a-co:co y.date)}-{(pad m.date)}-{(pad d.t.date)}T{(pad h.t.date)}:{(pad m.t.date)}:{(pad s.t.date)}Z"
  =/  seconds  (div (sub now ~1970.1.1) ~s1)
  =/  weekdays=(list @t)
    ~['Sunday' 'Monday' 'Tuesday' 'Wednesday' 'Thursday' 'Friday' 'Saturday']
  =/  weekday  (snag (mod (add (div seconds 86.400) 4) 7) weekdays)
  %-  en:json:html
  %-  pairs:enjs:format
  :~  ['utc' %s utc]
      ['timezone' %s 'UTC']
      ['unixSeconds' (numb:enjs:format seconds)]
      ['weekday' %s weekday]
  ==
::  +read-skill: fetch a skill body from the library
::
++  read-skill
  |=  [args=@t skills=(map @t skill:h)]
  ^-  @t
  =/  name  (tool-str args 'name')
  ?~  name  'error: bad name argument'
  =/  skill  (~(get by skills) u.name)
  ?~  skill  (cat 3 'error: no such skill: ' u.name)
  body.u.skill
::  +tool-str: pull a string field out of tool-call arguments
::
++  tool-str
  |=  [args=@t key=@t]
  ^-  (unit @t)
  =/  parsed  (de:json:html args)
  ?~  parsed  ~
  ?.  ?=([%o *] u.parsed)  ~
  =/  value  (~(get by p.u.parsed) key)
  ?:(?=([~ %s *] value) `p.u.value ~)
::  +tool-path: pull a clay path out of tool-call arguments
::
++  tool-path
  |=  args=@t
  ^-  (unit path)
  =/  text  (tool-str args 'path')
  ?~  text  ~
  (rush u.text stap)
::
++  read-desk-file
  |=  args=@t
  ^-  @t
  =/  target  (tool-path args)
  ?~  target  'error: bad path argument'
  ?.  ?=([@ @ *] u.target)  'error: path must be /desk/spur/file/ext'
  =/  base=path  /(scot %p our.bowl)/[i.u.target]/(scot %da now.bowl)
  =*  spur  t.u.target
  =/  result
    %-  mole
    |.
    ?.  .^(? %cu (weld base spur))  'error: no such file'
    =/  ext  (rear spur)
    ::  %q reads the stored noun without invoking desk-defined marks. Scoped
    ::  reads must not gain authority through a mark's conversion/import code.
    =/  body  (clay-text:ht ext .^(noun %cq (weld base spur)))
    =/  input  (need (de:json:html args))
    =/  revision  (str:w:pages input 'revision')
    ?.  |(=('' revision) =(revision (scot %uv (sham body))))
      'error: file changed; restart at offset 0 to read its current revision'
    =/  page  (text:pages body (number:pages input 'offset'))
    (en:json:html (put:w:pages page 'revision' [%s (scot %uv (sham body))]))
  ?~  result  'error: could not read file'
  u.result
::
++  list-desk-files
  |=  args=@t
  ^-  @t
  =/  target  (tool-path args)
  ?~  target  'error: bad path argument'
  ?~  u.target  'error: need at least /desk'
  =/  base=path  /(scot %p our.bowl)/[i.u.target]/(scot %da now.bowl)
  =/  result
    %-  mole
    |.
    =/  paths  .^((list path) %ct (weld base t.u.target))
    =/  input  (need (de:json:html args))
    =/  names  (sort (turn paths |=(entry=path (crip (spud entry)))) aor)
    (en:json:html (directory:pages names (number:pages input 'offset')))
  ?~  result  'error: could not list directory'
  u.result
::  MCP discovery and calls target stateless Streamable HTTP servers. Identity
::  and credentials remain agent configuration; only results enter the log.
::
++  mcp-payload
  |=  call=tool-call:h
  ^-  (unit json)
  =/  method=@t
    ?:(=('list_mcp_tools' name.call) 'tools/list' 'tools/call')
  =/  params=json
    ?:  =('list_mcp_tools' name.call)
      (params:mcp args.call)
    =/  tool-name  (tool-str args.call 'name')
    =/  arguments  (tool-str args.call 'arguments')
    ?~  tool-name  ~
    =/  parsed=(unit json)
      ?~(arguments `(pairs:enjs:format ~) (de:json:html u.arguments))
    ?~  parsed  ~
    %-  pairs:enjs:format
    :~  ['name' %s u.tool-name]
        ['arguments' u.parsed]
    ==
  :-  ~
  ^-  json
  %-  pairs:enjs:format
  :~  ['jsonrpc' %s '2.0']
      ['id' (numb:enjs:format 1)]
      ['method' %s method]
      ['params' params]
  ==
++  mcp-card
  |=  [sid=session-id:h generation=@ud call=tool-call:h tools=(list tool-grant:h)]
  ^-  (unit card)
  ?.  (call-granted:ht call tools)  ~
  =/  server-id  (tool-str args.call 'server')
  ?~  server-id  ~
  =/  configured  (~(get by mcp-servers) u.server-id)
  ?~  configured  ~
  ?.  enabled.u.configured  ~
  =/  payload  (mcp-payload call)
  ?~  payload  ~
  ?:  =((url:local-mcp our.bowl) url.u.configured)
    :-  ~
    :*  %pass  /local-mcp-request/[sid]/(scot %ud generation)/[id.call]
        %agent  [our.bowl dap.bowl]  %poke  %harness-effect
        !>(`effect:h`[generation [%local-mcp sid id.call]])
    ==
  =/  headers=header-list:http
    :~  ['content-type' 'application/json']
        ['accept' 'application/json, text/event-stream']
    ==
  =.  headers  (weld headers.u.configured headers)
  =/  =request:http
    [%'POST' url.u.configured headers `(as-octs:mimes:html (en:json:html u.payload))]
  :-  ~
  :*  %pass  `wire`[%tool-2 `@ta`sid (scot %ud generation) `@ta`id.call ~]
      %arvo  %i  %request  request  *outbound-config:iris
  ==
::  +fetch-card: an http_fetch tool call becomes an iris request
::
++  fetch-card
  |=  [sid=session-id:h generation=@ud call=tool-call:h]
  ^-  (unit card)
  =/  parsed  (de:json:html args.call)
  ?~  parsed  ~
  ?.  ?=([%o *] u.parsed)  ~
  =/  url  (~(get by p.u.parsed) 'url')
  ?.  ?=([~ %s *] url)  ~
  ?.  ?&  (lte (met 3 p.u.url) 8.192)
          |(=('http://' (end [3 7] p.u.url)) =('https://' (end [3 8] p.u.url)))
      ==
    ~
  =/  forbidden
    %+  lien  (trip p.u.url)
    |=  char=@t
    |((lte char 32) (gte char 127) =(char '#') =(char '@') =(char 92))
  ?:  forbidden  ~
  ?~  (de-purl:html p.u.url)  ~
  =/  method  (~(get by p.u.parsed) 'method')
  ?:  &(?=(^ method) !=([%s 'GET'] u.method))  ~
  ?:  (~(has by p.u.parsed) 'body')  ~
  =/  =request:http  [%'GET' p.u.url ~ ~]
  :-  ~
  :*  %pass  `wire`[%tool-2 `@ta`sid (scot %ud generation) `@ta`id.call ~]
      %arvo  %i  %request  request  [0 0]
  ==
::  +answer-card: send a typed answer back over ames
::
++  answer-card
  |=  [=ship id=ask-id:h result=(each @t @t)]
  ^-  card
  :*  %pass  `wire`[%a2a %answer (scot %uv id) ~]
      %agent  [ship dap.bowl]  %poke
      %harness-a2a-0  !>(`a2a:h`[%answer id result])
  ==
::  +ask-peer-card: an ask_peer tool call becomes a poke to ourselves
::
++  ask-peer-card
  |=  [sid=session-id:h generation=@ud call=tool-call:h]
  ^-  (unit card)
  =/  ship-text  (tool-str args.call 'ship')
  =/  input  (tool-str args.call 'prompt')
  ?~  ship-text  ~
  ?~  input  ~
  =/  who=(unit @p)
    %+  slaw  %p
    ?:(=('~' (end [3 1] u.ship-text)) u.ship-text (cat 3 '~' u.ship-text))
  ?~  who  ~
  =/  fields  (de:json:html args.call)
  ?.  ?=([~ %o *] fields)  ~
  =/  task  (~(get by p.u.fields) 'task')
  =/  prompt=@t
    ?~  task  u.input
    ?.  ?=([%s *] u.task)  ''
    ?.  &((gth (met 3 p.u.task) 0) (lte (met 3 p.u.task) 200))  ''
    =/  reference
      %-  en:json:html
      %-  pairs:enjs:format
      :~  ['home' %s (scot %p our.bowl)]
          ['id' %s p.u.task]
      ==
    %+  rap  3
    :~  'Internal work reference: '  reference
        '\0aRead, claim, and update this task on its home ship through call_peer_tool(workspace). Do not create a duplicate. This reference grants no access; current mutual grants still apply.\0a\0aWork brief:\0a'
        u.input
    ==
  ?:  =('' prompt)  ~
  :-  ~
  :*  %pass  `wire`[%aski `@ta`sid `@ta`id.call ~]
      %agent  [our.bowl dap.bowl]  %poke
      %harness-effect  !>(`effect:h`[generation [%ask-peer sid id.call u.who prompt]])
  ==
++  check-peer-card
  |=  [sid=session-id:h generation=@ud call=tool-call:h]
  ^-  (unit card)
  =/  ship-text  (tool-str args.call 'ship')
  ?~  ship-text  ~
  =/  who  (slaw %p u.ship-text)
  ?~  who  ~
  :-  ~
  :*  %pass  /peer-check/[sid]/[id.call]
      %agent  [our.bowl dap.bowl]  %poke  %harness-effect
      !>(`effect:h`[generation [%check-peer sid id.call u.who]])
  ==
++  peer-rpc-card
  |=  [sid=session-id:h generation=@ud call=tool-call:h]
  ^-  (unit card)
  =/  ship  (tool-str args.call 'ship')
  ?~  ship  ~
  =/  who  (slaw %p u.ship)
  ?~  who  ~
  =/  name  (tool-str args.call 'name')
  ?:  &(=('call_peer_tool' name.call) ?=(~ name))  ~
  =/  args
    ^-  (unit @t)
    ?:  =('list_peer_tools' name.call)  `args.call
    =/  parsed  (de:json:html args.call)
    ?.  ?=([~ %o *] parsed)  ~
    =/  value  (~(get by p.u.parsed) 'arguments')
    ?.  ?=([~ %o *] value)  ~
    `(en:json:html u.value)
  ?~  args  ~
  :-  ~
  :*  %pass  /peer-rpc-request/[sid]/(scot %ud generation)/[id.call]
      %agent  [our.bowl dap.bowl]  %poke  %harness-effect
      !>  ^-  effect:h
          :*  generation
              [%peer-rpc sid id.call u.who ?:(=('list_peer_tools' name.call) ~ name) u.args]
          ==
  ==
++  admin-card
  |=  [sid=session-id:h generation=@ud call=tool-call:h]
  ^-  (unit card)
  =/  method  (tool-str args.call 'method')
  ?~  method  ~
  =/  raw  (fall (tool-str args.call 'params') '{}')
  ?:  (gth (met 3 raw) 65.536)  ~
  =/  params  (de:json:html raw)
  ?.  &(?=(^ params) ?=(%o -.u.params))  ~
  :-  ~
  :*  %pass  /admin-request/[sid]/(scot %ud generation)/[id.call]
      %agent  [our.bowl dap.bowl]  %poke  %harness-effect
      !>(`effect:h`[generation [%admin-call sid id.call u.method u.params]])
  ==
::  +spawn-card: a run_subagent tool call becomes a poke to ourselves
::
++  spawn-card
  |=  [sid=session-id:h generation=@ud call=tool-call:h]
  ^-  (unit card)
  =/  parsed  (de:json:html args.call)
  ?~  parsed  ~
  ?.  ?=([%o *] u.parsed)  ~
  =/  prompt  (~(get by p.u.parsed) 'prompt')
  ?.  ?=([~ %s *] prompt)  ~
  =/  system=(unit @t)
    =/  value  (~(get by p.u.parsed) 'system')
    ?:(?=([~ %s *] value) `p.u.value ~)
  :-  ~
  :*  %pass  `wire`[%spawn `@ta`sid `@ta`id.call ~]
      %agent  [our.bowl dap.bowl]  %poke
      %harness-effect  !>(`effect:h`[generation [%spawn sid id.call p.u.prompt system]])
  ==
::
++  give-http
  |=  [eyre-id=@ta [status=@ud headers=header-list:http] body=(unit octs)]
  ^-  (list card)
  =/  target=path  /http-response/[eyre-id]
  :~  :*  %give  %fact  ~[target]
          %http-response-header  !>(`response-header:http`[status headers])
      ==
      [%give %fact ~[target] %http-response-data !>(body)]
      [%give %kick ~[target] ~]
  ==
--

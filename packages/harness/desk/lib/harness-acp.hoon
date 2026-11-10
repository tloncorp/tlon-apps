::  ACP presentation adapter. Given our identity, encode frames and Gall cards;
::  no session maps, prompt ownership, credentials or scheduling live here.
::  The agent admits commands and settles prompts; this door only speaks ACP.
/-  h=harness, ac=acp
/+  hl=harness, policy=harness-defaults, admin=harness-admin
|_  our=@p
+$  card  card:agent:gall
++  acp-open-card
  ^-  card
  :*  %pass  /acp/open
      %agent  [our %acp]  %poke  %acp-action-1
      !>(`action:v1:ac`[%open acp-id:policy])
  ==
++  acp-watch-card
  ^-  card
  [%pass /acp/watch %agent [our %acp] %watch /v1/agent]
++  acp-action-card
  |=  [=wire action=action:v1:ac]
  ^-  card
  [%pass wire %agent [our %acp] %poke %acp-action-1 !>(action)]
++  acp-send-card
  |=  [connection=connection-id:v1:ac payload=@t]
  ^-  card
  ::  Local administrative tool requests reuse ACP method semantics, not a
  ::  browser connection. Both the head and adapters return through this path.
  ?^  (decode:admin connection)
    [%pass /admin/result %agent [our %harness] %poke %harness-admin-result !>([connection payload])]
  (acp-action-card /acp/send [%send connection %client payload])
++  acp-ack-card
  |=  [connection=connection-id:v1:ac through=@ud]
  ^-  card
  (acp-action-card /acp/ack [%ack connection %agent through])
::
++  acp-initialize-result
  ^-  json
  =/  prompt-capabilities=json
    %-  pairs:enjs:format
    :~  ['image' %b |]
        ['audio' %b |]
        ['embeddedContext' %b |]
    ==
  =/  mcp-capabilities=json
    %-  pairs:enjs:format
    :~  ['http' %b |]
        ['sse' %b |]
    ==
  =/  capabilities=json
    %-  pairs:enjs:format
    :~  ['loadSession' %b &]
        ['promptCapabilities' prompt-capabilities]
        ['mcpCapabilities' mcp-capabilities]
        :-  'sessionCapabilities'
        %-  pairs:enjs:format
        :~  ['list' (pairs:enjs:format ~)]
            ['resume' (pairs:enjs:format ~)]
            ['close' (pairs:enjs:format ~)]
            ['delete' (pairs:enjs:format ~)]
        ==
        ['auth' (pairs:enjs:format ~)]
    ==
  =/  info=json
    %-  pairs:enjs:format
    :~  ['name' %s 'urbit-harness']
        ['title' %s 'Urbit Agent Harness']
        ['version' %s '0.1.0']
    ==
  %-  pairs:enjs:format
  :~  ['protocolVersion' (numb:enjs:format 1)]
      ['agentCapabilities' capabilities]
      ['authMethods' %a ~]
      ['agentInfo' info]
      :-  '_meta'
      %-  pairs:enjs:format
      :~  :-  'harness/hand'
          %-  pairs:enjs:format
          :~  ['version' (numb:enjs:format 2)]
              ['capabilities' %a ~[[%s 'publish']]]
          ==
          :-  'harness/cron'
          %-  pairs:enjs:format
          :~  ['version' (numb:enjs:format 1)]
              ['capabilities' %a ~[[%s 'prompt'] [%s 'reminder']]]
          ==
      ==
  ==
::
++  acp-result-card
  |=  [connection=connection-id:v1:ac id=json result=json]
  ^-  card
  =/  frame=json
    %-  pairs:enjs:format
    :~  ['jsonrpc' %s '2.0']
        ['id' id]
        ['result' result]
    ==
  (acp-send-card connection (en:json:html frame))
++  acp-error-card
  |=  [connection=connection-id:v1:ac id=json code=@t message=@t]
  ^-  card
  =/  error=json
    %-  pairs:enjs:format
    :~  ['code' %n code]
        ['message' %s message]
    ==
  =/  frame=json
    %-  pairs:enjs:format
    :~  ['jsonrpc' %s '2.0']
        ['id' id]
        ['error' error]
    ==
  (acp-send-card connection (en:json:html frame))
++  acp-update-card
  |=  [connection=connection-id:v1:ac sid=session-id:h text=@t]
  ^-  card
  =/  update  (acp-text-update 'agent_message_chunk' text)
  (acp-session-update-card connection sid update)
++  acp-stream-card
  |=  [connection=connection-id:v1:ac sid=session-id:h revision=@ud offset=@ud text=@t]
  ^-  card
  =/  update
    %-  pairs:enjs:format
    :~  ['sessionUpdate' %s 'harness_agent_stream_chunk']
        ['revision' (numb:enjs:format revision)]
        ['offset' (numb:enjs:format offset)]
        ['content' (acp-text-content text)]
    ==
  (acp-session-update-card connection sid update)
::  Message chunks share a text payload; their update tags remain distinct.
++  acp-text-content
  |=  text=@t
  ^-  json
  %-  pairs:enjs:format
  :~  ['type' %s 'text']
      ['text' %s text]
  ==
++  acp-text-update
  |=  [kind=@t text=@t]
  ^-  json
  %-  pairs:enjs:format
  :~  ['sessionUpdate' %s kind]
      ['content' (acp-text-content text)]
  ==
++  acp-session-update-card
  |=  [connection=connection-id:v1:ac sid=session-id:h update=json]
  ^-  card
  =/  params=json
    %-  pairs:enjs:format
    :~  ['sessionId' %s sid]
        ['update' update]
    ==
  =/  frame=json
    %-  pairs:enjs:format
    :~  ['jsonrpc' %s '2.0']
        ['method' %s 'session/update']
        ['params' params]
    ==
  (acp-send-card connection (en:json:html frame))
++  acp-tool-call-card
  |=  [connection=connection-id:v1:ac sid=session-id:h call=tool-call:h]
  ^-  card
  =/  parsed  (de:json:html args.call)
  =/  raw-input=json
    ?~  parsed
      (pairs:enjs:format ~[['raw' %s args.call]])
    u.parsed
  =/  update=json
    %-  pairs:enjs:format
    :~  ['sessionUpdate' %s 'tool_call']
        ['toolCallId' %s id.call]
        ['title' %s name.call]
        ['status' %s 'in_progress']
        ['rawInput' raw-input]
    ==
  (acp-session-update-card connection sid update)
++  acp-tool-result-card
  |=  [connection=connection-id:v1:ac sid=session-id:h call-id=@t body=@t]
  ^-  card
  =/  text=json
    (acp-text-content body)
  =/  content=json
    %-  pairs:enjs:format
    :~  ['type' %s 'content']
        ['content' text]
    ==
  =/  update=json
    %-  pairs:enjs:format
    :~  ['sessionUpdate' %s 'tool_call_update']
        ['toolCallId' %s call-id]
        ['status' %s ?:(|((is-cancelled:hl body) (is-error:hl body)) 'failed' 'completed')]
        ['content' %a ~[content]]
    ==
  (acp-session-update-card connection sid update)
++  acp-item-cards
  |=  [connection=connection-id:v1:ac sid=session-id:h cursor=@ud items=(list item:h)]
  ^-  (list card)
  %-  zing
  %+  turn  (slag cursor items)
  |=  item=item:h
  ^-  (list card)
  ?-  -.item
    %reasoning  ~
      %user
    =/  update  (acp-text-update 'user_message_chunk' body.item)
    ~[(acp-session-update-card connection sid update)]
      %assistant
    =/  message-cards=(list card)
      ?:(=(0 body.item) ~ ~[(acp-update-card connection sid body.item)])
    %+  weld  message-cards
    %+  turn  calls.item
    |=  call=tool-call:h
    (acp-tool-call-card connection sid call)
      %tool
    ~[(acp-tool-result-card connection sid call-id.item body.item)]
  ==
::
++  acp-param-string
  |=  [params=(unit json) key=@t]
  ^-  (unit @t)
  ?.  ?=([~ %o *] params)  ~
  =/  value  (~(get by p.u.params) key)
  ?:(?=([~ %s *] value) `p.u.value ~)
++  acp-param-json
  |=  [params=(unit json) key=@t]
  ^-  (unit json)
  ?.  ?=([~ %o *] params)  ~
  (~(get by p.u.params) key)
++  acp-param-number
  |=  [params=(unit json) key=@t]
  ^-  (unit @ud)
  =/  value  (acp-param-json params key)
  ?.  ?=([~ %n *] value)  ~
  (rush p.u.value dem)
++  acp-prompt-text
  |=  params=(unit json)
  ^-  (unit @t)
  ?.  ?=([~ %o *] params)  ~
  =/  prompt  (~(get by p.u.params) 'prompt')
  ?.  ?=([~ %a *] prompt)  ~
  =/  pieces=(list @t)
    %+  murn  p.u.prompt
    |=  block=json
    ^-  (unit @t)
    ?.  ?=([%o *] block)  ~
    =/  type  (~(get by p.block) 'type')
    ?.  ?=([~ %s *] type)  ~
    ?:  =('text' p.u.type)
      =/  text  (~(get by p.block) 'text')
      ?:(?=([~ %s *] text) `p.u.text ~)
    ?:  =('resource_link' p.u.type)
      =/  name  (~(get by p.block) 'name')
      =/  uri  (~(get by p.block) 'uri')
      ?.  &(?=([~ %s *] name) ?=([~ %s *] uri))  ~
      `(rap 3 '[resource ' p.u.name ': ' p.u.uri ']' ~)
    ~
  ?~  pieces  ~
  `(rap 3 (turn pieces |=(piece=@t (cat 3 piece '\0a'))))
::
++  acp-stop-reason
  |=  log=(list event:h)
  ^-  @t
  ?~  log  'end_turn'
  ?:  ?=(%command-completed -.i.log)  'end_turn'
  ?:  ?=(%checkpoint-completed -.i.log)  'end_turn'
  ?:  ?=(%llm-completed -.i.log)
    ?:(=(%length stop.i.log) 'max_tokens' 'end_turn')
  $(log t.log)
--

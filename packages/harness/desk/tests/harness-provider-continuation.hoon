/-  h=harness
/+  *test, hp=harness-provider, a=harness-anthropic, w=harness-provider-wire, auth=harness-auth,
    store=harness-store
|%
++  native  'https://api.anthropic.com/v1/messages'
++  router  'https://openrouter.ai/api/v1/chat/completions'
++  cfg
  ^-  config:h
  =/  c=config:h  *config:h
  c(url native, model 'claude-sonnet-4-6', tools ~)
++  native-body
  '{"type":"message","role":"assistant","content":[{"type":"thinking","thinking":"Plan","signature":"SIGNED"},{"type":"redacted_thinking","data":"OPAQUE"},{"type":"text","text":"Checking."},{"type":"tool_use","id":"call_time","name":"current_time","input":{}}],"stop_reason":"tool_use","usage":{"input_tokens":10,"cache_read_input_tokens":20,"cache_creation_input_tokens":3,"output_tokens":5}}'
++  native-stream
  %+  rap  3
  :~
    'data: {"type":"message_start","message":{"type":"message","role":"assistant","content":[],"stop_reason":null,"usage":{"input_tokens":10,"cache_read_input_tokens":20,"cache_creation_input_tokens":3,"output_tokens":0}}}\0a\0a'
    'data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":"","signature":""}}\0a\0a'
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"Plan"}}\0a\0a'
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"SIG"}}\0a\0a'
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"NED"}}\0a\0a'
    'data: {"type":"content_block_stop","index":0}\0a\0a'
    'data: {"type":"content_block_start","index":1,"content_block":{"type":"redacted_thinking","data":"OPAQUE"}}\0a\0a'
    'data: {"type":"content_block_stop","index":1}\0a\0a'
    'data: {"type":"content_block_start","index":2,"content_block":{"type":"text","text":""}}\0a\0a'
    'data: {"type":"content_block_delta","index":2,"delta":{"type":"text_delta","text":"Checking."}}\0a\0a'
    'data: {"type":"content_block_stop","index":2}\0a\0a'
    'data: {"type":"content_block_start","index":3,"content_block":{"type":"tool_use","id":"call_time","name":"current_time","input":{}}}\0a\0a'
    'data: {"type":"content_block_delta","index":3,"delta":{"type":"input_json_delta","partial_json":"{"}}\0a\0a'
    'data: {"type":"content_block_delta","index":3,"delta":{"type":"input_json_delta","partial_json":"}"}}\0a\0a'
    'data: {"type":"content_block_stop","index":3}\0a\0a'
    'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":5}}\0a\0a'
    'data: {"type":"message_stop"}\0a\0a'
  ==
++  chat-body
  '{"choices":[{"finish_reason":"tool_calls","message":{"role":"assistant","content":"Checking.","reasoning":"Plan","reasoning_details":[{"type":"reasoning.text","text":"Plan","signature":"SIGNED","index":0},{"type":"reasoning.encrypted","data":"OPAQUE","index":1}],"tool_calls":[{"id":"call_time","type":"function","function":{"name":"current_time","arguments":"{}"}}]}}]}'
++  chat-stream
  %+  rap  3
  :~
    'data: {"choices":[{"delta":{"reasoning_details":[{"type":"reasoning.text","text":"Pl","signature":"SIG","index":0}]}}]}\0a\0a'
    'data: {"choices":[{"delta":{"reasoning_details":[{"type":"reasoning.text","text":"an","signature":"NED","index":0},{"type":"reasoning.encrypted","data":"OPA","index":1}]}}]}\0a\0a'
    'data: {"choices":[{"delta":{"reasoning_details":[{"type":"reasoning.encrypted","data":"QUE","index":1}]}}]}\0a\0a'
    'data: {"choices":[{"delta":{"content":"Checking.","tool_calls":[{"index":0,"id":"call_time","function":{"name":"current_time","arguments":"{}"}}]},"finish_reason":"tool_calls"}]}\0a\0a'
    'data: [DONE]\0a\0a'
  ==
++  test-native-stream-reassembles-signed-blocks-and-usage
  =/  parsed  (digest:hp native native-stream)
  ?>  ?=(%& -.parsed)
  =/  direct  (digest:hp native native-body)
  ?>  ?=(%& -.direct)
  ;:  weld
      (expect-eq !>((need (de:json:html native-body))) !>((response:a native-stream)))
      (expect-eq !>(p.direct) !>(p.parsed))
      (expect-eq !>([33 5]) !>(u.p.parsed))
      (expect-eq !>('Checking.') !>((display-text:hp native native-stream)))
      %+  expect-eq
        !>((continuation:hp native native-body))
      !>((continuation:hp native native-stream))
  ==
++  test-chat-details-reassemble-without-duplicating-text-projection
  ;:  weld
      (expect-eq !>((continuation:hp router chat-body)) !>((continuation:hp router chat-stream)))
      (expect-eq !>((digest:hp router chat-body)) !>((digest:hp router chat-stream)))
  ==
++  test-generic-chat-reasoning-fields-are-optional-and-streamable
  %-  zing
  %+  turn  `(list @t)`~['reasoning' 'reasoning_content']
  |=  field=@t
  =/  body
    %:  rap
      3
      'data: {"choices":[{"delta":{"'
      field
      '":"one "}}]}\0adata: {"choices":[{"delta":{"'
      field
      '":"two"}}]}\0a'
      ~
    ==
  ;:  weld
      %+  expect-eq
        !>((en:json:html (pairs:enjs:format ~[[field %s 'one two']])))
      !>((continuation:hp 'https://example.test/chat/completions' body))
      %+  expect-eq
        !>('')
      !>((continuation:hp router '{"choices":[{"message":{"content":"hello"}}]}'))
  ==
++  test-details-use-ids-without-indices-and-retain-signatures
  =/  first
    %-  need
    (de:json:html '{"type":"reasoning.text","id":"r1","text":"one ","signature":"SIGNED"}')
  =/  second
    %-  need
    (de:json:html '{"type":"reasoning.text","id":"r1","text":"two","signature":null}')
  =/  expected
    %-  need
    %-  de:json:html
    '{"type":"reasoning.text","id":"r1","text":"one two","signature":"SIGNED"}'
  (expect-eq !>(`(list json)`~[expected]) !>((details:w ~[first] ~[second])))
++  test-native-open-block-and-truncated-tool-cannot-complete
  =/  open
    'data: {"type":"message_start","message":{"type":"message","content":[]}}\0adata: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"c","name":"current_time","input":{}}}\0adata: {"type":"message_stop"}\0a'
  =/  limited  (put:w (need (de:json:html native-body)) 'stop_reason' [%s 'max_tokens'])
  ;:  weld
      (expect-eq !>(~) !>((mole |.((digest:hp native open)))))
      (expect-eq !>(~) !>((mole |.((digest:hp native (en:json:html limited))))))
  ==
++  continued
  |=  [url=@t raw=@t]
  ^-  view:h
  =/  cfg=config:h  cfg
  =/  parsed  (digest:hp url raw)
  ?>  ?=(%& -.parsed)
  =/  v=view:h  *view:h
  %=  v  config  cfg(url url)  items
      :~  [%user 'Time?']  [%reasoning url model.cfg (continuation:hp url raw)]  it.p.parsed
          [%tool 'call_time' 'current_time' '12:00 UTC']
      ==
  ==
++  test-native-request-preserves-content-and-maps-tools
  =/  v  (continued native native-stream)
  =/  body  (payload:hp v %turn ~)
  =/  messages  (need (get:w body 'messages'))
  ?>  ?=(%a -.messages)
  =/  original  (need (de:json:html native-body))
  =/  tools  (need (get:w body 'tools'))
  ?>  ?=([%a ^] tools)
  =/  result  (need (get:w (snag 2 p.messages) 'content'))
  ?>  ?=([%a ^] result)
  ;:  weld
      (expect-eq !>((get:w original 'content')) !>((get:w (snag 1 p.messages) 'content')))
      (expect-eq !>('tool_result') !>((str:w i.p.result 'type')))
      (expect-eq !>('call_time') !>((str:w i.p.result 'tool_use_id')))
      (expect !>(?=(^ (get:w i.p.tools 'input_schema'))))
      (expect-eq !>(~) !>((get:w i.p.tools 'function')))
      (expect !>(?=(^ (get:w body 'system'))))
  ==
++  test-continuations-do-not-cross-routes-models-or-compaction
  ^-  tang
  =/  cfg=config:h  cfg
  =/  v  (continued router chat-stream)
  =/  messages  (need (get:w (payload:hp v %turn ~) 'messages'))
  ?>  ?=(%a -.messages)
  =/  assistant  (snag 2 p.messages)
  =/  others=(list json)
    :~  (payload:hp v(config cfg(url router, model 'different')) %turn ~)
        (payload:hp v(config cfg(url 'https://example.test/chat/completions')) %turn ~)
        (payload:hp v %compaction ~)
    ==
  =/  checks=tang
    %-  zing
    %+  turn  others
    |=  body=json
    ^-  tang
    =/  messages  (need (get:w body 'messages'))
    ?>  ?=(%a -.messages)
    (expect !>((levy p.messages |=(msg=json =(~ (get:w msg 'reasoning_details'))))))
  (weld (expect !>(?=(^ (get:w assistant 'reasoning_details')))) checks)
++  test-parallel-tool-results-share-one-user-message
  =/  v  (continued native native-body)
  =.  items.v  (snoc items.v [%tool 'second' 'calculate' '42'])
  =/  messages  (need (get:w (payload:hp v %turn ~) 'messages'))
  ?>  ?=(%a -.messages)
  =/  content  (need (get:w (rear p.messages) 'content'))
  ?>  ?=(%a -.content)
  ;:  weld
      (expect-eq !>(3) !>((lent p.messages)))
      (expect-eq !>(2) !>((lent p.content)))
  ==
++  test-native-incomplete-stream-and-unsigned-thinking-are-rejected
  =/  incomplete
    %^  cat
      3
      'data: {"type":"message_start","message":{"type":"message","content":[]}}\0a'
    ''
  =/  unsigned
    '{"type":"message","content":[{"type":"thinking","thinking":"plan","signature":""}]}'
  =/  error
    %+  digest:hp
      native
    'data: {"type":"error","error":{"type":"overloaded_error","message":"busy"}}\0a'
  ;:  weld
      (expect-eq !>(~) !>((mole |.((response:a incomplete)))))
      (expect-eq !>(~) !>((mole |.((continuation:hp native unsigned)))))
      (expect !>(?=(%| -.error)))
  ==
++  test-native-auth-separates-api-key-and-subscription
  =/  cfg=config:h  cfg
  =/  api
    %^  request-headers:auth
      ~
      cfg(headers ~[['authorization' 'stale'] ['x-api-key' 'stale']])
    'API'
  =/  sub  (request-headers:auth ~ cfg(headers ~[['anthropic-beta' 'oauth-2025-04-20']]) 'TOKEN')
  ;:  weld
      (expect !>((lien api |=([name=@t value=@t] =(['x-api-key' 'API'] [name value])))))
      (expect !>((levy api |=([name=@t value=@t] !=('authorization' name)))))
      %-  expect
      !>((lien api |=([name=@t value=@t] =(['anthropic-version' '2023-06-01'] [name value]))))
      %-  expect
      !>((lien sub |=([name=@t value=@t] =(['authorization' 'Bearer TOKEN'] [name value]))))
      (expect !>((levy sub |=([name=@t value=@t] !=('x-api-key' name)))))
  ==
++  test-anthropic-endpoint-migration-preserves-config
  =/  cfg=config:h  cfg
  =/  old
    %=  cfg  url  'https://api.anthropic.com/v1/chat/completions'  key  'PRIVATE'  headers
        ~[['anthropic-beta' 'oauth-2025-04-20']]
    ==
  =/  migrated  (migrate-config:store old)
  ;:  weld
      (expect-eq !>(old(url native)) !>(migrated))
      (expect-eq !>(migrated) !>((migrate-config:store migrated)))
  ==
--

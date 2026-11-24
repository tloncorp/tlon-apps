::  Native Messages JSON and SSE. Transport, credentials and session state
::  remain outside this codec; signed thinking blocks are opaque continuations.
/+  w=harness-provider-wire, failure=harness-failure
/+  stream=harness-anthropic-stream
|%
++  request
  |=  chat=json
  ^-  json
  =/  messages  (need (get:w chat 'messages'))
  ?>  ?=(%a -.messages)
  =/  system
    %+  rap  3
    %+  murn  p.messages
    |=  message=json
    ?.  =('system' (str:w message 'role'))  ~
    `(cat 3 (str:w message 'content') '\0a\0a')
  =/  ordinary
    (skim p.messages |=(message=json !=('system' (str:w message 'role'))))
  =/  base=json
    %-  pairs:enjs:format
    :~  ['model' (need (get:w chat 'model'))]
        ['system' %s system]
        ['messages' %a (group (turn ordinary message))]
        ['max_tokens' (need (get:w chat 'max_tokens'))]
        ['stream' %b &]
    ==
  =/  tools  (get:w chat 'tools')
  ?.  ?=([~ %a *] tools)  base
  %^  put:w  base  'tools'
  :-  %a
  %+  turn  p.u.tools
  |=  entry=json
  =/  function  (need (get:w entry 'function'))
  %-  pairs:enjs:format
  :~  ['name' (need (get:w function 'name'))]
      ['description' (need (get:w function 'description'))]
      ['input_schema' (need (get:w function 'parameters'))]
  ==
::
++  message
  |=  chat=json
  ^-  json
  =/  role  (str:w chat 'role')
  =/  content  (get:w chat 'content')
  ::  A matching continuation already contains the exact native block order.
  ?:  ?=([~ %a *] content)
    (pairs:enjs:format ~[['role' %s role] ['content' u.content]])
  =/  blocks=(list json)
    ?:  =('tool' role)
      :_  ~
      %-  pairs:enjs:format
      :~  ['type' %s 'tool_result']
          ['tool_use_id' (need (get:w chat 'tool_call_id'))]
          ['content' %s (str:w chat 'content')]
      ==
    =/  text  (str:w chat 'content')
    ?:(=('' text) ~ ~[(pairs:enjs:format ~[['type' %s 'text'] ['text' %s text]])])
  =/  calls  (get:w chat 'tool_calls')
  =?  blocks  ?=([~ %a *] calls)
    %+  weld  blocks
    %+  turn  p.u.calls
    |=  call=json
    =/  function  (need (get:w call 'function'))
    =/  input  (need (de:json:html (str:w function 'arguments')))
    ?>  ?=(%o -.input)
    %-  pairs:enjs:format
    :~  ['type' %s 'tool_use']
        ['id' (need (get:w call 'id'))]
        ['name' (need (get:w function 'name'))]
        ['input' input]
    ==
  %-  pairs:enjs:format
  :~  ['role' %s ?:(=('tool' role) 'user' role)]
      ['content' %a blocks]
  ==
::  Parallel tool results belong to one user message, immediately after the
::  assistant's tool-use blocks. Adjacent user context follows those results.
::
++  group
  |=  messages=(list json)
  ^-  (list json)
  ?~  messages  ~
  ?~  t.messages  messages
  ?.  =((str:w i.messages 'role') (str:w i.t.messages 'role'))
    [i.messages $(messages t.messages)]
  =/  first  (need (get:w i.messages 'content'))
  =/  second  (need (get:w i.t.messages 'content'))
  ?>  &(?=(%a -.first) ?=(%a -.second))
  =/  joined  (put:w i.messages 'content' [%a (weld p.first p.second)])
  $(messages [joined t.t.messages])
::
++  stream-text
  |=  body=@t
  ^-  @t
  %+  rap  3
  %+  turn  (events:w body)
  |=  event=json
  ?:  =('content_block_start' (str:w event 'type'))
    =/  block  (fall (get:w event 'content_block') ~)
    ?:(=('text' (str:w block 'type')) (str:w block 'text') '')
  ?.  =('content_block_delta' (str:w event 'type'))  ''
  =/  delta  (fall (get:w event 'delta') ~)
  ?:(=('text_delta' (str:w delta 'type')) (str:w delta 'text') '')
::  Collect complete blocks, including streamed signatures and tool arguments.
::  Require message_stop and closed blocks before accepting any tool calls.
::
++  response
  |=  body=@t
  ^-  json
  =/  direct  (de:json:html body)
  ?^  direct  u.direct
  =/  events  (events:w body)
  =/  collected  (roll events collect-event:stream)
  ?^  error.collected
    (pairs:enjs:format ~[['error' %s u.error.collected]])
  ?>  ?&  =(~ opened.collected)
          (lien events |=(event=json =('message_stop' (str:w event 'type'))))
      ==
  =/  ordered
    %+  sort  ~(tap by blocks.collected)
    |=  [a=[@ud json] b=[@ud json]]
    (lth -.a -.b)
  %^  put:w  message.collected  'content'
  [%a (turn ordered |=([index=@ud block=json] block))]
::
::  Project native output into the common chat decoder without exposing
::  thinking. The original content array is stored separately for replay.
::
++  chat-response
  |=  message=json
  ^-  json
  =/  error  (wire-error:failure message)
  ?^  error  (pairs:enjs:format ~[['error' %s u.error]])
  ?>  =('message' (str:w message 'type'))
  =/  content  (need (get:w message 'content'))
  ?>  ?=(%a -.content)
  =/  text
    %+  rap  3
    %+  turn  p.content
    |=  block=json
    ?:(=('text' (str:w block 'type')) (str:w block 'text') '')
  =/  calls
    %+  murn  p.content
    |=  block=json
    ^-  (unit json)
    ?.  =('tool_use' (str:w block 'type'))  ~
    =/  input  (need (get:w block 'input'))
    ?>  ?&  ?=(%o -.input)
            !=('' (str:w block 'id'))
            !=('' (str:w block 'name'))
        ==
    :-  ~
    %-  pairs:enjs:format
    :~  ['id' (need (get:w block 'id'))]
        ['type' %s 'function']
        :-  'function'
        %-  pairs:enjs:format
        :~  ['name' (need (get:w block 'name'))]
            ['arguments' %s (en:json:html input)]
        ==
    ==
  =/  stop  (str:w message 'stop_reason')
  ?>  !=('' stop)
  ?>  |(!=('' text) !=(~ calls) =('max_tokens' stop))
  =/  finish=@t
    ?:  =('tool_use' stop)  'tool_calls'
    ?:  =('max_tokens' stop)  'length'
    ?:  (lien `(list @t)`~['end_turn' 'stop_sequence' 'refusal'] |=(s=@t =(s stop)))  'stop'
    'error'
  ::  Do not execute a tool whose generation ends at the output limit.
  ?>  |(=(~ calls) =('tool_use' stop))
  =/  usage  (fall (get:w message 'usage') [%o ~])
  =/  input
    ;:  add
        (num:w usage 'input_tokens')
        (num:w usage 'cache_read_input_tokens')
        (num:w usage 'cache_creation_input_tokens')
    ==
  =/  assistant
    %-  pairs:enjs:format
    :~  ['role' %s 'assistant']
        ['content' %s text]
        ['tool_calls' %a calls]
    ==
  =/  choice
    (pairs:enjs:format ~[['finish_reason' %s finish] ['message' assistant]])
  %-  pairs:enjs:format
  :~  ['choices' %a ~[choice]]
      :-  'usage'
      %-  pairs:enjs:format
      :~  ['prompt_tokens' (numb:enjs:format input)]
          ['completion_tokens' (numb:enjs:format (num:w usage 'output_tokens'))]
      ==
  ==
::
++  continuation
  |=  message=json
  ^-  @t
  =/  content  (get:w message 'content')
  ?.  ?=([~ %a *] content)  ''
  =/  thinking
    %+  lien  p.u.content
    |=  block=json
    |(=('thinking' (str:w block 'type')) =('redacted_thinking' (str:w block 'type')))
  ?.  thinking  ''
  ?>  %+  levy  p.u.content
      |=  block=json
      ?:  =('thinking' (str:w block 'type'))  !=('' (str:w block 'signature'))
      ?:  =('redacted_thinking' (str:w block 'type'))  !=('' (str:w block 'data'))
      &
  (en:json:html (pairs:enjs:format ~[['content' u.content]]))
--

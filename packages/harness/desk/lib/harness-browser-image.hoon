::  Browser computer receipts enter the ledger as text. Pixels accompany
::  the matching tool message only while the originating turn is active.
/-  h=harness
/+  w=harness-provider-wire, mcp=harness-mcp, ht=harness-tools
|%
++  limit  2.097.152
++  tool
  |=  call=tool-call:h
  ^-  (unit @t)
  ?.  =('call_mcp_tool' name.call)  ~
  =/  args  (de:json:html args.call)
  ?~  args  ~
  ?.  =('kernel-browser' (str:w u.args 'server'))  ~
  `(str:w u.args 'name')
++  computer
  |=  name=(unit @t)
  ^-  ?
  ?~  name  |
  %-  lien
  :_  |=(candidate=@t =(candidate u.name))
  ^-  (list @t)
  :~  'kernel_computer_screenshot'  'kernel_computer_click'
      'kernel_computer_type'  'kernel_computer_key'  'kernel_computer_scroll'
      'kernel_computer_move'  'kernel_computer_drag'
  ==
++  receipt
  |=  body=@t
  ^-  [body=@t image=(unit [mime=@t data=@t])]
  ?:  (gth (met 3 body) limit)  ['error: Browser screenshot exceeds 2 MiB.' ~]
  ?.  =('HTTP 200\0a\0a' (end 3^10 body))  [(clip:ht body 2.000) ~]
  =/  parsed  (mole |.((rpc:mcp (rsh 3^10 body))))
  ?~  parsed  ['error: Invalid browser screenshot reply.' ~]
  =/  result  (get:w u.parsed 'result')
  ?~  result  [(clip:ht (str:w (fall (get:w u.parsed 'error') ~) 'message') 2.000) ~]
  =/  content  (get:w u.result 'content')
  ?.  ?=([~ %a *] content)  ['error: Invalid browser screenshot content.' ~]
  =/  text
    %+  roll  p.u.content
    |=  [part=json text=@t]
    ?.  =('text' (str:w part 'type'))  text
    (clip:ht (rap 3 text ?:(=('' text) '' '\0a') (str:w part 'text') ~) 2.000)
  ?:  =(`[%b %.y] (get:w u.result 'isError'))  [text ~]
  =/  images
    (skim p.u.content |=(part=json =('image' (str:w part 'type'))))
  ?.  ?=([* ~] images)  ['error: Browser reply did not contain a screenshot.' ~]
  =/  mime  (str:w i.images 'mimeType')
  =/  data  (str:w i.images 'data')
  ?.  |(=(mime 'image/png') =(mime 'image/jpeg'))
    ['error: Unsupported browser screenshot format.' ~]
  ?:  =('' data)  ['error: Empty browser screenshot.' ~]
  [text `[mime data]]
++  attach
  |=  [payload=json call-id=@t mime=@t data=@t supported=?]
  ^-  json
  =/  messages  (get:w payload 'messages')
  ?.  ?=([~ %a *] messages)  payload
  =/  updated=(list json)
    =/  rest  (flop p.u.messages)
    =|  later=(list json)
    |-
    ?~  rest  p.u.messages
    =/  message  i.rest
    ?.  =(['tool' call-id] [(str:w message 'role') (str:w message 'tool_call_id')])
      $(rest t.rest, later [message later])
    =/  text  (str:w message 'content')
    =/  content=json
      ?.  supported
        [%s (cat 3 text ' Screenshot image input is unavailable on this route.')]
      :-  %a
      :~  (pairs:enjs:format ~[['type' %s 'text'] ['text' %s text]])
          %-  pairs:enjs:format
          :~  ['type' %s 'image_url']
              ['image_url' (pairs:enjs:format ~[['url' %s (rap 3 'data:' mime ';base64,' data ~)]])]
          ==
      ==
    (weld (flop t.rest) [(put:w message 'content' content) later])
  (put:w payload 'messages' [%a updated])
--

::  Bounded MCP discovery. Catalogs contain summaries; a named lookup retains
::  the complete tool definition. No catalog cache or additional authority.
/+  w=harness-provider-wire, catalog-lib=harness-tool-catalog
|%
++  params
  |=  args=@t
  ^-  json
  =/  input  (need (de:json:html args))
  =/  cursor  (str:w input 'cursor')
  (pairs:enjs:format ?:(=('' cursor) ~ ~[['cursor' %s cursor]]))
++  receipt
  |=  [args=@t body=@t]
  ^-  @t
  ?.  =('HTTP 200\0a\0a' (end 3^10 body))  body
  ?:  (gth (met 3 body) 262.154)
    'error: MCP catalog exceeds 256 KiB; the server must paginate tools/list'
  =/  projected  (mole |.((catalog args (rsh 3^10 body))))
  ?~  projected  'error: Invalid MCP catalog or discovery arguments'
  =/  encoded  (en:json:html u.projected)
  (cat 3 'HTTP 200\0a\0a' encoded)
++  catalog
  |=  [args=@t body=@t]
  ^-  json
  =/  input  (need (de:json:html args))
  =/  reply  (rpc body)
  ?^  (get:w reply 'error')  reply
  =/  result  (need (get:w reply 'result'))
  =/  tools  (need (get:w result 'tools'))
  ?>  ?=(%a -.tools)
  (put:w reply 'result' (select:catalog-lib input tools (str:w result 'nextCursor')))
::
++  rpc
  |=  body=@t
  ^-  json
  =/  decoded  (de:json:html body)
  ?^  decoded
    ?>  =(`[%n '1'] (get:w u.decoded 'id'))
    u.decoded
  =/  replies
    (skim (events:w body) |=(event=json =(`[%n '1'] (get:w event 'id'))))
  ?>  =(1 (lent replies))
  (snag 0 replies)
::
++  browser-session
  |=  [body=@t released=?]
  ^-  @t
  ?.  =('HTTP 200\0a\0a' (end 3^10 body))  body
  =/  parsed  (mole |.((rpc (rsh 3^10 body))))
  ?~  parsed  'error: Invalid browser session reply.'
  =/  reply  u.parsed
  =/  result  (get:w reply 'result')
  ?~  result  body
  ?:  released
    =/  content  (get:w u.result 'content')
    ?.  ?=([~ %a *] content)  body
    =.  p.u.content
      %+  turn  p.u.content
      |=  part=json
      ?.  =('text' (str:w part 'type'))  part
      =/  text  (str:w part 'text')
      =/  kept
        %+  skip  (lines:w text)
        |=(line=tape =("- Session dashboard: " (scag 21 line)))
      =/  safe  (crip (zing (join (trip '\0a') kept)))
      (put:w part 'text' [%s safe])
    (encode-receipt (put:w reply 'result' (put:w u.result 'content' u.content)))
  =/  details  (get:w u.result 'structuredContent')
  ?.  ?=([~ %o *] details)  body
  ?.  (~(has by p.u.details) 'viewer_url')  body
  =.  p.u.details  (~(del by p.u.details) 'viewer_url')
  (encode-receipt (put:w reply 'result' (put:w u.result 'structuredContent' u.details)))
++  encode-receipt
  |=  reply=json
  (cat 3 'HTTP 200\0a\0a' (en:json:html reply))
--

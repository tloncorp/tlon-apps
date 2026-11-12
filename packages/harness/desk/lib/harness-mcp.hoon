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
  =/  decoded  (de:json:html body)
  =/  rpc=json
    ?^  decoded  u.decoded
    =/  replies
      (skim (events:w body) |=(event=json =(`[%n '1'] (get:w event 'id'))))
    ?>  =(1 (lent replies))
    (snag 0 replies)
  ?>  &(?=(%o -.rpc) =(`[%n '1'] (get:w rpc 'id')))
  ?^  (get:w rpc 'error')  rpc
  =/  result  (need (get:w rpc 'result'))
  =/  tools  (need (get:w result 'tools'))
  ?>  ?=(%a -.tools)
  (put:w rpc 'result' (select:catalog-lib input tools (str:w result 'nextCursor')))
--

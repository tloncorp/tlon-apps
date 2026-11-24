/-  h=harness
/+  *test, mcp=harness-mcp, w=harness-provider-wire, effects=harness-effects,
    catalog=harness-tool-catalog
|%
++  tool
  |=  n=@ud
  ^-  json
  =/  long  (rap 3 (reap 200 'description '))
  %-  pairs:enjs:format
  :~  ['name' %s (cat 3 'tool-' (scot %ud n))]  ['description' %s long]
      ['inputSchema' (pairs:enjs:format ~[['type' %s 'object'] ['description' %s long]])]
  ==
++  source
  |=  [count=@ud cursor=@t]
  ^-  json
  =/  result  (pairs:enjs:format ~[['tools' %a (turn (gulf 0 (dec count)) tool)]])
  =?  result  !=('' cursor)  (put:w result 'nextCursor' [%s cursor])
  (pairs:enjs:format ~[['jsonrpc' %s '2.0'] ['id' %n '1'] ['result' result]])
++  project
  |=  [args=@t raw=json]
  ^-  json
  =/  out  (receipt:mcp args (cat 3 'HTTP 200\0a\0a' (en:json:html raw)))
  ?>  =('HTTP 200\0a\0a' (end 3^10 out))
  (need (get:w (need (de:json:html (rsh 3^10 out))) 'result'))
++  test-large-catalog-lists-all-forty-five-tools-without-schemas
  =/  raw  (source 45 '')
  =/  result  (project '{"server":"local"}' raw)
  =/  tools  (need (get:w result 'tools'))
  ?>  ?=(%a -.tools)
  ;:  weld
      (expect !>((gth (met 3 (en:json:html raw)) 48.000)))
      (expect-eq !>(45) !>((lent p.tools)))
      (expect-eq !>('tool-44') !>((str:w (rear p.tools) 'name')))
      %-  expect
      !>  %+  levy
            p.tools
          |=(row=json &((lte (met 3 (str:w row 'description')) 163) =(~ (get:w row 'inputSchema'))))
      (expect-eq !>(`json`~) !>((need (get:w result 'next'))))
  ==
++  test-named-tool-keeps-complete-description-and-input-schema
  =/  result  (project '{"server":"local","name":"tool-44"}' (source 45 'next-upstream'))
  =/  tools  (need (get:w result 'tools'))
  ?>  ?=(%a -.tools)
  ;:  weld
      (expect-eq !>(`(list json)`~[(tool 44)]) !>(p.tools))
      (expect-eq !>(`json`~) !>((need (get:w result 'next'))))
  ==
++  test-local-pagination-precedes-upstream-pagination
  ::  Small rows keep this fixture within the wire-size bound.
  =/  rows  (turn (gulf 0 64) |=(n=@ud (put:w (tool n) 'description' [%s 'short'])))
  =/  result  (pairs:enjs:format ~[['tools' %a rows] ['nextCursor' %s 'upstream-page-2']])
  =/  raw  (pairs:enjs:format ~[['id' %n '1'] ['result' result]])
  =/  first  (project '{"server":"local","cursor":"upstream-page-1"}' raw)
  =/  next  (need (get:w first 'next'))
  =/  last  (project (en:json:html next) raw)
  =/  following  (need (get:w last 'next'))
  =/  tools  (need (get:w last 'tools'))
  ?>  ?=(%a -.tools)
  ;:  weld
      (expect-eq !>('50') !>((str:w next 'offset')))
      (expect-eq !>('upstream-page-1') !>((str:w next 'cursor')))
      (expect-eq !>('upstream-page-2') !>((str:w following 'cursor')))
      (expect-eq !>('0') !>((str:w following 'offset')))
      (expect-eq !>(15) !>((lent p.tools)))
      (expect-eq !>('tool-64') !>((str:w (rear p.tools) 'name')))
  ==
++  test-sse-catalog-skips-notifications-and-accepts-crlf
  =/  raw  (source 2 '')
  =/  sse
    %:  rap
      3
      'event: message\0d\0adata: {"jsonrpc":"2.0","method":"notifications/tools/list_changed"}\0d\0a\0d\0adata:'
      (en:json:html raw)
      '\0d\0a\0d\0a'
      ~
    ==
  (expect-eq !>((catalog:mcp '{}' (en:json:html raw))) !>((catalog:mcp '{}' sse)))
++  test-schema-lookups-follow-upstream-pages-without-guessing
  =/  result  (project '{"server":"local","name":"missing"}' (source 2 'page2'))
  =/  next  (need (get:w result 'next'))
  ;:  weld
      (expect-eq !>('missing') !>((str:w next 'name')))
      (expect-eq !>('page2') !>((str:w next 'cursor')))
      (expect-eq !>(`json`[%a ~]) !>((need (get:w result 'tools'))))
  ==
++  test-pagination-only-forwards-the-opaque-server-cursor
  =/  run  ~(. effects [*bowl:gall ~])
  =/  payload
    %-  need
    %-  mcp-payload:run
    ['c' 'list_mcp_tools' '{"server":"local","name":"tool-1","cursor":"opaque/+==","offset":"50"}']
  %+  expect-eq
    !>((need (de:json:html '{"cursor":"opaque/+=="}')))
  !>((need (get:w payload 'params')))
++  test-errors-and-oversized-input-do-not-look-like-empty-catalogs
  =/  error  '{"jsonrpc":"2.0","id":1,"error":{"code":-32603,"message":"unavailable"}}'
  =/  huge  (cat 3 'HTTP 200\0a\0a' (rap 3 (reap 263.000 'x')))
  ;:  weld
      (expect-eq !>((need (de:json:html error))) !>((catalog:mcp '{}' error)))
      (expect-eq !>('HTTP 401\0a\0ano access') !>((receipt:mcp '{}' 'HTTP 401\0a\0ano access')))
      (expect !>(=('error:' (end 3^6 (receipt:mcp '{}' huge)))))
      %-  expect
      !>  .=  'error:'
          %+  end
            3^6
          (receipt:mcp '{"offset":"-1"}' (cat 3 'HTTP 200\0a\0a' (en:json:html (source 1 ''))))
  ==
++  test-description-prefix-preserves-utf-eight
  =/  text  (cat 3 (rap 3 (reap 159 'a')) '🙂more')
  (expect-eq !>((cat 3 (rap 3 (reap 159 'a')) '...')) !>((brief:catalog text)))
--

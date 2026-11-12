::  Same-ship MCP discovery and calls use the proxy's aggregate catalog.
/-  h=harness
|%
++  id
  |=  our=@p
  ^-  @t
  (cat 3 (scot %p our) '-mcp')
++  url
  |=  our=@p
  ^-  @t
  (rap 3 'urbit://' (scot %p our) '/mcp-proxy' ~)
++  ensure
  |=  [registry=(map mcp-server-id:h mcp-server:h) seen=@ud our=@p present=?]
  ^-  [seen=@ud registry=(map mcp-server-id:h mcp-server:h)]
  ?.  &(present =(0 seen))  [seen registry]
  ::  Existing custom/disabled entries win. The durable marker also respects
  ::  later removal; polling must not silently recreate a deleted server.
  ?:  (~(has by registry) (id our))  [1 registry]
  [1 (~(put by registry) (id our) [(id our) (url our) ~ &])]
++  request
  |=  [token=@t payload=json]
  ^-  (unit inbound-request:eyre)
  ?:  =('' token)  ~
  =/  req=request:http
    :*  %'POST'  '/apps/mcp/mcp'
        :~  ['host' 'localhost']
            ['content-type' 'application/json']
            ['accept' 'application/json, text/event-stream']
            ['x-api-key' token]
        ==
        `(as-octs:mimes:html (en:json:html payload))
    ==
  `[& | [%ipv4 .127.0.0.1] req]
--

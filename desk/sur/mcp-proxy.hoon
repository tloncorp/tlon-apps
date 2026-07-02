::  mcp-proxy: vendored type subset for the helper-poke that
::  registers %notes with the local mcp-proxy.
::
::  Only the action variants we send (%add-server, %refresh-spec)
::  and the mcp-server record they reference are kept. Full type
::  source: github.com/tloncorp/mcp desk/sur/mcp-proxy.hoon
::
|%
+$  server-id    @tas
+$  header       [key=@t value=@t]
+$  server-mode  ?(%proxy %openapi)
::
+$  tool-filter
  $:  mode=?(%allow %block)
      tools=(set @t)
  ==
::
+$  mcp-server
  $:  name=@t
      url=@t
      headers=(list header)
      enabled=?
      oauth-provider=(unit @tas)
      mode=server-mode
      schema-url=(unit @t)
  ==
::
+$  action
  $%  [%add-server id=server-id =mcp-server]
      [%remove-server id=server-id]
      [%config-oauth-server id=server-id =mcp-server]
      [%update-server id=server-id =mcp-server]
      [%toggle-server id=server-id]
      [%login-server id=server-id]
      [%refresh-spec id=server-id]
      [%set-tool-filter id=server-id =tool-filter]
      [%clear-tool-filter id=server-id]
      [%set-client-key key=@t]
      [%regenerate-client-key ~]
      [%clear-client-key ~]
      [%set-internal-token token=@t]
      [%set-code-mode on=?]
  ==
--

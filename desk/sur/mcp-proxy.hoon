::  mcp-proxy: types for MCP server proxy
::
::  Vendored verbatim from tloncorp/mcp desk/sur/mcp-proxy.hoon. Committed
::  (not peru-vendored) because the backend test harness builds the groups
::  desk from a pill + desk/ overlay and never syncs desk-deps/ — so a
::  peru-only dep would be missing there. Update by copying from upstream.
::
|%
+$  server-id  @tas
::
+$  header  [key=@t value=@t]
::
+$  server-mode  ?(%proxy %openapi)
::
+$  tool-filter
  $:  mode=?(%allow %block)
      tools=(set @t)
  ==
::
::  old types for state migration
+$  mcp-server-0
  $:  name=@t
      url=@t
      headers=(list header)
      enabled=?
  ==
::
+$  mcp-server-1
  $:  name=@t
      url=@t
      headers=(list header)
      enabled=?
      oauth-provider=(unit @tas)
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
+$  state-0
  $:  %0
      servers=(map server-id mcp-server-0)
      server-order=(list server-id)
  ==
::
+$  state-1
  $:  %1
      servers=(map server-id mcp-server-1)
      server-order=(list server-id)
  ==
::
+$  state-2
  $:  %2
      servers=(map server-id mcp-server)
      server-order=(list server-id)
  ==
::
+$  state-3
  $:  %3
      servers=(map server-id mcp-server)
      server-order=(list server-id)
      tool-filters=(map server-id tool-filter)
  ==
::
+$  state-4
  $:  %4
      servers=(map server-id mcp-server)
      server-order=(list server-id)
      tool-filters=(map server-id tool-filter)
      client-key=(unit @t)       ::  user-set x-api-key for /apps/mcp/mcp
      internal-token=(unit @t)   ::  mcp-server's auto-gen token (cached)
  ==
::
::  state-5: code-mode collapses N upstream tools into meta-tools
::  (search, describe, call) so the LLM doesn't pay
::  context cost for the full catalog. inspired by cloudflare's
::  "code mode" approach: https://blog.cloudflare.com/code-mode-mcp/
::
+$  state-5
  $:  %5
      servers=(map server-id mcp-server)
      server-order=(list server-id)
      tool-filters=(map server-id tool-filter)
      client-key=(unit @t)
      internal-token=(unit @t)
      code-mode=?                ::  collapse tools into 3 meta-tools
  ==
::
+$  versioned-state
  $%  state-0
      state-1
      state-2
      state-3
      state-4
      state-5
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
::
+$  update
  $%  [%server-added id=server-id =mcp-server]
      [%server-removed id=server-id]
      [%server-updated id=server-id =mcp-server]
  ==
--

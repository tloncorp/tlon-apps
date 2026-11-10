::  A complete platform key snapshot replaces only platform-owned slots.
/-  h=harness
/+  ht=harness-tools, j=harness-workspace-json, routing=harness-model-routing,
    policy=harness-defaults
|%
++  apply
  |=  $:  config=config:h  keys=(map @t @t)  servers=(map mcp-server-id:h mcp-server:h)  args=json
          initialize=?
      ==
  ^-  [config=config:h keys=(map @t @t)]
  =/  supplied  (need (get:j args 'providerKeys'))
  =/  primary  (get:j args 'primary')
  =?  config  &(initialize ?=(^ primary))
    =/  choice  (snag 0 (parse:routing [%a ~[u.primary]]))
    %*  .  config
      url  (endpoint:routing provider.choice)
      model  model.choice
      zdr  =('openrouter' provider.choice)
      key  ''
      headers  ~
      max-context  fallback-context:policy
    ==
  =/  fallbacks  (get:j args 'fallbacks')
  =?  config  &(initialize ?=(^ fallbacks))
    config(fallbacks (parse:routing u.fallbacks))
  ?>  ?=(%o -.supplied)
  =/  names=(list @t)  ~['openai' 'anthropic' 'xai' 'openrouter' 'brave']
  =/  valid
    %+  levy  ~(tap by p.supplied)
    |=  [name=@t value=json]
    ?&  (lien names |=(candidate=@t =(candidate name)))
        ?=(%s -.value)
        (lte (met 3 p.value) 8.192)
    ==
  ?>  valid
  ::  Absent platform keys remove their slot; owner-managed keys stay intact.
  =.  keys
    =/  remaining  names
    |-
    ^+  keys
    ?~  remaining  keys
    =/  slot  (cat 3 'hosted-' i.remaining)
    =/  value  (~(get by p.supplied) i.remaining)
    ?~  value  $(remaining t.remaining, keys (~(del by keys) slot))
    ?>  ?=(%s -.u.value)
    $(remaining t.remaining, keys (~(put by keys) slot p.u.value))
  =/  grants
    %+  turn  (enabled-mcp:ht servers)
    |=  id=@t
    `tool-grant:h`[%mcp id]
  =.  tools.config  ~(tap in (~(uni in (silt tools.config)) (silt grants)))
  [config keys]
--

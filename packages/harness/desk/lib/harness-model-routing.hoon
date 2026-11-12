::  Ordered, bounded model failover. Routing never carries credentials or
::  relaxes the request's privacy policy, instructions, or tool grants.
/-  h=harness
/+  auth=harness-auth, provider=harness-provider, j=harness-workspace-json,
    context=harness-model-context, policy=harness-defaults
|%
++  endpoint
  |=  name=@t
  ?:  =('openrouter' name)  'https://openrouter.ai/api/v1/chat/completions'
  ?:  =('openai' name)  'https://api.openai.com/v1/responses'
  ?:  =('anthropic' name)  'https://api.anthropic.com/v1/messages'
  ?:  =('xai' name)  'https://api.x.ai/v1/chat/completions'
  ''
++  parse
  |=  value=json
  ^-  (list model-choice:h)
  ?>  ?=(%a -.value)
  ?>  (lte (lent p.value) 4)
  =/  models
    %+  turn  p.value
    |=  entry=json
    =/  name  (string:j entry 'provider')
    =/  model  (string:j entry 'model')
    ?>  &(!=('' (endpoint name)) !=('' model) (lte (met 3 model) 256))
    [name model]
  ?>  =((lent models) (lent ~(tap in (silt models))))
  models
++  next
  |=  [config=config:h keys=(map @t @t) catalogs=model-contexts:h]
  ^-  (unit config:h)
  ?~  fallbacks.config  ~
  =/  choice  i.fallbacks.config
  =/  remaining=config:h  config(fallbacks t.fallbacks.config)
  =/  url  (endpoint provider.choice)
  ?:  ?|  =('' url)
          &(zdr.config !=('openrouter' provider.choice))
          &(=(url url.config) =(model.choice model.config))
      ==
    $(config remaining)
  =/  candidate
    %=  remaining
      url  url
      model  model.choice
      headers  ~
      key  ''
      max-context  fallback-context:policy
    ==
  ?:  =('' (key:auth keys provider.choice))  $(config remaining)
  ?^  (missing:auth keys candidate)  $(config remaining)
  `(resolve:context candidate keys catalogs)
++  active
  |=  [view=view:h req=@ud]
  ^-  config:h
  ?:  &(?=(^ route.view) =(req req.u.route.view))  config.u.route.view
  config.view
--

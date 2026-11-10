::  Model capacity comes from the selected provider and authentication route.
::  Catalog responses cannot change credentials, instructions or tool grants.
/-  h=harness
/+  auth=harness-auth, provider=harness-provider
|%
++  endpoint
  |=  credential=@t
  ^-  (unit @t)
  ?+  credential  ~
    %openai  `'https://api.openai.com/v1/models'
    %openai-device  `device-models:auth
    %anthropic  `'https://api.anthropic.com/v1/models?limit=1000'
    %anthropic-device  `'https://api.anthropic.com/v1/models?limit=1000'
    %xai  `'https://api.x.ai/v1/models'
    %xai-device  `xai-models:auth
    %openrouter  `'https://openrouter.ai/api/v1/models'
  ==
++  identity
  |=  [keys=(map @t @t) credential=@t]
  (sham [(endpoint credential) (key:auth keys credential) (key:auth keys 'openai-account')])
++  credentials
  |=  config=config:h
  ^-  (list @t)
  :*  (credential-for-config:auth config)
      (turn fallbacks.config |=(choice=model-choice:h provider.choice))
  ==
++  remember
  |=  [catalogs=model-contexts:h keys=(map @t @t) credential=@t windows=(map @t @ud)]
  ^-  model-contexts:h
  ?~  windows  catalogs
  =/  current  (identity keys credential)
  =/  saved  (~(get by catalogs) credential)
  =/  retained=(map @t @ud)
    ?~  saved  ~
    ?:(=(current identity.u.saved) windows.u.saved ~)
  ::  Missing metadata keeps a known limit for the same authenticated route.
  =/  remaining  ~(tap by `(map @t @ud)`windows)
  |-  ^-  model-contexts:h
      ?~  remaining  (~(put by catalogs) credential [current retained])
      =/  [model=@t capacity=@ud]  i.remaining
      =?  retained  (gth capacity 0)  (~(put by retained) model capacity)
      $(remaining t.remaining)
++  resolve
  |=  [config=config:h keys=(map @t @t) catalogs=model-contexts:h]
  ^-  config:h
  =/  credential  (credential-for-config:auth config)
  =/  saved  (~(get by catalogs) credential)
  ?~  saved  config
  ?.  =(identity.u.saved (identity keys credential))  config
  (apply config credential windows.u.saved)
++  request
  |=  [keys=(map @t @t) credential=@t]
  ^-  (list card:agent:gall)
  =/  url  (endpoint credential)
  ?~  url  ~
  =/  token  (key:auth keys credential)
  ?:  =('' token)  ~
  =/  headers=header-list:http  ~[['accept' 'application/json']]
  =?  headers  |(=('anthropic' credential) =('anthropic-device' credential))
    [['anthropic-version' '2023-06-01'] headers]
  =?  headers  =('anthropic-device' credential)
    [['anthropic-beta' 'oauth-2025-04-20'] headers]
  =.  headers  (headers:auth keys u.url headers)
  =.  headers
    :*  ?:(=('anthropic' credential) ['x-api-key' token] ['authorization' (cat 3 'Bearer ' token)])
        headers
    ==
  :_  ~
  :*  %pass
      /model-context/[credential]/(scot %uv (identity keys credential))
      %arvo  %i  %request
      [%'GET' u.url headers ~]
      *outbound-config:iris
  ==
++  parse
  |=  response=client-response:iris
  ^-  (unit (map @t @ud))
  ?.  ?=(%finished -.response)  ~
  ?.  ?&  (gte status-code.response-header.response 200)
          %+  lth
            status-code.response-header.response
          300
      ==
    ~
  ?~  full-file.response  ~
  ?:  (gth p.data.u.full-file.response 16.777.216)  ~
  =/  body  (de:json:html q.data.u.full-file.response)
  ?~  body  ~
  =/  parsed  (mole |.((parse-model-list:provider u.body)))
  ?~  parsed  ~
  :-  ~
  %+  roll  u.parsed
  |=  [model=model-info:provider windows=(map @t @ud)]
  ?~  context.model  windows
  ?:  =(0 u.context.model)  windows
  (~(put by windows) id.model u.context.model)
++  apply
  |=  [config=config:h credential=@t windows=(map @t @ud)]
  ^-  config:h
  ?.  =(credential (credential-for-config:auth config))  config
  =/  capacity  (~(get by windows) model.config)
  ?~  capacity  config
  config(max-context u.capacity)
--

::  Hosting manages model defaults, never conversation policy or tool grants.
/-  h=harness
/+  auth=harness-auth, provider=harness-provider, hosted=harness-hosted-auth,
    j=harness-workspace-json
/+  routing=harness-model-routing
|%
::
++  revision
  |=  config=config:h
  ^-  @t
  %+  scot  %uv
  %-  sham
  [url.config model.config headers.config max-context.config zdr.config fallbacks.config]
::
++  view
  |=  [config=config:h keys=(map @t @t)]
  =/  configured
    %+  turn  `(list @t)`~['openai' 'anthropic' 'xai' 'openrouter']
    |=  name=@t
    [name [%b !=('' (key:auth keys name))]]
  =/  subscription
    %-  ~(has in (silt ~['openai-device' 'anthropic-device' 'xai-device']))
    (credential-for-config:auth config)
  =/  fallbacks
    %+  turn  fallbacks.config
    |=  choice=model-choice:h
    (pairs:enjs:format ~[['provider' %s provider.choice] ['model' %s model.choice]])
  %+  envelope:hosted  200
  %-  pairs:enjs:format
  :~  ['revision' %s (revision config)]
      ['provider' %s (provider-for-url:provider url.config)]
      ['model' %s model.config]
      ['zdr' %b zdr.config]
      ['fallbacks' %a fallbacks]
      ['apiKeys' (pairs:enjs:format configured)]
      ['auth' %s ?:(subscription 'subscription' 'api-key')]
  ==
::
++  apply
  |=  [config=config:h keys=(map @t @t) args=json]
  ^-  [config=config:h keys=(map @t @t) response=json]
  =/  invalid  [config keys (error:hosted 400 'Invalid model settings.')]
  ?>  ?=(%o -.args)
  ?:  =(~ p.args)  [config keys (view config keys)]
  ::  Unknown fields fail closed: callers must not mistake ignored settings
  ::  for applied configuration.
  =/  supported
    %+  levy  ~(tap by p.args)
    |=  [name=@t value=json]
    (~(has in (silt ~['revision' 'provider' 'model' 'auth' 'apiKey' 'zdr' 'fallbacks'])) name)
  ?.  supported
    [config keys (error:hosted 400 'Unsupported model setting. Read hosted capabilities.')]
  ?.  =((revision config) (string:j args 'revision'))
    [config keys (error:hosted 409 'Model settings changed. Read settings and retry.')]
  =/  provider  (string:j args 'provider')
  ::  Key management does not select a model or change its authentication.
  ?:  ?=(~ (get:j args 'model'))
    ?.  (~(has in (silt ~['openai' 'anthropic' 'xai' 'openrouter'])) provider)  invalid
    ?.  ?=(~ (get:j args 'auth'))  invalid
    ?.  ?=(~ (get:j args 'zdr'))  invalid
    ?.  ?=(~ (get:j args 'fallbacks'))  invalid
    =/  token  (string:j args 'apiKey')
    ?.  (lte (met 3 token) 8.192)  invalid
    =.  keys  (put-key:auth keys provider token)
    [config keys (view config keys)]
  =/  model  (string:j args 'model')
  =/  method  (string:j args 'auth')
  =/  privacy  (get:j args 'zdr')
  ?.  |(?=(~ privacy) ?=([~ %b *] privacy))  invalid
  =/  zdr=?  ?:(?=(~ privacy) | (boolean:j args 'zdr' |))
  ?:  &(zdr !=('openrouter' provider))
    [config keys (error:hosted 400 'Zero data retention routing requires OpenRouter.')]
  ?.  ?&  !=('' model)
          (lte (met 3 model) 256)
          |(=('api-key' method) =('subscription' method))
      ==
    invalid
  =/  url=@t
    ?:  =('openai' provider)
      ?:(=('subscription' method) device-url:auth 'https://api.openai.com/v1/responses')
    ?:  =('anthropic' provider)  'https://api.anthropic.com/v1/messages'
    ?:  =('xai' provider)
      ?:(=('subscription' method) xai-url:auth 'https://api.x.ai/v1/chat/completions')
    ?:  &(=('openrouter' provider) =('api-key' method))
      'https://openrouter.ai/api/v1/chat/completions'
    ''
  ?:  =('' url)  [config keys (error:hosted 400 'Unsupported provider or authentication method.')]
  =/  headers=(list [name=@t value=@t])
    ?:  &(=('anthropic' provider) =('subscription' method))
      ~[['anthropic-beta' 'oauth-2025-04-20']]
    ~
  =/  selected
    %*  .  config
      url  url
      model  model
      key  ''
      headers  headers
      zdr  zdr
    ==
  =/  chain  (get:j args 'fallbacks')
  =?  fallbacks.selected  ?=(^ chain)  (parse:routing u.chain)
  ?:  &(zdr (lien fallbacks.selected |=(choice=model-choice:h !=('openrouter' provider.choice))))
    [config keys (error:hosted 400 'Zero data retention requires OpenRouter fallbacks.')]
  =/  supplied  (get:j args 'apiKey')
  ?^  supplied
    ?>  ?=(%s -.u.supplied)
    ?.  &(=('api-key' method) (lte (met 3 p.u.supplied) 8.192))  invalid
    =.  keys  (put-key:auth keys provider p.u.supplied)
    [selected keys (view selected keys)]
  ?:  =('' (key:auth keys (credential-for-config:auth selected)))
    [config keys (error:hosted 409 'Connect this provider before selecting its model.')]
  [selected keys (view selected keys)]
::
++  models
  |=  [config=config:h keys=(map @t @t) args=json]
  ^-  json
  =/  entries  (need (get:j args 'models'))
  ?>  ?=(%a -.entries)
  ?>  ?=(^ p.entries)
  ?>  &((gte (lent p.entries) 1) (lte (lent p.entries) 5))
  =/  choices
    %+  turn  p.entries
    |=  entry=json
    =/  name  (string:j entry 'provider')
    %-  pairs:enjs:format
    :~  ['provider' %s name]
        ['model' %s (string:j entry 'model')]
    ==
  ?>  ?=(^ choices)
  =/  name  (string:j i.choices 'provider')
  =/  current  (provider-for-url:provider url.config)
  =/  method
    ?:  =(name current)
      ?:(=(name (credential-for-config:auth config)) 'api-key' 'subscription')
    ?:  !=('' (key:auth keys name))  'api-key'
    'subscription'
  %-  pairs:enjs:format
  :~  ['revision' %s (revision config)]
      ['provider' %s name]
      ['model' %s (string:j i.choices 'model')]
      ['auth' %s method]
      ['zdr' %b (boolean:j i.p.entries 'zdr' |)]
      ['fallbacks' %a t.choices]
  ==
--

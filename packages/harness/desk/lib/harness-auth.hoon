::  Credential routing, separate from codecs and session policy. Endpoints
::  select a credential slot, never a fallback to another authentication kind.
::  Secrets stay in the head's credential map, not configuration/event logs.
/-  h=harness
/+  hp=harness-provider
|%
++  device-url  'https://chatgpt.com/backend-api/codex/responses'
++  device-models  'https://chatgpt.com/backend-api/codex/models?client_version=0.159.2'
++  xai-url  'https://cli-chat-proxy.grok.com/v1/responses'
++  xai-models  'https://cli-chat-proxy.grok.com/v1/models'
++  xai-route
  |=(url=@t |(=(url xai-url) =(url xai-models)))
++  device-route
  |=(url=@t |(=(url device-url) =(url device-models)))
++  credential-for-url
  |=  url=@t
  ?:  (device-route url)  'openai-device'
  ?:  (xai-route url)  'xai-device'
  (provider-for-url:hp url)
++  credential-for-config
  |=  config=config:h
  ?:  ?&  =('anthropic' (provider-for-url:hp url.config))
          %+  lien  headers.config
          |=  [name=@t value=@t]
          &(=('anthropic-beta' name) =('oauth-2025-04-20' value))
      ==
    'anthropic-device'
  (credential-for-url url.config)
::  Compatibility for device tokens already saved in the shared OpenAI slot.
::  This recognizes token shape only, not validity or authorization. New device
::  credentials have a dedicated slot and do not need shape inference.
++  jwt-shaped
  |=  token=@t
  =('eyJ' (end 3^3 token))
++  key
  |=  [keys=(map @t @t) provider=@t]
  ^-  @t
  =/  stored  (fall (~(get by keys) provider) '')
  ::  Hosting owns its fallback slots; explicit local keys (including a blank
  ::  override) win. Subscription credentials never use platform API keys.
  =?  stored
    ?&  !(~(has by keys) provider)
        (~(has in (silt ~['openai' 'anthropic' 'xai' 'openrouter' 'brave'])) provider)
    ==
    (fall (~(get by keys) (cat 3 'hosted-' provider)) '')
  ?:  =('openai' provider)  ?:((jwt-shaped stored) '' stored)
  ?.  =('openai-device' provider)  stored
  ?:  (~(has by keys) provider)  stored
  =/  shared  (fall (~(get by keys) 'openai') '')
  ?:((jwt-shaped shared) shared '')
++  put-key
  |=  [keys=(map @t @t) provider=@t token=@t]
  =?  keys  |(=('openai-device' provider) =('xai-device' provider))
    (~(del by keys) ?:(=('xai-device' provider) 'xai-expires' 'openai-expires'))
  ::  Saving an API key must not discard a previously saved device login.
  =/  shared  (fall (~(get by keys) 'openai') '')
  =?  keys  &(=('openai' provider) (jwt-shaped shared) !(~(has by keys) 'openai-device'))
    (~(put by keys) 'openai-device' shared)
  (~(put by keys) provider token)
++  missing
  |=  [keys=(map @t @t) config=config:h]
  ^-  (unit @t)
  =/  provider  (provider-for-url:hp url.config)
  ?:  &(zdr.config !=('openrouter' provider))
    `'Zero data retention routing requires OpenRouter. Change the provider or privacy setting.'
  ?.  |(=('openai' provider) =('anthropic' provider) =('xai' provider))  ~
  ?:  |(!=('' key.config) !=('' (key keys (credential-for-config config))))  ~
  ?:  =('xai' provider)
    ?:  (xai-route url.config)
      `'authentication_error: Connect your Grok subscription in xAI settings.'
    `'authentication_error: Enter an xAI API key in provider settings.'
  ?:  =('anthropic' provider)
    ?:  =('anthropic-device' (credential-for-config config))
      `'authentication_error: Connect an Anthropic subscription in provider settings.'
    `'authentication_error: Enter an Anthropic API key in provider settings.'
  ?:  (device-route url.config)
    :-  ~
    %+  rap  3
    :~  'authentication_error: Device login is selected but no OpenAI device credential is saved. '
        'Sign in in OpenAI settings.'
    ==
  :-  ~
  %+  rap  3
  :~  'authentication_error: API key is selected but no OpenAI API key is saved. '
      'Enter a key or select Device login in model settings.'
  ==
++  headers
  |=  [keys=(map @t @t) url=@t extra=(list [name=@t value=@t])]
  ^-  (list [name=@t value=@t])
  ?.  ?|  (device-route url)
          (xai-route url)
          =('openai' (provider-for-url:hp url))
          =('xai' (provider-for-url:hp url))
          (anthropic-route:hp url)
      ==
    extra
  ::  Built-in auth headers cannot override the route's selected credential or
  ::  leak a ChatGPT account onto the API route. Custom endpoints retain theirs.
  =.  extra
    %+  skim  extra
    |=  [name=@t value=@t]
    ?!  %-  ~(has in (silt ~['authorization' 'x-api-key' 'chatgpt-account-id']))
        (crip (cass (trip name)))
  =/  account  (key keys 'openai-account')
  ?.  &((device-route url) !=('' account))  extra
  [['chatgpt-account-id' account] extra]
++  request-headers
  |=  [keys=(map @t @t) config=config:h token=@t]
  ^-  (list [name=@t value=@t])
  =/  extra  (headers keys url.config headers.config)
  =/  native  (anthropic-route:hp url.config)
  =?  extra  native
    :-  ['anthropic-version' '2023-06-01']
    %+  skim  extra
    |=  [name=@t value=@t]
    !=('anthropic-version' (crip (cass (trip name))))
  ?:  =('' token)  extra
  ?:  &(native !=('anthropic-device' (credential-for-config config)))
    [['x-api-key' token] extra]
  [['authorization' (cat 3 'Bearer ' token)] extra]
--

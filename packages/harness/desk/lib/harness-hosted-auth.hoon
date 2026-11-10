::  Concrete provider flows with bounded work and secret-free projections.
::  No provider response body is published as an error or transcript event.
/-  *harness-hosted, renew=harness-oauth
/+  auth=harness-auth, oauth=harness-oauth,
    hp=harness-provider, j=harness-workspace-json
|%
+$  card  card:agent:gall
+$  result  [db=state keys=(map @t @t) cards=(list card) response=json]
++  envelope
  |=  [status=@ud body=json]
  (pairs:enjs:format ~[['status' (numb:enjs:format status)] ['body' body]])
++  error
  |=  [status=@ud message=@t]
  (envelope status (pairs:enjs:format ~[['error' %s message]]))
++  slot
  |=  provider=@t
  (cat 3 provider '-device')
++  identity
  |=  [keys=(map @t @t) provider=@t]
  %-  sham
  :*  (key:auth keys (slot provider))
      (key:auth keys (cat 3 provider '-refresh'))
      (key:auth keys (cat 3 provider '-account'))
  ==
++  supported
  |=  provider=@t
  |(=('openai' provider) =('anthropic' provider) =('xai' provider))
++  public-flow
  |=  [id=@t login=flow now=@da]
  ^-  json
  =/  expired  (gte now expires.login)
  =/  status=@t
    ?:  expired  'error'
    ?-  phase.login
      %code  'authenticating'
      %poll  'awaiting_browser'
      %exchange  'authenticating'
      %verify  'authenticating'
      %token  'awaiting_token'
      %done  'complete'
      %error  'error'
    ==
  %-  pairs:enjs:format
  :~  ['id' %s id]
      ['provider' %s provider.login]
      ['status' %s status]
      ['expiresAt' (stamp:j expires.login)]
      ['verificationUrl' %s verification.login]
      ['userCode' %s user-code.login]
      ['error' %s ?:(expired 'Login expired. Start a new login.' error.login)]
  ==
++  flow-response
  |=  [status=@ud id=@t login=flow now=@da]
  (envelope status (pairs:enjs:format ~[['flow' (public-flow id login now)]]))
++  status
  |=  $:  db=state
          keys=(map @t @t)
          renewal=state:renew
          xai-renewal=state:renew
          now=@da
      ==
  ^-  json
  =/  providers
    %+  turn  `(list @t)`~['openai' 'anthropic' 'xai']
    |=  provider=@t
    =/  token  (key:auth keys (slot provider))
    =/  expires  (saved-expiry:oauth keys provider)
    =/  state=@t
      ?:  =('' token)  'missing'
      ?:  ?&  =('openai' provider)
              =(identity.renewal (identity keys provider))
              terminal.renewal
          ==
        'expired'
      ?:  ?&  =('xai' provider)
              =(identity.xai-renewal (identity keys provider))
              terminal.xai-renewal
          ==
        'expired'
      ?~  expires  'static'
      ?:  (gte now u.expires)
        ?:  =('' (key:auth keys (cat 3 provider '-refresh')))
          'expired'
        'expiring'
      ?:  (gte (add now ~m5) u.expires)  'expiring'
      'ok'
    (pairs:enjs:format ~[['provider' %s provider] ['status' %s state]])
  =/  models
    %+  turn  `(list @t)`~['openai' 'anthropic' 'xai']
    |=  provider=@t
    =/  saved  (~(get by catalogs.db) provider)
    :-  provider
    ?~  saved  [%a ~]
    ?.  =(identity.u.saved (identity keys provider))  [%a ~]
    models.u.saved
  %-  envelope
  :-  200
  %-  pairs:enjs:format
  :~  ['ts' (stamp:j now)]
      ['providers' %a providers]
      ['subscriptionModels' (pairs:enjs:format models)]
  ==
++  capabilities
  %-  envelope
  :-  200
  %-  pairs:enjs:format
  :~  ['runtime' %s 'harness']
      ['providers' %a ~[[%s 'openai'] [%s 'anthropic'] [%s 'xai']]]
      ['apiKeyProviders' %a ~[[%s 'openai'] [%s 'anthropic'] [%s 'xai'] [%s 'openrouter']]]
      ['modelFallbacks' %b &]
      ['openrouterZdr' %b &]
      ['soul' %b &]
      ['skills' %b &]
  ==
++  prune
  |=  [db=state now=@da]
  =/  live
    %+  skim  ~(tap by flows.db)
    |=  [id=@t login=flow]
    (lth now expires.login)
  db(flows (malt live))
++  invalidate
  |=  [db=state provider=@t]
  =/  remaining
    %+  skip  ~(tap by flows.db)
    |=  [id=@t login=flow]
    =(provider provider.login)
  db(flows (malt remaining), catalogs (~(del by catalogs.db) provider))
++  fail
  |=  [out=result id=@t message=@t]
  =/  login  (~(get by flows.db.out) id)
  ?~  login  out
  =/  failed
    %=  u.login
      phase  %error
      pending  |
      device  ''
      token  ''
      refresh  ''
      account  ''
      error  message
    ==
  out(flows.db (~(put by flows.db.out) id failed))
++  request
  |=  $:  out=result
          id=@t
          now=@da
          method=?(%'GET' %'POST')
          url=@t
          headers=header-list:http
          body=(unit @t)
      ==
  ^-  result
  =/  login  (~(got by flows.db.out) id)
  =.  login  login(serial +(serial.login), pending &, deadline (add now ~s30))
  =/  http=request:http  [method url headers ?~(body ~ `(as-octs:mimes:html u.body))]
  =/  cards=(list card)
    :~  [%pass /hosted-auth/[id]/(scot %ud serial.login) %arvo %i %request http [0 0]]
        [%pass /hosted-auth-timeout/[id]/(scot %ud serial.login) %arvo %b %wait deadline.login]
    ==
  out(flows.db (~(put by flows.db.out) id login), cards (weld cards.out cards))
++  poll-later
  |=  [out=result id=@t now=@da]
  =/  login  (~(got by flows.db.out) id)
  =.  login  login(pending |)
  =/  wake=card
    :*  %pass
        /hosted-auth-poll/[id]/(scot %ud serial.login)
        %arvo
        %b
        %wait
        (add now (mul interval.login ~s1))
    ==
  out(flows.db (~(put by flows.db.out) id login), cards (snoc cards.out wake))
++  verify
  |=  [out=result id=@t now=@da]
  =/  login  (~(got by flows.db.out) id)
  =.  out  out(flows.db (~(put by flows.db.out) id login(phase %verify)))
  =/  headers=header-list:http
    ~[['authorization' (cat 3 'Bearer ' token.login)] ['accept' 'application/json']]
  ?:  =('xai' provider.login)
    (request out id now %'GET' xai-models:auth headers ~)
  ?:  =('openai' provider.login)
    =?  headers  !=('' account.login)  [['chatgpt-account-id' account.login] headers]
    (request out id now %'GET' device-models:auth headers ~)
  =.  headers
    (weld headers ~[['anthropic-version' '2023-06-01'] ['anthropic-beta' 'oauth-2025-04-20']])
  (request out id now %'GET' 'https://api.anthropic.com/v1/models?limit=1000' headers ~)
++  run
  |=  [db=state keys=(map @t @t) action=@t args=json now=@da]
  ^-  result
  =/  out=result  [(prune db now) keys ~ (error 400 'Invalid authentication request.')]
  |^
    ?:  =('capabilities' action)  out(response capabilities)
    ?:  =('flow' action)
      =/  id  (string:j args 'flowId')
      =/  login  (~(get by flows.db.out) id)
      ?~  login  out(response (error 404 'Login not found or expired.'))
      out(response (flow-response 200 id u.login now))
    ?:  =('complete' action)  complete-login
    =/  provider  (string:j args 'provider')
    ?.  (supported provider)
      out(response (error 400 'Unsupported provider. Read hosted capabilities.'))
    ?:  =('disconnect' action)
      =.  db.out  (invalidate db.out provider)
      =.  keys.out  (~(put by keys.out) (slot provider) '')
      =.  keys.out  (~(put by keys.out) (cat 3 provider '-refresh') '')
      =.  keys.out  (~(put by keys.out) (cat 3 provider '-account') '')
      =.  keys.out  (~(put by keys.out) (cat 3 provider '-expires') '')
      out(response (envelope 200 (pairs:enjs:format ~[['provider' %s provider]])))
    ?.  =('start' action)  out
    (start-login provider)
  ::
  ++  complete-login
    =/  id  (string:j args 'flowId')
    =/  login  (~(get by flows.db.out) id)
    ?~  login  out(response (error 404 'Login not found or expired.'))
    ?:  &(=('anthropic' provider.u.login) =(%done phase.u.login))
      out(response (flow-response 200 id u.login now))
    ?:  ?&  =('anthropic' provider.u.login)
            =(%verify phase.u.login)
            =((string:j args 'token') token.u.login)
        ==
      out(response (flow-response 202 id u.login now))
    ?.  &(=('anthropic' provider.u.login) =(%token phase.u.login))
      out(response (error 409 'This login is not awaiting a token.'))
    =/  token  (string:j args 'token')
    ?.  ?&  (gte (met 3 token) 80)
            (lte (met 3 token) 8.192)
            =('sk-ant-oat01-' (cut 3 [0 13] token))
        ==
      out(response (error 400 'Enter a valid Anthropic setup token.'))
    =.  out  out(flows.db (~(put by flows.db.out) id u.login(token token)))
    =.  out  (verify out id now)
    out(response (flow-response 202 id (~(got by flows.db.out) id) now))
  ::
  ++  start-login
    |=  provider=@t
    ^-  result
    =/  id  (string:j args 'requestId')
    ?.  ?&  (gth (met 3 id) 0)
            (lte (met 3 id) 128)
            %+  levy  (trip id)
            |=  char=@
            ?|  &((gte char 'a') (lte char 'z'))
                &((gte char '0') (lte char '9'))
                =('-' char)
                =('.' char)
            ==
        ==
      %=  out  response
          %+  error
            400
          'Expected a bounded requestId containing lowercase letters, digits, dots or hyphens.'
      ==
    =/  existing  (~(get by flows.db.out) id)
    ?^  existing
      ?.  =(provider provider.u.existing)
        out(response (error 409 'Request ID belongs to another provider.'))
      out(response (flow-response 200 id u.existing now))
    ?:  (gte ~(wyt by flows.db.out) 32)  out(response (error 429 'Too many pending logins.'))
    ::  One login per provider; replacing it fences every outstanding response.
    =.  db.out  (invalidate db.out provider)
    =/  login=flow  *flow
    =.  login
      %=  login
        provider  provider
        phase  ?:(=('anthropic' provider) %token %code)
        expires  (add now ~m15)
        base  (identity keys provider)
        pending  |
        interval  5
      ==
    =.  flows.db.out  (~(put by flows.db.out) id login)
    =?  out  =('openai' provider)
      %-  request
      :*  out
          id
          now
          %'POST'
          'https://auth.openai.com/api/accounts/deviceauth/usercode'
          ~[['content-type' 'application/json']]
          `'{"client_id":"app_EMoamEEZ73f0CkXaXp7hrann"}'
      ==
    =?  out  =('xai' provider)
      ::  These fixed endpoints are published by auth.x.ai's OIDC discovery.
      ::  The public device client requests inference and renewable login only.
      =/  form
        %-  rap
        :-  3
        :~  'client_id='
            (client-id:oauth provider)
            '&scope=openid%20profile%20email%20offline_access%20grok-cli%3Aaccess%20api%3Aaccess'
        ==
      %-  request
      :*  out
          id
          now
          %'POST'
          'https://auth.x.ai/oauth2/device/code'
          ~[['content-type' 'application/x-www-form-urlencoded'] ['accept' 'application/json']]
          `form
      ==
    out(response (flow-response 202 id (~(got by flows.db.out) id) now))
  --
++  wake
  |=  [db=state keys=(map @t @t) id=@t serial=@ud timeout=? now=@da]
  ^-  result
  =/  out=result  [db keys ~ ~]
  =/  login  (~(get by flows.db) id)
  ?~  login  out
  ?.  =(serial serial.u.login)  out
  ?:  (gte now expires.u.login)  (fail out id 'Login expired. Start a new login.')
  ?:  timeout
    ?:  &(pending.u.login (gte now deadline.u.login))
      %^  fail
        out
        id
      'Provider request timed out. Start a new login.'
    out
  ?.  &(=(%poll phase.u.login) !pending.u.login)  out
  ?:  =('xai' provider.u.login)
    =/  form
      %-  rap
      :-  3
      :~  'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code&client_id='
          (client-id:oauth 'xai')
          '&device_code='
          (crip (en-urlt:html (trip device.u.login)))
      ==
    %:  request
      out
      id
      now
      %'POST'
      (token-url:oauth 'xai')
      ~[['content-type' 'application/x-www-form-urlencoded'] ['accept' 'application/json']]
      `form
    ==
  =/  body
    %-  en:json:html
    %-  pairs:enjs:format
    :~  ['device_auth_id' %s device.u.login]
        ['user_code' %s user-code.u.login]
    ==
  %:  request
    out
    id
    now
    %'POST'
    'https://auth.openai.com/api/accounts/deviceauth/token'
    ~[['content-type' 'application/json']]
    `body
  ==
++  claims
  |=  token=@t
  ^-  json
  =/  parts  (rush token (more dot (cook crip (plus ;~(pose hig low nud hep cab)))))
  ?~  parts  ~
  ?.  =(3 (lent u.parts))  ~
  =/  decoded  (~(de base64:mimes:html | &) (snag 1 u.parts))
  ?~  decoded  ~
  (fall (de:json:html q.u.decoded) ~)
++  invalid-response
  |=  phase=@tas
  ^-  @t
  ?+  phase  'Provider returned an invalid authentication response.'
    %code  'Provider returned an invalid device-code response.'
    %poll  'Provider returned an invalid device-authorization response.'
    %exchange  'Provider returned an invalid token-exchange response.'
    %verify  'Provider returned an invalid model catalog while verifying the login.'
  ==
++  receive
  |=  $:  db=state
          keys=(map @t @t)
          id=@t
          serial=@ud
          response=client-response:iris
          now=@da
      ==
  ^-  result
  =/  out=result  [db keys ~ ~]
  =/  found  (~(get by flows.db) id)
  ?~  found  out
  =/  login  u.found
  ?.  &(pending.login =(serial serial.login))  out
  ?:  (gte now deadline.login)
    (fail out id 'Provider request timed out. Start a new login.')
  ?:  |((gte now expires.login) !=(base.login (identity keys provider.login)))
    (fail out id 'Login expired or credentials changed. Start a new login.')
  ?:  ?=(%progress -.response)  out
  ?:  ?=(%cancel -.response)  (fail out id 'Provider request interrupted. Start a new login.')
  =.  out  out(flows.db (~(put by flows.db.out) id login(pending |)))
  =/  status  status-code.response-header.response
  ?:  ?&  =('openai' provider.login)
          =(%poll phase.login)
          |(=(403 status) =(404 status))
      ==
    (poll-later out id now)
  ?.  |(=(200 status) &(=('xai' provider.login) =(%poll phase.login) =(400 status)))
    (fail out id 'Provider rejected authentication. Check your login and try again.')
  ::  Model catalogs carry instructions and capability metadata. Keep their
  ::  wire budget separate from token responses; persist only IDs and names.
  =/  limit  ?:(=(%verify phase.login) 2.097.152 262.144)
  ?:  &(?=(^ full-file.response) (gth p.data.u.full-file.response limit))
    =/  message
      ?:  =(%verify phase.login)
        'Provider model catalog exceeds the 2 MiB limit.'
      'Provider authentication response exceeds the 256 KiB limit.'
    (fail out id message)
  =/  parsed
    %-  mole
    |.
    ?>  ?=(^ full-file.response)
    =/  value  (need (de:json:html q.data.u.full-file.response))
    ?>  ?=(%o -.value)
    value
  ?~  parsed  (fail out id (invalid-response phase.login))
  =/  body  u.parsed
  ?:  !=(200 status)
    =/  problem  (~(get by p.body) 'error')
    ?.  ?=([~ %s *] problem)  (fail out id (invalid-response phase.login))
    ?:  =('authorization_pending' p.u.problem)  (poll-later out id now)
    ?:  =('slow_down' p.u.problem)
      =.  login  login(pending |, interval (add interval.login 5))
      =.  flows.db.out  (~(put by flows.db.out) id login)
      (poll-later out id now)
    =/  message
      ?:  =('expired_token' p.u.problem)
        'Device code expired. Start a new login.'
      'Device authorization was denied. Start a new login.'
    (fail out id message)
  =/  decoded  (mule |.((advance out id login body now)))
  ?:  ?=(%| -.decoded)  (fail out id (invalid-response phase.login))
  p.decoded
++  advance
  |=  [out=result id=@t login=flow body=json now=@da]
  ^-  result
  |^
    ?:  =(%code phase.login)  accept-device-code
    ?:  &(=(%poll phase.login) =('openai' provider.login))
      exchange-code
    ?:  |(=(%exchange phase.login) &(=(%poll phase.login) =('xai' provider.login)))
      accept-token
    save-verified-login
  ::
  ++  accept-device-code
    =/  device  (string:j body ?:(=('xai' provider.login) 'device_code' 'device_auth_id'))
    =/  code  (string:j body 'user_code')
    ?>  &(!=('' device) !=('' code) (lte (met 3 device) 4.096) (lte (met 3 code) 64))
    =/  raw  (get:j body 'interval')
    =/  interval=@ud
      ?~  raw  5
      ?:  ?=(%s -.u.raw)  (fall (rush p.u.raw dem) 5)
      (number:j body 'interval' 5)
    =?  login  =('xai' provider.login)
      ?>  =('https://accounts.x.ai/oauth2/device' (string:j body 'verification_uri'))
      =/  seconds  (number:j body 'expires_in' 0)
      ?>  &((gth seconds 0) (lte seconds 3.600) (lte interval 300))
      login(expires (min expires.login (add now (mul seconds ~s1))))
    =.  login
      %=  login
        phase  %poll
        pending  |
        device  device
        user-code  code
        verification
          ?:  =('xai' provider.login)
            'https://accounts.x.ai/oauth2/device'
          'https://auth.openai.com/codex/device'
        interval
          ?:  =('xai' provider.login)
            (max 1 interval)
          (min 60 (max 2 interval))
      ==
    (poll-later out(flows.db (~(put by flows.db.out) id login)) id now)
  ::
  ++  exchange-code
    =/  code  (string:j body 'authorization_code')
    =/  verifier  (string:j body 'code_verifier')
    ?>  &(!=('' code) !=('' verifier))
    =/  form
      %-  rap
      :-  3
      :~
        'grant_type=authorization_code&client_id=app_EMoamEEZ73f0CkXaXp7hrann&redirect_uri=https%3A%2F%2Fauth.openai.com%2Fdeviceauth%2Fcallback&code='
        (crip (en-urlt:html (trip code)))
        '&code_verifier='
        (crip (en-urlt:html (trip verifier)))
      ==
    =.  out  out(flows.db (~(put by flows.db.out) id login(phase %exchange, pending |)))
    %:  request
      out
      id
      now
      %'POST'
      'https://auth.openai.com/oauth/token'
      ~[['content-type' 'application/x-www-form-urlencoded']]
      `form
    ==
  ::
  ++  accept-token
    =/  token  (string:j body 'access_token')
    =/  refresh  (fall (optional:j body 'refresh_token') '')
    ?>  &(!=('' token) (lte (met 3 token) 16.384) (lte (met 3 refresh) 16.384))
    =/  expires  (token-expiry:oauth body token now)
    ?>  ?:(=('xai' provider.login) &(!=('' refresh) ?=(^ expires)) &)
    =/  claims  (claims (fall (optional:j body 'id_token') token))
    =/  nested  ?~(claims ~ (get:j claims 'https://api.openai.com/auth'))
    =/  account  ?~(nested '' (fall (optional:j u.nested 'chatgpt_account_id') ''))
    =.  login
      %=  login
        token  token
        refresh  refresh
        account  account
        token-expires  expires
        pending  |
      ==
    (verify out(flows.db (~(put by flows.db.out) id login)) id now)
  ::
  ++  save-verified-login
    ::  Only a verified catalog allows credentials into the saved key map.
    ?>  =(%verify phase.login)
    =/  rows  (need (get:j body ?:(=('openai' provider.login) 'models' 'data')))
    ?>  ?=(%a -.rows)
    =/  models
      %+  murn  (scag 512 p.rows)
      |=  row=json
      ^-  (unit json)
      =/  id  (fall (optional:j row ?:(=('openai' provider.login) 'slug' 'id')) '')
      =?  id  &(=('xai' provider.login) =('' id))
        (fall (optional:j row 'model') '')
      ?:  =('' id)  ~
      ?.  (language-model:hp row)  ~
      =/  name  (fall (optional:j row ?:(=('xai' provider.login) 'name' 'display_name')) id)
      `(pairs:enjs:format ~[['id' %s id] ['name' %s name]])
    =.  keys.out  (~(put by keys.out) (slot provider.login) token.login)
    =.  keys.out  (~(put by keys.out) (cat 3 provider.login '-refresh') refresh.login)
    =.  keys.out  (~(put by keys.out) (cat 3 provider.login '-account') account.login)
    =.  keys.out
      %+  ~(put by keys.out)
        (cat 3 provider.login '-expires')
      ?~(token-expires.login '' (scot %da u.token-expires.login))
    =.  catalogs.db.out
      %+  ~(put by catalogs.db.out)
        provider.login
      [(identity keys.out provider.login) [%a models]]
    =.  login
      login(phase %done, pending |, device '', token '', refresh '', account '')
    out(flows.db (~(put by flows.db.out) id login))
  --
--

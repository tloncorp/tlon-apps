::  Full head execution with fixture HTTP responses; emitted network cards
::  are inspected, never delivered to providers or the installed agent.
/-  *harness-store, hosted=harness-hosted, ac=acp, renew=harness-oauth
/+  *test-agent, auth=harness-auth, ha=harness-hosted-auth, defaults=harness-defaults,
    ht=harness-tools, j=harness-workspace-json, settings=harness-hosted-settings
/=  head  /app/harness
|%
::  Load saved state as the owner. Every scry answers %.n; loading opens the
::  ACP subscription that frames arrive on.
::
++  setup
  |=  [now=@da saved=state-0]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now now)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  *  bind:m  (do-load head `!>(saved))
  (pure:m ~)
::
++  get-state
  =/  m  (mare ,state-0)
  ^-  form:m
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-0 vase))
::
++  do-hosted
  |=  [id=@t kind=@t args=json]
  (do-poke %harness-hosted !>(`request:hosted`[id kind args]))
::
++  do-acp-frame
  |=  [id=@ud connection=@t payload=@t]
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  =bowl  bind:m  get-bowl
  =/  =update:v1:ac  [%messages connection %agent ~[[id now.bowl payload]]]
  (do-agent /acp/watch [~zod %acp] [%fact %acp-update-1 !>(update)])
::
++  do-iris
  |=  [=wire reply=client-response:iris]
  (do-arvo wire [%iris %http-response reply])
::
++  test-mobile-model-selection-survives-reload
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved=state-0  *state-0
  =.  provider-keys.saved  (my ~[['hosted-openrouter' 'fixture-key']])
  ;<  ~  bind:m  (setup ~2026.9.23 saved)
  =/  args
    %-  need
    (de:json:html '{"models":[{"provider":"openrouter","model":"selected","zdr":true}]}')
  ;<  *  bind:m  (do-hosted 'mobile' 'models' args)
  ;<  *  bind:m  (do-load head ~)
  ;<  retained=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>(model-defaults-set.retained) !>(&))
  ;<  ~  bind:m  (ex-equal !>(model.defaults.retained) !>('selected'))
  ;<  ~  bind:m  (ex-equal !>(zdr.defaults.retained) !>(&))
  (ex-equal !>(provider-keys.retained) !>(provider-keys.saved))
::
++  test-owner-model-selection-survives-first-provision-and-reload
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (setup ~2026.9.21 *state-0)
  ;<  initial=state-0  bind:m  get-state
  =/  args
    %-  need
    %-  de:json:html
    '{"provider":"openrouter","model":"owner-model","auth":"api-key","apiKey":"owner-key"}'
  ?>  ?=(%o -.args)
  =.  p.args  (~(put by p.args) 'revision' [%s (revision:settings defaults.initial)])
  ;<  *  bind:m  (do-hosted 'settings' 'settings' args)
  ;<  saved=state-0  bind:m  get-state
  ;<  *  bind:m  (do-load head ~)
  =/  supplied
    %-  need
    %-  de:json:html
    '{"providerKeys":{"openrouter":"platform-key"},"primary":{"provider":"openrouter","model":"platform-model"},"fallbacks":[]}'
  ;<  *  bind:m  (do-hosted 'provision' 'provision' supplied)
  ;<  retained=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>(model-defaults-set.saved) !>(&))
  ;<  ~  bind:m  (ex-equal !>(model.defaults.retained) !>('owner-model'))
  (ex-equal !>((key:auth provider-keys.retained 'openrouter')) !>('owner-key'))
::
++  test-credential-cleanup-survives-reload
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved=state-0  *state-0
  =.  api-key.saved  'private'
  =.  provider-keys.saved
    %-  my
    ~[['openai-device' 'subscription'] ['xai-refresh' 'refresh'] ['hosted-openrouter' 'managed']]
  ;<  ~  bind:m  (setup ~2026.9.17 saved)
  =/  args  (pairs:enjs:format ~[['provider' %s 'openai'] ['requestId' %s 'pending-cleanup']])
  ;<  *  bind:m  (do-hosted 'login' 'start' args)
  ;<  *  bind:m  (do-hosted 'cleanup' 'clear-credentials' [%o ~])
  ;<  *  bind:m  (do-load head ~)
  ;<  retained=state-0  bind:m  get-state
  ;<  *  bind:m
    %+  do-iris  /hosted-auth/pending-cleanup/1
    (reply '{"device_auth_id":"PRIVATE_DEVICE","user_code":"VISIBLE_CODE","interval":5}')
  ;<  late-state=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>(provider-keys.retained) !>(~))
  ;<  ~  bind:m  (ex-equal !>(api-key.retained) !>(''))
  ;<  ~  bind:m  (ex-equal !>(flows.hosted.retained) !>(~))
  ;<  ~  bind:m  (ex-equal !>(active.openai-auth.retained) !>(~))
  ;<  ~  bind:m  (ex-equal !>(active.xai-auth.retained) !>(~))
  ;<  ~  bind:m  (ex-equal !>(flows.hosted.late-state) !>(~))
  (ex-equal !>(provider-keys.late-state) !>(~))
::
++  sends-hosted-auth-request
  |=  cards=(list card)
  (lien cards |=(c=card ?=([%pass [%hosted-auth *] %arvo %i %request *] c)))
::
++  test-hosted-login-survives-reload-and-disconnect-fences-response
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (setup ~2026.9.17 *state-0)
  =/  args  (pairs:enjs:format ~[['provider' %s 'openai'] ['requestId' %s 'integration-login']])
  =/  device
    (reply '{"device_auth_id":"PRIVATE_DEVICE","user_code":"VISIBLE_CODE","interval":5}')
  ;<  *  bind:m  (do-hosted 'start' 'start' args)
  ;<  saved=state-0  bind:m  get-state
  ;<  *  bind:m  (do-load head ~)
  ;<  retained=state-0  bind:m  get-state
  ;<  *  bind:m  (do-iris /hosted-auth/integration-login/1 device)
  ;<  polled=state-0  bind:m  get-state
  ;<  ~  bind:m  (wait ~s5)
  ;<  wake=(list card)  bind:m  (do-arvo /hosted-auth-poll/integration-login/1 [%behn %wake ~])
  ::  Only the wake runs late; what follows is back at the original time.
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now ~2026.9.17)))
  ;<  polling=state-0  bind:m  get-state
  ;<  *  bind:m  (do-hosted 'disconnect' 'disconnect' args)
  ;<  cleared=state-0  bind:m  get-state
  ;<  *  bind:m  (do-iris /hosted-auth/integration-login/2 device)
  ;<  after=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>(hosted.retained) !>(hosted.saved))
  ;<  ~  bind:m
    (ex-equal !>(phase:(~(got by flows.hosted.polled) 'integration-login')) !>(%poll))
  ;<  ~  bind:m  (ex-equal !>(flows.hosted.after) !>(~))
  ;<  ~  bind:m  (ex-equal !>(provider-keys.after) !>(provider-keys.cleared))
  ;<  ~  bind:m
    (ex-equal !>(serial:(~(got by flows.hosted.polling) 'integration-login')) !>(2))
  ;<  ~  bind:m
    (ex-equal !>(pending:(~(got by flows.hosted.polling) 'integration-login')) !>(&))
  (ex-equal !>((sends-hosted-auth-request wake)) !>(&))
::
++  test-hosted-access-rejects-remote-ships
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (setup ~2026.9.17 *state-0)
  ;<  ~  bind:m  (set-src ~nec)
  ;<  ~  bind:m  (ex-fail (do-hosted 'foreign' 'status' [%o ~]))
  (ex-fail (do-watch /hosted/foreign))
::
++  test-provision-survives-reload-and-preserves-owner-configuration
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved=state-0  *state-0
  =.  local-mcp-seen.saved  1
  =.  defaults.saved  builtin-config:defaults
  =.  model.defaults.saved  'owner-choice'
  =.  provider-keys.saved  (my ~[['openai-device' 'subscription']])
  =.  mcp-servers.saved  (my ~[['local' ['Local' 'urbit://~zod/mcp-proxy' ~ &]]])
  ;<  ~  bind:m  (setup ~2026.9.17 saved)
  =/  args
    %-  need
    %-  de:json:html
    '{"providerKeys":{"openrouter":"platform","brave":"search"},"fallbacks":[{"provider":"openrouter","model":"z-ai/glm-5.3-flash:nitro"}]}'
  ;<  *  bind:m  (do-hosted 'provision' 'provision' args)
  ;<  next=state-0  bind:m  get-state
  ;<  ~  bind:m
    (ex-equal !>(fallbacks.defaults.next) !>(~[['openrouter' 'z-ai/glm-5.3-flash:nitro']]))
  ::  An explicit empty chain survives subsequent platform provisioning.
  =.  fallbacks.defaults.next  ~
  ;<  *  bind:m  (do-load head `!>(next))
  ;<  *  bind:m  (do-hosted 'again' 'provision' args)
  ;<  after=state-0  bind:m  get-state
  ::  A saved owner choice also takes precedence before initial provisioning;
  ::  start again from the original saved state.
  ;<  *  bind:m  (do-load head `!>(saved))
  ;<  *  bind:m  (do-poke %harness-action !>(`action:h`[%defaults defaults.saved]))
  ;<  *  bind:m  (do-hosted 'owner-first' 'provision' args)
  ;<  owner-first=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>(fallbacks.defaults.owner-first) !>(~))
  ;<  ~  bind:m  (ex-equal !>(provider-keys.after) !>(provider-keys.next))
  ;<  ~  bind:m  (ex-equal !>(model.defaults.after) !>('owner-choice'))
  ;<  ~  bind:m  (ex-equal !>(fallbacks.defaults.after) !>(~))
  ;<  ~  bind:m
    (ex-equal !>((key:auth provider-keys.after 'openai-device')) !>('subscription'))
  ;<  ~  bind:m  (ex-equal !>((key:auth provider-keys.after 'openrouter')) !>('platform'))
  ;<  ~  bind:m  (ex-equal !>((mcp-granted:ht 'local' tools.defaults.after)) !>(&))
  (ex-equal !>(sessions.after) !>(sessions.saved))
::
::  Bodies of the LLM requests among the emitted cards.
::
++  llm-bodies
  |=  cards=(list card)
  ^-  (list @t)
  %+  murn  cards
  |=  c=card
  ^-  (unit @t)
  ?.  ?=([%pass [%llm *] %arvo %i %request *] c)  ~
  =/  sent=http-card:renew  c
  ?~  body.request.sent  ~
  `q.u.body.request.sent
::
++  test-owner-first-turn-advertises-live-tools-despite-empty-session-grants
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved=state-0  *state-0
  =.  local-mcp-seen.saved  1
  =.  mcp-servers.saved  (my ~[['local' ['Local' 'urbit://~zod/mcp-proxy' ~ &]]])
  ;<  ~  bind:m  (setup ~2026.9.17 saved)
  =/  cfg  builtin-config:defaults
  =.  cfg  cfg(tools ~, url 'https://openrouter.ai/api/v1/chat/completions', key 'fixture-key')
  ;<  *  bind:m  (do-poke %harness-action !>(`action:h`[%new 'owner' cfg ~s30]))
  ;<  caz=(list card)  bind:m
    (do-poke %harness-action !>(`action:h`[%send 'owner' 'What tools can you use?']))
  =/  requests  (llm-bodies caz)
  ;<  ~  bind:m  (ex-equal !>((lent requests)) !>(1))
  =/  payload  (need (de:json:html (snag 0 requests)))
  =/  tools  (need (get:j payload 'tools'))
  ?>  ?=(%a -.tools)
  =/  names
    (turn p.tools |=(entry=json (string:j (need (get:j entry 'function')) 'name')))
  ;<  ~  bind:m  (ex-equal !>((lien names |=(n=@t =('run_js' n)))) !>(&))
  ;<  ~  bind:m  (ex-equal !>((lien names |=(n=@t =('list_mcp_tools' n)))) !>(&))
  (ex-equal !>((lien names |=(n=@t =('harness_admin' n)))) !>(&))
::
++  reply
  |=  body=@t
  ^-  client-response:iris
  [%finished [200 ~] `['application/json' (as-octs:mimes:html body)]]
::
::  Model-list requests among the emitted cards.
::
++  model-requests
  |=  cards=(list card)
  ^-  (list http-card:renew)
  %+  murn  cards
  |=  c=card
  ^-  (unit http-card:renew)
  ?.  ?=([%pass [%models *] %arvo %i %request *] c)  ~
  `c
::
++  test-xai-native-login-and-renewal-survive-head-reload
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (setup ~2026.9.17 *state-0)
  ;<  *  bind:m
    %^  do-acp-frame  1  'xai-fixture'
    '{"jsonrpc":"2.0","id":1,"method":"harness/provider/login","params":{"action":"start","provider":"xai","requestId":"xai-integration"}}'
  ;<  *  bind:m
    %+  do-iris  /hosted-auth/xai-integration/1
    %-  reply
    '{"device_code":"PRIVATE","user_code":"ABCD-1234","verification_uri":"https://accounts.x.ai/oauth2/device","expires_in":1800,"interval":5}'
  ;<  ~  bind:m  (wait ~s5)
  ;<  *  bind:m  (do-arvo /hosted-auth-poll/xai-integration/1 [%behn %wake ~])
  ;<  *  bind:m
    %+  do-iris  /hosted-auth/xai-integration/2
    (reply '{"access_token":"ACCESS","refresh_token":"REFRESH","expires_in":3600}')
  ;<  *  bind:m
    (do-iris /hosted-auth/xai-integration/3 (reply '{"data":[{"id":"grok-build"}]}'))
  ;<  saved=state-0  bind:m  get-state
  ;<  ~  bind:m  (wait ~h1)
  ;<  *  bind:m  (do-load head ~)
  ;<  *  bind:m
    %^  do-acp-frame  2  'xai-fixture'
    '{"jsonrpc":"2.0","id":2,"method":"harness/provider/models","params":{"provider":"xai","url":"https://cli-chat-proxy.grok.com/v1/models"}}'
  ;<  pending=state-0  bind:m  get-state
  ;<  *  bind:m  (do-load head ~)
  ;<  renewed=(list card)  bind:m
    %+  do-iris  /xai-renew/1
    %-  reply
    '{"access_token":"ROTATED_ACCESS","refresh_token":"ROTATED_REFRESH","expires_in":3600}'
  ;<  after=state-0  bind:m  get-state
  =/  requests  (model-requests renewed)
  ;<  ~  bind:m  (ex-equal !>(?=(^ requests)) !>(&))
  ?>  ?=(^ requests)
  =/  sent  i.requests
  ;<  ~  bind:m  (ex-equal !>((key:auth provider-keys.saved 'xai-device')) !>('ACCESS'))
  ;<  ~  bind:m  (ex-equal !>(~(wyt by waiting.xai-auth.pending)) !>(1))
  ;<  ~  bind:m  (ex-equal !>(active.openai-auth.pending) !>(~))
  ;<  ~  bind:m
    (ex-equal !>((key:auth provider-keys.after 'xai-device')) !>('ROTATED_ACCESS'))
  ;<  ~  bind:m
    (ex-equal !>((key:auth provider-keys.after 'xai-refresh')) !>('ROTATED_REFRESH'))
  ;<  ~  bind:m  (ex-equal !>(url.request.sent) !>(xai-models:auth))
  ;<  ~  bind:m
    %+  ex-equal
      !>  %+  lien  header-list.request.sent
          |=([name=@t value=@t] &(=('authorization' name) =('Bearer ROTATED_ACCESS' value)))
    !>(&)
  %+  ex-equal
    !>(identity:(~(got by catalogs.hosted.after) 'xai'))
  !>((identity:ha provider-keys.after 'xai'))
--

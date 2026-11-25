::  Default-instructions layers through the full head: every writer, the
::  change feed and what new conversations inherit. Cards are inspected,
::  never delivered.
/-  *harness-store, h=harness, ac=acp, hosted=harness-hosted
/+  *test-agent, policy=harness-defaults, hl=harness, hj=harness-json,
    j=harness-workspace-json, content=harness-hosted-content
/=  head  /app/harness
|%
++  t0  ~2026.10.1
++  layered
  ^-  prompts:h
  (my ~[[%'AGENTS.md' 'Agents.'] [%'SOUL.md' 'Soul.']])
::  A bot with two layers and one conversation made from them.
++  fixture
  ^-  state-0
  =/  saved  *state-0
  =.  defaults.saved  builtin-config:policy
  =.  system.defaults.saved  'Agents.\0a\0aSoul.'
  =.  local-mcp-seen.saved  1
  =.  prompts.saved  layered
  saved(sessions (my ~[['old' [~[[%config-replaced defaults.saved]] 0]]]))
::  Every scry answers %.n. Loading opens the ACP subscription that frames
::  arrive on.
::
++  setup
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now t0)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  *  bind:m  (do-load head `!>(fixture))
  (pure:m ~)
++  get-state
  =/  m  (mare ,state-0)
  ^-  form:m
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-0 vase))
++  set-layer
  |=  [name=prompt-name:h body=@t]
  (do-poke %harness-action !>(`action:h`[%prompt-set name body]))
::  Layer maps the head gave its prompt subscribers in one event.
++  feed
  |=  cards=(list card)
  ^-  (list prompts:h)
  %+  murn  cards
  |=  =card
  ^-  (unit prompts:h)
  ?.  ?=([%give %fact [[%v1 %prompt-events ~] ~] %harness-prompts-1 *] card)
    ~
  `!<(prompts:h q.cage.p.card)
::  Send one ACP request and return its result.
++  do-acp
  |=  [id=@ud method=@t params=json]
  =/  m  (mare ,json)
  ^-  form:m
  ;<  reply=json  bind:m  (do-acp-reply id method params)
  =/  result  (get:j reply 'result')
  ?~  result  |=(s=state |+~[leaf+"no result for {(trip method)}"])
  (pure:m u.result)
::  Send one ACP request and return its error message.
++  do-acp-error
  |=  [id=@ud method=@t params=json]
  =/  m  (mare ,@t)
  ^-  form:m
  ;<  reply=json  bind:m  (do-acp-reply id method params)
  =/  error  (get:j reply 'error')
  ?~  error  |=(s=state |+~[leaf+"no error for {(trip method)}"])
  (pure:m (string:j u.error 'message'))
::  Send one ACP request and return its one reply.
++  do-acp-reply
  |=  [id=@ud method=@t params=json]
  =/  m  (mare ,json)
  ^-  form:m
  =/  payload
    %-  en:json:html
    %-  pairs:enjs:format
    :~  ['jsonrpc' %s '2.0']  ['id' (numb:enjs:format id)]  ['method' %s method]
        ['params' params]
    ==
  =/  =update:v1:ac  [%messages 'fixture' %agent ~[[id t0 payload]]]
  ;<  out=(list card)  bind:m
    (do-agent /acp/watch [~zod %acp] [%fact %acp-update-1 !>(update)])
  =/  replies
    %+  murn  out
    |=  =card
    ^-  (unit json)
    ?.  ?=([%pass [%acp %send ~] %agent * %poke %acp-action-1 *] card)  ~
    =/  [pass=* wire=* agent=* target=* poke=* mark=* data=vase]  card
    =/  action  !<(action:v1:ac data)
    ?>  ?=(%send -.action)
    (de:json:html payload.action)
  ?~  replies  |=(s=state |+~[leaf+"no reply for {(trip method)}"])
  (pure:m i.replies)
::  The body of a hosted reply in one event.
++  hosted-body
  |=  cards=(list card)
  ^-  json
  =/  replies
    %+  murn  cards
    |=  =card
    ^-  (unit json)
    ?.  ?=([%give %fact [[%hosted @ ~] ~] %json *] card)  ~
    `!<(json q.cage.p.card)
  (need (get:j (snag 0 replies) 'body'))
::
++  test-new-prompt-subscriber-alone-gets-the-full-map
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~                bind:m  setup
  ;<  out=(list card)  bind:m  (do-watch /v1/prompt-events)
  (ex-cards out ~[(ex-fact ~ %harness-prompts-1 !>(layered))])
++  test-foreign-ship-cannot-watch-prompts
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  (ex-fail ((do-as ~nec) (do-watch /v1/prompt-events)))
++  test-the-prompt-scry-returns-the-typed-layers
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~      bind:m  setup
  ;<  =cage  bind:m  (got-peek /x/v1/prompts)
  ;<  ~      bind:m  (ex-equal !>(p.cage) !>(%harness-prompts-1))
  (ex-equal q.cage !>(layered))
::
++  test-setting-one-layer-leaves-the-others
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  added  (~(put by layered) %'USER.md' 'User.')
  ;<  ~                    bind:m  setup
  ;<  set=(list card)      bind:m  (set-layer %'USER.md' 'User.')
  ;<  after=state-0        bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>(prompts.after) !>(added))
  ;<  ~  bind:m  (ex-equal !>(system.defaults.after) !>('Agents.\0a\0aSoul.\0a\0aUser.'))
  ;<  ~  bind:m  (ex-equal !>((feed set)) !>(~[added]))
  ::  Empty text clears the layer rather than storing it.
  ;<  cleared=(list card)  bind:m  (set-layer %'USER.md' '')
  ;<  final=state-0        bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>(prompts.final) !>(layered))
  ;<  ~  bind:m  (ex-equal !>(system.defaults.final) !>('Agents.\0a\0aSoul.'))
  (ex-equal !>((feed cleared)) !>(~[layered]))
::  The changed set in the same test shows the poke path ran.
++  test-an-identical-layer-set-gives-no-fact
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~                     bind:m  setup
  ;<  same=(list card)      bind:m  (set-layer %'SOUL.md' 'Soul.')
  ;<  after=state-0         bind:m  get-state
  ;<  changed=(list card)   bind:m  (set-layer %'SOUL.md' 'Other.')
  ;<  ~  bind:m  (ex-equal !>(prompts.after) !>(layered))
  ;<  ~  bind:m  (ex-equal !>((feed same)) !>(`(list prompts:h)`~))
  (ex-equal !>((lent (feed changed))) !>(1))
++  test-a-bad-layer-name-or-oversized-text-is-refused
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (ex-fail (do-poke %noun !>([%prompt-set 'EVIL.md' 'x'])))
  ;<  ~  bind:m  (ex-fail (do-poke %harness-action !>([%prompt-set 'EVIL.md' 'x'])))
  ;<  ~  bind:m  (ex-fail (set-layer %'USER.md' (fil 3 65.537 'a')))
  ;<  unchanged=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>(prompts.unchanged) !>(layered))
  ;<  *  bind:m  (set-layer %'USER.md' (fil 3 65.536 'a'))
  ;<  limit=state-0  bind:m  get-state
  (ex-equal !>((~(get by prompts.limit) %'USER.md')) !>(`(fil 3 65.536 'a')))
::
++  test-hosted-soul-reads-and-writes-the-agents-layer
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  hosted-soul
    |=  args=json
    (do-poke %harness-hosted !>(`request:hosted`['soul' 'soul' args]))
  ;<  ~                  bind:m  setup
  ;<  read=(list card)   bind:m  (hosted-soul (pairs:enjs:format ~))
  =/  body  (hosted-body read)
  ;<  ~  bind:m  (ex-equal !>((string:j body 'body')) !>('Agents.'))
  ;<  ~  bind:m  (ex-equal !>((feed read)) !>(`(list prompts:h)`~))
  ;<  wrote=(list card)  bind:m
    %-  hosted-soul
    %-  pairs:enjs:format
    :~  ['revision' %s (soul-revision:content 'Agents.')]
        ['body' %s 'Hosted.']
    ==
  ;<  after=state-0      bind:m  get-state
  =/  expected  (~(put by layered) %'AGENTS.md' 'Hosted.')
  ;<  ~  bind:m  (ex-equal !>((string:j (hosted-body wrote) 'body')) !>('Hosted.'))
  ;<  ~  bind:m  (ex-equal !>(prompts.after) !>(expected))
  ;<  ~  bind:m  (ex-equal !>(system.defaults.after) !>('Hosted.\0a\0aSoul.'))
  ;<  ~  bind:m  (ex-equal !>((feed wrote)) !>(~[expected]))
  ::  The revision names the layer, not the composition.
  ;<  stale=(list card)  bind:m
    %-  hosted-soul
    %-  pairs:enjs:format
    :~  ['revision' %s (soul-revision:content 'Hosted.\0a\0aSoul.')]
        ['body' %s 'Stale.']
    ==
  ;<  ~  bind:m  (ex-equal !>((feed stale)) !>(`(list prompts:h)`~))
  (ex-equal !>((number:j (snag 0 (hosted-replies stale)) 'status' 0)) !>(409))
++  hosted-replies
  |=  cards=(list card)
  ^-  (list json)
  %+  murn  cards
  |=  =card
  ^-  (unit json)
  ?.  ?=([%give %fact [[%hosted @ ~] ~] %json *] card)  ~
  `!<(json q.cage.p.card)
++  test-defaults-read-and-configure-address-the-agents-layer
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~         bind:m  setup
  ;<  read=json  bind:m  (do-acp 1 'harness/defaults' (pairs:enjs:format ~))
  ;<  ~  bind:m  (ex-equal !>((string:j read 'system')) !>('Agents.'))
  ?>  ?=(%o -.read)
  =/  config=json
    [%o (~(gas by p.read) ~[['system' %s 'Configured.'] ['key' %s '']])]
  ;<  saved=json  bind:m
    (do-acp 2 'harness/defaults/configure' (pairs:enjs:format ~[['config' config]]))
  ;<  after=state-0  bind:m  get-state
  =/  expected  (~(put by layered) %'AGENTS.md' 'Configured.')
  ;<  ~  bind:m  (ex-equal !>((string:j saved 'system')) !>('Configured.'))
  ;<  ~  bind:m  (ex-equal !>(prompts.after) !>(expected))
  (ex-equal !>(system.defaults.after) !>('Configured.\0a\0aSoul.'))
++  test-a-native-defaults-write-lands-in-agents-md-and-shows-on-the-feed
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~                bind:m  setup
  =/  =config:h  builtin-config:policy
  ;<  out=(list card)  bind:m
    (do-poke %harness-action !>(`action:h`[%defaults config(system 'Native.')]))
  =/  expected  (~(put by layered) %'AGENTS.md' 'Native.')
  ;<  after=state-0    bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>(prompts.after) !>(expected))
  (ex-equal !>((feed out)) !>(~[expected]))
::
++  test-a-new-conversation-inherits-the-composed-text-and-an-existing-one-keeps-its-own
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~       bind:m  setup
  ;<  *       bind:m  (set-layer %'USER.md' 'User.')
  ;<  *       bind:m  (do-acp 1 'session/new' (pairs:enjs:format ~[['name' %s 'fresh']]))
  ;<  after=state-0  bind:m  get-state
  =/  system-of
    |=(sid=@t system:config:(play:hl log:(~(got by sessions.after) sid)))
  ;<  ~  bind:m  (ex-equal !>((system-of 'fresh')) !>('Agents.\0a\0aSoul.\0a\0aUser.'))
  ;<  ~  bind:m  (ex-equal !>((system-of 'old')) !>('Agents.\0a\0aSoul.'))
  ::  The Tlon hand makes its conversations from this scry.
  ;<  =cage  bind:m  (got-peek /x/defaults)
  %+  ex-equal
    !>((string:j !<(json q.cage) 'system'))
  !>('Agents.\0a\0aSoul.\0a\0aUser.')
::
++  test-a-set-memory-layer-does-not-reach-what-a-new-conversation-inherits
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  remembered  (~(put by layered) %'MEMORY.md' 'Private.')
  ;<  ~                bind:m  setup
  ;<  stored=(list card)  bind:m  (set-layer %'MEMORY.md' 'Private.')
  ;<  *                bind:m  (do-acp 1 'session/new' (pairs:enjs:format ~[['name' %s 'fresh']]))
  ;<  after=state-0    bind:m  get-state
  ;<  layers=cage      bind:m  (got-peek /x/v1/prompts)
  ::  It is stored, readable and on the feed.
  ;<  ~  bind:m  (ex-equal !>(prompts.after) !>(remembered))
  ;<  ~  bind:m  (ex-equal q.layers !>(remembered))
  ;<  ~  bind:m  (ex-equal !>((feed stored)) !>(~[remembered]))
  ::  It is not in the defaults, a new conversation, or the Tlon hand's scry.
  ;<  ~  bind:m  (ex-equal !>(system.defaults.after) !>('Agents.\0a\0aSoul.'))
  =/  fresh  system:config:(play:hl log:(~(got by sessions.after) 'fresh'))
  ;<  ~  bind:m  (ex-equal !>(fresh) !>('Agents.\0a\0aSoul.'))
  ;<  tlon=cage  bind:m  (got-peek /x/defaults)
  (ex-equal !>((string:j !<(json q.tlon) 'system')) !>('Agents.\0a\0aSoul.'))
::  'Agents.' and 'Soul.' with a blank line, then USER.md, are 65.552 bytes;
::  TOOLS.md of this size brings the composition to its limit.
++  to-the-limit
  ^-  @ud
  (sub composed-limit:policy 65.554)
++  fill-to-the-limit
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (set-layer %'USER.md' (fil 3 65.536 'u'))
  ;<  *  bind:m  (set-layer %'TOOLS.md' (fil 3 to-the-limit 't'))
  ;<  full=state-0  bind:m  get-state
  (ex-equal !>((met 3 system.defaults.full)) !>(composed-limit:policy))
++  test-a-layer-set-may-reach-the-composed-limit-but-not-pass-it
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~             bind:m  fill-to-the-limit
  ;<  full=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-fail (set-layer %'TOOLS.md' (fil 3 +(to-the-limit) 't')))
  ;<  ~  bind:m  (ex-fail (set-layer %'IDENTITY.md' 'x'))
  ;<  after=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>([prompts defaults]:after) !>([prompts defaults]:full))
  ::  MEMORY.md does not count toward it, but keeps its own limit.
  ;<  ~  bind:m  (ex-fail (set-layer %'MEMORY.md' (fil 3 65.537 'm')))
  ;<  *  bind:m  (set-layer %'MEMORY.md' (fil 3 65.536 'm'))
  ;<  final=state-0  bind:m  get-state
  (ex-equal !>((~(get by prompts.final) %'MEMORY.md')) !>(`(fil 3 65.536 'm')))
++  test-a-defaults-write-past-the-composed-limit-is-refused-and-changes-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~             bind:m  fill-to-the-limit
  ;<  full=state-0  bind:m  get-state
  =/  longer  defaults.full(system 'Agents!!', key '')
  ;<  ~  bind:m
    (ex-fail (do-poke %harness-action !>(`action:h`[%defaults longer])))
  ;<  read=json  bind:m  (do-acp 1 'harness/defaults' (pairs:enjs:format ~))
  ?>  ?=(%o -.read)
  =/  config=json
    [%o (~(gas by p.read) ~[['system' %s 'Agents!!'] ['key' %s '']])]
  ;<  refused=@t  bind:m
    %^  do-acp-error  2  'harness/defaults/configure'
    (pairs:enjs:format ~[['config' config]])
  ;<  ~  bind:m
    (ex-equal !>(refused) !>('Default instructions must be at most 131072 bytes in all.'))
  ;<  after=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>([prompts defaults]:after) !>([prompts defaults]:full))
  ::  A shorter text is accepted.
  ;<  *  bind:m
    (do-poke %harness-action !>(`action:h`[%defaults longer(system 'Agent.')]))
  ;<  shorter=state-0  bind:m  get-state
  (ex-equal !>((~(get by prompts.shorter) %'AGENTS.md')) !>(`'Agent.'))
++  test-a-hosted-soul-write-past-the-composed-limit-is-refused-and-changes-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~             bind:m  fill-to-the-limit
  ;<  full=state-0  bind:m  get-state
  ;<  out=(list card)  bind:m
    %+  do-poke  %harness-hosted
    !>  ^-  request:hosted
    :+  'soul'  'soul'
    %-  pairs:enjs:format
    :~  ['revision' %s (soul-revision:content 'Agents.')]
        ['body' %s 'Agents!!']
    ==
  ;<  after=state-0  bind:m  get-state
  =/  reply  (snag 0 (hosted-replies out))
  ;<  ~  bind:m  (ex-equal !>((number:j reply 'status' 0)) !>(400))
  ;<  ~  bind:m  (ex-equal !>((feed out)) !>(`(list prompts:h)`~))
  (ex-equal !>([prompts defaults]:after) !>([prompts defaults]:full))
--

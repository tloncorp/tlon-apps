::  steward prompts: projection, relay, replay and HTTP behavior
::
/-  s=steward, pr=steward-prompts, au=steward-automation, l=steward-lens, g=steward-gateway
/+  *test-agent, pj=steward-prompts-json
/=  agent  /app/steward
|%
+$  state-4
  $:  %4
      owner=(unit ship)
      bots=(set ship)
      lens=state:v1:l
      gateway=state:v1:g
      automation=state:v1:au
      prompts=state:v1:pr
  ==
++  moon  ^-  ship  ~bus
++  setup
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (do-init %steward agent)
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev, now ~2024.1.1)))
  (pure:m ~)
++  configure
  |=  owner=ship
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%configure owner]))
  (pure:m ~)
++  trust
  |=  bot=ship
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%trust-bot bot]))
  (pure:m ~)
::  an owner that already manages +moon. only a managed bot may be sent a
::  workspace edit, so every relay test starts from here
::
++  setup-owner
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (trust moon)
  (pure:m ~)
++  got-state
  =/  m  (mare ,state-4)
  ^-  form:m
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  (pure:m !<(state-4 !<(vase q.res)))
++  rid  ^-  request-id:v1:pr  `@uv`0x1234.5678
++  edit-set  ^-  edit:v1:pr  [%set 'SOUL.md' 'new text']
++  updated  ^-  outcome:v1:pr  [%updated 'SOUL.md']
++  req-wire
  |=  [bot=ship kind=@ta]
  ^-  wire
  /prompts/req/(scot %p bot)/(scot %uv rid)/[kind]
++  req-path
  |=  requester=ship
  ^-  path
  /v1/prompts/request/(scot %p requester)/(scot %uv rid)
++  local-req-path  ^-  path  /v1/prompts/request/(scot %uv rid)
++  harness-path  ^-  path  /v1/prompts/harness
++  cleanup-wire  ^-  wire  /prompts/cleanup
::
++  do-edit
  |=  [bot=ship =edit:v1:pr]
  (do-poke %steward-prompts-action-1 !>(`action:v1:pr`[%edit rid bot edit]))
++  do-command
  |=  =edit:v1:pr
  (do-poke %steward-prompts-command-1 !>(`c-prompts:v1:pr`[%edit rid edit]))
++  do-finalize
  |=  body=outcome:v1:pr
  (do-poke %steward-prompts-action-1 !>(`action:v1:pr`[%finalize rid body]))
++  do-req-watch-sign
  |=  [bot=ship =sign:agent:gall]
  (do-agent (req-wire bot %watch) [bot %steward] sign)
++  do-req-poke-sign
  |=  [bot=ship =sign:agent:gall]
  (do-agent (req-wire bot %poke) [bot %steward] sign)
++  do-req-wake
  |=  bot=ship
  (do-arvo (req-wire bot %wake) [%behn %wake ~])
++  do-cleanup-wake
  (do-arvo cleanup-wire [%behn %wake ~])
++  response-fact
  |=  body=response-body:v1:pr
  ^-  sign:agent:gall
  [%fact %steward-prompts-response-1 !>(`response:v1:pr`[rid body])]
::
++  ex-req-watch
  |=  bot=ship
  (ex-task (req-wire bot %watch) [bot %steward] %watch (req-path ~dev))
++  ex-req-poke
  |=  [bot=ship =edit:v1:pr]
  %^  ex-task  (req-wire bot %poke)  [bot %steward]
  [%poke %steward-prompts-command-1 !>(`c-prompts:v1:pr`[%edit rid edit])]
++  ex-req-wake
  |=  [bot=ship at=@da]
  (ex-card %pass (req-wire bot %wake) %arvo %b %wait (add at ~s20))
++  ex-req-leave
  |=  bot=ship
  (ex-task (req-wire bot %watch) [bot %steward] %leave ~)
++  ex-local-response
  |=  body=response-body:v1:pr
  %^  ex-fact  ~[local-req-path]  %steward-prompts-response-1
  !>(`response:v1:pr`[rid body])
++  ex-bot-response
  |=  [requester=ship body=response-body:v1:pr]
  %^  ex-fact  ~[(req-path requester)]  %steward-prompts-response-1
  !>(`response:v1:pr`[rid body])
++  ex-dispatch
  |=  [paths=(list path) requester=ship =edit:v1:pr]
  %^  ex-fact  paths  %steward-prompts-dispatch-1
  !>(`dispatch:v1:pr`[rid requester edit])
++  ex-cleanup-timer
  |=  at=@da
  (ex-card %pass cleanup-wire %arvo %b %wait (add at ~m5))
++  ex-eyre-connect
  (ex-card %pass /eyre/steward %arvo %e %connect [~ /steward] %steward)
++  ex-files-watch
  |=  bot=ship
  %^  ex-task  /prompts/files/(scot %p bot)  [bot %steward]
  [%watch /v1/prompts/files]
++  do-bot-sign
  |=  [bot=ship =sign:agent:gall]
  (do-agent /prompts/files/(scot %p bot) [bot %steward] sign)
++  ex-relay
  |=  [bot=ship =edit:v1:pr at=@da]
  ^-  (list $-(card tang))
  ~[(ex-req-watch bot) (ex-req-poke bot edit) (ex-req-wake bot at)]
::
++  got-request
  =/  m  (mare ,incoming-request:v1:pr)
  ^-  form:m
  ;<  st=state-4  bind:m  got-state
  (pure:m (~(got by requests.prompts.st) rid))
++  got-requests
  =/  m  (mare ,requests:v1:pr)
  ^-  form:m
  ;<  st=state-4  bind:m  got-state
  (pure:m requests.prompts.st)
++  got-pending
  =/  m  (mare ,pending:v1:pr)
  ^-  form:m
  ;<  st=state-4  bind:m  got-state
  (pure:m pending.prompts.st)
++  advance-clock
  |=  by=@dr
  (jab-bowl |=(b=bowl b(now (add now.b by))))
::
::  HTTP fixtures
::
++  http-request
  |=  [authenticated=? method=method:http url=@t body=(unit @t)]
  ^-  inbound-request:eyre
  :*  authenticated
      |
      [%ipv4 .127.0.0.1]
      [method url ~ ?~(body ~ `(as-octs:mimes:html u.body))]
  ==
++  do-http
  |=  [eyre-id=@ta req=inbound-request:eyre]
  (do-poke %handle-http-request !>([eyre-id req]))
++  ex-http
  |=  [eyre-id=@ta code=@ud ct=@t body=@t]
  ^-  (list $-(card tang))
  =/  paths=(list path)  ~[/http-response/[eyre-id]]
  :~  %^  ex-fact  paths  %http-response-header
      !>(`response-header:http`[code ~[['content-type' ct]]])
      (ex-fact paths %http-response-data !>(`(unit octs)``(as-octs:mimes:html body)))
      (ex-card %give %kick paths ~)
  ==
++  ex-http-response
  |=  [eyre-id=@ta body=response-body:v1:pr]
  ^-  (list $-(card tang))
  %-  ex-http
  :^  eyre-id  200  'application/json'
  (en:json:html (response:enjs:pj [rid body]))
++  edit-url  ^-  @t  '/steward/~/v1/prompts'
++  finalize-url  ^-  @t  '/steward/~/v1/prompts/finalize'
++  request-url
  ^-  @t
  (crip "/steward/~/v1/prompts/request/{(scow %uv rid)}")
++  edit-post-body
  |=  with-rid=?
  ^-  @t
  =/  fields=(list [@t json])
    :~  ['bot' s+(scot %p moon)]
        ['action' (edit:enjs:pj edit-set)]
    ==
  =?  fields  with-rid  [['requestId' s+(scot %uv rid)] fields]
  (en:json:html (pairs:enjs:format fields))
++  finalize-post-body
  |=  body=outcome:v1:pr
  ^-  @t
  %-  en:json:html
  %-  pairs:enjs:format
  :~  ['requestId' (request-id:enjs:pj rid)]
      ['body' (response-body:enjs:pj body)]
  ==
++  ex-finalize-http
  |=  [eyre-id=@ta finalized=?]
  ^-  (list $-(card tang))
  %-  ex-http
  :^  eyre-id  200  'application/json'
  %-  en:json:html
  %-  pairs:enjs:format
  :~  ['requestId' (request-id:enjs:pj rid)]
      ['finalized' b+finalized]
  ==
::
::  ----------------------------------------------------------
::  owner side
::  ----------------------------------------------------------
::
::  an edit registers a request and relays it: watch first, then the
::  command poke, then the pending wake
::
++  test-prompts-edit-registers-and-relays
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-owner
  ;<  caz=(list card)  bind:m  (do-edit moon edit-set)
  ;<  ~  bind:m  (ex-cards caz (ex-relay moon edit-set ~2024.1.1))
  ;<  req=incoming-request:v1:pr  bind:m  got-request
  ;<  ~  bind:m  (ex-equal !>(bot.req) !>(moon))
  ;<  ~  bind:m  (ex-equal !>(http-id.req) !>(*(unit @ta)))
  ;<  ~  bind:m  (ex-equal !>(poke-status.req) !>(%sending))
  (ex-equal !>(result.req) !>(*(unit response-body:v1:pr)))
::
++  test-prompts-edit-rejects-foreign-source
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-owner
  ;<  ~  bind:m
    %-  ex-fail
    %-  (do-as ~zod)
    (do-edit moon edit-set)
  ;<  reqs=requests:v1:pr  bind:m  got-requests
  (ex-equal !>(reqs) !>(*requests:v1:pr))
::
::  a nacked per-request watch is a typed not-authorized response
::
++  test-prompts-edit-watch-nack-is-not-authorized
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  why=tang  ~[leaf+"denied"]
  ;<  ~  bind:m  setup-owner
  ;<  *  bind:m  (do-edit moon edit-set)
  ;<  caz=(list card)  bind:m  (do-req-watch-sign moon %watch-ack `why)
  ;<  ~  bind:m
    (ex-cards caz ~[(ex-local-response [%error %not-authorized why])])
  ;<  req=incoming-request:v1:pr  bind:m  got-request
  (ex-equal !>(result.req) !>(`[%error %not-authorized why]))
::
++  test-prompts-edit-poke-ack-marks-acked
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-owner
  ;<  *  bind:m  (do-edit moon edit-set)
  ;<  caz=(list card)  bind:m  (do-req-poke-sign moon %poke-ack ~)
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  req=incoming-request:v1:pr  bind:m  got-request
  (ex-equal !>(poke-status.req) !>(%acked))
::
::  a nacked command is a typed unknown response, and the watch is left
::
++  test-prompts-edit-poke-nack-is-unknown
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  why=tang  ~[leaf+"crash"]
  ;<  ~  bind:m  setup-owner
  ;<  *  bind:m  (do-edit moon edit-set)
  ;<  caz=(list card)  bind:m  (do-req-poke-sign moon %poke-ack `why)
  ;<  ~  bind:m
    (ex-cards caz ~[(ex-local-response [%error %unknown why]) (ex-req-leave moon)])
  ;<  req=incoming-request:v1:pr  bind:m  got-request
  ;<  ~  bind:m  (ex-equal !>(poke-status.req) !>(%nacked))
  (ex-equal !>(result.req) !>(`[%error %unknown why]))
::
::  the bot's response finalizes the request on the client's path and
::  leaves the bot watch
::
++  test-prompts-edit-response-finalizes-and-leaves
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-owner
  ;<  *  bind:m  (do-edit moon edit-set)
  ;<  caz=(list card)  bind:m  (do-req-watch-sign moon (response-fact updated))
  ;<  ~  bind:m
    (ex-cards caz ~[(ex-local-response updated) (ex-req-leave moon)])
  ;<  req=incoming-request:v1:pr  bind:m  got-request
  ;<  ~  bind:m  (ex-equal !>(result.req) !>(`updated))
  (ex-equal !>(final-at.req) !>(`~2024.1.1))
::
::  a response naming another request is ignored
::
++  test-prompts-edit-response-for-other-id-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  other=response:v1:pr  [`@uv`0xdead updated]
  ;<  ~  bind:m  setup-owner
  ;<  *  bind:m  (do-edit moon edit-set)
  ;<  caz=(list card)  bind:m
    (do-req-watch-sign moon %fact %steward-prompts-response-1 !>(other))
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  req=incoming-request:v1:pr  bind:m  got-request
  (ex-equal !>(result.req) !>(*(unit response-body:v1:pr)))
::
::  the wake marks the request pending; a late response still lands
::
++  test-prompts-edit-wake-pends-then-late-response-lands
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-owner
  ;<  *  bind:m  (do-edit moon edit-set)
  ;<  caz=(list card)  bind:m  (do-req-wake moon)
  ;<  ~  bind:m  (ex-cards caz ~[(ex-local-response [%pending %sending])])
  ;<  req=incoming-request:v1:pr  bind:m  got-request
  ;<  ~  bind:m  (ex-equal !>(result.req) !>(`[%pending %sending]))
  ;<  caz=(list card)  bind:m  (do-req-watch-sign moon (response-fact updated))
  ;<  ~  bind:m
    (ex-cards caz ~[(ex-local-response updated) (ex-req-leave moon)])
  ;<  req=incoming-request:v1:pr  bind:m  got-request
  (ex-equal !>(result.req) !>(`updated))
::
++  test-prompts-edit-wake-after-terminal-is-silent
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-owner
  ;<  *  bind:m  (do-edit moon edit-set)
  ;<  *  bind:m  (do-req-watch-sign moon (response-fact updated))
  ;<  caz=(list card)  bind:m  (do-req-wake moon)
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  req=incoming-request:v1:pr  bind:m  got-request
  (ex-equal !>(result.req) !>(`updated))
::
::  a client subscribing after the result landed gets it at once; before
::  it lands, nothing; a foreign ship never gets it
::
++  test-prompts-edit-local-request-watch-replays-result
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-owner
  ;<  *  bind:m  (do-edit moon edit-set)
  ;<  caz=(list card)  bind:m  (do-watch local-req-path)
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  *  bind:m  (do-req-watch-sign moon (response-fact updated))
  ;<  *  bind:m  (do-leave local-req-path)
  ;<  caz=(list card)  bind:m  (do-watch local-req-path)
  %+  ex-cards  caz
  ~[(ex-fact ~ %steward-prompts-response-1 !>(`response:v1:pr`[rid updated]))]
::
++  test-prompts-edit-local-request-watch-rejects-foreign
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-owner
  ;<  *  bind:m  (do-edit moon edit-set)
  %-  ex-fail
  %-  (do-as ~zod)
  (do-watch local-req-path)
::
::  sweep: a recent unfetched terminal record survives; an aged one, a
::  pending one past its hour, and a fetched one are evicted; an
::  in-flight record is left for its wake
::
++  test-prompts-command-requires-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m
    %-  ex-fail
    %-  (do-as ~bus)
    (do-command edit-set)
  ;<  ~  bind:m  (configure ~bus)
  ;<  ~  bind:m
    %-  ex-fail
    %-  (do-as ~zod)
    (do-command edit-set)
  ;<  ~  bind:m  (ex-fail (do-command edit-set))
  ;<  pen=pending:v1:pr  bind:m  got-pending
  (ex-equal !>(pen) !>(*pending:v1:pr))
::
::  with no harness subscribed the bot refuses at once
::
++  test-prompts-command-harness-offline-fails-fast
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  caz=(list card)  bind:m
    %-  (do-as ~bus)
    (do-command edit-set)
  ;<  ~  bind:m
    (ex-cards caz ~[(ex-bot-response ~bus [%error %harness-offline ~])])
  ;<  pen=pending:v1:pr  bind:m  got-pending
  (ex-equal !>(pen) !>(*pending:v1:pr))
::
::  with a harness subscribed the command is recorded and dispatched
::
++  test-prompts-command-dispatches-to-harness
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  caz=(list card)  bind:m  (do-watch harness-path)
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  caz=(list card)  bind:m
    %-  (do-as ~bus)
    (do-command edit-set)
  ;<  ~  bind:m  (ex-cards caz ~[(ex-dispatch ~[harness-path] ~bus edit-set)])
  ;<  pen=pending:v1:pr  bind:m  got-pending
  =/  expected=pending-command:v1:pr  [rid ~bus edit-set ~2024.1.1 ~]
  (ex-equal !>((~(get by pen) rid)) !>(`expected))
::
++  test-prompts-finalize-retains-result-for-dedup
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m  (do-watch harness-path)
  ;<  *  bind:m
    %-  (do-as ~bus)
    (do-command edit-set)
  ;<  caz=(list card)  bind:m  (do-finalize updated)
  ;<  ~  bind:m  (ex-cards caz ~[(ex-bot-response ~bus updated)])
  ;<  pen=pending:v1:pr  bind:m  got-pending
  (ex-equal !>(result:(~(got by pen) rid)) !>(`updated))
::
::  a late finalize, long after the owner's wake, still answers
::
++  test-prompts-finalize-late-still-responds
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m  (do-watch harness-path)
  ;<  *  bind:m
    %-  (do-as ~bus)
    (do-command edit-set)
  ;<  ~  bind:m  (advance-clock ~m10)
  ;<  caz=(list card)  bind:m  (do-finalize updated)
  (ex-cards caz ~[(ex-bot-response ~bus updated)])
::
++  test-prompts-finalize-unknown-id-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  caz=(list card)  bind:m  (do-finalize updated)
  (ex-cards caz ~)
::
++  test-prompts-finalize-rejects-foreign-source
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  %-  ex-fail
  %-  (do-as ~bus)
  (do-finalize updated)
::
::  a harness (re)subscribing receives every outstanding command; a
::  foreign ship cannot subscribe
::
++  test-prompts-harness-watch-replays-pending
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m  (do-watch harness-path)
  ;<  *  bind:m
    %-  (do-as ~bus)
    (do-command edit-set)
  ;<  *  bind:m  (do-leave harness-path)
  ;<  caz=(list card)  bind:m  (do-watch harness-path)
  (ex-cards caz ~[(ex-dispatch ~ ~bus edit-set)])
::
++  test-prompts-harness-watch-rejects-foreign
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  %-  ex-fail
  %-  (do-as ~bus)
  (do-watch harness-path)
::
::  the bot's per-request path admits only the owner, on its own path
::
++  test-prompts-request-watch-admits-owner-requester-only
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  caz=(list card)  bind:m
    %-  (do-as ~bus)
    (do-watch (req-path ~bus))
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  ~  bind:m
    %-  ex-fail
    %-  (do-as ~zod)
    (do-watch (req-path ~zod))
  %-  ex-fail
  %-  (do-as ~bus)
  (do-watch (req-path ~zod))
::
::  the edit loop never touches the file map
::
++  test-prompts-http-response-watch-accepted
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m  (do-watch /http-response/eyre-1)
  (ex-cards caz ~)
::
::  a remote ship cannot forge an eyre request or attach to a response path
::
++  test-prompts-http-rejects-remote-source
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-owner
  ;<  ~  bind:m
    %-  ex-fail
    %-  (do-as ~zod)
    (do-http 'eyre-1' (http-request & %'POST' edit-url `(edit-post-body &)))
  ;<  ~  bind:m
    %-  ex-fail
    %-  (do-as ~zod)
    (do-watch /http-response/eyre-1)
  ;<  reqs=requests:v1:pr  bind:m  got-requests
  (ex-equal !>(reqs) !>(*requests:v1:pr))
::
++  test-prompts-http-unauthenticated-is-401
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-owner
  ;<  caz=(list card)  bind:m
    (do-http 'eyre-1' (http-request | %'POST' edit-url `(edit-post-body &)))
  ;<  ~  bind:m  (ex-cards caz (ex-http 'eyre-1' 401 'text/plain' 'unauthorized'))
  ;<  reqs=requests:v1:pr  bind:m  got-requests
  (ex-equal !>(reqs) !>(*requests:v1:pr))
::
::  a POST registers the request with its eyre id and relays it; the
::  held request completes when the response lands
::
++  test-prompts-http-post-holds-then-completes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-owner
  ;<  caz=(list card)  bind:m
    (do-http 'eyre-1' (http-request & %'POST' edit-url `(edit-post-body &)))
  ;<  ~  bind:m  (ex-cards caz (ex-relay moon edit-set ~2024.1.1))
  ;<  req=incoming-request:v1:pr  bind:m  got-request
  ;<  ~  bind:m  (ex-equal !>(http-id.req) !>(`'eyre-1'))
  ;<  caz=(list card)  bind:m  (do-req-watch-sign moon (response-fact updated))
  ;<  ~  bind:m
    %+  ex-cards  caz
    ;:  weld
      `(list $-(card tang))`~[(ex-local-response updated)]
      (ex-http-response 'eyre-1' updated)
      `(list $-(card tang))`~[(ex-req-leave moon)]
    ==
  ;<  req=incoming-request:v1:pr  bind:m  got-request
  (ex-equal !>(http-id.req) !>(*(unit @ta)))
::
::  the wake completes the held request with pending; the late response
::  is stored but does not complete it a second time
::
++  test-prompts-http-post-pending-completes-once
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-owner
  ;<  *  bind:m
    (do-http 'eyre-1' (http-request & %'POST' edit-url `(edit-post-body &)))
  ;<  caz=(list card)  bind:m  (do-req-wake moon)
  ;<  ~  bind:m
    %+  ex-cards  caz
    %+  weld  `(list $-(card tang))`~[(ex-local-response [%pending %sending])]
    (ex-http-response 'eyre-1' [%pending %sending])
  ;<  caz=(list card)  bind:m  (do-req-watch-sign moon (response-fact updated))
  ;<  ~  bind:m
    (ex-cards caz ~[(ex-local-response updated) (ex-req-leave moon)])
  ;<  req=incoming-request:v1:pr  bind:m  got-request
  (ex-equal !>(result.req) !>(`updated))
::
++  test-prompts-http-post-mints-request-id
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-owner
  ;<  *  bind:m
    (do-http 'eyre-1' (http-request & %'POST' edit-url `(edit-post-body |)))
  ;<  reqs=requests:v1:pr  bind:m  got-requests
  ;<  ~  bind:m  (ex-equal !>(~(wyt by reqs)) !>(1))
  =/  req=incoming-request:v1:pr  q:(head ~(tap by reqs))
  ;<  ~  bind:m  (ex-equal !>(bot.req) !>(moon))
  (ex-equal !>(http-id.req) !>(`'eyre-1'))
::
++  test-prompts-http-post-malformed-is-400
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-http 'eyre-1' (http-request & %'POST' edit-url `'nope'))
  ;<  ~  bind:m  (ex-cards caz (ex-http 'eyre-1' 400 'text/plain' 'invalid json'))
  ;<  caz=(list card)  bind:m
    (do-http 'eyre-2' (http-request & %'POST' edit-url `'{"bot": "~zod"}'))
  ;<  ~  bind:m
    (ex-cards caz (ex-http 'eyre-2' 400 'text/plain' 'missing `action` field'))
  ;<  caz=(list card)  bind:m
    %+  do-http  'eyre-3'
    (http-request & %'POST' edit-url `'{"bot": "~zod", "action": {"explode": {}}}')
  ;<  ~  bind:m  (ex-cards caz (ex-http 'eyre-3' 400 'text/plain' 'malformed action'))
  ;<  reqs=requests:v1:pr  bind:m  got-requests
  (ex-equal !>(reqs) !>(*requests:v1:pr))
::
++  test-prompts-http-wrong-method-is-405
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-http 'eyre-1' (http-request & %'GET' edit-url ~))
  (ex-cards caz (ex-http 'eyre-1' 405 'text/plain' 'method not allowed'))
::
::  GET by id returns the record and marks it fetched; unknown is 404
::
++  test-prompts-http-get-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-owner
  ;<  caz=(list card)  bind:m
    (do-http 'eyre-1' (http-request & %'GET' request-url ~))
  ;<  ~  bind:m
    (ex-cards caz (ex-http 'eyre-1' 404 'text/plain' 'request not found'))
  ;<  *  bind:m  (do-edit moon edit-set)
  ;<  caz=(list card)  bind:m
    (do-http 'eyre-2' (http-request & %'GET' request-url ~))
  ;<  ~  bind:m  (ex-cards caz (ex-http-response 'eyre-2' [%pending %sending]))
  ::  a pending read does not count as fetched
  ;<  req=incoming-request:v1:pr  bind:m  got-request
  ;<  ~  bind:m  (ex-equal !>(fetched.req) !>(|))
  ;<  *  bind:m  (do-req-watch-sign moon (response-fact updated))
  ;<  caz=(list card)  bind:m
    (do-http 'eyre-3' (http-request & %'GET' request-url ~))
  ;<  ~  bind:m  (ex-cards caz (ex-http-response 'eyre-3' updated))
  ;<  req=incoming-request:v1:pr  bind:m  got-request
  (ex-equal !>(fetched.req) !>(&))
::
++  test-prompts-http-unknown-route-is-404
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-http 'eyre-1' (http-request & %'GET' '/steward/~/v1/nope' ~))
  (ex-cards caz (ex-http 'eyre-1' 404 'text/plain' 'not found'))
::
::  OWNER-INITIATED RESTART NOTICES + LIVENESS PUBLICATION
::  ==========================================================
::
::  a %gateway-stop with an owner-initiated reason ('model-change') sends the
::  specific 🔧 notice even though the owner never messaged, and latches
::  notify-on-start. card order: %rest, DM, liveness poke, status fact.
::
::
++  files  ^-  prompts:v1:pr  (my ~[['SOUL.md' 'original']])
++  project
  |=  files=prompts:v1:pr
  (do-poke %steward-prompts-action-1 !>(`action:v1:pr`[%project files]))
++  bot-update
  |=  =update:v1:pr
  %^  do-agent  /prompts/files/(scot %p moon)  [moon %steward]
  [%fact %steward-prompts-update-1 !>(update)]
++  test-project-empty-is-present
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (project *prompts:v1:pr)
  ;<  st=state-4  bind:m  got-state
  (ex-equal !>((~(get by files.prompts.st) ~dev)) !>(`*prompts:v1:pr))
::
++  test-project-replaces-and-unchanged-is-silent
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (project files)
  ;<  caz=(list card)  bind:m  (project files)
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  caz=(list card)  bind:m  (project *prompts:v1:pr)
  ;<  ~  bind:m
    (ex-cards caz ~[(ex-fact ~[/v1/prompts/files] %steward-prompts-update-1 !>(`update:v1:pr`[%del ~dev 'SOUL.md']))])
  ;<  st=state-4  bind:m  got-state
  (ex-equal !>((~(get by files.prompts.st) ~dev)) !>(`*prompts:v1:pr))
::
++  test-project-is-local-only
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  %-  (do-as ~bus)
  (project files)
::
++  test-project-rejects-unsupported-file
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  (project (my ~[['../secret' 'text']]))
::
++  test-edit-and-finalize-leave-projection-untouched
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m  (project files)
  ;<  *  bind:m  (do-watch harness-path)
  ;<  *  bind:m  ((do-as ~bus) (do-command edit-set))
  ;<  *  bind:m  (do-finalize updated)
  ;<  st=state-4  bind:m  got-state
  (ex-equal !>((~(got by files.prompts.st) ~dev)) !>(files))
::
++  test-mirror-applies-only-wire-ship
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%trust-bot moon]))
  ;<  *  bind:m  (bot-update [%files (my ~[[moon files] [~zod files]])])
  ;<  *  bind:m  (bot-update [%set ~zod 'SOUL.md' 'forged'])
  ;<  st=state-4  bind:m  got-state
  (ex-equal !>(files.prompts.st) !>((my ~[[moon files]])))
::
++  test-untrust-removes-mirror-and-ignores-late-fact
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%trust-bot moon]))
  ;<  *  bind:m  (bot-update [%files (my ~[[moon files]])])
  ;<  *  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%untrust-bot moon]))
  ;<  caz=(list card)  bind:m
    %-  do
    |=  s=state
    %:  ~(on-agent agent.s bowl.s(src moon))
      /prompts/files/(scot %p moon)
      [%fact %steward-prompts-update-1 !>(`update:v1:pr`[%files (my ~[[moon files]])])]
    ==
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  st=state-4  bind:m  got-state
  (ex-equal !>(files.prompts.st) !>(*(map ship prompts:v1:pr)))
::
++  test-finalized-command-does-not-replay
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m  (do-watch harness-path)
  ;<  *  bind:m  ((do-as ~bus) (do-command edit-set))
  ;<  *  bind:m  (do-finalize updated)
  ;<  *  bind:m  (do-leave harness-path)
  ;<  caz=(list card)  bind:m  (do-watch harness-path)
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  caz=(list card)  bind:m  ((do-as ~bus) (do-command edit-set))
  (ex-cards caz ~[(ex-bot-response ~bus updated)])
::
++  test-http-duplicate-preserves-first-wait
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-owner
  ;<  *  bind:m
    (do-http 'first' (http-request & %'POST' edit-url `(edit-post-body &)))
  ;<  caz=(list card)  bind:m
    (do-http 'second' (http-request & %'POST' edit-url `(edit-post-body &)))
  ;<  ~  bind:m  (ex-cards caz (ex-http-response 'second' [%pending %sending]))
  ;<  req=incoming-request:v1:pr  bind:m  got-request
  (ex-equal !>(http-id.req) !>(`'first'))
::
++  test-http-conflicting-id-is-409
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-owner
  ;<  *  bind:m  (do-edit moon [%set 'SOUL.md' 'different'])
  ;<  caz=(list card)  bind:m
    (do-http 'second' (http-request & %'POST' edit-url `(edit-post-body &)))
  (ex-cards caz (ex-http 'second' 409 'text/plain' 'request id already used for another edit'))
::
++  test-http-finalize-answers-and-is-idempotent
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m  (do-watch harness-path)
  ;<  *  bind:m  ((do-as ~bus) (do-command edit-set))
  ;<  caz=(list card)  bind:m
    (do-http 'finalize' (http-request & %'POST' finalize-url `(finalize-post-body updated)))
  ;<  ~  bind:m
    %+  ex-cards  caz
    [(ex-bot-response ~bus updated) (ex-finalize-http 'finalize' &)]
  ;<  caz=(list card)  bind:m
    (do-http 'retry' (http-request & %'POST' finalize-url `(finalize-post-body updated)))
  (ex-cards caz (ex-finalize-http 'retry' |))
::
++  test-final-response-cannot-be-overwritten
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-owner
  ;<  *  bind:m  (do-edit moon edit-set)
  ;<  *  bind:m  (do-req-watch-sign moon (response-fact updated))
  ;<  *  bind:m  (do-req-poke-sign moon %poke-ack `~[leaf+"late nack"])
  ;<  req=incoming-request:v1:pr  bind:m  got-request
  (ex-equal !>(result.req) !>(`updated))
::
++  test-migrate-state-1-preserves-config
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  =/  old
    [%1 `~bus (sy ~[~zod]) *state:v1:l +:*state:v1:g]
  ;<  *  bind:m  (do-load agent `!>(old))
  ;<  st=state-4  bind:m  got-state
  ;<  ~  bind:m  (ex-equal !>(owner.st) !>(`~bus))
  ;<  ~  bind:m  (ex-equal !>(bots.st) !>((sy ~[~zod])))
  (ex-equal !>(prompts.st) !>(*state:v1:pr))
::
++  test-reload-preserves-projection-and-does-not-duplicate-timer
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (project files)
  ;<  st=state-4  bind:m  got-state
  ;<  caz=(list card)  bind:m  (do-load agent `!>(st))
  ;<  ~  bind:m  (ex-cards caz ~[ex-eyre-connect])
  ;<  after=state-4  bind:m  got-state
  (ex-equal !>(st) !>(after))
::
++  test-finalize-rejects-pending
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  (do-poke %steward-prompts-action-1 !>([%finalize rid %pending %acked]))
::
++  test-oversized-edit-is-rejected-before-relay
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-owner
  %-  ex-fail
  (do-edit moon [%set 'SOUL.md' (fil 3 65.537 'a')])
::
++  test-owner-change-does-not-replay-old-commands
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m  (do-watch harness-path)
  ;<  *  bind:m  ((do-as ~bus) (do-command edit-set))
  ;<  ~  bind:m  (configure ~zod)
  ;<  *  bind:m  (do-leave harness-path)
  ;<  caz=(list card)  bind:m  (do-watch harness-path)
  (ex-cards caz ~)
::
::  the harness's verdict on a replay authorized by a previous owner has
::  to settle that command; otherwise it stays pending and is replayed on
::  every resubscribe until the sweep, while the HTTP route already told
::  the harness it was finalized
::
++  test-finalize-after-owner-change-settles-captured-requester
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m  (do-watch harness-path)
  ;<  *  bind:m  ((do-as ~bus) (do-command edit-set))
  ;<  ~  bind:m  (configure ~zod)
  =/  denied=outcome:v1:pr  [%error %not-authorized ~]
  ;<  caz=(list card)  bind:m  (do-finalize denied)
  ;<  ~  bind:m  (ex-cards caz ~[(ex-bot-response ~bus denied)])
  ;<  pen=pending:v1:pr  bind:m  got-pending
  (ex-equal !>((bind (~(get by pen) rid) |=(p=pending-command:v1:pr result.p))) !>(``denied))
::
++  test-expired-request-releases-subscriptions
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-owner
  ;<  *  bind:m  (do-edit moon edit-set)
  ;<  *  bind:m  (do-req-wake moon)
  ;<  ~  bind:m  (advance-clock ~h2)
  ;<  caz=(list card)  bind:m  do-cleanup-wake
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-req-leave moon)
        (ex-card %give %kick ~[local-req-path] ~)
        (ex-cleanup-timer (add ~2024.1.1 ~h2))
    ==
  ;<  reqs=requests:v1:pr  bind:m  got-requests
  (ex-equal !>(reqs) !>(*requests:v1:pr))
::
::  only a bot this ship manages may be sent a workspace edit; the
::  automation relay enforces the same boundary
::
++  test-prompts-edit-requires-managed-bot
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  (do-edit moon edit-set)
::
++  test-prompts-http-edit-untrusted-bot-is-403
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-http 'eyre-1' (http-request & %'POST' edit-url `(edit-post-body &)))
  (ex-cards caz (ex-http 'eyre-1' 403 'text/plain' 'bot is not trusted'))
::
::  a nacked files watch schedules no retry, so the last good mirror is
::  kept rather than wiped until someone re-pokes %trust-bot
::
++  test-prompts-watch-nack-retains-mirror
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-owner
  ;<  *  bind:m  (bot-update [%files (my ~[[moon files]])])
  ;<  caz=(list card)  bind:m
    (do-bot-sign moon [%watch-ack `~[leaf+"denied"]])
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  st=state-4  bind:m  got-state
  (ex-equal !>((~(get by files.prompts.st) moon)) !>(`files))
::
::  a late poke-ack refreshes an already-stored %pending result, or a
::  poller reads %sending until the request is swept
::
++  test-prompts-poke-ack-refreshes-pending-result
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-owner
  ;<  *  bind:m  (do-edit moon edit-set)
  ;<  *  bind:m  (do-req-wake moon)
  ;<  *  bind:m  (do-req-poke-sign moon %poke-ack ~)
  ;<  req=incoming-request:v1:pr  bind:m  got-request
  (ex-equal !>(result.req) !>(`[%pending %acked]))
::
::  a command the harness never answered is closed out to its requester
::  instead of vanishing, so the owner's record finalizes
::
++  test-prompts-expired-command-responds-harness-offline
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m  (do-watch harness-path)
  ;<  *  bind:m  ((do-as ~bus) (do-command edit-set))
  ;<  ~  bind:m  (advance-clock ~h2)
  ;<  caz=(list card)  bind:m  do-cleanup-wake
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-bot-response ~bus [%error %harness-offline ~])
        (ex-cleanup-timer (add ~2024.1.1 ~h2))
    ==
  ;<  pen=pending:v1:pr  bind:m  got-pending
  (ex-equal !>(pen) !>(*pending:v1:pr))
::
::  upgrading into %4 must subscribe the bots already trusted: prompt
::  watches are otherwise only created by %trust-bot
::
++  test-migrate-state-3-watches-trusted-bots
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  =/  old
    :*  %3  `~bus  (sy ~[moon ~dev])
        *state:v1:l  *state:v1:g  *state:v1:au
    ==
  ;<  caz=(list card)  bind:m  (do-load agent `!>(old))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  ex-eyre-connect
        (ex-cleanup-timer ~2024.1.1)
        (ex-files-watch moon)
    ==
  ;<  st=state-4  bind:m  got-state
  (ex-equal !>(bots.st) !>((sy ~[moon ~dev])))
::
::  a kick on the per-request watch while the edit is in flight re-watches,
::  or the bot's answer would arrive with no subscriber
::
++  test-prompts-req-kick-resubscribes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-owner
  ;<  *  bind:m  (do-edit moon edit-set)
  ;<  caz=(list card)  bind:m  (do-req-watch-sign moon %kick ~)
  (ex-cards caz ~[(ex-req-watch moon)])

::
::  a %pending result is not terminal, so a kick still re-watches
::
++  test-prompts-req-kick-after-pending-resubscribes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-owner
  ;<  *  bind:m  (do-edit moon edit-set)
  ;<  *  bind:m  (do-req-wake moon)
  ;<  caz=(list card)  bind:m  (do-req-watch-sign moon %kick ~)
  (ex-cards caz ~[(ex-req-watch moon)])
::
::  bot side: an owner re-subscribing after a kick is handed the result the
::  harness already reported, so the dropped subscription loses nothing
::
++  test-prompts-bot-request-watch-replays-result
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m  (do-watch harness-path)
  ;<  *  bind:m  ((do-as ~bus) (do-command edit-set))
  ;<  *  bind:m  (do-finalize updated)
  ;<  caz=(list card)  bind:m
    %-  (do-as ~bus)
    (do-watch (req-path ~bus))
  %+  ex-cards  caz
  :~  %^  ex-fact  ~  %steward-prompts-response-1
      !>(`response:v1:pr`[rid updated])
  ==
::
::  an unanswered command replays nothing; the response arrives when the
::  harness finalizes it
::
++  test-prompts-bot-request-watch-without-result-is-silent
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m  (do-watch harness-path)
  ;<  *  bind:m  ((do-as ~bus) (do-command edit-set))
  ;<  caz=(list card)  bind:m
    %-  (do-as ~bus)
    (do-watch (req-path ~bus))
  (ex-cards caz ~)
--

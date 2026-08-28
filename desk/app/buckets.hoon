::  buckets: group-owned shared file manifest and upload coordinator
::
::  This agent is a third-party %groups channel host. It stores metadata and
::  upload lifecycle only; file bytes move directly between clients and object
::  storage. Group admins may request creation, but the group host remains the
::  authoritative Bucket and storage owner.
::
::  Every client action carries a request-id and gets exactly one terminal
::  response. Bearer tokens for the storage broker are minted here and
::  returned only to the requester — they never appear in a broadcast.
::
/-  b=buckets, gv=groups-ver
/+  default-agent, dbug, verb, server
/=  buckets-json  /lib/buckets/json
|%
+$  card  card:agent:gall
+$  current-state  state:b
::  +upload-window: how long a pending upload session stays usable.
::
::  Must stay comfortably longer than Memex's own window, which is at most
::  BUCKETS_PUT_URL_SECONDS (capped at 900) plus BUCKETS_COMPLETION_GRACE_SECONDS
::  (default 600). If this expires first, a completion Memex still considers
::  live arrives to find no session.
::
++  upload-window  ~h1
::  +object-window: lifetime of a delete capability.
::
++  object-window  ~m10
::  +read-window: lifetime of a bucket-read token, and +token-margin the slack
::  we re-mint within so a client never finds an expired one.
::
::  Long on purpose. Expiry is a backstop, not the revocation mechanism: the
::  broker re-checks the live group on every exchange today, and once it holds
::  a pushed token the host revokes explicitly when access changes. What the
::  expiry buys is failing closed if a host dies or a revoke is ever missed.
::
++  read-window  ~d1
++  token-margin  ~h1
::  +request-timeout: how long a subscriber waits for the host's answer
::  before reporting failure to its client.
::
++  request-timeout  ~m2
::  +max-object-size: mirrors Memex's BUCKETS_MAX_OBJECT_BYTES default, so an
::  oversized upload is refused before any state is committed.
::
++  max-object-size  5.368.709.120
::  +request-grace: how long a settled request record is kept so a slow
::  poller can still read its result.
::
++  request-grace  ~m5
::  +default-broker-base: where the storage broker lives, absent a poke
::  saying otherwise. The live value is .broker-base in state.
::
::  Must stay in step with BUCKETS_BROKER_URL in
::  packages/shared/src/store/storage/bucketsBroker.ts — clients and hosts
::  talk to the same service, from opposite directions, and a host pointed at
::  one while its clients upload to the other is broken in both.
::
++  default-broker-base  'https://memex.tlon.network/v2/buckets'
::  +push-retry: how soon to mint again after the broker refused a token.
::
::  A token the broker never accepted is never stored, so there is nothing to
::  fall back on; this is how long before we try again unprompted.
::
++  push-retry  ~m1
::  +groups-retry: how soon to ask %groups for its updates again after it
::  refuses. Longer than a push retry because the usual cause is %groups not
::  being up yet, which resolves on its own.
::
++  groups-retry  ~m5
--
=|  current-state
=*  state  -
%-  agent:dbug
%^  verb  |  %warn
^-  agent:gall
=<
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %|) bowl)
      cor   ~(. +> [bowl ~ ~])
  ++  on-init
    ^-  (quip card _this)
    =^  cards  state  abet:init:cor
    [cards this]
  ++  on-save  !>(state)
  ++  on-load
    |=  old=vase
    ^-  (quip card _this)
    =^  cards  state  abet:(load:cor old)
    [cards this]
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state  abet:(poke:cor mark vase)
    [cards this]
  ++  on-watch
    |=  =path
    ^-  (quip card _this)
    =^  cards  state  abet:(watch:cor `(pole knot)`path)
    [cards this]
  ++  on-peek
    |=  =path
    ^-  (unit (unit cage))
    ?>  =(src our):bowl
    (peek:cor `(pole knot)`path)
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    =^  cards  state  abet:(agent:cor `(pole knot)`wire sign)
    [cards this]
  ++  on-arvo
    |=  [=wire =sign-arvo]
    ^-  (quip card _this)
    =^  cards  state  abet:(arvo:cor `(pole knot)`wire sign-arvo)
    [cards this]
  ++  on-leave  on-leave:def
  ++  on-fail
    |=  [=term =tang]
    ^-  (quip card _this)
    %-  (slog 'buckets: on-fail' >term< tang)
    [~ this]
  --
::
|_  [=bowl:gall cards=(list card) reply=(unit response-body:b)]
++  cor   .
++  abet  [(flop cards) state]
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
::  +answer: record the terminal body for the action being applied. Arms that
::  mint a token or refuse call this; +settle turns it into the response.
::
++  answer  |=(body=response-body:b cor(reply `body))
::
::  +watch-groups: subscribe to the group updates revocation depends on.
::
::  Named rather than inlined because four places need it -- init, load, a
::  kick, and the retry after a refusal -- and the one that was written out
::  separately is the one that forgot to.
::
++  watch-groups
  ^+  cor
  (emit [%pass /groups %agent [our.bowl %groups] %watch /v1/groups])
::
++  init
  ^+  cor
  =.  broker-base  default-broker-base
  =.  cor  (emit [%pass /eyre %arvo %e %connect [~ /buckets] %buckets])
  watch-groups
::
::  +load: %buckets has never run on a live ship, so there is nothing to
::  migrate from yet. When that changes, add a +state-N-to-N+1 arm per
::  version and chain them with =? — never migrate straight to current.
::
++  load
  |=  old=vase
  ^+  cor
  =/  loaded=versioned-state:b  !<(versioned-state:b old)
  ?>  ?=(%0 -.loaded)
  =.  state  loaded
  =?  cor  !(~(has by wex.bowl) [/groups our.bowl %groups])
    watch-groups
  ::  binding an already-bound route is refused harmlessly; +arvo logs it.
  (emit [%pass /eyre %arvo %e %connect [~ /buckets] %buckets])
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+  mark  ~|(bad-buckets-mark+mark !!)
      %handle-http-request
    (serve-http !<([eyre-id=@ta =inbound-request:eyre] vase))
  ::
      %buckets-action-1
    ?>  =(src.bowl our.bowl)
    =+  cmd=!<(command:b vase)
    ::  The same one-answer contract the HTTP surface keeps: a caller that
    ::  lost our answer retries with the id it already used, and running the
    ::  action again would duplicate a folder or a session and answer twice.
    ::  A settled request replays its result; one still in flight is left to
    ::  finish, since its answer goes to the same subscription either way.
    ?^  seen=(~(get by requests) request-id.cmd)
      ?~  result.u.seen  cor
      (respond request-id.cmd ~[/v1/requests] u.result.u.seen)
    =.  cor  (track-request request-id.cmd ~)
    (dispatch-local request-id.cmd act.cmd)
  ::
      %buckets-command-1
    =+  cmd=!<(command:b vase)
    (dispatch-remote request-id.cmd act.cmd)
  ::
  ::  Operator knob rather than client surface, so it rides %noun instead of
  ::  earning a mark. A ship has no environment to read, and pointing a host
  ::  at a test broker has to be possible on the build we ship rather than on
  ::  a patched desk. ~ restores the default.
  ::
  ::    :buckets &noun [%set-broker-base `'https://memex.test.tlon.systems/v2/buckets']
  ::
      %noun
    ?>  =(src.bowl our.bowl)
    =+  !<([%set-broker-base base=(unit @t)] vase)
    (set-broker-base base)
  ::
      %group-channel-join
    ?>  =(src.bowl our.bowl)
    =+  join=!<(channel-join:b vase)
    ?>  =(%buckets kind.nest.join)
    =/  =flag:b  [host.nest.join name.nest.join]
    ?:  =(our.bowl ship.flag)  cor
    (start-sub flag group.join)
  ::
      %group-channel-leave
    ?>  =(src.bowl our.bowl)
    =+  leave=!<(channel-leave:b vase)
    ?>  =(%buckets kind.nest.leave)
    =/  =flag:b  [host.nest.leave name.nest.leave]
    ?:  =(our.bowl ship.flag)  cor
    (stop-sub flag)
  ==
::
::  +serve-http: route one Eyre request.
::
::  Only two shapes exist: POST /buckets/~/v1 submits an action and is held
::  open until its terminal answer, and GET /buckets/~/v1/... reads. The
::  action's answer is the HTTP response, so a client needs no correlation
::  machinery of its own.
::
++  serve-http
  |=  [eyre-id=@ta =inbound-request:eyre]
  ^+  cor
  =/  =request-line:server
    (parse-request-line:server url.request.inbound-request)
  =*  site  site.request-line
  =/  method=@tas  method.request.inbound-request
  ?.  (request-authorized inbound-request)
    (http-error eyre-id 401 'unauthorized')
  ?:  =(site ~[%buckets %~.~ %v1])
    ?.  =(%'POST' method)
      (http-error eyre-id 405 'method not allowed')
    (handle-post eyre-id inbound-request)
  ?.  ?=([%buckets %~.~ %v1 *] site)
    (http-error eyre-id 404 'not found')
  ?.  =(%'GET' method)
    (http-error eyre-id 405 'method not allowed')
  ::  A @uv request id carries dots, and apat mistakes its trailing dot-group
  ::  for a file extension and splits it off -- so glue it back on before the
  ::  id is parsed, or most ids resolve to a different request and 404.
  ::  %notes' surface has the same wrinkle and does the same thing.
  ::  Reattach by flopping rather than with snip/rear: those are wet gates,
  ::  and handing one a list already narrowed to non-empty breaks its own
  ::  recursive call on the tail.
  =/  raw=(list @t)  t.t.t.site
  =/  pax=(list @t)
    ?~  ext.request-line  raw
    =/  back=(list @t)  (flop raw)
    ?~  back  raw
    %-  flop
    [(rap 3 i.back '.' u.ext.request-line ~) t.back]
  (handle-read eyre-id pax)
::
::  +handle-post: parse an action, hold the request open, and dispatch.
::
::  Parsing is defensive — a malformed body is a client error, not a crash.
::  requestId is optional: a caller that cannot produce a valid @uv gets one
::  minted here, and never needs to know it, because the answer comes back
::  on this same request.
::
++  handle-post
  |=  [eyre-id=@ta =inbound-request:eyre]
  ^+  cor
  ::  a cookie or api-key is the host's own capability, so the actor for
  ::  anything submitted over HTTP is us.
  =.  src.bowl  our.bowl
  ?~  body.request.inbound-request
    (http-error eyre-id 400 'missing body')
  ?~  jon=(de:json:html q.u.body.request.inbound-request)
    (http-error eyre-id 400 'invalid json')
  ?.  ?=([%o *] u.jon)
    (http-error eyre-id 400 'body must be a json object')
  ?~  act-j=(~(get by p.u.jon) 'action')
    (http-error eyre-id 400 'missing `action` field')
  =/  parsed=(each action:b tang)
    (mule |.((action:dejs:buckets-json u.act-j)))
  ?:  ?=(%| -.parsed)
    (http-error eyre-id 400 'malformed action')
  =/  rid=request-id:b
    =/  rj=(unit json)  (~(get by p.u.jon) 'requestId')
    ?.  ?&(?=(^ rj) ?=([%s *] u.rj))
      `@uv`eny.bowl
    =/  got=(each @uv tang)  (mule |.((slav %uv p.u.rj)))
    ?:(?=(%& -.got) p.got `@uv`eny.bowl)
  ::  A retry of a dropped POST arrives with the id it already used, so the
  ::  action must not run twice: a %create-folder or %begin-upload would
  ::  duplicate state, and overwriting the record would strand the first
  ::  connection with no answer coming.
  ?^  seen=(~(get by requests) rid)
    ::  Already settled: answer from the record rather than running again.
    ?^  result.u.seen  (give-response eyre-id [rid u.result.u.seen])
    ::  Still in flight: hold this connection open for the one answer instead
    ::  of starting a second attempt. The earlier connection is dropped, which
    ::  is why the caller retried, and only one can be answered anyway.
    cor(requests (~(put by requests) rid u.seen(http-id `eyre-id)))
  =.  cor  (track-request rid `eyre-id)
  (dispatch-local rid p.parsed)
::
::  +handle-read: GET surface — the local snapshot list, one bucket, or the
::  state of a submitted request.
::
++  handle-read
  |=  [eyre-id=@ta pax=(list @t)]
  ^+  cor
  ?+  pax  (http-error eyre-id 404 'not found')
      [%buckets ~]
    %^  give-http  eyre-id  200
    :-  'application/json'
    (en:json:html (summaries:enjs:buckets-json local-summaries))
  ::
      [%buckets %full ~]
    %^  give-http  eyre-id  200
    :-  'application/json'
    (en:json:html (snapshots:enjs:buckets-json local-snapshots))
  ::
      [%buckets @ @ ~]
    ?~  who=(slaw %p i.t.pax)
      (http-error eyre-id 400 'malformed host')
    =/  =flag:b  [u.who `@tas`i.t.t.pax]
    ?~  sp=(~(get by spaces) flag)
      (http-error eyre-id 404 'no such bucket')
    ?~  state.u.sp
      (http-error eyre-id 404 'no such bucket')
    %^  give-http  eyre-id  200
    :-  'application/json'
    %-  en:json:html
    (response:enjs:buckets-json [%snapshot flag u.state.u.sp])
  ::
      [%request @ ~]
    =/  got=(each @uv tang)  (mule |.((slav %uv i.t.pax)))
    ?:  ?=(%| -.got)
      (http-error eyre-id 400 'malformed request id')
    ?~  req=(~(get by requests) p.got)
      (http-error eyre-id 404 'no such request')
    ?~  result.u.req
      (give-response eyre-id [p.got [%pending ~]])
    (give-response eyre-id [p.got u.result.u.req])
  ==
::
::  +request-authorized: Eyre validated a session cookie. Bots would want an
::  X-Api-Key path as well — see %notes for that pattern — but nothing needs
::  it yet, so there is no key to manage.
::
++  request-authorized
  |=  req=inbound-request:eyre
  ^-  ?
  authenticated.req
::
++  give-http
  |=  [eyre-id=@ta code=@ud ct=@t body=@t]
  ^+  cor
  =/  data=octs  (as-octs:mimes:html body)
  %-  emil
  :~  [%give %fact [/http-response/[eyre-id]]~ %http-response-header !>(`response-header:http`[code ~[['content-type' ct]]])]
      [%give %fact [/http-response/[eyre-id]]~ %http-response-data !>(`data)]
      [%give %kick [/http-response/[eyre-id]]~ ~]
  ==
::
++  http-error
  |=  [eyre-id=@ta code=@ud message=@t]
  ^+  cor
  (give-http eyre-id code 'text/plain' message)
::
++  give-response
  |=  [eyre-id=@ta res=req-response:b]
  ^+  cor
  %^  give-http  eyre-id  200
  ['application/json' (en:json:html (req-response:enjs:buckets-json res))]
::
::  +track-request: start tracking a request, sweeping settled ones as we go.
::  The map only grows here, so sweeping on insert bounds it without a timer.
::
++  track-request
  |=  [rid=request-id:b http-id=(unit @ta)]
  ^+  cor
  =.  requests  (sweep-requests now.bowl)
  =.  requests  (~(put by requests) rid [rid http-id ~ ~])
  cor
::
++  sweep-requests
  |=  now=@da
  ^-  requests:b
  %-  malt
  %+  skip  ~(tap by requests)
  |=  [rid=request-id:b req=incoming-request:b]
  ?~  final-at.req  |
  (gth now (add u.final-at.req request-grace))
::
::  +dispatch-local: a client on our own ship submitted an action. Apply it
::  if we host the bucket, otherwise forward it to the host and wait.
::
++  dispatch-local
  |=  [rid=request-id:b act=a-buckets:b]
  ^+  cor
  =/  paths=(list path)  ~[/v1/requests]
  ?-  -.act
      %create
    ?.  ?=(%duke (clan:title ship.group.act))
      (deny rid paths %invalid-input 'only a planet may host a bucket')
    ?.  (group-is-admin-for-create group.act our.bowl)
      (deny rid paths %not-authorized 'only a group admin may create a bucket')
    ?.  =(ship.group.act our.bowl)
      (forward rid act ship.group.act)
    =.  cor
      (create-bucket name.act title.act group.act readers.act writers.act our.bowl)
    (settle rid paths)
  ::
      %bucket
    ?~  sp=(~(get by spaces) flag.act)
      (deny rid paths %not-found 'no such bucket')
    ?.  =(%pub net.u.sp)
      (forward rid act ship.flag.act)
    =/  st=bucket-state:b  (need-state flag.act)
    ?.  (action-authorized st flag.act our.bowl a-bucket.act)
      (deny rid paths %not-authorized 'not authorized for this bucket')
    =.  cor  (apply-bucket flag.act a-bucket.act our.bowl rid)
    (settle rid paths)
  ==
::
::  +dispatch-remote: a subscriber forwarded a command to us as host. The
::  actor is src.bowl; the answer goes back on that ship's request path.
::
++  dispatch-remote
  |=  [rid=request-id:b act=a-buckets:b]
  ^+  cor
  =/  paths=(list path)  ~[(host-req-path src.bowl rid)]
  ?-  -.act
      %create
    ?>  =(ship.group.act our.bowl)
    ?.  ?=(%duke (clan:title ship.group.act))
      (deny rid paths %invalid-input 'only a planet may host a bucket')
    ?.  (group-is-admin-for-create group.act src.bowl)
      (deny rid paths %not-authorized 'only a group admin may create a bucket')
    =.  cor
      (create-bucket name.act title.act group.act readers.act writers.act src.bowl)
    (settle rid paths)
  ::
      %bucket
    ?>  =(ship.flag.act our.bowl)
    ?~  sp=(~(get by spaces) flag.act)
      (deny rid paths %not-found 'no such bucket')
    =/  st=bucket-state:b  (need-state flag.act)
    ?.  (action-authorized st flag.act src.bowl a-bucket.act)
      (deny rid paths %not-authorized 'not authorized for this bucket')
    =.  cor  (apply-bucket flag.act a-bucket.act src.bowl rid)
    (settle rid paths)
  ==
::
::  +forward: hand a command to the authoritative host, subscribe for its
::  answer, and arm a timeout so a silent host can't strand the client.
::
++  forward
  |=  [rid=request-id:b act=a-buckets:b host=ship]
  ^+  cor
  =/  until=@da  (add now.bowl request-timeout)
  ::  Only a read-token request gets a bucket recorded: it is the only answer
  ::  that is filed anywhere, and the only failure that should touch a token.
  =/  token-for=(unit flag:b)
    ?.  ?=(%bucket -.act)  ~
    ?.  ?=(%issue-bucket-read -.a-bucket.act)  ~
    `flag.act
  =.  pending  (~(put by pending) rid [host until token-for])
  ::  Watch first, then poke. Cards are delivered in order, so a host that
  ::  answers in the same event it is poked would publish the terminal fact
  ::  before we are listening, and the request would sit until its timeout.
  =.  cor
    %-  emit
    :*  %pass  (req-watch-wire host rid)  %agent  [host %buckets]
        %watch  (host-req-path our.bowl rid)
    ==
  =.  cor
    %-  emit
    :*  %pass  (req-poke-wire host rid)  %agent  [host %buckets]
        %poke  buckets-command-1+!>(`command:b`[rid act])
    ==
  =.  cor
    (emit [%pass (req-wake-wire host rid) %arvo %b %wait until])
  (respond rid ~[/v1/requests] [%pending ~])
::
::  +settle: emit the terminal response for a request, defaulting to %ok when
::  the applied action produced nothing to hand back.
::
++  settle
  |=  [rid=request-id:b paths=(list path)]
  ^+  cor
  =/  body=response-body:b  ?~(reply [%ok ~] u.reply)
  =.  cor  cor(reply ~)
  (respond rid paths body)
::
++  deny
  |=  [rid=request-id:b paths=(list path) type=action-error:b msg=@t]
  ^+  cor
  (respond rid paths [%error type msg])
::
::  +respond: emit an answer on the subscription paths, and complete a held
::  HTTP request if this one came in over Eyre.
::
::  %pending is not terminal — a held request keeps waiting for the host's
::  real answer, which arrives on the same rid.
::
++  respond
  |=  [rid=request-id:b paths=(list path) body=response-body:b]
  ^+  cor
  =/  res=req-response:b  [rid body]
  =.  cor  (give [%fact paths buckets-req-response-1+!>(res)])
  ?:  ?=(%pending -.body)  cor
  ?~  req=(~(get by requests) rid)  cor
  =.  requests
    %+  ~(put by requests)  rid
    u.req(result `body, final-at `now.bowl, http-id ~)
  ?~  http-id.u.req  cor
  (give-response u.http-id.u.req res)
::
++  host-req-path
  |=  [who=ship rid=request-id:b]
  ^-  path
  /v1/request/(scot %p who)/(scot %uv rid)
::
::  +answer-paths: where the answer to one requester's action goes.
::
::  The same choice +dispatch-local and +dispatch-remote make, pulled out for
::  arms that finish a request in a later event than the one that took it.
::
++  answer-paths
  |=  [who=ship rid=request-id:b]
  ^-  (list path)
  ?:  =(who our.bowl)  ~[/v1/requests]
  ~[(host-req-path who rid)]
::
++  req-poke-wire
  |=  [host=ship rid=request-id:b]
  ^-  wire
  /buckets/req/(scot %p host)/(scot %uv rid)/poke
::
++  req-watch-wire
  |=  [host=ship rid=request-id:b]
  ^-  wire
  /buckets/req/(scot %p host)/(scot %uv rid)/watch
::
++  req-wake-wire
  |=  [host=ship rid=request-id:b]
  ^-  wire
  /buckets/req/(scot %p host)/(scot %uv rid)/wake
::
::  +request-live: is a forwarded request still waiting on the host?
::
::  Tracked in state rather than read off wex.bowl, because Gall has already
::  dropped the subscription by the time a %kick reaches us — the one case
::  where we most need to know the request was still outstanding.
::
++  request-live
  |=  rid=request-id:b
  ^-  ?
  (~(has by pending) rid)
::
::  +close-request: retire a settled request, dropping its subscription and
::  cancelling the timeout at the instant it was armed for.
::
::  +abandon-request: end a forwarded request that will never be answered.
::
::  There are four ways one dies -- the host kicks the stream, refuses the
::  watch, nacks the poke, or never answers at all -- and they lose the same
::  thing, so they end the same way. A renewal in particular has already had
::  its refresh fire, and nothing else will rearm it, so the local scry would
::  go on serving a token past its expiry. Handling these separately is how
::  one of the four came to be missing it.
::
++  abandon-request
  |=  [host=ship rid=request-id:b why=@t]
  ^+  cor
  ?.  (request-live rid)  cor
  =/  token-for=(unit flag:b)
    ?~(got=(~(get by pending) rid) ~ token-for.u.got)
  =.  cor  (close-request host rid)
  =?  cor  ?=(^ token-for)  (retry-read-token u.token-for)
  (deny rid ~[/v1/requests] %unknown why)
::
++  close-request
  |=  [host=ship rid=request-id:b]
  ^+  cor
  =/  got=(unit [host=ship until=@da token-for=(unit flag:b)])
    (~(get by pending) rid)
  =.  pending  (~(del by pending) rid)
  =.  cor
    %-  emit
    :*  %pass  (req-watch-wire host rid)  %agent  [host %buckets]
        %leave  ~
    ==
  ?~  got  cor
  (emit [%pass (req-wake-wire host rid) %arvo %b %rest until.u.got])
::
++  need-space
  |=  =flag:b
  ^-  space:b
  (~(got by spaces) flag)
::
++  need-state
  |=  =flag:b
  ^-  bucket-state:b
  =/  sp=space:b  (need-space flag)
  ?>  ?=(^ state.sp)
  u.state.sp
::
++  put-state
  |=  [=flag:b st=bucket-state:b]
  ^+  cor
  =/  sp=space:b  (need-space flag)
  =.  spaces  (~(put by spaces) flag [net.sp `st `group.st])
  cor
::
++  create-bucket
  |=  [name=@tas title=@t group=flag:b readers=(set @tas) writers=(set @tas) actor=ship]
  ^+  cor
  ?>  =(ship.group our.bowl)
  =/  =flag:b  [our.bowl name]
  ::  A create naming a bucket we already have is either the same create
  ::  arriving twice -- a retry, a forward that raced its own answer -- or a
  ::  real collision on the name. The first re-registers, which is what makes
  ::  create idempotent; the second is bad input from a client, and crashing
  ::  the event on ?> made it a nack or a timeout rather than the typed error
  ::  the contract promises. .actor is deliberately not compared: an
  ::  otherwise identical create from a different admin is still the same
  ::  create, and demanding the original creator only turned a retry into a
  ::  crash.
  ?:  (~(has by spaces) flag)
    =/  taken=_cor  (answer [%error %invalid-input 'that bucket name is taken'])
    =/  sp=space:b  (~(got by spaces) flag)
    ?.  =(%pub net.sp)  taken
    ?~  state.sp  taken
    =/  st=bucket-state:b  u.state.sp
    ?.  ?&  =(group group.st)
            =(title title.bucket.st)
            =(writers writers.st)
        ==
      taken
    =.  cor  (register-bucket flag st readers)
    (give [%fact ~[/v1] buckets-response-1+!>(`response:b`[%snapshot flag st])])
  =/  id=@ud  +(next-id)
  =.  next-id  id
  =/  buc=bucket:b  [id title actor now.bowl actor now.bowl]
  =/  st=bucket-state:b  [buc group writers ~ 0]
  =.  spaces  (~(put by spaces) flag [%pub `st `group])
  =.  cor  (register-bucket flag st readers)
  (give [%fact ~[/v1] buckets-response-1+!>(`response:b`[%snapshot flag st])])
::
::  +register-bucket: hand the channel to %groups. The reader roles come from
::  the action rather than from state, because %groups keeps them from here
::  on and this agent has no copy to drift from.
::
++  register-bucket
  |=  [=flag:b st=bucket-state:b readers=(set @tas)]
  ^+  cor
  =/  channel=group-channel:b
    [[title.bucket.st '' '' ''] now.bowl %default readers |]
  =/  add=group-create:b
    [%group group.st %channel [%buckets flag] %add channel]
  %-  emit
  :*  %pass  /buckets/(scot %p ship.flag)/[name.flag]/create
      %agent  [our.bowl %groups]
      %poke  group-action-4+!>(add)
  ==
::
::  +apply-bucket: run one verb against a bucket we host. The flag and the
::  actor come from the envelope rather than from the payload.
::
++  apply-bucket
  |=  [=flag:b act=a-bucket:b actor=ship rid=request-id:b]
  ^+  cor
  ?-  -.act
    %delete         (delete-bucket flag actor)
    %set-title      (set-title flag title.act actor)
    %set-writers    (set-writers flag writers.act actor)
    %create-folder  (create-folder flag parent.act name.act actor)
    %begin-upload
  (begin-upload flag parent.act name.act mime.act size.act checksum.act actor `rid)
    %finish-upload  (finish-upload flag session.act actor `rid)
    %retry-upload   (retry-upload flag session.act actor `rid)
    %cancel-upload  (cancel-upload flag session.act reason.act actor `rid)
    %issue-bucket-read  (issue-read-token flag actor `rid)
    %issue-delete       (issue-delete-capability flag id.act actor)
    %entry          (apply-entry flag id.act a-entry.act actor)
  ==
::
++  apply-entry
  |=  [=flag:b id=@ud act=a-entry:b actor=ship]
  ^+  cor
  ?-  -.act
    %rename  (rename-entry flag id name.act actor)
    %move    (move-entry flag id parent.act actor)
    %delete  (delete-entry flag id recursive.act actor)
  ==
::
++  delete-bucket
  |=  [=flag:b actor=ship]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  =/  del=group-channel-del:b
    [%group group.st %channel [%buckets flag] %del ~]
  =.  cor
    %-  emit
    :*  %pass  /buckets/(scot %p ship.flag)/[name.flag]/delete
        %agent  [our.bowl %groups]
        %poke  group-action-4+!>(del)
    ==
  =/  res=response:b
    [%update flag +(revision.st) [%delete ~]]
  =.  cor  (give [%fact ~[/v1 (updates-path flag)] buckets-response-1+!>(res)])
  =.  sessions  (drop-bucket-sessions flag)
  =.  cor  (drop-read-token flag)
  =.  spaces  (~(del by spaces) flag)
  cor
::
++  set-title
  |=  [=flag:b title=@t actor=ship]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  =.  bucket.st
    bucket.st(title title, updated-by actor, updated-at now.bowl)
  (commit-update flag st [%meta bucket.st] actor)
::
++  set-writers
  |=  [=flag:b writers=(set @tas) actor=ship]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  =.  writers.st  writers
  (commit-update flag st [%writers writers] actor)
::
++  create-folder
  |=  [=flag:b parent=(unit @ud) name=@t actor=ship]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  ?.  (valid-parent st parent)
    (answer [%error %not-found 'no such parent folder'])
  =/  id=@ud  +(next-id)
  =.  next-id  id
  =/  ent=entry:b
    [id parent name actor now.bowl actor now.bowl [%folder ~]]
  =.  entries.st  (~(put by entries.st) id ent)
  (commit-update flag st [%entry id [%create ent]] actor)
::
::  +begin-upload: reserve an entry id and object key, open a host-private
::  session, and hand the session id back to the uploader as its broker
::  token. The entry is not published until the object lands, so nothing is
::  broadcast here and the token never leaves this response.
::
++  begin-upload
  |=  $:  =flag:b
          parent=(unit @ud)
          name=@t
          mime=@t
          size=@ud
          checksum=(unit @t)
          actor=ship
          rid=(unit request-id:b)
      ==
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  ?.  (valid-parent st parent)
    (answer [%error %not-found 'no such parent folder'])
  ?:  =(0 size)
    (answer [%error %invalid-input 'file size must be greater than zero'])
  ?:  (gth size max-object-size)
    (answer [%error %invalid-input 'file exceeds the maximum object size'])
  ?.  (valid-mime mime)
    (answer [%error %invalid-input 'missing or malformed content type'])
  =.  cor  prune-broker-authority
  =/  id=@ud  +(next-id)
  =.  next-id  id
  =/  sid=@uv  `@uv`eny.bowl
  =/  fil=file:b  [mime size checksum (scot %uv sid) %pending]
  =/  ent=entry:b
    [id parent name actor now.bowl actor now.bowl [%file fil]]
  =/  expiry=@da  (add now.bowl upload-window)
  =/  ses=upload-session:b
    [sid flag ent actor now.bowl expiry %pending ~ ~ rid]
  =.  sessions  (~(put by sessions) sid ses)
  ::  The URL comes from the broker, so the requester waits for it. %pending
  ::  is not terminal: a held POST stays held, and the grant answers it.
  =.  cor  (grant-upload ses)
  (answer [%pending ~])
::
::  +upload-wire: names one broker call for one session.
::
++  upload-wire
  |=  [sid=@uv kind=@tas]
  ^-  wire
  /buckets/upload/(scot %uv sid)/[kind]
::
::  +upload-authority: what we tell the broker about an upload.
::
::  Every field is something this ship already decided -- it allocated the
::  entry and object ids and checked the size and MIME type against its own
::  manifest -- which is why the broker no longer has to ask. Milliseconds
::  rather than ISO 8601, the same convention the read-token sync uses,
::  because a @da converts to millis in one step.
::
++  upload-authority
  |=  [ses=upload-session:b st=bucket-state:b]
  ^-  json
  =/  fil=file:b  (entry-file entry.ses)
  =/  checksum-json=json
    ?~  checksum.fil  ~
    %-  pairs:enjs:format
    :~  ['algorithm' s+'crc32c']
        ['value' s+u.checksum.fil]
    ==
  %-  pairs:enjs:format
  :~  ['host' s+(ship-text our.bowl)]
      ['bucketHost' s+(ship-text ship.flag.ses)]
      ['bucketName' s+(scot %tas name.flag.ses)]
      ['bucketId' s+(scot %ud id.bucket.st)]
      ['gallSessionId' s+(scot %uv id.ses)]
      ['gallObjectId' s+object-key.fil]
      ['actorShip' s+(ship-text requested-by.ses)]
      ['size' (numb:enjs:format size.fil)]
      ['mimeType' s+mime.fil]
      ['checksum' checksum-json]
      :-  'expiresAtMillis'
      (numb:enjs:format (mul 1.000 (unt:chrono:userlib expires-at.ses)))
  ==
::
::  +broker-post: a POST to the broker, authenticated as this ship.
::
::  The credential is the %genuine secret, the same one the read-token sync
::  presents. Absent means this ship cannot reach storage at all, which is a
::  real state on a fresh boot rather than a bug, so the caller decides what
::  to tell whoever is waiting.
::
++  broker-post
  |=  [=wire path=@t body=(unit json)]
  ^-  (unit card)
  =/  secret=(unit @t)  genuine-secret
  ?~  secret  ~
  =/  url=@t  (rap 3 broker-base path ~)
  =/  payload=(unit octs)
    ?~  body  ~
    =/  txt=@t  (en:json:html u.body)
    `[(met 3 txt) txt]
  =/  =request:http
    :*  %'POST'  url
        :~  ['content-type' 'application/json']
            ['x-landscape-token' u.secret]
        ==
        payload
    ==
  `[%pass wire %arvo %i %request request *outbound-config:iris]
::
::  +grant-upload: ask the broker for this session's PUT URL.
::
++  grant-upload
  |=  ses=upload-session:b
  ^+  cor
  =/  st=bucket-state:b  (need-state flag.ses)
  =/  card=(unit card)
    %^    broker-post
        (upload-wire id.ses %grant)
      '/uploads/grant'
    `(upload-authority ses st)
  ?~  card  (unreachable-storage ses)
  (emit u.card)
::
::  +reservation-call: a POST against a session's broker reservation.
::
::  Used for completion, another URL, and cancellation alike -- all three are
::  the same shape, differing only in the verb in the path.
::
++  reservation-call
  |=  [ses=upload-session:b kind=@tas body=(unit json)]
  ^+  cor
  ?~  reservation.ses  (unreachable-storage ses)
  =/  path=@t
    (rap 3 '/uploads/' u.reservation.ses '/' (scot %tas kind) ~)
  =/  card=(unit card)
    (broker-post (upload-wire id.ses kind) path body)
  ?~  card  (unreachable-storage ses)
  (emit u.card)
::
::  +unreachable-storage: give up on a broker call we cannot make.
::
::  Nothing is retried here. An upload is a client sitting in front of a
::  progress bar, not a background sync, so a failure it can act on beats a
::  silent retry it cannot see.
::
++  unreachable-storage
  |=  ses=upload-session:b
  ^+  cor
  =.  sessions
    (~(put by sessions) id.ses ses(status %cancelled, error `'storage is unreachable'))
  (answer-uploader ses [%error %unknown 'this ship cannot reach storage yet'])
::
::  +answer-uploader: give a session's held request its one terminal answer.
::
::  Mirrors +answer-waiter on the reader side: a session names at most one
::  waiting request, and everything that resolves or abandons one comes
::  through here, so the clearing and the answering cannot drift apart.
::
++  answer-uploader
  |=  [ses=upload-session:b body=response-body:b]
  ^+  cor
  ?~  awaiting.ses  cor
  =/  rid=request-id:b  u.awaiting.ses
  =/  got=(unit upload-session:b)  (~(get by sessions) id.ses)
  =?  sessions  ?=(^ got)
    (~(put by sessions) id.ses u.got(awaiting ~))
  (respond rid (answer-paths requested-by.ses rid) body)
::
::  +publish-upload: move a completed session's entry into the manifest and
::  broadcast it. The session is retained as %complete so a repeated
::  completion is a no-op rather than a second entry.
::
++  publish-upload
  |=  [ses=upload-session:b actor=ship]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag.ses)
  =/  ent=entry:b  entry.ses
  =/  fil=file:b  (entry-file ent)
  =.  fil  fil(status %ready)
  =.  ent  ent(updated-by actor, updated-at now.bowl, kind [%file fil])
  =.  sessions  (~(put by sessions) id.ses ses(status %complete, entry ent))
  =.  entries.st  (~(put by entries.st) id.ent ent)
  (commit-update flag.ses st [%entry id.ent [%create ent]] actor)
::
::  +cancel-upload: the uploader is withdrawing from a session it opened.
::
::  Withdrawing is all it can report. Whether the bytes reached storage is the
::  broker's to say, and the client asks that question and can lose the
::  answer -- so this does not settle the upload, it only stops a new upload
::  URL being issued against the session. A completion that arrives afterwards
::  is still honoured, because the broker knows something we do not.
::
::  +uploader-session: the pending session this actor may act on.
::
::  The three session verbs differ only in what they then ask the broker, so
::  the checks they share live here rather than three times over.
::
++  uploader-session
  |=  [=flag:b sid=@uv actor=ship]
  ^-  (each upload-session:b response-body:b)
  ?~  got=(~(get by sessions) sid)
    [%| %error %not-found 'no such upload session']
  =/  ses=upload-session:b  u.got
  ?.  =(flag flag.ses)
    [%| %error %not-found 'no such upload session']
  ?.  =(requested-by.ses actor)
    [%| %error %not-authorized 'not the uploader']
  ?.  =(%pending status.ses)
    [%| %error %invalid-input 'upload session is not pending']
  [%& ses]
::
::  +finish-upload: the bytes are up, so settle the reservation and publish.
::
::  The receipt is the answer to our own call rather than something pushed at
::  us later, so the entry appears in the same breath as the uploader being
::  told its upload landed.
::
++  finish-upload
  |=  [=flag:b sid=@uv actor=ship rid=(unit request-id:b)]
  ^+  cor
  =/  found  (uploader-session flag sid actor)
  ?:  ?=(%| -.found)  (answer p.found)
  =/  ses=upload-session:b  p.found
  =.  sessions  (~(put by sessions) sid ses(awaiting rid))
  =/  body=(unit json)
    ?~  reservation.ses  ~
    `(pairs:enjs:format ~[['reservationId' s+u.reservation.ses]])
  =.  cor  (reservation-call ses(awaiting rid) %complete body)
  (answer [%pending ~])
::
::  +retry-upload: another PUT URL for the same reservation.
::
::  Deliberately not a fresh session. Reserving again would strand the first
::  reservation holding quota until it expired, and would sidestep the retry
::  budget the broker keeps precisely so a failing upload cannot be retried
::  without limit.
::
++  retry-upload
  |=  [=flag:b sid=@uv actor=ship rid=(unit request-id:b)]
  ^+  cor
  =/  found  (uploader-session flag sid actor)
  ?:  ?=(%| -.found)  (answer p.found)
  =/  ses=upload-session:b  p.found
  =.  sessions  (~(put by sessions) sid ses(awaiting rid))
  =.  cor  (reservation-call ses(awaiting rid) %retry ~)
  (answer [%pending ~])
::
::  +cancel-upload: the uploader is withdrawing from a session it opened.
::
::  Cancelling at the broker is the point: quota is reserved before the first
::  byte moves, so an abandoned upload holds it until the reservation lapses.
::  That release used to be the client's to make, from a tab that was in the
::  middle of closing, and it was made with the error swallowed.
::
++  cancel-upload
  |=  [=flag:b sid=@uv reason=@t actor=ship rid=(unit request-id:b)]
  ^+  cor
  =/  found  (uploader-session flag sid actor)
  ?:  ?=(%| -.found)  (answer p.found)
  =/  ses=upload-session:b  p.found
  ::  Recorded before the call, not after: the session must stop issuing URLs
  ::  whether or not the broker is reachable to hear about it.
  =/  done=upload-session:b
    ses(status %cancelled, error `reason, awaiting rid)
  =.  sessions  (~(put by sessions) sid done)
  ?~  reservation.ses  (answer [%ok ~])
  =.  cor  (reservation-call done %cancel ~)
  (answer [%pending ~])
::
::  +held-read-token: a live token we have already minted for this reader.
::
::  Keyed by reader as well as bucket: every reader gets its own token, so
::  that one reader can be revoked without disturbing the rest. Looking this
::  up by bucket alone would hand a remote reader whichever token came first,
::  and make per-reader revocation impossible.
::
++  held-read-token
  |=  [=flag:b actor=ship]
  ^-  (unit read-token:b)
  ?~  got=(~(get by readers) [flag actor])  ~
  =/  sync=reader-sync:b  u.got
  ::  Only a grant the broker has confirmed is worth handing out; anything
  ::  still owed would 403 on first use.
  ?.  ?=(%settled (reader-status sync))  ~
  ?.  ?=(%granted -.desired.sync)  ~
  ?.  (gth expires-at.desired.sync (add now.bowl token-margin))  ~
  `[token.desired.sync expires-at.desired.sync]
::
::  +issue-read-token: mint a reader's bucket-read token, reusing the one it
::  already holds while that has useful life left.
::
::  One token covers every ready object in the bucket. What that saves is the
::  host: the broker answers a read from its own table, so opening a file
::  costs nothing here and keeps working while this ship is down. The client
::  still exchanges the token at the broker once per file it opens, because a
::  signed URL is per-object, short-lived, and only the broker can sign one.
::
::  A fresh mint answers %pending: the token has to reach the broker before
::  it is worth anything,
::  and a client that is told otherwise would hold one that 403s.
::
++  issue-read-token
  |=  [=flag:b actor=ship rid=(unit request-id:b)]
  ^+  cor
  =.  cor  prune-broker-authority
  ?^  held=(held-read-token flag actor)
    (answer [%token u.held])
  =/  token=@t  (scot %uv `@uv`eny.bowl)
  =/  expiry=@da  (add now.bowl read-window)
  ::  Record the grant whether or not we can send it right now. Without the
  ::  %genuine secret +sync-cards emits nothing, but the pair is owed and the
  ::  retry timer sends it once the secret appears -- where bailing out here
  ::  left a renewal dead for good, its refresh already fired and nothing to
  ::  rearm it.
  ::
  ::  Bound to a leg before the test on purpose: ?~ on a bare arm refines
  ::  along the wing's axis, an arm has none, and the ~ case mints as vain.
  =/  secret=(unit @t)  genuine-secret
  =/  st=bucket-state:b  (need-state flag)
  ::  Only claim the request as this pair's waiter if we are going to send.
  ::  With no secret it is answered below, in this event, and a record still
  ::  naming it would answer it again when the retry is finally confirmed.
  =/  waiter=(unit request-id:b)  ?~(secret ~ rid)
  =.  cor
    %-  sync-reader
    [flag actor (scot %ud id.bucket.st) [%granted token expiry] expiry waiter]
  ?^  secret  (answer [%pending ~])
  ::  A client should not be left holding a request we cannot act on yet, so
  ::  it is told; the timer path has no one waiting and just retries.
  %-  (slog leaf+"buckets: no %genuine secret, reader sync deferred" ~)
  ?~  rid  cor
  (answer [%error %unknown 'this ship cannot reach storage yet'])
::
::  +issue-delete-capability: mint a short-lived delete grant for one ready
::  file. Deletes stay per-object — they are destructive and unrecoverable.
::
++  issue-delete-capability
  |=  [=flag:b id=@ud actor=ship]
  ^+  cor
  =.  cor  prune-broker-authority
  =/  st=bucket-state:b  (need-state flag)
  ?~  got=(~(get by entries.st) id)
    (answer [%error %not-found 'no such entry'])
  =/  ent=entry:b  u.got
  ?.  ?=(%file -.kind.ent)
    (answer [%error %invalid-input 'entry is a folder'])
  =/  fil=file:b  +.kind.ent
  ?.  =(%ready status.fil)
    (answer [%error %invalid-input 'file is not ready'])
  =/  token=@t  (scot %uv `@uv`eny.bowl)
  =/  expiry=@da  (add now.bowl object-window)
  =.  object-capabilities
    (~(put by object-capabilities) token [%delete flag `id actor expiry])
  (answer [%grant [token id expiry]])
::
::  +arm-token-refresh: re-mint before the current token lapses, so a local
::  client never has to wait on one.
::
++  arm-token-refresh
  |=  [=flag:b expiry=@da]
  ^+  cor
  %-  emit
  :*  %pass  (token-wire flag)  %arvo  %b
      %wait  (sub expiry token-margin)
  ==
::
::  +disarm-token-refresh: cancel the refresh armed for the token we hold.
::
::  Behn keys a timer by its instant, so this has to name the one
::  +arm-token-refresh set, which is derived from the held token's expiry.
::  Dropping a token and taking another before that instant otherwise leaves
::  the old wake live: it fires alongside the replacement's, and the two
::  renewals supersede each other at the host for as long as the bucket lives.
::
++  disarm-token-refresh
  |=  =flag:b
  ^+  cor
  ?~  tok=(~(get by read-tokens) flag)  cor
  %-  emit
  :*  %pass  (token-wire flag)  %arvo  %b
      %rest  (sub expires-at.u.tok token-margin)
  ==
::
::  +recover-local-reader: our own renewal has stopped making progress.
::
::  A renewal has no waiting request, so nothing else reports its failure and
::  nothing else restarts it. The token we still hold was minted against a
::  revision the broker never took, or has run out its life while we retried,
::  and the local scry will keep serving it until something intervenes. Drop
::  it so a reader asks again, and come back for a fresh mint.
::
++  recover-local-reader
  |=  =flag:b
  ^+  cor
  ::  Holding a token is the whole reason to act: it is the stale thing being
  ::  served, and dropping it is what makes a reader ask again. With none
  ::  there is nothing to recover and the next request mints on its own --
  ::  and saying so here is what keeps this idempotent, because the sweep
  ::  sees the same lapsed record on every pass until it is pruned, and an
  ::  unguarded +retry-read-token would leave a timer behind each time.
  ?~  (~(get by read-tokens) flag)  cor
  =.  cor  (disarm-token-refresh flag)
  =.  read-tokens  (~(del by read-tokens) flag)
  (retry-read-token flag)
::
++  token-wire
  |=  =flag:b
  ^-  wire
  /buckets/token/(scot %p ship.flag)/[name.flag]
::
::  +retry-read-token: come back to a mint the broker refused.
::
++  retry-read-token
  |=  =flag:b
  ^+  cor
  %-  emit
  :*  %pass  (token-wire flag)  %arvo  %b
      %wait  (add now.bowl push-retry)
  ==
::
::  +set-broker-base: point this ship's syncs at a different broker.
::
::  Refuses anything but an https origin. The credential +sync-cards sends is
::  a bearer header, so a base naming a plaintext or unexpected host does not
::  fail closed -- it discloses the secret to whoever was named. One trailing
::  slash is trimmed rather than refused, since every use appends its own path
::  and a doubled slash would 404 against a broker that is otherwise right.
::
++  set-broker-base
  |=  base=(unit @t)
  ^+  cor
  ?~  base
    %-  (slog leaf+"buckets: broker base reset to the default" ~)
    ::  Going back is a move between brokers like any other: the default has
    ::  heard nothing we said while we were pointed elsewhere.
    (rebase-readers default-broker-base)
  =/  txt=tape  (trip u.base)
  ::  Indexed rather than +rear/+snip on purpose: testing with ?= narrows the
  ::  tape, and those wet gates do not survive being handed a narrowed list.
  =.  txt
    ?:  =(~ txt)  txt
    =/  last=@ud  (dec (lent txt))
    ?.(=('/' (snag last txt)) txt (scag last txt))
  ?.  =("https://" (scag 8 txt))
    %-  (slog leaf+"buckets: refusing a broker base that is not https" ~)
    cor
  %-  (slog leaf+"buckets: broker base is now {txt}" ~)
  (rebase-readers (crip txt))
::
::  +rebase-readers: point every live grant at the broker we just moved to.
::
::  A broker holds only what it has been told. Swapping the address alone
::  leaves every record reading as synced, so +owed skips them and the new
::  broker learns nothing until each grant renews -- a day of reads failing
::  against a broker that has never heard of them. Marking them owed again
::  re-sends the state we already decided; revisions carry over, and a broker
::  with no record of a pair accepts any revision above zero.
::
::  What this does not do is retire the grants the old broker still holds.
::  Doing so means keeping the old address and revoking against it, which is
::  a second broker's worth of bookkeeping for an operator action; their own
::  expiry is the backstop, which is the same guarantee a missed revoke has.
::
++  rebase-readers
  |=  base=@t
  ^+  cor
  ?:  =(base broker-base)  cor
  =.  broker-base  base
  =.  readers
    %-  malt
    %+  turn  ~(tap by readers)
    |=  [key=reader-key:b sync=reader-sync:b]
    ^-  [reader-key:b reader-sync:b]
    ::  Nothing to re-send for a pair whose token could not be used anyway.
    ?:  ?=(%lapsed (reader-status sync))  [key sync]
    ::  A new revision rather than the same one resent, because a request to
    ::  the broker we just left may still be in flight and its wire carries
    ::  the revision. Reusing it would let that broker's late 2xx confirm
    ::  state the new broker has never been told, and +owed would then stop
    ::  retrying it -- clients failing against the new broker until renewal.
    [key sync(revision +(revision.sync), synced 0, failed |)]
  retry-readers
::
::  +genuine-secret: this ship's shared secret with the broker.
::
::  %genuine mints it and serves it back over its own Eyre binding, which is
::  how the broker checks a request really came from us. Absent until %genuine
::  has initialised, which is a real state on a fresh ship rather than a bug,
::  so this answers a unit instead of crashing the event.
::
++  genuine-secret
  ^-  (unit @t)
  ?.  .^(? %gu /(scot %p our.bowl)/genuine/(scot %da now.bowl)/$)  ~
  =/  jon=json
    .^(json %gx /(scot %p our.bowl)/genuine/(scot %da now.bowl)/secret/json)
  ?.  ?=([%s *] jon)  ~
  `p.jon
::
::  +answer-waiter: give a reader record's held request its one terminal
::  answer, and stop holding it.
::
::  `awaiting` is a promise that exactly one answer is still owed on this
::  pair. Every transition that resolves or abandons that promise goes
::  through here, so the clearing and the answering cannot drift apart --
::  doing them separately is how a request came to be answered twice.
::
++  answer-waiter
  |=  [key=reader-key:b body=response-body:b]
  ^+  cor
  ?~  got=(~(get by readers) key)  cor
  ?~  awaiting.u.got  cor
  =/  rid=request-id:b  u.awaiting.u.got
  =.  readers  (~(put by readers) key u.got(awaiting ~))
  (respond rid (answer-paths reader.key rid) body)
::
::  +sync-reader: record what a reader's access should be, and tell the
::  broker. Grant, rotation and revoke are all this one operation.
::
::  The revision is what makes delivery order stop mattering: the broker keeps
::  only the highest it has seen, so a delayed or duplicated request loses to
::  the truth rather than overwriting it. That is why a revoke can be sent
::  while a grant is still in flight, and why a retry of that grant is
::  harmless when it lands afterwards.
::
++  sync-reader
  |=  $:  =flag:b
          reader=ship
          bucket-id=@t
          desired=reader-state:b
          expires=@da
          awaiting=(unit request-id:b)
      ==
  ^+  cor
  =/  key=reader-key:b  [flag reader]
  =/  prior=(unit reader-sync:b)  (~(get by readers) key)
  =/  revision=@ud  ?~(prior 1 +(revision.u.prior))
  =/  synced=@ud  ?~(prior 0 synced.u.prior)
  ::  A client still waiting on the grant this supersedes will never be
  ::  answered by it -- the broker will keep the newer state -- so tell it
  ::  now rather than leaving it to time out.
  =/  stale=(unit request-id:b)  ?~(prior ~ awaiting.u.prior)
  =?  cor  !=(awaiting stale)
    %+  answer-waiter  key
    [%error %not-authorized 'access changed while the token was being issued']
  =.  readers
    (~(put by readers) key [revision bucket-id desired expires synced | awaiting])
  =.  cor  (emil (sync-cards ~[[key revision bucket-id desired]]))
  ::  Unconditionally: one timer walks the whole owed set, and +arm-reader-retry
  ::  is what keeps repeated arming from meaning repeated timers.
  arm-reader-retry
::
::  +reader-status: the one place a record's state is decided.
::
::  Expiry dominates everything else: past it the token the record names can no
::  longer be used, so there is nothing left to owe, serve or retry whatever
::  the revisions say. A refusal settles it next -- the broker will answer the
::  same way again -- then being level with the broker, and anything else is
::  still owed.
::
++  reader-status
  |=  sync=reader-sync:b
  ^-  reader-status:b
  ?:  (lte expires.sync now.bowl)  %lapsed
  ?:  failed.sync  %refused
  ?:  (gte synced.sync revision.sync)  %settled
  %owed
::
::  +owed: pairs the broker has not caught up with.
::
++  owed
  ^-  (list [key=reader-key:b revision=@ud bucket-id=@t desired=reader-state:b])
  %+  murn  ~(tap by readers)
  |=  [key=reader-key:b sync=reader-sync:b]
  ^-  (unit [reader-key:b @ud @t reader-state:b])
  ?.  ?=(%owed (reader-status sync))  ~
  `[key revision.sync bucket-id.sync desired.sync]
::
::  +sync-cards: one request per pair. The credential goes in a header: a
::  query string lands in access logs, and so would a bearer token in a path.
::
++  sync-cards
  |=  $:  wants=(list [key=reader-key:b revision=@ud bucket-id=@t desired=reader-state:b])
      ==
  ^-  (list card)
  ?~  wants  ~
  =/  secret=(unit @t)  genuine-secret
  ?~  secret
    %-  (slog leaf+"buckets: no %genuine secret, cannot sync readers" ~)
    ~
  %+  turn  wants
  |=  [key=reader-key:b revision=@ud bucket-id=@t desired=reader-state:b]
  ^-  card
  ::  Everything the request needs is on the record. Rebuilding it from live
  ::  bucket state would make a revoke undeliverable exactly when it matters
  ::  most -- the bucket has been deleted and its objects still exist.
  =/  common=(list [@t json])
    :~  ['bucketHost' s+(ship-text ship.flag.key)]
        ['bucketName' s+(scot %tas name.flag.key)]
        ['bucketId' s+bucket-id]
        ['actorShip' s+(ship-text reader.key)]
        ['revision' (numb:enjs:format revision)]
    ==
  ::  A revoke sends both fields as null rather than omitting them: the broker
  ::  reads the pair (token, expiresAtMillis) to tell a revoke from a grant,
  ::  and an explicit null says so without depending on how absent keys decode.
  =/  body=@t
    %-  en:json:html
    %-  pairs:enjs:format
    ?-  -.desired
        %revoked
      :*  ['token' ~]
          ['expiresAtMillis' ~]
          common
      ==
    ::
        %granted
      :*  ['token' s+token.desired]
          :-  'expiresAtMillis'
          (numb:enjs:format (mul 1.000 (unt:chrono:userlib expires-at.desired)))
          common
      ==
    ==
  =/  url=@t
    (rap 3 broker-base '/tokens/' (ship-text our.bowl) ~)
  =/  =request:http
    :*  %'PUT'  url
        :~  ['content-type' 'application/json']
            ['x-landscape-token' u.secret]
        ==
        `[(met 3 body) body]
    ==
  :*  %pass  (reader-wire key revision)  %arvo  %i
      %request  request  *outbound-config:iris
  ==
::
::  +take-upload: one broker answer about one upload session.
::
::  Every one of these has a client waiting on it, so there is no retry here
::  and no silent failure: the session either advances or the uploader is
::  told why it did not.
::
++  take-upload
  |=  $:  sid=@uv
          kind=?(%grant %retry %cancel %complete)
          res=client-response:iris
      ==
  ^+  cor
  ?~  got=(~(get by sessions) sid)  cor
  =/  ses=upload-session:b  u.got
  ?:  ?=(%cancel -.res)
    (fail-upload ses 'the storage request was cancelled')
  =/  code=@ud  status-code.response-header.res
  ?.  &((gte code 200) (lth code 300))
    (fail-upload ses (broker-message res))
  ?-  kind
      %grant   (took-grant ses res)
      %retry   (took-grant ses res)
      %cancel  (answer-uploader ses [%ok ~])
  ::
      ::  The receipt is this call's answer, so publishing it here is the
      ::  whole of completion -- there is no second delivery to wait for.
      %complete
    =/  fil=file:b  (entry-file entry.ses)
    ?.  (verify-receipt ses res)
      (fail-upload ses 'the storage receipt did not match the upload')
    =.  cor  (publish-upload ses requested-by.ses)
    (answer-uploader ses [%ok ~])
  ==
::
::  +took-grant: a signed PUT, from either a first grant or a retry.
::
++  took-grant
  |=  [ses=upload-session:b res=client-response:iris]
  ^+  cor
  ?~  body=(broker-body res)
    (fail-upload ses 'storage returned an unreadable grant')
  ?~  url=(~(get by u.body) 'uploadUrl')
    (fail-upload ses 'storage returned no upload URL')
  ?.  ?=([%s *] u.url)
    (fail-upload ses 'storage returned no upload URL')
  =/  reservation=(unit @t)
    ?~  got=(~(get by u.body) 'reservationId')  ~
    ?.(?=([%s *] u.got) ~ `p.u.got)
  =/  expiry=@da
    ?~  got=(~(get by u.body) 'uploadExpiresAtMillis')  expires-at.ses
    ?.  ?=([%n *] u.got)  expires-at.ses
    (from-unix-ms (rash p.u.got dem))
  =/  headers=(list [@t @t])  (broker-headers u.body)
  =/  bound=upload-session:b
    ?~(reservation ses ses(reservation reservation))
  =.  sessions  (~(put by sessions) id.ses bound)
  =?  reservations  ?=(^ reservation)
    (~(put by reservations) u.reservation id.ses)
  %+  answer-uploader  bound
  [%upload [id.ses id.entry.ses p.u.url headers expiry]]
::
::  +verify-receipt: does what landed match what we asked for.
::
::  Far less to check than when a receipt was pushed at us. Identity is now
::  ours by construction -- this is the answer to our own call against our own
::  reservation -- so what is left is the broker reporting the object it
::  actually stored, which is worth comparing against the entry we are about
::  to publish.
::
++  verify-receipt
  |=  [ses=upload-session:b res=client-response:iris]
  ^-  ?
  ?~  body=(broker-body res)  |
  =/  fil=file:b  (entry-file entry.ses)
  =/  object=(unit @t)
    ?~  got=(~(get by u.body) 'objectId')  ~
    ?.(?=([%s *] u.got) ~ `p.u.got)
  =/  mime=(unit @t)
    ?~  got=(~(get by u.body) 'mimeType')  ~
    ?.(?=([%s *] u.got) ~ `p.u.got)
  =/  size=(unit @ud)
    ?~  got=(~(get by u.body) 'size')  ~
    ?.(?=([%n *] u.got) ~ `(rash p.u.got dem))
  ?&  =(object `object-key.fil)
      =(mime `mime.fil)
      =(size `size.fil)
  ==
::
::  +broker-headers: the headers the signature covers.
::
::  Passed through exactly as given. They are part of what the URL is signed
::  over, so dropping one -- or changing its capitalisation -- makes the PUT
::  fail as a signature mismatch rather than as anything legible.
::
++  broker-headers
  |=  body=(map @t json)
  ^-  (list [@t @t])
  ?~  got=(~(get by body) 'requiredHeaders')  ~
  ?.  ?=([%a *] u.got)  ~
  %+  murn  p.u.got
  |=  =json
  ^-  (unit [@t @t])
  ?.  ?=([%a [%s *] [%s *] ~] json)  ~
  `[p.i.p.json p.i.t.p.json]
::
::  +broker-message: what the broker said went wrong, if it said anything.
::
++  broker-message
  |=  res=client-response:iris
  ^-  @t
  ?~  body=(broker-body res)  'storage refused the upload'
  ?~  got=(~(get by u.body) 'message')  'storage refused the upload'
  ?.(?=([%s *] u.got) 'storage refused the upload' p.u.got)
::
::  +fail-upload: settle a session the broker would not advance.
::
++  fail-upload
  |=  [ses=upload-session:b why=@t]
  ^+  cor
  =.  sessions
    (~(put by sessions) id.ses ses(status %cancelled, error `why))
  (answer-uploader ses [%error %unknown why])
::
++  from-unix-ms
  |=  ms=@ud
  ^-  @da
  (from-unix:chrono:userlib (div ms 1.000))
::
::  +broker-revision: the revision the broker says it holds, if it said.
::
::  It only matters when it is ahead of ours; a body we cannot parse simply
::  tells us nothing, which is not an error.
::
++  broker-body
  |=  res=client-response:iris
  ^-  (unit (map @t json))
  ?.  ?=(%finished -.res)  ~
  ?~  full-file.res  ~
  ?~  jon=(de:json:html q.data.u.full-file.res)  ~
  ?.  ?=([%o *] u.jon)  ~
  `p.u.jon
::
::  +broker-applied: whether the broker took the write, as it reported it.
::
::  The receipt says so outright, and inferring it from revisions instead gets
::  the equal case wrong: a reader whose record was pruned at its expiry opens
::  again at revision 1 while the broker still retains 1, which it answers 200
::  and does not apply. A body we cannot read tells us nothing, and the
::  revision comparison remains the fallback.
::
++  broker-applied
  |=  res=client-response:iris
  ^-  (unit ?)
  ?~  body=(broker-body res)  ~
  ?~  got=(~(get by u.body) 'applied')  ~
  ?.  ?=([%b *] u.got)  ~
  `p.u.got
::
++  broker-revision
  |=  res=client-response:iris
  ^-  (unit @ud)
  ?~  body=(broker-body res)  ~
  ?~  got=(~(get by u.body) 'currentRevision')  ~
  ?.  ?=([%n *] u.got)  ~
  `(rash p.u.got dem)
::
::  +broker-retryable: whether the broker says another attempt could work.
::
::  It marks a validation failure retryable:false and a service failure
::  retryable:true. Absent, we assume it is worth another go -- a transport
::  failure carries no body at all, and those are exactly the retryable ones.
::
++  broker-retryable
  |=  res=client-response:iris
  ^-  ?
  ?~  body=(broker-body res)  &
  ?~  got=(~(get by u.body) 'retryable')  &
  ?.  ?=([%b *] u.got)  &
  p.u.got
::
++  reader-wire
  |=  [key=reader-key:b revision=@ud]
  ^-  wire
  %+  weld
    /buckets/reader/(scot %p ship.flag.key)/[name.flag.key]
  /(scot %p reader.key)/(scot %ud revision)
::
::  +reader-retry-at: the instant the retry timer may next fire.
::
::  Snapped to a fixed grid instead of now-plus-an-interval, so every arming
::  that happens close together names the same instant. That is what lets
::  +arm-reader-retry cancel before it sets.
::
++  reader-retry-at
  ^-  @da
  (add (sub now.bowl (mod now.bowl push-retry)) (mul 2 push-retry))
::
::  +arm-reader-retry: make sure a sweep of what is owed is coming.
::
::  Cancel before setting, because guarding on "is anything owed right now"
::  does not bound this: a sync that confirms in milliseconds leaves the
::  timer armed and the next change finds nothing owed and arms another.
::  Harmless while they wake to no work -- but if an outage begins first,
::  every one of them re-sends the whole owed set and rearms, and the
::  duplication becomes permanent. Two grid slots can be live at once, which
::  is the most this can drift to.
::
++  arm-reader-retry
  ^+  cor
  =/  at=@da  reader-retry-at
  =.  cor  (emit [%pass /buckets/reader-retry %arvo %b %rest at])
  (emit [%pass /buckets/reader-retry %arvo %b %wait at])
::
::  +retry-readers: re-send everything still owed.
::
::  Blind retries are safe here — a stale one loses to the revision the broker
::  already holds — so this needs no bookkeeping beyond what is owed.
::
++  retry-readers
  ^+  cor
  ::  A pair drops out of +owed at its expiry whether or not it ever landed,
  ::  and this arm then returns without rearming, so nothing else revisits it.
  ::  What that strands depends on whose reader it is: ours has an expired
  ::  token still installed and a renewal loop that has quietly stopped, while
  ::  a subscriber's has a request waiting for an answer that is no longer
  ::  coming. Neither has anyone else to notice.
  =.  cor
    %+  roll  ~(tap by readers)
    |=  [[key=reader-key:b sync=reader-sync:b] acc=_cor]
    ?.  ?=(%lapsed (reader-status sync))  acc
    ?:  =(reader.key our.bowl)  (recover-local-reader:acc flag.key)
    %+  answer-waiter:acc  key
    [%error %unknown 'storage did not take this grant before it lapsed']
  =/  wants  owed
  ?~  wants  cor
  =.  cor  (emil (sync-cards wants))
  arm-reader-retry
::
::  +confirm-reader: the broker has caught up to `revision` for this pair.
::
::  If it reports a higher revision than we sent, our counter is behind its --
::  state loss on our side, or a message from an earlier incarnation. Adopt
::  its number and re-send, so our desired state wins rather than being
::  silently discarded as stale forever.
::
::  +fail-reader: the broker refused this revision as invalid.
::
++  fail-reader
  |=  [key=reader-key:b sent=@ud]
  ^+  cor
  ?~  got=(~(get by readers) key)  cor
  =/  sync=reader-sync:b  u.got
  ::  Only the revision we sent; a newer one may still be in flight.
  ?.  =(sent revision.sync)  cor
  =.  readers  (~(put by readers) key sync(failed &))
  ::  Nothing is owed for a failed revision, so for our own reader this is
  ::  where the renewal loop would otherwise stop for good.
  =?  cor  =(reader.key our.bowl)  (recover-local-reader flag.key)
  %+  answer-waiter  key
  [%error %unknown 'storage refused this access change']
::
++  confirm-reader
  |=  [key=reader-key:b sent=@ud theirs=(unit @ud) applied=(unit ?)]
  ^+  cor
  ?~  got=(~(get by readers) key)  cor
  =/  sync=reader-sync:b  u.got
  ::  Whether this ack tells us anything we did not already know. A repeat
  ::  delivery must not re-install or re-arm anything.
  =/  advanced=?  (gth sent synced.sync)
  =?  sync  advanced  sync(synced sent)
  ::  The broker did not take this write, so what we asked for is not what it
  ::  holds however the numbers compare. Adopt its revision and re-send above
  ::  it, or our desired state is discarded as stale from here on.
  ::
  ::  Its own report is the authority, not the comparison: a reader whose
  ::  record was pruned at its expiry opens again at revision 1 while the
  ::  broker still retains 1, and a strictly-greater test reads that as
  ::  agreement -- the client is then handed a token the broker never stored.
  ::  Where it says nothing, being behind is the only case we can detect.
  =/  stale=?
    ?^  applied  !u.applied
    ?&(?=(^ theirs) (gth u.theirs revision.sync))
  ?:  ?&(?=(^ theirs) stale)
    ::  Above what it kept, so the resend cannot tie with it again.
    =.  sync  sync(revision +(u.theirs), synced u.theirs)
    =.  readers  (~(put by readers) key sync)
    %-  (slog leaf+"buckets: broker was ahead of us, resending" ~)
    (emil (sync-cards ~[[key revision.sync bucket-id.sync desired.sync]]))
  =.  readers  (~(put by readers) key sync)
  ?.  advanced  cor
  ::  Only once the broker is level with what we last decided -- an ack for a
  ::  superseded revision says nothing about the state we now want.
  ?.  ?=(%settled (reader-status sync))  cor
  ?.  ?=(%granted -.desired.sync)  cor
  =/  tok=read-token:b  [token.desired.sync expires-at.desired.sync]
  ::  Installing is independent of anyone waiting: a renewal fired by the
  ::  refresh timer has no request behind it, and skipping it here left the
  ::  local scry serving the previous token until it lapsed and then forever.
  =?  read-tokens  =(reader.key our.bowl)
    (~(put by read-tokens) flag.key tok)
  =?  cor  =(reader.key our.bowl)
    (arm-token-refresh flag.key expires-at.desired.sync)
  (answer-waiter key [%token tok])
::
::  +granted-readers: pairs `test` accepts that currently hold a grant.
::
++  granted-readers
  |=  test=$-([reader-key:b reader-sync:b] ?)
  ^-  (list reader-key:b)
  %+  murn  ~(tap by readers)
  |=  [key=reader-key:b sync=reader-sync:b]
  ^-  (unit reader-key:b)
  ?.  ?=(%granted -.desired.sync)  ~
  ?.((test key sync) ~ `key)
::
::  +revoke-readers: move each pair to revoked at a higher revision.
::
::  There is nothing to undo locally beyond the desired state itself: the
::  grant only ever lived here and at the broker, and a revoked record is
::  what stops +held-read-token and the read verdict honouring it.
::
++  revoke-readers
  |=  keys=(list reader-key:b)
  ^+  cor
  %+  roll  keys
  |=  [key=reader-key:b acc=_cor]
  ::  Carry the bucket id and expiry off the record being replaced, so the
  ::  revoke stays deliverable after the bucket itself is gone.
  ?~  got=(~(get by readers.acc) key)  acc
  %-  sync-reader:acc
  [flag.key reader.key bucket-id.u.got [%revoked ~] expires.u.got ~]
::
++  url-encode
  |=  txt=@t
  ^-  @t
  (crip (en-urlt:html (trip txt)))
::
::  +keep-read-token: store a token the host issued us, and arm its refresh.
::
++  keep-read-token
  |=  [=flag:b tok=read-token:b]
  ^+  cor
  ?~  sp=(~(get by spaces) flag)  cor
  ?.  =(%sub net.u.sp)  cor
  =.  read-tokens  (~(put by read-tokens) flag tok)
  (arm-token-refresh flag expires-at.tok)
::
::  +renew-read-token: keep this ship's token current without a client asking.
::
::  Hosting a bucket means minting for ourselves; subscribing means asking the
::  host, over the same forwarding path a client action uses.
::
++  renew-read-token
  |=  =flag:b
  ^+  cor
  ?~  sp=(~(get by spaces) flag)  cor
  ?:  =(%pub net.u.sp)
    =/  st=bucket-state:b  (need-state flag)
    ?.  (group-can-read group.st flag our.bowl)
      (drop-read-token flag)
    (issue-read-token flag our.bowl ~)
  (forward `@uv`eny.bowl [%bucket flag [%issue-bucket-read ~]] ship.flag)
::
::  +drop-read-token: forget a bucket's token and revoke the capability behind
::  it. Called when we lose the bucket, and when a subscriber loses access.
::
++  drop-read-token
  |=  =flag:b
  ^+  cor
  =.  cor  (disarm-token-refresh flag)
  =.  read-tokens  (~(del by read-tokens) flag)
  ::  On a subscriber this finds nothing: only a host mints, so only a host
  ::  has anything to revoke.
  %-  revoke-readers
  %-  granted-readers
  |=([key=reader-key:b sync=reader-sync:b] =(flag flag.key))
::
::  +prune-broker-authority: drop expired capabilities, expired pending
::  sessions, and any reservation whose session is gone.
::
++  prune-broker-authority
  ^+  cor
  =.  object-capabilities
    %-  malt
    %+  skim  ~(tap by object-capabilities)
    |=  [token=@t aut=object-capability:b]
    (gth expires-at.aut now.bowl)
  ::  A settled session is kept only so a re-delivered completion can no-op
  ::  and its uploader can read the reason it failed. Both are short-lived,
  ::  and keeping them forever meant routine upload failures grew persisted
  ::  state without bound -- their entries were never published, so no
  ::  delete-entry could reach them either.
  =.  sessions
    %-  malt
    %+  skim  ~(tap by sessions)
    |=  [sid=@uv ses=upload-session:b]
    ?:  =(%pending status.ses)
      (gth expires-at.ses now.bowl)
    (gth (add expires-at.ses request-grace) now.bowl)
  =.  reservations
    %-  malt
    %+  skim  ~(tap by reservations)
    |=  [reservation=@t sid=@uv]
    (~(has by sessions) sid)
  =.  read-tokens
    %-  malt
    %+  skim  ~(tap by read-tokens)
    |=  [=flag:b tok=read-token:b]
    (gth expires-at.tok now.bowl)
  ::  One rule for both desired states, because past `expires` they say the
  ::  same nothing: the token the record names can no longer be used, so a
  ::  grant is worthless and a revoke is moot. Judging only the revoked ones
  ::  left every reader that ever held a token on record for good.
  ::
  ::  Anything still owed stays, whatever its age, or the broker never hears
  ::  about it; so does anything with a request still waiting on it. Dropping
  ::  a settled pair is safe because the broker keeps the higher revision: a
  ::  later grant re-opens at 1, loses as a stale write, and +confirm-reader
  ::  adopts the number it is told and re-sends.
  =.  readers
    %-  malt
    %+  skim  ~(tap by readers)
    |=  [key=reader-key:b sync=reader-sync:b]
    ::  A record with a request still waiting on it stays until that request
    ::  is answered, whatever else is true of it.
    ?.  ?=(~ awaiting.sync)  &
    ?-  (reader-status sync)
      ::  Still work to do, or still the answer to a read.
      %owed     &
      %settled  &
      ::  The broker refused this revision and will refuse it again, but the
      ::  record still stands until its own expiry says otherwise.
      %refused  &
      ::  Nothing left to owe, serve or retry.
      %lapsed   |
    ==
  cor
::
++  drop-bucket-sessions
  |=  =flag:b
  ^-  (map @uv upload-session:b)
  %-  malt
  %+  skip  ~(tap by sessions)
  |=  [sid=@uv ses=upload-session:b]
  =(flag flag.ses)
::
::  +session-token: resolve the opaque string Memex presents back to the
::  session that minted it.
::
++  session-token
  |=  token=@t
  ^-  (unit upload-session:b)
  ?~  sid=(slaw %uv token)  ~
  (~(get by sessions) u.sid)
::
++  rename-entry
  |=  [=flag:b id=@ud name=@t actor=ship]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  ?~  got=(~(get by entries.st) id)
    (answer [%error %not-found 'no such entry'])
  =/  ent=entry:b  u.got
  =.  ent  ent(name name, updated-by actor, updated-at now.bowl)
  =.  entries.st  (~(put by entries.st) id ent)
  (commit-update flag st [%entry id [%update ent]] actor)
::
++  move-entry
  |=  [=flag:b id=@ud parent=(unit @ud) actor=ship]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  ?.  (valid-parent st parent)
    (answer [%error %not-found 'no such parent folder'])
  ?~  got=(~(get by entries.st) id)
    (answer [%error %not-found 'no such entry'])
  =/  ent=entry:b  u.got
  ?:  ?&(?=(^ parent) =(u.parent id))
    (answer [%error %invalid-input 'an entry cannot contain itself'])
  ?:  ?&  ?=(%folder -.kind.ent)
          ?=(^ parent)
          (descendant st id u.parent)
      ==
    (answer [%error %invalid-input 'a folder cannot move inside itself'])
  =.  ent  ent(parent parent, updated-by actor, updated-at now.bowl)
  =.  entries.st  (~(put by entries.st) id ent)
  (commit-update flag st [%entry id [%update ent]] actor)
::
++  delete-entry
  |=  [=flag:b id=@ud recursive=? actor=ship]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  ?.  (~(has by entries.st) id)
    (answer [%error %not-found 'no such entry'])
  =/  ids=(set @ud)  (descendants st id)
  ?.  ?|(recursive =(1 ~(wyt in ids)))
    (answer [%error %invalid-input 'folder is not empty'])
  =.  entries.st
    %-  ~(rep in ids)
    |=  [key=@ud acc=_entries.st]
    (~(del by acc) key)
  =.  sessions
    %-  malt
    %+  skip  ~(tap by sessions)
    |=  [key=@uv ses=upload-session:b]
    ?.  =(flag flag.ses)  |
    ::  An in-flight upload's entry is deliberately absent from entries.st,
    ::  so it is never among the descendants -- but its parent can be. Drop
    ::  those too: otherwise its completion still authorizes and publishes an
    ::  entry under a folder that no longer exists, which nothing can reach.
    ?|  (~(has in ids) id.entry.ses)
        ?&  ?=(^ parent.entry.ses)
            (~(has in ids) u.parent.entry.ses)
        ==
    ==
  (commit-update flag st [%entries-deleted ~(tap in ids)] actor)
::
::  +commit-update: bump the revision, stamp attribution on the bucket, and
::  broadcast. The actor is passed in rather than read from src.bowl, which on
::  a broker callback is us rather than the uploader.
::
++  commit-update
  |=  [=flag:b st=bucket-state:b upd=u-bucket:b actor=ship]
  ^+  cor
  =.  revision.st  +(revision.st)
  =.  bucket.st
    bucket.st(updated-by actor, updated-at now.bowl)
  =.  cor  (put-state flag st)
  =/  res=response:b  [%update flag revision.st upd]
  (give [%fact ~[/v1 (updates-path flag)] buckets-response-1+!>(res)])
::
++  valid-parent
  |=  [st=bucket-state:b parent=(unit @ud)]
  ^-  ?
  ?~  parent  &
  ?~  ent=(~(get by entries.st) u.parent)  |
  =(%folder -.kind.u.ent)
::
::  +valid-mime: a content type must be present and look like type/subtype.
::  Memex refuses anything else, so refuse it here before committing state.
::
++  valid-mime
  |=  mime=@t
  ^-  ?
  =/  txt=tape  (trip mime)
  ?~  txt  |
  ?~  cut=(find "/" txt)  |
  &(!=(0 u.cut) !=(+(u.cut) (lent txt)))
::
++  entry-file
  |=  ent=entry:b
  ^-  file:b
  ?-  -.kind.ent
    %folder  ~|(%entry-is-a-folder !!)
    %file    +.kind.ent
  ==
::
++  descendant
  |=  [st=bucket-state:b ancestor=@ud candidate=@ud]
  ^-  ?
  =/  cur=(unit @ud)  `candidate
  |-
  ?~  cur  |
  ?:  =(u.cur ancestor)  &
  ?~  ent=(~(get by entries.st) u.cur)  |
  $(cur parent.u.ent)
::
++  descendants
  |=  [st=bucket-state:b root=@ud]
  ^-  (set @ud)
  ?>  (~(has by entries.st) root)
  =/  acc=(set @ud)  (silt ~[root])
  =/  queue=(list @ud)  ~[root]
  |-
  ?~  queue  acc
  =/  kids=(list @ud)
    %+  murn  ~(tap by entries.st)
    |=  [id=@ud ent=entry:b]
    ?~  parent.ent  ~
    ?:  =(u.parent.ent i.queue)  `id  ~
  %=  $
    queue  (weld t.queue kids)
    acc    (~(gas in acc) kids)
  ==
::
::  +group-exists: does %groups still hold this group?
::
::  Every permission read below has to ask this first. %groups' scry dispatch
::  answers no-such-path for a group it does not have, and a scry that
::  resolves to nothing crashes the event rather than returning ~ -- so
::  without this guard, deleting a group takes down the very pass that would
::  revoke its buckets' tokens, at exactly the moment it is needed.
::
::  Answering | is safe rather than merely convenient: a bucket is only ever
::  hosted by its group's host, so a group we host is always local and
::  "missing" means deleted, not not-yet-synced.
::
++  group-exists
  |=  group=flag:b
  ^-  ?
  =/  pax=path
    /(scot %p our.bowl)/groups/(scot %da now.bowl)/groups/(scot %p ship.group)/[name.group]
  .^(? %gu pax)
::
++  group-can-read
  |=  [group=flag:b =flag:b who=ship]
  ^-  ?
  ?:  =(who ship.flag)  &
  ?.  (group-exists group)  |
  =/  pax=path
    /(scot %p our.bowl)/groups/(scot %da now.bowl)/v2/groups/(scot %p ship.group)/[name.group]/channels/can-read/noun
  =/  test=$-([ship nest:b] ?)  .^($-([ship nest:b] ?) %gx pax)
  (test who [%buckets ship.flag name.flag])
::
++  group-is-admin-for-create
  |=  [group=flag:b who=ship]
  ^-  ?
  ?:  =(who ship.group)  &
  ?.  (group-exists group)  |
  =/  pax=path
    /(scot %p our.bowl)/groups/(scot %da now.bowl)/v2/groups/(scot %p ship.group)/[name.group]/seats/(scot %p who)/is-admin/noun
  .^(? %gx pax)
::
++  group-permissions
  |=  [group=flag:b =flag:b who=ship]
  ^-  (unit [admin=? roles=(set @tas)])
  ?:  =(who ship.flag)  `[& ~]
  ?.  (group-exists group)  ~
  =/  pax=path
    /(scot %p our.bowl)/groups/(scot %da now.bowl)/v2/groups/(scot %p ship.group)/[name.group]/channels/buckets/(scot %p ship.flag)/[name.flag]/can-write/(scot %p who)/noun
  .^((unit [admin=? roles=(set @tas)]) %gx pax)
::
++  group-is-admin
  |=  [group=flag:b =flag:b who=ship]
  ^-  ?
  =/  permissions=(unit [admin=? roles=(set @tas)])
    (group-permissions group flag who)
  ?~  permissions  |
  admin.u.permissions
::
++  group-can-write
  |=  [group=flag:b =flag:b writers=(set @tas) who=ship]
  ^-  ?
  ?.  (group-can-read group flag who)  |
  =/  permissions=(unit [admin=? roles=(set @tas)])
    (group-permissions group flag who)
  ?~  permissions  |
  ?|  admin.u.permissions
      =(~ writers)
      !=(~ (~(int in writers) roles.u.permissions))
  ==
::
::  +action-authorized: may `who` run this verb on this bucket? Admin verbs
::  gate on the group's admin set, writes on the bucket's writer roles, and a
::  read grant only needs read access.
::
++  action-authorized
  |=  [st=bucket-state:b =flag:b who=ship act=a-bucket:b]
  ^-  ?
  ?-  -.act
    %delete         (group-is-admin group.st flag who)
    %set-title      (group-is-admin group.st flag who)
    %set-writers    (group-is-admin group.st flag who)
    %issue-bucket-read  (group-can-read group.st flag who)
    %create-folder  (group-can-write group.st flag writers.st who)
    %begin-upload   (group-can-write group.st flag writers.st who)
    ::  The session verbs check the uploader owns the session as well, so a
    ::  writer cannot finish, retry or cancel someone else's upload.
    %finish-upload  (group-can-write group.st flag writers.st who)
    %retry-upload   (group-can-write group.st flag writers.st who)
    %cancel-upload  (group-can-write group.st flag writers.st who)
    %issue-delete   (group-can-write group.st flag writers.st who)
    %entry          (group-can-write group.st flag writers.st who)
  ==
::
++  ship-text
  |=  who=ship
  ^-  @t
  (crip (slag 1 (trip (scot %p who))))
::
++  broker-simple-verdict
  |=  result=@t
  ^-  json
  (pairs:enjs:format ~[['result' s+result]])
::
::  +refuse: answer the broker with a denial, and say locally which condition
::  produced it.
::
::  The wire vocabulary is closed: Pioneer parses only authorized, denied and
::  expired, and fails outright on anything else -- see +outcomeFrom in
::  pkg/runtime/pioneer/lib/Pioneer/Buckets.hs. So a dozen conditions have to
::  share one value, and splitting them properly means changing the broker
::  protocol, not just this agent.
::
::  What they do not have to share is silence. Memex sees a 403 and maps it to
::  non-retryable; without this the ship keeps no record of whether that was a
::  real permission failure or its own state being missing, which is the
::  difference between a bug and a correct refusal.
::
++  refuse
  |=  why=@tas
  ^-  json
  %-  (slog leaf+"buckets: refused a broker request, {<why>}" ~)
  (broker-simple-verdict 'denied')
::
::  +broker-object-verdict: answer Memex about one object.
::
::  A read capability covers the bucket, so the object is resolved by its key
::  rather than named by the capability; a delete capability names its entry.
::  Either way access is re-checked against the live group here.
::
::  The %read arm stays even though a broker holding a pushed token answers
::  reads from its own table without asking. The broker keeps a Pioneer
::  fallback for hosts that do not push yet, and it fires whenever it has no
::  row -- so this is what answers when a token is live here but absent
::  there. It cannot resurrect a revoked one: revocation deletes the local
::  capability too, so this arm refuses it as well. Deletes always ask.
::
++  broker-object-verdict
  |=  [kind=object-kind:b token=@t object=@t]
  ^-  json
  ::  A read token lives in the desired state we sync, a delete token in the
  ::  per-object capabilities. Resolving both to the same shape here keeps the
  ::  checks below common; a revoked reader resolves to nothing, so the arm
  ::  refuses it exactly as it refuses an unknown token.
  =/  resolved=(unit object-capability:b)
    ?:  =(%delete kind)  (~(get by object-capabilities) token)
    %-  ~(rep by readers)
    |=  [[key=reader-key:b sync=reader-sync:b] acc=(unit object-capability:b)]
    ?^  acc  acc
    ?.  ?=(%granted -.desired.sync)  ~
    ?.  =(token token.desired.sync)  ~
    `[%read flag.key ~ reader.key expires-at.desired.sync]
  ?~  resolved  (refuse %no-such-capability)
  =/  aut=object-capability:b  u.resolved
  ?.  =(kind kind.aut)  (refuse %capability-wrong-kind)
  ?.  (gth expires-at.aut now.bowl)
    (broker-simple-verdict 'expired')
  ?~  sp=(~(get by spaces) flag.aut)  (refuse %no-such-bucket)
  ?~  st-unit=state.u.sp  (refuse %bucket-state-missing)
  =/  st=bucket-state:b  u.st-unit
  ?.  ?:  =(%read kind.aut)
        (group-can-read group.st flag.aut actor.aut)
      (group-can-write group.st flag.aut writers.st actor.aut)
    (refuse %not-permitted)
  =/  found=(unit entry:b)
    ?^  entry-id.aut
      (~(get by entries.st) u.entry-id.aut)
    ::  bucket-scoped: find the entry this object key belongs to
    %-  ~(rep by entries.st)
    |=  [[id=@ud ent=entry:b] acc=(unit entry:b)]
    ?^  acc  acc
    ?.  ?=(%file -.kind.ent)  ~
    ?.(=(object object-key.file.kind.ent) ~ `ent)
  ?~  found  (refuse %no-such-entry)
  =/  ent=entry:b  u.found
  ?.  ?=(%file -.kind.ent)  (refuse %entry-is-a-folder)
  =/  fil=file:b  +.kind.ent
  ?.  =(%ready status.fil)  (refuse %file-not-ready)
  ?.  =(object object-key.fil)  (refuse %object-key-mismatch)
  =/  payload=json
    ?:  =(%read kind.aut)
      %-  pairs:enjs:format
      :~  ['bucketId' s+(scot %ud id.bucket.st)]
          ['objectId' s+object-key.fil]
          ['displayFilename' s+name.ent]
      ==
    %-  pairs:enjs:format
    :~  ['bucketId' s+(scot %ud id.bucket.st)]
        ['objectId' s+object-key.fil]
    ==
  =/  key=@t  ?:(=(%read kind.aut) 'read' 'delete')
  %-  pairs:enjs:format
  :~  ['result' s+'authorized']
      [key payload]
  ==
::
++  updates-path
  |=  =flag:b
  ^-  path
  /v1/buckets/(scot %p ship.flag)/[name.flag]/updates
::
++  sub-wire
  |=  =flag:b
  ^-  wire
  /buckets/sub/(scot %p ship.flag)/[name.flag]
::
++  start-sub
  |=  [=flag:b group=flag:b]
  ^+  cor
  ?:  (~(has by spaces) flag)  cor
  =.  spaces  (~(put by spaces) flag [%sub ~ `group])
  %-  emit
  [%pass (sub-wire flag) %agent [ship.flag %buckets] %watch (updates-path flag)]
::
++  stop-sub
  |=  =flag:b
  ^+  cor
  ?~  sp=(~(get by spaces) flag)  cor
  ?.  =(%sub net.u.sp)  cor
  =.  cor  (drop-read-token flag)
  =.  cor  (emil (drop (report-active flag u.sp |)))
  ::  Local clients watch our /v1, not the host's, so leaving the host says
  ::  nothing to them. Without this a still-mounted client keeps showing the
  ::  manifest of a replica this ship no longer has -- it refreshes on mount,
  ::  on an operation, or on a revision gap, and none of those arrive on
  ::  their own.
  =/  rev=@ud  ?~(state.u.sp 0 +(revision.u.state.u.sp))
  =/  res=response:b  [%update flag rev [%delete ~]]
  =.  cor  (give [%fact ~[/v1 (updates-path flag)] buckets-response-1+!>(res)])
  =.  spaces  (~(del by spaces) flag)
  %-  emit
  [%pass (sub-wire flag) %agent [ship.flag %buckets] %leave ~]
::
::  +resub: re-establish a dropped subscription without discarding the
::  replica. A kick is not a revocation — the host kicks deliberately when
::  access is pulled, but Gall also kicks on restart and transient failure.
::
++  resub
  |=  =flag:b
  ^+  cor
  ?~  sp=(~(get by spaces) flag)  cor
  ?.  =(%sub net.u.sp)  cor
  %-  emit
  [%pass (sub-wire flag) %agent [ship.flag %buckets] %watch (updates-path flag)]
::
++  report-active
  |=  [=flag:b sp=space:b joined=?]
  ^-  (unit card)
  =/  grp=(unit flag:b)
    ?~  state.sp  pending-group.sp
    `group.u.state.sp
  ?~  grp  ~
  =/  nes=nest:b  [%buckets ship.flag name.flag]
  :-  ~
  :*  %pass  /report-active  %agent  [our.bowl %groups]
      %poke  group-channel-active+!>([u.grp nes joined])
  ==
::
++  watch
  |=  =(pole knot)
  ^+  cor
  ?+  pole  ~|(bad-buckets-watch+pole !!)
      [%http-response *]  cor
  ::
      [%v1 ~]
    ?>  =(src.bowl our.bowl)
    =/  facts=(list card)
      %+  murn  local-snapshots
      |=  snap=snapshot:b
      `[%give %fact ~ buckets-response-1+!>(`response:b`[%snapshot flag.snap bucket-state.snap])]
    (emil facts)
  ::
  ::  Terminal responses for actions submitted by clients on this ship. All
  ::  local clients share one path; tokens in a %grant are scoped to this
  ::  ship's user, who is the only subscriber.
  ::
      [%v1 %requests ~]
    ?>  =(src.bowl our.bowl)
    cor
  ::
  ::  A subscriber attaches here while waiting for our answer to one of its
  ::  forwarded commands. Only the requester named in the path may listen.
  ::
      [%v1 %request who=@ rid=@ ~]
    ?>  =(src.bowl (slav %p who.pole))
    cor
  ::
      [%v1 %buckets host=@ name=@ %updates ~]
    =/  =flag:b  [(slav %p host.pole) `@tas`name.pole]
    ?>  =(ship.flag our.bowl)
    =/  st=bucket-state:b  (need-state flag)
    ?>  (group-can-read group.st flag src.bowl)
    (give [%fact ~ buckets-response-1+!>(`response:b`[%snapshot flag st])])
  ==
::
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+  pole  ~
      [%x %v1 %buckets full=?(~ [%full ~])]
    ?^  full.pole
      ``buckets-snapshots-1+!>(local-snapshots)
    ``buckets-summaries-1+!>(local-summaries)
  ::
      [%x %v1 %buckets host=@ name=@ ~]
    =/  =flag:b  [(slav %p host.pole) `@tas`name.pole]
    ?~  sp=(~(get by spaces) flag)  ~
    ?~  state.u.sp  ~
    ``buckets-response-1+!>(`response:b`[%snapshot flag u.state.u.sp])
  ::
      [%x %v1 %broker %read cap=@ object=@ ~]
    ``json+!>((broker-object-verdict %read cap.pole object.pole))
  ::
      [%x %v1 %broker %delete cap=@ object=@ ~]
    ``json+!>((broker-object-verdict %delete cap.pole object.pole))
  ::
  ::  So an operator can confirm which broker a live host is pointed at
  ::  without reading its state.
  ::
      [%x %v1 %broker %base ~]
    ``json+!>(`json`s+broker-base)
  ::
  ::  Versioned mark rather than %noun: the client reads this over Eyre as
  ::  JSON, and %noun grows only to mime, so a bare noun answers 500 here.
  ::
      [%x %v1 %buckets host=@ name=@ %read-token ~]
    =/  =flag:b  [(slav %p host.pole) `@tas`name.pole]
    ?~  tok=(~(get by read-tokens) flag)  ~
    ``buckets-read-token-1+!>(`read-token:b`u.tok)
  ::
  ::  +ready: a constant, because the answer existing is the whole signal --
  ::  a client asking whether this ship can host Buckets needs to know the
  ::  desk is installed, nothing more. It reads /v1/buckets for this before,
  ::  which serialises every bucket's entire manifest, entries and all, and
  ::  so grew slower the more anyone stored.
  ::
      [%x %v1 %ready ~]
    ``json+!>(`json`b+&)
  ::
      [%u %joined host=@ name=@ ~]
    =/  =flag:b  [(slav %p host.pole) `@tas`name.pole]
    ``loob+!>((~(has by spaces) flag))
  ==
::
++  local-snapshots
  ^-  (list snapshot:b)
  %+  murn  ~(tap by spaces)
  |=  [=flag:b sp=space:b]
  ?~  state.sp  ~
  `[flag u.state.sp]
::
::  +local-summaries: the same buckets without their entries. Drops the one
::  unbounded field, so asking which buckets exist costs the same whether
::  they hold nothing or everything.
::
++  local-summaries
  ^-  (list summary:b)
  %+  murn  ~(tap by spaces)
  |=  [=flag:b sp=space:b]
  ?~  state.sp  ~
  =/  st=bucket-state:b  u.state.sp
  `[flag bucket.st group.st writers.st revision.st]
::
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+  pole  cor
      [%groups ~]
    ?+  -.sign  cor
        %kick  watch-groups
        %fact
      (take-groups !<(r-groups:v9:gv q.cage.sign))
    ::
    ::  A refusal loses the subscription exactly as a kick does, and losing it
    ::  is not survivable: these facts are the only thing that calls
    ::  +recheck-host-subs, which is the only thing that revokes. Without them
    ::  a reader who loses access keeps a working token until it expires,
    ::  silently, for as long as the ship runs. Logging it was not a recovery.
        %watch-ack
      ?~  p.sign  cor
      %-  (slog leaf+"buckets: groups watch refused, retrying" u.p.sign)
      (emit [%pass /groups/retry %arvo %b %wait (add now.bowl groups-retry)])
    ==
  ::

  ::
      [%buckets %sub host=@ name=@ ~]
    =/  =flag:b  [(slav %p host.pole) `@tas`name.pole]
    ?~  sp=(~(get by spaces) flag)  cor
    ?.  =(%sub net.u.sp)  cor
    ?+  -.sign  cor
        %fact
      ?.  =(%buckets-response-1 p.cage.sign)  cor
      (apply-response !<(response:b q.cage.sign))
    ::
    ::  A kick is not a revocation, so re-watch rather than dropping the
    ::  replica. The host's nack below is what tells us access is gone.
    ::
    ::  The token does go, though: a host that revoked our access kicks us in
    ::  the same breath, and if access is restored before the re-watch is
    ::  acknowledged we never reach the nack. Keeping it would leave the local
    ::  scry answering with a token the broker has already dropped, and the
    ::  client would never ask for another.
        %kick
      =.  cor  (drop-read-token flag)
      (resub flag)
    ::
        %watch-ack
      ?~  p.sign  cor
      (stop-sub flag)
    ==
  ::
      [%buckets %req host=@ rid=@ %watch ~]
    =/  host=ship  (slav %p host.pole)
    =/  rid=request-id:b  (slav %uv rid.pole)
    ?+  -.sign  cor
        %fact
      ?.  =(%buckets-req-response-1 p.cage.sign)  cor
      ?.  (request-live rid)  cor
      =/  res=req-response:b  !<(req-response:b q.cage.sign)
      ::  %pending is the host saying it is still working -- minting a read
      ::  token, say, while its push to the broker is in flight. Closing here
      ::  would drop the request and cancel its timeout, and the real answer
      ::  would arrive to find nothing waiting. Our client was already told
      ::  pending when we forwarded, so there is nothing to pass on.
      ?:  ?=(%pending -.body.res)  cor
      ::  A token answer is ours to keep, but only under the bucket the
      ::  request named: tokens are bucket-scoped, so filing one under a
      ::  sibling bucket on the same host would leave both wrong. Read it
      ::  before closing, which is what drops the record.
      =/  token-for=(unit flag:b)
        ?~(got=(~(get by pending) rid) ~ token-for.u.got)
      =.  cor  (close-request host rid)
      =?  cor  &(?=(%token -.body.res) ?=(^ token-for))
        (keep-read-token u.token-for read-token.body.res)
      ::  A refused token request leaves no refresh armed, and our old token
      ::  may already have lapsed -- the client would go on reading it either
      ::  way. Come back to it, unless the answer was that we may not read
      ::  this bucket at all, in which case stop serving what we hold.
      =?  cor  &(?=(%error -.body.res) ?=(^ token-for))
        ?:  =(%not-authorized type.body.res)
          (drop-read-token u.token-for)
        (retry-read-token u.token-for)
      (respond rid ~[/v1/requests] body.res)
    ::
    ::  A dropped request stream is the same loss as a timeout: if it was a
    ::  renewal, its refresh has already fired and nothing else will rearm it,
    ::  so the local scry would keep serving a token past its expiry.
        %kick
      (abandon-request host rid 'host closed the request stream')
    ::
        %watch-ack
      ?~  p.sign  cor
      (abandon-request host rid 'host refused the request stream')
    ==
  ::
  ::  The poke-ack only reports delivery. A nack means the host crashed on
  ::  the command, so answer now rather than waiting for the timeout.
      [%buckets %req host=@ rid=@ %poke ~]
    =/  host=ship  (slav %p host.pole)
    =/  rid=request-id:b  (slav %uv rid.pole)
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      %-  (slog leaf+"buckets: host command failed" u.p.sign)
      (abandon-request host rid 'host rejected the command')
    ==
  ::
      [%buckets @ @ ?(%create %delete) ~]
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      ((slog leaf+"buckets: group channel registration failed" u.p.sign) cor)
    ==
  ::
      [%report-active ~]
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      ((slog leaf+"buckets: active-channel report failed" u.p.sign) cor)
    ==
  ==
::
++  arvo
  |=  [=(pole knot) =sign-arvo]
  ^+  cor
  ?+  pole  cor
      [%eyre ~]
    ?.  ?=([%eyre %bound *] sign-arvo)  cor
    ?:  accepted.sign-arvo  cor
    %-  (slog leaf+"buckets: eyre bind rejected" ~)
    cor
  ::
      [%buckets %token host=@ name=@ ~]
    ?.  ?=([%behn %wake *] sign-arvo)  cor
    =/  =flag:b  [(slav %p host.pole) `@tas`name.pole]
    ?~  sp=(~(get by spaces) flag)  cor
    ::  Refreshing is the same request a client makes; when we host the bucket
    ::  Gall loops the poke back to us and it is served locally.
    (renew-read-token flag)
  ::
      ::  The verb is typed here rather than inside, so the switch on it stays
      ::  exhaustive and a wire naming anything else falls through untouched.
      [%buckets %upload sid=@ kind=?(%grant %retry %cancel %complete) ~]
    ?.  ?=([%iris %http-response *] sign-arvo)  cor
    =*  res  client-response.sign-arvo
    ?:  ?=(%progress -.res)  cor
    (take-upload (slav %uv sid.pole) kind.pole res)
  ::
      [%buckets %reader host=@ name=@ who=@ rev=@ ~]
    ?.  ?=([%iris %http-response *] sign-arvo)  cor
    =*  res  client-response.sign-arvo
    ?:  ?=(%progress -.res)  cor
    =/  key=reader-key:b
      :-  [(slav %p host.pole) `@tas`name.pole]
      (slav %p who.pole)
    =/  sent=@ud  (slav %ud rev.pole)
    ::  A cancelled request is a refusal, not silence. Nothing is undone: the
    ::  desired state stands and the retry timer will send it again.
    ?:  ?=(%cancel -.res)
      %-  (slog leaf+"buckets: reader sync was cancelled" ~)
      cor
    =/  code=@ud  status-code.response-header.res
    =/  theirs=(unit @ud)  (broker-revision res)
    ::  A stale write is not a failure -- it answers 200 with the revision it
    ::  kept, and adopting that is how we catch up.
    ?:  &((gte code 200) (lth code 300))
      (confirm-reader key sent theirs (broker-applied res))
    ::  Only a success may confirm. An error body carries no revision under
    ::  the broker's contract, and adopting one from a rejection would install
    ::  a grant it just refused. Falling behind is recovered on the success
    ::  path instead: a stale write answers 200 with the revision the broker
    ::  kept, which +confirm-reader adopts.
    ?:  (broker-retryable res)
      %-  (slog leaf+"buckets: reader sync failed, status {<code>}, retrying" ~)
      cor
    ::  Refused as invalid rather than stale. Another attempt gets the same
    ::  answer, so stop owing it and tell anyone waiting.
    %-  (slog leaf+"buckets: reader sync rejected, status {<code>}" ~)
    (fail-reader key sent)
  ::
      [%groups %retry ~]
    ?.  ?=([%behn %wake *] sign-arvo)  cor
    ::  Ask again whether or not we still lack it; a subscription we already
    ::  hold answers with a %watch-ack we ignore.
    watch-groups
  ::
      [%buckets %reader-retry ~]
    ?.  ?=([%behn %wake *] sign-arvo)  cor
    retry-readers
  ::
      [%buckets %req host=@ rid=@ %wake ~]
    ?.  ?=([%behn %wake *] sign-arvo)  cor
    =/  host=ship  (slav %p host.pole)
    =/  rid=request-id:b  (slav %uv rid.pole)
    ?.  (request-live rid)  cor
    ::  A timed-out refresh leaves no timer armed and our old token in place,
    ::  which the local scry keeps answering with even once it lapses. Come
    ::  back to it rather than waiting on something that was never set.
    =/  token-for=(unit flag:b)
      ?~(got=(~(get by pending) rid) ~ token-for.u.got)
    =.  pending  (~(del by pending) rid)
    =?  cor  ?=(^ token-for)  (retry-read-token u.token-for)
    =.  cor
      %-  emit
      :*  %pass  (req-watch-wire host rid)  %agent  [host %buckets]
          %leave  ~
      ==
    (deny rid ~[/v1/requests] %unknown 'the host did not answer in time')
  ==
::
++  apply-response
  |=  res=response:b
  ^+  cor
  ?-  -.res
      %snapshot
    =/  sp=space:b  (need-space flag.res)
    ?>  =(%sub net.sp)
    =.  sp  sp(state `bucket-state.res, pending-group `group.bucket-state.res)
    =.  spaces  (~(put by spaces) flag.res sp)
    =.  cor  (emil (drop (report-active flag.res sp &)))
    (give [%fact ~[/v1] buckets-response-1+!>(res)])
  ::
      %update
    =/  sp=space:b  (need-space flag.res)
    ?>  =(%sub net.sp)
    ?~  state.sp  cor
    =/  st=bucket-state:b  u.state.sp
    ::  Ignore duplicates and re-establish the subscription on a gap. The
    ::  replacement watch begins with a full snapshot, so later deltas cannot
    ::  be applied to a stale replica.
    ?:  (lte revision.res revision.st)  cor
    ?.  =(revision.res +(revision.st))
      (resub flag.res)
    ?:  =(%delete -.u-bucket.res)
      =.  cor  (give [%fact ~[/v1] buckets-response-1+!>(res)])
      =.  cor  (emil (drop (report-active flag.res sp |)))
      ::  Drop the token with the bucket, as +stop-sub does. Left behind, the
      ::  local scry keeps answering with it, so a bucket recreated under the
      ::  same flag is read with a token the host has already revoked and the
      ::  client never asks for a new one.
      =.  cor  (drop-read-token flag.res)
      =.  spaces  (~(del by spaces) flag.res)
      cor
    =.  st  (apply-update st u-bucket.res)
    =.  revision.st  revision.res
    =.  spaces  (~(put by spaces) flag.res [net.sp `st `group.st])
    (give [%fact ~[/v1] buckets-response-1+!>(res)])
  ==
::
++  apply-update
  |=  [st=bucket-state:b upd=u-bucket:b]
  ^-  bucket-state:b
  ?-  -.upd
      %create   st(bucket bucket.upd)
      %delete   st
      %meta     st(bucket bucket.upd)
      %writers  st(writers writers.upd)
  ::
      %entry
    st(entries (~(put by entries.st) id.upd entry.u-entry.upd))
  ::
      %entries-deleted
    =.  entries.st
      %-  ~(rep in (silt ids.upd))
      |=  [key=@ud acc=_entries.st]
      (~(del by acc) key)
    st
  ==
::
::  +recheck-host-subs: read permissions may have shifted in `changed`, so
::  re-run can-read for subscribers of buckets bound to that group and kick
::  any who lost access. Scoped to the one group — a fact about some other
::  group is not a reason to scry for every subscriber we have. Grants are
::  handled by %groups' auto-join, so this only revokes.
::
::  +take-groups: react to a change in a group we host buckets for.
::
::  Follows %channels-server, which owns its channels' writer roles the way we
::  own ours: react to the specific change when it arrives, and reconcile the
::  whole set whenever the group arrives whole. The pair matters because
::  neither half is sufficient -- a fact we miss is repaired by the sweep, and
::  the sweep only happens when a group is re-read.
::
++  take-groups
  |=  =r-groups:v9:gv
  ^+  cor
  =*  r-group  r-group.r-groups
  =.  cor  (recheck-host-subs flag.r-groups)
  ?+    r-group  cor
      ::  A role that no longer exists must stop granting writes. Role ids are
      ::  minted from the role's title, so deleting one and making another by
      ::  the same name reuses the id -- and a stale id left in .writers would
      ::  hand write and delete on every bucket that named it to whoever joins
      ::  the new role.
      [%role * %del ~]
    (strip-writers flag.r-groups roles.r-group)
  ::
      ::  The group arrived whole, so anything we hold that it does not have
      ::  is stale however we came to miss it.
      [%create *]
    %+  strip-writers  flag.r-groups
    %-  ~(dif in (held-writers flag.r-groups))
    ~(key by roles.group.r-group)
  ==
::
::  +held-writers: every role id our buckets in this group grant writes to.
::
++  held-writers
  |=  group=flag:b
  ^-  (set @tas)
  %+  roll  ~(val by spaces)
  |=  [sp=space:b acc=(set @tas)]
  ?.  =(%pub net.sp)  acc
  ?~  state.sp  acc
  ?.  =(group group.u.state.sp)  acc
  (~(uni in acc) writers.u.state.sp)
::
::  +strip-writers: drop role ids from every bucket in this group that names
::  them, and tell subscribers the permissions changed.
::
++  strip-writers
  |=  [group=flag:b roles=(set @tas)]
  ^+  cor
  ?:  =(~ roles)  cor
  %+  roll  ~(tap by spaces)
  |=  [[=flag:b sp=space:b] acc=_cor]
  ?.  =(%pub net.sp)  acc
  ?~  state.sp  acc
  =/  st=bucket-state:b  u.state.sp
  ?.  =(group group.st)  acc
  =/  kept=(set @tas)  (~(dif in writers.st) roles)
  ?:  =(kept writers.st)  acc
  %-  (slog leaf+"buckets: dropping deleted roles from {<flag>} writers" ~)
  (commit-update:acc flag st(writers kept) [%writers kept] our.bowl)
::
++  recheck-host-subs
  |=  changed=flag:b
  ^+  cor
  ::  Buckets we host that belong to the group that changed, mapped to it.
  ::  Everything below is scoped to these: a fact about one group is no
  ::  reason to re-scry permissions for buckets bound to another.
  =/  affected=(map flag:b flag:b)
    %-  malt
    %+  murn  ~(tap by spaces)
    |=  [=flag:b sp=space:b]
    ^-  (unit [flag:b flag:b])
    ?.  =(%pub net.sp)  ~
    ?~  state.sp  ~
    ?.  =(changed group.u.state.sp)  ~
    `[flag group.u.state.sp]
  ?:  =(~ affected)  cor
  =/  kicks=(list card)
    %+  murn  ~(val by sup.bowl)
    |=  [who=ship pax=path]
    ^-  (unit card)
    ?.  ?=([%v1 %buckets @ @ %updates ~] pax)  ~
    =/  =flag:b  [(slav %p i.t.t.pax) `@tas`i.t.t.t.pax]
    ?~  group=(~(get by affected) flag)  ~
    ?:  (group-can-read u.group flag who)  ~
    `[%give %kick ~[pax] `who]
  ::  Revocation is driven by the tokens, not by the subscriptions. A reader
  ::  that took a token and then left or dropped its subscription has no
  ::  entry in sup.bowl, so it produces no kick -- and because the broker
  ::  serves a pushed token without asking us again, that token would keep
  ::  working for every ready file until it lapsed. Asking the group about
  ::  each token's own reader and bucket catches those, and stops a reader
  ::  losing one bucket from having its tokens for other buckets revoked.
  =.  cor
    %-  revoke-readers
    %-  granted-readers
    |=  [key=reader-key:b sync=reader-sync:b]
    ?~  group=(~(get by affected) flag.key)  |
    !(group-can-read u.group flag.key reader.key)
  (emil kicks)
--

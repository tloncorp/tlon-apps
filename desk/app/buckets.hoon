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
/-  b=buckets
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
::  +broker-base: where the storage broker lives.
::
::  Must stay in step with BUCKETS_BROKER_URL in
::  packages/shared/src/store/storage/bucketsBroker.ts — clients and hosts
::  talk to the same service, from opposite directions.
::
++  broker-base  'https://memex.tlon.network/v2/buckets'
::  +push-retry: how soon to mint again after the broker refused a token.
::
::  A token the broker never accepted is never stored, so there is nothing to
::  fall back on; this is how long before we try again unprompted.
::
++  push-retry  ~m1
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
++  init
  ^+  cor
  %-  emil
  :~  [%pass /eyre %arvo %e %connect [~ /buckets] %buckets]
      [%pass /groups %agent [our.bowl %groups] %watch /v1/groups]
  ==
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
    (emit [%pass /groups %agent [our.bowl %groups] %watch /v1/groups])
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
    (dispatch-local request-id.cmd act.cmd)
  ::
      %buckets-command-1
    =+  cmd=!<(command:b vase)
    (dispatch-remote request-id.cmd act.cmd)
  ::
      %buckets-broker-command-1
    ?>  =(src.bowl our.bowl)
    (apply-broker-command !<(broker-command:b vase))
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
  (handle-read eyre-id t.t.t.site)
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
  =.  pending  (~(put by pending) rid [host until])
  =.  cor
    %-  emit
    :*  %pass  (req-poke-wire host rid)  %agent  [host %buckets]
        %poke  buckets-command-1+!>(`command:b`[rid act])
    ==
  =.  cor
    %-  emit
    :*  %pass  (req-watch-wire host rid)  %agent  [host %buckets]
        %watch  (host-req-path our.bowl rid)
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
++  close-request
  |=  [host=ship rid=request-id:b]
  ^+  cor
  =/  got=(unit [host=ship until=@da])  (~(get by pending) rid)
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
  ?:  (~(has by spaces) flag)
    =/  st=bucket-state:b  (need-state flag)
    ?>  =(group group.st)
    ?>  =(title title.bucket.st)
    ?>  =(readers readers.st)
    ?>  =(writers writers.st)
    ?>  =(actor created-by.bucket.st)
    =.  cor  (register-bucket flag st)
    (give [%fact ~[/v1] buckets-response-1+!>(`response:b`[%snapshot flag st])])
  =/  id=@ud  +(next-id)
  =.  next-id  id
  =/  buc=bucket:b  [id title actor now.bowl actor now.bowl]
  =/  st=bucket-state:b  [buc group readers writers ~ 0]
  =.  spaces  (~(put by spaces) flag [%pub `st `group])
  =.  cor  (register-bucket flag st)
  (give [%fact ~[/v1] buckets-response-1+!>(`response:b`[%snapshot flag st])])
::
++  register-bucket
  |=  [=flag:b st=bucket-state:b]
  ^+  cor
  =/  channel=group-channel:b
    [[title.bucket.st '' '' ''] now.bowl %default readers.st |]
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
    %set-readers    (set-readers flag readers.act actor)
    %set-writers    (set-writers flag writers.act actor)
    %create-folder  (create-folder flag parent.act name.act actor)
    %begin-upload   (begin-upload flag parent.act name.act mime.act size.act checksum.act actor)
    %fail-upload    (fail-upload flag session.act reason.act actor)
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
++  set-readers
  |=  [=flag:b readers=(set @tas) actor=ship]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  =.  readers.st  readers
  (commit-update flag st [%readers readers] actor)
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
    [sid flag ent actor now.bowl expiry %pending ~ ~]
  =.  sessions  (~(put by sessions) sid ses)
  (answer [%grant [(scot %uv sid) id expiry]])
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
++  fail-upload
  |=  [=flag:b sid=@uv reason=@t actor=ship]
  ^+  cor
  ?~  got=(~(get by sessions) sid)
    (answer [%error %not-found 'no such upload session'])
  =/  ses=upload-session:b  u.got
  ?.  =(flag flag.ses)
    (answer [%error %not-found 'no such upload session'])
  ?.  =(%pending status.ses)
    (answer [%error %invalid-input 'upload session is not pending'])
  ?.  =(requested-by.ses actor)
    (answer [%error %not-authorized 'not the uploader'])
  ::  Nothing was published, so there is nothing to broadcast — the session
  ::  is kept briefly so the uploader can read the reason back.
  =.  sessions  (~(put by sessions) sid ses(status %failed, error `reason))
  cor
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
  %-  ~(rep by object-capabilities)
  |=  [[token=@t aut=object-capability:b] acc=(unit read-token:b)]
  ?^  acc  acc
  ?.  =(%read kind.aut)  ~
  ?.  =(flag flag.aut)  ~
  ?.  =(actor actor.aut)  ~
  ?.  (gth expires-at.aut (add now.bowl token-margin))  ~
  `[token expires-at.aut]
::
::  +issue-read-token: mint a reader's bucket-read token, reusing the one it
::  already holds while that has useful life left.
::
::  One token covers every ready object in the bucket, so a reader spends one
::  round trip per session rather than one per file. A fresh mint answers
::  %pending: the token has to reach the broker before it is worth anything,
::  and a client that is told otherwise would hold one that 403s.
::
++  issue-read-token
  |=  [=flag:b actor=ship rid=(unit request-id:b)]
  ^+  cor
  =.  cor  prune-broker-authority
  ?^  held=(held-read-token flag actor)
    (answer [%token u.held])
  ::  Bound to a leg before the test on purpose: ?~ on a bare arm refines
  ::  along the wing's axis, an arm has none, and the ~ case mints as vain.
  =/  secret=(unit @t)  genuine-secret
  ?~  secret
    %-  (slog leaf+"buckets: no %genuine secret, cannot mint a read token" ~)
    (answer [%error %unknown 'this ship cannot reach storage'])
  =/  token=@t  (scot %uv `@uv`eny.bowl)
  =/  expiry=@da  (add now.bowl read-window)
  =.  cor  (push-read-token flag token actor expiry rid u.secret)
  (answer [%pending ~])
::
::  +confirm-read-token: the broker accepted a mint, so it becomes real.
::
++  confirm-read-token
  |=  [=flag:b token=@t actor=ship expiry=@da rid=(unit request-id:b)]
  ^+  cor
  =.  object-capabilities
    (~(put by object-capabilities) token [%read flag ~ actor expiry])
  =/  tok=read-token:b  [token expiry]
  ::  Only our own token goes in read-tokens, which is what the local scry
  ::  serves and what the refresh timer keeps current. A remote reader's ship
  ::  stores its own copy when the answer lands there.
  =?  read-tokens  =(actor our.bowl)  (~(put by read-tokens) flag tok)
  =?  cor  =(actor our.bowl)  (arm-token-refresh flag expiry)
  ?~  rid  cor
  (respond u.rid (answer-paths actor u.rid) [%token tok])
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
::  +push-wire: carries a mint across its round trip to the broker.
::
::  The token, its expiry, the reader it is for and the request waiting on it
::  all ride the wire rather than a state field, because a token the broker
::  has not accepted must not be visible anywhere — and because a restart
::  mid-flight then drops the mint cleanly instead of stranding it.
::
++  push-wire
  |=  [=flag:b token=@t actor=ship expiry=@da rid=(unit request-id:b)]
  ^-  wire
  %+  weld
    /buckets/push/(scot %p ship.flag)/[name.flag]
  /(scot %p actor)/[token]/(scot %da expiry)/[?~(rid %none (scot %uv u.rid))]
::
++  revoke-wire
  |=  token=@t
  ^-  wire
  /buckets/revoke/[token]
::
::  +push-read-token: register a mint with the broker before handing it out.
::
::  The host is the only party that can evaluate group membership, so it tells
::  the broker who may read rather than being asked once per object. Nothing
::  is stored here: +confirm-read-token stores on a 2xx, so a token in state
::  is one the broker is known to hold.
::
++  push-read-token
  |=  [=flag:b token=@t actor=ship expiry=@da rid=(unit request-id:b) secret=@t]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  =/  body=@t
    %-  en:json:html
    %-  pairs:enjs:format
    :~  ['token' s+token]
        ['bucketHost' s+(ship-text ship.flag)]
        ['bucketName' s+(scot %tas name.flag)]
        ['bucketId' s+(scot %ud id.bucket.st)]
        ['actorShip' s+(ship-text actor)]
        :-  'expiresAtMillis'
        (numb:enjs:format (mul 1.000 (unt:chrono:userlib expiry)))
    ==
  =/  url=@t
    %+  rap  3
    :~  broker-base  '/tokens/'  (ship-text our.bowl)
        '?token='  (url-encode secret)
    ==
  =/  =request:http
    :*  %'PUT'  url
        ~[['content-type' 'application/json']]
        `[(met 3 body) body]
    ==
  %-  emit
  :*  %pass  (push-wire flag token actor expiry rid)  %arvo  %i
      %request  request  *outbound-config:iris
  ==
::
::  +revoke-read-tokens: tell the broker to stop honouring tokens now rather
::  than when they lapse. Fire-and-forget — expiry is the backstop if it
::  fails, which is the whole reason tokens have one.
::
++  revoke-read-tokens
  |=  tokens=(list @t)
  ^+  cor
  ?~  tokens  cor
  =/  secret=(unit @t)  genuine-secret
  ?~  secret
    %-  (slog leaf+"buckets: no %genuine secret, cannot revoke read tokens" ~)
    cor
  =/  auth=@t  (url-encode u.secret)
  %-  emil
  %+  turn  tokens
  |=  token=@t
  ^-  card
  =/  url=@t
    %+  rap  3
    :~  broker-base  '/tokens/'  (ship-text our.bowl)
        '/'  token  '?token='  auth
    ==
  :*  %pass  (revoke-wire token)  %arvo  %i
      %request  `request:http`[%'DELETE' url ~ ~]
      *outbound-config:iris
  ==
::
::  +read-caps: every read token we have minted that `test` accepts.
::
++  read-caps
  |=  test=$-([@t object-capability:b] ?)
  ^-  (list @t)
  %+  murn  ~(tap by object-capabilities)
  |=  [token=@t aut=object-capability:b]
  ^-  (unit @t)
  ?.  =(%read kind.aut)  ~
  ?.((test token aut) ~ `token)
::
::  +forget-read-caps: drop minted read tokens locally and at the broker.
::
++  forget-read-caps
  |=  tokens=(list @t)
  ^+  cor
  =.  object-capabilities
    %-  ~(rep in (silt tokens))
    |=  [token=@t acc=_object-capabilities]
    (~(del by acc) token)
  (revoke-read-tokens tokens)
::
++  url-encode
  |=  txt=@t
  ^-  @t
  (crip (en-urlt:html (trip txt)))
::
::  +keep-read-token: store a token the host issued us, and arm its refresh.
::
++  keep-read-token
  |=  [host=ship tok=read-token:b]
  ^+  cor
  =/  mine=(list flag:b)
    %+  murn  ~(tap by spaces)
    |=  [=flag:b sp=space:b]
    ?.(&(=(host ship.flag) =(%sub net.sp)) ~ `flag)
  ?~  mine  cor
  =.  read-tokens  (~(put by read-tokens) i.mine tok)
  (arm-token-refresh i.mine expires-at.tok)
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
  =.  read-tokens  (~(del by read-tokens) flag)
  ::  On a subscriber this finds nothing: only a host mints, so only a host
  ::  has anything to revoke.
  %-  forget-read-caps
  %-  read-caps
  |=([token=@t aut=object-capability:b] =(flag flag.aut))
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
  =.  sessions
    %-  malt
    %+  skim  ~(tap by sessions)
    |=  [sid=@uv ses=upload-session:b]
    ?.  =(%pending status.ses)  &
    (gth expires-at.ses now.bowl)
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
++  apply-broker-command
  |=  cmd=broker-command:b
  ^+  cor
  ?-  -.cmd
      %authorize-upload
    (authorize-broker-upload capability.cmd broker-reservation-id.cmd)
  ::
      %complete-upload
    (complete-broker-upload broker-receipt.cmd)
  ==
::
++  authorize-broker-upload
  |=  [token=@t reservation=@t]
  ^+  cor
  ?~  got=(session-token token)  cor
  =/  ses=upload-session:b  u.got
  ?.  =(%pending status.ses)  cor
  ?.  (gth expires-at.ses now.bowl)  cor
  ?~  sp=(~(get by spaces) flag.ses)  cor
  ?~  st-unit=state.u.sp  cor
  =/  st=bucket-state:b  u.st-unit
  ?.  (group-can-write group.st flag.ses writers.st requested-by.ses)  cor
  ?^  accepted=reservation.ses  cor
  ?^  occupied=(~(get by reservations) reservation)  cor
  =.  sessions  (~(put by sessions) id.ses ses(reservation `reservation))
  =.  reservations  (~(put by reservations) reservation id.ses)
  cor
::
++  complete-broker-upload
  |=  receipt=broker-receipt:b
  ^+  cor
  ?~  sid=(~(get by reservations) broker-reservation-id.receipt)  cor
  ?~  got=(~(get by sessions) u.sid)  cor
  =/  ses=upload-session:b  u.got
  ?:  =(%complete status.ses)  cor
  ?.  =(%pending status.ses)  cor
  ?.  (gth expires-at.ses now.bowl)  cor
  ?~  sp=(~(get by spaces) flag.ses)  cor
  ?~  st-unit=state.u.sp  cor
  =/  st=bucket-state:b  u.st-unit
  ?.  (group-can-write group.st flag.ses writers.st requested-by.ses)  cor
  =/  fil=file:b  (entry-file entry.ses)
  ?.  ?&  =(object-id.receipt object-key.fil)
          ?|  =(host.receipt (ship-text our.bowl))
              =(host.receipt (scot %p our.bowl))
          ==
          =(bucket-id.receipt (scot %ud id.bucket.st))
          =(size.receipt size.fil)
          =(mime-type.receipt mime.fil)
      ==
    cor
  (publish-upload ses requested-by.ses)
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
    (~(has in ids) id.entry.ses)
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
++  group-can-read
  |=  [group=flag:b =flag:b who=ship]
  ^-  ?
  ?:  =(who ship.flag)  &
  =/  pax=path
    /(scot %p our.bowl)/groups/(scot %da now.bowl)/v2/groups/(scot %p ship.group)/[name.group]/channels/can-read/noun
  =/  test=$-([ship nest:b] ?)  .^($-([ship nest:b] ?) %gx pax)
  (test who [%buckets ship.flag name.flag])
::
++  group-is-admin-for-create
  |=  [group=flag:b who=ship]
  ^-  ?
  ?:  =(who ship.group)  &
  =/  pax=path
    /(scot %p our.bowl)/groups/(scot %da now.bowl)/v2/groups/(scot %p ship.group)/[name.group]/seats/(scot %p who)/is-admin/noun
  .^(? %gx pax)
::
++  group-permissions
  |=  [group=flag:b =flag:b who=ship]
  ^-  (unit [admin=? roles=(set @tas)])
  ?:  =(who ship.flag)  `[& ~]
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
    %set-readers    (group-is-admin group.st flag who)
    %set-writers    (group-is-admin group.st flag who)
    %issue-bucket-read  (group-can-read group.st flag who)
    %create-folder  (group-can-write group.st flag writers.st who)
    %begin-upload   (group-can-write group.st flag writers.st who)
    %fail-upload    (group-can-write group.st flag writers.st who)
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
++  broker-upload-verdict
  |=  [token=@t reservation=@t]
  ^-  json
  =/  denied=json  (broker-simple-verdict 'denied')
  ?~  got=(session-token token)  denied
  =/  ses=upload-session:b  u.got
  ?.  (gth expires-at.ses now.bowl)
    (broker-simple-verdict 'expired')
  ?.  =(%pending status.ses)  denied
  ::  Echo the reservation bound on first exchange, ignoring the one Memex
  ::  proposed. Memex mints a fresh id per grant call, so a client retrying
  ::  after a lost response arrives with a new one; denying that would make
  ::  the upload unrecoverable, and the Pioneer contract requires the echo.
  ?~  accepted=reservation.ses  denied
  ?~  sp=(~(get by spaces) flag.ses)  denied
  ?~  st-unit=state.u.sp  denied
  =/  st=bucket-state:b  u.st-unit
  ?.  (group-can-write group.st flag.ses writers.st requested-by.ses)  denied
  =/  fil=file:b  (entry-file entry.ses)
  =/  checksum-json=json
    ?~  checksum.fil  ~
    %-  pairs:enjs:format
    :~  ['algorithm' s+'crc32c']
        ['value' s+u.checksum.fil]
    ==
  =/  upload=json
    %-  pairs:enjs:format
    :~  ['bucketName' s+(scot %tas name.flag.ses)]
        ['bucketId' s+(scot %ud id.bucket.st)]
        ['sessionId' s+(scot %uv id.ses)]
        ['objectId' s+object-key.fil]
        ['actorShip' s+(ship-text requested-by.ses)]
        ['size' (numb:enjs:format size.fil)]
        ['mimeType' s+mime.fil]
        ['checksum' checksum-json]
        ['expiresAtMillis' (numb:enjs:format (mul 1.000 (unt:chrono:userlib expires-at.ses)))]
        ['brokerReservationId' s+u.accepted]
    ==
  %-  pairs:enjs:format
  :~  ['result' s+'authorized']
      ['upload' upload]
  ==
::
::  +broker-object-verdict: answer Memex about one object.
::
::  A read capability covers the bucket, so the object is resolved by its key
::  rather than named by the capability; a delete capability names its entry.
::  Either way access is re-checked against the live group here.
::
::  The %read arm is kept deliberately even though a broker holding pushed
::  tokens answers reads from its own table and never asks: a broker that
::  predates the push still asks, so this is what makes the rollout orderless.
::  Deletes always ask, and always will.
::
++  broker-object-verdict
  |=  [kind=object-kind:b token=@t object=@t]
  ^-  json
  =/  denied=json  (broker-simple-verdict 'denied')
  ?~  got=(~(get by object-capabilities) token)  denied
  =/  aut=object-capability:b  u.got
  ?.  =(kind kind.aut)  denied
  ?.  (gth expires-at.aut now.bowl)
    (broker-simple-verdict 'expired')
  ?~  sp=(~(get by spaces) flag.aut)  denied
  ?~  st-unit=state.u.sp  denied
  =/  st=bucket-state:b  u.st-unit
  ?.  ?:  =(%read kind.aut)
        (group-can-read group.st flag.aut actor.aut)
      (group-can-write group.st flag.aut writers.st actor.aut)
    denied
  =/  found=(unit entry:b)
    ?^  entry-id.aut
      (~(get by entries.st) u.entry-id.aut)
    ::  bucket-scoped: find the entry this object key belongs to
    %-  ~(rep by entries.st)
    |=  [[id=@ud ent=entry:b] acc=(unit entry:b)]
    ?^  acc  acc
    ?.  ?=(%file -.kind.ent)  ~
    ?.(=(object object-key.file.kind.ent) ~ `ent)
  ?~  found  denied
  =/  ent=entry:b  u.found
  ?.  ?=(%file -.kind.ent)  denied
  =/  fil=file:b  +.kind.ent
  ?.  =(%ready status.fil)  denied
  ?.  =(object object-key.fil)  denied
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
::  +broker-complete-verdict: expiry reports as %expired rather than %denied.
::  Memex maps 403 to non-retryable and 410 to expired, so collapsing a lapsed
::  window into a denial turns a recoverable upload into a dead one.
::
++  broker-complete-verdict
  |=  reservation=@t
  ^-  json
  =/  denied=json  (broker-simple-verdict 'denied')
  ?~  sid=(~(get by reservations) reservation)  denied
  ?~  got=(~(get by sessions) u.sid)  denied
  =/  ses=upload-session:b  u.got
  ?:  =(%complete status.ses)  (broker-simple-verdict 'completed')
  ?.  (gth expires-at.ses now.bowl)
    (broker-simple-verdict 'expired')
  denied
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
      [%x %v1 %buckets ~]
    ``buckets-snapshots-1+!>(local-snapshots)
  ::
      [%x %v1 %buckets host=@ name=@ ~]
    =/  =flag:b  [(slav %p host.pole) `@tas`name.pole]
    ?~  sp=(~(get by spaces) flag)  ~
    ?~  state.u.sp  ~
    ``buckets-response-1+!>(`response:b`[%snapshot flag u.state.u.sp])
  ::
      [%x %v1 %broker %upload cap=@ reservation=@ ~]
    ``json+!>((broker-upload-verdict cap.pole reservation.pole))
  ::
      [%x %v1 %broker %read cap=@ object=@ ~]
    ``json+!>((broker-object-verdict %read cap.pole object.pole))
  ::
      [%x %v1 %broker %delete cap=@ object=@ ~]
    ``json+!>((broker-object-verdict %delete cap.pole object.pole))
  ::
      [%x %v1 %broker %complete reservation=@ ~]
    ``json+!>((broker-complete-verdict reservation.pole))
  ::
      [%x %v1 %buckets host=@ name=@ %read-token ~]
    =/  =flag:b  [(slav %p host.pole) `@tas`name.pole]
    ?~  tok=(~(get by read-tokens) flag)  ~
    ``noun+!>(`read-token:b`u.tok)
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
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+  pole  cor
      [%groups ~]
    ?+  -.sign  cor
        %kick  (emit [%pass /groups %agent [our.bowl %groups] %watch /v1/groups])
        %fact
      ::  an r-groups fact is [flag r-group]; we only need the flag head.
      =+  !<([=flag:b *] q.cage.sign)
      (recheck-host-subs flag)
        %watch-ack
      ?~  p.sign  cor
      ((slog leaf+"buckets: groups watch failed" u.p.sign) cor)
    ==
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
        %kick
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
      =.  cor  (close-request host rid)
      ::  a token answer is ours to keep, whoever asked for it
      =?  cor  ?=(%token -.body.res)
        (keep-read-token host read-token.body.res)
      (respond rid ~[/v1/requests] body.res)
    ::
        %kick
      ?.  (request-live rid)  cor
      =.  cor  (close-request host rid)
      (deny rid ~[/v1/requests] %unknown 'host closed the request stream')
    ::
        %watch-ack
      ?~  p.sign  cor
      ?.  (request-live rid)  cor
      =.  cor  (close-request host rid)
      (deny rid ~[/v1/requests] %unknown 'host refused the request stream')
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
      ?.  (request-live rid)  cor
      =.  cor  (close-request host rid)
      %-  (slog leaf+"buckets: host command failed" u.p.sign)
      (deny rid ~[/v1/requests] %unknown 'host rejected the command')
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
      [%buckets %push host=@ name=@ who=@ token=@ exp=@ rid=@ ~]
    ?.  ?=([%iris %http-response *] sign-arvo)  cor
    =*  res  client-response.sign-arvo
    ?.  ?=(%finished -.res)  cor
    =/  =flag:b  [(slav %p host.pole) `@tas`name.pole]
    =/  actor=ship  (slav %p who.pole)
    =/  expiry=@da  (slav %da exp.pole)
    =/  rid=(unit request-id:b)
      ?:(=(%none rid.pole) ~ `(slav %uv rid.pole))
    =/  code=@ud  status-code.response-header.res
    ?:  &((gte code 200) (lth code 300))
      (confirm-read-token flag `@t`token.pole actor expiry rid)
    ::  Refused: the token was never stored, so there is nothing to undo. Our
    ::  own mint retries on a short timer; a remote reader's ship re-asks.
    =/  why=tang
      ~[leaf+"buckets: broker refused a read token, status {<code>}"]
    %-  (slog why)
    =?  cor  =(actor our.bowl)  (retry-read-token flag)
    ?~  rid  cor
    (deny u.rid (answer-paths actor u.rid) %unknown 'storage refused the read token')
  ::
      [%buckets %revoke token=@ ~]
    ?.  ?=([%iris %http-response *] sign-arvo)  cor
    =*  res  client-response.sign-arvo
    ?.  ?=(%finished -.res)  cor
    =/  code=@ud  status-code.response-header.res
    ?:  &((gte code 200) (lth code 300))  cor
    ::  The token is already gone locally and expires at the broker anyway.
    %-  (slog leaf+"buckets: read token revoke failed, status {<code>}" ~)
    cor
  ::
      [%buckets %req host=@ rid=@ %wake ~]
    ?.  ?=([%behn %wake *] sign-arvo)  cor
    =/  host=ship  (slav %p host.pole)
    =/  rid=request-id:b  (slav %uv rid.pole)
    ?.  (request-live rid)  cor
    =.  pending  (~(del by pending) rid)
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
      %readers  st(readers readers.upd)
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
++  recheck-host-subs
  |=  changed=flag:b
  ^+  cor
  =/  kicks=(list card)
    %+  murn  ~(val by sup.bowl)
    |=  [who=ship pax=path]
    ^-  (unit card)
    ?.  ?=([%v1 %buckets @ @ %updates ~] pax)  ~
    =/  =flag:b  [(slav %p i.t.t.pax) `@tas`i.t.t.t.pax]
    ?~  sp=(~(get by spaces) flag)  ~
    ?.  =(%pub net.u.sp)  ~
    ?~  state.u.sp  ~
    ?.  =(changed group.u.state.u.sp)  ~
    ?:  (group-can-read group.u.state.u.sp flag who)  ~
    `[%give %kick ~[pax] `who]
  ::  a kicked reader's token must stop working now, not when it lapses
  =/  revoked=(set ship)
    %-  silt
    %+  murn  kicks
    |=  =card
    ?.(?=([%give %kick * ^] card) ~ ship.p.card)
  =.  cor
    %-  forget-read-caps
    %-  read-caps
    |=([token=@t aut=object-capability:b] (~(has in revoked) actor.aut))
  (emil kicks)
--

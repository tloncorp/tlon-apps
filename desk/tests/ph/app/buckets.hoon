::  aqua tests for %buckets: the host/replica protocol, across two ships
::
::  What the unit suite in /tests/app/buckets cannot reach. Those tests poke
::  one agent with mocked scries, so nothing there exercises a host and a
::  replica together: a create that never registers, a snapshot that never
::  arrives, a replica that crashes on a card the host now sends.
::
::  What these do NOT cover, measured rather than assumed: the leaked
::  subscription a bucket deletion used to leave behind. Both tests pass
::  against an agent with the kick and the leave taken back out. A repeat
::  %watch on the same wire replaces the entry in the subscriber's .boat, so
::  rejoining works either way, and the registration that leaks is the host's
::  .bitt -- which gall exposes through no scry (its vane peeks are %u, %b,
::  %d and %e only). There is no external signal to assert on. Covering it
::  needs either a gall-level scry for subscription state or a probe that can
::  see a stale registration deliver a fact to a replica that never rejoined.
::
::  So: these are cross-ship coverage of create, join, delete and rejoin, and
::  they would catch a crash, a malformed card or a replica that dies on
::  teardown. They are not a regression test for that fix. Do not read a pass
::  here as one.
::
/-  spider, b=buckets, g=groups, gv=groups-ver
/+  *ph-io, *ph-test, putil=ph-util
=,  strand=strand:spider
|%
::  The bucket host is a planet, not a galaxy.
::
::  %buckets refuses a create whose group host is not a %duke -- the same gate
::  that refuses moons -- so the aqua convention of numbering galaxies cannot
::  be used here. ~sampel-palnet is sponsored by ~talpur under ~pur, and both
::  have to be in the fleet for ames to route to it.
::
++  bucket-host      ~sampel-palnet
++  bucket-member    ~bud
++  test-group       ~sampel-palnet^%my-test-group
++  test-bucket      ~sampel-palnet^%project-files
++  bucket-nest      [%buckets ~sampel-palnet %project-files]
::  +create-test-group: the group the bucket is bound to.
::
++  create-test-group
  |=  [host=ship =privacy:g]
  =/  m  (strand ,~)
  ^-  form:m
  =/  =create-group:g
    :*  %my-test-group
        ['My Test Group' 'A group holding a bucket' '' '']
        privacy
        [~ ~]
        ~
    ==
  (poke-app [host %groups] group-command+[%create create-group])
::  +join-test-group: .joiner joins the group, as the groups tests do it.
::
++  join-test-group
  |=  [joiner=ship host=ship]
  =/  m  (strand ,~)
  ^-  form:m
  ;<  =bowl:strand  bind:m  get-bowl
  =/  aqua-pax=path
    ;:  weld
      /gx/(scot %p joiner)/groups/(scot %da now.bowl)
      /v2/foreigns/(scot %p host)/my-test-group/noun
    ==
  ;<  foreign=(unit foreign:v10:gv)  bind:m
    (scry-aqua (unit foreign:v10:gv) joiner aqua-pax)
  =/  token=(unit token:g)
    ?~  foreign  ~
    ?~  invites.u.foreign  ~
    token.i.invites.u.foreign
  =/  =a-foreigns:v8:gv  [%foreign host^%my-test-group %join token]
  (poke-app [joiner %groups] group-foreign-2+a-foreigns)
::  +ex-joined-group: wait for .ship to actually hold the group.
::
::  Without this the rest races: creating a bucket and subscribing to it while
::  the membership is still in flight means the host has no seat to check, so
::  it nacks the watch and no replica is ever made. The groups aqua tests
::  synchronise the same way, which is why theirs pass and this did not.
::
++  ex-joined-group
  |=  [=ship host=^ship]
  =/  m  (strand ,~)
  ^-  form:m
  %^  (ex-app-fact-match r-groups:v10:gv)  /(scot %p ship)/groups/v1/groups
    [ship %groups]
  :-  %group-response-1
  |=  rep=r-groups:v10:gv
  ;<  ~  bind:m  (ex-equal !>(flag.rep) !>(`flag:gv`host^%my-test-group))
  (ex-equal !>(`@tas`-.r-group.rep) !>(%create))
::  +broker-base: where %buckets calls storage, absent a poke saying otherwise.
::
++  broker-base  'https://memex.tlon.network/v2/buckets'
++  grant-url    (rap 3 broker-base '/uploads/grant' ~)
::  +memex-take: wait for one outbound broker call to .dest and hand it back.
::
::  Aqua has no iris driver, so a %request goes out as an effect nobody
::  answers and the host waits forever. Watching /effect/request and injecting
::  the reply as an iris %receive is the whole of a broker for testing
::  purposes -- the effect carries its own request id, which is what makes the
::  correlation possible at all.
::
::  Calls to other endpoints are skipped rather than failed: the host mints
::  and pushes read tokens on its own schedule, so an unrelated PUT can land
::  in the middle of an upload.
::
++  memex-take
  |=  [who=ship dest=@t]
  =/  m  (strand ,[num=@ud =request:http])
  ^-  form:m
  |-
  ;<  =aqua-effect  bind:m  (take-effect /effect/request)
  ?.  =(who who.aqua-effect)  $
  ?~  req=(extract-request:putil ufs.aqua-effect dest)  $
  (pure:m u.req)
::  +memex-answer: answer request .num on .who with .body.
::
++  memex-answer
  |=  [who=ship num=@ud code=@ud body=json]
  =/  m  (strand ,~)
  ^-  form:m
  =/  txt=@t  (en:json:html body)
  =/  =http-event:http
    :+  %start
      [code ~[['content-type' 'application/json']]]
    [`[(met 3 txt) txt] &]
  %-  send-events
  ~[[%event who /i/aqua/memex [%receive num http-event]]]
::  +object-of: the object key the host told the broker it would store.
::
::  Read back out of its own request so the receipt names the same object,
::  which is what +verify-receipt insists on. A real broker does the same.
::
++  object-of
  |=  =request:http
  ^-  @t
  ?~  body.request  ~|(%memex-no-body !!)
  =/  jon=json  (need (de:json:html q.u.body.request))
  ?>  ?=(%o -.jon)
  =/  got=json  (~(got by p.jon) 'gallObjectId')
  ?>  ?=(%s -.got)
  p.got
::  +grant-json: a signed PUT, as the broker answers one.
::
++  grant-json
  |=  reservation=@t
  ^-  json
  %-  pairs:enjs:format
  :~  ['uploadUrl' s+'https://storage.test/put']
      ['reservationId' s+reservation]
  ==
::  +receipt-json: what the broker says it stored.
::
++  receipt-json
  |=  [object=@t mime=@t size=@ud]
  ^-  json
  %-  pairs:enjs:format
  :~  ['objectId' s+object]
      ['mimeType' s+mime]
      ['size' (numb:enjs:format size)]
  ==
::  +bucket-with-replica: the state every test below starts from.
::
::  ~bud is in the group, the bucket exists, and ~bud holds a replica of it.
::  Returns once the snapshot has landed, so what follows is not racing the
::  subscription being established.
::
++  bucket-with-replica
  |=  rid=@uv
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [bucket-member %groups] /v1/groups)
  ;<  ~  bind:m  (create-test-group bucket-host %public)
  ;<  ~  bind:m  (join-test-group bucket-member bucket-host)
  ;<  ~  bind:m  (ex-joined-group bucket-member bucket-host)
  ;<  ~  bind:m  (watch-app /~bud/buckets/v1 [bucket-member %buckets] /v1)
  ;<  ~  bind:m  (create-bucket bucket-host rid)
  ;<  ~  bind:m  (join-bucket bucket-member)
  (ex-app-fact-mark /~bud/buckets/v1 [bucket-member %buckets] %buckets-response-1)
::  +ex-bucket-update: expect an update fact whose u-bucket carries .tag.
::
++  ex-bucket-update
  |=  tag=@tas
  =/  m  (strand ,~)
  ^-  form:m
  %^  (ex-app-fact-match response:b)  /~bud/buckets/v1
    [bucket-member %buckets]
  :-  %buckets-response-1
  |=  res=response:b
  ?.  ?=(%update -.res)
    (ex-equal !>(`@tas`-.res) !>(%update))
  (ex-equal !>(`@tas`-.u-bucket.res) !>(tag))
::  +create-bucket: the host opens a bucket in the test group.
::
++  create-bucket
  |=  [host=ship rid=@uv]
  =/  m  (strand ,~)
  ^-  form:m
  =/  act=a-buckets:b
    [%create %project-files 'Project Files' test-group ~ ~]
  (poke-app [bucket-host %buckets] buckets-action-1+[rid act])
::  +join-bucket: what %groups pokes a member's %buckets with when it joins
::  the channel. Sent directly here so the test does not depend on the
::  group's channel bookkeeping to drive the subscription.
::
++  join-bucket
  |=  [joiner=ship]
  =/  m  (strand ,~)
  ^-  form:m
  =/  =channel-join:b  [bucket-nest test-group]
  (poke-app [joiner %buckets] group-channel-join+channel-join)
::  An upload runs the whole broker round trip.
::
::  Nothing in the unit suite reaches this: those tests poke a vase and mock
::  the scries, so the two calls the host makes to storage are never made.
::  Here they go out as real iris requests and come back as real responses.
::
::  What it pins: the grant answer is handed to the uploader as %upload, the
::  completion receipt is verified against the entry the host reserved, and
::  the entry only joins the manifest once the object has landed.
::
++  ph-test-bucket-upload-round-trips
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (bucket-with-replica 0v1)
  ;<  ~  bind:m  (watch-our /effect/request %aqua /effect/request)
  ;<  ~  bind:m
    %^  watch-app  /host/buckets/v1/requests
      [bucket-host %buckets]
    /v1/requests
  ::  the uploader asks, and the host calls storage rather than answering
  ;<  ~  bind:m
    %+  poke-app  [bucket-host %buckets]
    :-  %buckets-action-1
    ^-  command:b
    [0v9 [%bucket test-bucket [%begin-upload ~ 'plan.md' 'text/markdown' 12 ~]]]
  ;<  ask=[num=@ud =request:http]  bind:m  (memex-take bucket-host grant-url)
  =/  object=@t  (object-of request.ask)
  ;<  ~  bind:m  (memex-answer bucket-host num.ask 200 (grant-json 'res-a'))
  ::  which comes back to the uploader as the signed PUT
  ;<  granted=req-response:b  bind:m
    %^    wait-for-app-fact-value
        req-response:b
      /host/buckets/v1/requests
    [bucket-host %buckets]
  ?.  ?=(%upload -.body.granted)
    (ex-equal !>(`@tas`-.body.granted) !>(%upload))
  =/  session=@uv  session.upload-grant.body.granted
  ::  the bytes land out of band, and the uploader says so
  ;<  ~  bind:m
    %+  poke-app  [bucket-host %buckets]
    :-  %buckets-action-1
    ^-  command:b
    [0v10 [%bucket test-bucket [%finish-upload session]]]
  =/  done-url=@t  (rap 3 broker-base '/uploads/res-a/complete' ~)
  ;<  fin=[num=@ud =request:http]  bind:m  (memex-take bucket-host done-url)
  ;<  ~  bind:m
    %-  memex-answer
    [bucket-host num.fin 200 (receipt-json object 'text/markdown' 12)]
  ::  and the entry joins the manifest, which the replica hears about
  ;<  ~  bind:m  (ex-bucket-update %entry)
  (pure:m ~)
::  Losing read access takes the replica with it.
::
::  This is the path +recheck-host-subs drives: the host kicks the reader off
::  the updates subscription, the re-watch it prompts is nacked because the
::  seat is gone, and the replica stops. A reader that kept its replica here
::  would go on showing a bucket it can no longer read.
::
++  ph-test-bucket-revoked-reader-loses-replica
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (bucket-with-replica 0v1)
  ::  the host bans ~bud, which takes its seat with it
  =/  =c-groups:g
    [%group test-group [%entry [%ban [%add-ships (sy bucket-member ~)]]]]
  ;<  ~  bind:m  (poke-app [bucket-host %groups] group-command+c-groups)
  ::  and the bucket goes the way the group did
  ;<  ~  bind:m  (ex-bucket-update %delete)
  (pure:m ~)
::  Writers reach the replica.
::
::  A Bucket's writer roles live in %buckets alone -- %groups does not model
::  them -- so this fact is the only way a member learns them. A replica that
::  missed it would show an empty set, and an admin saving that bucket's
::  settings would send the emptiness on to the real host, where empty means
::  every reader may write.
::
++  ph-test-bucket-writers-reach-the-replica
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (bucket-with-replica 0v1)
  ;<  ~  bind:m
    %+  poke-app  [bucket-host %buckets]
    :-  %buckets-action-1
    `command:b`[0v2 [%bucket test-bucket [%set-writers (sy %admin ~)]]]
  ;<  ~  bind:m  (ex-bucket-update %writers)
  (pure:m ~)
::  Leaving the channel drops the replica.
::
::  The other teardown path, and the one +delete-bucket was inconsistent with:
::  %groups says the member left, +stop-sub drops the space, gives its own
::  clients the delete and leaves the host's subscription.
::
++  ph-test-bucket-channel-leave-drops-replica
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (bucket-with-replica 0v1)
  ;<  ~  bind:m
    %+  poke-app  [bucket-member %buckets]
    [%group-channel-leave `channel-leave:b`[bucket-nest]]
  ;<  ~  bind:m  (ex-bucket-update %delete)
  (pure:m ~)
::  A bucket deletion has to reach the replica and take it with it.
::
::  The host gives the %delete fact and then kicks the path it travelled on;
::  the replica drops its space and leaves. Neither half was there: every
::  former subscriber kept a live subscription to a bucket that no longer
::  existed, and a bucket recreated under the same flag was watched twice on
::  one wire. Nothing single-agent can see that, because it is the pair that
::  is wrong rather than either side.
::
++  ph-test-bucket-delete-reaches-the-replica
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [bucket-member %groups] /v1/groups)
  ;<  ~  bind:m  (create-test-group bucket-host %public)
  ;<  ~  bind:m  (join-test-group bucket-member bucket-host)
  ;<  ~  bind:m  (ex-joined-group bucket-member bucket-host)
  ::  ~bud watches its own %buckets, which is where a replica surfaces.
  ;<  ~  bind:m  (watch-app /~bud/buckets/v1 [bucket-member %buckets] /v1)
  ;<  ~  bind:m  (create-bucket bucket-host 0v1)
  ::  subscribing hands the replica a whole snapshot
  ;<  ~  bind:m  (join-bucket bucket-member)
  ;<  ~  bind:m
    (ex-app-fact-mark /~bud/buckets/v1 [bucket-member %buckets] %buckets-response-1)
  ::  and the deletion reaches it as an update
  ;<  ~  bind:m
    %+  poke-app  [bucket-host %buckets]
    buckets-action-1+[0v2 `a-buckets:b`[%bucket test-bucket [%delete ~]]]
  ;<  ~  bind:m
    (ex-app-fact-mark /~bud/buckets/v1 [bucket-member %buckets] %buckets-response-1)
  (pure:m ~)
::  A bucket the replica has left can be joined again.
::
::  The leak's second symptom: with the old subscription still registered on
::  both sides, rejoining watches the same wire a second time and the stale
::  registration is no longer reachable to repair. Recreating under the same
::  flag is the case that hits it, because the flag is what the wire is
::  derived from.
::
++  ph-test-bucket-rejoin-after-delete
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [bucket-member %groups] /v1/groups)
  ;<  ~  bind:m  (create-test-group bucket-host %public)
  ;<  ~  bind:m  (join-test-group bucket-member bucket-host)
  ;<  ~  bind:m  (ex-joined-group bucket-member bucket-host)
  ;<  ~  bind:m  (watch-app /~bud/buckets/v1 [bucket-member %buckets] /v1)
  ;<  ~  bind:m  (create-bucket bucket-host 0v1)
  ;<  ~  bind:m  (join-bucket bucket-member)
  ;<  ~  bind:m
    (ex-app-fact-mark /~bud/buckets/v1 [bucket-member %buckets] %buckets-response-1)
  ;<  ~  bind:m
    %+  poke-app  [bucket-host %buckets]
    buckets-action-1+[0v2 `a-buckets:b`[%bucket test-bucket [%delete ~]]]
  ;<  ~  bind:m
    (ex-app-fact-mark /~bud/buckets/v1 [bucket-member %buckets] %buckets-response-1)
  ::  the same flag again, and the replica has to arrive whole a second time
  ;<  ~  bind:m  (create-bucket bucket-host 0v3)
  ;<  ~  bind:m  (join-bucket bucket-member)
  ;<  ~  bind:m
    (ex-app-fact-mark /~bud/buckets/v1 [bucket-member %buckets] %buckets-response-1)
  (pure:m ~)
--

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
/+  *ph-io, *ph-test
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

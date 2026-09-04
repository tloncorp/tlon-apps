::  aqua tests for %buckets: the host/replica protocol, across two ships
::
::  What the unit suite in /tests/app/buckets cannot reach. Those tests poke
::  one agent with mocked scries, so a publisher/subscriber asymmetry -- the
::  host doing something the replica does not answer, or the other way about
::  -- passes them and fails in the world. Both bugs these cover were exactly
::  that shape.
::
/-  spider, b=buckets, g=groups, gv=groups-ver
/+  *ph-io, *ph-test
=,  strand=strand:spider
|%
++  test-group       ~zod^%my-test-group
++  test-bucket      ~zod^%project-files
++  bucket-nest      [%buckets ~zod %project-files]
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
::  +create-bucket: the host opens a bucket in the test group.
::
++  create-bucket
  |=  [host=ship rid=@uv]
  =/  m  (strand ,~)
  ^-  form:m
  =/  act=a-buckets:b
    [%create %project-files 'Project Files' test-group ~ ~]
  (poke-app [host %buckets] buckets-action-1+[rid act])
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
  ;<  ~  bind:m  (create-test-group ~zod %public)
  ;<  ~  bind:m  (join-test-group ~bud ~zod)
  ::  ~bud watches its own %buckets, which is where a replica surfaces.
  ;<  ~  bind:m  (watch-app /~bud/buckets/v1 [~bud %buckets] /v1)
  ;<  ~  bind:m  (create-bucket ~zod 0v1)
  ::  subscribing hands the replica a whole snapshot
  ;<  ~  bind:m  (join-bucket ~bud)
  ;<  ~  bind:m
    (ex-app-fact-mark /~bud/buckets/v1 [~bud %buckets] %buckets-response-1)
  ::  and the deletion reaches it as an update
  ;<  ~  bind:m
    %+  poke-app  [~zod %buckets]
    buckets-action-1+[0v2 `a-buckets:b`[%bucket test-bucket [%delete ~]]]
  ;<  ~  bind:m
    (ex-app-fact-mark /~bud/buckets/v1 [~bud %buckets] %buckets-response-1)
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
  ;<  ~  bind:m  (create-test-group ~zod %public)
  ;<  ~  bind:m  (join-test-group ~bud ~zod)
  ;<  ~  bind:m  (watch-app /~bud/buckets/v1 [~bud %buckets] /v1)
  ;<  ~  bind:m  (create-bucket ~zod 0v1)
  ;<  ~  bind:m  (join-bucket ~bud)
  ;<  ~  bind:m
    (ex-app-fact-mark /~bud/buckets/v1 [~bud %buckets] %buckets-response-1)
  ;<  ~  bind:m
    %+  poke-app  [~zod %buckets]
    buckets-action-1+[0v2 `a-buckets:b`[%bucket test-bucket [%delete ~]]]
  ;<  ~  bind:m
    (ex-app-fact-mark /~bud/buckets/v1 [~bud %buckets] %buckets-response-1)
  ::  the same flag again, and the replica has to arrive whole a second time
  ;<  ~  bind:m  (create-bucket ~zod 0v3)
  ;<  ~  bind:m  (join-bucket ~bud)
  ;<  ~  bind:m
    (ex-app-fact-mark /~bud/buckets/v1 [~bud %buckets] %buckets-response-1)
  (pure:m ~)
--

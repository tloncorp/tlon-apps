::  tests for the pioneer/* threads under /ted/pioneer/
::
::  shared aqua boot from /ted/ph/test brings up ~zod, ~bud, ~nec, ~fen, ~dem
::  with the %groups desk synced and ~fen configured as lure provider.
::
::  to run all of these:
::    ./backend/run-aqua-tests.sh
::
::  to run a specific subset, pass an arm-name pattern as the trailing
::  path component to %ph-test (the test runner uses it as a prefix filter).
::
/-  spider, g=groups, gv=groups-ver, r=reel
/+  *ph-io, *ph-test
=,  strand=strand:spider
::
|%
++  my-test-flag       ~zod^%test-group
++  my-test-group-id   '~zod/test-group'
++  my-test-group-name  %test-group
::
::  +run-thread: invoke a pioneer thread on a target aqua ship.
::    pokes %spider with spider-start and waits for the matching
::    /thread-result fact. returns the thread's result vase.
::
++  run-thread
  |=  [who=ship name=@ta arg=^json]
  =/  m  (strand ,vase)
  ^-  form:m
  ;<  =bowl:strand  bind:m  get-bowl
  =/  tid=@ta
    %+  cat  3
    'pioneer-'
    (cat 3 name (cat 3 '-' (scot %uv (sham now.bowl name))))
  =/  =beak  [who %groups da+now.bowl]
  =/  file=term  (cat 3 'pioneer-' name)
  =/  start=start-args:spider  [~ `tid beak file !>(arg)]
  =/  watch-path=path  /(scot %p who)/spider/thread-result/[tid]
  ;<  ~  bind:m  (watch-app watch-path [who %spider] /thread-result/[tid])
  ;<  ~  bind:m  (poke-app [who %spider] spider-start+start)
  ;<  kag=cage  bind:m  (wait-for-app-fact watch-path [who %spider])
  ;<  ~  bind:m  (leave-app watch-path [who %spider])
  ?+    p.kag  ~|([%strange-thread-result p.kag tid] !!)
      %thread-done
    (pure:m q.kag)
      %thread-fail
    =+  !<([=term =tang] q.kag)
    %-  (slog tang)
    ~|([%thread-fail term] !!)
  ==
::
++  run-thread-ok
  |=  [who=ship name=@ta arg=^json]
  =/  m  (strand ,~)
  ^-  form:m
  ;<  vase  bind:m  (run-thread who name arg)
  (pure:m ~)
::
++  run-thread-json
  |=  [who=ship name=@ta arg=^json]
  =/  m  (strand ,^json)
  ^-  form:m
  ;<  out=vase  bind:m  (run-thread who name arg)
  (pure:m !<(^json out))
::
::  +create-test-group: same setup used by lure.hoon, lifted here so
::    pioneer tests can share the canonical fixture.
::
++  create-test-group
  =/  m   (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~zod/groups/v1/groups [~zod %groups] /v1/groups)
  =/  =create-group:g
    :*  my-test-group-name
        ['My Test Group' 'My testing group' '' '']
        %secret
        [~ ~]
        ~
    ==
  ;<  ~  bind:m  (poke-app [~zod %groups] group-command+[%create create-group])
  ;<  kag=cage  bind:m  (wait-for-app-fact /~zod/groups/v1/groups [~zod %groups])
  ?>  =(%group-response-1 p.kag)
  ;<  ~  bind:m  (leave-app /~zod/groups/v1/groups [~zod %groups])
  (pure:m ~)
::
::  +group-exists: %gu scry an aqua ship for whether it tracks the group.
::
++  group-exists
  |=  [who=ship =flag:g]
  =/  m  (strand ,?)
  ^-  form:m
  ;<  =bowl:strand  bind:m  get-bowl
  =/  pax=path
    %+  weld
      /gu/(scot %p who)/groups/(scot %da now.bowl)
    /groups/(scot %p p.flag)/[q.flag]
  ;<  out=(unit ?)  bind:m  (scry-aqua (unit ?) who pax)
  (pure:m (fall out |))
::
::  ─── tests ───────────────────────────────────────────────────────────
::
::  +ph-test-force-join: ~bud joins ~zod's public group via force-join
::
++  ph-test-force-join
  =/  m  (strand ,~)
  ^-  form:m
  ::  ~zod hosts a group, opens it to the public
  ;<  ~  bind:m  create-test-group
  =/  open=a-groups:v8:gv
    [%group my-test-flag [%entry [%privacy %public]]]
  ;<  ~  bind:m  (poke-app [~zod %groups] group-action-4+open)
  ::  watch ~bud's foreigns so we see the join progress to %done
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ::  invoke the thread on ~bud
  ;<  ~  bind:m
    %^  run-thread-ok  ~bud  %force-join
    (frond:enjs:format flag+s+my-test-group-id)
  ::  drain foreigns updates until we see progress=%done
  |-
  ;<  kag=cage  bind:m  (wait-for-app-fact /~bud/groups/v1/foreigns [~bud %groups])
  ?.  =(%foreigns-1 p.kag)  $
  =+  !<(=foreigns:v8:gv q.kag)
  =/  far=(unit foreign:v8:gv)  (~(get by foreigns) my-test-flag)
  ?:  ?|  ?=(~ far)
          !=(`%done progress.u.far)
      ==
    $
  ;<  ~  bind:m  (leave-app /~bud/groups/v1/foreigns [~bud %groups])
  (pure:m ~)
::
::  +ph-test-create-private-group: idempotent group creation
::
++  ph-test-create-private-group
  =/  m  (strand ,~)
  ^-  form:m
  =/  arg=^json
    %-  pairs:enjs:format
    :~  name+s+'pioneer-test'
        title+s+'Pioneer Test'
        description+s+'created by pioneer thread test'
    ==
  ::  first invocation: should create the group
  ;<  ~  bind:m  (run-thread-ok ~zod %create-private-group arg)
  ;<  exists-after-first=?  bind:m  (group-exists ~zod ~zod^%pioneer-test)
  ;<  ~  bind:m  (ex-equal !>(exists-after-first) !>(&))
  ::  second invocation: idempotent, group still exists
  ;<  ~  bind:m  (run-thread-ok ~zod %create-private-group arg)
  ;<  exists-after-second=?  bind:m  (group-exists ~zod ~zod^%pioneer-test)
  ;<  ~  bind:m  (ex-equal !>(exists-after-second) !>(&))
  (pure:m ~)
::
::  +ph-test-create-lure-invite: watch-based invite link generation.
::    relies on /ted/ph/test having wired ~fen as the bait provider.
::
++  ph-test-create-lure-invite
  =/  m  (strand ,~)
  ^-  form:m
  =/  arg=^json
    %-  pairs:enjs:format
    :~  id+s+'pioneer-personal'
        tag+s+'personal'
    ==
  ;<  out=^json  bind:m  (run-thread-json ~zod %create-lure-invite arg)
  ::  expect a top-level "url" key with a non-empty string
  ?>  ?=(%o -.out)
  =/  url-j=(unit ^json)  (~(get by p.out) 'url')
  ?~  url-j  ~|(no-url-in-result+out !!)
  ?>  ?=(%s -.u.url-j)
  (ex-not-equal !>(p.u.url-j) !>(''))
--

::::  tests for the pioneer/* threads under /ted/pioneer/
::
/-  spider, g=groups, gv=groups-ver, r=reel
/+  *ph-io, *ph-test
=,  strand=strand:spider
::
|%
++  my-test-flag       ~zod^%test-group
++  my-test-group-id   '~zod/test-group'
++  my-test-group-name  %test-group
::  +run-thread: invoke a pioneer thread on a target aqua ship
::
::    handles spider interaction, produces thread result vase
::
++  run-thread
  |=  [who=ship name=@ta arg=^json]
  =/  m  (strand ,vase)
  ^-  form:m
  ;<  =bowl:strand  bind:m  get-bowl
  =/  tid=@ta
    %^  cat  3  'pioneer-'
    (cat 3 name (cat 3 '-' (scot %uv (sham now.bowl name))))
  =/  =beak  [who %groups da+now.bowl]
  =/  file=term  (cat 3 'pioneer-' name)
  =/  start=start-args:spider  [~ `tid beak file !>(`(unit json)`[~ arg])]
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
    (strand-fail %thread-fail term tang)
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
++  create-test-group
  =/  m   (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~zod/groups/v1/groups [~zod %groups] /v1/groups)
  ::NOTE  from /tests/ph/for/lure.hoon
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
::  tests
::
++  ph-test-create-lure-invite
  =/  m  (strand ,~)
  ^-  form:m
  =/  arg=^json  s+'pioneer-personal'
  ;<  out=^json  bind:m  (run-thread-json ~zod %create-lure-invite arg)
  ::  expect a top-level "url" key with a non-empty string
  ::
  ?>  ?=(%o -.out)
  =/  url-j=(unit ^json)  (~(get by p.out) 'url')
  ?~  url-j  ~|(no-url-in-result+out !!)
  ?>  ?=(%s -.u.url-j)
  (ex-not-equal !>(p.u.url-j) !>(''))
--

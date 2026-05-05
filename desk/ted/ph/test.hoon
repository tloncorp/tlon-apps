::  run aqua tests
::
::  pax=(unit path)  optional test path
::  snap=@t          aqua fleet snapshot
::
/-  spider, aquarium
/+  *strandio, ph-io, ph-test
=,  strand=strand:spider
|%
+$  test       [=path strand=test-strand]
+$  test-arm   [name=term strand=test-strand]
+$  test-strand  _*form:(strand ,~)
--
::
|%
++  find-test-files
  |=  [byk=beak pax=path]
  =/  m  (strand ,(list path))
  ^-  form:m
  =/  dir=path
    ;:  weld
      /(scot %p p.byk)/[q.byk]/(scot %da +.r.byk)
      pax
    ==
  %-  pure:m
  %+  skim  .^((list ^path) %ct dir)
  |=(=path =(%hoon (rear path)))
::  +build-test-files: build supplied test files
::
++  build-test-files
  |=  [byk=beak files=(list path)]
  =|  out=(list (pair path vase))
  =|  fail=(list path)
  =/  m  (strand ,[_out _fail])
  ^-  form:m
  |-
  ?~  files  (pure:m [(flop out) (flop fail)])
  =*  file  i.files
  ;<  build=(unit vase)  bind:m  (build-file byk file)
  =*  filename  (spud file)
  ?~  build
    ~>  %slog.0^leaf+"FAILED {filename} (build)"
    $(files t.files, fail [file fail])
  ~>  %slog.0^leaf+"built file {filename}"
  $(files t.files, out [[file u.build] out])
::  +get-test-arms: get test arms contained in a core
::
++  get-test-arms
  |=  [typ=type cor=*]
  ^-  (list test-arm)
  =/  arms=(list @tas)  (sloe typ)
  %+  turn  (skim arms has-test-prefix)
  |=  name=term
  =/  fire-arm=(pair type nock)
    ~|  [%failed-to-compile-test-arm name]
    (~(mint ut typ) -:!>(*test-strand) [%limb name])
  =+  !<(=test-strand [p.fire-arm .*(cor q.fire-arm)])
  [name test-strand]
::  +has-test-prefix: does the arm define a test we should run?
::
++  has-test-prefix
  |=  a=term  ^-  ?
  =((end [3 8] a) 'ph-test-')
::  +resolve-test-paths: add test names to paths to form full test identifiers
::
++  resolve-test-paths
  |=  paths-to-test=(list [path (list test-arm)])
  ^-  (list test)
  %-  sort  :_  |=([a=test b=test] (aor path.a path.b))
  ^-  (list test)
  %-  zing
  %+  turn  paths-to-test
  |=  [=path test-arms=(list test-arm)]
  ^-  (list test)
  ::  for each test, add the test's name to .path
  ::
  %+  turn  test-arms
  |=  =test-arm
  ^-  test
  [(weld path /[name.test-arm]) strand.test-arm]
::  +await-test-thread: run and return result of an aqua test thread
::
++  await-test-thread
  |=  [file=path =test-strand]
  =/  m  (strand ,thread-result)
  ^-  form:m
  ;<  =bowl:spider  bind:m  get-bowl
  =/  tid  (scot %ta (cat 3 'strand_' (scot %uv (sham file eny.bowl))))
  =/  test-thread=shed:khan
    =/  n  (strand ,vase)
    ^-  form:n
    ;<  ~  bind:n  ph-test-init:ph-test
    ;<  ~  bind:n  test-strand
    ;<  ~  bind:n  ph-test-shut:ph-test
    (pure:n !>(~))
  =/  =inline-args:spider
    :*  `tid.bowl
        `tid
        byk.bowl
        test-thread
    ==
  ;<  ~      bind:m  (watch-our /awaiting/[tid] %spider /thread-result/[tid])
  ;<  ~      bind:m  (poke-our %spider %spider-inline !>(inline-args))
  ::TODO implement timeout
  ;<  =cage  bind:m  (take-fact /awaiting/[tid])
  ;<  ~      bind:m  (take-kick /awaiting/[tid])
  ?+  p.cage  ~|([%strange-thread-result p.cage file tid] !!)
    %thread-done  (pure:m %& q.cage)
    %thread-fail  (pure:m %| !<([term tang] q.cage))
  ==
--
^-  thread:spider
|=  args=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<(args=(unit [pax=(unit path) snap=@t]) args)
=/  [pax=(unit path) snap=@]
  ?~  args  ~|(%no-args-found !!)
  [pax.u.args snap.u.args]
;<  =bowl:spider  bind:m  get-bowl
=/  [byk=beak pax=path]
  ?~  pax
    [byk.bowl ~]
  ?>  ?=([ship=@ desk=@ date=@ rest=*] u.pax)
  =+  ship=(slav %p i.u.pax)
  =+  desk=i.t.u.pax
  =+  date=(slav %da i.t.t.u.pax)
  :_  t.t.t.u.pax
  [ship desk da+date]
=?  pax  ?=(~ pax)
  /tests
::  if the path does not point into a directory, assume last component
::  is a pattern.
::
=/  =arch  .^(arch %cy (weld /(scot %p p.byk)/[q.byk]/(scot %da +.r.byk) pax))
=/  [arm-pat=(unit @ta) pax=path]
  ?:  ?=(^ dir.arch)
    [~ pax]
  :_  (snip pax)
  `(rear pax)
;<  test-files=(list path)  bind:m  (find-test-files byk pax)
=.  test-files
  %+  sort  test-files
  |=([a=path b=path] (aor (spat a) (spat b)))
;<  [test-cores=(list (pair path vase)) failed-builds=(list path)]
  bind:m  (build-test-files byk test-files)
=/  tests=(list test)
  %-  resolve-test-paths
  ^-  (list [path (list test-arm)])
  %+  turn  test-cores
  ?~  arm-pat
    |=([=path =vase] [path (get-test-arms vase)])
  ::  filter based on arm pattern
  ::
  =+  len=(met 3 u.arm-pat)
  |=  [=path =vase]
  :-  path
  %+  skim  (get-test-arms vase)
  |=  =test-arm
  =((cut 3 [0 len] name.test-arm) u.arm-pat)
=+  num=(lent tests)
?:  =(num 0)
  ~>  %slog.2^leaf+"No suitable aqua tests found"
  (pure:m !>(~))
~>  %slog.1^leaf+"{<num>} test {?:((gth num 1) "threads" "thread")} built"
~>  %slog.1^'Running tests...'
=/  n  (strand (list (pair path thread-result)))
;<  results=(list (pair path thread-result))  bind:m
  ^-  form:n
  =|  results=(list (pair path thread-result))
  |-
  ?~  tests  (pure:n (flop results))
  =*  test  i.tests
  =*  name  (rear path.test)
  ::  allow virtual vanes to run before we restore snapshot
  ;<  vane-tids=(map term tid:spider)  bind:n  start-simple:ph-io
  ;<  ~  bind:n  (send-events:ph-io [%restore-snap snap]~)
  ;<  now-1=@da  bind:n  get-time
  ;<  =thread-result  bind:n  (await-test-thread test)
  ;<  now-2=@da  bind:n  get-time
  ;<  ~  bind:n  (end:ph-io vane-tids)
  =/  [took-s=@ud took-ms=@ud]
    =*  s  ~s1
    =*  ms  (div s 1.000)
    =+  diff=(sub now-2 now-1)
    [(div diff s) (div (mod diff s) ms)]
  ~>  %slog.1^leaf+"{(trip name)} took {<took-s>}.{((d-co:co 3) took-ms)}s"
  $(tests t.tests, results [[path.test thread-result] results])
=+  ok=&
|-
?~  results  (pure:m !>(ok))
=*  result  i.results
=*  path  p.result
=*  thread-result  q.result
?:  ?=(%& -.thread-result)
  ~>  %slog.0^leaf+"OK {(spud path)}"
  $(results t.results)
~>  %slog.3^leaf+"FAILED {(spud path)}"
%-  (%*(. slog pri 0) p.thread-result)
$(results t.results, ok |)

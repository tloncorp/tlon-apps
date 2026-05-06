::  list aqua tests
::
::  pax=(unit path)  optional test path
::
::  returns & if all tests build successfully, | otherwise.
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
    ~>  %slog.3^leaf+"FAILED BUILD {filename}"
    $(files t.files, fail [file fail])
  $(files t.files, out [[file u.build] out])
::  +get-test-arms: get test arms contained in a core
::
++  get-test-arms
  |=  [=path [typ=type cor=*]]
  ^-  (list test-arm)
  =/  arms=(list @tas)  (sloe typ)
  %+  roll  (skim arms has-test-prefix)
  |=  [name=term test-arms=(list test-arm)]
  =/  fire-arm=(unit (pair type nock))
    =;  res
      ?:  ?=(%| -.res)
        %-  %-  %*(. slog pri 3)  p.res
        ~>(%slog.3^leaf+"FAILED MINT {<(snoc (snip path) name)>}" ~)
      `p.res
    %-  mule
    ^-  (trap (pair type nock))
    |.((~(mint ut typ) -:!>(*test-strand) [%limb name]))
  ?~  fire-arm
    test-arms
  =+  !<(=test-strand [p.u.fire-arm .*(cor q.u.fire-arm)])
  :_  test-arms
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
--
^-  thread:spider
|=  args=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<(pax=(unit path) args)
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
::  if the path does not point into a directory/file, assume last component
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
=/  test-sets=(list [path (list test-arm)])
  %+  turn  test-cores
  ?~  arm-pat
    |=([=path =vase] [path (get-test-arms path vase)])
  ::  filter based on arm pattern
  ::
  =+  len=(met 3 u.arm-pat)
  |=  [=path =vase]
  :-  path
  %+  skim  (get-test-arms path vase)
  |=  =test-arm
  =((cut 3 [0 len] name.test-arm) u.arm-pat)
|-
?~  test-sets
  (pure:m !>(&))
=*  path  -.i.test-sets
=*  test-arms  +.i.test-sets
=+  num-arms=(lent test-arms)
?:  =(0 num-arms)  $(test-sets t.test-sets)
=/  test-num
  ?:  (gth num-arms 1)
    "{<num-arms>} tests"
  "{<num-arms>} test"
~>  %slog.0^leaf+"{<path>} ({test-num})"
|-
?~  test-arms  ^$(test-sets t.test-sets)
~>  %slog.0^leaf+"  - {<name.i.test-arms>}"
$(test-arms t.test-arms)

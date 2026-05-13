::  prepare aqua fleet snapshot
::
::  snap-id=(unit @t)
::  fleet=(list ship)
::  sync=?
::
/-  spider, aquarium
/+  *strandio, ph-io, ph-test
=,  strand=strand:spider
::  +sync-desk: sync aqua ship desk to host desk
::
|%
++  sync-desk
  |=  [her=ship desk=@tas]
  =/  m  (strand ,~)
  ^-  form:m
  ;<  =bowl:strand  bind:m  get-bowl
  =/  sab=path
    /(scot %p our.bowl)/[desk]/(scot %da now.bowl)
  =|  =path
  =|  raw-files=(list [^path page:clay])
  =.  raw-files
    |-
    =*  loop  $
    =+  .^(=arch %cy (weld sab path))
    =.  raw-files
      %+  roll  ~(tap in ~(key by dir.arch))
      |=  [dir=@ta =_raw-files]
      (welp loop(path (snoc path dir)) raw-files)
    ?~  fil.arch  raw-files
    =+  .^(=page:clay %cs (weld sab /blob/(scot %uv u.fil.arch)))
    :_  raw-files
    [path page]
  =/  files
    %+  turn  raw-files
    |=  [=^path =page:clay]
    =+  .^(=dais:clay %cb (snoc sab p.page))
    =+  .^(=tube:clay %cc (weld sab /[p.page]/mime))
    =+  !<(=mime (tube (vale:dais q.page)))
    [path ~ mime]
  =/  =beam  [[her desk ud+1] /]
  ;<  ~  bind:m  (send-events:ph-io [%event her /c/mount/0v1abc [%mont desk beam]]~)
  =/   =task:clay
    [%into desk & files]
  ;<  ~  bind:m  (send-events:ph-io [%event her /c/sync/0v1abc task]~)
  ;<  ~  bind:m  (sleep ~s0)
  (pure:m ~)
--
^-  thread:spider
|=  args=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<(args=(unit [snap-id=(unit @t) fleet=(list ship) sync=?]) args)
=/  [snap-id=(unit @t) fleet=(list ship) sync=?]
  ?~  args  ~|(%no-args-found !!)
  [snap-id fleet sync]:u.args
=.  fleet
  ^-  (list ship)
  :*  ~loshut-lonreg  ::  bait provider
      ~rivfur-livmet  ::  notify provider
      ~dem            ::  bait provider galaxy
      ~fen            ::  notify provider galaxy
      fleet
  ==
;<  =bowl:spider  bind:m  get-bowl
~>  %slog.1^(crip "Booting fleet {<fleet>}")
;<  vane-tids=(map term tid:spider)  bind:m  start-simple:ph-io
;<  ~  bind:m
  =/  n  (strand ,~)
  |-
  ?~  fleet  (pure:n ~)
  ;<  ~  bind:n  (init-ship:ph-io i.fleet &)
  $(fleet t.fleet)
::
;<  ~  bind:m
  =/  n  (strand ,~)
  ?.  sync  (pure:n ~)
  ~>  %slog.1^(crip "Syncing %groups desk to ships...")
  |-
  ?~  fleet  (pure:n ~)
  ;<  ~  bind:n  (sync-desk i.fleet %groups)
  $(fleet t.fleet)
::  allow agents time to cool down. it takes about a minute
::  for ames connections to be established.
::
~>  %slog.1^(crip "Cooling down %groups agents...")
;<  ~  bind:m  (sleep ~m1)
;<  ~  bind:m  (end-test:ph-io vane-tids)
;<  =bowl:spider  bind:m  get-bowl
=/  snap-id=@t
  ?~  snap-id  
    =+  eny=(end 3^4 (sham eny.bowl))
    (cat 3 'aqua-tests-' (scot %uv eny))
  u.snap-id
~>  %slog.1^(crip "Taking snapshot {<snap-id>}...")
;<  ~  bind:m  (send-events:ph-io [%snap-ships snap-id fleet]~)
(pure:m !>(snap-id))

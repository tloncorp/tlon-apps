::  Native Vere recall timing. Seeding finishes before the measured events.
/-  m=harness-memory
/+  mem=harness-memory, idx=harness-memory-index, *strandio
|%
++  seed
  |=  count=@ud
  ^-  state:m
  %+  roll  (gulf 1 count)
  |=  [n=@ud db=state:m]
  =/  number  (crip (skip (trip (scot %ud n)) |=(c=@tD =('.' c))))
  =/  name  (cat 3 'record-' number)
  =/  category
    %+  snag  (mod n 7)
    `(list @t)`~['alpha' 'bravo' 'charlie' 'delta' 'echo' 'foxtrot' 'golf']
  =/  result
    %:  save:mem
      db  name  0
      :*  `(rap 3 'Shared ' category ' requires testing ' name ~)
          ~  |  |  ['bench' 0v1 n ~2026.10.7 '~zod']
      ==
    ==
  ?>  ?=(%& -.result)
  p.result
++  measure
  |=  [count=@ud repeats=@ud]
  ?>  &((gte count 1) (lte count 32.768) (gte repeats 1) (lte repeats 1.000))
  =/  db  (seed count)
  =/  thread  (strand ,vase)
  ;<  ~  bind:thread  (sleep (div ~s1 1.000))
  ;<  start=@da  bind:thread  get-time
  =/  query  'shared alpha bravo charlie delta echo foxtrot golf'
  =/  checksum
    %+  roll  (gulf 1 repeats)
    |=  [n=@ud checksum=@ud]
    =/  names  (choose:mem db query (scot %ud n))
    (add checksum (mug (pack:mem db names 4.096)))
  ;<  ~  bind:thread  (sleep (div ~s1 1.000))
  ;<  end=@da  bind:thread  get-time
  =/  scan  (candidates:idx index.db query)
  %-  pure:thread
  !>  :*  count  repeats  (div (mul (sub end start) 1.000) ~s1)
          checksum  visited.scan  ~(wyt in names.scan)
      ==
--

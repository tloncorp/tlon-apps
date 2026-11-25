::  The adapter's Lens window, through the real agent: which observations it
::  keeps Lens records for after a head invalidation.
::  -test /=harness=/tests-integration/harness-tlon-lens-selection
/-  h=harness, hh=harness-hand, t=harness-tlon, cr=harness-cron
/+  *test-agent, hd=harness-hand
/=  adapter  /app/harness-tlon
|%
++  t0  ~2026.10.1
++  now  (add t0 ~d1)
++  speaker  (scot %p ~nec)
++  sid  |=(binding=@t (cat 3 'sid-' binding))
++  chan  |=(binding=@t `@tas`(cat 3 'c-' binding))
++  config
  |=  binding=@t
  ^-  binding:hh
  ['tlon' (cat 3 'chat/~zod/' (chan binding)) (sid binding) ~[speaker] &]
::  Completed observations in BINDING, one per time in ATS.
::
++  observe
  |=  [db=state:hh binding=@t ats=(list @da)]
  ^-  state:hh
  =.  bindings.db  (~(put by bindings.db) binding (config binding))
  %+  roll  ats
  |=  [at=@da db=_db]
  =/  event  (scot %da at)
  %=  db
    observations
      %+  ~(put by observations.db)  (input-id:hd binding event)
      [binding event speaker 'text' at %completed]
  ==
++  id  |=([binding=@t at=@da] (input-id:hd binding (scot %da at)))
++  seconds  |=([from=@ud to=@ud] (turn (gulf from to) |=(n=@ud (add t0 (mul n ~s1)))))
++  adapter-state
  |=  bindings=(list @t)
  ^-  state-5:t
  =/  s=state-5:t  *state-5:t
  %=  s
    owner-initialized  1
    policy  [& `~nec ~ %mentions ~ ~]
    lens  [& `~nec `@da`0 ~ '']
    routes  (malt (turn bindings |=(b=@t [(sid b) [b %ready]])))
    lanes  (malt (turn bindings |=(b=@t [(sid b) [[%channel [%chat ~zod (chan b)] ~] 0 ~]])))
  ==
::  The head's answers for LEDGER, including a run payload for every record.
::
++  scry
  |=  db=state:hh
  |=  =path
  ^-  (unit vase)
  ?:  (lien path |=(a=@ta =(%hand-state a)))  `!>(db)
  ?:  (lien path |=(a=@ta =(%hand-index a)))  `!>((reindex:hd db))
  ?:  (lien path |=(a=@ta =(%cron-session a)))  `!>(`(unit schedule:cr)`~)
  ?:  (lien path |=(a=@ta =(%run a)))  `!>(`(unit json)`[~ [%o ~]])
  ?:  (lien path |=(a=@ta =(%head a)))
    `!>(`[revision=@ud view=view:h next=(unit step:h)]`[0 *view:h ~])
  ?:  ?=([%gu *] path)  `!>(&)
  `!>(|)
++  start
  |=  [db=state:hh bindings=(list @t)]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now now)))
  ;<  ~  bind:m  (set-scry-gate (scry db))
  ;<  *  bind:m  (do-load adapter `!>((adapter-state bindings)))
  ;<  ~  bind:m
    %-  jab-bowl
    |=  b=bowl
    =.  wex.b  (~(put by wex.b) [/head ~zod %harness] [& /hand-events])
    b(wex (~(put by wex.b) [/publications ~zod %channels] [& /v3]))
  (pure:m ~)
::  Invalidate as the head does and read back the retained Lens records.
::
++  invalidate
  =/  m  (mare ,(set input-id:h))
  ^-  form:m
  ;<  *  bind:m  (do-agent /head [~zod %harness] [%fact %noun !>(%changed)])
  ;<  =vase  bind:m  get-save
  (pure:m ~(key by records.lens:!<(state-5:t vase)))
::  64 in 'old', one second apart, and the newest in 'new'.
::
++  two-bindings
  ^-  state:hh
  (observe (observe *state:hh 'old' (seconds 1 64)) 'new' ~[(add t0 ~m5)])
::
++  test-lens-keeps-the-newest-64-across-bindings
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (start two-bindings ~['old' 'new'])
  ;<  kept=(set input-id:h)  bind:m  invalidate
  %+  ex-equal  !>(kept)
  !>((silt [(id 'new' (add t0 ~m5)) (turn (seconds 2 64) |=(at=@da (id 'old' at)))]))
::
++  test-lens-refills-from-the-other-binding-after-retirement
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (start two-bindings ~['old' 'new'])
  ;<  before=(set input-id:h)  bind:m  invalidate
  ;<  ~  bind:m  (ex-equal !>(~(wyt in before)) !>(64))
  ::  Retiring 'new' removes its binding and records from the ledger.
  =/  retired  two-bindings
  =.  bindings.retired  (~(del by bindings.retired) 'new')
  =.  observations.retired  (~(del by observations.retired) (id 'new' (add t0 ~m5)))
  ;<  ~  bind:m  (set-scry-gate (scry retired))
  ;<  after=(set input-id:h)  bind:m  invalidate
  (ex-equal !>(after) !>((silt (turn (seconds 1 64) |=(at=@da (id 'old' at))))))
::
++  test-lens-breaks-a-boundary-tie-by-input-id
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ::  63 newer observations, then two sharing the time at position 64.
  =/  db  (observe *state:hh 'old' (seconds 2 64))
  =.  bindings.db  (~(put by bindings.db) 'tie' (config 'tie'))
  =/  a  (input-id:hd 'tie' 'tie-a')
  =/  b  (input-id:hd 'tie' 'tie-b')
  =.  observations.db
    %-  ~(gas by observations.db)
    :~  [a ['tie' 'tie-a' speaker 'text' (add t0 ~s1) %completed]]
        [b ['tie' 'tie-b' speaker 'text' (add t0 ~s1) %completed]]
    ==
  ;<  ~  bind:m  (start db ~['old' 'tie'])
  ;<  kept=(set input-id:h)  bind:m  invalidate
  %+  ex-equal  !>(kept)
  !>((silt [(min a b) (turn (seconds 2 64) |=(at=@da (id 'old' at)))]))
--

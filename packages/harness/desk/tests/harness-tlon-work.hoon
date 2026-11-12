/-  t=harness-tlon, hh=harness-hand
/+  *test, w=harness-tlon-work, hd=harness-hand
|%
++  state
  ^-  state-2:t
  =/  s=state-2:t  *state-2:t
  s(policy [& `~bud ~ %mentions ~ ~], routes (my ~[['s' ['b' %ready]]]))
++  ledger
  ^-  state:hh
  =/  db=state:hh  *state:hh
  =.  bindings.db  (my ~[['b' `binding:hh`['tlon' 'dm/~bud' 's' ~['~bud'] &]]])
  =/  ns=(list @ud)  (gulf 1 25)
  %+  roll  ns
  |=  [n=@ud out=state:hh]
  =/  id=@uv  `@uv`n
  =/  obs=observation:hh  ['b' (scot %ud n) '~bud' 'hello' (add ~2026.9.6 n) %completed]
  =/  pub=publication:hh
    [id 'b' 'tlon' 'dm/~bud' 's' %reply 'answer' %uncertain 'worker' 'native' ~]
  %=  out  bindings  bindings.db  observations  (~(put by observations.out) id obs)  outbox
      (~(put by outbox.out) id pub)
  ==
++  records
  |=  page=json
  ^-  (list json)
  ?>  ?=(%o -.page)
  =/  rs  (~(got by p.page) 'records')
  ?>  ?=(%a -.rs)
  p.rs
++  test-pages-are-bounded-and-do-not-repeat-records
  =/  first  (page:w state ledger '')
  ?>  ?=(%o -.first)
  =/  cursor  (~(got by p.first) 'next')
  ?>  ?=(%s -.cursor)
  =/  second  (page:w state ledger p.cursor)
  =/  a  (records first)
  =/  b  (records second)
  (expect !>(&(=(16 (lent a)) =(9 (lent b)) =(25 (lent ~(tap in (silt (weld a b))))))))
++  test-uncertain-is-never-automatically-retryable
  =/  rows  (records (page:w state ledger ''))
  ?>  ?=(^ rows)
  =/  row  i.rows
  ?>  ?=(%o -.row)
  (expect !>(&(=([%b &] (~(got by p.row) 'canResolve')) =([%b |] (~(got by p.row) 'canRetry')))))
++  test-retired-binding-retains-evidence-without-retry-authority
  =/  db  ledger
  =.  outbox.db  (~(run by outbox.db) |=(pub=publication:hh pub(status %failed)))
  =/  old  state
  =.  routes.old  (my ~[['s' ['fresh' %ready]]])
  =/  rows  (records (page:w old db ''))
  ?>  ?=(^ rows)
  =/  row  i.rows
  ?>  ?=(%o -.row)
  (expect !>(&(=([%b |] (~(got by p.row) 'current')) =([%b |] (~(got by p.row) 'canRetry')))))
++  test-admission-errors-are-shown-before-history
  =/  s  state
  =.  jobs.s  (my ~[[0v1 `job:t`[[~bud 'e' [%dm ~bud ~] 'waiting'] 's' %error 'Head unavailable']]])
  =/  rows  (records (page:w s ledger ''))
  ?>  ?=(^ rows)
  =/  row  i.rows
  ?>  ?=(%o -.row)
  %-  expect
  !>  ?&  =([%s 'admission'] (~(got by p.row) 'kind'))
          =([%s 'Head unavailable'] (~(got by p.row) 'error'))
      ==
++  test-invalid-cursor-is-rejected
  (expect !>(=(~ (mole |.((page:w state ledger 'not-a-cursor'))))))
--

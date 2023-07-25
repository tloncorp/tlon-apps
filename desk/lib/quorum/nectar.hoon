::
::  quorum-nectar: supplemental nectar functions, which should eventually
::  be submitted to the upstream nectar repo
::
/+  n=nectar
|%
::
++  apply
  |=  [=database:n =query:n]
  ^-  database:n
  (applys database ~[query])
::
++  applys
  |=  [=database:n queries=(list query:n)]
  ^-  database:n
  =<  +
  %^  spin  queries  database
  |=  [=query:n db=database:n]
  ^-  [query:n database:n]
  [query +:(~(q db:n db) %quorum query)]
::
++  cedit
  |=  [cond=condition:n edit=$-(term term)]
  ^-  condition:n
  ?-  -.cond
    %n    cond
    %s    cond(c (edit c.cond))
    %d    cond(c1 (edit c1.cond), c2 (edit c2.cond))
    %and  cond(a $(cond a.cond), b $(cond b.cond))
    %or   cond(a $(cond a.cond), b $(cond b.cond))
  ==
--

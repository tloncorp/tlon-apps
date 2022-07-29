/-  ch=channel
/-  g=groups
|%
++  enjs
  =,  enjs:format
  |%
  ++  flag
    |=  f=flag:g
    ^-  json
    s/(rap 3 (scot %p p.f) '/' q.f ~)
  ::
  ++  perm
    |=  p=perm:ch
    %-  pairs
    :~  writers/a/(turn ~(tap in writers.p) (lead %s))
    ==
  --
++  dejs
  =,  dejs:format
  |%
  ++  create
    ^-  $-(json create:ch)
    %-  ot
    :~  group+flag
        name+(se %tas)
        title+so
        description+so
        readers+(as (se %tas))
        writers+(as (se %tas))
    ==
  ++  flag  `$-(json flag:g)`(su flag-rule)
  ++  flag-rule  ;~((glue fas) ;~(pfix sig fed:ag) sym)
  --
--

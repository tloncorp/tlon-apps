::  apps-json: JSON conversions for %apps types
::
::    channels are addressed by flag (ship + name), not by nest: the kind
::    is always %apps, so carrying it would be redundant on the wire and
::    the agent can rebuild the nest itself.
::
::    .body is carried as a JSON string, not as inlined JSON. it is
::    opaque to this agent, so re-parsing it here would only create a
::    place for a malformed document to fail the whole envelope.
::
/-  a=apps, g=groups
=,  format
|%
++  enjs
  =,  enjs:format
  |%
  ++  flag
    |=  f=flag:g
    ^-  @t
    (rap 3 (scot %p p.f) '/' q.f ~)
  ++  doc
    |=  d=doc:v1:a
    ^-  json
    %-  pairs
    :~  ['group' s+(flag group.d)]
        ['writers' a+(turn ~(tap in writers.d) |=(r=@tas `json`s+r))]
        ['revision' (numb revision.d)]
        ['body' s+body.d]
        ['applied' a+(turn applied.d |=(i=@t `json`s+i))]
        ['updated' s+(scot %da updated.d)]
    ==
  ++  update
    |=  u=update:v1:a
    ^-  json
    ?-  -.u
      %deleted  (frond 'deleted' s+(flag flag.u))
    ::
        %doc
      %-  frond  :-  'doc'
      (pairs ~[['flag' s+(flag flag.u)] ['doc' (doc doc.u)]])
    ::
        %docs
      %-  frond  :-  'docs'
      :-  %o
      %-  malt
      %+  turn  ~(tap by docs.u)
      |=  [f=flag:g d=doc:v1:a]
      [(flag f) (doc d)]
    ::
        %conflict
      %-  frond  :-  'conflict'
      (pairs ~[['flag' s+(flag flag.u)] ['revision' (numb revision.u)]])
    ==
  --
++  dejs
  =,  dejs:format
  |%
  ++  fl
    ^-  $-(json flag:g)
    (su ;~((glue fas) ;~(pfix sig fed:ag) sym))
  ++  action
    ^-  $-(json action:v1:a)
    %-  of
    :~  :-  %create
        %-  ot
        :~  name+(se %tas)
            group+fl
            title+so
            description+so
            readers+(ar (se %tas))
            writers+(ar (se %tas))
            body+so
        ==
        [%write (ot ~[flag+fl id+so expected+(mu ni) body+so])]
        [%delete (ot ~[flag+fl])]
    ==
  --
--

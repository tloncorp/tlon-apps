/-  *logs
|%
::
++  fail-event
  |=  [=term =tang]
  ^-  $>(%fail log-event)
  [%fail term tang]
::
++  log-fail
  |=  [=wire our=ship event=$>(%fail log-event)]
  ^-  card:agent:gall
  [%pass wire %agent [our %logs] %poke log-action+!>([%log event])]
::
++  enjs
  =,  format
  |%
  ++  tang
    |=  t=^tang
    ^-  $>(%a json)
    ?~  t  a+~
    =/  tame=(list tape)
      %+  turn  t
     (cork (cury wash [0 80]) zing)
    ::XX posthog does not display newlines properly
    :: s+(crip (zing `(list tape)`(join "\0a" tame)))
    a+(turn tame tape:enjs)
  ::
  ++  d-co-2  (d-co:co 2)
  ++  id-event
    |=  id=^id-event
    ^-  $>(%s json)
    =+  date=(yore id)
    =+  frac=(head f.t.date)
    ::  convert urbit fractosecs to millisecs
    ::
    =+  mili=(div (mul frac 1.000) 65.563)
    :-  %s
    %-  crip
    "{((d-co:co 4) y.date)}-{(d-co-2 m.date)}-{(d-co-2 d.t.date)}".
    "T{(d-co-2 h.t.date)}:{(d-co-2 m.t.date)}:{(d-co-2 s.t.date)}".
    ".{((d-co:co 3) mili)}"
  ::
  ++  log-event
    |=  e=^log-event
    ^-  $>(%o json)
    =*  event-type  -.e
    ?-    -.e
        %fail
      =-  ?>(?=(%o -.-) -)
      %-  pairs:enjs
      :~  type/s+event-type
          description/s+desc.e
          stacktrace/(tang crash.e)
      ==
    ==
  --
--

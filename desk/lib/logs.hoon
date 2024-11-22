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
      %-  zing
      %+  turn  t
      (cury wash [0 80])
    a+(turn tame tape:enjs)
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

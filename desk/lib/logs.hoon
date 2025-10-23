/-  *logs
=<
  |_  [our=ship =wire]
  ::
  ++  fail
    |=  [desc=term trace=tang =log-data]
    ^-  card:agent:gall
    =/  event=$>(%fail log-event)
      [%fail desc trace]
    (pass event log-data)
  ::
  ++  tell
    |=  [vol=volume =echo =log-data]
    ^-  card:agent:gall
    =/  event=$>(%tell log-event)
      [%tell vol echo]
    (pass event log-data)
  ::
  ++  pass
    |=  [event=log-event data=log-data]
    ^-  card:agent:gall
    [%pass wire %agent [our %logs] %poke log-action+!>(`a-log`[%log event data])]
  --
|%
::
++  fail-event
  |=  [=term =tang]
  ^-  $>(%fail log-event)
  [%fail term tang]
::
++  tell-event
  |=  [vol=volume =echo]
  ^-  $>(%tell log-event)
  [%tell vol echo]
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
          stacktrace/(tang trace.e)
      ==
    ::
        %tell
      =-  ?>(?=(%o -.-) -)
      %-  pairs:enjs
      :~  type/s+event-type
          message/(tang echo.e)
          volume/s+vol.e
      ==
    ==
  --
--

/-  *logs
=<
  |_  [our=ship =wire]
  ::
  ++  fail
    |=  [desc=term trace=tang]
    ^-  card:agent:gall
    =/  event=$>(%fail log-event)
      [%fail desc trace]
    (pass event)
  ::
  ++  tell
    |=  [id=(unit @ta) vol=volume =echo]
    ^-  card:agent:gall
    =/  event=$>(%tell log-event)
      [%tell id vol echo]
    (pass event)
  ::
  ++  pass
    |=  event=log-event
    ^-  card:agent:gall
    [%pass wire %agent [our %logs] %poke log-action+!>([%log event])]
  --
|%
::
++  fail-event
  |=  [=term =tang]
  ^-  $>(%fail log-event)
  [%fail term tang]
::
++  tell-event
  |=  [id=(unit @ta) vol=volume =echo]
  ^-  $>(%tell log-event)
  [%tell id vol echo]
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
      =-  ?~  id.e  -
          [id/s+u.id.e -]
      :~  type/s+event-type
          message/(tang echo.e)
          volume/s+vol.e
      ==
    ==
  --
--

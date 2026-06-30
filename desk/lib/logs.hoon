/-  *logs
=<
  |_  [our=ship =wire]
  ::
  ++  fail
    |=  [vol=volume =echo =tang =log-data]
    ^-  card:agent:gall
    =/  event=$>(%fail log-event)
      [%fail vol echo tang]
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
    [%pass wire %agent [our %logs] %poke log-action-1+!>(`a-log`[%log event data])]
  --
|%
::
++  volume-val
  |=  =volume
  ^-  @ud
  ?-  volume
    %trace  0
    %dbug   1
    %info   2
    %warn   3
    %error  4
    %fatal  5
  ==
::
++  volume-pri
  |=  =volume
  ^-  @ud
  ?-  volume
    %trace  0
    %dbug   0
    %info   1
    %warn   2
    %error  3
    %fatal  3
  ==
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
          message/(tang echo.e)
          volume/s+vol.e
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
++  conv
  |%
  ++  v1
    |%
    ++  volume
      |%
      ++  v0
        |=  =volume:^v0
        ^-  volume:^v1
        ?-  volume
          %dbug  %dbug
          %info  %info
          %warn  %warn
          %crit  %error
        ==
      --
    --
  --
--

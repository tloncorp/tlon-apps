/-  *logs
=<
  |_  [our=ship dap=term =wire]
  ::
  ++  fail
    |=  [vol=volume =echo =tang =log-data]
    ~>  %spin.['logs-fail']
    ^-  card:agent:gall
    =/  event=$>(%fail log-event)
      [%fail vol echo tang]
    (pass event log-data)
  ::
  ++  on-fail
    |=  [=term =tang]
    ~>  %spin.['logs-on-fail']
    ^-  card:agent:gall
    (fail %error ~[(cat 3 dap ' failed')] [leaf+"{<term>}" tang] ~)
  ::
  ++  tell
    |=  [vol=volume =echo =log-data]
    ~>  %spin.['logs-tell']
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
          volume/s+vol.e
          message/(tang echo.e)
          stacktrace/(tang tang.e)
      ==
    ::
        %tell
      =-  ?>(?=(%o -.-) -)
      %-  pairs:enjs
      :~  type/s+event-type
          volume/s+vol.e
          message/(tang echo.e)
      ==
    ==
  --
++  dejs
  =,  dejs:format
  |%
  ++  a-log
    ^-  $-(json a-log:v1)
    ::  %log variant unsupported
    %-  of
    :~  set-volume+(mu volume)
        set-otel+(mu so)
    ==
  ++  volume
    ^-  $-(json volume:v1)
    %-  su
    (perk %trace %dbug %info %warn %error %fatal ~)
  --
--

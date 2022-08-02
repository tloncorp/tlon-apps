/-  h=hark
/+  groups-json
|%
++  enjs
  =,  enjs:format
  |%
  ++  carpet
    |=  c=carpet:h
    ^-  json
    %-  pairs
    :~  seam/(seam seam.c)
        yarns/(yarns yarns.c)
        cable/(cable cable.c)
    ==
  ::
  ++  cable
    |=  c=(map rope:h thread:h)
    ^-  json
    :-  %a
    %+  turn  ~(tap by c)
    |=  [r=rope:h t=thread:h]
    %-  pairs
    :~  rope/(rope r)
        thread/(thread t)
    ==
  ::
  ++  id
    |=  i=id:h
    ^-  json
    s/(scot %uv i)
  ::
  ++  thread
    |=  t=thread:h
    ^-  json
    :-  %a
    (turn ~(tap in t) id)
  ::
  ++  threads
    |=  ts=(map @da thread:h)
    %-  pairs
    %+  turn  ~(tap by ts)
    |=  [tim=@da t=thread:h]
    ^-  [cord json]
    [(scot %da tim) (thread t)]
  ::
  ++  update
    |=  u=update:h
    %-  pairs
    :~  yarns/(yarns yarns.u)
        seam/(seam seam.u)
        threads/(threads threads.u)
    ==
  ::
  ++  yarns
    |=  ys=(map id:h yarn:h)
    ^-  json
    %-  pairs
    %+  turn  ~(tap by ys)
    |=  [i=id:h y=yarn:h]
    [(scot %uv i) (yarn y)]
  ::
  ++  yarn
    |=  y=yarn:h
    ^-  json
    *json
  ::
  ++  seam
    |=  s=seam:h
    %+  frond  -.s
    ^-  json
    ?-  -.s
      %all    ~
      %group  s/(flag flag.s)
      %desk   s/desk.s
    ==
  ::
  ++  flag  flag:enjs:groups-json
  ::
  ++  rope
    |=  r=rope:h
    ^-  json
    %-  pairs
    :~  group/?~(gop.r ~ s/(flag u.gop.r))
        channel/?~(can.r ~ s/(flag u.can.r))
        desk/s/des.r
        thread/s/(spat ted.r)
    ==
  --
::
++  dejs
  =,  dejs:format
  |%
  ++  action
    ^-  $-(json action:h)
    %-  of
    :~  saw-seam/seam
        saw-rope/rope
    ==
  ::
  ++  seam
    %-  of
    :~  all/ul
        desk/so
        group/flag
    ==
  ::
  ++  flag  flag:dejs:groups-json
  ::
  ++  rope
    %-  ot
    :~  group/(mu flag)
        channel/(mu flag)
        desk/so
        thread/pa
    ==
  --
--

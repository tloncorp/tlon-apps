/-  h=hark
/+  groups-json
|%
++  enjs
  =,  enjs:format
  |%
  ++  action
    |=  a=action:h
    %+  frond  -.a
    ?-  -.a
      %add-yarn  (add-yarn +.a)
      %saw-seam  (seam +.a)
      %saw-rope  (rope +.a)
    ==
  ::
  ++  blanket
    |=  b=blanket:h
    %-  pairs
    :~  seam/(seam seam.b)
        yarns/(yarns yarns.b)
        quilt/(quilt quilt.b)
    ==
  ::
  ++  quilt
    |=  q=quilt:h
    %-  pairs
    %+  turn  (tap:on:quilt:h q)
    |=  [num=@ud t=thread:h]
    [(scot %ud num) (thread t)]
  ::
  ++  add-yarn
    |=  [all=? desk=? yar=yarn:h]
    %-  pairs
    :~  all/b/all
        desk/b/desk
        yarn/(yarn yar)
    ==
  ::
  ++  carpet
    |=  c=carpet:h
    ^-  json
    %-  pairs
    :~  seam/(seam seam.c)
        yarns/(yarns yarns.c)
        cable/(cable cable.c)
        stitch/(numb stitch.c)
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
    %-  pairs
    :~  id/s/(scot %uv id.y)
        rope/(rope rop.y)
        time/(time tim.y)
        con/a/(turn con.y content)
        wer/s/(spat wer.y)
        button/~
    ==
  ::
  ++  content
    |=  c=content:h
    ^-  json
    ?@  c  s/c
    ?-  -.c
      %ship  (frond ship/s/(scot %p p.c))
      %emph  (frond emph/s/p.c)
    ==
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
  ++  nest  nest:enjs:groups-json
  ::
  ++  rope
    |=  r=rope:h
    ^-  json
    %-  pairs
    :~  group/?~(gop.r ~ s/(flag u.gop.r))
        channel/?~(can.r ~ s/(nest u.can.r))
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
  ++  nest  nest:dejs:groups-json
  ::
  ++  rope
    %-  ot
    :~  group/(mu flag)
        channel/(mu nest)
        desk/so
        thread/pa
    ==
  --
--

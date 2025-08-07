/-  c=cite
|%
++  enjs
  =,  enjs:format
  =>
    |%
    ++  flag
      |=  f=flag:c
      (rap 3 (scot %p p.f) '/' q.f ~)
    ++  nest
      |=  n=nest:c
      (rap 3 p.n '/' (flag q.n) ~)
    --
  |=  =cite:c
  %+  frond  -.cite
  ?-    -.cite
      %group  s/(flag flag.cite)
  ::
      %desk
    %-  pairs
    :~  flag/s/(flag flag.cite)
        where/s/(spat wer.cite)
    ==
  ::
      %chan
    %-  pairs
    :~  nest/s/(nest nest.cite)
        where/s/(spat wer.cite)
    ==
  ::
      %bait
    %-  pairs
    :~  group/s/(flag grp.cite)
        graph/s/(flag gra.cite)
        where/s/(spat wer.cite)
    ==
  ==
::
++  dejs
  =,  dejs:format
  =>
    |%
    ++  ship  ;~(pfix sig fed:ag)
    ++  flag  ;~((glue fas) ship sym)
    ++  nest  ;~((glue fas) sym flag)
    --
  ^-  $-(json cite:c)
  %-  of
  :~  group/(su flag)
      ::
      :-  %desk
      %-  ot
      :~  flag/(su flag)
          where/pa
      ==
      ::
      :-  %chan
      %-  ot
      :~  nest/(su nest)
          where/pa
      ==
  ==
--

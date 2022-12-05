/-  c=cite
/+  j=groups-json
|%
++  enjs
  =,  enjs:format
  |=  =cite:c
  %+  frond  -.cite
  ?-    -.cite
      %group  s/(flag:enjs:j flag.cite)
  ::
      %desk
    %-  pairs
    :~  desk/s/(flag:enjs:j flag.cite)
        where/s/(spat wer.cite)
    ==
  ::
      %chan
    %-  pairs
    :~  nest/s/(nest:enjs:j nest.cite)
        where/s/(spat wer.cite)
    ==
  ::
      %bait
    %-  pairs
    :~  group/s/(flag:enjs:j grp.cite)
        graph/s/(flag:enjs:j gra.cite)
        where/s/(spat wer.cite)
    ==
  ==
::
++  dejs
  =,  dejs:format
  ^-  $-(json cite:c)
  %-  of
  :~  group/flag:dejs:j
      ::
      :-  %desk
      %-  ot
      :~  flag/flag:dejs:j
          where/pa
      ==
      ::
      :-  %chan
      %-  ot
      :~  nest/nest:dejs:j
          where/pa
      ==
      ::
      :-  %bait
      %-  ot
      :~  group/flag:dejs:j
          graph/flag:dejs:j
          where/pa
      ==
  ==
--

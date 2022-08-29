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
        where/?~(wer.cite ~ s/(spat u.wer.cite))
    ==
  ::
      %chan
    %-  pairs
    :~  nest/s/(nest:enjs:j nest.cite)
        where/?~(wer.cite ~ s/(spat u.wer.cite))
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
          where/(mu pa)
      ==
      ::
      :-  %chan
      %-  ot
      :~  nest/nest:dejs:j
          where/(mu pa)
      ==

  ==
--

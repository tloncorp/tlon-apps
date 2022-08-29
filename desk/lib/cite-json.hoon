/-  c=cite
/+  j=groups-json
|%
++  enjs
  =,  enjs:format
  |=  =cite:c
  %+  frond  -.cite
  ?-  -.cite
      ?(%group %desk)  s/(flag:enjs:j flag.cite)
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
      desk/flag:dejs:j
      ::
      :-  %chan
      %-  ot
      :~  nest/nest:dejs:j
          where/(mu pa)
      ==

  ==
--

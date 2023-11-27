/-  g=groups, c=chat
|%
+$  init
  $:  groups=groups-ui:g
      =gangs:g
      talk
  ==
::
+$  talk
  $:  clubs=(map id:club:c crew:club:c)
      dms=(set ship)
      =unreads:c
      invited=(set ship)
      pins=(list whom:c)
  ==
::
+$  vita-enabled  ?
--
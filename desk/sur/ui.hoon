/-  g=groups, d=channel, c=chat
|%
+$  init
  $:  groups=groups-ui:g
      =gangs:g
      =chat
      =heap
      =diary    
  ==
::
+$  chat
  $:  =briefs:d
      shelf=rr-shelf:d
      pins=(list whom:c)
  ==
::
+$  heap
  $:  =briefs:d
      shelf=rr-shelf:d
  ==
::
+$  diary
  $:  =briefs:d
      shelf=rr-shelf:d
  ==
::
+$  vita-enabled  ?
--

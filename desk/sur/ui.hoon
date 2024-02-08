/-  g=groups, d=channels, c=chat
|%
+$  init
  $:  groups=groups-ui:g
      =gangs:g
      =channels:d
      =unreads:d
      pins=(list whom)
      =chat
  ==
::
+$  chat
  $:  clubs=(map id:club:c crew:club:c)
      dms=(set ship)
      =unreads:c
      invited=(set ship)
      pins=(list whom:c)
  ==
::  $whom: ID for an "item"
::
+$  whom
  $%  [%group =flag:g]
      [%channel =nest:g]
      [%chat =whom:c]
  ==
::
+$  action
  $%  [%pins =a-pins]
  ==
+$  a-pins
  $%  [%add =whom]
      [%del =whom]
  ==
::
+$  vita-enabled  ?
--

/-  g=groups, d=channels, c=chat
|%
+$  init
  $:  groups=groups-ui:g
      =gangs:g
      =channels:d
      =unreads:d
      pins=(list whom)
      =chat
      profile=?
  ==
::
+$  init-0
  $:  groups=groups-ui:g
      =gangs:g
      channels=channels-0:d
      =unreads:d
      pins=(list whom)
      =chat
      profile=?
  ==
::
+$  mixed-heads  [chan=channel-heads:d chat=chat-heads:c]
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

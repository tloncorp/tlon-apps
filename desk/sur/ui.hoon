/-  g=groups, d=channels, c=chat, a=activity
|%
+$  init
  $:  groups=groups-ui:g
      =gangs:g
      =channels:d
      =activity:v3:old:a
      pins=(list whom)
      =chat
      profile=?
  ==
+$  init-2
  $:  groups=groups-ui:g
      =gangs:g
      =channels:d
      activity=activity:v2:old:a
      pins=(list whom)
      =chat
      profile=?
  ==
::
+$  init-1
  $:  groups=groups-ui:g
      =gangs:g
      =channels:d
      =unreads:d
      pins=(list whom)
      chat=chat-0
      profile=?
  ==
::
+$  init-0
  $:  groups=groups-ui:g
      =gangs:g
      channels=channels-0:d
      =unreads:d
      pins=(list whom)
      chat=chat-0
      profile=?
  ==
::
+$  mixed-heads  [chan=channel-heads:d chat=chat-heads:c]
::
+$  chat
  $:  clubs=(map id:club:c crew:club:c)
      dms=(set ship)
      invited=(set ship)
  ==
+$  chat-0
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

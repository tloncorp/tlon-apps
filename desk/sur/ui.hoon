/-  gv=groups-ver, d=channels, c=chat, a=activity
|%
+$  init-6
  $:  groups=groups-ui:v5:gv
      =gangs:v6:gv
      channel=channel-0
      =activity:a
      pins=(list whom)
      chat=chat-2
      profile=?
  ==
+$  init-5
  $:  groups=groups-ui:v5:gv
      =gangs:v5:gv
      channel=channel-0
      =activity:a
      pins=(list whom)
      chat=chat-2
      profile=?
  ==
+$  init-4
  $:  groups=groups-ui:v2:gv
      =gangs:v2:gv
      channel=channel-0
      =activity:a
      pins=(list whom)
      chat=chat-2
      profile=?
  ==
+$  init-3
  $:  groups=groups-ui:v2:gv
      =gangs:v2:gv
      =channels:d
      =activity:v3:old:a
      pins=(list whom)
      chat=chat-1
      profile=?
  ==
+$  init-2
  $:  groups=groups-ui:v2:gv
      =gangs:v2:gv
      =channels:d
      activity=activity:v2:old:a
      pins=(list whom)
      chat=chat-1
      profile=?
  ==
::
+$  init-1
  $:  groups=groups-ui:v2:gv
      =gangs:v2:gv
      =channels:d
      =unreads:d
      pins=(list whom)
      chat=chat-0
      profile=?
  ==
::
+$  init-0
  $:  groups=groups-ui:v2:gv
      =gangs:v2:gv
      channels=channels-0:d
      =unreads:d
      pins=(list whom)
      chat=chat-0
      profile=?
  ==
::
+$  mixed-heads  [chan=channel-heads:d chat=chat-heads:c]
::
+$  channel-0
  $:  =channels:v1:old:d
      hidden-posts=(set id-post:d)
  ==
+$  chat-2
  $:  dms=(set ship)
      invited=(set ship)
      clubs=(map id:club:c crew:club:c)
      blocked=(set ship)
      blocked-by=(set ship)
      hidden-messages=(set id:c)
  ==
+$  chat-1
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
  $%  [%group =flag:v0:gv]
      [%channel =nest:v0:gv]
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

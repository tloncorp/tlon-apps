/-  gv=groups-ver, d=channels, c=chat, a=activity, oc=chat-3
|%
+$  init-5
  $:  groups=groups-ui:v7:gv
      =foreigns:v7:gv
      channel=channel-8
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
      =channels:v7:old:d
      =activity:v3:old:a
      pins=(list whom)
      chat=chat-1
      profile=?
  ==
+$  init-2
  $:  groups=groups-ui:v2:gv
      =gangs:v2:gv
      =channels:v7:old:d
      activity=activity:v2:old:a
      pins=(list whom)
      chat=chat-1
      profile=?
  ==
::
+$  init-1
  $:  groups=groups-ui:v2:gv
      =gangs:v2:gv
      =channels:v7:old:d
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
+$  mixed-heads  [chan=channel-heads:v7:d chat=chat-heads:oc]
+$  mixed-heads-2  [chan=channel-heads:v8:d chat=chat-heads:c]
+$  mixed-heads-3  [chan=channel-heads:v9:d chat=chat-heads:c]
::
+$  channel-8
  $:  =channels:d
      hidden-posts=(set id-post:d)
  ==
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

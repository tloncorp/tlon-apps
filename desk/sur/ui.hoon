/-  av=activity-ver, gv=groups-ver, dv=channels-ver, cv=chat-ver, a=activity
/-  b=buckets
|%
::  Buckets ride here for the same reason channels do: their writer roles
::  live in their own agent, not in %groups, and a client that learns about a
::  bucket without them cannot tell "no writers" from "not yet known" -- which
::  for a writer set is the difference between restricted and open. Reading
::  them separately meant a bucket arriving after init had none.
::
::  Summaries rather than snapshots: the manifest is what makes a bucket
::  large, nothing at startup needs it, and a bucket is opened one at a time.
::
+$  init-10
  $:  groups=groups-ui:v9:gv
      =foreigns:v8:gv
      channel=channel-10
      =activity:v10:av
      pins=(list whom)
      chat=chat-2
      profile=?
      buckets=(list summary:b)
  ==
+$  init-9
  $:  groups=groups-ui:v9:gv
      =foreigns:v8:gv
      channel=channel-10
      =activity:v10:av
      pins=(list whom)
      chat=chat-2
      profile=?
  ==
+$  init-8
  $:  groups=groups-ui:v9:gv
      =foreigns:v8:gv
      channel=channel-10
      =activity:v9:av
      pins=(list whom)
      chat=chat-2
      profile=?
  ==
+$  init-7
  $:  groups=groups-ui:v9:gv
      =foreigns:v8:gv
      channel=channel-10
      =activity:v8:av
      pins=(list whom)
      chat=chat-2
      profile=?
  ==
+$  init-6
  $:  groups=groups-ui:v9:gv
      =foreigns:v8:gv
      channel=channel-8
      =activity:v8:av
      pins=(list whom)
      chat=chat-2
      profile=?
  ==
+$  init-5
  $:  groups=groups-ui:v7:gv
      =foreigns:v8:gv
      channel=channel-8
      =activity:v8:av
      pins=(list whom)
      chat=chat-2
      profile=?
  ==
+$  init-4
  $:  groups=groups-ui:v2:gv
      =gangs:v2:gv
      channel=channel-0
      =activity:v8:av
      pins=(list whom)
      chat=chat-2
      profile=?
  ==
+$  init-3
  $:  groups=groups-ui:v2:gv
      =gangs:v2:gv
      =channels:v1:dv
      =activity:v3:av
      pins=(list whom)
      chat=chat-1
      profile=?
  ==
+$  init-2
  $:  groups=groups-ui:v2:gv
      =gangs:v2:gv
      =channels:v1:dv
      activity=activity:v2:av
      pins=(list whom)
      chat=chat-1
      profile=?
  ==
::
+$  init-1
  $:  groups=groups-ui:v2:gv
      =gangs:v2:gv
      =channels:v1:dv
      =unreads:v7:dv
      pins=(list whom)
      chat=chat-0
      profile=?
  ==
::
+$  init-0
  $:  groups=groups-ui:v2:gv
      =gangs:v2:gv
      channels=channels:v1:dv
      =unreads:v7:dv
      pins=(list whom)
      chat=chat-0
      profile=?
  ==
::
+$  mixed-heads  [chan=channel-heads:v7:dv chat=chat-heads:v3:cv]
+$  mixed-heads-2  [chan=channel-heads:v8:dv chat=chat-heads:v5:cv]
+$  mixed-heads-3  [chan=channel-heads:v9:dv chat=chat-heads:v6:cv]
+$  mixed-heads-4  [chan=channel-heads:v10:dv chat=chat-heads:v7:cv]
+$  channel-10
  $:  =channels:v10:dv
      hidden-posts=(set id-post:dv)
  ==
+$  channel-8
  $:  =channels:v8:dv
      hidden-posts=(set id-post:dv)
  ==
+$  channel-0
  $:  =channels:v1:dv
      hidden-posts=(set id-post:dv)
  ==
+$  chat-2
  $:  dms=(set ship)
      invited=(set ship)
      clubs=(map id:club:v3:cv crew:club:v3:cv)
      blocked=(set ship)
      blocked-by=(set ship)
      hidden-messages=(set id:v3:cv)
  ==
+$  chat-1
  $:  clubs=(map id:club:v3:cv crew:club:v3:cv)
      dms=(set ship)
      invited=(set ship)
  ==
+$  chat-0
  $:  clubs=(map id:club:v3:cv crew:club:v3:cv)
      dms=(set ship)
      =unreads:v3:cv
      invited=(set ship)
      pins=(list whom:v3:cv)
  ==
::  $whom: ID for an "item"
::
+$  whom
  $%  [%group =flag:v0:gv]
      [%channel =nest:v0:gv]
      [%chat =whom:v3:cv]
  ==
::
+$  action
  $%  [%pins =a-pins]
  ==
+$  a-pins
  $%  [%add =whom]
      [%del =whom]
      [%set-order order=(list whom)]
  ==
::
+$  vita-enabled  ?
--

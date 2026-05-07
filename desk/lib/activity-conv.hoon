::  activity-conv: activity types conversions
::
/-  av=activity-ver
|%
++  v9
  |%
  ++  full-info
    |%
    ++  v8
      |=  fi=full-info:v9:av
      ^-  full-info:v8:av
      :*  (v8:indices indices.fi)
          (v8:activity activity.fi)
          (v8:volume-settings volume-settings.fi)
      ==
    --
  ++  indices
    |%
    ++  v8
      |=  =indices:v9:av
      ^-  indices:v8:av
      %-  ~(gas by *indices:v8:av)
      %+  turn  ~(tap by indices)
      |=  [=source:v9:av =index:v9:av]
      ^-  [source:v8:av index:v8:av]
      [`source:v8:av`source (v8:^index index)]
    --
  ++  index
    |%
    ++  v8
      |=  =index:v9:av
      ^-  index:v8:av
      [(v8:stream stream.index) reads.index bump.index]
    --
  ++  stream
    |%
    ++  v8
      |=  =stream:v9:av
      ^-  stream:v8:av
      %+  gas:on-event:v8:av
        *stream:v8:av
      (murn (tap:on-event:v9:av stream) v8:time-event)
    --
  ++  activity
    |%
    ++  v8
      |=  =activity:v9:av
      ^-  activity:v8:av
      %-  ~(gas by *activity:v8:av)
      %+  murn  ~(tap by activity)
      |=  [=source:v9:av =activity-summary:v9:av]
      ^-  (unit [source:v8:av activity-summary:v8:av])
      `[`source:v8:av`source (v8:^activity-summary activity-summary)]
    --
  ++  activity-summary
    |%
    ++  v8
      |=  =activity-summary:v9:av
      ^-  activity-summary:v8:av
      :*  newest.activity-summary
          count.activity-summary
          notify-count.activity-summary
          notify.activity-summary
          unread.activity-summary
        ::
          %-  ~(gas in *(set source:v8:av))
          %+  turn  ~(tap in children.activity-summary)
          |=(=source:v9:av `source:v8:av`source)
        ::
          reads.activity-summary
      ==
    --
  ++  volume-settings
    |%
    ++  v8
      |=  =volume-settings:v9:av
      ^-  volume-settings:v8:av
      %-  ~(gas by *volume-settings:v8:av)
      %+  turn  ~(tap by volume-settings)
      |=  [=source:v9:av =volume-map:v9:av]
      ^-  [source:v8:av volume-map:v8:av]
      [`source:v8:av`source (v8:^volume-map volume-map)]
    --
  ++  feed
    |%
    ++  v8
      |=  =feed:v9:av
      ^-  feed:v8:av
      :-  (murn feed.feed v8:activity-bundle)
      (v8:activity summaries.feed)
    --
  ++  activity-bundle
    |%
    ++  v8
      |=  =activity-bundle:v9:av
      ^-  (unit activity-bundle:v8:av)
      ?~  events=(murn events.activity-bundle v8:time-event)
        ~
      %-  some
      :*  `source:v8:av`source.activity-bundle
          latest.activity-bundle
          events
      ==
    --
  ++  feed-init
    |%
    ++  v8
      |=  =feed-init:v9:av
      ^-  feed-init:v8:av
      :*  (murn all.feed-init v8:activity-bundle)
          (murn mentions.feed-init v8:activity-bundle)
          (murn replies.feed-init v8:activity-bundle)
          (v8:activity summaries.feed-init)
      ==
    --
  ++  update
    |%
    ++  v8
      |=  =update:v9:av
      ^-  (unit update:v8:av)
      ?-    -.update
          %add
        ?~  ev=(v8:time-event +>.update)  ~
        `[%add source.update u.ev]
      ::
          %del
        `[%del source.update]
      ::
          %read
        `[%read source.update (v8:activity-summary activity-summary.update)]
      ::
          %activity
        `[%activity (v8:activity activity.update)]
      ::
          %adjust
        `[%adjust source.update (bind volume-map.update v8:volume-map)]
      ::
          %allow-notifications
        `[%allow-notifications allow.update]
      ==
    --
  ++  volume-map
    |%
    ++  v8
      |=  =volume-map:v9:av
      ^-  volume-map:v8:av
      %-  ~(gas by *volume-map:v8:av)
      %+  murn  ~(tap by volume-map)
      |=  [=event-type:v9:av =volume:v9:av]
      ^-  (unit [event-type:v8:av volume:v8:av])
      ?:  ?=(?(%react %dm-react) event-type)  ~
      `[`event-type:v8:av`event-type volume]
    --
  ++  time-event
    |%
    ++  v8
      |=  =time-event:v9:av
      ^-  (unit time-event:v8:av)
      ?:  ?=(?(%react %dm-react) -<.event.time-event)  ~
      `time-event
    --
  ++  event
    |%
    ++  v8
      |=  =event:v9:av
      ^-  (unit event:v8:av)
      ?:  ?=(?(%react %dm-react) -<.event)  ~
      `event
    --
  --
++  v8
  |%
  ++  source
    |%
    ++  v4
      |=  =source:v8:av
      ^-  (unit source:v4:av)
      ?:  ?=(?(%contact %react %dm-react) -.source)  ~
      `source
    --
  ++  stream
    |%
    ++  v4
      |=  =stream:v8:av
      ^-  (unit stream:v4:av)
      =/  out=stream:v4:av
        %+  gas:on-event:v4:av
          *stream:v4:av
        (murn (tap:on-event:v8:av stream) v4:time-event)
      %-  some
      out
    --
  ++  index
    |%
    ++  v4
      |=  =index:v8:av
      ^-  (unit index:v4:av)
      ?~  stm=(v4:stream stream.index)  ~
      `[u.stm reads.index bump.index]
    --
  ++  feed
    |%
    ++  v7
      |=  =feed:v8:av
      ^-  feed:v7:av
      :-  (murn feed.feed v7:activity-bundle)
      (v7:activity summaries.feed)
    ++  v4
      |=  =feed:v8:av
      ^-  feed:v4:av
      (murn feed.feed v4:activity-bundle)
    --
  ++  activity-bundle
    |%
    ++  v7
      |=  =activity-bundle:v8:av
      ^-  (unit activity-bundle:v7:av)
      ?:  ?=(?(%contact %react %dm-react) -.source.activity-bundle)  ~
      %-  some
      :*  source.activity-bundle
          latest.activity-bundle
          (murn events.activity-bundle v7:time-event)
      ==
    ++  v4
      |=  =activity-bundle:v8:av
      ^-  (unit activity-bundle:v4:av)
      ?:  ?=(?(%contact %react %dm-react) -.source.activity-bundle)  ~
      %-  some
      :*  source.activity-bundle
          latest.activity-bundle
          (murn events.activity-bundle v4:time-event)
      ==
    --
  ++  time-event
    |%
    ++  v7
      |=  =time-event:v8:av
      ^-  (unit time-event:v7:av)
      ?:  ?=(?(%contact %react %dm-react) -<.event.time-event)  ~
      `time-event
    ++  v4
      |=  =time-event:v8:av
      ^-  (unit time-event:v4:av)
      ?:  ?=(?(%contact %react %dm-react) -<.event.time-event)  ~
      `time-event
    ++  v3
      |=  =time-event:v8:av
      ^-  (unit time-event:v3:av)
      ?:  ?=(?(%contact %react %dm-react) -<.event.time-event)  ~
      `time-event
    ++  v2
      |=  =time-event:v8:av
      ^-  (unit time-event:v2:av)
      ?:  ?=(?(%contact %react %dm-react) -<.event.time-event)  ~
      `time-event
    --
  ++  activity
    |%
    ++  v7
      |=  =activity:v8:av
      ^-  activity:v7:av
      %-  ~(gas by *activity:v7:av)
      %+  murn  ~(tap by activity)
      |=  [=source:v8:av as=activity-summary:v8:av]
      ^-  (unit [source:v7:av activity-summary:v7:av])
      ?:  ?=(?(%contact %react %dm-react) -.source)  ~
      :+  ~
        source
      (v7:activity-summary as activity)
    ++  v4
      |=  =activity:v8:av
      ^-  activity:v4:av
      %-  ~(gas by *activity:v4:av)
      %+  murn  ~(tap by activity)
      |=  [=source:v8:av as=activity-summary:v8:av]
      ^-  (unit [source:v4:av activity-summary:v4:av])
      ?:  ?=(?(%contact %react %dm-react) -.source)  ~
      :+  ~
        source
      (v4:activity-summary as activity)
    ++  v3
      |=  =activity:v8:av
      ^-  activity:v3:av
      %-  ~(gas by *activity:v3:av)
      %+  murn  ~(tap by activity)
      |=  [=source:v8:av as=activity-summary:v8:av]
      ^-  (unit [source:v3:av activity-summary:v3:av])
      ?:  ?=(?(%contact %react %dm-react) -.source)  ~
      :+  ~
        source
      (v3:activity-summary as activity)
    ++  v2
      |=  =activity:v8:av
      ^-  activity:v2:av
      %-  ~(gas by *activity:v2:av)
      %+  murn  ~(tap by activity)
      |=  [=source:v8:av as=activity-summary:v8:av]
      ^-  (unit [source:v2:av activity-summary:v2:av])
      ?:  ?=(?(%contact %react %dm-react) -.source)  ~
      :+  ~
        source
      (v2:activity-summary as activity)
    --
  ++  activity-summary
    |%
    ++  v7
      |=  [as=activity-summary:v8:av =activity:v8:av]
      ^-  activity-summary:v7:av
      :*  newest.as
          count.as
          notify-count.as
          notify.as
          unread.as
        ::
          ?:  =(~ children.as)  ~
          ^-  (set source:v7:av)
          %-  ~(gas in *(set source:v7:av))
          ^-  (list source:v7:av)
          %+  murn  ~(tap in children.as)
          |=  =source:v8:av
          ?:(?=(?(%contact %react %dm-react) -.source) ~ `source)
        ::
          ~
      ==
    ++  v4
      |=  [as=activity-summary:v8:av =activity:v8:av]
      ^-  activity-summary:v4:av
      :*  newest.as
          count.as
          notify-count.as
          notify.as
          unread.as
        ::
          ?:  =(~ children.as)  ~
          ^-  (set source:v4:av)
          %-  ~(gas in *(set source:v4:av))
          ^-  (list source:v4:av)
          %+  murn  ~(tap in children.as)
          |=  =source:v8:av
          ?:(?=(?(%contact %react %dm-react) -.source) ~ `source)
        ::
          [*@da ~]
      ==
    ++  v3
      |=  [as=activity-summary:v8:av =activity:v8:av]
      ^-  activity-summary:v3:av
      :*  newest.as
          count.as
          notify-count.as
          notify.as
          unread.as
        ::
          ?:  =(~ children.as)  ~
          :-  ~
          %-  ~(gas by *activity:v3:av)
          %+  murn
            ~(tap in children.as)
          |=  =source:v8:av
          ?:  ?=(?(%contact %react %dm-react) -.source)  ~
          =/  sum  (~(got by activity) source)
          :+  ~
            source
          (v3:activity-summary sum(children ~) ~)
        ::
          [*@da ~]
      ==
    ++  v2
      |=  [as=activity-summary:v8:av =activity:v8:av]
      ^-  activity-summary:v2:av
      :*  newest.as
          count.as
          notify.as
          unread.as
        ::
          :-  ~
          %-  ~(gas by *activity:v2:av)
          %+  murn
            ~(tap in children.as)
          |=  =source:v8:av
          ?:  ?=(?(%contact %react %dm-react) -.source)  ~
          =/  sum  (~(got by activity) source)
          :+  ~
            source
          (v2:activity-summary sum(children ~) ~)
      ==
    --
  ++  indices
    |%
    ++  v4
      |=  =indices:v8:av
      ^-  indices:v4:av
      %-  ~(gas by *indices:v4:av)
      %+  murn  ~(tap by indices)
      |=  [=source:v8:av =index:v8:av]
      ^-  (unit [source:v4:av index:v4:av])
      ?~  src=(v4:^source source)  ~
      ?~  idx=(v4:^index index)  ~
      `[u.src u.idx]
    --
  ++  volume-settings
    |%
    ++  v4
      |=  =volume-settings:v8:av
      ^-  volume-settings:v4:av
      %-  ~(gas by *volume-settings:v4:av)
      %+  murn  ~(tap by volume-settings)
      |=  [=source:v8:av vm0=volume-map:v8:av]
      ^-  (unit [source:v4:av volume-map:v4:av])
      ?~  src=(v4:^source source)  ~
      ?~  vm=(v4:volume-map vm0)  ~
      `[u.src u.vm]
    --
  ++  update
    |%
    ++  v3
      |=  [=update:v8:av =activity:v8:av]
      ^-  (unit update:v3:av)
      ?-    -.update
          %add
        ?:  ?=(?(%contact %react %dm-react) -.source.update)  ~
        ?~  ev=(v3:time-event +>.update)  ~
        `[%add source.update u.ev]
      ::
          %del
        ?:  ?=(?(%contact %react %dm-react) -.source.update)  ~
        `[%del source.update]
      ::
          %read
        ?:  ?=(?(%contact %react %dm-react) -.source.update)  ~
        `[%read source.update (v3:activity-summary activity-summary.update activity)]
      ::
        %activity  !!
      ::
          %adjust
        ?:  ?=(?(%contact %react %dm-react) -.source.update)  ~
        `[%adjust source.update (bind volume-map.update v3:volume-map)]
      ::
          %allow-notifications
        `[%allow-notifications allow.update]
      ==
    ++  v2
      |=  [=update:v8:av =activity:v8:av]
      ^-  (unit update:v2:av)
      ?-    -.update
          %add
        ?:  ?=(?(%contact %react %dm-react) -.source.update)  ~
        ?~  ev=(v2:time-event +>.update)  ~
        `[%add source.update u.ev]
      ::
          %del
        ?:  ?=(?(%contact %react %dm-react) -.source.update)  ~
        `[%del source.update]
      ::
          %read
        ?:  ?=(?(%contact %react %dm-react) -.source.update)  ~
        `[%read source.update (v2:activity-summary activity-summary.update activity)]
      ::
        %activity  !!
      ::
          %adjust
        ?:  ?=(?(%contact %react %dm-react) -.source.update)  ~
        `[%adjust source.update (bind volume-map.update v2:volume-map)]
      ::
          %allow-notifications
        `[%allow-notifications allow.update]
      ==
    --
  ++  volume-map
    |%
    ++  v4
      |=  =volume-map:v8:av
      ^-  (unit volume-map:v4:av)
      %-  some
      %-  ~(gas by *volume-map:v4:av)
      %+  murn  ~(tap by volume-map)
      |=  [=event-type:v8:av =volume:v8:av]
      ^-  (unit [event-type:v4:av volume:v4:av])
      ?:  ?=(?(%contact %react %dm-react) event-type)  ~
      `[event-type volume]
    ++  v3
      |=  =volume-map:v8:av
      ^-  volume-map:v3:av
      %-  ~(gas by *volume-map:v3:av)
      %+  murn  ~(tap by volume-map)
      |=  [=event-type:v8:av =volume:v8:av]
      ^-  (unit [event-type:v3:av volume:v3:av])
      ?:  ?=(?(%contact %react %dm-react) event-type)  ~
      %-  some
      [event-type volume]
    ++  v2
      |=  =volume-map:v8:av
      ^-  volume-map:v2:av
      %-  ~(gas by *volume-map:v2:av)
      %+  murn  ~(tap by volume-map)
      |=  [=event-type:v8:av =volume:v8:av]
      ^-  (unit [event-type:v2:av volume:v2:av])
      ?:  ?=(?(%contact %react %dm-react) event-type)  ~
      %-  some
      [event-type volume]
    --
  --
--

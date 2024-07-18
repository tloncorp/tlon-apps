/-  a=activity
|%
++  src
  |%
  ++  get-parents
    |=  =source:a
    ^-  (list source:a)
    ?:  ?=(%base -.source)  ~
    ?<  ?=(%base -.source)
    =-  (snoc - [%base ~])
    ^-  (list source:a)
    ?+  -.source  ~
      %channel  ~[[%group group.source]]
      %dm-thread  ~[[%dm whom.source]]
    ::
        %thread
      :~  [%channel channel.source group.source]
          [%group group.source]
      ==
    ==
  ::
  ++  get-children  ::  direct children only
    |=  [=indices:a =source:a]
    ^-  (list source:a)
    ?:  ?=(?(%thread %dm-thread) -.source)  ~
    %+  skim
      ~(tap in ~(key by indices))
    |=  src=source:a
    ?-  -.source
        %base     ?=(?(%group %dm) -.src)
        %group    &(?=(%channel -.src) =(flag.source group.src))
        %channel  &(?=(%thread -.src) =(nest.source channel.src))
        %dm       &(?=(%dm-thread -.src) =(whom.source whom.src))
    ==
  ::
  ++  get-order
    |=  =source:a
    %.  -.source
    %~  got  by
    ^~
    %-  my
    :~  [%thread 6]
        [%dm-thread 5]
        [%channel 4]
        [%group 3]
        [%dm 2]
        [%base 1]
    ==
  ++  get-volumes
    |=  [vs=volume-settings:a =source:a]
    ^-  volume-map:a
    =/  target  (~(get by vs) source)
    ?^  target  u.target
    ?-  -.source
      %base       *volume-map:a
      %group      (get-volumes vs %base ~)
      %dm         (get-volumes vs %base ~)
      %dm-thread  (get-volumes vs %dm whom.source)
      %channel    (get-volumes vs %group group.source)
      %thread     (get-volumes vs %channel channel.source group.source)
    ==
  ::
  ++  sort-sources
    |=  sources=(list source:a)
    ::  sort children first in order so we only have to make one pass
    ::  of summarization aka not repeatedly updating the same source
    ::
    %+  sort
      sources
    |=  [asrc=source:a bsrc=source:a]
    (gth (get-order:src asrc) (get-order:src bsrc))
  ::
  --
++  stm
  |%
  ++  get-reads
    |=  [=stream:a start=(unit time) end=(unit time) ignore-children=?]
    %+  murn
      %-  tap:on-event:a
      %^  lot:on-event:a  stream
        ?~(start ~ `(sub u.start 1))
      ?~(end ~ `(add u.end 1))
    |=  [=time =event:a]
    ::  ignore child events if enabled
    ?:  &(ignore-children child.event)  ~
    `[time ~]
  ::
  --
++  idx
  |_  =index:a
  ++  find-floor
    |=  [orig=stream:a =reads:a]
    ^-  (unit time)
    ::  starting at the last-known first-unread location (floor), walk towards
    ::  the present, to find the new first-unread location (new floor)
    ::
    ::  slice off the earlier part of the stream, for efficiency
    ::
    =/  =stream:a  (lot:on-event:a orig `floor.reads ~)
    =|  new-floor=(unit time)
    |-
    ?~  stream  new-floor
    ::
    =/  [[=time =event:a] rest=stream:a]  (pop:on-event:a stream)
    =;  is-read=?
      ::  if we found something that's unread, we need look no further
      ::
      ?.  is-read  $(stream ~)
      ::  otherwise, continue our walk towards the present
      ::
      $(new-floor `time, stream rest)
    ::  treat all other events as read
    ?+  -<.event  &
        ?(%dm-post %dm-reply %post %reply)
      ?=(^ (get:on-read-items:a items.reads time))
    ==
  ::
  --
++  evt
  |%
  ++  source
    |=  event=incoming-event:a
    ^-  source:a
    ?-  -.event
      %chan-init      [%channel channel.event group.event]
      %post           [%channel channel.event group.event]
      %reply          [%thread parent.event channel.event group.event]
      %dm-invite          [%dm whom.event]
      %dm-post            [%dm whom.event]
      %dm-reply           [%dm-thread parent.event whom.event]
      %group-invite   [%group group.event]
      %group-kick     [%group group.event]
      %group-join     [%group group.event]
      %group-role     [%group group.event]
      %group-ask      [%group group.event]
      %flag-post      [%group group.event]
      %flag-reply     [%group group.event]
    ==
  ::
  ++  event-type
    |=  event=incoming-event:a
    ^-  event-type:a
    ?+  -.event  -.event
        %post      ?:(mention.event %post-mention %post)
        %reply     ?:(mention.event %reply-mention %reply)
        %dm-post   ?:(mention.event %dm-post-mention %dm-post)
        %dm-reply  ?:(mention.event %dm-reply-mention %dm-reply)
    ==
  ::
  ++  is-allowed
    |=  [allowed=notifications-allowed:a =incoming-event:a]
    ?:  ?=(%all allowed)  &
    ?:  ?=(%none allowed)  |
    =/  type  (event-type incoming-event)
    ?+  type  |
      %reply  &
      %dm-invite  &
      %dm-post    &
      %dm-reply   &
      %post-mention  &
      %reply-mention  &
      %dm-post-mention  &
      %dm-reply-mention  &
    ==
  ::
  ++  get-volume
    |=  [vs=volume-settings:a event=incoming-event:a]
    ^-  volume:a
    =/  source  (source:evt event)
    =/  loudness=volume-map:a  (get-volumes:src vs source)
    (~(gut by loudness) (event-type event) [unreads=& notify=|])
  ::
  --
::
++  convert-to
  |%
  ++  v3
    |%
    ++  activity
      |=  =activity:a
      ^-  activity:v3:old:a
      %-  ~(run by activity)
      |=  as=activity-summary:a
      (activity-summary as activity)
    ++  activity-summary
      |=  [as=activity-summary:a =activity:a]
      ^-  activity-summary:v3:old:a
      :*  newest.as
          count.as
          notify-count.as
          notify.as
          unread.as
        ::
          ?:  =(~ children.as)  ~
          :-  ~
          %-  ~(gas by *activity:v3:old:a)
          %+  turn
            ~(tap in children.as)
          |=  =source:a
          =/  sum  (~(got by activity) source)
          :-  source
          (activity-summary sum(children ~) ~)
        ::
          [*@da ~]
      ==
    ++  update
      |=  [=update:a =activity:a]
      ^-  update:v3:old:a
      ?+  -.update  update
          %activity  !!
          %read
        [%read source.update (activity-summary activity-summary.update activity)]
      ==
    --
  ++  v2
    |%
    ++  activity
      |=  =activity:a
      ^-  activity:v2:old:a
      %-  ~(run by activity)
      |=  as=activity-summary:a
      (activity-summary as activity)
    ++  activity-summary
      |=  [as=activity-summary:a =activity:a]
      ^-  activity-summary:v2:old:a
      :*  newest.as
          count.as
          notify.as
          unread.as
        ::
          :-  ~
          %-  ~(gas by *activity:v2:old:a)
          %+  turn
            ~(tap in children.as)
          |=  =source:a
          =/  sum  (~(got by activity) source)
          :-  source
          (activity-summary sum(children ~) ~)
      ==
    ++  update
      |=  [=update:a =activity:a]
      ^-  update:v2:old:a
      ?+  -.update  update
          %activity  !!
          %read
        [%read source.update (activity-summary activity-summary.update activity)]
      ==
    --
  --
--
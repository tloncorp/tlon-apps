/-  c=channels, t=contacts, ch=chat, g=groups, gv=groups-ver, s=story
/+  mp=mop-extensions
|%
+|  %collections
::  $stream: the activity stream comprised of events from various agents
+$  stream  ((mop time event) lte)
++  on-stream  ((on time event) lte)
::  $indices: the stream and its read data split into various indices
+$  indices
  $~  [[[%base ~] *index] ~ ~]
  (map source index)
::  $volume-settings: the volume settings for each source
+$  volume-settings  (map source volume-map)
::  $activity: the current state of activity for each source
+$  activity  (map source activity-summary)
::  $full-info: the full state of the activity stream
+$  full-info  [=indices =activity =volume-settings]
::  $volume-map: how to badge and notify for each event type
+$  volume-map
  $~  default-volumes
  (map event-type volume)
::  $feed: a set of grouped events and the summaries of their sources
+$  feed
  $:  feed=(list activity-bundle)
      summaries=activity
  ==
+$  feed-init
  $:  all=(list activity-bundle)
      mentions=(list activity-bundle)
      replies=(list activity-bundle)
      summaries=activity
  ==
+|  %actions
::  $action: how to interact with our activity stream
::
::    actions are only ever performed for and by our selves
::
::    %add: add an event to the stream
::    %bump: mark a source as having new activity from myself
::    %clear-group-invites: clear all group invites
::    %del: remove a source and all its activity
::    %read: mark an event as read
::    %adjust: adjust the volume of an source
::    %allow-notifications: change which notifications are allowed
::
+$  action
  $%  [%add =incoming-event]
      [%bump =source]
      [%clear-group-invites ~]
      [%del =source]
      [%del-event =source event=incoming-event]
      [%read =source =read-action]
      [%adjust =source =(unit volume-map)]
      [%allow-notifications allow=notifications-allowed]
  ==
::
::  $read-action: mark activity read
::
::    %item: (DEPRECATED) mark an individual activity as read, indexed by id
::    %event: (DEPRECATED) mark an individual activity as read, indexed by the event itself
::    %all: mark _everything_ as read for this source, and possibly children
::
+$  read-action
  $%  [%item id=time-id]
      [%event event=incoming-event]
      [%all time=(unit time) deep=?]
  ==
::
+|  %updates
::
::  $update: what we hear after an action
::
::    %add: an event was added to the stream
::    %del: a source and its activity were removed
::    %read: a source's activity state was updated
::    %activity: the activity state was updated
::    %adjust: the volume of a source was adjusted
::    %allow-notifications: the allowed notifications were changed
::
+$  update
  $%  [%add =source time-event]
      [%del =source]
      [%read =source =activity-summary]
      [%activity =activity]
      [%adjust =source volume-map=(unit volume-map)]
      [%allow-notifications allow=notifications-allowed]
  ==
::
+|  %basics
::  $event: a single point of activity, from one of our sources
::
::    $incoming-event: the event that was sent to us
::    .notified: if this event has been notified
::    .child: if this event is from a child source
::
+$  event
  $:  incoming-event
      notified=?
      child=?
  ==
+$  incoming-event
  $%  [%post post-event]
      [%reply reply-event]
      [%dm-invite =whom]
      [%dm-post dm-post-event]
      [%dm-reply dm-reply-event]
      [%group-ask group=flag:g =ship]
      [%group-kick group=flag:g =ship]
      [%group-join group=flag:g =ship]
      [%group-invite group=flag:g =ship]
      [%chan-init channel=nest:c group=flag:g]
      [%group-role group=flag:g =ship roles=(set sect:v0:gv)]
      [%flag-post key=message-key channel=nest:c group=flag:g]
      [%flag-reply key=message-key parent=message-key channel=nest:c group=flag:g]
      [%contact contact-event]
  ==
::
+$  post-event
  $:  key=message-key
      channel=nest:c
      group=flag:g
      content=story:s
      mention=?
  ==
::
+$  reply-event
  $:  key=message-key
      parent=message-key
      channel=nest:c
      group=flag:g
      content=story:s
      mention=?
  ==
::
+$  dm-post-event
  $:  key=message-key
      =whom
      content=story:s
      mention=?
  ==
::
+$  dm-reply-event
  $:  key=message-key
      parent=message-key
      =whom
      content=story:s
      mention=?
  ==
+$  contact-event
  $:  who=ship
      update=(pair @tas value:t)
  ==
::
::  $source: where the activity is happening
+$  source
  $%  [%base ~]
      [%group =flag:g]
      [%channel =nest:c group=flag:g]
      [%thread key=message-key channel=nest:c group=flag:g]
      [%dm =whom]
      [%dm-thread key=message-key =whom]
      [%contact who=ship]
  ==
::
::  $index: the stream of activity and read state for a source
+$  index  [=stream =reads bump=time]
::
::  $reads: the read state for a source
::
::    $floor: the time of the latest event that was read
::    $items: the set of events above the floor that have been read
::
+$  reads
  $:  floor=time
      items=read-items
  ==
+$  read-items  ((mop time-id ,~) lte)
::  $activity-summary: the summary of activity for a source
::
::    $newest: the time of the latest activity read or unread
::    $count: the total number of unread events including children
::    $notify-count: the number of unreads that are notifications
::                   including children
::    $notify: if there are any notifications here or in children
::    $unread: if the main stream of source is unread: which starting
::             message, how many there are, and if any are notifications
::    $children: the sources nested under this source
::
+$  activity-summary
  $~  [*@da 0 0 | ~ ~ ~]
  $:  newest=time
      count=@ud
      notify-count=@ud
      notify=_|
      unread=(unit unread-point)
      children=(set source)
      reads=*  ::  DO NOT USE, 🚨 ⚠️ REMOVE
  ==
+$  unread-point  [message-key count=@ud notify=_|]
+$  volume  [unreads=? notify=?]
+$  notifications-allowed  ?(%all %some %none)
+$  activity-bundle
  $:  =source
      latest=time
      events=(list time-event)
  ==
::
+|  %primitives
+$  whom
  $%  [%ship p=ship]
      [%club p=id:club:ch]
  ==
+$  time-id  time
+$  message-id   (pair ship time-id)
+$  message-key  [id=message-id =time]
::
+$  event-type
  $?  %chan-init
      %post
      %post-mention
      %reply
      %reply-mention
      %dm-invite
      %dm-post
      %dm-post-mention
      %dm-reply
      %dm-reply-mention
      %group-invite
      %group-kick
      %group-join
      %group-ask
      %group-role
      %flag-post
      %flag-reply
      %contact
  ==
+|  %helpers
+$  time-event  [=time =event]
++  on-event        ((on time event) lte)
++  ex-event        ((mp time event) lte)
++  on-read-items   ((on time ,~) lte)
+|  %constants
++  default-volumes
  ^~
  ^-  (map event-type volume)
  %-  my
  :~  [%post & &]
      [%reply & |]
      [%dm-reply & &]
      [%post-mention & &]
      [%reply-mention & &]
      [%dm-invite & &]
      [%dm-post & &]
      [%dm-post-mention & &]
      [%dm-reply-mention & &]
      [%group-invite & &]
      [%group-ask & &]
      [%flag-post & &]
      [%flag-reply & &]
      [%group-kick & |]
      [%group-join & |]
      [%group-role & |]
      [%contact | |]
  ==
++  old-volumes
  ^~
  %-  my
  :~  [%soft (~(put by default-volumes) %post [& |])]
      [%loud (~(run by default-volumes) |=([u=? *] [u &]))]
      [%hush (~(run by default-volumes) |=([u=? *] [u |]))]
  ==
++  mute
  ^~
  (~(run by default-volumes) |=(* [| |]))
::
+|  %old-types
++  old
  |%
  ++  v7
    |%
    +$  stream  ((mop time event) lte)
    +$  event
      $:  incoming-event
          notified=?
          child=?
      ==
    +$  incoming-event
      $%  [%post post-event]
          [%reply reply-event]
          [%dm-invite =whom]
          [%dm-post dm-post-event]
          [%dm-reply dm-reply-event]
          [%group-ask group=flag:g =ship]
          [%group-kick group=flag:g =ship]
          [%group-join group=flag:g =ship]
          [%group-invite group=flag:g =ship]
          [%chan-init channel=nest:c group=flag:g]
          [%group-role group=flag:g =ship roles=(set role-id:g)]
          [%flag-post key=message-key channel=nest:c group=flag:g]
          [%flag-reply key=message-key parent=message-key channel=nest:c group=flag:g]
      ==
    +$  source
      $%  [%base ~]
          [%group =flag:g]
          [%channel =nest:c group=flag:g]
          [%thread key=message-key channel=nest:c group=flag:g]
          [%dm =whom]
          [%dm-thread key=message-key =whom]
      ==
    +$  index  [=stream =reads bump=time]
    --
  ++  v4
    |%
    +$  feed  (list activity-bundle)
    --
  ++  v3
    |%
    +$  index  [=stream =reads]
    +$  indices  (map source index)
    +$  update
      $%  [%add =source time-event]
          [%del =source]
          [%read =source =activity-summary]
          [%adjust =source volume-map=(unit volume-map)]
          [%allow-notifications allow=notifications-allowed]
      ==
    +$  full-info
      $:  =indices
          =activity
          =volume-settings
      ==
    +$  activity  (map source activity-summary)
    +$  activity-summary
      $~  [*@da 0 0 | ~ ~ [*@da ~]]
      $:  newest=time
          count=@ud
          notify-count=@ud
          notify=_|
          unread=(unit unread-point)
          children=(unit activity)
          =reads
      ==
    --
  ++  v2
    |%
    +$  update
      $%  [%add =source time-event]
          [%del =source]
          [%read =source =activity-summary]
          [%adjust =source volume-map=(unit volume-map)]
          [%allow-notifications allow=notifications-allowed]
      ==
    +$  full-info
      $:  =indices:v3
          activity=activity
          =volume-settings
      ==
    +$  activity  (map source activity-summary)
    +$  activity-summary
      $~  [*@da 0 | ~ ~]
      $:  newest=time
          count=@ud
          notify=_|
          unread=(unit unread-point)
          children=(unit activity)
      ==
    --
  --
--

/-  a=activity, gv=groups-ver, c=chat, d=channels, dv=channels-ver, t=contacts, s=story
/+  mp=mop-extensions
|%
::
::  common
::
+$  whom
  $%  [%ship p=ship]
      [%club p=id:club:c]
  ==
+$  time-id  time
+$  message-id   (pair ship time-id)
+$  message-key  [id=message-id =time]
::  |v9: add reactions activity
++  v9
  =,  v8
  |%
  ::  $stream: depends on $event
  +$  stream  ((mop time event) lte)
  ::  $on-stream: depends on $event
  ++  on-stream  ((on time event) lte)
  ::  $indices: depends on $source and $index
  +$  indices
    $~  [[[%base ~] *index] ~ ~]
    (map source index)
  ::  $volume-settings: depends on $source and $volume-map
  +$  volume-settings  (map source volume-map)
  ::  $full-info: depends on $indices, $activity, $volume-settings
  +$  full-info  [=indices =activity =volume-settings]
  ::  $volume-map: depends on $event-type
  +$  volume-map
    $~  default-volumes
    (map event-type volume)
  ::  $feed: depends on $activity and $activity-bundle
  +$  feed
    $:  feed=(list activity-bundle)
        summaries=activity
    ==
  ::  $feed-init: depends on $activity-bundle and $activity
  +$  feed-init
    $:  all=(list activity-bundle)
        mentions=(list activity-bundle)
        replies=(list activity-bundle)
        summaries=activity
    ==
  ::  $action: depends on $incoming-event, $source, $read-action and $volume-map
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
  ::  $read-action: depends on $incoming-event
  +$  read-action
    $%  [%item id=time-id]
        [%event event=incoming-event]
        [%all time=(unit time) deep=?]
    ==
  ::  $update: depends on $source, $activity-summary, $activity,
  ::           $volume-map and $notifications-allowed
  +$  update
    $%  [%add =source time-event]
        [%del =source]
        [%read =source =activity-summary]
        [%activity =activity]
        [%adjust =source volume-map=(unit volume-map)]
        [%allow-notifications allow=notifications-allowed]
    ==
  ::  $event: depends on $incoming-event
  +$  event
    $:  incoming-event
        notified=?
        child=?
    ==
  ::  $incoming-event: add %react and %dm-react variants
  ::
  +$  incoming-event
    $%  [%post post-event]
        [%reply reply-event]
        [%react react-event]
        [%dm-invite =whom]
        [%dm-post dm-post-event]
        [%dm-reply dm-reply-event]
        [%dm-react dm-react-event]
        [%group-ask group=flag:gv =ship]
        [%group-kick group=flag:gv =ship]
        [%group-join group=flag:gv =ship]
        [%group-invite group=flag:gv =ship]
        [%chan-init channel=nest:dv group=flag:gv]
        [%group-role group=flag:gv =ship roles=(set sect:v0:gv)]
        [%flag-post key=message-key channel=nest:dv group=flag:gv]
        [%flag-reply key=message-key parent=message-key channel=nest:dv group=flag:gv]
        [%contact contact-event]
    ==
  ::
  +$  react-event
    $:  key=message-key
        parent=(unit message-key)  :: post or reply
        channel=nest:dv
        group=flag:gv
        =author:v10:dv
        =react:v10:dv
    ==
  ::
  +$  dm-react-event
    $:  key=message-key
        parent=(unit message-key)  ::  either dm or dm-reply
        =whom
        =react:c
    ==
  ::  $index: depends on $stream
  +$  index  [=stream =reads bump=time]
  ::  $activity-bundle: depends on $source
  +$  activity-bundle
    $:  =source
        latest=time
        events=(list time-event)
    ==
  ::  $event-type: add %react and %dm-react
  ::
  +$  event-type
    $?  %chan-init
        %post
        %post-mention
        %reply
        %reply-mention
        %react
        %dm-invite
        %dm-post
        %dm-post-mention
        %dm-reply
        %dm-reply-mention
        %dm-react
        %group-invite
        %group-kick
        %group-join
        %group-ask
        %group-role
        %flag-post
        %flag-reply
        %contact
    ==
  ::  $time-event: depends on $event
  +$  time-event  [=time =event]
  ::  $on-event: depends on $event
  ++  on-event        ((on time event) lte)
  ::  $ex-event: depends on $event
  ++  ex-event        ((mp time event) lte)
  ::  $default-volumes: add %react and %dm-react
  ::
  ++  default-volumes
    ^~
    ^-  (map event-type volume)
    %-  my
    :~  [%post & &]
        [%reply & |]
        [%react & |]
        [%post-mention & &]
        [%reply-mention & &]
        [%dm-invite & &]
        [%dm-post & &]
        [%dm-post-mention & &]
        [%dm-reply & &]
        [%dm-reply-mention & &]
        [%dm-react & &]
        [%group-invite & &]
        [%group-ask & &]
        [%flag-post & &]
        [%flag-reply & &]
        [%group-kick & |]
        [%group-join & |]
        [%group-role & |]
        [%contact | |]
    ==
  --
::  |v8: add %contact event
++  v8
  =,  v7
  |%
  ::  $stream: depends on $event
  +$  stream  ((mop time event) lte)
  ::  $on-stream: depends on $event
  ++  on-stream  ((on time event) lte)
  ::  $indices: depends on $source and $index
  +$  indices
    $~  [[[%base ~] *index] ~ ~]
    (map source index)
  ::  $volume-settings: depends on $source and $volume-map
  +$  volume-settings  (map source volume-map)
  ::  $activity: depends on $source and $activity-summary
  +$  activity  (map source activity-summary)
  ::  $full-info: depends on $indices, $activity, $volume-settings
  +$  full-info  [=indices =activity =volume-settings]
  ::  $volume-map: depends on $event-type
  +$  volume-map
    $~  default-volumes
    (map event-type volume)
  ::  $feed: depends on $activity and $activity-bundle
  +$  feed
    $:  feed=(list activity-bundle)
        summaries=activity
    ==
  ::  $feed-init: depends on $activity-bundle and $activity
  +$  feed-init
    $:  all=(list activity-bundle)
        mentions=(list activity-bundle)
        replies=(list activity-bundle)
        summaries=activity
    ==
  ::  $action: depends on $incoming-event, $source, $read-action and $volume-map
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
  ::  $read-action: depends on $incoming-event
  +$  read-action
    $%  [%item id=time-id]
        [%event event=incoming-event]
        [%all time=(unit time) deep=?]
    ==
  ::  $update: depends on $source, $activity-summary, $activity,
  ::           $volume-map and $notifications-allowed
  +$  update
    $%  [%add =source time-event]
        [%del =source]
        [%read =source =activity-summary]
        [%activity =activity]
        [%adjust =source volume-map=(unit volume-map)]
        [%allow-notifications allow=notifications-allowed]
    ==
  ::  $event: depends on $incoming-event
  +$  event
    $:  incoming-event
        notified=?
        child=?
    ==
  ::  $incoming-event: add %contact variant
  ::
  +$  incoming-event
    $%  [%post post-event]
        [%reply reply-event]
        [%dm-invite =whom]
        [%dm-post dm-post-event]
        [%dm-reply dm-reply-event]
        [%group-ask group=flag:gv =ship]
        [%group-kick group=flag:gv =ship]
        [%group-join group=flag:gv =ship]
        [%group-invite group=flag:gv =ship]
        [%chan-init channel=nest:dv group=flag:gv]
        [%group-role group=flag:gv =ship roles=(set sect:v0:gv)]
        [%flag-post key=message-key channel=nest:dv group=flag:gv]
        [%flag-reply key=message-key parent=message-key channel=nest:dv group=flag:gv]
        [%contact contact-event]
    ==
  ::  $contact-event: contact status update
  ::
  +$  contact-event
    $:  who=ship
        update=(pair @tas value:t)
    ==
  ::  $source: add %contact variant
  ::
  +$  source
    $%  [%base ~]
        [%group =flag:gv]
        [%channel =nest:dv group=flag:gv]
        [%thread key=message-key channel=nest:dv group=flag:gv]
        [%dm =whom]
        [%dm-thread key=message-key =whom]
        [%contact who=ship]
    ==
  ::  $index: depends on $stream
  +$  index  [=stream =reads bump=time]
  ::  $activity-summary: depends on $source
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
  ::  $activity-bundle: depends on $source
  +$  activity-bundle
    $:  =source
        latest=time
        events=(list time-event)
    ==
  ::  $event-type: add %contact
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
  ::  $time-event: depends on $event
  +$  time-event  [=time =event]
  ::  $on-event: depends on $event
  ++  on-event        ((on time event) lte)
  ::  $ex-event: depends on $event
  ++  ex-event        ((mp time event) lte)
  ::  $default-volumes: add %contact
  ::
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
  --
++  v7
  |%
  +$  stream  ((mop time event) lte)
  ++  on-stream  ((on time event) lte)
  +$  indices
    $~  [[[%base ~] *index] ~ ~]
    (map source index)
  +$  volume-settings  (map source volume-map)
  +$  activity  (map source activity-summary)
  +$  full-info  [=indices =activity =volume-settings]
  +$  volume-map
    $~  default-volumes
    (map event-type volume)
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
  +$  read-action
    $%  [%item id=time-id]
        [%event event=incoming-event]
        [%all time=(unit time) deep=?]
    ==
  +$  update
    $%  [%add =source time-event]
        [%del =source]
        [%read =source =activity-summary]
        [%activity =activity]
        [%adjust =source volume-map=(unit volume-map)]
        [%allow-notifications allow=notifications-allowed]
    ==
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
        [%group-ask group=flag:gv =ship]
        [%group-kick group=flag:gv =ship]
        [%group-join group=flag:gv =ship]
        [%group-invite group=flag:gv =ship]
        [%chan-init channel=nest:dv group=flag:gv]
        [%group-role group=flag:gv =ship roles=(set role-id:gv)]
        [%flag-post key=message-key channel=nest:dv group=flag:gv]
        [%flag-reply key=message-key parent=message-key channel=nest:dv group=flag:gv]
    ==
  +$  post-event
    $:  key=message-key
        channel=nest:dv
        group=flag:gv
        content=story:s
        mention=?
    ==
  +$  reply-event
    $:  key=message-key
        parent=message-key
        channel=nest:dv
        group=flag:gv
        content=story:s
        mention=?
    ==
  +$  dm-post-event
    $:  key=message-key
        =whom
        content=story:s
        mention=?
    ==
  +$  dm-reply-event
    $:  key=message-key
        parent=message-key
        =whom
        content=story:s
        mention=?
    ==
  +$  source
    $%  [%base ~]
        [%group =flag:gv]
        [%channel =nest:dv group=flag:gv]
        [%thread key=message-key channel=nest:dv group=flag:gv]
        [%dm =whom]
        [%dm-thread key=message-key =whom]
    ==
  +$  index  [=stream =reads bump=time]
  +$  reads
    $:  floor=time
        items=read-items
    ==
  +$  read-items  ((mop time-id ,~) lte)
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
    ==
  +$  time-event  [=time =event]
  ++  on-event        ((on time event) lte)
  ++  ex-event        ((mp time event) lte)
  ++  on-read-items   ((on time ,~) lte)
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
    ==
  ++  mute
    ^~
    (~(run by default-volumes) |=(* [| |]))
  --
++  v6  v5
++  v5  v4
++  v4
  =,  v3
  |%
  +$  index  [=stream =reads bump=time]
  +$  indices  (map source index)
  +$  activity  (map source activity-summary)
  +$  full-info  [=indices =activity =volume-settings]
  +$  update
    $%  [%add =source time-event]
        [%del =source]
        [%read =source =activity-summary]
        [%activity =activity]
        [%adjust =source volume-map=(unit volume-map)]
        [%allow-notifications allow=notifications-allowed]
    ==
  +$  activity-summary
    $~  [*@da 0 0 | ~ ~ [*@da ~]]
    $:  newest=time
        count=@ud
        notify-count=@ud
        notify=_|
        unread=(unit unread-point)
        children=(set source)
        =reads
    ==
  --
++  v3
  =,  v2
  |%
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
  +$  index  [=stream =reads]
  +$  stream  ((mop time event) lte)
  +$  indices  (map source index)
  +$  activity  (map source activity-summary)
  +$  full-info
    $:  =indices
        activity=activity
        =volume-settings
    ==
  +$  volume-map
    $~  default-volumes
    (map event-type volume)
  +$  feed  (list activity-bundle)
  +$  volume-settings  (map source volume-map)
  +$  action
    $%  [%add =incoming-event]
        [%bump =source]
        [%del =source]
        [%read =source =read-action]
        [%adjust =source =(unit volume-map)]
        [%allow-notifications allow=notifications-allowed]
    ==
  +$  read-action
    $%  [%item id=time-id]
        [%event event=incoming-event]
        [%all time=(unit time) deep=?]
    ==
  +$  update
    $%  [%add =source time-event]
        [%del =source]
        [%read =source =activity-summary]
        [%adjust =source volume-map=(unit volume-map)]
        [%allow-notifications allow=notifications-allowed]
    ==
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
        [%group-ask group=flag:gv =ship]
        [%group-kick group=flag:gv =ship]
        [%group-join group=flag:gv =ship]
        [%group-invite group=flag:gv =ship]
        [%chan-init channel=nest:dv group=flag:gv]
        [%group-role group=flag:gv =ship roles=(set sect:gv)]
        [%flag-post key=message-key channel=nest:dv group=flag:gv]
        [%flag-reply key=message-key parent=message-key channel=nest:dv group=flag:gv]
    ==
  +$  post-event
    $:  key=message-key
        channel=nest:dv
        group=flag:gv
        content=story:s
        mention=?
    ==
  +$  reply-event
    $:  key=message-key
        parent=message-key
        channel=nest:dv
        group=flag:gv
        content=story:s
        mention=?
    ==
  +$  dm-post-event
    $:  key=message-key
        =whom
        content=story:s
        mention=?
    ==
  +$  dm-reply-event
    $:  key=message-key
        parent=message-key
        =whom
        content=story:s
        mention=?
    ==
  +$  source
    $%  [%base ~]
        [%group =flag:gv]
        [%channel =nest:dv group=flag:gv]
        [%thread key=message-key channel=nest:dv group=flag:gv]
        [%dm =whom]
        [%dm-thread key=message-key =whom]
    ==
  +$  reads
    $:  floor=time
        items=read-items
    ==
  +$  read-items  ((mop time-id ,~) lte)
  +$  activity-summary
    $~  [*@da 0 | ~ ~]
    $:  newest=time
        count=@ud
        notify=_|
        unread=(unit unread-point)
        children=(unit activity)
    ==
  +$  unread-point  [message-key count=@ud notify=_|]
  +$  volume  [unreads=? notify=?]
  +$  notifications-allowed  ?(%all %some %none)
  +$  activity-bundle
    $:  =source
        latest=time
        events=(list time-event)
    ==
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
    ==
  +$  time-event  [=time =event]
  ++  on-event        ((on time event) lte)
  ++  ex-event        ((mp time event) lte)
  ++  on-read-items   ((on time ,~) lte)
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
    ==
  --
--

::
/-  a=activity, c=channels, ch=chat, g=groups
/+  default-agent, verb, dbug, ch-utils=channel-utils, v=volume
::
=>
  |%
  +$  card  card:agent:gall
  ::
  +$  versioned-state
    $%  state-1
    ==
  ::
  +$  state-1
    [%1 =indices:a =activity:a =volume-settings:a]
  --
::
=|  state-1
=*  state  -
::
::NOTE  setting this to true causes some parts of state & update management to
::      take shortcuts, which we want to do during initial migration/import.
::      shouldn't be set to true outside of calls to +migrate.
=/  importing=?  |
::
%-  agent:dbug
%+  verb  |
^-  agent:gall
::
=<
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %|) bowl)
      cor   ~(. +> [bowl ~])
  ::
  ++  on-init
    =^  cards  state
      abet:init:cor
    [cards this]
  ::
  ++  on-save  !>(state)
  ::
  ++  on-load
    |=  =vase
    ^-  (quip card _this)
    =^  cards  state
      abet:(load:cor vase)
    [cards this]
  ::
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state
      abet:(poke:cor mark vase)
    [cards this]
  ::
  ++  on-watch
    |=  =path
    ^-  (quip card _this)
    =^  cards  state
      abet:(watch:cor path)
    [cards this]
  ::
  ++  on-arvo    on-arvo:def
  ++  on-agent   on-agent:def
  ++  on-peek    peek:cor
  ++  on-leave   on-leave:def
  ++  on-fail    on-fail:def
  --
|_  [=bowl:gall cards=(list card)]
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  from-self  =(our src):bowl
::
++  init
  ^+  cor
  (emit %pass /migrate %agent [our.bowl dap.bowl] %poke noun+!>(%migrate))
::
++  migrate
  =.  importing  &
  =.  indices   (~(put by indices) [%base ~] [*stream:a *reads:a])
  =.  cor  set-chat-reads
  =+  .^(=channels:c %gx (welp channels-prefix /v2/channels/full/noun))
  =.  cor  (set-volumes channels)
  =.  cor  (set-channel-reads channels)
  =.  cor  refresh-all-summaries
  cor(importing |)
::
++  load
  |=  =vase
  ^+  cor
  ?:  ?=([%0 *] q.vase)  init
  =+  !<(old=versioned-state vase)
  ?>  ?=(%1 -.old)
  =.  state  old
  cor
::
++  groups-prefix  /(scot %p our.bowl)/groups/(scot %da now.bowl)
++  channels-prefix  /(scot %p our.bowl)/channels/(scot %da now.bowl)
++  set-channel-reads
  |=  =channels:c
  ^+  cor
  =+  .^(=unreads:c %gx (welp channels-prefix /v1/unreads/noun))
  =/  entries  ~(tap by unreads)
  =;  events=(list [time incoming-event:a])
    |-
    ?~  events  cor
    =.  cor  (%*(. add start-time -.i.events) +.i.events)
    $(events t.events)
  |-  ^-  (list [time incoming-event:a])
  ?~  entries  ~
  =/  head  i.entries
  =*  next  $(entries t.entries)
  =/  [=nest:c =unread:c]  head
  =/  channel  (~(get by channels) nest)
  ?~  channel  next
  =/  group  group.perm.u.channel
  =;  events=(list [time incoming-event:a])
    (weld events next)
  =/  posts=(list [time incoming-event:a])
    ?~  unread.unread  ~
    %+  murn
      (tab:on-posts:c posts.u.channel `(sub id.u.unread.unread 1) count.u.unread.unread)
    |=  [=time post=(unit post:c)]
    ?~  post  ~
    =/  key=message-key:a
      :_  time
      [author.u.post time]
    =/  mention
      (was-mentioned:ch-utils content.u.post our.bowl)
    `[time %post key nest group content.u.post mention]
  =/  replies=(list [time incoming-event:a])
    %-  zing
    %+  murn
      ~(tap by threads.unread)
    |=  [=id-post:c [id=id-reply:c count=@ud]]
    ^-  (unit (list [time incoming-event:a]))
    =/  post=(unit (unit post:c))  (get:on-posts:c posts.u.channel id-post)
    ?~  post  ~
    ?~  u.post  ~
    %-  some
    %+  turn
      (tab:on-replies:c replies.u.u.post `(sub id 1) count)
    |=  [=time =reply:c]
    =/  key=message-key:a
      :_  time
      [author.reply time]
    =/  parent=message-key:a
      :_  id-post
      [author.u.u.post id-post]
    =/  mention
      (was-mentioned:ch-utils content.reply our.bowl)
    [time %reply key parent nest group content.reply mention]
  =/  init-time
    ?:  &(=(posts ~) =(replies ~))  recency.unread
    *@da
  :-  [init-time %chan-init nest group]
  (welp posts replies)
++  chat-prefix  /(scot %p our.bowl)/chat/(scot %da now.bowl)
++  set-chat-reads
  ^+  cor
  =+  .^(=unreads:ch %gx (welp chat-prefix /unreads/noun))
  =+  .^  [dms=(map ship dm:ch) clubs=(map id:club:ch club:ch)]
      %gx  (welp chat-prefix /full/noun)
    ==
  =/  entries  ~(tap by unreads)
  =;  events=(list [time incoming-event:a])
    |-
    ?~  events  cor
    =.  cor  (%*(. add start-time -.i.events) +.i.events)
    $(events t.events)
  |-  ^-  (list [time incoming-event:a])
  ?~  entries  ~
  =/  head  i.entries
  =*  next  $(entries t.entries)
  =/  [=whom:ch =unread:unreads:ch]  head
  =/  =pact:ch
    ?-  -.whom
      %ship  pact:(~(gut by dms) p.whom *dm:ch)
      %club  pact:(~(gut by clubs) p.whom *club:ch)
    ==
  =;  events=(list [time incoming-event:a])
    (weld events next)
  =/  writs=(list [time incoming-event:a])
    ?~  unread.unread  ~
    %+  murn
      (tab:on:writs:ch wit.pact `(sub time.u.unread.unread 1) count.u.unread.unread)
    |=  [=time =writ:ch]
    =/  key=message-key:a  [id.writ time]
    =/  mention
      (was-mentioned:ch-utils content.writ our.bowl)
    `[time %dm-post key whom content.writ mention]
  =/  replies=(list [time incoming-event:a])
    %-  zing
    %+  murn
      ~(tap by threads.unread)
    |=  [parent=message-key:ch [key=message-key:ch count=@ud]]
    ^-  (unit (list [time incoming-event:a]))
    =/  writ=(unit writ:ch)  (get:on:writs:ch wit.pact time.parent)
    ?~  writ  ~
    %-  some
    %+  turn
      (tab:on:replies:ch replies.u.writ `(sub time.key 1) count)
    |=  [=time =reply:ch]
    =/  mention
      (was-mentioned:ch-utils content.reply our.bowl)
    [time %dm-reply key parent whom content.reply mention]
  =/  init-time
    ?:  &(=(writs ~) =(replies ~))  recency.unread
    *@da
  :-  [init-time %dm-invite whom]
  (welp writs replies)
++  set-volumes
  |=  =channels:c
  ::  set all existing channels to old default since new default is different
  =.  cor
    =/  entries  ~(tap by channels)
    |-
    ?~  entries  cor
    =/  [=nest:c =channel:c]  i.entries
    =.  cor
      %+  adjust  [%channel nest group.perm.channel]
      `(my [%post & |] ~)
    $(entries t.entries)
  =+  .^(=volume:v %gx (welp groups-prefix /volume/all/noun))
  ::  set any overrides from previous volume settings
  =.  cor  (adjust [%base ~] `(~(got by old-volumes:a) base.volume))
  =.  cor
    =/  entries  ~(tap by chan.volume)
    |-
    ?~  entries  cor
    =/  [=nest:g =level:v]  i.entries
    ?.  ?=(?(%chat %diary %heap) -.nest)  $(entries t.entries)
    =/  channel  (~(get by channels) nest)
    ?~  channel  $(entries t.entries)
    =.  cor
      %+  adjust  [%channel nest group.perm.u.channel]
      `(~(got by old-volumes:a) level)
    $(entries t.entries)
  =/  entries  ~(tap by area.volume)
  |-
  ?~  entries  cor
  =*  head  i.entries
  =.  cor
    %+  adjust  [%group -.head]
    `(~(got by old-volumes:a) +.head)
  $(entries t.entries)
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+  mark  ~|(bad-poke+mark !!)
      %noun
    ?+  q.vase  ~|(bad-poke+mark !!)
        %migrate
      =.  state  *state-1
      migrate
    ==
  ::
      %activity-action
    =+  !<(=action:a vase)
    ?-  -.action
      %add     (add +.action)
      %del     (del +.action)
      %read    (read +.action)
      %adjust  (adjust +.action)
    ==
  ==
::
++  watch
  |=  =(pole knot)
  ^+  cor
  ?+  pole  ~|(bad-watch-path+pole !!)
    ~  ?>(from-self cor)
    [%notifications ~]  ?>(from-self cor)
    [%unreads ~]  ?>(from-self cor)
  ==
::
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+  pole  [~ ~]
      [%x ~]
    ``activity-full+!>([indices activity volume-settings])
  ::
  ::  /all: unified feed (equality of opportunity)
  ::
      [%x %all ~]
    ``activity-stream+!>(stream:base)
  ::
      [%x %all start=@ count=@ ~]
    =-  ``activity-stream+!>((gas:on-event:a *stream:a -))
    (tab:on-event:a stream:base `(slav %da start.pole) (slav %ud count.pole))
  ::
  ::  /each: unified feed (equality of outcome)
  ::TODO  want to be able to filter for specific events kind too, but that will
  ::      suffer from the "search range" "problem", where we want .count to
  ::      mean entries trawled, not entries returned...
  ::
      [%x %each start=@ count=@ ~]
    =;  =stream:a
      ``activity-stream+!>(-)
    =/  start  (slav %da start.pole)
    =/  count  (slav %ud count.pole)
    %-  ~(rep by indices)
    |=  [[=source:a =stream:a =reads:a] out=stream:a]
    ^+  out
    (gas:on-event:a out (tab:on-event:a stream `start count))
  ::
  ::  /indexed: per-index
  ::
      [%x %indexed concern=?([%channel nk=kind:c:a ns=@ nt=@ gs=@ gt=@ rest=*] [%dm whom=@ rest=*])]
    =/  =source:a
      ?-  -.concern.pole
          %dm
        :-  %dm
        ?^  ship=(slaw %p whom.concern.pole)
          [%ship u.ship]
        [%club (slav %uv whom.concern.pole)]
      ::
          %channel
        =,  concern.pole
        [%channel [nk (slav %p ns) nt] [(slav %p gs) gt]]
      ==
    =/  rest=(^pole knot)
      ?-  -.concern.pole
        %dm       rest.concern.pole
        %channel  rest.concern.pole
      ==
    ?~  dice=(~(get by indices) source)  [~ ~]
    ?+  rest  ~
        ~
      ``activity-stream+!>(stream.u.dice)
    ::
        [start=@ count=@ ~]
      =/  start  (slav %da start.rest)
      =/  count  (slav %ud count.rest)
      =/  ls  (tab:on-event:a stream.u.dice `start count)
      ``activity-stream+!>((gas:on-event:a *stream:a ls))
    ==
  ::  /event: individual events
  ::
      [%u %event id=@ ~]
    ``loob+!>((has:on-event:a stream:base (slav %da id.pole)))
  ::
      [%x %event id=@ ~]
    ``activity-event+!>([id.pole (got:on-event:a stream:base (slav %da id.pole))])
  ::
      [%x %activity ~]
    ``activity-summary+!>(activity)
  ::
      [%x %volume-settings ~]
    ``activity-settings+!>(volume-settings)
  ==
::
++  base
  ^-  index:a
  (~(got by indices) [%base ~])
++  add
  =/  start-time=time  now.bowl
  |=  inc=incoming-event:a
  ^+  cor
  =/  =time-id:a
    =/  t  start-time
    |-
    ?.  (has:on-event:a stream:base t)  t
    $(t +(t))
  =/  notify  &(!importing notify:(get-volume inc))
  =/  =event:a  [inc notify |]
  =?  cor  !importing
    (give %fact ~[/] activity-update+!>([%add time-id event]))
  =?  cor  notify
    (give %fact ~[/notifications] activity-event+!>([time-id event]))
  =.  indices
    =/  =stream:a  (put:on-event:a stream:base time-id event)
    (~(put by indices) [%base ~] [stream reads:base])
  =/  =source:a  (determine-source inc)
  ?+  -<.event  (add-to-index source time-id event)
      %chan-init
    =/  group-src  [%group group.event]
    =.  cor  (add-to-index source time-id event)
    (add-to-index group-src time-id event(child &))
  ::
      %dm-reply
    =/  parent-src  [%dm whom.event]
    =.  cor  (add-to-index source time-id event)
    (add-to-index parent-src time-id event(child &))
  ::
      %post
    =/  parent-src  [%group group.event]
    =.  cor  (add-to-index source time-id event)
    (add-to-index parent-src time-id event(child &))
  ::
      %reply
    =/  chan-src  [%channel channel.event group.event]
    =/  group-src  [%group group.event]
    =.  cor  (add-to-index source time-id event)
    =.  cor  (add-to-index chan-src time-id event(child &))
    (add-to-index group-src time-id event(child &))
  ==
::
++  del
  |=  =source:a
  ^+  cor
  =.  indices  (~(del by indices) source)
  =.  volume-settings  (~(del by volume-settings) source)
  ::  TODO: send notification removals?
  (give %fact ~[/] activity-update+!>([%del source]))
++  add-to-index
  |=  [=source:a =time-id:a =event:a]
  ^+  cor
  =/  =index:a  (~(gut by indices) source *index:a)
  =/  new=_stream.index
    (put:on-event:a stream.index time-id event)
  (update-index source index(stream new) |)
++  update-index
  |=  [=source:a new=index:a new-floor=?]
  =?  new  new-floor
    (update-floor new)
  =.  indices
    (~(put by indices) source new)
  ?:  importing  cor  ::NOTE  deferred until end of migration
  (refresh-summary source)
::
++  refresh-all-summaries
  ^+  cor
  =/  sources  ~(tap in ~(key by indices))
  |-
  ?~  sources  cor
  =.  cor  (refresh-summary i.sources)
  $(sources t.sources)
::
++  refresh-summary
  |=  =source:a
  =/  summary  (summarize-unreads source (get-index source))
  =.  activity
    (~(put by activity) source summary)
  (give-unreads source)
++  get-volumes
  |=  =source:a
  ^-  volume-map:a
  =/  target  (~(get by volume-settings) source)
  ?^  target  u.target
  ?-  -.source
    %base       *volume-map:a
    %group      (get-volumes %base ~)
    %dm         (get-volumes %base ~)
    %dm-thread  (get-volumes %dm whom.source)
    %channel    (get-volumes %group group.source)
    %thread     (get-volumes %channel channel.source group.source)
  ==
++  get-volume
  |=  event=incoming-event:a
  ^-  volume:a
  =/  source  (determine-source event)
  =/  loudness=volume-map:a  (get-volumes source)
  (~(gut by loudness) (determine-event-type event) [unreads=& notify=|])
++  determine-source
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
++  determine-event-type
  |=  event=incoming-event:a
  ^-  event-type:a
  ?+  -.event  -.event
      %post      ?:(mention.event %post-mention %post)
      %reply     ?:(mention.event %reply-mention %reply)
      %dm-post   ?:(mention.event %dm-post-mention %dm-post)
      %dm-reply  ?:(mention.event %dm-reply-mention %dm-reply)
  ==
::
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
++  update-floor
  |=  =index:a
  ^-  index:a
  =/  new-floor=(unit time)  (find-floor index)
  ?~  new-floor  index
  index(floor.reads u.new-floor)
::
++  read
  |=  [=source:a action=read-action:a]
  ^+  cor
  %+  update-reads  source
  ?-  -.action
      %event
    |=  =index:a
    ?>  ?=(%event -.action)
    =/  events
      %+  murn
        (tap:on-event:a stream.index)
      |=  [=time =event:a]
      ?.  =(-.event event.action)  ~
      `[time event]
    ?~  events  index
    =-  index(items.reads -)
    %+  put:on-read-items:a  items.reads.index
    [-<.events ~]
  ::
      %item
    |=  =index:a
    =-  index(items.reads -)
    %+  put:on-read-items:a  items.reads.index
    [id.action ~]
  ::
      %all
    |=  =index:a
    =/  latest=(unit [=time event:a])
    ::REVIEW  is this taking the item from the correct end? lol
      (ram:on-event:a stream.index)
    index(reads [?~(latest now.bowl time.u.latest) ~])
  ==
::
++  get-index
  |=  =source:a
  (~(gut by indices) source *index:a)
++  update-reads
  |=  [=source:a updater=$-(index:a index:a)]
  ^+  cor
  =/  new  (updater (get-index source))
  =.  cor  (update-index source new &)
  ?+  -.source  cor
    %channel  (refresh-summary [%group group.source])
    %dm-thread  (refresh-summary [%dm whom.source])
  ::
      %thread
    =.  cor  (refresh-summary [%channel channel.source group.source])
    (refresh-summary [%group group.source])
  ==
++  give-unreads
  |=  =source:a
  ^+  cor
  =/  summary  (~(got by activity) source)
  (give %fact ~[/ /unreads] activity-update+!>(`update:a`[%read source summary]))
::
++  adjust
  |=  [=source:a volume-map=(unit volume-map:a)]
  ^+  cor
  =.  cor  (give %fact ~[/] activity-update+!>([%adjust source volume-map]))
  ?~  volume-map
    cor(volume-settings (~(del by volume-settings) source))
  =/  target  (~(gut by volume-settings) source *volume-map:a)
  =.  volume-settings
    (~(put by volume-settings) source (~(uni by target) u.volume-map))
  ::  recalculate activity summary with new settings
  =.  activity
    %+  ~(put by activity)  source
    (summarize-unreads source (~(gut by indices) source *index:a))
  (give-unreads source)
::
++  get-children
  |=  =source:a
  ^-  (list source:a)
  %+  skim
    ~(tap in ~(key by indices))
  |=  src=source:a
  ?+  -.source  |
      %base  ?!(?=(%base -.src))
      %group  &(?=(%channel -.src) =(flag.source group.src))
      %channel  &(?=(%thread -.src) =(nest.source channel.src))
      %dm  &(?=(%dm-thread -.src) =(whom.source whom.src))
  ==
++  summarize-unreads
  |=  [=source:a index:a]
  ^-  activity-summary:a
  =.  stream  (lot:on-event:a stream `floor.reads ~)
  =/  read-items  items.reads
  ::  for each item in reads
  ::  omit:
  ::    if we don't have unreads enabled for that event
  ::    any items that are unread for some reason
  ::  then remove the post or reply from the event stream
  ::  and call stream-to-unreads
  ::
  ::  TODO: flip around and iterate over stream once, cleaning reads out
  ::        and segment replies for unread threads tracking
  |-
  =;  unread-stream=stream:a
    =/  children  (get-children source)
    (stream-to-unreads unread-stream floor.reads children source)
  %+  gas:on-event:a  *stream:a
  %+  murn
    (tap:on-event:a stream)
  |=  [=time =event:a]
  ?:  (has:on-read-items:a items.reads time)  ~
  ?:  child.event  ~
  `[time event]
++  stream-to-unreads
  |=  [=stream:a floor=time children=(list source:a) =source:a]
  ^-  activity-summary:a
  =/  cs=activity-summary:a
    %+  roll
      children
    |=  [=source:a sum=activity-summary:a]
    =/  =index:a  (~(gut by indices) source *index:a)
    =/  as=activity-summary:a
      (~(gut by activity) source (summarize-unreads source index))
    %=  sum
      count  (^add count.sum count.as)
      notify  |(notify.sum notify.as)
      newest  ?:((gth newest.as newest.sum) newest.as newest.sum)
    ==
  =/  newest=time  ?:((gth newest.cs floor) newest.cs floor)
  =/  total  count.cs
  =/  main  0
  =/  notified=?  notify.cs
  =/  main-notified=?  |
  =|  last=(unit message-key:a)
  ::  for each event
  ::  update count and newest
  ::  if reply, update thread state
  |-
  ?~  stream
    [newest total notified ?~(last ~ `[u.last main main-notified]) children]
  =/  [[=time =event:a] rest=stream:a]  (pop:on-event:a stream)
  =/  volume  (get-volume -.event)
  =?  notified  &(notify.volume notified.event)  &
  =.  newest  time
  ?.  ?&  unreads.volume
          ::TODO  support other event types
          ?=(?(%dm-post %dm-reply %post %reply) -<.event)
      ==
    $(stream rest)
  =.  total  +(total)
  =.  main   +(main)
  =?  main-notified  &(notify:volume notified.event)  &
  =.  last
    ?~  last  `key.event
    last
  $(stream rest)
--

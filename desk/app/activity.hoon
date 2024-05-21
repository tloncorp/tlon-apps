::
/-  a=activity, c=channels
/+  default-agent, verb, dbug, ch-utils=channel-utils
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
  =.  indices   (~(put by indices) [%base ~] [*stream:a *reads:a])
  set-channel-reads
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
++  channels-prefix  /(scot %p our.bowl)/channels/(scot %da now.bowl)/v2
++  set-channel-reads
  ^+  cor
  =+  .^(=unreads:c %gx (welp channels-prefix /unreads/noun))
  =+  .^(=channels:c %gx (welp channels-prefix /channels/full/noun))
  =/  entries  ~(tap by unreads)
  =;  events=(list incoming-event:a)
    |-
    ?~  events  cor
    =.  cor  (%*(. add should-notify |) i.events)
    $(events t.events)
  |-
  ^-  (list incoming-event:a)
  ?~  entries  ~
  =/  head  i.entries
  =*  next  $(entries t.entries)
  =/  [=nest:c =unread:c]  head
  =/  channel  (~(get by channels) nest)
  ?~  channel  next
  =/  group  group.perm.u.channel
  =;  events=(list incoming-event:a)
    (weld events next)
  :-  [%chan-init nest group]
  ?~  unread.unread  ~
  =/  posts=(list incoming-event:a)
    %+  murn
      (tab:on-posts:c posts.u.channel `id.u.unread.unread count.u.unread.unread)
    |=  [=time post=(unit post:c)]
    ?~  post  ~
    =/  key=message-key:a
      :_  time
      [author.u.post sent.u.post]
    =/  mention
      (was-mentioned:ch-utils content.u.post our.bowl)
    `[%post key nest group content.u.post mention]
  =/  replies=(list incoming-event:a)
    %-  zing
    %+  murn
      ~(tap by threads.unread)
    |=  [=id-post:c [id=id-reply:c count=@ud]]
    ^-  (unit (list incoming-event:a))
    =/  post=(unit (unit post:c))  (~(get by posts.u.channel) id-post)
    ?~  post  ~
    ?~  u.post  ~
    %-  some
    ^-  (list incoming-event:a)
    %+  turn
      (tab:on-replies:c replies.u.u.post `id count)
    |=  [=time =reply:c]
    =/  key=message-key:a
      :_  time
      [author.reply sent.reply]
    =/  parent=message-key:a
      :_  id-post
      [author.u.u.post sent.u.u.post]
    =/  mention
      (was-mentioned:ch-utils content.reply our.bowl)
    [%reply key parent nest group content.reply mention]
  %+  sort
    (welp posts replies)
  |=  [a=incoming-event:a b=incoming-event:a]
  ::  REVIEW  is this the correct order?
  %+  gth
    ?+(-.a !! %post time.key.a, %reply time.key.a)
  ?+(-.b !! %post time.key.b, %reply time.key.b)
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+  mark  ~|(bad-poke+mark !!)
      %activity-action
    =+  !<(=action:a vase)
    ?-  -.action
      %add     (add +.action)
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
    ``activity-stream+!>((tap:on-event:a stream:base))
  ::
      [%x %all start=@ count=@ ~]
    =-  ``activity-stream+!>(-)
    (tab:on-event:a stream:base `(slav %da start.pole) (slav %ud count.pole))
  ::
  ::  /each: unified feed (equality of outcome)
  ::TODO  want to be able to filter for specific events kind too, but that will
  ::      suffer from the "search range" "problem", where we want .count to
  ::      mean entries trawled, not entries returned...
  ::
      [%x %each start=@ count=@ ~]
    =;  =stream:a
      ``activity-stream+!>((tap:on-event:a -))
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
      ``activity-stream+!>((tap:on-event:a stream.u.dice))
    ::
        [start=@ count=@ ~]
      =/  start  (slav %da start.rest)
      =/  count  (slav %ud count.rest)
      ``activity-stream+!>((tab:on-event:a stream.u.dice `start count))
    ==
  ::  /event: individual events
  ::
      [%u %event id=@ ~]
    ``loob+!>((has:on-event:a stream:base (slav %da id.pole)))
  ::
      [%x %event id=@ ~]
    ``activity-event+!>([id.pole (got:on-event:a stream:base (slav %da id.pole))])
  ::
      [%x %unreads ~]
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
  =/  should-notify=?  &
  |=  inc=incoming-event:a
  ^+  cor
  =/  =time-id:a
    =/  t  now.bowl
    |-
    ?.  (has:on-event:a stream:base t)  t
    $(t +(t))
  =/  notify  &(should-notify notify:(get-volume inc))
  =/  =event:a  [inc notify]
  =.  cor
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
    (add-to-index group-src time-id event)
  ::
      %dm-reply
    =/  parent-src  [%dm whom.event]
    =.  cor  (add-to-index source time-id event)
    (add-to-index parent-src time-id event)
  ::
      %post
    =/  parent-src  [%group group.event]
    =.  cor  (add-to-index source time-id event)
    (add-to-index parent-src time-id event)
  ::
      %reply
    =/  chan-src  [%channel channel.event group.event]
    =/  group-src  [%group group.event]
    =.  cor  (add-to-index source time-id event)
    =.  cor  (add-to-index chan-src time-id event)
    (add-to-index group-src time-id event)
  ==
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
    (update-floor source new)
  =.  indices
    (~(put by indices) source new)
  =.  activity
    %+  ~(put by activity)  source
    (summarize-unreads source new)
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
  |=  =source:a
  ^-  (unit time)
  ?.  (~(has by indices) source)  ~
  ::  starting at the last-known first-unread location (floor), walk towards
  ::  the present, to find the new first-unread location (new floor)
  ::
  =/  [orig=stream:a =reads:a]
    (~(got by indices) source)
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
  |=  [=source:a =index:a]
  ^-  index:a
  =/  new-floor=(unit time)  (find-floor source)
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
++  update-reads
  |=  [=source:a updater=$-(index:a index:a)]
  ^+  cor
  =/  sources=(list source:a)
    %+  welp  ~[source]
    ?+  -.source  ~
      %channel    ~[[%group group.source]]
      %dm-thread  ~[[%dm whom.source]]
    ::
        %thread
      :~  [%group group.source]
          [%channel channel.source group.source]
      ==
    ==
  |-
  ?~  sources  cor
  =/  [src=source:a rest=(list source:a)]  sources
  =/  indy  (~(gut by indices) src *index:a)
  =/  new  (updater indy)
  =.  cor  (update-index src new &)
  $(sources rest)
++  give-unreads
  |=  =source:a
  ^+  cor
  (give %fact ~[/ /unreads] activity-update+!>(`update:a`[%read source (~(got by activity) source)]))
::
++  adjust
  |=  [=source:a =volume-map:a]
  ^+  cor
  =/  target  (~(gut by volume-settings) source *volume-map:a)
  =.  volume-settings
    (~(put by volume-settings) source (~(uni by target) volume-map))
  cor
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
++  source-order
  |=  =source:a
  ^-  @ud
  =-  (~(got by -) -.source)
  %-  my
  :~  [%thread 6]
      [%channel 5]
      [%group 4]
      [%dm-thread 3]
      [%dm 2]
      [%base 1]
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
  ?~  read-items
    =/  children  (get-children source)
    (stream-to-unreads stream floor.reads children)
  =/  [[=time *] rest=read-items:a]  (pop:on-read-items:a read-items)
  %=  $
      read-items  rest
  ::
      stream
    =-  +.-
    %^  (dip:on-event:a @)  stream
      ~
    |=  [@ key=@da =event:a]
    ^-  [(unit event:a) ? @]
    ?:  =(time key)
      [~ | ~]
    [`event | ~]
  ==
++  stream-to-unreads
  |=  [=stream:a floor=time children=(list source:a)]
  ^-  activity-summary:a
  =/  newest=time  floor
  =/  cs=activity-summary:a
    %+  roll
      children
    |=  [=source:a sum=activity-summary:a]
    =/  =index:a  (~(gut by indices) source *index:a)
    =/  as=activity-summary:a
      (~(gut by activity) source (summarize-unreads source index))
    %=  sum
      count  (^add count.sum count.as)
      notify  &(notify.sum notify.as)
    ==
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
  =/  [[* =event:a] rest=stream:a]  (pop:on-event:a stream)
  =/  volume  (get-volume -.event)
  =?  notified  &(notify.volume notified.event)  &
  ?.  ?&  unreads.volume
          ::TODO  support other event types
          ?=(?(%dm-post %dm-reply %post %reply) -<.event)
      ==
    $(stream rest)
  =.  total  +(total)
  =?  main  ?=(?(%post %dm-post) -<.event)  +(main)
  =?  main-notified  &(?=(?(%post %dm-post) -<.event) notify:volume notified.event)  &
  =.  newest  time.key.event
  =.  last
    ?~  last  `key.event
    last
  $(stream rest)
--

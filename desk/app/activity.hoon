::
/-  a=activity, c=channels
/+  default-agent, verb, dbug
::
=>
  |%
  +$  card  card:agent:gall
  ::
  +$  versioned-state
    $%  state-0
    ==
  ::
  +$  state-0
    [%0 =indices:a =volume-settings:a]
  --
::
=|  state-0
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
  cor(indices (~(put by indices) [%base ~] [*stream:a *reads:a]))
::
++  load
  |=  =vase
  ^+  cor
  =+  !<(old=versioned-state vase)
  ?>  ?=(%0 -.old)
  =.  state  old
  cor
::
:: ++  channels-prefix  /(scot %p our.bowl)/channels/(scot %da now.bowl)/v1
:: ++  set-reads-from-old
::   =.  cor
::     =+  .^(=unreads:c %gx (welp channels-prefix /unreads/noun))
::     =+  .^(=channels:c %gx (welp channels-prefix /channels/noun))
::     =/  entries  ~(tap by unreads)
::     |-
::     =/  head  i.entries
::     =+  next  $(entries t.entries)
::     ?~  head  cor
::     =/  [=nest:c =unread:c]  head
::     =/  channel  (~(get by channels) nest)
::     ?^  unread.unread
::       ?~  channel  next
::       =/  path
::         ;:  welp
::           channels-prefix
::           /[kind.nest]/(scot %p ship.nest)/[name.nest]
::           /posts/post/(scot %ud id.u.unread.unread)/noun
::         ==
::       =+  .^(post=(unit post:c) %gx path)
::       ?~  post  next
::       =/  =post-concern:a
::         [[[author.u.post id.u.post] id.u.post] nest group.perm.channel]
::       =.  stream  (put:on-event:a *stream:a id.u.post [%post post-concern ~ |])
::       next
::     =/  path
::         ;:  welp
::           channels-prefix
::           /[kind.nest]/(scot %p ship.nest)/[name.nest]
::           /posts/newest/1/outline/noun
::         ==
::     =+  .^(=posts:c %gx path)
::     =/  entry=(unit [time post:c])  (ram:on-posts:c posts)
::     ?~  entry  next
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
    ``activity-full+!>([indices (~(urn by indices) summarize-unreads)])
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
    ``activity-unreads+!>((~(urn by indices) summarize-unreads))
  ::
      [%x %volume-settings ~]
    ``activity-settings+!>(volume-settings)
  ==
::
++  base
  ^-  index:a
  (~(got by indices) [%base ~])
++  add
  |=  inc=incoming-event:a
  ^+  cor
  =/  =time-id:a
    =/  t  now.bowl
    |-
    ?.  (has:on-event:a stream:base t)  t
    $(t +(t))
  =/  notify  notify:(get-volume inc)
  =/  =event:a  [inc notify]
  =.  cor
    (give %fact ~[/] activity-update+!>([%add time-id event]))
  =?  cor  notify
    (give %fact ~[/notifications] activity-event+!>([time-id event]))
  =.  indices
    =/  =stream:a  (put:on-event:a stream:base time-id event)
    (~(put by indices) [%base ~] [stream reads:base])
  =?  cor  =(%chan-init -<.event)
    =/  =source:a  (determine-index inc)
    (give-unreads source (~(gut by indices) source *index:a))
  ?+  -<.event  cor
      %dm-post
    =/  source  [%dm whom.event]
    (add-to-index source time-id event)
  ::
      %dm-reply
    =/  src  [%dm-thread parent.event whom.event]
    =/  parent-src  [%dm whom.event]
    =.  cor  (add-to-index src time-id event)
    (add-to-index parent-src time-id event)
  ::
      %post
    =/  source  [%channel channel.event group.event]
    =/  parent-src  [%group group.event]
    =.  cor  (add-to-index source time-id event)
    (add-to-index parent-src time-id event)
  ::
      %reply
    =/  source  [%thread parent.event channel.event group.event]
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
  (give-unreads source new)
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
  =/  source  (determine-index event)
  =/  loudness=volume-map:a  (get-volumes source)
  (~(gut by loudness) (determine-event-type event) [unreads=& notify=|])
++  determine-index
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
  |=  [=source:a index:a]
  ^+  cor
  (give %fact ~[/ /unreads] activity-update+!>(`update:a`[%read source (summarize-unreads source [stream reads])]))
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
      %base  &
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
  ?~  read-items
    (stream-to-unreads stream floor.reads (get-children source))
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
    =/  as  (summarize-unreads source index)
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

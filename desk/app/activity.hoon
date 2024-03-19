::
/-  a=activity
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
    [%0 =stream:a =indices:a =volume:a]
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
  cor
::
++  load
  |=  =vase
  ^+  cor
  =+  !<(old=versioned-state vase)
  ?>  ?=(%0 -.old)
  =.  state  old
  cor
::
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
    ``activity-full+!>([stream indices (~(run by indices) summarize-unreads)])
      [%x %all ~]
    ``activity-stream+!>((tap:on-event:a stream))
      [%x %all start=@ count=@ ~]
    =-  ``activity-stream+!>(-)
    (tab:on-event:a stream `(slav %da start.pole) (slav %ud count.pole))
      [%u %event id=@ ~]
    ``loob+!>((has:on-event:a stream (slav %da id.pole)))
      [%x %event id=@ ~]
    ``activity-event+!>([id.pole (got:on-event:a stream (slav %da id.pole))])
      [%x %unreads ~]
    ``activity-unreads+!>((~(run by indices) summarize-unreads))
  ==
::
++  add
  |=  =event:a
  ^+  cor
  =/  =time-id:a
    =/  t  now.bowl
    |-
    ?.  (has:on-event:a stream t)  t
    $(t +(t))
  =.  cor
    (give %fact ~[/] activity-event+!>([time-id event]))
  =?  cor  (notifiable event)
    (give %fact ~[/notifications] activity-event+!>([time-id event]))
  =.  stream
    (put:on-event:a stream time-id event)
  ?+  -.event  cor
      %dm-post
    =/  index  [%dm whom.event]
    =?  indices  !(~(has by indices) index)
      (~(put by indices) index [*stream:a *reads:a])
    =/  indy  (~(got by indices) index)
    =/  new
      :*  (put:on-event:a stream.indy time-id event)
          floor.reads.indy
          %^  put:on-parent:a  event-parents.reads.indy
            time-id
          [| time-id]
      ==
    =.  indices
      (~(put by indices) index new)
    cor
      %dm-reply
    =/  index  [%dm whom.event]
    =?  indices  !(~(has by indices) index)
      (~(put by indices) index *[stream:a reads:a])
    =/  indy  (~(got by indices) index)
    =/  new
      :-  (put:on-event:a stream.indy time-id event)
      reads.indy
    =.  indices
      (~(put by indices) index new)
    cor
      %post
    =/  index  [%channel channel.event group.event]
    =?  indices  !(~(has by indices) index)
      (~(put by indices) index *[stream:a reads:a])
    =/  indy  (~(got by indices) index)
    =/  new
      :*  (put:on-event:a stream.indy time-id event)
          floor.reads.indy
          %^  put:on-parent:a  event-parents.reads.indy
            time-id
          [| time-id]
      ==
    =.  indices
      (~(put by indices) index new)
    cor
      %reply
    =/  index  [%channel channel.event group.event]
    =?  indices  !(~(has by indices) index)
      (~(put by indices) index *[stream:a reads:a])
    =/  indy  (~(got by indices) index)
    =/  new
      :-  (put:on-event:a stream.indy time-id event)
      reads.indy
    =.  indices
      (~(put by indices) index new)
    cor
  ==
++  loudness
  ^-  (map flavor:a flavor-level:a)
  %-  malt
  ^-  (list [flavor:a flavor-level:a])
  :~  [%dm-invite %notify]
      [%dm-post %notify]
      [%dm-post-mention %notify]
      [%dm-reply %notify]
      [%dm-reply-mention %notify]
      [%kick %default]
      [%join %default]
      [%post %default]
      [%post-mention %notify]
      [%reply %notify]
      [%reply-mention %notify]
      [%flag %default]
  ==
++  notifiable
  |=  =event:a
  ^-  ?
  =/  index  (determine-index event)
  =/  =index-level:a
    ?~  index  %soft
    (~(gut by volume) u.index %soft)
  ?-  index-level
      %loud  &
      %hush  |
      %soft
    .=  %notify
    (~(gut by loudness) (determine-flavor event) %default)
  ==
++  determine-index
  |=  =event:a
  ^-  (unit index:a)
  ?+  -.event  ~
    %post      `[%channel channel.event group.event]
    %reply     `[%channel channel.event group.event]
    %dm-post   `[%dm whom.event]
    %dm-reply  `[%dm whom.event]
  ==
++  determine-flavor
  |=  =event:a
  ^-  flavor:a
  ?+  -.event  -.event
      %post      ?:(mention.event %post-mention %post)
      %reply     ?:(mention.event %reply-mention %reply)
      %dm-post   ?:(mention.event %dm-post-mention %dm-post)
      %dm-reply  ?:(mention.event %dm-reply-mention %dm-reply)
  ==
::
++  find-floor
  |=  [=index:a mode=$%([%all ~] [%reply parent=time-id:a])]
  ^-  (unit time)
  ?.  (~(has by indices) index)  ~
  ::  starting at the last-known first-unread location (floor), walk towards
  ::  the present, to find the new first-unread location (new floor)
  ::
  =/  [orig=stream:a =reads:a]
    (~(got by indices) index)
  ?>  |(?=(%all -.mode) (has:on-parent:a event-parents.reads parent.mode))
  ::  slice off the earlier part of the stream, for efficiency
  ::
  =/  =stream:a
    =;  beginning=time
      (lot:on-event:a orig `beginning ~)
    ?-  -.mode
        %all    floor.reads
        %reply  reply-floor:(got:on-parent:a event-parents.reads parent.mode)
    ==
  =|  new-floor=(unit time)
  |-
  ?~  stream  new-floor
  ::
  =/  [[=time =event:a] rest=stream:a]  (pop:on-event:a stream)
  ?:  ?&  ?=(%reply -.mode)
      ?|  !?=(%reply -.event)
          ?&(?=(?(%dm-post %post) -.event) =(message-key.event parent.mode))
      ==  ==
    ::  we're in reply mode, and it's not a reply event, or a reply to
    ::  something else, so, skip
    ::
    $(stream rest)
  =;  is-read=?
    ::  if we found something that's unread, we need look no further
    ::
    ?.  is-read  $(stream ~)
    ::  otherwise, continue our walk towards the present
    ::
    $(new-floor `time, stream rest)
  ?+  -.event  !!
      ?(%dm-post %post)
    =*  id=time-id:a  q.id.message-key.event
    =/  par=(unit event-parent:a)  (get:on-parent:a event-parents.reads id)
    ?~(par | seen.u.par)
  ::
      %reply
    =*  id=time-id:a  q.id.message-key.event
    =/  par=(unit event-parent:a)  (get:on-parent:a event-parents.reads id)
    ?~(par | (gte time reply-floor.u.par))
  ==
::
++  update-floor
  |=  =index:a
  ^+  cor
  =/  new-floor=(unit time)  (find-floor index %all ~)
  =?  indices  ?=(^ new-floor)
    %+  ~(jab by indices)  index
    |=  [=stream:a =reads:a]
    [stream reads(floor u.new-floor)]
  cor
::
++  read
  |=  [=index:a action=read-action:a]
  ^+  cor
  ?-  -.action
      %thread
    =/  indy  (~(get by indices) index)
    ?~  indy  cor
    =/  new
      =-  u.indy(event-parents.reads -)
      %+  put:on-parent:a  event-parents.reads.u.indy
      =;  new-reply-floor=(unit time)
        [id.action [& (fall new-reply-floor id.action)]]
      (find-floor index %reply id.action)
    =.  indices
      (~(put by indices) index new)
    =.  cor  (update-floor index)
    (give-unreads index new)
  ::
      %post
    =/  indy  (~(get by indices) index)
    ?~  indy  cor
    =/  old-event-parent  (get:on-parent:a event-parents.reads.u.indy id.action)
    ?~  old-event-parent  cor
    =/  new
      =-  u.indy(event-parents.reads -)
      %+  put:on-parent:a  event-parents.reads.u.indy
      [id.action u.old-event-parent(seen &)]
    =.  indices
      (~(put by indices) index new)
    =.  cor  (update-floor index)
    (give-unreads index new)
  ::
      %all
    =/  indy  (~(get by indices) index)
    ?~  indy  cor
    =/  new
      =/  latest=(unit [=time event:a])
        ::REVIEW  is this taking the item from the correct end? lol
        (ram:on-event:a stream.u.indy)
      ?~  latest  u.indy
      u.indy(reads [time.u.latest ~])
    =.  indices
      (~(put by indices) index new)
    (give-unreads index new)
  ==
::
++  give-unreads
  |=  [=index:a =stream:a =reads:a]
  ^+  cor
  (give %fact ~[/unreads] activity-index-unreads+!>([index (summarize-unreads [stream reads])]))
::
++  adjust
  |=  [=index:a =index-level:a]
  ^+  cor
  =.  volume
    (~(put by volume) index index-level)
  cor
::
++  summarize-unreads
  |=  [=stream:a =reads:a]
  ^-  unread-summary:a
  =.  stream  (lot:on-event:a stream `floor.reads ~)
  =/  event-parents  event-parents.reads
  ::  for each item in reads
  ::  remove the post from the event stream
  ::  remove replies older than reply-floor from the event stream
  ::  then call stream-to-unreads
  |-
  ?~  event-parents
    (stream-to-unreads stream)
  =/  [[=time =event-parent:a] rest=event-parents:a]  (pop:on-parent:a event-parents)
  %=  $
      event-parents
    rest
  ::
      stream
    =-  +.-
    %^  (dip:on-event:a @)  stream
      ~
    |=  [@ key=@da =event:a]
    ^-  [(unit event:a) ? @]
    ?>  ?=(?(%post %reply %dm-post) -.event)
    ?:  &(seen.event-parent =(time key))
      [~ | ~]
    ?.  =(-.event %reply)
      [`event | ~]
    ?:  (lth time.message-key.event reply-floor.event-parent)
      [~ | ~]
    [`event | ~]
  ==
++  stream-to-unreads
  |=  =stream:a
  ^-  unread-summary:a
  =/  newest=(unit time)  ~
  =/  count  0
  =/  threads=(map message-id:a [oldest-unread=time count=@ud])  ~
  ::  for each event
  ::  update count and newest
  ::  if reply, update thread state
  |-
  ?~  stream
    :+  (fall newest now.bowl)  count
    %+  turn  ~(val by threads)
    |=  [oldest-unread=time count=@ud]
    [oldest-unread count]
  =/  [[@ =event:a] rest=stream:a]  (pop:on-event:a stream)
  =.  count  +(count)
  =.  newest
    ?>  ?=(?(%dm-post %post %reply) -.event)
    ::REVIEW  should we take timestamp of parent post if reply??
    ::        (in which case we would need to do (max newest time.mk.e))
    `time.message-key.event
  =?  threads  ?=(%reply -.event)
    =/  old
      %+  ~(gut by threads)  id.target.event
      [oldest-unread=time.message-key.event count=0]
    %+  ~(put by threads)  id.target.event
    ::  we don't need to update the timestamp, because we always process the
    ::  oldest message first
    ::
    [oldest-unread.old +(count.old)]
  $(stream rest)
--

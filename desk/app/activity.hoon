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
^-  agent:gall
::
=<
  %+  verb  |
  %-  agent:dbug
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
    ^-  (qup card _this)
    =^  cards  state
      abet:(watch:cor path)
    [cards this]
  ::
  ++  on-arvo
    |=  [=wire =sign-arvo]
    ^-  (quip card _this)
    `this
  ::
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
  =.  volume
    %-  malt
    :~  [%dm-invite %notify]
        [%dm-post %notify]
        [%dm-post-mention %notify]
        [%kick %default]
        [%join %trivial]
        [%post %trivial]
        [%post-mention %notify]
        [%reply %notify]
        [%reply-mention %notify]
        [%flag %default]
    ==
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
        %add
      (add +.action)
        %read
      (read +.action)
        %adjust
      (adjust +.action)
    ==
  ==
::
++  watch
  |=  =(pole knot)
  ^+  cor
  ?+  pole  ~|(bat-watch-path+pole !!)
    ~  ?>(from-self cor)
    %notifications  ?>(from-self cor)
    %unreads  ?>(from-self cor)
  ==
::
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+  pole  [~ ~]
      [%x ~]
    ``activity-full+!>([stream indices])
      [%x %all ~]
    ``activity-stream+!>((tap:eon:a stream))
      [%x %all start=@ count=@ ~]
    ``activity-stream+!>((scag count (top:emp:a stream start)))
      [%u %event id=@]
    ``loob+!>((has:eon:a (slav %da id.pole)))
      [%x %event id=@]
    ``activity-event+!>((got:eon:a (slav %da id.pole)))
      [%x %unreads ~]
    ``activity-unreads+!>((~(run by indices) summarize-unreads))
  ==
::
++  add
  ::  TODO add to stream & indices, update unreads, and send facts
  |=  =event:a
  ^+  cor
  ::TODO  make sure to set the reply-floor to be the parent time, for new threads,
  ::      +find-floor assumes on this
  cor
::
++  find-floor
  |=  [=index:a mode=$%([%all ~] [%reply parent=one-id:a])]
  ^-  new-floor=(unit time)
  ?.  (~(has by indices) index)  ~
  ::  starting at the last-known first-unread location (floor), walk towards
  ::  the present, to find the new first-unread location (new floor)
  ::
  =/  [=orig=stream =reads]
    (~(got by indices) index)
  ?>  |(?=(%all -.mode) (has:eon:a event-parents.reads parent.mode))
  ::  slice off the earlier part of the stream, for efficiency
  ::
  =/  =stream
    =;  beginning=time
      (lot:eon orig-stream `beginning ~)
    ?-  -.mode
        %all    floor.reads
        %reply  reply-floor:(got:eon:a event-parents.reads parent.mode)
    ==
  =|  new-floor=(unit time)
  |-
  ?~  stream  new-floor
  ::
  =^  [=time =event]  stream  (pop:eon:a stream)
  ?:  ?&  ?=(%reply -.mode)
      ?|  !?=(%reply -.event)
          =(message-key.event parent.mode)
      ==  ==
    ::  we're in reply mode, and it's not a reply event, or a reply to
    ::  something else, so, skip
    ::
    $
  =;  is-read=?
    ::  if we found something that's unread, we need look no further
    ::
    ?.  is-read  $(stream ~)
    ::  otherwise, continue our walk towards the present
    ::
    $(new-floor `time)
  ?+  -.event  !!
      ?(%dm-post %post)
    =*  id=one-id  message-key.event
    =/  par=(unit event-parent:a)  (get:mep:a event-parents.reads id)
    ?~(par | seen.u.par)
  ::
      %reply
    =*  id=one-id  message-key.event
    =/  par=(unit event-parent:a)  (get:mep:a event-parents.reads id)
    ?~(par | (gte time reply-floor.u.par))
  ==
::
++  update-floor
  |=  =index:a
  ^+  cor
  =/  new-floor  (find-floor index %all ~)
  =?  indices  ?=(^ new-floor)
    %+  ~(jab by indices)  index
    |=  [=stream =reads]
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
      %+  put:mep:a  event-parents.reads.u.indy
      =;  new-reply-floor=(unit time)
        [id.action [& (fall new-reply-floor id.action)]]
      (find-floor index %reply id.action)
    =.  indices
      (~(put by indices) index new)
    =.  cor  (update-floor index)
    (give-unreads new)
  ::
      %post
    =/  indy  (~(get by indices) index)
    ?~  indy  cor
    =/  old-event-parent  (get:mep:a event-parents.reads.u.indy id.action)
    ?~  old-event-parent  cor
    =/  new
      =-  u.indy(event-parents.reads -)
      %+  put:mep:a  event-parents.reads.u.indy
      [id.action u.old-event-parent(seen &)]
    =.  indices
      (~(put by indices) index new)
    =.  cor  (update-floor index)
    (give-unreads new)
  ::
      %all
    =/  indy  (~(get by indices) index)
    ?~  indy  cor
    =/  new
      =/  latest=(unit [=time event:a])
        ::REVIEW  is this taking the item from the correct end? lol
        (ram:eon:a stream.u.indy)
      ?~  latest  u.indy
      u.indy(reads [time.u.latest ~])
    =.  indices
      (~(put by indices) index new)
    (give-unreads new)
  ==
::
++  give-unreads
  |=  [=stream:a =reads:a]
  ^+  cor
  (give %fact ~[/unreads] activity-index-unreads+!>((summarize-unreads [stream reads])))
::
++  adjust
  |=  [=flavor:a =level:a]
  ^+  cor
  =.  volume
    (~(put by volume) flavor level)
  cor
::
++  summarize-unreads
  |=  [=stream:a =reads:a]
  ^-  unread-summary:a
  =.  stream  (lot:eon:a stream `floor.reads ~)
  =/  event-parents  event-parents.reads
  ::  for each item in reads
  ::  remove the post from the event stream
  ::  remove replies older than reply-floor from the event stream
  ::  then call stream-to-unreads
  |-
  ?~  event-parents  (stream-to-unreads stream)
  =/  [[=time =event-parent:a] rest=event-parents:a]  (pop:mep:a reads)
  %=  $
      event-parents
    rest
  ::
      stream
    %^  (dip:eon @)  stream
      ~
    |=  [* =event:a]
    ^-  [(unit event:a) ? @]
    ?>  ?=(?(%post %reply %dm-post) -.event)
    ?:  &(seen.event-parent =(time time.message-key.event))
      [~ ~ ~]
    ?.  =(-.event %reply)
      [`event ~ ~]
    ?:  (lth time.message-key.event reply-floor)
      [~ ~ ~]
    [`event ~ ~]
  ==
++  stream-to-unreads
  |=  stream:a
  ^-  unread-summary:a
  =/  newest  *time
  =/  count  0
  =/  threads=(map message-id:a [oldest-unread=time count=@ud])  ~
  ::  for each event
  ::  update count and newest
  ::  if reply, update thread state
  |-
  ?~  stream
    :+  newest  count
    %+  turn  ~(val by threads)
    |=  [oldest-unread=time count=@ud]
    [oldest-unread count]
  =/  [[@ =event:a] rest=stream:a]  (pop:eon:a stream)
  =.  count  +(count)
  =.  newest
    ?>  ?=(?(%dm-post %post %reply) -.event)
    ::REVIEW  should we take timestamp of parent post if reply??
    ::        (in which case we would need to do (max newest time.mk.e))
    time.message-key.event
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

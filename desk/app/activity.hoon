::
/-  a=activity
/+  default-agent, verb, dbug
::
|%
+$  card  card:agent:gall
::
+$  versioned-state
  $%  state-0
  ==
::
+$  state-0
  [%0 =stream:a =indices:a =volume:a]
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
  |^  ^+  cor
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
      (add action)
        %read
      (read action)
        %adjust
      (adjust action)
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
  |=  =action:a
  =.  
::
++  read
  |=  =action:a
  ?-  -.read-action.action
      %last-seen
    =/  indy  (~(get by indices) index)
    ?~  indy  cor
    =/  new
      [stream.indy [time.action events.indy]]
    =.  indices
      (~(put by indices) index new)
    =.  cor
      (give-unreads new)
    cor
  ::
      %thread
    =/  indy  (~(get by indices) index)
    ?~  indy  cor
    =/  new
      (put:mep reads.u.indy time.read-action.action [& time.read-action.action])
    =.  indices
      (~(put by indices) index new)
    =.  cor
      (give-unreads new)
    cor
  ::
      %post
    =/  indy  (~(get by indices) index)
    ?~  indy  cor
    =/  old-event-parent  (~(get by indy) time.read-action.action)
    ?~  old-event-parent  cor
    =/  new
      :-  stream.u.indy
      (put:mep reads.u.indy time.read-action.action [& reply-floor.old-event.parent])
    =.  indices
      (~(put by indices) index new)
    =.  cor
      (give-unreads new)
    cor
  ::
      %all
    =/  indy  (~(get by indices) index)
    ?~  indy  cor
    =/  new
      [stream.u.indy [now.bowl ~]]
    =.  indices
      (~(put by indices)  index  new)
    =.  cor
      (give-unreads new)
    cor
  ==
::
++  give-unreads
  |=  [=stream:a =reads:a]
  (give %fact ~[/unreads] activity-index-unreads+!>((summarize-unreads [stream reads])))
::
++  adjust
  |=  =flavor:a =level:a
  =.  volume
    (~(put by volume) flavor level
  cor
::
++  summarize-unreads
  |=  [=stream:a =reads:a]
  ^-  unread-summary:a
  =.  stream  (lot:eon stream `floor.reads ~)
  =/  event-parents event-parents.reads
  ::  for each item in reads
  ::  remove the post from the event stream
  ::  remove replies older than reply-floor from the event stream
  ::  then call stream-to-unreads
  |-
  ?~  event-parents  (stream-to-unreads stream)
  =/  [[=time =event-parent:a] rest=event-parents:a]  (pop:mep reads)
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
  =/  threads=(map time [oldest-unread=time count=@ud])  ~
  ::  for each event
  ::  update count and newest
  ::  if reply, update thread state
  |-
  ?~  stream
    :+  newest count
    %+  turn  ~(val by threads)
    |=([parent=time oldest-unread=time count=@ud] [oldest-unread count]))
  =/  [[@ =event:a] rest=stream:a]  (pop:eon stream)
  ?=  threads  =(-.event %reply)
    ::  TODO confirm that using time.message-key here is right
    =/  old  (~(gut by threads) target.event [time.message-key.event 0])
    (~(put by threads) target.event [oldest-unread.old +(count.old)])
  $(newest time.message-key.event, count +(count), stream rest)
--

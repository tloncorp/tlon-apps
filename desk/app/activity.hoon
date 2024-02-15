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
    %reads  ?>(from-self cor)
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
    ``activity-unreads+!>(summarize-unreads)
  ==
::
++  add
  ::  TODO add to stream & indices, update unreads, and send facts
  |=  =action:a
  =.  
::
++  read
  ::  TODO update state and send facts
  |=  =action:a
  ?-  -.read-action.action
      %last-seen
    =/  indy  (~(get by indices) index)
    ?~  indy  cor
    =.  indices
      (~(put by indices) index [stream.indy [time.action events.indy]])
    cor
    ::
      %thread
    =/  indy  (~(get by indices) index)
    ?~  indy  cor
    
    ::
      %post
    =/  indy  (~(get by indices) index)
    ?~  indy  cor
    
  ==
::
++  adjust
  |=  =flavor:a =level:a
  =.  volume
    (~(put by volume) flavor level
  cor
::
++  summarize-unreads
  %-  ~(run by indices)
  |=  [=stream:a =reads:a]
  ::  TODO slice by floor, remove seen messages, handle threads
  ~
--

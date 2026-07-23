::  acp: ship-side Tlon Messenger bus for external agent workers
::
::    %acp subscribes to Messenger activity, applies bot routing policy, and
::    exposes durable normalized requests. A worker may run any harness and
::    return plain-text replies without monitoring chat or channels itself.
::
/-  ac=acp, av=activity-ver, cv=chat-ver, c=channels, st=story
/+  default-agent, verb, dbug, cu=channel-utils
|%
+$  card  card:agent:gall
+$  state-0
  $:  %0
      routing=(unit routing:ac)
      requests=(map @ud request:ac)
      delivering=(set @ud)
      seen=(set message-key:v9:av)
      next-request=@ud
  ==
++  max-requests       10.000
++  max-seen           10.000
++  max-reply-bytes    1.048.576
--
=|  state-0
=*  state  -
%-  agent:dbug
%^  verb  |  %warn
^-  agent:gall
=<
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %.n) bowl)
      cor   ~(. +> [bowl ~])
  ++  on-init
    ^-  (quip card _this)
    =.  next-request.state  1
    [~[watch-activity:cor] this]
  ++  on-save  !>(state)
  ++  on-load
    |=  old=vase
    ^-  (quip card _this)
    =/  loaded  (mule |.(!<(state-0 old)))
    ?:  ?=(%& -.loaded)  `this(state p.loaded)
    %-  (slog 'acp: resetting incompatible state' ~)
    `this(state [%0 ~ ~ ~ ~ 1])
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state  abet:(poke:cor mark vase)
    [cards this]
  ++  on-watch
    |=  =path
    ^-  (quip card _this)
    ?>  =(src our):bowl
    =^  cards  state  abet:(watch:cor path)
    [cards this]
  ++  on-peek
    |=  =path
    ^-  (unit (unit cage))
    ?>  =(src our):bowl
    (peek:cor path)
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    =^  cards  state  abet:(agent:cor wire sign)
    [cards this]
  ++  on-arvo   |=([=wire sign=sign-arvo] `this)
  ++  on-leave  |=(path `this)
  ++  on-fail
    |=  [=term =tang]
    ^-  (quip card _this)
    %-  (slog 'acp: on-fail' >term< tang)
    [~ this]
  --
|_  [=bowl:gall cards=(list card)]
++  cor   .
++  abet  [(flop cards) state]
++  emit  |=(=card cor(cards [card cards]))
++  give  |=(=gift:agent:gall (emit %give gift))
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?>  =(src.bowl our.bowl)
  ?>  =(%acp-action-1 mark)
  =+  !<(=action:ac vase)
  ?-  -.action
    %configure  (configure routing.action)
    %reply      (reply sequence.action text.action)
  ==
::
++  watch
  |=  =path
  ^+  cor
  ?+  path  ~|(bad-acp-watch-path+path !!)
    [%worker ~]
      =.  cor  (give-update [%configuration routing.state])
      (give-update [%requests queued-requests])
  ==
::
++  peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
      [%x %requests ~]
    ``acp-update-1+!>(`update:ac`[%requests queued-requests])
  ::
      [%x %configuration ~]
    ``acp-update-1+!>(`update:ac`[%configuration routing.state])
  ==
::
++  give-update
  |=  update=update:ac
  ^+  cor
  (give %fact ~[/worker] %acp-update-1 !>(update))
::
++  watch-activity
  ^-  card
  [%pass /activity %agent [our.bowl %activity] %watch /v5]
::
++  agent
  |=  [=wire =sign:agent:gall]
  ^+  cor
  ?+  wire  cor
      [%activity ~]
    ?+    -.sign  cor
        %fact
      ?.  ?=(%activity-update-5 p.cage.sign)  cor
      =+  !<(=update:v9:av q.cage.sign)
      ?.  ?=(%add -.update)  cor
      (handle-activity event.update)
    ::
        %kick
      (emit watch-activity)
    ::
        %watch-ack
      ?~  p.sign  cor
      ((slog 'acp: activity watch nacked' u.p.sign) cor)
    ==
  ::
      [%reply @ ~]
    =/  sequence=@ud  (slav %ud i.t.wire)
    ?+  -.sign  cor
      %poke-ack
        =.  delivering.state  (~(del in delivering.state) sequence)
        ?~  p.sign
          =.  requests.state  (~(del by requests.state) sequence)
          (give-update [%completed sequence])
        (give-update [%failed sequence 'Messenger rejected reply'])
    ==
  ==
::
++  configure
  |=  new=routing:ac
  ^+  cor
  =.  routing.state  `new
  (give-update [%configuration `new])
::
++  handle-activity
  |=  event=event:v9:av
  ^+  cor
  ?~  routing.state  cor
  =/  item=(unit [conversation=conversation:ac sender=ship content=story:st mention=? key=message-key:v9:av])
    ?+  -<.event  ~
        %dm-post
      ?.  ?=(%ship -.whom.event)  ~
      `[conversation=[%dm p.whom.event] sender=p.id.key.event content=content.event mention=mention.event key=key.event]
    ::
        %dm-reply
      ?.  ?=(%ship -.whom.event)  ~
      `[conversation=[%dm p.whom.event] sender=p.id.key.event content=content.event mention=mention.event key=key.event]
    ::
        %post
      `[conversation=[%channel kind.channel.event ship.channel.event name.channel.event] sender=p.id.key.event content=content.event mention=mention.event key=key.event]
    ::
        %reply
      `[conversation=[%channel kind.channel.event ship.channel.event name.channel.event] sender=p.id.key.event content=content.event mention=mention.event key=key.event]
    ==
  ?~  item  cor
  =*  entry  u.item
  =*  route  u.routing.state
  ?:  =(sender.entry our.bowl)  cor
  ?:  (~(has in seen.state) key.entry)  cor
  =/  allowed=?
    ?-  -.conversation.entry
        %dm
      ?|  =(sender.entry owner.route)
          (~(has in allowed-dms.route) sender.entry)
      ==
    ::
        %channel
      =/  nest  [kind.conversation.entry host.conversation.entry name.conversation.entry]
      ?&  (~(has in channels.route) nest)
          ?|  =(sender.entry owner.route)
              (~(has in allowed-channel-ships.route) sender.entry)
          ==
          ?|  !require-channel-mention.route
              mention.entry
              ?&  owner-listen.route
                  =(sender.entry owner.route)
                  ?|  =(host.conversation.entry owner.route)
                      =(host.conversation.entry our.bowl)
                  ==
              ==
          ==
      ==
    ==
  ?.  allowed  cor
  =/  text  (flatten:cu content.entry)
  ?:  =(0 text)  cor
  ?>  (lth ~(wyt by requests.state) max-requests)
  =/  sequence  next-request.state
  =/  request=request:ac
    :*  sequence
        now.bowl
        conversation.entry
        sender.entry
        (rap 3 (scot %p sender.entry) '/' (scot %da time.key.entry) ~)
        text
    ==
  =.  next-request.state  +(sequence)
  =.  requests.state  (~(put by requests.state) sequence request)
  =.  seen.state
    ?:  (gte ~(wyt in seen.state) max-seen)
      (silt ~[key.entry])
    (~(put in seen.state) key.entry)
  (give-update [%requests ~[request]])
::
++  reply
  |=  [sequence=@ud text=@t]
  ^+  cor
  ?>  (lte (met 3 text) max-reply-bytes)
  =/  got  (~(get by requests.state) sequence)
  ?~  got  ~|(unknown-acp-request+sequence !!)
  ?:  (~(has in delivering.state) sequence)  cor
  =.  delivering.state  (~(put in delivering.state) sequence)
  =/  content=story:st  ~[[%inline ~[text]]]
  ?-  -.conversation.u.got
      %dm
    =/  =essay:v7:cv  [[content our.bowl now.bowl] chat+/ ~ ~]
    =/  =diff:dm:v7:cv  [[our.bowl now.bowl] %add essay `now.bowl]
    =/  =action:dm:v7:cv  [ship.conversation.u.got diff]
    =/  outbound=card
      [%pass /reply/(scot %ud sequence) %agent [our.bowl %chat] %poke %chat-dm-action-2 !>(action)]
    (emit outbound)
  ::
      %channel
    =/  nest=nest:c  [kind.conversation.u.got host.conversation.u.got name.conversation.u.got]
    =/  essay=essay:c  [[content our.bowl now.bowl] [kind.conversation.u.got ~] ~ ~]
    =/  action=a-channels:c  [%channel nest [%post [%add essay]]]
    =/  outbound=card
      [%pass /reply/(scot %ud sequence) %agent [our.bowl %channels] %poke %channel-action-1 !>(action)]
    (emit outbound)
  ==
::
++  queued-requests
  ^-  (list request:ac)
  =/  sorted
    %+  sort  ~(tap by requests.state)
    |=  [left=[@ud request:ac] right=[@ud request:ac]]
    (lth -.left -.right)
  (turn sorted |=([@ud value=request:ac] value))
--

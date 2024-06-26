::
/-  a=activity, c=channels, ch=chat, g=groups
/+  default-agent, verb, dbug, ch-utils=channel-utils, v=volume
::
=>
  |%
  +$  card  card:agent:gall
  ::
  +$  current-state
    $:  %2
        allowed=notifications-allowed:a
        =indices:a
        =activity:a
        =volume-settings:a
    ==
  --
::
=|  current-state
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
  =+  .^(=channels:c %gx (scry-path %channels /v2/channels/full/noun))
  =.  cor  (set-volumes channels)
  =.  cor  (set-channel-reads channels)
  =.  cor  refresh-all-summaries
  cor(importing |)
::
++  load
  |=  =vase
  |^  ^+  cor
  ?:  ?=([%0 *] q.vase)  init
  =+  !<(old=versioned-state vase)
  =?  old  ?=(%1 -.old)  (state-1-to-2 old)
  ?>  ?=(%2 -.old)
  =.  state  old
  (emit %pass /clean-keys %agent [our.bowl dap.bowl] %poke noun+!>(%clean-keys))
  +$  versioned-state  $%(state-2 state-1)
  +$  state-2  current-state
  +$  state-1
    [%1 =indices:a =activity:a =volume-settings:a]
  ++  state-1-to-2
    |=  old=state-1
    ^-  state-2
    [%2 %all +.old]
  --
::
++  scry-path
  |=  [=dude:gall =path]
  %+  welp
  /(scot %p our.bowl)/[dude]/(scot %da now.bowl)
  path
++  set-channel-reads
  |=  =channels:c
  ^+  cor
  =+  .^(=unreads:c %gx (scry-path %channels /v1/unreads/noun))
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
++  set-chat-reads
  ^+  cor
  =+  .^(=unreads:ch %gx (scry-path %chat /unreads/noun))
  =+  .^  [dms=(map ship dm:ch) clubs=(map id:club:ch club:ch)]
      %gx  (scry-path %chat /full/noun)
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
  =+  .^(=volume:v %gx (scry-path %groups /volume/all/noun))
  ::  set all existing channels to old default since new default is different
  =^  checkers  cor
    =/  checkers=(map flag:g $-([ship nest:g] ?))  ~
    =/  entries  ~(tap by channels)
    |-
    ?~  entries  [checkers cor]
    =/  [=nest:c =channel:c]  i.entries
    =*  group  group.perm.channel
    =+  .^(exists=? %gx (scry-path %groups /exists/(scot %p p.group)/[q.group]/noun))
    ?.  exists  $(entries t.entries)
    =^  can-read  checkers
      ?^  gate=(~(get by checkers) group)  [u.gate checkers]
      =/  =path
        %+  scry-path  %groups
        /groups/(scot %p p.group)/[q.group]/can-read/noun
      =/  test=$-([ship nest:g] ?)
        =>  [path=path nest=nest:g ..zuse]  ~+
        .^($-([ship nest] ?) %gx path)
      [test (~(put by checkers) group test)]
    =.  cor
      ::  don't set channel default if group above it has setting
      ?:  (~(has by area.volume) group)  cor
      %+  adjust  [%channel nest group]
      ?:  (can-read our.bowl nest)  `(my [%post & |] ~)
      `mute:a
    $(entries t.entries)
  ::  set any overrides from previous volume settings
  =.  cor  (adjust [%base ~] `(~(got by old-volumes:a) base.volume))
  =.  cor
    =/  entries  ~(tap by chan.volume)
    |-
    ?~  entries  cor
    =/  [=nest:g =level:v]  i.entries
    =*  next  $(entries t.entries)
    ?.  ?=(?(%chat %diary %heap) -.nest)  next
    =/  channel  (~(get by channels) nest)
    ?~  channel  next
    ?~  can-read=(~(get by checkers) group.perm.u.channel)  next
    ::  don't override previously set mute from channel migration
    ?.  (u.can-read our.bowl nest)  next
    =.  cor
      %+  adjust  [%channel nest group.perm.u.channel]
      `(~(got by old-volumes:a) level)
    next
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
      =.  state  *current-state
      =.  allowed  %all
      migrate
        %clean-keys
      correct-dm-keys
    ==
  ::
      %activity-action
    =+  !<(=action:a vase)
    ?-  -.action
      %add      (add +.action)
      %del      (del +.action)
      %read     (read +.action)
      %adjust   (adjust +.action)
      %allow-notifications  (allow +.action)
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
      [%x %all count=@ start=?(~ [u=@ ~])]
    =/  start
      ?~  start.pole  now.bowl
      ?^  tim=(slaw %ud u.start.pole)  u.tim
      (slav %da u.start.pole)
    =/  count  (slav %ud count.pole)
    =-  ``activity-stream+!>((gas:on-event:a *stream:a -))
    (bat:ex-event:a stream:base `start count)
  ::
      [%x %feed %init count=@ ~]
    =/  start  now.bowl
    =/  count  (slav %ud count.pole)
    =;  init=[all=feed:a mentions=feed:a replies=feed:a]
      ``activity-feed-init+!>(init)
    :*  (feed %all start count)
        (feed %mentions start count)
        (feed %replies start count)
    ==
  ::
      [%x %feed type=?(%all %mentions %replies) count=@ start=?(~ [u=@ ~])]
    =/  start
      ?~  start.pole  now.bowl
      ?^  tim=(slaw %ud u.start.pole)  u.tim
      (slav %da u.start.pole)
    =/  count  (slav %ud count.pole)
    =;  =feed:a
      ``activity-feed+!>(feed)
    (feed type.pole start count)
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
  ::
      [%x %notifications-allowed ~]
    ``activity-allowed+!>(`notifications-allowed:a`allowed)
  ==
::
++  feed
  |=  [type=?(%all %mentions %replies) start=time-id:a count=@ud]
  |^
  ^-  (list activity-bundle:a)
  =-  happenings
  ::  if start is now, need to increment to make sure we include latest
  ::  event if that event somehow has now as its time
  =/  real-start  ?:(=(start now.bowl) +(start) start)
  %^  (dop:ex-event:a out)
      stream:base
    [~ count ~ ~]
  |=  [acc=out =time =event:a]
  ^-  [(unit event:a) ? out]
  ?:  =(limit.acc 0)  [~ & acc]
  ::  we only care about events older than start
  ?:  (gth time real-start)  [~ | acc]
  :-  ~   :-  |
  =/  =source:a  (determine-source -.event)
  =/  src-info=[latest=time-id:a added=?]
    ?^  stored=(~(get by sources.acc) source)  u.stored
    :_  |
    ?~  new=(ram:on-event:a stream:(get-index source))
      ::  should never happen but -\_(ツ)_/-
      (sub start 1)
    -.u.new
  =.  sources.acc  (~(put by sources.acc) source src-info)
  ::  we only care about posts/replies events that are notified, and we
  ::  don't want to include events from sources whose latest event is
  ::  after the start so we always get "new" sources when paging
  ?.  ?&  notified.event
          (lth latest.src-info start)
          ?=(?(%post %reply %dm-post %dm-reply) -<.event)
      ==
    acc
  =/  mention=(unit activity-bundle:a)
    ?.  |(?=(%all type) ?=(%mentions type))  ~
    =/  is-mention
      ?-  -<.event
        %post  mention.event
        %reply  mention.event
        %dm-post  mention.event
        %dm-reply  mention.event
      ==
    ?.  is-mention  ~
    `[source time ~[[time event]]]
  ?^  mention
    :-  sources.acc
    [(sub limit.acc 1) (snoc happenings.acc u.mention) collapsed.acc]
  =/  care
    ?|  ?=(%all type)
        &(?=(%replies type) ?=(?(%reply %dm-reply) -<.event))
    ==
  ::  make sure we care, haven't added this source, and haven't collapsed
  ::  this event already
  ?.  ?&  care
          ?!(added:(~(got by sources.acc) source))
          !(~(has in collapsed.acc) time)
      ==
    acc
  =/  top  (top-messages source stream:(get-index source))
  ::  collapsed is a set of event ids that we've already included in the feed
  ::  and so should be ignored
  =/  collapsed
    (~(gas in collapsed.acc) (turn top head))
  :-  (~(put by sources.acc) source src-info(added &))
  [(sub limit.acc 1) (snoc happenings.acc [source time top]) collapsed]
  +$  out
    $:  sources=(map source:a [latest=time-id:a added=?])
        limit=@ud
        happenings=(list activity-bundle:a)
        collapsed=(set time-id:a)
    ==
  --
++  recent-messages-amount  6
++  top-messages
  |=  [=source:a =stream:a]
  |^
  ^-  (list time-event:a)
  =-  msgs
  %^  (dop:ex-event:a out)  stream  [recent-messages-amount ~]
  |=  [acc=out [=time =event:a]]
  ?:  =(limit.acc 0)  [~ & acc]
  ?:  child.event  [~ | acc]
  ?.  ?=(?(%post %reply %dm-post %dm-reply) -<.event)  [~ | acc]
  =/  is-mention
    ?-  -<.event
      %post  mention.event
      %reply  mention.event
      %dm-post  mention.event
      %dm-reply  mention.event
    ==
  ?:  is-mention  [~ | acc]
  [~ | [(sub limit.acc 1) (snoc msgs.acc [time event])]]
  +$  out
    $:  limit=@ud
        msgs=(list time-event:a)
    ==
  --
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
  =/  notify  notify:(get-volume inc)
  =/  =event:a  [inc notify |]
  =/  =source:a  (determine-source inc)
  =?  cor  !importing
    (give %fact ~[/] activity-update+!>([%add source time-id event]))
  =?  cor  &(!importing notify (is-allowed inc))
    (give %fact ~[/notifications] activity-event+!>([time-id event]))
  =.  indices
    =/  =stream:a  (put:on-event:a stream:base time-id event)
    (~(put by indices) [%base ~] [stream reads:base])
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
++  is-allowed
  |=  =incoming-event:a
  ?:  ?=(%all allowed)  &
  ?:  ?=(%none allowed)  |
  =/  type  (determine-event-type incoming-event)
  ?+  type  |
    %reply  &
    %dm-invite  &
    %dm-post    &
    %dm-reply   &
    %post-mention  &
    %reply-mention  &
    %dm-post-mention  &
    %dm-reply-mention  &
  ==
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
  (refresh source)
::
++  refresh-all-summaries
  ^+  cor
  =/  sources  ~(tap in ~(key by indices))
  |-
  ?~  sources  cor
  =.  cor  (refresh i.sources)
  $(sources t.sources)
::
++  refresh-summary
  |=  =source:a
  =/  summary  (summarize-unreads source (get-index source))
  =.  activity
    (~(put by activity) source summary)
  (give-unreads source)
::
++  refresh
  |=  =source:a
  =.  cor  (refresh-summary source)
  ?+  -.source  cor
    %channel  (refresh-summary [%group group.source])
    %dm-thread  (refresh-summary [%dm whom.source])
  ::
      %thread
    =.  cor  (refresh-summary [%channel channel.source group.source])
    (refresh-summary [%group group.source])
  ==
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
  (update-index source new &)
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
  (refresh source)
::
++  allow
  |=  na=notifications-allowed:a
  ^+  cor
  =.  allowed  na
  (give %fact ~[/] activity-update+!>([%allow-notifications na]))
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
  =/  child-map
    %+  roll
      children
    |=  [=source:a acc=(map source:a activity-summary:a)]
    =/  =index:a  (~(gut by indices) source *index:a)
    %+  ~(put by acc)  source
    ?~  as=(~(get by activity) source)
      =>  (summarize-unreads source index)
      .(children ~)
    u.as(children ~)
  =/  cs=activity-summary:a
    %-  ~(rep by child-map)
    |=  [[=source:a as=activity-summary:a] sum=activity-summary:a]
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
    [newest total notified ?~(last ~ `[u.last main main-notified]) `child-map]
  =/  [[=time =event:a] rest=stream:a]  (pop:on-event:a stream)
  =/  volume  (get-volume -.event)
  ::TODO  support other event types
  =*  is-msg  ?=(?(%dm-post %dm-reply %post %reply) -<.event)
  =*  supported
    |(is-msg ?=(?(%dm-invite %chan-init) -<.event))
  ?.  supported  $(stream rest)
  =?  notified  &(notify.volume notified.event)  &
  =.  newest  time
  ?.  &(unreads.volume ?=(?(%dm-post %dm-reply %post %reply) -<.event))
    $(stream rest)
  =.  total  +(total)
  =.  main   +(main)
  =?  main-notified  &(notify:volume notified.event)  &
  =.  last
    ?~  last  `key.event
    last
  $(stream rest)
::
::  at some time in the past, for clubs activity, %dm-post and %dm-reply events
::  with bad message/parent identifiers (respectively) got pushed into our
::  streams. for the %dm-reply case, this made it impossible for clients (that
::  use and expect the correct identifiers) to work with the sources these
::  events got put into. for both cases, they were Wrong.
::
::  here, we iterate over all clubs and, for each of the known sources for a
::  club, re-constitute the contents of that source's stream from scratch. this
::  means _moving_ dm-thread streams to be under corrected source identifiers,
::  and updating top-level streams _in-place_. for both, we update the contents
::  of the stream by rewriting %dm-post and %dm-reply events to use corrected
::  message identifiers.
::
::  to correct the message identifiers, we simply do the reverse time-id lookup
::  in dex.pact, as is done across the chat codebase.
::
++  correct-dm-keys
  |^  ^+  cor
  =+  .^  [dms=(map ship dm:ch) clubs=(map id:club:ch club:ch)]
    %gx  (scry-path %chat /full/noun)
  ==
  =/  club-sources
    %~  tap  by
    %+  roll
      ~(tap by indices)
    |=  [[=source:a =index:a] dms=(jar whom:a [source:a index:a])]
    ?.  ?=(?(%dm %dm-thread) -.source)  dms
    =/  whom  ?-(-.source %dm whom.source, %dm-thread whom.source)
    ?.  ?=(%club -.whom)  dms
    (~(add ja dms) whom [source index])
  |-
  ?~  club-sources  cor
  =/  [=whom:a =indexes]  -.club-sources
  =*  next  $(club-sources +.club-sources)
  ?>  ?=(%club -.whom)
  =/  club  (~(get by clubs) p.whom)
  ?~  club  next
  =/  [threads=^indexes dms=^indexes]
    %+  skid
      indexes
    |=  [=source:a *]
    ?=(%dm-thread -.source)
  =;  indxs=^indexes
    |-
    ?~  indxs  next
    =*  source  source.i.indxs
    ::  cleanup old bad keys
    =?  cor  ?=(%dm-thread -.source)
      =/  old-source  source(key [id.key.source q.id.key.source])
      %=  cor
        indices  (~(del by indices) old-source)
        activity  (~(del by activity) old-source)
        volume-settings  (~(del by volume-settings) old-source)
      ==
    ::  update source + index, if new key create new index
    =.  cor  (update-index source index.i.indxs &)
    $(indxs t.indxs)
  %+  weld
    (handle-dms u.club dms)
  (handle-threads u.club threads)
  ++  handle-dms
    |=  [=club:ch =indexes]
    ^+  indexes
    %+  turn
      indexes
    |=  [=source:a =index:a]
    ?>  ?=(%dm -.source)
    :-  source
    index(stream (clean-stream-keys club stream.index))
  ++  handle-threads
    |=  [=club:ch =indexes]
    ^+  indexes
    =/  collapsed
      %+  roll
        indexes
      |=  [[=source:a =index:a] acc=(jar message-id:a [=source:a =index:a])]
      ?>  ?=(%dm-thread -.source)
      (~(add ja acc) id.key.source [source index])
    =;  [=indices:a *]
      ~(tap by indices)
    %+  roll
      indexes
    |=  [[=source:a =index:a] acc=[=indices:a keys=(map message-id:a message-key:a)]]
    ?>  ?=(%dm-thread -.source)
    =*  id  id.key.source
    =/  key  (~(get by keys.acc) id)
    ?:  &(?=(^ key) (~(has by indices.acc) source(key u.key)))  acc
    ?~  srcs=(~(get by collapsed) id)  acc
    =/  post-time  (~(get by dex.pact.club) id)
    ?~  post-time  acc
    =/  new-key  [id u.post-time]
    :_  (~(put by keys.acc) id new-key)
    %-  ~(put by indices.acc)
    ::  new source
    :-  source(key new-key)
    %+  roll
      u.srcs
    |=  [[=source:a =index:a] acc=index:a]
    ?>  ?=(%dm-thread -.source)
    :-  (clean-stream-keys club (uni:on-event:a stream.acc stream.index))
    ::  rectify reads
    =/  floor  (max floor.reads.index floor.reads.acc)
    :-  floor
    =/  combined
      (uni:on-read-items:a items.reads.index items.reads.acc)
    (lot:on-read-items:a combined `floor ~)
  ++  clean-stream-keys
    |=  [=club:ch =stream:a]
    ^-  stream:a
    %+  gas:on-event:a  *stream:a
    %+  turn
      (tap:on-event:a stream)
    |=  [=time =event:a]
    =/  noop  [time event]
    ::  skip any non post or reply events
    ?.  ?=(?(%dm-post %dm-reply) -<.event)  noop
    =/  post-id  ?:(?=(%dm-post -<.event) id.key.event id.parent.event)
    =/  post-time  (~(get by dex.pact.club) post-id)
    ?~  post-time  noop
    =/  post-key  [post-id u.post-time]
    ?:  ?=(%dm-post -<.event)
      [time event(key post-key)]
    =/  reply-time  (~(get by dex.pact.club) id.key.event)
    ?~  reply-time  noop
    [time event(time.key u.reply-time, parent post-key)]
  +$  indexes  (list [=source:a =index:a])
  --
--

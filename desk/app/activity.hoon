::  activity: tracking what's happening and how we alert you
::
::    the main goal of the agent is to keep track of every event you are
::    aware of, and which ones you've read and interacted with. by doing
::    this, we have a centralized place to keep your read state and
::    notifications/alerts in sync.
::
::    at its core, activity is composed of a few key parts:
::      - events: things that happen in other agents
::      - sources: where the events happen or their parents
::      - streams: a collection of all events from a source and its
::           children. each stream represents a source's activity.
::      - reads: metadata about what's been read in this source and all
::           its children
::      - summaries: a summary of the activity in a source, used to
::             display badges, alerts, and counts about unread events
::      - volume settings: how should we badge/alert/notify you about
::         each event type
::
::    this means that the streams form a tree structure.
::      - base: the root of the tree, where all events are stored
::        - group
::          - channel
::            - thread
::        - dm
::          - dm-thread
::        - contact
::
::    with this structure that means that data flows upwards from the
::    leaves to the root, and that we can easily keep the read state
::    in sync by propagating read data up. similarly we can have a feed
::    of events at any point in the tree, because the children's events
::    are always included in the parent's stream.
::
::    to make sure we stay in sync, we always process sources in leaf-
::    first order, aka threads/dm-threads first, then channels, then
::    groups, then dms, and then finally the base. this way we can
::    always be sure that we have the most up-to-date information about
::    the children and save ourselves from having to do extra work.
::
::
/-  a=activity, c=channels, ch=chat, g=groups
/+  *activity, ch-utils=channel-utils, v=volume, aj=activity-json,
    imp=import-aid
/+  default-agent, verb, dbug, logs
::
=/  verbose  |
=>
  |%
  +$  card  card:agent:gall
  ::
  +$  current-state
    $:  %8
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
  ++  on-fail
    |=  [=term =tang]
    ^-  (quip card _this)
    :_  this
    [(log-fail:logs /logs our.bowl (fail-event:logs term tang))]~
  --
|_  [=bowl:gall cards=(list card)]
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  from-self  =(our src):bowl
++  log
  |=  msg=(trap tape)
  ?.  verbose  same
  (slog leaf+"%{(trip dap.bowl)} {(msg)}" ~)
::
++  init
  ^+  cor
  (emit %pass /migrate %agent [our.bowl dap.bowl] %poke noun+!>(%migrate))
::
++  load
  |^  |=  =vase
  ^+  cor
  ?:  ?=([%0 *] q.vase)  init
  =+  !<(old=versioned-state vase)
  =?  old  ?=(%1 -.old)  (state-1-to-2 old)
  =?  cor  ?=(%2 -.old)
    (emit %pass /clean-keys %agent [our.bowl dap.bowl] %poke noun+!>(%clean-keys))
  =?  old  ?=(%2 -.old)  (state-2-to-3 old)
  =?  old  ?=(%3 -.old)  (state-3-to-4 old)
  =?  old  ?=(%4 -.old)  (state-4-to-5 old)
  =?  old  ?=(%5 -.old)  (state-5-to-6 old)
  =?  cor  ?=(%6 -.old)
    (emit %pass /adjust-old-default %agent [our.bowl dap.bowl] %poke noun+!>(%adjust-old-default))
  =?  old  ?=(%6 -.old)  [%7 +.old]
  =?  old  ?=(%7 -.old)  [%8 +.old]
  ?>  ?=(%8 -.old)
  =.  state  old
  ::  insert missing volume defaults to %base
  ::
  =/  base-volume
    (~(gut by volume-settings.state) [%base ~] *volume-map:a)
  =.  volume-settings.state
    %+  ~(put by volume-settings.state)  [%base ~]
    (~(uni by base-volume) *volume-map:a)
  =.  allowed  %all
  (emit %pass /fix-init-unreads %agent [our.bowl dap.bowl] %poke noun+!>(%fix-init-unreads))
  +$  versioned-state
    $%  state-8
        state-7
        state-6
        state-5
        state-4
        state-3
        state-2
        state-1
    ==
  +$  state-8  current-state
  +$  state-7
    $:  %7
        allowed=notifications-allowed:v7:old:a
        =indices:v7:old:a
        =activity:v7:old:a
        =volume-settings:v7:old:a
    ==
  +$  state-6  _%*(. *state-7 - %6)
  +$  state-5  _%*(. *state-7 - %5)
  ::
  ++  state-5-to-6
    |=  old=state-5
    ^-  state-6
    =/  [=indices:a =activity:a]
      (sync-reads indices.old activity.old volume-settings.old)
    :*  %6
        allowed.old
        indices
        activity
        volume-settings.old
    ==
  +$  state-4
    $:  %4
        allowed=notifications-allowed:a
        =indices:a
        =activity:a
        =volume-settings:a
    ==
  ++  state-4-to-5
    |=  old=state-4
    ^-  state-5
    :*  %5
        allowed.old
        indices.old
        activity.old
        volume-settings.old
    ==
  ++  indices-4-to-5
    |=  =indices:a
    ^-  indices:a
    %+  ~(jab by indices)  [%base ~]
    |=  =index:a
    =.  stream.index
      %+  run:on-event:a  stream.index
      |=  =event:a
      event(child &)
    index
  +$  state-3
    $:  %3
        allowed=notifications-allowed:a
        =indices:v3:old:a
        =activity:v3:old:a
        =volume-settings:a
    ==
  ++  state-3-to-4
    |=  old=state-3
    ^-  state-4
    =/  new-indices  (indices-3-to-4 indices.old)
    :*  %4
        allowed.old
        new-indices
        (activity-3-to-4 new-indices volume-settings.old)
        volume-settings.old
    ==
  ++  indices-3-to-4
    |=  =indices:v3:old:a
    ^-  indices:a
    (~(run by indices) |=([=stream:a =reads:a] [stream reads *@da]))
  ++  activity-3-to-4
    |=  [=indices:a vs=volume-settings:a]
    ^-  activity:a
    =/  sources  (sort-sources:src ~(tap in ~(key by indices)))
    %+  roll  sources
    |=  [=source:a =activity:a]
    =/  index  (~(got by indices) source)
    %+  ~(put by activity)  source
    (~(summarize-unreads urd indices activity vs log) source index)
  +$  state-2
    $:  %2
        allowed=notifications-allowed:a
        =indices:v3:old:a
        =activity:v2:old:a
        =volume-settings:a
    ==
  ++  state-2-to-3
    |=  old=state-2
    ^-  state-3
    :*  %3
        allowed.old
        indices.old
        ~  ::  this will just get re-derived when we do v3 -> v4
        volume-settings.old
    ==
  +$  state-1
    [%1 =indices:v3:old:a =activity:v2:old:a =volume-settings:a]
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
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+  mark  ~|(bad-poke+mark !!)
      %noun
    ?+  q.vase  ~|(bad-poke+mark !!)
      %refresh-activity  refresh-all-summaries
      %clean-keys  correct-dm-keys
      %fix-init-unreads  fix-init-unreads
      %show-orphans  (drop-orphans &)
      %drop-orphans  (drop-orphans |)
      %adjust-old-default  adjust-old-default
    ::
        %sync-reads
      =^  indices  activity
        (sync-reads indices activity volume-settings)
      cor(indices indices)
    ::
        %migrate
      =.  state  *current-state
      =.  allowed  %all
      migrate
    ==
  ::
      %activity-action
    =+  !<(=action:a vase)
    ?-  -.action
      %add      (add-event +.action)
      %bump     (bump +.action)
      %del      (del-source +.action)
      %del-event  (del-event +.action)
      %read     (read source.action read-action.action |)
      %adjust   (adjust +.action)
      %allow-notifications  (allow +.action)
    ==
  ::
      %egg-any
    =+  !<(=egg-any:gall vase)
    ?-  -.egg-any
        ?(%15 %16)
      ?.  ?=(%live +<.egg-any)
        ~&  [dap.bowl %egg-any-not-live]
        cor
      =/  bak
        (load -:!>(*versioned-state:load) +>.old-state.egg-any)
      ::  restore volume settings, but keep any we've explicitly set ourselves,
      ::  and restore activity summaries & read/bump status
      ::
      =.  allowed          allowed:bak
      =.  volume-settings  (~(uni by volume-settings:bak) volume-settings)
      =.  activity         (~(uni by activity:bak) activity)
      =.  indices
        %.  indices
        %~  uni  by
        %-  ~(run by indices:bak)
        |=  index:a
        ^-  index:a
        :_  [[floor.reads ~] bump]
        ?~  hed=(ram:on-event:a stream)
          *stream:a
        (put:on-event:a *stream:a u.hed)
      (emil (prod-next:imp [our dap]:bowl))
    ==
  ==
::
++  watch
  |=  =(pole knot)
  ^+  cor
  =?  pole  !?=([?(%v0 %v1 %v4) *] pole)
    [%v0 pole]
  ?+  pole  ~|(bad-watch-path+pole !!)
    [%v0 ~]                 ?>(from-self cor)
    [%v1 ~]                 ?>(from-self cor)
    [%v4 ~]                 ?>(from-self cor)
    [%v0 %unreads ~]        ?>(from-self cor)
    [%v1 %unreads ~]        ?>(from-self cor)
    [%v4 %unreads ~]        ?>(from-self cor)
    [%v0 %notifications ~]  ?>(from-self cor)
  ==
::
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  =/  any  ?(%v0 %v1 %v2 %v3 %v4 %v5)
  =/  upto-4  ?(%v0 %v1 %v2 %v3 %v4)
  =?  +.pole  !?=([any *] +.pole)
    [%v0 +.pole]
  ?+  pole  [~ ~]
      [%x ?(%v0 %v2) ~]
    =/  =activity:v2:old:a  (activity:v2:convert-to activity)
    ``activity-full+!>([indices activity volume-settings])
  ::
      [%x ?(%v1 %v3) ~]
    =/  =activity:v3:old:a  (activity:v3:convert-to activity)
    ``activity-full-1+!>([indices activity volume-settings])
  ::
      [%x %v4 ~]
    ``activity-full-4+!>([indices activity volume-settings])
  ::
  ::  /all: unified feed (equality of opportunity)
  ::
      [%x any %all ~]
    ``activity-stream+!>(stream:base)
  ::
      [%x any %all count=@ start=?(~ [u=@ ~])]
    =/  start
      ?~  start.pole  now.bowl
      ?^  tim=(slaw %ud u.start.pole)  u.tim
      (slav %da u.start.pole)
    =/  count  (slav %ud count.pole)
    =-  ``activity-stream+!>((gas:on-event:a *stream:a -))
    (bat:ex-event:a stream:base `start count)
  ::
      [%x upto-4 %feed %init count=@ ~]
    =/  start  now.bowl
    =/  count  (slav %ud count.pole)
    =;  init=[all=feed:v4:old:a mentions=feed:v4:old:a replies=feed:v4:old:a]
      ``activity-feed-init+!>(init)
    :*  feed:(feed %all start count)
        feed:(feed %mentions start count)
        feed:(feed %replies start count)
    ==
  ::
      [%x %v5 %feed %init count=@ ~]
    =/  start  now.bowl
    =/  count  (slav %ud count.pole)
    =;  =feed-init:a
      ``activity-feed-init-5+!>(feed-init)
    =/  all  (feed %all start count)
    =/  mentions  (feed %mentions start count)
    =/  replies  (feed %replies start count)
    :*  feed.all
        feed.mentions
        feed.replies
      ::
        %-  ~(uni by summaries.all)
        %-  ~(uni by summaries.mentions)
        summaries.replies
    ==
  ::
      [%x upto-4 %feed type=?(%all %mentions %replies) count=@ start=?(~ [u=@ ~])]
    =/  start
      ?~  start.pole  now.bowl
      ?^  tim=(slaw %ud u.start.pole)  u.tim
      (slav %da u.start.pole)
    =/  count  (slav %ud count.pole)
    =;  =feed:v4:old:a
      ``activity-feed+!>(feed)
    (feed:v4:convert-to (feed type.pole start count))
  ::
      [%x %v5 %feed type=?(%all %mentions %replies) count=@ start=?(~ [u=@ ~])]
    =/  start
      ?~  start.pole  now.bowl
      ?^  tim=(slaw %ud u.start.pole)  u.tim
      (slav %da u.start.pole)
    =/  count  (slav %ud count.pole)
    =;  =feed:a
      ``activity-feed-5+!>(feed)
    (feed type.pole start count)
  ::
  ::  /each: unified feed (equality of outcome)
  ::TODO  want to be able to filter for specific events kind too, but that will
  ::      suffer from the "search range" "problem", where we want .count to
  ::      mean entries trawled, not entries returned...
  ::
      [%x any %each start=@ count=@ ~]
    =;  =stream:a
      ``activity-stream+!>(-)
    =/  start  (slav %da start.pole)
    =/  count  (slav %ud count.pole)
    %-  ~(rep by indices)
    |=  [[=source:a =stream:a *] out=stream:a]
    ^+  out
    (gas:on-event:a out (tab:on-event:a stream `start count))
  ::
  ::  /indexed: per-index
  ::
      [%x any %indexed concern=?([%channel nk=kind:c:a ns=@ nt=@ gs=@ gt=@ rest=*] [%dm whom=@ rest=*])]
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
      [%u any %event id=@ ~]
    ``loob+!>((has:on-event:a stream:base (slav %da id.pole)))
  ::
      [%x any %event id=@ ~]
    ``activity-event+!>([id.pole (got:on-event:a stream:base (slav %da id.pole))])
  ::
      [%x ?(%v0 %v2) %activity ~]
    ``activity-summary+!>((activity:v2:convert-to activity))
  ::
      [%x ?(%v1 %v3) %activity ~]
    =/  =activity:v3:old:a  (activity:v3:convert-to activity)
    ``activity-summary-1+!>(activity)
  ::
      [%x %v4 %activity ~]
    ``activity-summary-4+!>((strip-threads activity))
  ::
      [%x %v4 %activity %full ~]
    ``activity-summary-4+!>(activity)
  ::
      [%x %v4 %activity %threads host=@ group=@ kind=?(%chat %heap %diary) ship=@ name=@ ~]
    =/  =flag:g  [(slav %p host.pole) group.pole]
    =/  =nest:c  [kind.pole (slav %p ship.pole) name.pole]
    =/  =source:a  [%channel nest flag]
    =/  sum  (~(got by activity) source)
    =/  threads=activity:a
      %+  roll
        ~(tap in children.sum)
      |=  [=source:a out=activity:a]
      (~(put by out) source (~(got by activity) source))
    ``activity-summary-4+!>(threads)
  ::
      [%x %v4 %activity %dm-threads id=@ ~]
    =/  ship  (slaw %p id.pole)
    =/  club  (slaw %uv id.pole)
    =/  =source:a
      :-  %dm
      ?~  ship
        ?~  club  ~|("bad dm thread source: {<pole>}" !!)
        club/u.club
      ship/u.ship
    =/  sum  (~(got by activity) source)
    =/  threads=activity:a
      %+  roll
        ~(tap in children.sum)
      |=  [=source:a out=activity:a]
      (~(put by out) source (~(got by activity) source))
    ``activity-summary-4+!>(threads)
  ::
      [%x %v4 %activity %unreads ~]
    =/  unreads
      %+  skim
        ~(tap by activity)
      |=  [=source:a as=activity-summary:a]
      ?.  |(?=(%thread -.source) ?=(%dm-thread -.source))
        (gth count.as 0)
      (gth notify-count.as 0)
    ``activity-summary-pairs-4+!>(unreads)
  ::
      [%x %v4 %activity %notified ~]
    =/  notified
      %+  skim
        ~(tap by activity)
      |=  [=source:a as=activity-summary:a]
      notify.as
    ``activity-summary-pairs-4+!>(notified)
  ::
      [%x any %volume-settings ~]
    ``activity-settings+!>(volume-settings)
  ::
      [%x any %notifications-allowed ~]
    ``activity-allowed+!>(`notifications-allowed:a`allowed)
  ==
::
++  feed
  |=  [type=?(%all %mentions %replies) start=time-id:a count=@ud]
  |^
  ^-  feed:a
  =-
    :-  happenings
    %+  roll
      happenings
    |=  [bn=activity-bundle:a acc=activity:a]
    (~(put by acc) source.bn (~(gut by activity) source.bn *activity-summary:a))
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
  :+  ~  |
  ?:  (gth time real-start)  acc
  =/  =source:a  (source:evt -.event)
  ?.  (~(has by indices) source)  acc
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
  ?.  ?&  ?|(notified.event ?=(%contact -<.event))
          (lth latest.src-info start)
          ?=  $?  %post  %reply  %dm-post  %dm-reply
                  %flag-post  %flag-reply  %group-ask
                  %contact
              ==
            -<.event
      ==
    acc
  =/  mention=(unit activity-bundle:a)
    ?.  |(?=(%all type) ?=(%mentions type))  ~
    =/  is-mention
      ?+  -<.event  |
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
  =/  contact-bundle=(unit activity-bundle:a)
    ?.  ?=(%all type)  ~
    =/  is-contact-event  ?=(%contact -<.event)
    ?.  is-contact-event  ~
    `[source time ~[[time event]]]
  ?^  contact-bundle
    :-  sources.acc
    [(sub limit.acc 1) (snoc happenings.acc u.contact-bundle) collapsed.acc]
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
  ?~  top  +.acc
  [(sub limit.acc 1) (snoc happenings.acc [source time.i.top top]) collapsed]
  ::
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
  ?.  ?=  $?  %post  %reply  %dm-post  %dm-reply
              %flag-post  %flag-reply  %group-ask
              %contact
          ==
        -<.event
    [~ | acc]
  =/  is-mention
    ?+  -<.event  |
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
++  strip-threads
  |=  =activity:a
  %-  ~(rep by activity)
  |=  [[=source:a as=activity-summary:a] out=activity:a]
  ?:  ?=(?(%thread %dm-thread) -.source)  out
  (~(put by out) source as)
++  base
  ^-  index:a
  (~(got by indices) [%base ~])
++  get-index
  |=  =source:a
  (~(gut by indices) source *index:a)
++  give-update
  |=  $:  =update:a
        $=  dist
        $%  [%hose path=~]
            [%both =path]
            [%only =path]
        ==
      ==
  ^+  cor
  %-  (log |.("{<[update dist]>}"))
  =?  cor  ?!(?=(%activity -.update))
    =?  dist  ?=(%read -.update)  [%both /unreads]
    =/  v0-paths
      =/  hose=(list path)  ~[/ /v0 /v2]
      =/  only=(list path)  ~[path.dist [%v0 path.dist] [%v2 path.dist]]
      ?-  -.dist
        %hose  hose
        %only  only
        %both  (weld only hose)
      ==
    =/  v0-cage=cage
      activity-update+!>((update:v2:convert-to update activity))
    (give %fact v0-paths v0-cage)
  =?  cor  ?!(?=(%activity -.update))
    =?  dist  ?=(%read -.update)  [%both /unreads]
    =/  v1-paths
      =/  hose=(list path)  ~[/v1 /v3]
      =/  only=(list path)  ~[path.dist [%v1 path.dist] [%v3 path.dist]]
      ?-  -.dist
        %hose  hose
        %only  only
        %both  (weld only hose)
      ==
    =/  v1-cage=cage
      activity-update-1+!>((update:v3:convert-to update activity))
    (give %fact v1-paths v1-cage)
  =/  v4-paths
    =/  hose=(list path)  ~[/v4]
    =/  only=(list path)  ~[[%v4 path.dist]]
    ?-  -.dist
      %hose  hose
      %only  only
      %both  (weld only hose)
    ==
  =/  v4-cage=cage  activity-update-4+!>(update)
  (give %fact v4-paths v4-cage)
++  add-event
  =/  start-time=time  now.bowl
  |=  inc=incoming-event:a
  ^+  cor
  =/  =time-id:a
    =/  t  start-time
    |-
    ?.  (has:on-event:a stream:base t)  t
    $(t (add t ~s0..0001))
  =/  notify  notify:(get-volume:evt volume-settings inc)
  =/  =event:a  [inc notify |]
  =/  =source:a  (source:evt inc)
  =/  =update:a  [%add source time-id event]
  =?  cor  !importing
    (give-update update [%hose ~])
  =?  cor  &(!importing notify (is-allowed:evt allowed inc))
    (give %fact ~[/notifications /v0/notifications] activity-event+!>([time-id event]))
  ::  we always update sources in order, so make sure base is processed last
  =.  cor
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
  =.  cor  (add-to-index [%base ~] time-id event(child &))
  =?  cor  !importing
    =/  new-activity=activity:a
      %+  roll
        (snoc (get-parents:src source) source)
      |=  [=source:a out=activity:a]
      (~(put by out) source (~(gut by activity) source *activity-summary:a))
    %-  (log |.("sending activity: {<new-activity>}"))
    (give-update [%activity new-activity] [%hose ~])
  cor
::
++  del-source
  |=  =source:a
  ^+  cor
  =.  cor
    =/  children  (get-children:src indices source)
    |-
    ?~  children  cor
    =.  cor  (del-source i.children)
    $(children t.children)
  =.  indices  (~(del by indices) source)
  =.  activity  (~(del by activity) source)
  =.  volume-settings  (~(del by volume-settings) source)
  ::  TODO: send notification removals?
  (give-update [%del source] [%hose ~])
::
++  del-event
  |=  [=source:a event=incoming-event:a]
  ^+  cor
  =/  =index:a  (~(got by indices) source)
  =/  events=(list [=time-id:a =event:a])
    %+  murn
      (tap:on-event:a stream.index)
    |=  [=time e=event:a]
    ?.  =(-.e event)  ~
    `[time e]
  ?~  events  cor
  =/  new-index  index(stream +:(del:on-event:a stream.index time-id:(head events)))
  =.  indices
    (~(put by indices) source new-index)
  =.  cor  (refresh source)
  =/  new-activity=activity:a
    %+  roll
      (snoc (get-parents:src source) source)
    |=  [=source:a out=activity:a]
    (~(put by out) source (~(got by activity) source))
  %-  (log |.("sending activity: {<new-activity>}"))
  (give-update [%activity new-activity] [%hose ~])
::
++  add-to-index
  |=  [=source:a =time-id:a =event:a]
  ^+  cor
  =/  =index:a  (~(gut by indices) source *index:a)
  =/  new=_stream.index
    (put:on-event:a stream.index time-id event)
  (refresh-index source index(stream new))
::
++  refresh-index
  |=  [=source:a new=index:a]
  %-  (log |.("refeshing index: {<source>}"))
  =.  indices
    (~(put by indices) source new)
  ?:  importing  cor  ::NOTE  deferred until end of migration
  (refresh-summary source)
::
++  refresh-all-summaries
  ^+  cor
  =/  sources  (sort-sources:src ~(tap in ~(key by indices)))
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
::
++  refresh
  |=  =source:a
  =.  cor  (refresh-summary source)
  =/  parents  (get-parents:src source)
  |-
  ?~  parents  cor
  =.  cor  (refresh-summary i.parents)
  $(parents t.parents)
++  bump
  |=  =source:a
  ^+  cor
  ::  we use get-index here because this source may not exist especially
  ::  if it was a post we created and then commented on w/o any other activity
  =/  =index:a  (get-index source)
  =/  new=index:a  index(bump now.bowl)
  =.  indices
    (~(put by indices) source new)
  =.  cor  (refresh source)
  =/  new-activity=activity:a
    %+  roll
      (snoc (get-parents:src source) source)
    |=  [=source:a out=activity:a]
    (~(put by out) source (~(gut by activity) source *activity-summary:a))
  %-  (log |.("sending activity: {<new-activity>}"))
  (give-update [%activity new-activity] [%hose ~])
++  read
  |=  [=source:a action=read-action:a from-parent=?]
  ^+  cor
  ::  we got by here because we don't want reading random sources to
  ::  inject themselves into the activity summary.
  =/  =index:a  (~(got by indices) source)
  ?-  -.action
      %event  ~&("read %event unsupported" !!)
      %item   ~&("read %item unsupported" !!)
  ::
      %all
    =/  new=index:a
      ::  we can short circuit and just mark everything read, because
      ::  we're going to also mark all children read
      =-  index(reads [- ~])
      ?^  time.action  u.time.action
      =/  latest=(unit [=time event:a])
        (ram:on-event:a stream.index)
      ::  if we don't have an event, then this is read anyway so we can
      ::  just reuse the floor. likely if a recursive read is happening
      ::  from one of our parents
      ?~(latest floor.reads.index time.u.latest)
    ::  if we're marking deeply we need to recursively read all
    ::  children
    =/  children  (get-children:src indices source)
    =?  cor  deep.action
      |-
      ?~  children  cor
      =/  =source:a  i.children
      =.  cor  (read source action &)
      $(children t.children)
    ::  we need to refresh our own index to reflect new reads
    %-  (log |.("refeshing index: {<source>}"))
    =.  indices  (~(put by indices) source new)
    ?:  from-parent
      (refresh-summary source)
    =.  cor  (refresh source)
    =/  new-activity=activity:a
      %+  roll
        :(weld (get-parents:src source) ~[source] ?:(deep.action children ~))
      |=  [=source:a out=activity:a]
      (~(put by out) source (~(gut by activity) source *activity-summary:a))
    %-  (log |.("sending activity: {<new-activity>}"))
    (give-update [%activity new-activity] [%hose ~])
  ==
::
++  give-unreads
  |=  =source:a
  ^+  cor
  =/  summary  (~(got by activity) source)
  =/  =update:a  [%read source summary]
  (give-update update [%only /unreads])
::
++  adjust
  |=  [=source:a volume-map=(unit volume-map:a)]
  ^+  cor
  =.  cor  (give-update [%adjust source volume-map] [%hose ~])
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
  (give-update [%allow-notifications na] [%hose ~])
++  summarize-unreads
  ~(summarize-unreads urd indices activity volume-settings log)
::
++  drop-orphans
  |=  dry-run=?
  =/  indexes  ~(tap by indices)
  =/  orphan-count=@ud  0
  |-
  ?~  indexes
    ~?  =(orphan-count 0)  "no orphans found"
    ?:  dry-run  cor
    ?:  =(orphan-count 0)  cor
    refresh-all-summaries
  =/  [=source:a =index:a]  i.indexes
  =/  parent  (get-parent:src indices source)
  =/  missing-parent  &(=(parent ~) ?!(?=(%base -.source)))
  =/  new-count  ?:(missing-parent +(orphan-count) orphan-count)
  ?:  dry-run
    ~?  missing-parent  "orphaned source: {<source>}"
    $(indexes t.indexes, orphan-count new-count)
  ?.  missing-parent  $(indexes t.indexes)
  =.  indices  (~(del by indices) source)
  =.  activity  (~(del by activity) source)
  =.  volume-settings  (~(del by volume-settings) source)
  $(indexes t.indexes, orphan-count new-count)

::
::  when we migrated from chat and channels, we always added an init event
::  so that we can mark what's been joined and have something affect the
::  recency so that it ends up in the correct place on the sidebar.
::  however, we forgot to mark these as read, so we need to do that now.
::  otherwise we end up with a bunch of dms/channels that are
::  incorrectly unread.
++  fix-init-unreads
  =+  .^(=unreads:c %gx (scry-path %channels /v1/unreads/noun))
  =.  indices  (fix-channel-init-unreads indices unreads)
  =+  .^(=unreads:ch %gx (scry-path %chat /unreads/noun))
  =.  indices  (fix-dm-init-unreads indices unreads)
  refresh-all-summaries
++  fix-channel-init-unreads
  |=  [=indices:a =unreads:c]
  %-  ~(urn by indices)
  |=  [=source:a =index:a]
  ::  if we're a channel with only the %chan-init event, we need to set
  ::  the floor to the last-read time
  ?.  ?&  ?=(%channel -.source)
          ?=([[* [[%chan-init *] *]] ~ ~] stream.index)
      ==
    index
  ?~  channel=(~(get by unreads) nest.source)  index
  ?.  &(=(count.u.channel 0) =(~ unread.u.channel))  index
  ?~  last=(ram:on-event:a stream.index)  index
  index(floor.reads -.u.last)
++  fix-dm-init-unreads
  |=  [=indices:a =unreads:ch]
  ^-  indices:a
  %-  ~(urn by indices)
  |=  [=source:a =index:a]
  ::  if we're a DM with only the %dm-invite event, we need to set
  ::  the floor to the last-read time
  ?.  ?&  ?=(%dm -.source)
          ?=([[* [[%dm-invite *] *]] ~ ~] stream.index)
      ==
    index
  ?~  dm=(~(get by unreads) whom.source)  index
  ?.  &(=(count.u.dm 0) =(~ unread.u.dm))  index
  ?~  last=(ram:on-event:a stream.index)  index
  index(floor.reads -.u.last)
::  previously we used items as a way to track individual reads because
::  floors were not local, but we have reverted to local floors and not
::  tracking individual reads
::
++  sync-reads
  |=  [=indices:a =activity:a vs=volume-settings:a]
  =/  sources  (sort-sources:src ~(tap in ~(key by indices)))
  |-
  ?~  sources  [indices activity]
  =/  =source:a  i.sources
  =/  =index:a  (~(got by indices) source)
  =/  old-floor  floor.reads.index
  =/  old=(unit activity-summary:a)  (~(get by activity) source)
  ::  get all our reads, removing children
  =/  new-floor=time
    =-  st
    %^  (dip:on-read-items:a ,st=@da)  items.reads.index  floor.reads.index
    |=  [st=@da =time-id:a *]
    =/  event=(unit event:a)  (get:on-event:a stream.index time-id)
    ?~  event  [~ %.n st]
    ?:  child.u.event  [~ %.n st]
    [~ %.n ?:((gth time-id st) time-id st)]
  =.  reads.index  [new-floor ~]
  ::  with new reads, update our index and summary
  =.  indices  (~(put by indices) source index)
  =/  new-summary
    %+  ~(summarize-unreads urd indices activity vs log)
      source
    index
  =.  activity
    (~(put by activity) source new-summary)
  ?:  !=(?~(old ~ u.old(reads ~)) new-summary(reads ~))
    ~&  "%sync-reads: WARNING old and new summaries differ {<source>}"
    ~&  "old floor: {<old-floor>} new floor: {<new-floor>}"
    ~&  "old:  {<old>}"
    ~&  "new:  {<`new-summary>}"
    $(sources t.sources)
  $(sources t.sources)
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
  =;  idxs=^indexes
    |-
    ?~  idxs  next
    =*  source  source.i.idxs
    ::  cleanup old bad keys
    =?  cor  ?=(%dm-thread -.source)
      =/  old-source  source(key [id.key.source q.id.key.source])
      %=  cor
        indices  (~(del by indices) old-source)
        activity  (~(del by activity) old-source)
        volume-settings  (~(del by volume-settings) old-source)
      ==
    ::  update source + index, if new key create new index
    =.  cor  (refresh-index source index.i.idxs)
    $(idxs t.idxs)
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
    [[floor ~] bump.index]
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
::
::  when we migrated from chat and channels, originally we didn't set the
::  correct new default. if someone is still on the old default, we need
::  to set the new default for them.
::
++  adjust-old-default
  =/  base-volume  (~(gut by volume-settings) [%base ~] *volume-map:a)
  =/  soft  (~(got by old-volumes:a) %soft)
  ::  bail early if we've set something other than the old default
  ?.  =(soft base-volume)  cor
  =+  .^(=groups-ui:g %gx (scry-path %groups /groups/light/v1/noun))
  =/  groups  ~(tap by groups-ui)
  ::  iterate through all groups and set volume to old default
  |-
  ?~  groups
    ::  finally set the new default
    =.  volume-settings
      (~(put by volume-settings) [%base ~] default-volumes:a)
    cor
  =*  next  $(groups t.groups)
  =/  [=flag:g group=group-ui:g]  i.groups
  ?:  (~(has by volume-settings) [%group flag])  next
  =.  volume-settings  (~(put by volume-settings) [%group flag] soft)
  next
::
::  the original migration from old unreads and volume mgmt to %activity
::
++  migrate
  =.  importing  &
  =.  indices   (~(put by indices) [%base ~] *index:a)
  =.  cor  set-chat-reads
  =+  .^(=channels:c %gx (scry-path %channels /v3/channels/full/noun))
  =.  cor  (set-volumes channels)
  =.  cor  (set-channel-reads channels)
  =.  cor  refresh-all-summaries
  cor(importing |)
::
++  set-channel-reads
  |=  =channels:c
  ^+  cor
  =+  .^(=unreads:c %gx (scry-path %channels /v1/unreads/noun))
  =/  entries  ~(tap by unreads)
  =;  events=(list [time incoming-event:a])
    |-
    ?~  events
      cor(indices (fix-channel-init-unreads indices unreads))
    =.  cor  (%*(. add-event start-time -.i.events) +.i.events)
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
    %+  murn
      (tab:on-replies:c replies.u.u.post `(sub id 1) count)
    |=  [=time reply=(unit reply:c)]
    ^-  (unit [^time incoming-event:a])
    ?~  reply  ~
    %-  some
    =/  key=message-key:a
      :_  time
      [author.u.reply time]
    =/  parent=message-key:a
      :_  id-post
      [author.u.u.post id-post]
    =/  mention
      (was-mentioned:ch-utils content.u.reply our.bowl)
    [time %reply key parent nest group content.u.reply mention]
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
    ?~  events
      cor(indices (fix-dm-init-unreads indices unreads))
    =.  cor  (%*(. add-event start-time -.i.events) +.i.events)
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
  =.  cor
    %+  adjust  [%base ~]
    ::  use new default since we set all channels to old default
    ?:  =(%soft base.volume)  `default-volumes:a
    `(~(got by old-volumes:a) base.volume)
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
--

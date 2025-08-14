::  channels: diary, heap & chat channels for groups
::
::    this is the client side that pulls data from the channels-server.
::
::  XX  chat thread entries can no longer be edited.  maybe fix before
::      release?
::
::    note: all subscriptions are handled by the subscriber library so
::    we can have resubscribe loop protection.
::
/-  c=channels, g=groups, gv=groups-ver, ha=hark, activity, story
/-  meta
/+  default-agent, verb, dbug,
    neg=negotiate, discipline, logs,
    sparse, imp=import-aid
/+  utils=channel-utils, volume, s=subscriber, em=emojimart
::  performance, keep warm
/+  channel-json
::
/%  m-channel-heads           %channel-heads
/%  m-channel-heads-2         %channel-heads-2
/%  m-channel-perm            %channel-perm
/%  m-channel-post            %channel-post
/%  m-channel-post-2          %channel-post-2
/%  m-channel-post-3          %channel-post-3
/%  m-channel-posts           %channel-posts
/%  m-channel-posts-2         %channel-posts-2
/%  m-channel-posts-3         %channel-posts-3
/%  m-channel-replies         %channel-replies
/%  m-channel-replies-2       %channel-replies-2
/%  m-channel-replies-3       %channel-replies-3
/%  m-channel-reply           %channel-reply
/%  m-channel-reply-2         %channel-reply-2
/%  m-channel-response        %channel-response
/%  m-channel-response-2      %channel-response-2
/%  m-channel-response-3      %channel-response-3
/%  m-channel-said            %channel-said
/%  m-channel-said-1          %channel-said-1
/%  m-channel-scan            %channel-scan
/%  m-channel-simple-post     %channel-simple-post
/%  m-channel-simple-posts    %channel-simple-posts
::NOTE  these fail to build with /%, but can be built from dojo just fine.
::      presuming a mark filepath resolution bug in clay...
:: /%  m-channel-simple-replies  %channel-simple-replies
:: /%  m-channel-simple-reply    %channel-simple-reply
/%  m-channel-unread-update   %channel-unread-update
/%  m-channel-unreads         %channel-unreads
/%  m-channels                %channels
/%  m-channels-2              %channels-2
/%  m-channels-3              %channels-3
/%  m-hidden-posts            %hidden-posts
/%  m-hook-channel-preview    %hook-channel-preview
/%  m-toggle-post             %toggle-post
::
%-  %-  discipline
    :+  ::  marks
        ::
        :~  :+  %channel-heads           &  -:!>(*vale:m-channel-heads)
            :+  %channel-heads-2         &  -:!>(*vale:m-channel-heads-2)
            :+  %channel-perm            &  -:!>(*vale:m-channel-perm)
            :+  %channel-post            &  -:!>(*vale:m-channel-post)
            :+  %channel-post-2          &  -:!>(*vale:m-channel-post-2)
            :+  %channel-post-3          &  -:!>(*vale:m-channel-post-3)
            :+  %channel-posts           &  -:!>(*vale:m-channel-posts)
            :+  %channel-posts-2         &  -:!>(*vale:m-channel-posts-2)
            :+  %channel-posts-3         &  -:!>(*vale:m-channel-posts-3)
            :+  %channel-replies         &  -:!>(*vale:m-channel-replies)
            :+  %channel-replies-2       &  -:!>(*vale:m-channel-replies-2)
            :+  %channel-replies-3       &  -:!>(*vale:m-channel-replies-3)
            :+  %channel-reply           &  -:!>(*vale:m-channel-reply)
            :+  %channel-reply-2         &  -:!>(*vale:m-channel-reply-2)
            :+  %channel-response        &  -:!>(*vale:m-channel-response)
            :+  %channel-response-2      &  -:!>(*vale:m-channel-response-2)
            :+  %channel-response-3      &  -:!>(*vale:m-channel-response-3)
            :+  %channel-said            &  -:!>(*vale:m-channel-said)
            :+  %channel-said-1          &  -:!>(*vale:m-channel-said-1)
            :+  %channel-scan            &  -:!>(*vale:m-channel-scan)
            :+  %channel-simple-post     &  -:!>(*vale:m-channel-simple-post)
            :+  %channel-simple-posts    &  -:!>(*vale:m-channel-simple-posts)
            :: :+  %channel-simple-replies  &  -:!>(*vale:m-channel-simple-replies)
            :: :+  %channel-simple-reply    &  -:!>(*vale:m-channel-simple-reply)
            :+  %channel-unread-update   &  -:!>(*vale:m-channel-unread-update)
            :+  %channel-unreads         &  -:!>(*vale:m-channel-unreads)
            :+  %channels                &  -:!>(*vale:m-channels)
            :+  %channels-2              &  -:!>(*vale:m-channels-2)
            :+  %channels-3              &  -:!>(*vale:m-channels-3)
            :+  %hidden-posts            &  -:!>(*vale:m-hidden-posts)
            :+  %hook-channel-preview    &  -:!>(*vale:m-hook-channel-preview)
            :+  %toggle-post             &  -:!>(*vale:m-toggle-post)
        ==
      ::  facts
      ::
      :~  [/ %channel-response %toggle-post ~]
          [/said %channel-said %channel-denied ~]
          [/unreads %channel-unread-update ~]
        ::
          [/v0 %channel-response %toggle-post ~]
          [/v0/said %channel-said %channel-denied ~]
          [/v0/unreads %channel-unread-update ~]
        ::
          [/v1 %channel-response-2 %toggle-post ~]
          [/v1/hooks/preview %hook-channel-preview ~]  ::REVIEW
          [/v1/said %channel-said %channel-denied ~]
          [/v1/unreads %channel-unread-update ~]
        ::
          [/v2 %channel-response-3 ~]
          [/v2/said %channel-said-1 %channel-denied ~]
        ::
          [/v3/said %channel-said-1 %channel-denied ~]
      ==
    ::  scries
    ::
    :~  [/x/$/$/$/perm %channel-perm]
        [/x/$/$/$/posts %channel-posts]
        [/x/$/$/$/search %channel-scan]
        [/x/$/init %noun]
        [/x/channels %channels]
        [/x/init %noun]
        [/x/pins %channel-pins]
        [/x/unreads %channel-unreads]
      ::
        [/x/v0/$/$/$/posts %channel-simple-posts]
        [/x/v0/$/$/$/posts/post %channel-simple-post]
        [/x/v0/$/$/$/posts/post/id/$/replies %channel-simple-replies]
        [/x/v0/$/$/$/posts/post/id/$/replies/reply %channel-simple-reply]
        [/x/v0/channels %channels]
        [/x/v0/hidden-posts %hidden-posts]
        [/x/v0/unreads %channel-unreads]
      ::
        [/x/v1/$/$/$/posts %channel-posts]
        [/x/v1/$/$/$/posts/post %channel-post]
        [/x/v1/$/$/$/posts/post/id/$/replies %channel-replies]
        [/x/v1/$/$/$/posts/post/id/$/replies/reply %channel-reply]
        [/x/v1/channels %channels]
        [/x/v1/hidden-posts %hidden-posts]
        [/x/v1/unreads %channel-unreads]
      ::
        [/x/v2/$/$/$/posts %channel-posts-2]
        [/x/v2/$/$/$/posts/post %channel-post-2]
        [/x/v2/$/$/$/posts/post/id/$/replies %channel-replies-2]
        [/x/v2/$/$/$/posts/post/id/$/replies/reply %channel-reply]
        [/x/v2/channels %channels-2]
        [/x/v2/heads %channel-heads]
      ::
        [/x/v3/$/$/$/posts %channel-posts-3]
        [/x/v3/$/$/$/posts/post %channel-post-3]
        [/x/v3/$/$/$/posts/post/id/$/replies %channel-replies-3]
        [/x/v3/$/$/$/posts/post/id/$/replies/reply %channel-reply-2]
        [/x/v3/channels %channels-3]
        [/x/v3/heads %channel-heads-2]
        [/x/v3/said %noun]
        [/x/v3/v-channels %noun]
    ==
::
=/  verbose  |
%-  %-  agent:neg
    :+  notify=&
      [~.channels^%2 ~ ~]
    %-  my
    :~  %groups^[~.groups^%1 ~ ~]
        %channels-server^[~.channels^%2 ~ ~]
    ==
%-  agent:dbug
%+  verb  |
::
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  current-state
    $:  %9
        =v-channels:c
        voc=(map [nest:c plan:c] (unit said:c))
        hidden-posts=(set id-post:c)
      ::
        ::  .pending-ref-edits: for migration, see also +poke %negotiate-notif
        ::
        pending-ref-edits=(jug ship [=kind:c name=term])
        :: delayed resubscribes
        =^subs:s
        =pimp:imp
    ==
  --
=|  current-state
=*  state  -
=<
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %|) bowl)
      log   ~(. logs [our.bowl /logs])
      cor   ~(. +> [bowl ~])
  ++  on-init
    ^-  (quip card _this)
    =^  cards  state
      abet:init:cor
    [cards this]
  ::
  ++  on-save  !>([state])
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
  ++  on-peek    peek:cor
  ++  on-leave   on-leave:def
  ++  on-fail
    |=  [=term =tang]
    ^-  (quip card _this)
    %-  (slog term tang)
    :_  this
    [(fail:log term tang ~)]~
  ::
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    =^  cards  state
      abet:(agent:cor wire sign)
    [cards this]
  ::
  ++  on-arvo
    |=  [=wire sign=sign-arvo]
    ^-  (quip card _this)
    =^  cards  state
      abet:(arvo:cor wire sign)
    [cards this]
  --
|_  [=bowl:gall cards=(list card)]
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  server  (cat 3 dap.bowl '-server')
++  log
  |=  msg=(trap tape)
  ?.  verbose  same
  (slog leaf+"%{(trip dap.bowl)} {(msg)}" ~)
::
::  does not overwite if wire and dock exist.  maybe it should
::  leave/rewatch if the path differs?
::
++  safe-watch
  |=  [=wire =dock =path]
  |=  delay=?
  ^+  cor
  ?:  (~(has by wex.bowl) wire dock)  cor
  =^  caz=(list card)  subs
    (~(subscribe s [subs bowl]) wire dock path delay)
  (emil caz)
::
++  load
  |^  |=  =vase
  ^+  cor
  =+  !<(old=versioned-state vase)
  =?  old  ?=(%0 -.old)  (state-0-to-1 old)
  =?  old  ?=(%1 -.old)  (state-1-to-2 old)
  =?  old  ?=(%2 -.old)  (state-2-to-3 old)
  =?  old  ?=(%3 -.old)  (state-3-to-4 old)
  =?  old  ?=(%4 -.old)  (state-4-to-5 old)
  =?  old  ?=(%5 -.old)  (state-5-to-6 old)
  =?  old  ?=(%6 -.old)  (state-6-to-7 old)
  =?  old  ?=(%7 -.old)  (state-7-to-8 old)
  =^  caz-8=(list card)  old
    ?.  ?=(%8 -.old)  [~ old]
    :_  old(- %9)
    %+  turn  ~(tap in ~(key by v-channels.old))
    |=  =nest:c
    ^-  card
    :+  %pass
      /numbers/[kind.nest]/(scot %p ship.nest)/[name.nest]
    ::  slightly staggered to spread load. might not be strictly necessary
    ::  for this, but good practice.
    ::
    [%arvo %b %wait (add now.bowl (~(rad og (sham our.bowl nest)) ~m15))]
  =.  cor  (emil caz-8)
  ?>  ?=(%9 -.old)
  =.  state  old
  inflate-io
  ::
  +$  versioned-state
    $%  state-9
        state-8
        state-7
        state-6
        state-5
        state-4
        state-3
        state-2
        state-1
        state-0
    ==
  +$  state-9  current-state
  +$  state-8
    $:  %8
        =v-channels:c
        voc=(map [nest:c plan:c] (unit said:c))
        hidden-posts=(set id-post:c)
      ::
        ::  .pending-ref-edits: for migration, see also +poke %negotiate-notif
        ::
        pending-ref-edits=(jug ship [=kind:c name=term])
        :: delayed resubscribes
        =^subs:s
        =pimp:imp
    ==
  +$  state-7
    $:  %7
        =v-channels:v7:old:c
        voc=(map [nest:c plan:c] (unit said:v7:old:c))
        hidden-posts=(set id-post:c)
      ::
        ::  .pending-ref-edits: for migration, see also +poke %negotiate-notif
        ::
        pending-ref-edits=(jug ship [=kind:c name=term])
        :: delayed resubscribes
        =^subs:s
        =pimp:imp
    ==
  +$  state-6
    $:  %6
        =v-channels:v6:old:c
        voc=(map [nest:c plan:c] (unit said:v7:old:c))
        hidden-posts=(set id-post:c)
      ::
        ::  .pending-ref-edits: for migration, see also +poke %negotiate-notif
        ::
        pending-ref-edits=(jug ship [=kind:c name=term])
        :: delayed resubscribes
        =^subs:s
        =pimp:imp
    ==
  ++  state-7-to-8
    |=  s=state-7
    ^-  state-8
    %=  s  -  %8
      v-channels  (v-channels-7-to-8:utils v-channels.s)
      voc  (~(run by voc.s) |=(s=(unit said:v7:old:c) ?~(s ~ `(said-7-to-8:utils u.s))))
    ==
  ::
  ++  state-6-to-7
    |=  s=state-6
    ^-  state-7
    s(- %7, v-channels (v-channels-6-to-7 v-channels.s))
  ++  v-channels-6-to-7
    |=  vc=v-channels:v6:old:c
    ^-  v-channels:v7:old:c
    %-  ~(run by vc)
    |=  v=v-channel:v6:old:c
    v(pending [pending.v *last-updated:c])
  ::
  +$  state-5
    ::XX versioning: expose correct types
    :: by stacking a number of =,
    ::
    :: =,  v5:old:c
    $:  %5
        =v-channels:v6:old:c
        voc=(map [nest:c plan:c] (unit said:v7:old:c))
        hidden-posts=(set id-post:c)
      ::
        ::  .pending-ref-edits: for migration, see also +poke %negotiate-notif
        ::
        pending-ref-edits=(jug ship [=kind:c name=term])
        :: delayed resubscribes
        =^subs:s
    ==
  ::
  ++  state-5-to-6
    |=  state-5
    ^-  state-6
    [%6 v-channels voc hidden-posts pending-ref-edits subs *pimp:imp]
  ::
  +$  state-4
    $:  %4
        =v-channels:v6:old:c
        voc=(map [nest:c plan:c] (unit said:v7:old:c))
        pins=(list nest:c)
        hidden-posts=(set id-post:c)
        pending-ref-edits=(jug ship [=kind:c name=term])
        =^subs:s
    ==
  ::
  ++  state-4-to-5
    |=  state-4
    ^-  state-5
    [%5 v-channels voc hidden-posts pending-ref-edits subs]
  ::
  +$  state-3
    $:  %3
        v-channels=(map nest:c v-channel-2)
        voc=(map [nest:c plan:c] (unit said:v7:old:c))
        pins=(list nest:c)  ::TODO  vestigial, in groups-ui now, remove me
        hidden-posts=(set id-post:c)
      ::
        ::  .pending-ref-edits: for migration, see also +poke %negotiate-notif
        ::
        pending-ref-edits=(jug ship [=kind:c name=term])
        :: delayed resubscribes
        =^subs:s
    ==
  ::
  +$  state-2
    $:  %2
        v-channels=(map nest:c v-channel-2)
        voc=(map [nest:c plan:c] (unit said:v7:old:c))
        pins=(list nest:c)  ::TODO  vestigial, in groups-ui now, remove me
        hidden-posts=(set id-post:c)
      ::
        ::  .pending-ref-edits: for migration, see also +poke %negotiate-notif
        ::
        pending-ref-edits=(jug ship [=kind:c name=term])
    ==
  +$  state-1
    $:  %1
        v-channels=(map nest:c v-channel-1)
        voc=(map [nest:c plan:c] (unit said:v7:old:c))
        pins=(list nest:c)
        hidden-posts=(set id-post:c)
    ==
  ++  state-3-to-4
    |=  s=state-3
    ^-  state-4
    s(- %4, v-channels (~(run by v-channels.s) v-channel-2-to-3))
  ++  state-2-to-3
    |=  s=state-2
    ^-  state-3
    %=  s  -  %3
        pending-ref-edits  [pending-ref-edits.s *^subs:^s]
    ==
  ++  v-channel-1
    |^  ,[global local]
    +$  global
      $:  posts=v-posts-1
          order=(rev:c order=arranged-posts:c)
          view=(rev:c =view:c)
          sort=(rev:c =sort:c)
          perm=(rev:c =perm:c)
      ==
    +$  window    window:v-channel:c
    +$  future    [=window diffs=(jug id-post:c u-post-1)]
    +$  local     [=net:c log=log-1 =remark:v7:old:c =window =future]
    --
  ::
  ++  v-channel-2
    |^  ,[global:v-channel:v7:old:c local]
    +$  local
      $:  =net:c
          =log:v7:old:c
          =remark:v7:old:c
          =window:v-channel:c
          =future:v-channel:v7:old:c
      ==
    --
  ::
  +$  log-1           ((mop time u-channel-1) lte)
  ++  log-on-1        ((on time u-channel-1) lte)
  +$  u-channel-1     $%  $<(%post u-channel:v7:old:c)
                          [%post id=id-post:c u-post=u-post-1]
                      ==
  +$  u-post-1        $%  $<(?(%set %reply) u-post:v7:old:c)
                          [%set post=(unit v-post-1)]
                          [%reply id=id-reply:c u-reply=u-reply-1]
                      ==
  +$  u-reply-1       $%  $<(%set u-reply:v7:old:c)
                          [%set reply=(unit v-reply-1)]
                      ==
  +$  v-posts-1       ((mop id-post:c (unit v-post-1)) lte)
  ++  on-v-posts-1    ((on id-post:c (unit v-post-1)) lte)
  +$  v-post-1        [v-seal-1 (rev:c essay:v7:old:c)]
  +$  v-seal-1        [id=id-post:c replies=v-replies-1 reacts=v-reacts:v7:old:c]
  +$  v-replies-1     ((mop id-reply:c (unit v-reply-1)) lte)
  ++  on-v-replies-1  ((on id-reply:c (unit v-reply-1)) lte)
  +$  v-reply-1       [v-reply-seal:v7:old:c memo:v7:old:c]
  ++  state-1-to-2
    |=  s=state-1
    ^-  state-2
    =/  pend=(jug ship [=kind:c name=term])
      %-  ~(gas ju *(jug ship [kind:c term]))
      %+  turn  ~(tap in ~(key by v-channels.s))
      |=(nest:c [ship kind name])
    %=  s
      -  %2
      v-channels    (~(run by v-channels.s) v-channel-1-to-2)
      hidden-posts  [hidden-posts.s pend]
    ==
  ++  v-channel-2-to-3
    |=  v=v-channel-2
    ^-  v-channel:v6:old:c
    v(future [future.v *pending-messages:v7:old:c])
  ++  v-channel-1-to-2
    |=  v=v-channel-1
    ^-  v-channel-2
    %=  v
      posts   (v-posts-1-to-2 posts.v)
      log     (log-1-to-2 log.v)
      future  (future-1-to-2 future.v)
    ==
  ++  log-1-to-2
    |=  l=log-1
    (run:log-on-1 l u-channel-1-to-2)
  ++  u-channel-1-to-2
    |=  u=u-channel-1
    ^-  u-channel:v7:old:c
    ?.  ?=([%post *] u)  u
    u(u-post (u-post-1-to-2 u-post.u))
  ++  future-1-to-2
    |=  f=future:v-channel-1
    ^-  future:v-channel:v7:old:c
    f(diffs (~(run by diffs.f) |=(s=(set u-post-1) (~(run in s) u-post-1-to-2))))
  ++  u-post-1-to-2
    |=  u=u-post-1
    ^-  u-post:v7:old:c
    ?+  u  u
      [%set ~ *]           u(u.post (v-post-1-to-2 u.post.u))
      [%reply * %set ~ *]  u(u.reply.u-reply (v-reply-1-to-2 u.reply.u-reply.u))
    ==
  ++  v-posts-1-to-2
    |=  p=v-posts-1
    %+  run:on-v-posts-1  p
    |=(p=(unit v-post-1) ?~(p ~ `(v-post-1-to-2 u.p)))
  ++  v-post-1-to-2
    |=(p=v-post-1 p(replies (v-replies-1-to-2 replies.p)))
  ++  v-replies-1-to-2
    |=  r=v-replies-1
    %+  run:on-v-replies-1  r
    |=(r=(unit v-reply-1) ?~(r ~ `(v-reply-1-to-2 u.r)))
  ++  v-reply-1-to-2
    |=(r=v-reply-1 `v-reply:v7:old:c`[-.r 0 +.r])
  ::
  ::  %0 to %1
  ::
  +$  state-0
    $:  %0
        v-channels=(map nest:c v-channel-0)
        voc=(map [nest:c plan:c] (unit said:v7:old:c))
        pins=(list nest:c)
        hidden-posts=(set id-post:c)
    ==
  ++  v-channel-0
    |^  ,[global:v-channel-1 local]
    +$  window    window:v-channel:c
    +$  future    [=window diffs=(jug id-post:c u-post-1)]
    +$  local     [=net:c log=log-1 remark=remark-0 =window =future]
    --
  +$  remark-0  [last-read=time watching=_| unread-threads=(set id-post:c)]
  ::
  ++  state-0-to-1
    |=  s=state-0
    ^-  state-1
    s(- %1, v-channels (~(run by v-channels.s) v-channel-0-to-1))
  ++  v-channel-0-to-1
    |=  v=v-channel-0
    ^-  v-channel-1
    =/  recency=time
      ?~(tim=(ram:on-v-posts-1 posts.v) *time key.u.tim)
    v(remark [recency remark.v])
  --
::
++  init
  ^+  cor
  ::NOTE  poking diary/heap/chat with %*-migrate is done by channels-server,
  ::      because it is important the server migration happens before those
  ::      happen. that way, local subs get established without issue.
  inflate-io
::
++  unsubscribe
  |=  [=wire =dock]
  ^+  cor
  =^  caz=(list card)  subs
    (~(unsubscribe s [subs bowl]) wire dock)
  (emil caz)
++  inflate-io
  ::  leave all subscriptions we don't recognize
  ::
  =.  cor
    %+  roll
      ~(tap by wex.bowl)
    |=  [[[=(pole knot) sub-ship=ship =dude:gall] acked=? =path] core=_cor]
    =.  cor  core
    =/  keep=?
      ?+    pole  |
          [%groups *]  &(=(%groups dude) =(our.bowl ship) =(/groups path))
          [=kind:c ship=@ name=@ %updates ~]
        ?.  =(server dude)  |
        ?.  =((scot %p sub-ship) ship.pole)  |
        ?~  diary=(~(get by v-channels) kind.pole sub-ship name.pole)  |
        ?.  ?=([kind:c @ %updates ?(~ [@ ~])] path)  |
        ?.  =(kind.pole i.path)  |
        =(name.pole i.t.path)
      ::
          [=kind:c ship=@ name=@ %checkpoint ~]
        ?.  =(server dude)  |
        ?.  =((scot %p sub-ship) ship.pole)  |
        ?~  diary=(~(get by v-channels) kind.pole sub-ship name.pole)  |
        ?.  ?=([kind:c @ %checkpoint %before @] path)  |
        ?.  =(kind.pole i.path)  |
        =(name.pole i.t.path)
      ::
          [%said =kind:c ship=@ name=@ %post time=@ reply=?(~ [@ ~])]
        ?.  =(server dude)  |
        ?.  =((scot %p sub-ship) ship.pole)  |
        ?~  pplan=(slaw %ud time.pole)  |
        =/  qplan=(unit (unit time))
          ?~  reply.pole  `~
          ?~  q=(slaw %ud -.reply.pole)  ~
          ``u.q
        ?~  qplan  |
        ?.  (~(has by voc) [kind.pole sub-ship name.pole] u.pplan u.qplan)  |
        =(wire path)
      ==
    ?:  keep  cor
    (unsubscribe pole [sub-ship dude])
  ::
  ::  watch all the subscriptions we expect to have
  ::
  =.  cor  (watch-groups |)
  ::
  =.  cor
    %+  roll
      ~(tap by v-channels)
    |=  [[=nest:c *] core=_cor]
    ca-abet:(ca-safe-sub:(ca-abed:ca-core:core nest) |)
  ::
  cor
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+    mark  ~|(bad-poke+mark !!)
      %noun
    ?+  q.vase  !!
        [%channel-wake @ @]
      =+  ;;([=kind:c name=term] +.q.vase)
      =/  =nest:c  [kind src.bowl name]
      ?.  (~(has by v-channels) nest)  cor
      ca-abet:(ca-safe-sub:(ca-abed:ca-core nest) |)
    ::
        %pimp-ready
      ?>  =(our src):bowl
      ?-  pimp
        ~         cor(pimp `&+~)
        [~ %& *]  cor
        [~ %| *]  (run-import p.u.pimp)
      ==
    ::
        [%sequence-numbers * @ *]
      =+  ;;([%sequence-numbers =nest:c count=@ud seqs=(list [id=id-post:c seq=(unit @ud)])] q.vase)
      ?>  =(src.bowl ship.nest)
      ?.  (~(has by v-channels) nest)  cor
      =.  v-channels
        %+  ~(jab by v-channels)  nest
        |=  channel=v-channel:c
        =.  count.channel  count
        |-
        ?~  seqs  channel
        =*  next  $(seqs t.seqs)
        ?~  seq.i.seqs
          =.  posts.channel
            (put:on-v-posts:c posts.channel id.i.seqs ~)
          next
        ?~  p=(get:on-v-posts:c posts.channel id.i.seqs)  next
        ?~  u.p  next
        =.  posts.channel
          (put:on-v-posts:c posts.channel id.i.seqs u.p(seq.u u.seq.i.seqs))
        next
      cor
    ==
  ::
    :: TODO: add transfer/import channels
      ?(%channel-action %channel-action-1)
    =/  =a-channels:c
      ?.  ?=(%channel-action mark)
        !<(a-channels:c vase)
      =+  !<(old-a-channels=a-channels:v7:old:c vase)
      ::  upconvert old %create action
      ?:  ?=([%create *] old-a-channels)
        :-  %create
        =>  create-channel.old-a-channels
        :*  kind
            name
            group
            title
            description
            ~  ::  meta
            readers
            writers
        ==
      ?.  ?=([%channel *] old-a-channels)
        old-a-channels
      ::  upconvert old %channel action
      ::
      ?+    a-channel.old-a-channels  old-a-channels
        ::
          [%post %add *]
        %=    old-a-channels
            essay.c-post.a-channel
          (essay-7-to-8:utils essay.c-post.a-channel.old-a-channels)
        ==
        ::
          [%post %edit *]
        %=    old-a-channels
            essay.c-post.a-channel
          (essay-7-to-8:utils essay.c-post.a-channel.old-a-channels)
        ==
        ::
          [%post %add-react *]
        %=  old-a-channels
            q.c-post.a-channel
          ^-  react:c
          =*  react  q.c-post.a-channel.old-a-channels
          ?~  react=(kill:em react)
            [%any ^react]
          u.react
        ==
        ::
          [%post %reply * %add *]
        %=    old-a-channels
            memo.c-reply.c-post.a-channel
          (memo-7-to-8:utils memo.c-reply.c-post.a-channel.old-a-channels)
        ==
        ::
          [%post %reply * %edit *]
        %=    old-a-channels
            memo.c-reply.c-post.a-channel
          (memo-7-to-8:utils memo.c-reply.c-post.a-channel.old-a-channels)
        ==
        ::
          [%post %reply * %add-react *]
        %=  old-a-channels
            q.c-reply.c-post.a-channel
          ^-  react:c
          =*  react  q.c-reply.c-post.a-channel.old-a-channels
          ?~  react=(kill:em react)
            [%any ^react]
          u.react
        ==
      ==
    ?:  ?=(%create -.a-channels)
      ca-abet:(ca-create:ca-core create-channel.a-channels)
    ?:  ?=(%pin -.a-channels)
      ~&  %channels-vestigial-pin-action
      ?>  from-self
      cor
    ?:  ?=(%toggle-post -.a-channels)
      ?>  from-self
      (toggle-post toggle.a-channels)
    ?:  ?=(%join -.a-channel.a-channels)
      ca-abet:(ca-join:ca-core [nest group.a-channel]:a-channels)
    ca-abet:(ca-a-channel:(ca-abed:ca-core nest.a-channels) a-channel.a-channels)
  ::
      %channel-request-join
    =+  !<([=nest:c =flag:g] vase)
    ca-abet:(ca-join:ca-core nest flag)
  ::
      %channel-migration
    ?>  =(our src):bowl
    =+  !<(new-channels=v-channels:c vase)
    =.  v-channels
      %+  roll  ~(tap by new-channels)
      |=  [[n=nest:c c=v-channel:c] =_v-channels]
      ?~  hav=(~(get by v-channels) n)
        (~(put by v-channels) n c)
      ::  if we already have the channel, only replace it with the import if
      ::  the one we have right now is empty. otherwise, keep what we already
      ::  have, lest we lose newer data.
      ::
      ?.  =(~ posts.u.hav)  v-channels
      (~(put by v-channels) n c)
    ::  after migration, references to chat msgs have changed. we want to
    ::  notify the host about these edits, but not right now: we aren't sure
    ::  they have migrated yet. store affected channels in state, we will send
    ::  edits on a per-host basis when handling %negotiate-notification below.
    ::
    =.  pending-ref-edits
      %-  ~(gas ju pending-ref-edits)
      ^-  (list [ship kind:c term])
      %+  turn  ~(tap in ~(key by new-channels))
      |=(nest:c [ship kind name])
    inflate-io
  ::
      %channel-migration-pins
    ?>  =(our src):bowl
    =+  !<(new-pins=(list nest:c) vase)
    cor
  ::
      %negotiate-notification
    ::  during migration, references to chat msgs were changed. we want to
    ::  notify channel hosts about these edits, but not before they themselves
    ::  have migrated (lest we risk front-running their internal migration
    ::  pokes, causing our edits to fail).
    ::  a version negotiation notification guarantees that they have migrated,
    ::  so based off that we trigger the editing of our messages that changed.
    ::  (see also %*-migrate-refs poke handling in the old agents.)
    ::
    ?>  =(our src):bowl
    =+  !<([match=? =gill:gall] vase)
    ?.  match
      cor
    ?.  =(%channels-server q.gill)
      cor
    =*  host  p.gill
    ?~  pend=(~(get by pending-ref-edits) host)
      cor
    =.  pending-ref-edits
      (~(del by pending-ref-edits) host)
    %-  emil
    %+  turn  ~(tap by u.pend)
    |=  [=kind:c name=term]
    ^-  card
    :+  %pass   /migrate
    :+  %agent  [our.bowl kind]
    :+  %poke
      ::NOTE  %chat-migrate-refs, etc
      (cat 3 kind '-migrate-refs')
    !>([host name])
  ::
      %egg-any
    =+  !<(=egg-any:gall vase)
    ?-  pimp
      ~         cor(pimp `|+egg-any)
      [~ %& *]  (run-import egg-any)
      [~ %| *]  ~&  [dap.bowl %overwriting-pending-import]
                cor(pimp `|+egg-any)
    ==
  ==
  ++  toggle-post
    |=  toggle=post-toggle:c
    ^+  cor
    =.  hidden-posts
      ?-  -.toggle
        %hide  (~(put in hidden-posts) id-post.toggle)
        %show  (~(del in hidden-posts) id-post.toggle)
      ==
    (give %fact ~[/ /v0 /v1] toggle-post+!>(toggle))
  ::
::
++  run-import
  |=  =egg-any:gall
  ^+  cor
  =.  pimp  ~
  ?-  -.egg-any
      ?(%15 %16)
    ?.  ?=(%live +<.egg-any)
      ~&  [dap.bowl %egg-any-not-live]
      cor
    =/  bak
      (load -:!>(*versioned-state:load) +>.old-state.egg-any)
    ::  restore as much data as we can. we don't restart subscriptions here,
    ::  we wait for the groups agent to tell us which ones to re-join.
    ::
    =.  v-channels    (~(uni by v-channels:bak) v-channels)
    =.  voc           (~(uni by voc:bak) voc)
    =.  hidden-posts  (~(uni in hidden-posts:bak) hidden-posts)
    (emil (prod-next:imp [our dap]:bowl))
  ==
++  watch
  |=  =(pole knot)
  ^+  cor
  =?  pole  !?=([?(%v0 %v1 %v2 %v3) *] pole)
    [%v0 pole]
  ?+  pole  ~|(bad-watch-path+`path`pole !!)
    [?(%v0 %v1 %v2) ~]                    ?>(from-self cor)
    [?(%v0 %v1) %unreads ~]               ?>(from-self cor)
    [?(%v0 %v1 %v2) =kind:c ship=@ name=@ ~]  ?>(from-self cor)
  ::
      [%v1 %hooks %preview =kind:c host=@ name=@ ~]
    =/  host=ship   (slav %p host.pole)
    =/  =path  /v0/hooks/preview/[kind.pole]/[name.pole]
    ((safe-watch pole [host %channels-server] path) |)
  ::
      [?(%v0 %v1 %v2) %said =kind:c host=@ name=@ %post time=@ reply=?(~ [@ ~])]
    =/  host=ship   (slav %p host.pole)
    =/  =nest:c     [kind.pole host name.pole]
    =/  =plan:c     =,(pole [(slav %ud time) ?~(reply ~ `(slav %ud -.reply))])
    (watch-said host nest plan -.pole)
  ::
      [%v3 %said ask=@ =kind:c host=@ name=@ %post time=@ reply=?(~ [@ ~])]
    ::NOTE  best used through /ted/contact-pins or similar
    =/  ask=ship    (slav %p ask.pole)
    =/  host=ship   (slav %p host.pole)
    =/  =nest:c     [kind.pole host name.pole]
    =/  =plan:c     =,(pole [(slav %ud time) ?~(reply ~ `(slav %ud -.reply))])
    (watch-said ask nest plan %v3)
  ==
::
++  watch-said
  |=  [ask=ship =nest:c =plan:c ver=?(%v0 %v1 %v2 %v3)]
  ^+  cor
  ::  if we have the data locally, give it
  ::
  ?:  ?&  (~(has by v-channels) nest)
          (ca-know-said:(ca-abed:ca-core nest) plan)
      ==
    ?-  ver
      ?(%v0 %v1)  ca-abet:(ca-said-1:(ca-abed:ca-core nest) plan)
      ?(%v2 %v3)  ca-abet:(ca-said-2:(ca-abed:ca-core nest) plan)
    ==
  ::  if we don't have the data locally, ask the target for latest,
  ::  but don't go over the network on behalf of someone else.
  ::  if the target is the host, ask channels-server, if not, ask channels.
  ::  we don't give the response from cache here. if the subscriber wanted
  ::  an instant response from cache, they could've scried for it.
  ::
  ?>  |(from-self =(ask our.bowl))
  =/  [=wire =dude:gall =path]
    =/  base=path  (said-path nest plan)
    ::  v3 subscriptions will _always_ ask the client agent,
    ::  because they want to hit the logic that circumvents channel permissions
    ::  for pinned posts
    ::
    ?:  &(=(ask ship.nest) !?=(%v3 ver))
      [base server base]
    ::NOTE  attention! we subscribe to other "client agent" instances here.
    ::      uncommon pattern, very "soft". expect subscription failure and
    ::      handle it gracefully.
    [base dap.bowl [%v2 base]]
  ((safe-watch wire [ask dude] path) |)
::
++  said-path
  |=  [=nest:c =plan:c]
  ^-  path
  %+  welp
    /said/[kind.nest]/(scot %p ship.nest)/[name.nest]/post/(scot %ud p.plan)
  ?~(q.plan / /(scot %ud u.q.plan))
::
++  take-said
  |=  [=nest:c =plan:c =sign:agent:gall]
  =/  =path  (said-path nest plan)
  ^+  cor
  ?+    -.sign  !!
      %watch-ack
    ?~  p.sign  cor
    %-  (slog leaf+"Preview failed" u.p.sign)
    ::  treat subscription failures as if we received a %channel-denied
    ::
    $(sign [%fact %channel-denied !>(~)])
  ::
      %kick
    ?:  (~(has by voc) nest plan)
      cor  :: subscription ended politely
    (give %kick ~[path v0+path v1+path v2+path] ~)
  ::
      %fact
    ::  we update state only if we learn anything new
    ::
    =/  had=(unit said:c)
      (~(gut by voc) [nest plan] ~)
    =/  got=(unit said:c)
      ?+  p.cage.sign  ~|(funny-mark+p.cage.sign !!)
        %channel-denied  ~
        %channel-said    `(said-7-to-8:utils !<(=said:v7:old:c q.cage.sign))
        %channel-said-1  `!<(=said:c q.cage.sign)
      ==
    =.  voc
      %+  ~(put by voc)  [nest plan]
      %^  clap  had  got
      |=  [h=said:c g=said:c]
      g  ::TODO  can we pick the "latest" version? we have no .rev numbers...
    ::  give the fact exactly as we got it
    ::TODO  should v3 give what ended up going into state?
    ::
    =.  cor
      %^  give  %fact
        ~[path v0+path v1+path]
      ?~  got  cage.sign
      channel-said+!>((to-said-1:utils u.got))
    =/  v3-path
      [%v3 %said (scot %p src.bowl) (tail path)]
    =.  cor
      %^  give  %fact
        ~[v2+path v3-path]
      ?~  got  cage.sign
      channel-said-1+!>(u.got)
    ::  they all got their responses, so kick their subscriptions,
    ::  and make sure we leave ours so we can do another fetch later.
    ::  (we don't know what agent we subscribed to, but it's fine, we can
    ::  just leave both.)
    ::
    =.  cor  (give %kick ~[path v0+path v1+path v2+path v3-path] ~)
    %-  emil
    :~  [%pass path %agent [src.bowl dap.bowl] %leave ~]
        [%pass path %agent [src.bowl server] %leave ~]
    ==
  ==
::
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+    pole  ~|(bad-agent-wire+pole !!)
      ~          cor
      [%pimp ~]  cor
      [%logs ~]  cor
  ::
      [%numbers *]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign
      ::  they accepted, we will receive the sequence numbers
      ::
      cor
    ::  they refused, we will retry again later
    ::
    =/  stagger=@dr
      (~(rad og (sham our.bowl pole)) ~m15)
    (emit [%pass pole %arvo %b %wait :(add now.bowl ~h1 stagger)])
  ::
      [%hark ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  cor
    %-  (slog leaf+"Failed to hark" u.p.sign)
    cor
  ::
      [%activity %submit ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  cor
    %-  (slog leaf+"{<dap.bowl>} failed to submit activity" u.p.sign)
    cor
  ::
      [%contacts @ ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  cor
    %-  (slog leaf+"Failed to add contacts" u.p.sign)
    cor
  ::
      [=kind:c ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    ca-abet:(ca-agent:(ca-abed:ca-core kind.pole ship name.pole) rest.pole sign)
  ::
      [%said =kind:c host=@ name=@ %post time=@ reply=?(~ [@ ~])]
    =/  host=ship   (slav %p host.pole)
    =/  =nest:c     [kind.pole host name.pole]
    =/  =plan:c     =,(pole [(slav %ud time) ?~(reply ~ `(slav %ud -.reply))])
    (take-said nest plan sign)
  ::
      [%groups ~]
    ?+    -.sign  !!
        %kick       (watch-groups &)
        %watch-ack
      ?~  p.sign
        cor
      =/  =tank
        leaf+"Failed groups subscription in {<dap.bowl>}, unexpected"
      ((slog tank u.p.sign) cor)
    ::
        %fact
      (take-groups !<(=r-groups:v7:gv q.cage.sign))
    ==
  ::
      [%migrate ~]
    ?+  -.sign  !!
        %poke-ack
      ?~  p.sign  cor
      %-  (slog 'channels: migration poke failure' >wire< u.p.sign)
      cor
    ==
  ::
      [%v1 %hooks %preview =kind:c host=@ name=@ ~]
    ?+  -.sign  !!
        %kick  cor
        %fact
      =.  cor  (give %fact ~[pole] cage.sign)
      (emit %pass pole %agent [host.pole %channels] %leave ~)
    ::
        %watch-ack
      ?~  p.sign  cor
      ((slog leaf+"Preview failed" u.p.sign) cor)
    ==
  ==
::
++  watch-groups  (safe-watch /groups [our.bowl %groups] /v1/groups)
::  +take-groups: process group update
::
++  take-groups
  |=  =r-groups:v7:gv
  =*  flag  flag.r-groups
  =/  affected=(list nest:c)
    %+  murn  ~(tap by v-channels)
    |=  [=nest:c channel=v-channel:c]
    ?.  =(flag group.perm.perm.channel)  ~
    `nest
  =*  r-group  r-group.r-groups
  ?+    r-group  cor
      [%seat * %add-roles *]       (recheck-perms affected ~)
      [%seat * %del-roles *]       (recheck-perms affected ~)
      [%channel * %edit *]         (recheck-perms affected ~)
      [%channel * %add-readers *]  (recheck-perms affected ~)
      [%channel * %del-readers *]  (recheck-perms affected ~)
  ::
      [%role * %del *]
    (recheck-perms affected roles.r-group)
  ==
::
++  recheck-perms
  |=  [affected=(list nest:c) sects=(set sect:v0:gv)]
  ~&  "%channel recheck permissions for {<affected>}"
  %+  roll  affected
  |=  [=nest:c co=_cor]
  =/  ca  (ca-abed:ca-core:co nest)
  ca-abet:(ca-recheck:ca sects)
::
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?>  ?=(^ pole)
  =?  +.pole  !?=([?(%v0 %v1 %v2 %v3 %v4) *] +.pole)
    [%v0 +.pole]
  ?+    pole  [~ ~]
    ::
    ::    /x/v/channels: get unversioned channels
    ::
      [%x ?(%v0 %v1) %channels ~]
    ``channels+!>(`channels-0:c`(uv-channels-1:utils v-channels))
    ::
      [%x %v2 %channels full=?(~ [%full ~])]
    ``channels-2+!>(`channels:v1:old:c`(uv-channels:utils v-channels ?=(^ full.pole)))
    ::
      [%x %v3 %v-channels ~]
    ``noun+!>(v-channels)
    ::
      [%x %v3 %channels full=?(~ [%full ~])]
    ``channels-3+!>(`channels:c`(uv-channels-2:utils v-channels ?=(^ full.pole)))
    ::
    ::  /x/v/init: get unreads and unversioned channels
    ::
      [%x ?(%v0 %v1) %init ~]
    ``noun+!>([unreads (uv-channels-1:utils v-channels)])
    ::
      [%x %v2 %init ~]
    ``noun+!>([unreads (uv-channels:utils v-channels |)])
    ::
      [%x %v3 %init ~]
    =/  init  [(uv-channels:utils v-channels |) hidden-posts]
    ``noun+!>(`[channels:v1:old:c (set id-post:c)]`init)
    ::
      [%x %v4 %init ~]
    =/  init  [(uv-channels-2:utils v-channels |) hidden-posts]
    ``noun+!>(`[channels:c (set id-post:c)]`init)
    ::
      [%x ?(%v0 %v1) %hidden-posts ~]  ``hidden-posts+!>(hidden-posts)
      [%x ?(%v0 %v1) %unreads ~]  ``channel-unreads+!>(unreads)
      [%x v=?(%v0 %v1 %v2 %v3) =kind:c ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    (ca-peek:(ca-abed:ca-core kind.pole ship name.pole) rest.pole v.pole)
  ::
      [%u ?(%v0 %v1 %v2 %v3) =kind:c ship=@ name=@ ~]
    =/  =ship  (slav %p ship.pole)
    ``loob+!>((~(has by v-channels) kind.pole ship name.pole))
  ::
      [%x %v3 %said =kind:c host=@ name=@ %post time=@ reply=?(~ [@ ~])]
    =/  host=ship   (slav %p host.pole)
    =/  =nest:c     [kind.pole host name.pole]
    =/  =plan:c     =,(pole [(slav %ud time) ?~(reply ~ `(slav %ud -.reply))])
    ``noun+!>((~(get by voc) nest plan))
  ::
    ::  /x/v/heads: get the latest post in each channel
    ::
      [%x %v2 %heads since=?(~ [u=@ ~])]
    =/  since=(unit id-post:c)
      ?~  since.pole  ~
      ?^  tim=(slaw %da u.since.pole)  `u.tim
      `(slav %ud u.since.pole)
    :^  ~  ~  %channel-heads
    !>  ^-  channel-heads:v7:old:c
    (murn ~(tap by v-channels) (cury channel-head-1:utils since))
    ::
      [%x %v3 %heads since=?(~ [u=@ ~])]
    =/  since=(unit id-post:c)
     ?~  since.pole  ~
      ?^  tim=(slaw %da u.since.pole)  `u.tim
      `(slav %ud u.since.pole)
    :^  ~  ~  %channel-heads-2
    !>  ^-  channel-heads:c
    (murn ~(tap by v-channels) (cury channel-head-2:utils since))
  ==
::
++  arvo
  |=  [=(pole knot) sign=sign-arvo]
  ^+  cor
  ?+  pole  ~|(bad-arvo-take/pole !!)
      [%~.~ %cancel-retry rest=*]  cor
  ::
      [%~.~ %retry rest=*]
    =^  caz=(list card)  subs
      (~(handle-wakeup s [subs bowl]) pole)
    (emil caz)
  ::
      [%numbers kind=?(%chat %diary %heap) ship=@ name=@ ~]
    =/  host=ship  (slav %p ship.pole)
    =/  =nest:c    [kind.pole host name.pole]
    %-  emit
    =/  =cage  [%noun !>([%send-sequence-numbers nest])]
    [%pass pole %agent [host %channels-server] %poke cage]
  ==
::
++  unreads
  ^-  unreads:c
  %-  ~(gas by *unreads:c)
  %+  turn  ~(tap in ~(key by v-channels))
  |=  =nest:c
  [nest ca-unread:(ca-abed:ca-core nest)]
::
++  pass-hark
  |=  =cage
  ^-  card
  =/  =wire  /hark
  =/  =dock  [our.bowl %hark]
  [%pass wire %agent dock %poke cage]
++  pass-yarn
  |=  =new-yarn:ha
  ^-  card
  (pass-hark hark-action-1+!>([%new-yarn new-yarn]))
::
++  from-self  =(our src):bowl
::
++  scry-path
  |=  [agent=term =path]
  ^-  ^path
  (welp /(scot %p our.bowl)/[agent]/(scot %da now.bowl) path)
++  get-seat
  |=  [=flag:g =ship]
  ^-  (unit seat:v7:gv)
  =/  base-path
    (scry-path %groups /)
  =>  [flag=flag ship=ship base-path=base-path seat=seat:v7:gv ..zuse]  ~+
  =/  groups-running
    .^(? %gu (weld base-path /$))
  ?.  groups-running  ~
  =/  group-exists
    .^(? %gu (weld base-path /groups/(scot %p p.flag)/[q.flag]))
  ?.  group-exists  ~
  .^  (unit seat)  %gx
    %+  weld  base-path
    /groups/(scot %p p.flag)/[q.flag]/seats/(scot %p ship)/noun
  ==
++  ca-core
  |_  [=nest:c channel=v-channel:c gone=_|]
  ++  ca-core  .
  ++  emit  |=(=card ca-core(cor (^emit card)))
  ++  emil  |=(caz=(list card) ca-core(cor (^emil caz)))
  ++  give  |=(=gift:agent:gall ca-core(cor (^give gift)))
  ++  ca-perms  ~(. perms:utils our.bowl now.bowl nest group.perm.perm.channel)
  ++  safe-watch
    |=  [=wire =dock =path]
    |=  delay=?
    ca-core(cor ((^safe-watch wire dock path) delay))
  ++  unsubscribe
    |=  [=wire =dock]
    ca-core(cor (^unsubscribe wire dock))
  ++  ca-abet
    %_    cor
        v-channels
      ?:(gone (~(del by v-channels) nest) (~(put by v-channels) nest channel))
    ==
  ++  ca-abed
    |=  n=nest:c
    ca-core(nest n, channel (~(got by v-channels) n))
  ::
  ++  ca-area  `path`/[kind.nest]/(scot %p ship.nest)/[name.nest]
  ++  ca-sub-wire  (weld ca-area /updates)
  ++  ca-give-unread
    (give %fact ~[/unreads /v0/unreads /v1/unreads] channel-unread-update+!>([nest ca-unread]))
  ::
  ++  ca-activity
    =,  activity
    |%
    ++  on-post
      |=  v-post:c
      ^+  ca-core
      =*  author-ship  (get-author-ship:utils author)
      ?.  .^(? %gu (scry-path %activity /$))
        ca-core
      ?:  =(author-ship our.bowl)
        =/  =source  [%channel nest group.perm.perm.channel]
        (send [%read source [%all `now.bowl |]] ~)
      =/  seat=(unit seat:v7:gv)  (get-seat group.perm.perm.channel our.bowl)
      =/  mention=?  (was-mentioned:utils content our.bowl seat)
      =/  action
        [%add %post [[author-ship id] id] nest group.perm.perm.channel content mention]
      (send ~[action])
    ::
    ++  on-post-delete
      |=  v-post:c
      ^+  ca-core
      ::  remove any activity that might've happened under this post
      ::
      =*  group  group.perm.perm.channel
      =/  chan=source  [%channel nest group]
      =/  key=message-key
        [[(get-author-ship:utils author) id] id]
      =/  thread=source  [%thread key nest group]
      =/  seat=(unit seat:v7:gv)  (get-seat group.perm.perm.channel our.bowl)
      =/  mention  (was-mentioned:utils content our.bowl seat)
      =/  =incoming-event  [%post key nest group content mention]
      (send [%del thread] [%del-event chan incoming-event] ~)
    ::
    ++  on-reply
      |=  [parent=v-post:c v-reply:c]
      =*  parent-author  (get-author-ship:utils author.parent)
      =*  reply-author   (get-author-ship:utils author)
      ^+  ca-core
      ?.  .^(? %gu (scry-path %activity /$))
        ca-core
      =/  parent-key=message-key
        [[parent-author id.parent] id.parent]
      ?:  =(reply-author our.bowl)
        =/  =source  [%thread parent-key nest group.perm.perm.channel]
        (send [%read source [%all `now.bowl |]] ~)
      =/  seat=(unit seat:v7:gv)  (get-seat group.perm.perm.channel our.bowl)
      =/  mention=?  (was-mentioned:utils content our.bowl seat)
      =/  in-replies
          %+  lien  (tap:on-v-replies:c replies.parent)
          |=  [=time reply=(unit v-reply:c)]
          ?~  reply  |
          =((get-author-ship:utils author.u.reply) our.bowl)
      =/  =path  (scry-path %activity /volume-settings/noun)
      =+  .^(settings=volume-settings %gx path)
      =/  =action
        :*  %add  %reply
            [[reply-author id] id]
            parent-key
            nest
            group.perm.perm.channel
            content
            mention
        ==
      ::  only follow thread if we haven't adjusted settings already
      ::  and if we're the author of the post, mentioned, or in the replies
      =/  thread=source  [%thread parent-key nest group.perm.perm.channel]
      ?.  ?&  !(~(has by settings) thread)
              ?|  mention
                  in-replies
                  =(parent-author our.bowl)
              ==
          ==
        (send ~[action])
      =/  vm=volume-map  [[%reply & &] ~ ~]
      (send ~[[%adjust thread `vm] action])
    ++  on-reply-delete
      |=  [parent=v-post:c reply=v-reply:c]
      ^+  ca-core
      =*  parent-author  (get-author-ship:utils author.parent)
      =*  reply-author   (get-author-ship:utils author.reply)
      ::  remove any activity that might've happened under this post
      ::
      =*  group  group.perm.perm.channel
      =/  key=message-key
        [[reply-author id.reply] id.reply]
      =/  top=message-key
        [[parent-author id.parent] id.parent]
      =/  thread=source  [%thread top nest group]
      =/  seat=(unit seat:v7:gv)  (get-seat group.perm.perm.channel our.bowl)
      =/  mention  (was-mentioned:utils content.reply our.bowl seat)
      =/  =incoming-event  [%reply key top nest group content.reply mention]
      (send [%del-event thread incoming-event] ~)
    ::
    ++  send
      |=  actions=(list action)
      ^+  ca-core
      ?.  .^(? %gu (scry-path %activity /$))
        ca-core
      %-  emil
      %+  turn  actions
      |=  =action
      =/  =cage  activity-action+!>(action)
      [%pass /activity/submit %agent [our.bowl %activity] %poke cage]
    --
  ::
  ::  handle creating a channel
  ::
  ++  ca-create
    |=  create=create-channel:c
    ?>  from-self
    =.  nest  [kind.create our.bowl name.create]
    ?<  (~(has by v-channels) nest)
    =.  channel  *v-channel:c
    =.  group.perm.perm.channel  group.create
    =.  meta.channel  [0 meta.create]
    =.  last-read.remark.channel  now.bowl
    =.  ca-core  (send:ca-activity [%add %chan-init nest group.create] ~)
    =/  =cage  [%channel-command !>([%create create])]
    (emit %pass (weld ca-area /create) %agent [our.bowl server] %poke cage)
  ::
  ::  handle joining a channel
  ::
  ++  ca-join
    |=  [n=nest:c group=flag:g]
    =.  nest  n
    =/  =path  (scry-path %groups /v2/groups/(scot %p p.group)/[q.group]/noun)
    =+  .^(grp=group:v7:gv %gx path)
    =/  is-group-host=?  =(p.group src.bowl)
    =/  is-channel-host=?
      ?&  =(src.bowl ship.n)
          (~(has by channels.grp) n)
      ==
    ?>  |(from-self is-group-host is-channel-host)
    ?:  (~(has by v-channels) nest)
      ::  we should already be in, but make sure our subscriptions still exist
      ::  just in case
      ::
      =.  channel  (~(got by v-channels) nest)
      (ca-safe-sub |)
    =.  channel  *v-channel:c
    =.  group.perm.perm.channel  group
    =.  last-read.remark.channel  now.bowl
    =.  ca-core  ca-give-unread
    =.  ca-core  (ca-response %join group)
    =.  ca-core  (send:ca-activity ~[[%add %chan-init n group]])
    (ca-safe-sub |)
  ::
  ::  handle an action from the client
  ::
  ::    typically this will either handle the action directly (for local
  ::    things like marking channels read) or proxy the request to the
  ::    host (for global things like posting a post).
  ::
  ++  ca-a-channel
    |=  =a-channel:c
    ?>  from-self
    ?+  -.a-channel  (ca-send-command [%channel nest a-channel])
      %join       !!  ::  handled elsewhere
      %leave      ca-leave
      ?(%read %read-at %watch %unwatch)  (ca-a-remark a-channel)
    ::
        %post
      =/  source=(unit source:activity)
        ?.  ?=(%reply -.c-post.a-channel)
          `[%channel nest group.perm.perm.channel]
        =/  id  id.c-post.a-channel
        =/  post  (got:on-v-posts:c posts.channel id)
        ?~  post  ~
        =/  =message-key:activity
          [[(get-author-ship:utils author.u.post) id] id]
        `[%thread [message-key nest group.perm.perm.channel]]
      =?  ca-core  ?=(^ source)  (send:ca-activity [%bump u.source] ~)
      (ca-send-command [%channel nest a-channel])
    ==
  ::
  ++  ca-a-remark
    |=  =a-remark:c
    ^+  ca-core
    =?  ca-core  =(%read -.a-remark)
      %-  emil
      =/  last-read  last-read.remark.channel
      =+  .^(=carpet:ha %gx (scry-path %hark /desk/groups/latest/noun))
      %+  murn
        ~(tap by cable.carpet)
      |=  [=rope:ha =thread:ha]
      ^-  (unit card)
      ?~  can.rope  ~
      ?.  =(nest u.can.rope)  ~
      =/  thread=(pole knot)  ted.rope
      =/  top-id=(unit id-post:c)
        ?+  thread  ~
          [* * * * id=@ rest=*]  (slaw %ui (cat 3 '0i' id.thread))
        ==
      ::  look at what post id the notification is coming from, and
      ::  if it's newer than the last read, mark the notification
      ::  read as well
      ?~  top-id  ~
      ?:  (lth u.top-id last-read.remark.channel)  ~
      =/  =cage  hark-action-1+!>([%saw-rope rope])
      `(pass-hark cage)
    =.  remark.channel
      ?-    -.a-remark
          %watch    remark.channel(watching &)
          %unwatch  remark.channel(watching |)
          %read-at  !!  ::TODO
          %read
        ::  set read marker at time of latest content. conveniently, we can use
        ::  the always-up-to-date recency for that.
        ::  we don't use now.bowl, because we may still receive content
        ::  with ids before now.bowl
        ::
        %_  remark.channel
          last-read       (add recency.remark.channel (div ~s1 100))
          unread-threads  ~
        ==
      ==
    =.  ca-core  ca-give-unread
    ::TODO  %read activity-action?
    (ca-response a-remark)
  ::
  ::  proxy command to host
  ::
  ++  ca-send-command
    |=  command=c-channels:c
    ^+  ca-core
    ?>  ?=(%channel -.command)
    ::  don't allow anyone else to proxy through us
    ?.  =(src.bowl our.bowl)
      ~|("%channel-action poke failed: only allowed from self" !!)
    ::  if we're interacting with a channel that means we've read it
    =?  remark.channel  ?=(%post -.c-channel.command)
      %=  remark.channel
        last-read       `@da`(add now.bowl (div ~s1 100))
        unread-threads  *(set id-post:c)
      ==
    =^  new-pending  ca-core
      =*  pending  pending.channel
      ?+  -.c-channel.command  [pending ca-core]
          %post
        =/  rest  c-post.c-channel.command
        ?+  -.rest  [pending ca-core]
            %add
          =/  essay  essay.rest
          =/  client-id
            [(get-author-ship:utils author.essay) sent.essay]
          =/  new-posts  (~(put by posts.pending) client-id essay)
          :-  [new-posts replies.pending]
          (ca-response %pending client-id [%post essay])
        ::
            %reply
          ?+  -.c-reply.rest  [pending ca-core]
              %add
            =/  memo  memo.c-reply.rest
            =/  post  (get:on-v-posts:c posts.channel id.rest)
            ?~  post  [pending ca-core]
            ?~  u.post  [pending ca-core]
            =/  client-id
              [(get-author-ship:utils author.memo) sent.memo]
            =/  new-replies
              (~(put by replies.pending) [id.rest client-id] memo)
            =/  old  (get-reply-meta:utils u.u.post)
            =/  meta
              %=  old
                reply-count    +(reply-count.old)
                last-repliers  (get-last-repliers:utils u.u.post `our.bowl)
                last-reply     `now.bowl
              ==
            :-  [posts.pending new-replies]
            %-  ca-response
            :*  %pending
                client-id
                :*  %reply
                    id.rest
                    meta
                    memo.c-reply.rest
                ==
            ==
          ==
        ==
      ==
    =.  pending.channel  new-pending
    =/  =cage  [%channel-command !>(command)]
    ::  NB: we must have already subscribed to something from this ship,
    ::  so that we have negotiated a matching version.  If we want to do
    ::  anything in particular on a mismatched version, we can call
    ::  +can-poke:neg.
    ::
    (emit %pass ca-area %agent [ship.nest.command server] %poke cage)
  ::
  ++  ca-know-said
    |=  =plan:c
    ^-  ?
    (have-plan:utils nest plan posts.channel)
  ::
  ::  handle a said (previews) request where we have the data to respond
  ::
  ++  ca-said-1
    |=  =plan:c
    ^+  ca-core
    =.  ca-core
      %^  give  %fact  ~
      ?.  (can-read:ca-perms src.bowl)
        channel-denied+!>(~)
      (said-1:utils nest plan posts.channel)
    (give %kick ~ ~)
  ::
  ++  ca-said-2
    |=  =plan:c
    ^+  ca-core
    =.  ca-core
      %^  give  %fact  ~
      ::  give result if it's readable by the requester,
      ::  or if we pinned it intentionally
      ::
      =;  share=?
        ?.  share
          channel-denied+!>(~)
        (said-2:utils nest plan posts.channel)
      ?:  (can-read:ca-perms src.bowl)  &
      ?^  q.plan  |  ::NOTE  expose/+grab-post doesn't support replies
      ::  we need to grab the post first before we can check whether it's
      ::  pinned, because its kind appears in the reference path...
      ::
      ?~  post=(get:on-v-posts:c posts.channel p.plan)  |
      ?~  u.post  |
      ?.  .^(? %gu (scry-path %expose /$))  |
      =/  =cite:ci:utils
        (from-post:cite:utils nest p.plan kind.u.u.post)
      .^(? %gu (scry-path %expose [%show (print:ci:utils cite)]))
    (give %kick ~ ~)
  ::
  ++  ca-has-sub
    ^-  ?
    (~(has by wex.bowl) [ca-sub-wire ship.nest server])
  ::
  ++  ca-safe-sub
    |=  delay=?
    ?:  ca-has-sub  ca-core
    ?^  posts.channel  (ca-start-updates delay)
    =.  load.net.channel  |
    %.  delay
    %^  safe-watch  (weld ca-area /checkpoint)  [ship.nest server]
    ?.  =(our.bowl ship.nest)
      =/  count  ?:(=(%diary kind.nest) '20' '100')
      /[kind.nest]/[name.nest]/checkpoint/before/[count]
    /[kind.nest]/[name.nest]/checkpoint/time-range/(scot %da *@da)
  ::
  ++  ca-start-updates
    |=  delay=?
    ::  not most optimal time, should maintain last heard time instead
    =/  tim=(unit time)
      (bind (ram:on-v-posts:c posts.channel) head)
    %.  delay
    %^  safe-watch  ca-sub-wire  [ship.nest server]
    /[kind.nest]/[name.nest]/updates/(scot %da (fall tim *@da))
  ::
  ++  ca-agent
    |=  [=wire =sign:agent:gall]
    ^+  ca-core
    ?+    wire  ~|(channel-strange-agent-wire+wire !!)
        ~
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  ca-core
      ((slog %ca-agent u.p.sign) ca-core)
      :: ca-core  :: no-op wire, should only send pokes
      [%create ~]       (ca-take-create sign)
      [%updates ~]      (ca-take-update sign)
      [%backlog ~]      (ca-take-backlog sign)
      [%checkpoint ~]   (ca-take-checkpoint sign)
    ==
  ::
  ++  ca-take-create
    |=  =sign:agent:gall
    ^+  ca-core
    ?-    -.sign
        %poke-ack
      =+  ?~  p.sign  ~
          %-  (slog leaf+"{<dap.bowl>}: Failed creation (poke)" u.p.sign)
          ~
      =/  =path  /[kind.nest]/[name.nest]/create
      =/  =wire  (weld ca-area /create)
      ((safe-watch wire [our.bowl server] path) |)
    ::
        %kick       (ca-safe-sub &)
        %watch-ack
      ?~  p.sign  ca-core
      %-  (slog leaf+"{<dap.bowl>}: Failed creation" u.p.sign)
      ca-core
    ::
        %fact
      =*  cage  cage.sign
      ?.  =(%channel-update p.cage)
        ~|(diary-strange-fact+p.cage !!)
      =+  !<(=update:c q.cage)
      =?  meta.channel  ?=(%create -.u-channel.update)
        [0 meta.u-channel.update]
      =.  ca-core  (ca-u-channels update)
      =.  ca-core  ca-give-unread
      =.  ca-core  (unsubscribe (weld ca-area /create) [ship.nest server])
      (ca-safe-sub |)
    ==
  ::
  ++  ca-take-update
    |=  =sign:agent:gall
    ^+  ca-core
    ?+    -.sign  ca-core
        %kick       (ca-safe-sub &)
        %watch-ack
      ?~  p.sign  ca-core
      %-  (slog leaf+"{<dap.bowl>}: Failed subscription" u.p.sign)
      ca-core
    ::
        %fact
      =*  cage  cage.sign
      ?+  p.cage  ~|(channel-strange-fact+p.cage !!)
        %channel-logs    (ca-apply-logs !<(log:c q.cage))
        %channel-update  (ca-u-channels !<(update:c q.cage))
      ==
    ==
  ::
  ++  ca-take-checkpoint
    |=  =sign:agent:gall
    ^+  ca-core
    ?+    -.sign  ca-core
        :: only if kicked prematurely
        %kick       ?:(load.net.channel ca-core (ca-safe-sub &))
        %watch-ack
      ?~  p.sign  ca-core
      %-  (slog leaf+"{<dap.bowl>}: Failed partial checkpoint" u.p.sign)
      ca-core
    ::
        %fact
      =*  cage  cage.sign
      ?+    p.cage  ~|(diary-strange-fact+p.cage !!)
          %channel-checkpoint
        (ca-ingest-checkpoint !<(u-checkpoint:c q.cage))
      ==
    ==
  ::
  ++  ca-take-backlog
    |=  =sign:agent:gall
    ^+  ca-core
    ?+    -.sign  ca-core
        ::  only hit if kicked prematurely (we %leave after the first %fact)
        %kick  (ca-sync-backlog &)
        %watch-ack
      ?~  p.sign  ca-core
      %-  (slog leaf+"{<dap.bowl>}: Failed backlog" u.p.sign)
      ca-core
    ::
        %fact
      =*  cage  cage.sign
      ?+    p.cage  ~|(diary-strange-fact+p.cage !!)
          %channel-checkpoint
        (ca-ingest-backlog !<(u-checkpoint:c q.cage))
      ==
    ==
  ::
  ++  ca-ingest-checkpoint
    |=  chk=u-checkpoint:c
    ^+  ca-core
    =.  load.net.channel  &
    =.  ca-core  (ca-apply-checkpoint chk &)
    =.  ca-core  (ca-start-updates |)
    =.  ca-core  (ca-fetch-contacts chk)
    =.  ca-core  (ca-sync-backlog |)
    =/  wire  (weld ca-area /checkpoint)
    (unsubscribe wire [ship.nest server])
  ::
  ++  ca-fetch-contacts
    |=  chk=u-checkpoint:c
    =/  authors=(list author:c)
      %~  tap  in  %-  sy
      %+  murn  ~(val by posts.chk)
        |=  up=(unit v-post:c)
        ?~  up  ~
        `author.u.up
    (ca-heed authors)
  ::
  ++  ca-apply-checkpoint
    |=  [chk=u-checkpoint:c send=?]
    =^  changed  order.channel  (apply-rev:c order.channel order.chk)
    =?  ca-core  &(changed send)  (ca-response %order order.order.channel)
    =^  changed  view.channel  (apply-rev:c view.channel view.chk)
    =?  ca-core  &(changed send)  (ca-response %view view.view.channel)
    =^  changed  sort.channel  (apply-rev:c sort.channel sort.chk)
    =?  ca-core  &(changed send)  (ca-response %sort sort.sort.channel)
    =^  changed  perm.channel  (apply-rev:c perm.channel perm.chk)
    =?  ca-core  &(changed send)  (ca-response %perm perm.perm.channel)
    =^  changed  meta.channel  (apply-rev:c meta.channel meta.chk)
    =?  ca-core  &(changed send)  (ca-response %meta meta.meta.channel)
    =/  old  posts.channel
    =.  posts.channel
      ((uno:mo-v-posts:c posts.channel posts.chk) ca-apply-unit-post)
    =.  count.channel  count.chk
    =?  ca-core  &(send !=(old posts.channel))
      %+  ca-response  %posts
      %+  gas:on-posts:c  *posts:c
      %+  murn  (turn (tap:on-v-posts:c posts.chk) head)
      |=  id=id-post:c
      ^-  (unit [id-post:c (unit post:c)])
      =/  post  (got:on-v-posts:c posts.channel id)
      =/  old   (get:on-v-posts:c old id)
      ?:  =(old `post)  ~
      ?~  post  (some [id ~])
      (some [id `(uv-post-2:utils u.post)])
    ca-core
  ::
  ++  ca-sync-backlog
    |=  delay=?
    =/  checkpoint-start  (pry:on-v-posts:c posts.channel)
    ?~  checkpoint-start  ca-core
    %.  delay
    %^  safe-watch  (weld ca-area /backlog)  [ship.nest server]
    %+  welp
      /[kind.nest]/[name.nest]/checkpoint/time-range
    ~|  `*`key.u.checkpoint-start
    /(scot %da *@da)/(scot %da key.u.checkpoint-start)
  ::
  ++  ca-ingest-backlog
    |=  chk=u-checkpoint:c
    =.  ca-core  (ca-apply-checkpoint chk |)
    =/  wire  (weld ca-area /backlog)
    (unsubscribe wire [ship.nest server])
  ::
  ++  ca-apply-logs
    |=  =log:c
    ^+  ca-core
    %+  roll  (tap:log-on:c log)
    |=  [[=time =u-channel:c] ca=_ca-core]
    (ca-u-channels:ca time u-channel)
  ::
  ::  +ca-u-* functions ingest updates and execute them
  ::
  ::    often this will modify the state and emit a "response" to our
  ::    own subscribers.  it may also emit unreads and/or trigger hark
  ::    events.
  ::
  ++  ca-u-channels
    |=  [=time =u-channel:c]
    ?>  ca-from-host
    ^+  ca-core
    =?  last-updated.channel  ?=(%post -.u-channel)
      =/  id  id.u-channel
      =-  (put:updated-on:c - time id.u-channel)
      ::  delete old entry so we don't have two entries for the same post
      %+  gas:updated-on:c  *last-updated:c
      %+  murn
        (tap:updated-on:c last-updated.channel)
      |=  [=^time =id-post:c]
      ?:  =(id id-post)  ~
      `[time id-post]
    ?-    -.u-channel
        %create
      ?.  =(0 rev.perm.channel)  ca-core
      =.  perm.perm.channel  perm.u-channel
      (ca-response %create perm.u-channel)
    ::
        %order
      =^  changed  order.channel  (apply-rev:c order.channel +.u-channel)
      ?.  changed  ca-core
      (ca-response %order order.order.channel)
    ::
        %view
      =^  changed  view.channel  (apply-rev:c view.channel +.u-channel)
      ?.  changed  ca-core
      (ca-response %view view.view.channel)
    ::
        %sort
      =^  changed  sort.channel  (apply-rev:c sort.channel +.u-channel)
      ?.  changed  ca-core
      (ca-response %sort sort.sort.channel)
    ::
        %perm
      =^  changed  perm.channel  (apply-rev:c perm.channel +.u-channel)
      ?.  changed  ca-core
      (ca-response %perm perm.perm.channel)
    ::
        %meta
      =^  changed  meta.channel  (apply-rev:c meta.channel +.u-channel)
      ?.  changed  ca-core
      (ca-response %meta meta.meta.channel)
    ::
        %post
      =/  old  posts.channel
      =.  ca-core  (ca-u-post id.u-channel u-post.u-channel)
      =?  ca-core  !=(old posts.channel)  ca-give-unread
      ca-core
    ==
  ::
  ++  ca-u-post
    |=  [=id-post:c =u-post:c]
    ^+  ca-core
    =/  post  (get:on-v-posts:c posts.channel id-post)
    ?:  ?=([~ ~] post)  ca-core
    ?:  ?=(%set -.u-post)
      =?  recency.remark.channel  ?=(^ post.u-post)
        (max recency.remark.channel id-post)
      =?  ca-core  ?&  ?=(^ post.u-post)
                       ?=(~ post)
                   ==
        ::  we don't send an activity event for edits or deletes
        (on-post:ca-activity u.post.u-post)
      ?~  post
        =/  post=(unit post:c)  (bind post.u-post uv-post-2:utils)
        =?  ca-core  ?=(^ post.u-post)
          (ca-heed ~[author.u.post.u-post])
        =?  ca-core  ?=(^ post.u-post)
          ::TODO  what about the "mention was added during edit" case?
          (on-post:ca-hark id-post u.post.u-post)
        =.  posts.channel  (put:on-v-posts:c posts.channel id-post post.u-post)
        =?  count.channel  ?=(^ post.u-post)
          (max count.channel seq.u.post.u-post)
        =?  pending.channel  ?=(^ post.u-post)
          =/  client-id  [author sent]:u.post.u-post
          pending.channel(posts (~(del by posts.pending.channel) client-id))
        (ca-response %post id-post %set post)
      ::
      ?~  post.u-post
        =.  ca-core  (on-post-delete:ca-activity u.u.post)
        =.  posts.channel  (put:on-v-posts:c posts.channel id-post ~)
        (ca-response %post id-post %set ~)
      ::
      =.  ca-core  (ca-heed ~[author.u.post.u-post])
      =*  old  u.u.post
      =*  new  u.post.u-post
      =/  merged  (ca-apply-post id-post old new)
      ?:  =(merged old)  ca-core
      =.  posts.channel  (put:on-v-posts:c posts.channel id-post `merged)
      (ca-response %post id-post %set `(uv-post-2:utils merged))
    ::
    ?~  post
      =.  diffs.future.channel
        ::  if the item affected by the update is not in the window we
        ::  care about, ignore it. otherwise, put it in the pending
        ::  diffs set.
        ::
        ?.  (~(has as:sparse window.future.channel) id-post)
          diffs.future.channel
        (~(put ju diffs.future.channel) id-post u-post)
      ca-core
    ::
    ?-  -.u-post
        %reply
      (ca-u-reply id-post u.u.post id.u-post u-reply.u-post)
        %reacts
      =.  ca-core  (ca-heed ~(tap in ~(key by reacts.u.u.post)))
      =/  merged  (ca-apply-reacts reacts.u.u.post reacts.u-post)
      ?:  =(merged reacts.u.u.post)  ca-core
      =.  posts.channel
        (put:on-v-posts:c posts.channel id-post `u.u.post(reacts merged))
      (ca-response %post id-post %reacts (uv-reacts-2:utils merged))
    ::
        %essay
      =.  ca-core  (ca-heed ~[author.u.u.post])
      =^  changed  +.u.u.post  (apply-rev:c +.u.u.post +.u-post)
      ?.  changed  ca-core
      =.  posts.channel  (put:on-v-posts:c posts.channel id-post `u.u.post)
      (ca-response %post id-post %essay +>.u.u.post)
    ==
  ::
  ++  ca-heed
    |=  authors=(list author:c)
    %^    emit
        %pass
      /contacts/heed
    :*  %agent
        [our.bowl %contacts]
        %poke
        ::  only meet authors who are persons
        ::
        contact-action-0+!>([%heed (murn authors get-person-ship:utils)])
    ==
  ++  ca-u-reply
    |=  [=id-post:c post=v-post:c =id-reply:c =u-reply:c]
    ^+  ca-core
    |^
    =/  reply  (get:on-v-replies:c replies.post id-reply)
    ?:  ?=([~ ~] reply)  ca-core
    ?:  ?=(%set -.u-reply)
      ?~  reply
        =/  reply=(unit reply:c)
          ?~  reply.u-reply  ~
          `(uv-reply-2:utils id-post u.reply.u-reply)
        =?  ca-core  ?=(^ reply.u-reply)
          (on-reply:ca-hark id-post post u.reply.u-reply)
        =?  ca-core  ?=(^ reply.u-reply)
          (on-reply:ca-activity post u.reply.u-reply)
        =?  pending.channel  ?=(^ reply.u-reply)
          =/  memo  +.+.u.reply.u-reply
          =/  client-id  [author sent]:memo
          =/  new-replies  (~(del by replies.pending.channel) [id-post client-id])
          pending.channel(replies new-replies)
        (put-reply reply.u-reply %set reply)
      ::
      ?~  reply.u-reply
        =.  ca-core
          (on-reply-delete:ca-activity post u.u.reply)
        (put-reply ~ %set ~)
      ::
      =*  old  u.u.reply
      =*  new  u.reply.u-reply
      =/  merged  (need (ca-apply-reply id-reply `old `new))
      ?:  =(merged old)  ca-core
      =.  ca-core  (ca-heed ~[author.new])
      (put-reply `merged %set `(uv-reply-2:utils id-post merged))
    ::
    ?~  reply  ca-core
    =.  ca-core  (ca-heed ~(tap in ~(key by reacts.u.u.reply)))
    =/  merged  (ca-apply-reacts reacts.u.u.reply reacts.u-reply)
    ?:  =(merged reacts.u.u.reply)  ca-core
    (put-reply `u.u.reply(reacts merged) %reacts (uv-reacts-2:utils merged))
    ::
    ::  put a reply into a post by id
    ::
    ++  put-reply
      |=  [reply=(unit v-reply:c) =r-reply:c]
      ^+  ca-core
      =/  post  (get:on-v-posts:c posts.channel id-post)
      ?~  post  ca-core
      ?~  u.post  ca-core
      =?  recency.remark.channel  ?=(^ reply)
        (max recency.remark.channel id-reply)
      =?  unread-threads.remark.channel
          ?&  ?=(^ reply)
              !=(our.bowl author.u.reply)
              (gth id-reply last-read.remark.channel)
          ==
        (~(put in unread-threads.remark.channel) id-post)
      =.  replies.u.u.post  (put:on-v-replies:c replies.u.u.post id-reply reply)
      =.  posts.channel  (put:on-v-posts:c posts.channel id-post `u.u.post)
      =/  meta=reply-meta:c  (get-reply-meta:utils u.u.post)
      (ca-response %post id-post %reply id-reply meta r-reply)
    --
  ::
  ::  +ca-apply-* functions apply new copies of data to old copies,
  ::  keeping the most recent versions of each sub-piece of data
  ::
  ++  ca-apply-unit-post
    |=  [=id-post:c old=(unit v-post:c) new=(unit v-post:c)]
    ^-  (unit v-post:c)
    ?~  old  ~
    ?~  new  ~
    `(ca-apply-post id-post u.old u.new)
  ::
  ++  ca-apply-post
    |=  [=id-post:c old=v-post:c new=v-post:c]
    ^-  v-post:c
    %_  old
      replies  (ca-apply-replies replies.old replies.new)
      reacts   (ca-apply-reacts reacts.old reacts.new)
      +        +:(apply-rev:c +.old +.new)
    ==
  ::
  ++  ca-apply-reacts
    |=  [old=v-reacts:c new=v-reacts:c]
    ^-  v-reacts:c
    %-  (~(uno by old) new)
    |=  [* a=(rev:c (unit react:c)) b=(rev:c (unit react:c))]
    +:(apply-rev:c a b)
  ::
  ++  ca-apply-replies
    |=  [old=v-replies:c new=v-replies:c]
    ((uno:mo-v-replies:c old new) ca-apply-reply)
  ::
  ++  ca-apply-reply
    |=  [=id-reply:c old=(unit v-reply:c) new=(unit v-reply:c)]
    ^-  (unit v-reply:c)
    ?~  old  ~
    ?~  new  ~
    :-  ~
    %=  u.old
      reacts  (ca-apply-reacts reacts.u.old reacts.u.new)
      +      +.u.new
    ==
  ::
  ::  +ca-hark: notification dispatch
  ::
  ::    entry-points are +on-post and +on-reply, which may implement distinct
  ::    notification behavior
  ::
  ++  ca-hark
    |%
    ++  on-post
      |=  [=id-post:c post=v-post:c]
      ^+  ca-core
      =*  post-author  (get-author-ship:utils author.post)
      ?:  =(post-author our.bowl)
        ca-core
      ::  we want to be notified if we were mentioned in the post
      ::
      ?.  ?=(kind:c -.kind.post)  ca-core
      =/  =rope:ha  (ca-rope -.kind.post id-post ~)
      =/  seat=(unit seat:v7:gv)  (get-seat group.perm.perm.channel our.bowl)
      ?:  (was-mentioned:utils content.post our.bowl seat)
        ?.  (want-hark %mention)
          ca-core
        =/  cs=(list content:ha)
          ~[[%ship post-author] ' mentioned you: ' (flatten:utils content.post)]
        (emit (pass-yarn (ca-spin rope cs ~)))
      ::
      ?:  (want-hark %any)
        =/  cs=(list content:ha)
          ~[[%ship post-author] ' sent a message: ' (flatten:utils content.post)]
        (emit (pass-yarn (ca-spin rope cs ~)))
      ca-core
    ::
    ++  on-reply
      |=  [=id-post:c post=v-post:c reply=v-reply:c]
      ^+  ca-core
      =*  reply-author  (get-author-ship:utils author.reply)
      ?:  =(reply-author our.bowl)
        ca-core
      ::  preparation of common cases
      ::
      =*  diary-notification
        =*  post-title  ?~(meta.post 'unknown' title.u.meta.post)
        :~  [%ship reply-author]  ' commented on '
            [%emph post-title]   ': '
            [%ship reply-author]  ': '
            (flatten:utils content.reply)
        ==
      =*  heap-notification
        =/  content  (flatten:utils content.reply)
        =*  post-title  ?~(meta.post '' title.u.meta.post)
        =/  title=@t
          ?.  =(0 (met 3 post-title))  post-title
          ?:  (lte (met 3 content) 80)  content
          (cat 3 (end [3 77] content) '...')
        :~  [%ship reply-author]  ' commented on '
            [%emph title]   ': '
            [%ship reply-author]  ': '
            content
        ==
      ::  construct a notification message based on the reason to notify,
      ::  if we even need to notify at all
      ::
      =;  cs=(unit (list content:ha))
        ?~  cs  ca-core
        ?.  ?=(kind:c -.kind.post)  ca-core
        =/  =rope:ha  (ca-rope -.kind.post id-post `id.reply)
        (emit (pass-yarn (ca-spin rope u.cs ~)))
      ::  notify because we wrote the post the reply responds to
      ::
      ?:  =(author.post our.bowl)
        ?.  (want-hark %ours)  ~
        ?+    -.kind.post  ~
            %diary  `diary-notification
            %heap   `heap-notification
            %chat
          :-  ~
          :~  [%ship reply-author]
              ' replied to you: '
              (flatten:utils content.reply)
          ==
        ==
      ::  notify because we were mentioned in the reply
      ::
      =/  seat=(unit seat:v7:gv)  (get-seat group.perm.perm.channel our.bowl)
      ?:  (was-mentioned:utils content.reply our.bowl seat)
        ?.  (want-hark %mention)  ~
        `~[[%ship reply-author] ' mentioned you: ' (flatten:utils content.reply)]
      ::  notify because we ourselves responded to this post previously
      ::
      ?:  %+  lien  (tap:on-v-replies:c replies.post)
          |=  [=time reply=(unit v-reply:c)]
          ?~  reply  |
          =((get-author-ship:utils author.u.reply) our.bowl)
        ?.  (want-hark %ours)  ~
        ?+    -.kind.post  ~
            %diary  `diary-notification
            %heap   `heap-notification
            %chat
          :-  ~
          :~  [%ship reply-author]
              ' replied to your message “'
              (flatten:utils content.post)
              '”: '
              [%ship reply-author]
              ': '
              (flatten:utils content.reply)
          ==
        ==
      ::  only notify if we want to be notified about everything
      ::
      ?.  (want-hark %any)
        ~
      ?+    -.kind.post  ~
          %diary  ~
          %heap   ~
          %chat
        :-  ~
        :~  [%ship reply-author]
            ' sent a message: '
            (flatten:utils content.reply)
        ==
      ==
    ::
    ++  want-hark
      |=  kind=?(%mention %ours %any)
      %+  (fit-level:volume [our now]:bowl)
        [%channel nest]
      ?-  kind
        %mention  %soft  ::  mentioned us
        %ours     %soft  ::  replied to us or our context
        %any      %loud  ::  any message
      ==
    --
  ::
  ++  ca-rope
    |=  [=kind:c =id-post:c id-reply=(unit id-reply:c)]
    ^-  rope:ha
    =/  =path
      ?-    kind
        %diary  /note/(rsh 4 (scot %ui id-post))
        %heap   /curio/(rsh 4 (scot %ui id-post))
        %chat   /message/(rsh 4 (scot %ui id-post))
      ==
    =/  rest
      ?~  id-reply  path
      (snoc path (rsh 4 (scot %ui u.id-reply)))
    =*  group  group.perm.perm.channel
    =/  gn=nest:g  nest
    =/  thread  (welp /[kind.nest]/(scot %p ship.nest)/[name.nest] rest)
    [`group `gn q.byk.bowl thread]
  ::
  ::  convert content into a full yarn suitable for hark
  ::
  ++  ca-spin
    |=  [=rope:ha con=(list content:ha) but=(unit button:ha)]
    ^-  new-yarn:ha
    =*  group  group.perm.perm.channel
    =/  link  (welp /groups/(scot %p p.group)/[q.group]/channels ted.rope)
    [& & rope con link but]
  ::
  ::  give a "response" to our subscribers
  ::
  ++  ca-response
    |=  =r-channel:c
    =/  =r-channels:c  [nest r-channel]
    ::TODO  the mark type changing will give us trouble, right?
    =.  ca-core
      %^  give  %fact
        ~[/v2 v2+ca-area]
      channel-response-3+!>(r-channels)
    ::
    ::  omit %meta response in previous versions
    ?:  ?=(%meta -.r-channel)  ca-core
    =.  ca-core
      %^  give  %fact
        ~[/v1 v1+ca-area]
      channel-response-2+!>((r-channels-1:utils r-channels))
    =;  r-simple=r-channels-simple-post:v7:old:c
      %^  give  %fact
        ~[/ ca-area /v0 v0+ca-area]
      channel-response+!>(r-simple)
    :-  nest
    ?+    r-channel  r-channel
        [%posts *]
      r-channel(posts (s-posts-1:utils posts.r-channel))
    ::
        [%post * %set *]
      r-channel(post.r-post (bind post.r-post.r-channel s-post-1:utils))
    ::
        [%post * %reply * * %set *]
      %=    r-channel
          ::
          reply.r-reply.r-post
        (bind reply.r-reply.r-post.r-channel s-reply-1:utils)
        ::
          reply-meta.r-post
        (reply-meta-1:utils reply-meta.r-post.r-channel)
      ==
    ::
        [%post * %reply * * %reacts *]
      %=    r-channel
          ::
          reply-meta.r-post
        (reply-meta-1:utils reply-meta.r-post.r-channel)
        ::
          reacts.r-reply.r-post
        (reacts-1:utils reacts.r-reply.r-post.r-channel)
      ==
    ::
        [%post * %reacts *]
      r-channel(reacts.r-post (reacts-1:utils reacts.r-post.r-channel))
    ::
        [%post id-post:c %essay *]
      r-channel(essay.r-post (essay-1:utils essay.r-post.r-channel))
    ::
        [%pending client-id:c %post *]
      %=    r-channel
          essay.r-pending
        (essay-1:utils essay.r-pending.r-channel)
      ==
    ::
        [%pending client-id:c %reply *]
      %=    r-channel
          ::
          reply-meta.r-pending
        (reply-meta-1:utils reply-meta.r-pending.r-channel)
        ::
          memo.r-pending
        (memo-1:utils memo.r-pending.r-channel)
      ==
    ==
  ::
  ::  produce an up-to-date unread state
  ::
  ++  ca-unread
    ^-  unread:c
    :-  recency.remark.channel
    =/  unreads
      %+  skim
        %-  bap:on-v-posts:c
        (lot:on-v-posts:c posts.channel `last-read.remark.channel ~)
      |=  [tim=time post=(unit v-post:c)]
      ?&  ?=(^ post)
          !=(author.u.post our.bowl)
      ==
    =/  count  (lent unreads)
    =/  unread=(unit [id-post:c @ud])
      ::TODO  in the ~ case, we could traverse further up, to better handle
      ::      cases where the most recent message was deleted.
      ?~  unreads  ~
      (some -:(rear unreads) count)
    ::  now do the same for all unread threads
    ::
    =/  [sum=@ud threads=(map id-post:c [id-reply:c @ud])]
      %+  roll  ~(tap in unread-threads.remark.channel)
      |=  [id=id-post:c sum=@ud threads=(map id-post:c [id-reply:c @ud])]
      =/  parent    (get:on-v-posts:c posts.channel id)
      ?~  parent    [sum threads]
      ?~  u.parent  [sum threads]
      =/  unreads
        %+  skim
          %-  bap:on-v-replies:c
          (lot:on-v-replies:c replies.u.u.parent `last-read.remark.channel ~)
        |=  [tim=time reply=(unit v-reply:c)]
        ?&  ?=(^ reply)
            !=(author.u.reply our.bowl)
        ==
      =/  count=@ud  (lent unreads)
      :-  (add sum count)
      ?~  unreads  threads
      (~(put by threads) id -:(rear unreads) count)
    [(add count sum) unread threads]
  ::
  ::  handle scries
  ::
  ++  ca-peek
    |=  [=(pole knot) ver=?(%v0 %v1 %v2 %v3)]
    ^-  (unit (unit cage))
    ?+    pole  [~ ~]
    ::
        [%posts rest=*]
      ?:  ?=(%v0 ver)  (ca-peek-posts-0 rest.pole)
      (ca-peek-posts rest.pole ver)
    ::
        [%perm ~]        ``channel-perm+!>(perm.perm.channel)
    ::
        [%hark %rope post=@ ~]
      =/  id  (slav %ud post.pole)
      :^  ~  ~  %noun  !>
      ?.  (has:on-v-posts:c posts.channel id)  ~
      `(ca-rope kind.nest id ~)
    ::
        [%hark %rope post=@ reply=@ ~]
      =/  post-id  (slav %ud post.pole)
      =/  reply-id  (slav %ud reply.pole)
      :^  ~  ~  %noun  !>
      =/  post  (get:on-v-posts:c posts.channel post-id)
      ?~  post  ~
      ?~  u.post  ~
      ?.  (has:on-v-replies:c replies.u.u.post reply-id)  ~
      `(ca-rope kind.nest post-id `reply-id)
    ::
        [%search %bounded kind=?(%text %mention) from=@ tries=@ nedl=@ ~]
      :+  ~  ~
      =;  =scam:c
        ?:  ?=(%v3 ver)
          channel-scam-2+!>(scam)
        channel-scam+!>((scam-1:utils scam))
      %^    ?-  kind.pole
              %text     text:tries-bound:ca-search
              %mention  mention:tries-bound:ca-search
            ==
          ?:  =(%$ from.pole)  ~
          `(slav %ud from.pole)
        (slav %ud tries.pole)
      ?-  kind.pole
        %text     (fall (slaw %t nedl.pole) nedl.pole)
        %mention  (slav %p nedl.pole)
      ==
    ::
        [%search %text skip=@ count=@ nedl=@ ~]
      :+  ~  ~
      =;  =scan:c
        ?:  ?=(%v3 ver)
          channel-scan-2+!>(scan)
        channel-scan+!>((scan-1:utils scan))
      %^    text:hits-bound:ca-search
          (slav %ud skip.pole)
        (slav %ud count.pole)
      (fall (slaw %t nedl.pole) nedl.pole)
    ::
        [%search %mention skip=@ count=@ nedl=@ ~]
      :+  ~  ~
      =;  =scan:c
        ?:  ?=(%v3 ver)
          channel-scan-2+!>(scan)
        channel-scan+!>((scan-1:utils scan))
      %^    mention:hits-bound:ca-search
          (slav %ud skip.pole)
        (slav %ud count.pole)
      (slav %p nedl.pole)
    ==
  ::
  ++  give-posts-0
    |=  [mode=?(%outline %post) ls=(list [time (unit v-post:c)])]
    ^-  (unit (unit cage))
    =/  posts=v-posts:c  (gas:on-v-posts:c *v-posts:c ls)
    =;  paged-posts=paged-simple-posts:v7:old:c
      ``channel-simple-posts+!>(paged-posts)
    ?:  =(0 (lent ls))  [*simple-posts:v7:old:c ~ ~ 0]
    =/  posts=simple-posts:v7:old:c
      ?:  =(%post mode)  (suv-posts-1:utils posts)
      (suv-posts-without-replies-1:utils posts)
    =/  newer=(unit time)
      =/  more  (tab:on-v-posts:c posts.channel `-:(rear ls) 1)
      ?~(more ~ `-:(head more))
    =/  older=(unit time)
      =/  more  (bat:mo-v-posts:c posts.channel `-:(head ls) 1)
      ?~(more ~ `-:(head more))
    :*  posts
        newer
        older
        (wyt:on-v-posts:c posts.channel)
    ==
  ::
  ++  give-posts-1
    |=  [mode=?(%outline %post) ls=(list [time (unit v-post:c)])]
    ^-  (unit (unit cage))
    =/  posts=v-posts:c  (gas:on-v-posts:c *v-posts:c ls)
    =;  =paged-posts:v1:old:c
      ``channel-posts+!>(paged-posts)
    ?:  =(0 (lent ls))  [*posts:v1:old:c ~ ~ 0]
    =/  =posts:v1:old:c
      ?:  =(%post mode)  (uv-posts:utils posts)
      (uv-posts-without-replies:utils posts)
    =/  newer=(unit time)
      =/  more  (tab:on-v-posts:c posts.channel `-:(rear ls) 1)
      ?~(more ~ `-:(head more))
    =/  older=(unit time)
      =/  more  (bat:mo-v-posts:c posts.channel `-:(head ls) 1)
      ?~(more ~ `-:(head more))
    :*  posts
        newer
        older
        (wyt:on-v-posts:c posts.channel)
    ==
  ::
  ++  give-posts-2
    |=  [mode=?(%outline %post) ls=(list [time (unit v-post:c)])]
    ^-  (unit (unit cage))
    =/  posts=v-posts:c  (gas:on-v-posts:c *v-posts:c ls)
    =;  =paged-posts:v7:old:c
      ``channel-posts-2+!>(paged-posts)
    ?:  =(0 (lent ls))  [*posts:v7:old:c ~ ~ 0]
    =/  =posts:v7:old:c
      ?:  =(%post mode)  (uv-posts-1:utils posts)
      (uv-posts-without-replies-1:utils posts)
    =/  newer=(unit time)
      =/  more  (tab:on-v-posts:c posts.channel `-:(rear ls) 1)
      ?~(more ~ `-:(head more))
    =/  older=(unit time)
      =/  more  (bat:mo-v-posts:c posts.channel `-:(head ls) 1)
      ?~(more ~ `-:(head more))
    :*  posts
        newer
        older
        (wyt:on-v-posts:c posts.channel)
    ==
  ::
  ++  give-posts-3
    |=  [mode=?(%outline %post) ls=(list [time (unit v-post:c)])]
    ^-  (unit (unit cage))
    =/  posts=v-posts:c  (gas:on-v-posts:c *v-posts:c ls)
    =;  =paged-posts:c
      ``channel-posts-3+!>(paged-posts)
    ?:  =(0 (lent ls))  [*posts:c ~ ~ 0]
    =/  =posts:c
      ?:  =(%post mode)  (uv-posts-2:utils posts)
      (uv-posts-without-replies-2:utils posts)
    =/  newer=(unit time)
      =/  more  (tab:on-v-posts:c posts.channel `-:(rear ls) 1)
      ?~(more ~ `-:(head more))
    =/  older=(unit time)
      =/  more  (bat:mo-v-posts:c posts.channel `-:(head ls) 1)
      ?~(more ~ `-:(head more))
    :*  posts
        newer
        older
        (wyt:on-v-posts:c posts.channel)
    ==
  ::
  ++  ca-peek-posts-0
    |=  =(pole knot)
    ^-  (unit (unit cage))
    =*  on   on-v-posts:c
    ?+    pole  [~ ~]
        [%newest count=@ mode=?(%outline %post) ~]
      =/  count  (slav %ud count.pole)
      =/  ls     (top:mo-v-posts:c posts.channel count)
      (give-posts-0 mode.pole ls)
    ::
        [%older start=@ count=@ mode=?(%outline %post) ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %ud start.pole)
      =/  ls     (bat:mo-v-posts:c posts.channel `start count)
      (give-posts-0 mode.pole ls)
    ::
        [%newer start=@ count=@ mode=?(%outline %post) ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %ud start.pole)
      =/  ls     (tab:on posts.channel `start count)
      (give-posts-0 mode.pole ls)
    ::
        [%around time=@ count=@ mode=?(%outline %post) ~]
      =/  count  (slav %ud count.pole)
      =/  time  (slav %ud time.pole)
      =/  older  (bat:mo-v-posts:c posts.channel `time count)
      =/  newer  (tab:on posts.channel `time count)
      =/  post   (get:on posts.channel time)
      =/  posts
          ?~  post  (welp older newer)
          (welp (snoc older [time u.post]) newer)
      (give-posts-0 mode.pole posts)
    ::
        [%post time=@ ~]
      =/  time  (slav %ud time.pole)
      =/  post  (get:on posts.channel time)
      ?~  post  ~
      ?~  u.post  `~
      ``channel-simple-post+!>((suv-post:utils u.u.post))
    ::
        [%post %id time=@ %replies rest=*]
      =/  time  (slav %ud time.pole)
      =/  post  (get:on posts.channel `@da`time)
      ?~  post  ~
      ?~  u.post  `~
      (ca-peek-replies-0 id.u.u.post replies.u.u.post rest.pole)
    ==
  ::
  ++  ca-peek-posts
    |=  [=(pole knot) version=?(%v1 %v2 %v3)]
    ^-  (unit (unit cage))
    =*  on   on-v-posts:c
    ?+    pole  [~ ~]
        [%newest count=@ mode=?(%outline %post) ~]
      =/  count  (slav %ud count.pole)
      =/  ls     (top:mo-v-posts:c posts.channel count)
      %.  [mode.pole ls]
      ?-  version
        %v1  give-posts-1
        %v2  give-posts-2
        %v3  give-posts-3
      ==
    ::
        [%older start=@ count=@ mode=?(%outline %post) ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %ud start.pole)
      =/  ls     (bat:mo-v-posts:c posts.channel `start count)
      %.  [mode.pole ls]
      ?-  version
        %v1  give-posts-1
        %v2  give-posts-2
        %v3  give-posts-3
      ==
    ::
        [%newer start=@ count=@ mode=?(%outline %post) ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %ud start.pole)
      =/  ls     (tab:on posts.channel `start count)
      %.  [mode.pole ls]
      ?-  version
        %v1  give-posts-1
        %v2  give-posts-2
        %v3  give-posts-3
      ==
    ::
        [%around time=@ count=@ mode=?(%outline %post) ~]
      =/  count  (slav %ud count.pole)
      =/  time  (slav %ud time.pole)
      =/  older  (bat:mo-v-posts:c posts.channel `time count)
      =/  newer  (tab:on posts.channel `time count)
      =/  post   (get:on posts.channel time)
      =/  posts
        ?~  post  (welp older newer)
        (welp (snoc older [time u.post]) newer)
      %.  [mode.pole posts]
      ?-  version
        %v1  give-posts-1
        %v2  give-posts-2
        %v3  give-posts-3
      ==
    ::
        [%changes start=@ end=@ after=@ ~]
      =/  start=id-post:c
        ?^  tim=(slaw %da start.pole)  u.tim
        (slav %ud start.pole)
      =/  end=id-post:c
        ?^  tim=(slaw %da end.pole)  u.tim
        (slav %ud end.pole)
      =/  after=id-post:c
        ?^  tim=(slaw %da after.pole)  u.tim
        (slav %ud after.pole)
      =;  posts=v-posts:c
        =/  newer
          ?~  newer=(tab:on-v-posts:c posts.channel `end 1)
            ~
          `key:(head newer)
        =/  older
          ?~  older=(bat:mo-v-posts:c posts.channel `start 1)
            ~
          `key:(head older)
        ?-  version
        ::
            %v1
          =/  =paged-posts:v1:old:c
            [(uv-posts:utils posts) newer older (wyt:on-v-posts:c posts)]
          ``channel-posts+!>(paged-posts)
        ::
            %v2
            =/  =paged-posts:v7:old:c
              [(uv-posts-1:utils posts) newer older (wyt:on-v-posts:c posts)]
            ``channel-posts-2+!>(paged-posts)
        ::
            %v3
            =/  =paged-posts:c
              [(uv-posts-2:utils posts) newer older (wyt:on-v-posts:c posts)]
            ``channel-posts-3+!>(paged-posts)
        ==
      ::  walk both posts and logs, in chronological order, newest-first,
      ::  until we accumulate the desired amount of results
      ::
      ::NOTE  would manually walk the tree, but logic gets rather confusing,
      ::      so we just eat the conversion overhead here
      =/  posts  (lot:on-v-posts:c posts.channel `(sub start 1) `(add end 1))
      =/  updated  (tap:updated-on:c (lot:updated-on:c last-updated.channel `after ~))
      %-  (log |.("posts: {<(lent posts)>}"))
      %-  (log |.("updated: {<(lent updated)>}"))
      %-  (log |.("start: {<start>}"))
      %-  (log |.("end: {<end>}"))
      =|  out=v-posts:c
      |-  ^+  out
      ::  no posts in this range
      ?~  posts  ~
      ::  no changes after this point
      ?~  updated  out
      =*  changed  val.i.updated
      %-  (log |.("changed post: {<changed>}"))
      %-  (log |.("  gte start: {<(gte changed start)>}"))
      %-  (log |.("  lte end: {<(lte changed end)>}"))
      ::  if the post is not in our subset, skip
      ?~  post=(get:on-v-posts:c posts changed)
        $(updated t.updated)
      =.  out  (put:on-v-posts:c out changed u.post)
      $(updated t.updated)
    ::
        [%post time=@ ~]
      =/  time  (slav %ud time.pole)
      =/  post  (get:on posts.channel time)
      ?~  post  ~
      ?~  u.post  `~
      ?-  version
        %v1  ``channel-post+!>((uv-post:utils u.u.post))
        %v2  ``channel-post-2+!>((uv-post-1:utils u.u.post))
        %v3  ``channel-post-3+!>((uv-post-2:utils u.u.post))
      ==
    ::
        [%post %id time=@ %replies rest=*]
      =/  time  (slav %ud time.pole)
      =/  post  (get:on posts.channel `@da`time)
      ?~  post  ~
      ?~  u.post  `~
      (ca-peek-replies id.u.u.post replies.u.u.post rest.pole version)
    ==
  ::
  ++  ca-peek-replies-0
    |=  [parent-id=id-post:c replies=v-replies:c =(pole knot)]
    ^-  (unit (unit cage))
    =*  on   on-v-replies:c
    ?+    pole  [~ ~]
        [%all ~]
      ``channel-simple-replies+!>((suv-replies-1:utils parent-id replies))
        [%newest count=@ ~]
      =/  count  (slav %ud count.pole)
      =/  reply-map  (gas:on *v-replies:c (top:mo-v-replies:c replies count))
      ``channel-simple-replies+!>((suv-replies-1:utils parent-id reply-map))
    ::
        [%older start=@ count=@ ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %ud start.pole)
      =/  reply-map  (gas:on *v-replies:c (bat:mo-v-replies:c replies `start count))
      ``channel-simple-replies+!>((suv-replies-1:utils parent-id reply-map))
    ::
        [%newer start=@ count=@ ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %ud start.pole)
      =/  reply-map  (gas:on *v-replies:c (tab:on replies `start count))
      ``channel-simple-replies+!>((suv-replies-1:utils parent-id reply-map))
    ::
        [%reply %id time=@ ~]
      =/  time  (slav %ud time.pole)
      =/  reply  (get:on-v-replies:c replies `@da`time)
      ?~  reply  ~
      ?~  u.reply  `~
      ``channel-simple-reply+!>(`simple-reply:v7:old:c`(suv-reply-1:utils parent-id u.u.reply))
    ==
  ::
  ++  ca-peek-replies
    |=  [parent-id=id-post:c replies=v-replies:c =(pole knot) version=?(%v1 %v2 %v3)]
    ^-  (unit (unit cage))
    =*  on   on-v-replies:c
    ?+    pole  [~ ~]
        [%all ~]
      ?:  ?=(%v3 version)
        ``channel-replies-3+!>((uv-replies-2:utils parent-id replies))
      ?:  ?=(%v2 version)
        ``channel-replies-2+!>((uv-replies-1:utils parent-id replies))
      ``channel-replies+!>((uv-replies:utils parent-id replies))
        [%newest count=@ ~]
      =/  count  (slav %ud count.pole)
      =/  reply-map  (gas:on *v-replies:c (top:mo-v-replies:c replies count))
      ?:  ?=(%v3 version)
        ``channel-replies-3+!>((uv-replies-2:utils parent-id reply-map))
      ?:  ?=(%v2 version)
        ``channel-replies-2+!>((uv-replies-1:utils parent-id reply-map))
      ``channel-replies+!>((uv-replies:utils parent-id reply-map))
    ::
        [%older start=@ count=@ ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %ud start.pole)
      =/  reply-map  (gas:on *v-replies:c (bat:mo-v-replies:c replies `start count))
      ?:  ?=(%v3 version)
        ``channel-replies-3+!>((uv-replies-2:utils parent-id reply-map))
      ?:  ?=(%v2 version)
        ``channel-replies-2+!>((uv-replies-1:utils parent-id reply-map))
      ``channel-replies+!>((uv-replies:utils parent-id reply-map))
    ::
        [%newer start=@ count=@ ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %ud start.pole)
      =/  reply-map  (gas:on *v-replies:c (tab:on replies `start count))
      ?:  ?=(%v3 version)
        ``channel-replies-3+!>((uv-replies-2:utils parent-id reply-map))
      ?:  ?=(%v2 version)
        ``channel-replies-2+!>((uv-replies-1:utils parent-id reply-map))
      ``channel-replies+!>((uv-replies:utils parent-id reply-map))
    ::
        [%reply %id time=@ ~]
      =/  time  (slav %ud time.pole)
      =/  reply  (get:on-v-replies:c replies `@da`time)
      ?~  reply  ~
      ?~  u.reply  `~
      ?:  ?=(%v3 version)
        ``channel-reply-2+!>(`reply:c`(uv-reply-2:utils parent-id u.u.reply))
      ``channel-reply+!>(`reply:v7:old:c`(uv-reply-1:utils parent-id u.u.reply))
    ==
  ::
  ++  ca-search
    |^  |%
        ::NOTE  largely considered deprecated in favor of +tries-bound,
        ::      which (when used sanely) delivers better performance and ux.
        ++  hits-bound  ::  searches until len results
          |%
          ++  mention
            |=  [sip=@ud len=@ud nedl=ship]
            ^-  scan:c
            (scour-count sip len %mention nedl)
          ::
          ++  text
            |=  [sip=@ud len=@ud nedl=@t]
            ^-  scan:c
            (scour-count sip len %text nedl)
          --
        ::
        ++  tries-bound  ::  searches until sum messages searched
          |%
          ++  mention
            |=  [fro=(unit id-post:c) sum=@ud nedl=ship]
            ^-  [(unit id-post:c) scan:c]
            (scour-tries fro sum %mention nedl)
          ::
          ++  text
            |=  [fro=(unit id-post:c) sum=@ud nedl=@t]
            ^-  [(unit id-post:c) scan:c]
            (scour-tries fro sum %text nedl)
          --
        --
    ::
    +$  match-type
      $%  [%mention nedl=ship]
          [%text nedl=@t]
      ==
    ::
    ++  scour-tries
      |=  [from=(unit id-post:c) tries=@ud =match-type]
      =*  posts  posts.channel
      =.  posts  (lot:on-v-posts:c posts ~ from)  ::  verified correct
      =|  s=[tries=_tries last=(unit id-post:c) =scan:c]
      =<  [last scan]
      |-  ^+  s
      ?~  posts  s
      ?:  =(0 tries.s)  s
      =.  s  $(posts r.posts)  ::  process latest first
      ?:  =(0 tries.s)  s
      ::
      =.  scan.s
        ?~  val.n.posts  scan.s
        ?.  (match u.val.n.posts match-type)  scan.s
        :_  scan.s
        [%post `simple-post:c`(suv-post-without-replies-2:utils u.val.n.posts)]
      ::
      =.  scan.s
        ?~  val.n.posts  scan.s
        =*  id-post  id.u.val.n.posts
        =*  replies  replies.u.val.n.posts
        |-  ^+  scan.s
        ?~  replies  scan.s
        =.  scan.s  $(replies r.replies)
        ::
        =.  scan.s
          ?~  val.n.replies  scan.s
          ?.  (match-reply u.val.n.replies match-type)  scan.s
          :_  scan.s
          [%reply id-post (suv-reply-2:utils id-post u.val.n.replies)]
        ::
        $(replies l.replies)
      ::
      =.  last.s  `key.n.posts
      =.  tries.s  (dec tries.s)
      $(posts l.posts)
    ::
    ++  scour-count
      |=  [skip=@ud len=@ud =match-type]
      =*  posts  posts.channel
      ?>  (gth len 0)
      =+  s=[skip=skip len=len *=scan:c]
      =-  (flop scan)
      ::NOTE  yes, walking the tree manually is faster than using built-ins.
      ::      +dop:mo gets closest, but is still slower.
      ::      should re-evaluate the implementation here is mops ever get jets.
      |-  ^+  s
      ?~  posts  s
      ?:  =(0 len.s)  s
      =.  s  $(posts r.posts)
      ?:  =(0 len.s)  s
      ::
      =.  s
        ?~  val.n.posts  s
        ?.  (match u.val.n.posts match-type)  s
        ?:  (gth skip.s 0)
          s(skip (dec skip.s))
        =/  res  [%post (suv-post-without-replies-2:utils u.val.n.posts)]
        s(len (dec len.s), scan [res scan.s])
      ::
      =.  s
        ?~  val.n.posts  s
        (scour-replys s id.u.val.n.posts replies.u.val.n.posts match-type)
      ::
      $(posts l.posts)
    ::
    ++  scour-replys
      |=  [s=[skip=@ud len=@ud =scan:c] =id-post:c replies=v-replies:c =match-type]
      |-  ^+  s
      ?~  replies  s
      ?:  =(0 len.s)  s
      =.  s  $(replies r.replies)
      ?:  =(0 len.s)  s
      ::
      =.  s
        ?~  val.n.replies  s
        ?.  (match-reply u.val.n.replies match-type)  s
        ?:  (gth skip.s 0)
          s(skip (dec skip.s))
        =/  res  [%reply id-post (suv-reply-2:utils id-post u.val.n.replies)]
        s(len (dec len.s), scan [res scan.s])
      ::
      $(replies l.replies)
    ::
    ++  match
      |=  [post=v-post:c =match-type]
      ^-  ?
      ?-  -.match-type
        %mention  (match-post-mention nedl.match-type post)
        %text     (match-post-text nedl.match-type post)
      ==
    ::
    ++  match-reply
      |=  [reply=v-reply:c =match-type]
      ?-  -.match-type
        %mention  (match-story-mention nedl.match-type content.reply)
        %text     (match-story-text nedl.match-type content.reply)
      ==
    ::
    ++  match-post-mention
      |=  [nedl=ship post=v-post:c]
      ^-  ?
      ?:  ?=([%chat %notice ~] kind.post)  |
      (match-story-mention nedl content.post)
    ::
    ++  match-story-mention
      |=  [nedl=ship =story:c]
      %+  lien  story
      |=  =verse:^story
      ?.  ?=(%inline -.verse)  |
      %+  lien  p.verse
      |=  =inline:^story
      ?+  -.inline  |
        %ship                                  =(nedl p.inline)
        ?(%bold %italics %strike %blockquote)  ^$(p.verse p.inline)
      ==
    ::
    ++  match-post-text
      |=  [nedl=@t post=v-post:c]
      ^-  ?
      ?:  ?=([%chat %notice ~] kind.post)  |
      ::
      ?~  meta.post
        (match-story-text nedl content.post)
      %+  match-story-text  nedl
      :*  ~[%inline title.u.meta.post]
          ~[%inline description.u.meta.post]
          content.post
      ==
    ::
    ++  match-story-text
      |=  [nedl=@t =story:c]
      %+  lien  story
      |=  =verse:^story
      ?.  ?=(%inline -.verse)  |
      %+  lien  p.verse
      |=  =inline:^story
      ?@  inline
        (find nedl inline |)
      ?+  -.inline  |
        ?(%bold %italics %strike %blockquote)  ^$(p.verse p.inline)
        ?(%code %inline-code)                  $(inline p.inline)
        %ship                                  $(inline (scot %p p.inline))
      ::
          %sect
        ?~  p.inline  $(inline '@all')
        $(inline (cat 3 '@' p.inline))
      ::
          %link
        ?|  $(inline p.inline)
        ?&  !=(p.inline q.inline)
            $(inline q.inline)
        ==  ==
      ==
    ::
    ++  find
      |=  [nedl=@t hay=@t case=?]
      ^-  ?
      =/  nlen  (met 3 nedl)
      =/  hlen  (met 3 hay)
      ?:  (lth hlen nlen)
        |
      =?  nedl  !case
        (cass nedl)
      =/  pos  0
      =/  lim  (sub hlen nlen)
      |-
      ?:  (gth pos lim)
        |
      ?:  .=  nedl
          ?:  case
            (cut 3 [pos nlen] hay)
          (cass (cut 3 [pos nlen] hay))
        &
      $(pos +(pos))
    ::
    ::NOTE  :(cork trip ^cass crip) may be _very slightly_ faster,
    ::      but not enough to matter
    ++  cass
      |=  text=@t
      ^-  @t
      %^    run
          3
        text
      |=  dat=@
      ^-  @
      ?.  &((gth dat 64) (lth dat 91))
        dat
      (add dat 32)
    --
  ::
  ::  when we receive an update from the group we're in, check if we
  ::  need to change anything
  ::
  ++  ca-recheck
    |=  sects=(set sect:v0:gv)
    =/  =flag:g  group.perm.perm.channel
    =/  exists-path
      (scry-path %groups /groups/(scot %p p.flag)/[q.flag])
    =+  .^(exists=? %gu exists-path)
    ?.  exists  ca-core
    =/  =path
      %+  scry-path  %groups
      /v2/groups/(scot %p p.flag)/[q.flag]/noun
    =+  .^(group=group:v7:gv %gx path)
    ?.  (~(has by channels.group) nest)  ca-core
    ::  toggle the volume based on permissions
    =/  =source:activity  [%channel nest flag]
    ?.  (can-read:ca-perms our.bowl)
      (send:ca-activity [%adjust source ~] ~)
    =+  .^(=volume-settings:activity %gx (scry-path %activity /volume-settings/noun))
    =.  ca-core
      ::  if we don't have a setting, no-op
      ?~  setting=(~(get by volume-settings) source)  ca-core
      ::  if they have a setting that's not mute, retain it otherwise
      ::  delete setting if it's mute so it defaults
      ?.  =(setting mute:activity)  ca-core
      (send:ca-activity [%adjust source ~] ~)
    ::  if our read permissions restored, re-subscribe
    (ca-safe-sub |)
  ::
  ::  assorted helpers
  ::
  ++  ca-from-host  |(=(ship.nest src.bowl) =(p.group.perm.perm.channel src.bowl))
  ::
  ::  leave the subscription only
  ::
  ++  ca-simple-leave
    (unsubscribe ca-sub-wire [ship.nest server])
  ::
  ::  Leave the subscription, tell people about it, and delete our local
  ::  state for the channel
  ::
  ++  ca-leave
    =.  ca-core  ca-simple-leave
    =.  ca-core  (ca-response %leave ~)
    =.  ca-core  (send:ca-activity [%del %channel nest group.perm.perm.channel] ~)
    =.  gone  &
    ca-core
  --
--

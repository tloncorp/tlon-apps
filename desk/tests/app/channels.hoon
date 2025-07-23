/-  g=groups, c=channels
/+  *test-agent, s=subscriber, imp=import-aid
/=  channels-agent  /app/channels
|%
+$  current-state
  $:  %10
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
::
++  dap  %channels-test
++  server-dap  %channels-test-server
++  negotiate  /~/negotiate/inner-watch/~zod/[server-dap]
++  sub-wire  /chat/(scot %p ~zod)/test
++  negotiate-wire  (weld negotiate /chat/(scot %p ~zod)/test)
++  chk-wire  (weld negotiate-wire /checkpoint)
++  chk-path  /chat/test/checkpoint/before/100
++  the-dock  [~zod server-dap]
++  the-nest  [%chat ~zod %test]
++  the-group  [~zod %test]
++  scry
  |=  =(pole knot)
  ?+  pole  !!
    [%gu ship=@t %activity @ ~ ~]  `!>(|)
  ==
++  test-checkpoint-sub
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (set-scry-gate scry)
  ;<  *  bind:m  channel-join
  =/  retry  (weld /~/retry (weld sub-wire /checkpoint))
  (check-subscription-loop chk-wire chk-wire the-dock chk-path retry)
++  test-updates-sub
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (set-scry-gate scry)
  ;<  *  bind:m  channel-join
  ::  get checkpoint and start updates
  =/  =cage  [%channel-checkpoint !>(*u-checkpoint:c)]
  ;<  *  bind:m  (do-agent chk-wire the-dock %fact cage)
  =/  updates-wire  (weld negotiate-wire /updates)
  ::  kicking updates retries back to checkpoint
  =/  updates-retry  (weld /~/retry (weld sub-wire /checkpoint))
  ;<  *  bind:m  (do-agent updates-wire the-dock %watch-ack ~)
  (check-subscription-loop updates-wire chk-wire the-dock chk-path updates-retry)
++  test-backlog-sub
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (set-scry-gate scry)
  ;<  *  bind:m  channel-join
  ;<  bw=bowl  bind:m  get-bowl
  ::  get checkpoint and start updates
  =/  last-post-time  (add now.bw 1)
  =/  last-post=v-post:c
    :-  [last-post-time 1 last-post-time ~ ~]
    [0 [[~ ~dev last-post-time] /chat ~ ~]]
  =/  posts=v-posts:c
    (gas:on-v-posts:c *v-posts:c ~[[last-post-time &+last-post]])
  =/  checkpoint  *u-checkpoint:c
  =/  =cage  [%channel-checkpoint !>(checkpoint(posts posts))]
  ;<  *  bind:m  (do-agent chk-wire the-dock %fact cage)
  =/  backlog-wire  (weld negotiate-wire /backlog)
  =/  backlog-path
    %+  welp  /chat/test/checkpoint/time-range
    /(scot %da *@da)/(scot %da last-post-time)
  =/  backlog-retry  (weld /~/retry (weld sub-wire /backlog))
  ;<  *  bind:m  (do-agent backlog-wire the-dock %watch-ack ~)
  (check-subscription-loop backlog-wire backlog-wire the-dock backlog-path backlog-retry)
++  check-subscription-loop
  |=  [sub=wire resub=wire =dock =path retry-wire=wire]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (set-scry-gate scry)
  ;<  bw=bowl  bind:m  get-bowl
  =/  now=time  now.bw
  ::  kick & resubscribe with delay
  ;<  caz=(list card)  bind:m  (do-agent sub dock %kick ~)
  =/  next=time  (add now ~s30)
  ;<  *  bind:m
  (ex-cards caz (ex-arvo retry-wire %b %wait next) ~)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(now next)))
  ::  wakeup & resubscribe no delay
  ;<  caz=(list card)  bind:m  (do-arvo retry-wire %behn %wake ~)
  (ex-cards caz (ex-task resub dock %watch path) ~)
++  channel-join
  =/  m  (mare ,(list card))
  ^-  form:m
  ::  join channel
  ;<  *  bind:m  (do-init dap channels-agent)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev)))
  ;<  *  bind:m  (do-poke %channel-action-1 !>([%channel the-nest %join the-group]))
  (do-agent chk-wire the-dock %watch-ack ~)
::
::  migration 7->8 used to drop message tombstones.
::  if we're in that state, we must recover them from the log.
::
++  test-sequence-fix
  |^  test
  ++  missing-key
    ~2025.6.25..14.41.11..9300
  ++  tombstone-key
    ~2025.6.25..14.41.13..585b
  ++  misnumber-key
    ~2025.6.25..14.41.14..84fa
  ++  sequence-fix-test-channel
    ^-  v-channel:c
    :-  ^-  global:v-channel:c
        :*  ^=  posts
            %+  gas:on-v-posts:c  ~
            :~  :*  key=missing-key
                    %&
                    [id=missing-key seq=1 mod-at=~2025.6.25..14.41.11..9300 replies=~ reacts=~]
                    rev=0
                    :*  content=[[%inline 'one' [%break ~] ~] ~]
                          author=~zod
                          sent=~2025.6.25..14.41.11..9062.4dd2.f1a9.fbe7
                    ==
                    [kind=/chat meta=~ blob=~]
                ==
                :*  key=tombstone-key
                    [%| *tombstone:c]
                ==
                :*  key=misnumber-key
                    %&
                    [id=misnumber-key seq=3 mod-at=~2025.6.25..14.41.14..84fa replies=~ reacts=~]
                    rev=0
                    :*  content=[[%inline 'three' [%break ~] ~] ~]
                          author=~zod
                          sent=~2025.6.25..14.41.14..6ccc.cccc.cccc.cccc
                    ==
                    [kind=/chat meta=~ blob=~]
                ==
            ==
          ::
            count=3
            *(rev:c arranged-posts:c)
            *(rev:c view:c)
            *(rev:c sort:c)
            *(rev:c perm:c)
            *(rev:c (unit @t))
        ==
    ^-  local:v-channel:c
    :*  *net:c
        *log:c
        *remark:c
        *window:v-channel:c
        *future:v-channel:c
        *pending-messages:c
        *last-updated:c
    ==
  ++  test
    %-  eval-mare
    =/  m  (mare ,~)
    =/  bad-state=current-state
      =;  chans=v-channels:c
        [%10 chans ~ ~ ~ *^subs:s *pimp:imp]
      =/  chan=v-channel:c
        sequence-fix-test-channel
      ::  bad 7->8 migration in old code had dropped the tombstone
      ::
      =.  posts.chan
        +:(del:on-v-posts:c posts.chan tombstone-key)
      ::  client has partial backlog, missing the first message
      ::
      =.  posts.chan
        +:(del:on-v-posts:c posts.chan missing-key)
      ::  client has consequently misnumbered the 3rd msg as the 2nd
      ::
      =.  count.chan  2
      =.  posts.chan
        %+  put:on-v-posts:c  posts.chan
        :-  misnumber-key
        =+  (got:on-v-posts:c posts.chan misnumber-key)
        ?>  ?=(%& -<)
        -(seq 2)
      (~(put by *v-channels:c) *nest:c chan)
    ::TODO  annoying, can't do +do-load directly, but it always calls
    ::      +on-save, even if we provide a vase
    :: ;<  *  bind:m  (do-init dap channels-agent)
    ::  edit carefully to work around lib negotiate state.
    ::  yes, the inner state is double-vased!
    ::
    :: ;<  save=vase  bind:m  get-save
    :: =.  save  (slop (slot 2 save) !>(!>(bad-state)))
    ;<  *  bind:m  (do-load channels-agent `!>(bad-state))
    ;<  caz=(list card)  bind:m
      =;  seqs=(list [id-post:c (unit @ud)])
        (do-poke %noun !>([%sequence-numbers *nest:c 3 seqs]))
      :~  [missing-key `1]
          [tombstone-key ~]
          [misnumber-key `3]
      ==
    ::
    ;<  ~  bind:m  (ex-cards caz ~)
    ;<  save=vase  bind:m  get-save
    =/  fixed-state=current-state
      =;  chans=v-channels:c
        [%10 chans ~ ~ ~ *^subs:s *pimp:imp]
      =/  chan=v-channel:c
        sequence-fix-test-channel
      ::  missing message will not have magically recovered,
      ::  but everything else should've been patched up
      ::
      =.  posts.chan
        +:(del:on-v-posts:c posts.chan missing-key)
      ::  now (after this test was initially written) we changed the behavior
      ::  ignore tombstones, those get requested separately, see below
      ::
      =.  posts.chan
        +:(del:on-v-posts:c posts.chan tombstone-key)
      (~(put by *v-channels:c) *nest:c chan)
    ::
    =.  save  (slot 3 save)  ::  move "through" discipline state
    =.  save  !<(vase (slot 3 save))  ::  move "through" negotiate state & shenanigans
    (ex-equal save !>(fixed-state))
  --
::
::  migration 8->9 adds tombstone metadata. hosts can retrieve the metadata
::  from the log, but clients cannot, so they must ask the host.
::  this test checks whether clients apply the response from the host correctly.
::
++  test-tombstones-fix
  |^  test
  ++  missing-key
    ~2025.6.25..14.41.11..9300
  ++  tombstone-key
    ~2025.6.25..14.41.13..585b
  ++  overwrite-key
    ~2025.6.25..14.41.14..84fa
  ++  sequence-fix-test-channel
    ^-  v-channel:c
    :-  ^-  global:v-channel:c
        :*  ^=  posts
            %+  gas:on-v-posts:c  ~
            :~  :*  key=missing-key
                    [%| missing-key ~sul seq=1 del-at=~2025.7.23..09.10.11]
                ==
                :*  key=tombstone-key
                    [%| tombstone-key ~syx seq=2 del-at=~2025.7.23..08.07.06]
                ==
                :*  key=overwrite-key
                    [%| overwrite-key ~fun seq=3 del-at=~2025.7.23..11.12.13]
                ==
            ==
          ::
            count=3
            *(rev:c arranged-posts:c)
            *(rev:c view:c)
            *(rev:c sort:c)
            *(rev:c perm:c)
            *(rev:c (unit @t))
        ==
    ^-  local:v-channel:c
    :*  *net:c
        *log:c
        *remark:c
        *window:v-channel:c
        *future:v-channel:c
        *pending-messages:c
        *last-updated:c
    ==
  ++  test
    %-  eval-mare
    =/  m  (mare ,~)
    =/  bad-state=current-state
      =;  chans=v-channels:c
        [%10 chans ~ ~ ~ *^subs:s *pimp:imp]
      =/  chan=v-channel:c
        sequence-fix-test-channel
      ::  client had just bunted tombstones
      ::
      =.  posts.chan
        (put:on-v-posts:c posts.chan tombstone-key %| *tombstone:c)
      ::  client has partial backlog, missing the first message
      ::
      =.  posts.chan
        +:(del:on-v-posts:c posts.chan missing-key)
      ::  client is behind on updates somehow, has a live post,
      ::  but will receive a tombstone for it, must overwrite
      ::
      =.  posts.chan
        %^  put:on-v-posts:c  posts.chan
          overwrite-key
        :*  %&
            [id=overwrite-key seq=3 mod-at=~2025.6.25..14.41.11..9300 replies=~ reacts=~]
            rev=0
            :*  content=[[%inline 'one' [%break ~] ~] ~]
                  author=~zod
                  sent=~2025.6.25..14.41.11..9062.4dd2.f1a9.fbe7
            ==
            [kind=/chat meta=~ blob=~]
        ==
      (~(put by *v-channels:c) *nest:c chan)
    ::TODO  annoying, can't do +do-load directly, but it always calls
    ::      +on-save, even if we provide a vase
    :: ;<  *  bind:m  (do-init dap channels-agent)
    ::  edit carefully to work around lib negotiate state.
    ::  yes, the inner state is double-vased!
    ::
    :: ;<  save=vase  bind:m  get-save
    :: =.  save  (slop (slot 2 save) !>(!>(bad-state)))
    ;<  *  bind:m  (do-load channels-agent `!>(bad-state))
    ;<  caz=(list card)  bind:m
      =;  tombs=(list [id-post:v9:old:c tombstone:v9:old:c])
        (do-poke %noun !>([%tombstones *nest:c tombs]))
      :~  :*  key=missing-key
              [missing-key ~sul seq=1 del-at=~2025.7.23..09.10.11]
          ==
          :*  key=tombstone-key
              [tombstone-key ~syx seq=2 del-at=~2025.7.23..08.07.06]
          ==
          :*  key=overwrite-key
              [overwrite-key ~fun seq=3 del-at=~2025.7.23..11.12.13]
          ==
      ==
    ::
    ;<  ~  bind:m  (ex-cards caz ~)
    ;<  save=vase  bind:m  get-save
    =/  fixed-state=current-state
      =;  chans=v-channels:c
        [%10 chans ~ ~ ~ *^subs:s *pimp:imp]
      =/  chan=v-channel:c
        sequence-fix-test-channel
      (~(put by *v-channels:c) *nest:c chan)
    ::
    =.  save  (slot 3 save)  ::  move "through" discipline state
    =.  save  !<(vase (slot 3 save))  ::  move "through" negotiate state & shenanigans
    (ex-equal save !>(fixed-state))
  --
--

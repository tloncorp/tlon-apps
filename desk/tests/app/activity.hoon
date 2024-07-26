/-  a=activity, g=groups, c=channels, ch=chat
/+  *activity, *test-agent
/=  activity-agent  /app/activity
|%
++  dap  %activity
++  test-sync-reads-0
  =+  state-0:sync-reads
  (run-sync-reads pre-sync post-sync activity 5)
::
++  test-sync-reads-1
  =+  state-1:sync-reads
  (run-sync-reads pre-sync post-sync activity 5)
::
++  test-sync-reads-2
  =+  state-2:sync-reads
  (run-sync-reads pre-sync post-sync activity 5)
::
++  test-sync-reads-3
  =+  state-3:sync-reads
  (run-sync-reads pre-sync post-sync activity 9)
++  run-sync-reads
  |=  [pre=indices:a post=indices:a =activity:a count=@ud]
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (do-init dap activity-agent)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod)))
  ;<  *  bind:m  (do-load activity-agent `!>([%5 %some pre activity ~]))
  ;<  *  bind:m  (ex-equal !>(~(wyt by pre)) !>(count))
  ;<  new=vase  bind:m  get-save
  =/  want-indices  post
  =+  !<(=new-state new)
  =/  new-indices  indices.new-state
  (ex-equal !>(new-indices) !>(want-indices))
::
++  test-fix-init
  =+  state-0:fix-init
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  *  bind:m  (do-init dap activity-agent)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod)))
  =/  start-state  [%6 %some indices pre-fix volumes]
  ;<  caz=(list card:agent:gall)  bind:m  (do-load activity-agent `!>(start-state))
  ;<  *  bind:m  (ex-equal !>(~(wyt by pre-fix)) !>(11))
  =/  cage  noun+!>(%fix-init-unreads)
  ;<  bowl  bind:m  get-bowl
  ;<  *  bind:m
    %+  ex-cards  caz
    ~[(ex-poke /fix-init-unreads [~zod dap] cage)]
  ;<  *  bind:m  (do-poke cage)
  ;<  new=vase  bind:m  get-save
  =+  !<(=new-state new)
  (ex-equal !>(activity.new-state) !>(post-fix))
+$  new-state
  $:  %6
      allowed=notifications-allowed:a
      =indices:a
      =activity:a
      =volume-settings:a
  ==
+$  index-pair  [=source:a =index:a]
+$  dms  (map ship dm:ch)
+$  clubs  (map id:club:ch club:ch)
++  sync-reads
  |%
  +$  source-set
    $:  thrd1=index-pair
        thrd2=index-pair
        chnl=index-pair
        grp=index-pair
        base=index-pair
    ==
  ::  in this case, we test when a child has unreads before any of the parents,
  ::  resulting in a large list of reads and a very early floor
  ++  state-0
    |%
    ++  sources
      ^-  source-set
      =/  =reads:a
        :-  d-1
        %+  gas:on-read-items:a  *read-items:a
        :~  [d1 ~]
            [d2 ~]
            [d3 ~]
            [d4 ~]
            [d5 ~]
        ==
      =/  thrd1  (thread-source-1 flag nest i0)
      =/  thrd2  (thread-source-2 flag nest i0)
      =/  chnl
        %+  merge-children  (channel-source flag nest reads i0)
        ~[stream.index.thrd1 stream.index.thrd2]
      =/  grp
        %+  merge-children  (group-source flag reads.index.chnl)
        ~[stream.index.chnl]
      :*  thrd1
          thrd2
          chnl
          grp
          (merge-children (base-source reads.index.grp) ~[stream.index.grp])
      ==
    ++  pre-sync
      ^-  indices:a
      %-  ~(gas by *indices:a)
      =>  sources
      .(base [base ~])
    ++  post-sync
      ^-  indices:a
      =+  sources
      ::  only care about the index
      %-  my
      :~  thrd1
          thrd2
          chnl(reads.index [d4 ~])
          grp(reads.index [d-1 ~])
          base(reads.index [d-1 ~])
      ==
    ++  activity
      ^-  activity:a
      =+  sources
      =/  chan-sum=activity-summary:a
        :*  newest=d5
            count=0
            notify-count=0
            notify=|
            unread=~
            children=(sy (get-children:src pre-sync source.chnl))
            reads=[d-1 (my [d1 ~] [d2 ~] [d3 ~] [d4 ~] [d5 ~] ~)]
        ==
      %-  my
      :~  :-  source.thrd1
          :*  newest=d5
              count=2
              notify-count=0
              notify=|
              unread=`[[[~dev d0] d0] 2 |]
              children=(sy (get-children:src pre-sync source.thrd1))
              reads=[d-1 ~]
          ==
        ::
          :-  source.thrd2
          :*  newest=d2
              count=0
              notify-count=0
              notify=|
              unread=~
              children=(sy (get-children:src pre-sync source.thrd2))
              reads=[d2 ~]
          ==
        ::
          [source.chnl chan-sum]
        ::
          :-  source.grp
          chan-sum(children (sy (get-children:src pre-sync source.grp)))
        ::
          :-  source.base
          chan-sum(children ~)
      ==
    --
  ::  in this case, we test when a child has unreads later than any of the
  ::  parents, but all other children are read, resulting in a late floor
  ::  and no reads
  ++  state-1
    |%
    ++  sources
      ^-  source-set
      =/  thrd1  (thread-source-2 flag nest i0)
      =/  thrd2  (thread-source-3 flag nest i0)
      =/  =reads:a  [d-1 (my [d1 ~] [d2 ~] [d3 ~] ~)]
      =/  chnl
        %+  merge-children  (channel-source flag nest reads i0)
        ~[stream.index.thrd1 stream.index.thrd2]
      =/  grp
        %+  merge-children  (group-source flag reads.index.chnl)
        ~[stream.index.chnl]
      :*  thrd1
          thrd2
          chnl
          grp
          (merge-children (base-source reads.index.grp) ~[stream.index.grp])
      ==
    ++  pre-sync
      ^-  indices:a
      %-  ~(gas by *indices:a)
      =>  sources
      .(base [base ~])
    ++  post-sync
      ^-  indices:a
      =+  sources
      %-  my
      :~  thrd1
          thrd2
          chnl(reads.index [d3 ~])
          grp(reads.index [d-1 ~])
          base(reads.index [d-1 ~])
      ==
    ++  activity
      ^-  activity:a
      =+  sources
      =/  chan-sum=activity-summary:a
        :*  newest=d5
            count=1
            notify-count=0
            notify=|
            unread=`[[[~dev d4] d4] 1 |]
            children=(sy (get-children:src pre-sync source.chnl))
            reads=[d-1 (my [d1 ~] [d2 ~] [d3 ~] ~)]
        ==
      %-  my
      :~  :-  source.thrd1
          :*  newest=d2
              count=0
              notify-count=0
              notify=|
              unread=~
              children=(sy (get-children:src pre-sync source.thrd1))
              reads=[d-1 ~]
          ==
        ::
          :-  source.thrd2
          :*  newest=d5
              count=1
              notify-count=0
              notify=|
              unread=`[[[~dev d5] d5] 1 |]
              children=(sy (get-children:src pre-sync source.thrd2))
              reads=[d0 ~]
          ==
        ::
          [source.chnl chan-sum]
        ::
          :-  source.grp
          %=  chan-sum
            unread  ~
            children  (sy (get-children:src pre-sync source.grp))
          ==
        ::
          :-  source.base
          %=  chan-sum
            unread  ~
            children  ~
          ==
      ==
    --
  ::  in this case we test a parent having mixed reads with children that
  ::  are all read, resulting in a floor up to the parent reads and one
  ::  read item that comes later
  ++  state-2
    |%
    ++  sources
      ^-  source-set
      =/  thrd1  (thread-source-2 flag nest i0)
      =/  thrd2  (thread-source-3 flag nest i0)
      =.  thrd2  thrd2(reads.index [d5 ~])
      =/  =reads:a  [d3 (my [d5 ~] ~)]
      =/  chnl
        %+  merge-children  (channel-source flag nest reads i0)
        ~[stream.index.thrd1 stream.index.thrd2]
      =/  grp
        %+  merge-children  (group-source flag reads.index.chnl)
        ~[stream.index.chnl]
      :*  thrd1
          thrd2
          chnl
          grp
          (merge-children (base-source reads.index.grp) ~[stream.index.grp])
      ==
    ++  pre-sync
      ^-  indices:a
      %-  ~(gas by *indices:a)
      =>  sources
      .(base [base ~])
    ++  post-sync
      ^-  indices:a
      =+  sources
      %-  my
      :~  thrd1
          thrd2
          chnl(reads.index [d3 ~])
          grp(reads.index [d3 ~])
          base(reads.index [d3 ~])
      ==
    ++  activity
      ^-  activity:a
      =+  sources
      =/  chan-sum=activity-summary:a
        :*  newest=d5
            count=1
            notify-count=0
            notify=|
            unread=`[[[~dev d4] d4] 1 |]
            children=(sy (get-children:src pre-sync source.chnl))
            reads=[d3 (my [d3 ~] [d5 ~] ~)]
        ==
      %-  my
      :~  :-  source.thrd1
          :*  newest=d2
              count=0
              notify-count=0
              notify=|
              unread=~
              children=(sy (get-children:src pre-sync source.thrd1))
              reads=[d2 ~]
          ==
        ::
          :-  source.thrd2
          :*  newest=d5
              count=0
              notify-count=0
              notify=|
              unread=~
              children=(sy (get-children:src pre-sync source.thrd2))
              reads=[d0 ~]
          ==
        ::
          [source.chnl chan-sum]
        ::
          :-  source.grp
          %=  chan-sum
            unread  ~
            children  (sy (get-children:src pre-sync source.grp))
          ==
        ::
          :-  source.base
          %=  chan-sum
            unread  ~
            children  ~
          ==
      ==
    --
  ::  in this case we test multiple parents one with mixed reads and one
  ::  with all reads
  ++  state-3
    |%
    ++  sources
      =/  thrd1-1  (thread-source-1 flag nest i0)
      =/  thrd1-2  (thread-source-2 flag nest i0)
      =/  r1=reads:a
        :-  d-1
        %+  gas:on-read-items:a  *read-items:a
        :~  [d1 ~]
            [d2 ~]
            [d3 ~]
            [d4 ~]
        ==
      =/  chnl1
        %+  merge-children  (channel-source flag nest r1 i0)
        ~[stream.index.thrd1-1 stream.index.thrd1-2]
      =/  grp1
        %+  merge-children  (group-source flag reads.index.chnl1)
        ~[stream.index.chnl1]
      ::
      =/  second-grp=flag:g  [~dev %urbit]
      =/  second-chnl=nest:c  [%chat ~dev %lobby]
      =/  thrd2-1  (thread-source-2 second-grp second-chnl i1)
      =/  thrd2-2  (thread-source-3 second-grp second-chnl i1)
      =/  r2=reads:a  [(add d3 i1) ~]
      =/  chnl2
        %+  merge-children  (channel-source second-grp second-chnl r2 i1)
        ~[stream.index.thrd2-1 stream.index.thrd2-2]
      =/  grp2
        %+  merge-children  (group-source second-grp reads.index.chnl2)
        ~[stream.index.chnl2]
      =/  base
        %+  merge-children
          %-  base-source
          :-  d-1
          %+  gas:on-read-items:a  items.r1
          :~  [(add d1 i1) ~]
              [(add d2 i1) ~]
              [(add d3 i1) ~]
          ==
        ~[stream.index.grp1 stream.index.grp2]
      ::
      :*  thrd1-1=thrd1-1
          thrd1-2=thrd1-2
          thrd2-1=thrd2-1
          thrd2-2=thrd2-2
          chnl1=chnl1
          chnl2=chnl2
          grp1=grp1
          grp2=grp2
          base=base
      ==
    ++  pre-sync
      ^-  indices:a
      %-  ~(gas by *indices:a)
      =>  sources
      .(base [base ~])
    ++  post-sync
      ^-  indices:a
      =+  sources
      %-  my
      :~  thrd1-1
          thrd1-2
          thrd2-1
          thrd2-2
          chnl1(reads.index [d4 ~])
          chnl2
          grp1(reads.index [d-1 ~])
          grp2
          base(reads.index [d-1 ~])
      ==
    ++  activity
      ^-  activity:a
      =+  sources
      =/  chan-sum1=activity-summary:a
        :*  newest=d5
            count=0
            notify-count=0
            notify=|
            unread=~
            children=(sy (get-children:src pre-sync source.chnl1))
            reads=[d-1 (my [d1 ~] [d2 ~] [d3 ~] [d4 ~] ~)]
        ==
      =/  time-chan2  (add d4 i1)
      =/  time2-2  (add d5 i1)
      =/  chan-sum2=activity-summary:a
        :*  newest=time2-2
            count=1
            notify-count=0
            notify=|
            unread=`[[[~dev time-chan2] time-chan2] 1 |]
            children=(sy (get-children:src pre-sync source.chnl2))
            reads=[(add d3 i1) ~]
        ==
      %-  my
      :~  :-  source.thrd1-1
          :*  newest=d5
              count=2
              notify-count=0
              notify=|
              unread=`[[[~dev d0] d0] 2 |]
              children=(sy (get-children:src pre-sync source.thrd1-1))
              reads=[d-1 ~]
          ==
        ::
          :-  source.thrd1-2
          :*  newest=d2
              count=0
              notify-count=0
              notify=|
              unread=~
              children=(sy (get-children:src pre-sync source.thrd1-2))
              reads=[d2 ~]
          ==
        ::
          :-  source.thrd2-1
          :*  newest=(add d2 i1)
              count=0
              notify-count=0
              notify=|
              unread=~
              children=(sy (get-children:src pre-sync source.thrd2-1))
              reads=[(add d2 i1) ~]
          ==
        ::
          :-  source.thrd2-2
          :*  newest=time2-2
              count=1
              notify-count=0
              notify=|
              unread=`[[[~dev time2-2] time2-2] 1 |]
              children=(sy (get-children:src pre-sync source.thrd2-2))
              reads=[(add d0 i1) ~]
          ==
        ::
          [source.chnl1 chan-sum1]
          [source.chnl2 chan-sum2]
        ::
          :-  source.grp1
          %=  chan-sum1
            unread  ~
            children  (sy (get-children:src pre-sync source.grp1))
          ==
        ::
          :-  source.grp2
          %=  chan-sum2
            unread  ~
            children  (sy (get-children:src pre-sync source.grp2))
          ==
        ::
          :-  source.base
          %=  chan-sum2
            unread  ~
            children  ~
          ==
      ==
    --
  --
++  fix-init
  |%
  +$  source-set
    $:  thrd1=index-pair
        thrd2=index-pair
        chnl=index-pair
        bad-chnl-migration=index-pair
        grp=index-pair
        dm-thread=index-pair
        read-dm=index-pair
        unread-dm=index-pair
        dm-invite=index-pair
        bad-dm-migration=index-pair
        base=index-pair
    ==
  ::  we want to test multiple scenarios in one go. we have a dm that's
  ::  completely read, a dm that's unread, and a dm with only an invite.
  ::  we also have a channel with threads that is completely read.
  ++  state-0
    |%
    ++  sources
      ^-  source-set
      =/  thrd1  (thread-source-2 flag nest i0)
      =/  thrd2  (thread-source-3 flag nest i0)
      =.  thrd2  thrd2(reads.index [d5 ~])
      =/  =reads:a  [d4 ~]
      =/  chnl
        %+  merge-children  (channel-source flag nest reads i0)
        ~[stream.index.thrd1 stream.index.thrd2]
      =/  bad-chnl=index-pair
        :-  [%channel [%chat ~syx %hi] flag]
        :_  [[d0 ~] d0]
        %+  gas:on-event:a  *stream:a
        ~[[d1 [[%chan-init [%chat ~syx %hi] flag] | |]]]
      =/  grp
        %+  merge-children  (group-source flag reads)
        ~[stream.index.chnl stream.index.bad-chnl]
      =/  dm-thread  (dm-thread-source [[~dev d0] d0] [%ship ~rus])
      =/  read-dm
        %+  merge-children  (dm-source [%ship ~rus] [d3 ~])
        ~[stream.index.dm-thread]
      =/  unread-dm
        (dm-source [%ship ~dyl] [d0 ~])
      =/  dm-invite=index-pair
        :-  [%dm [%club 0v1d.u717i.b92pp.aa9oh.u044i.joqln]]
        :_  [[d0 ~] d0]
        %+  gas:on-event:a  *stream:a
        ~[[d1 [[%dm-invite [%club 0v1d.u717i.b92pp.aa9oh.u044i.joqln]] & |]]]
      =/  bad-dm-migration=index-pair
        :-  [%dm [%ship ~syx]]
        :_  [[d0 ~] d0]
        %+  gas:on-event:a  *stream:a
        ~[[d1 [[%dm-invite [%ship ~syx]] & |]]]
      :*  thrd1
          thrd2
          chnl
          bad-chnl
          grp
          dm-thread
          read-dm
          unread-dm
          dm-invite
          bad-dm-migration
          %+  merge-children  (base-source [d0 ~])
          :~  stream.index.grp
              stream.index.read-dm
              stream.index.unread-dm
              stream.index.dm-invite
              stream.index.bad-dm-migration
          ==
      ==
    ++  scries
      |=  =path
      ^-  (unit vase)
      ?+  path  ~
        [%gx @ %chat @ %full *]   `!>(chat-scry)
        [%gx @ %channels @ %v2 %channels %full *]   `!>(channels-scry)
      ==
    ++  channels-scry
      ^-  channels:c
      =+  sources
      =|  empty=channel:c
      %-  ~(gas by *channels:c)
      :~  :-  (get-nest source.chnl)
          empty(remark [d5 d4 & ~])
          :-  (get-nest source.bad-chnl-migration)
          empty(remark [d1 d1 & ~])
      ==
    ++  chat-scry
      ^-  [dms clubs]
      =+  sources
      =|  empty-club=club:ch
      =|  empty-dm=dm:ch
      =/  =dms
        %-  ~(gas by *dms)
        :~  :-  (get-ship source.read-dm)
            empty-dm(remark [d4 d3 & ~])
            :-  (get-ship source.unread-dm)
            empty-dm(remark [d3 d0 & ~])
            :-  (get-ship source.bad-dm-migration)
            empty-dm(remark [d1 d1 & ~])
        ==
      =/  =clubs
        %+  ~(put by *clubs)  (get-club source.dm-invite)
        empty-club(remark [d0 d0 & ~])
      [dms clubs]
    ++  get-nest
      |=  =source:a
      ^-  nest:c
      ?>  ?=(%channel -.source)
      nest.source
    ++  get-ship
      |=  =source:a
      ^-  ship
      ?>  ?=(%dm -.source)
      ?>  ?=(%ship -.whom.source)
      p.whom.source
    ++  get-club
      |=  =source:a
      ^-  id:club:ch
      ?>  ?=(%dm -.source)
      ?>  ?=(%club -.whom.source)
      p.whom.source
    ++  volumes
      %+  roll
        ~(tap by indices)
      |=  [[=source:a =index:a] =volume-settings:a]
      %+  ~(put by volume-settings)  source
      default-volumes:a
    ++  indices
      %-  ~(gas by *indices:a)
      =>  sources
      .(base [base ~])
    ++  pre-fix
      ^-  activity:a
      %+  roll
        ~(tap by indices)
      |=  [[=source:a =index:a] =activity:a]
      %+  ~(put by activity)  source
      (~(summarize-unreads urd indices *activity:a volumes fake-log) source index)
    ++  post-fix
      ^-  activity:a
      =+  sources
      %-  ~(uni by pre-fix)
      %-  ~(gas by *activity:a)
      :~  :-  source.bad-chnl-migration
          [d1 0 0 | ~ ~ ~]
          :-  source.chnl
          [d5 0 0 | ~ (sy source.thrd1 source.thrd2 ~) ~]
          :-  source.grp
          [d5 0 0 | ~ (sy source.chnl source.bad-chnl-migration ~) ~]
          :-  source.read-dm
          [d4 0 0 | ~ (sy source.dm-thread ~) ~]
          :-  source.bad-dm-migration
          [d1 0 0 | ~ ~ ~]
          :-  source.base
          [d5 2 1 & ~ ~ ~]
      ==
    --
  --
::  base
++  base-source
  |=  =reads:a
  ^-  index-pair
  :-  [%base ~]
  [*stream:a reads d0]
::  the group has no posts of its own only from children, it is "unread"
++  group-source
  |=  [=flag:g =reads:a]
  ^-  index-pair
  :-  [%group flag]
  [*stream:a reads d0]
::  the channel only has two posts, and it is completely read
++  channel-source
  |=  [=flag:g =nest:c =reads:a interval=@dr]
  ^-  index-pair
  :-  [%channel nest flag]
  :*  %+  gas:on-event:a  *stream:a
      =/  key1  (mod [[~dev d3] d3] interval)
      =/  key2  (mod [[~dev d4] d4] interval)
      :~  [time.key1 [[%post key1 nest flag *story:c |] | |]]
          [time.key2 [[%post key2 nest flag *story:c |] | |]]
      ==
    ::
      reads
    ::
      d0
  ==
++  dm-source
  |=  [=whom:ch =reads:a]
  ^-  index-pair
  :-  [%dm whom]
  :_  [reads d0]
  %+  gas:on-event:a  *stream:a
  :~  [d2 [[%dm-post [[~rus d2] d2] whom *story:c |] | |]]
      [d3 [[%dm-post [[~rus d3] d3] whom *story:c |] | |]]
  ==
::
::  this thread has two messages and is unread
++  thread-source-1
  %^  thread-source
      [[~zod d0] d0]
    [d-1 ~]
  :~  [[~dev d5] d5]
      [[~dev d0] d0]
  ==
::  this thread has two messages and is read
++  thread-source-2
  %^  thread-source
      [[~zod d1] d1]
    [d2 ~]
  :~  [[~dev d1] d1]
      [[~dev d2] d2]
  ==
++  thread-source-3
  %^  thread-source
      [[~zod d0] d0]
    [d0 ~]
  ~[[[~dev d5] d5]]
++  thread-source
  |=  [parent=message-key:a =reads:a replies=(list message-key:a)]
  |=  [=flag:g =nest:c interval=@dr]
  =.  parent  (mod parent interval)
  ^-  index-pair
  :-  [%thread parent nest flag]
  :*  %+  gas:on-event:a  *stream:a
      (turn replies (curr create-reply-pair parent interval))
    ::
      %_  reads
        floor  (add floor.reads interval)
          items
        %+  gas:on-read-items:a  *read-items:a
        %+  turn
          (tap:on-read-items:a items.reads)
        |=  [=time *]
        [(add time interval) ~]
      ==
    ::
      *@da
  ==
++  dm-thread-source
  |=  [parent=message-key:a =whom:ch]
  ^-  index-pair
  :-  [%dm-thread parent whom]
  :_  [[d4 ~] d0]
  %+  gas:on-event:a  *stream:a
  :~  [d4 [[%dm-reply [[~rus d4] d4] parent whom *story:c |] | |]]
      [d1 [[%dm-reply [[~rus d1] d1] parent whom *story:c |] | |]]
  ==
++  create-reply-pair
  |=  [key=message-key:a parent=message-key:a interval=@dr]
  =.  key  (mod key interval)
  [time.key [[%reply key parent nest flag *story:c |] & |]]
++  mod
  |=  [key=message-key:a interval=@dr]
  key(time (add time.key interval), q.id (add q.id.key interval))
++  merge-children
  |=  [index-pair children=(list stream:a)]
  ^-  index-pair
  :-  source
  %=  index
      stream
    %+  roll
      children
    |=  [=stream:a acc=_stream.index]
    (uni:on-event:a acc (child-stream stream))
  ==
++  child-stream
  |=  =stream:a
  (run:on-event:a stream |=(=event:a event(child &)))
++  fake-log
  |=  msg=(trap tape)
  same
  :: (slog leaf+"%activity {(msg)}" ~)
++  i0  *@dr
++  i1  (add i0 ~s1)
++  d-1  (dec *@da)
++  d0  *@da
++  d1  (add *@da ~d1)
++  d2  (add *@da ~d2)
++  d3  (add *@da ~d3)
++  d4  (add *@da ~d4)
++  d5  (add *@da ~d5)
++  flag  [~zod %test]
++  nest  [%chat ~zod %chat]
--
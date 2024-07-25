/-  a=activity, g=groups, c=channels
/+  *activity, *test-agent
/=  activity-agent  /app/activity
|%
++  dap  %activity
++  test-sync-reads-0
  =+  state-0
  (run-sync-reads pre-sync post-sync activity 5)
::
++  test-sync-reads-1
  =+  state-1
  (run-sync-reads pre-sync post-sync activity 5)
::
++  test-sync-reads-2
  =+  state-2
  (run-sync-reads pre-sync post-sync activity 5)
::
++  test-sync-reads-3
  =+  state-3
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
+$  new-state
  $:  %6
      allowed=notifications-allowed:a
      =indices:a
      =activity:a
      =volume-settings:a
  ==
+$  index-pair  [=source:a =index:a]
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
    =/  chnl  (channel-source flag nest reads index.thrd1 index.thrd2 i0)
    =/  grp  (group-source flag index.chnl)
    :*  thrd1
        thrd2
        chnl
        grp
        (base-source index.grp)
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
    =/  chnl  (channel-source flag nest reads index.thrd1 index.thrd2 i0)
    =/  grp  (group-source flag index.chnl)
    :*  thrd1
        thrd2
        chnl
        grp
        (base-source index.grp)
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
    =/  chnl  (channel-source flag nest reads index.thrd1 index.thrd2 i0)
    =/  grp  (group-source flag index.chnl)
    :*  thrd1
        thrd2
        chnl
        grp
        (base-source index.grp)
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
    =/  chnl1  (channel-source flag nest r1 index.thrd1-1 index.thrd1-2 i0)
    =/  grp1  (group-source flag index.chnl1)
    ::
    =/  second-grp=flag:g  [~dev %urbit]
    =/  second-chnl=nest:c  [%chat ~dev %lobby]
    =/  thrd2-1  (thread-source-2 second-grp second-chnl i1)
    =/  thrd2-2  (thread-source-3 second-grp second-chnl i1)
    =/  r2=reads:a  [(add d3 i1) ~]
    =/  chnl2
      (channel-source second-grp second-chnl r2 index.thrd2-1 index.thrd2-2 i1)
    =/  grp2  (group-source second-grp index.chnl2)
    =/  base
      %-  base-source
      :*  (uni:on-event:a stream.index.grp1 stream.index.grp2)
        ::
          :-  d-1
          %+  gas:on-read-items:a  items.r1
          :~  [(add d1 i1) ~]
              [(add d2 i1) ~]
              [(add d3 i1) ~]
          ==
        ::
          *@da
      ==
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
::  base
++  base-source
  |=  group-idx=index:a
  ^-  index-pair
  :-  [%base ~]
  group-idx(stream (child-stream stream.group-idx))
::  the group has no posts of its own only from children, it is "unread"
++  group-source
  |=  [=flag:g channel-idx=index:a]
  ^-  index-pair
  :-  [%group flag]
  channel-idx(stream (child-stream stream.channel-idx))
::  the channel only has two posts, and it is completely read
++  channel-source
  |=  [=flag:g =nest:c =reads:a thrd1=index:a thrd2=index:a interval=@dr]
  ^-  index-pair
  :-  [%channel nest flag]
  :*  %+  uni:on-event:a  (child-stream stream.thrd1)
      %+  gas:on-event:a  (child-stream stream.thrd2)
      =/  key1  (mod [[~dev d3] d3] interval)
      =/  key2  (mod [[~dev d4] d4] interval)
      :~  [time.key1 [[%post key1 nest flag *story:c |] | |]]
          [time.key2 [[%post key2 nest flag *story:c |] | |]]
      ==
    ::
      reads
    ::
      *@da
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
++  create-reply-pair
  |=  [key=message-key:a parent=message-key:a interval=@dr]
  =.  key  (mod key interval)
  [time.key [[%reply key parent nest flag *story:c |] & |]]
++  mod
  |=  [key=message-key:a interval=@dr]
  key(time (add time.key interval), q.id (add q.id.key interval))
++  child-stream
  |=  =stream:a
  (run:on-event:a stream |=(=event:a event(child &)))
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
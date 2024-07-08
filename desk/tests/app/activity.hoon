/-  a=activity, g=groups, c=channels
/+  *test-agent
/=  activity-agent  /app/activity
|%
++  dap  %activity
++  test-sync-reads-0
  (run-sync-reads pre-sync-state-0 post-sync-state-0 5)
::
++  test-sync-reads-1
  (run-sync-reads pre-sync-state-1 post-sync-state-1 5)
::
++  test-sync-reads-2
  (run-sync-reads pre-sync-state-2 post-sync-state-2 5)
::
++  test-sync-reads-3
  (run-sync-reads pre-sync-state-3 post-sync-state-3 9)
++  run-sync-reads
  |=  [pre=indices:a post=indices:a count=@ud]
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (do-init dap activity-agent)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod)))
  ;<  *  bind:m  (do-load activity-agent `!>([%3 %some pre ~ ~]))
  ;<  *  bind:m  (ex-equal !>(~(wyt by pre)) !>(count))
  ;<  new=vase  bind:m  get-save
  =/  want-indices  post
  =+  !<(new-state=current-state new)
  =/  new-indices  indices.new-state
  (ex-equal !>(new-indices) !>(want-indices))
::
+$  current-state
  $:  %3
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
  ^-  source-set
  =/  thrd1  (thread-source-1 flag nest i0)
  =/  thrd2  (thread-source-2 flag nest i0)
  =/  chnl  (channel-source flag nest stream.index.thrd1 stream.index.thrd2 i0)
  =/  grp  (group-source flag stream.index.chnl)
  :*  thrd1
      thrd2
      chnl
      grp
      (base-source stream.index.grp)
  ==
++  pre-sync-state-0
  ^-  indices:a
  %-  ~(gas by *indices:a)
  =>  state-0
  .(base [base ~])
++  post-sync-state-0
  ^-  indices:a
  =+  state-0
  ::  only care about the index
  =/  new-reads=reads:a
    :-  d-1
    %+  gas:on-read-items:a  *read-items:a
    :~  [d1 ~]
        [d2 ~]
        [d3 ~]
        [d4 ~]
    ==
  %-  my
  :~  thrd1
      thrd2
      chnl(reads.index new-reads)
      grp(reads.index new-reads)
      base(reads.index new-reads)
  ==
::  in this case, we test when a child has unreads later than any of the
::  parents, but all other children are read, resulting in a late floor
::  and no reads
++  state-1
  ^-  source-set
  =/  thrd1  (thread-source-2 flag nest i0)
  =/  thrd2  (thread-source-3 flag nest i0)
  =/  chnl  (channel-source flag nest stream.index.thrd1 stream.index.thrd2 i0)
  =/  grp  (group-source flag stream.index.chnl)
  :*  thrd1
      thrd2
      chnl
      grp
      (base-source stream.index.grp)
  ==
++  pre-sync-state-1
  ^-  indices:a
  %-  ~(gas by *indices:a)
  =>  state-1
  .(base [base ~])
++  post-sync-state-1
  ^-  indices:a
  =+  state-1
  %-  my
  :~  thrd1
      thrd2
      chnl(reads.index [d4 ~])
      grp(reads.index [d4 ~])
      base(reads.index [d4 ~])
  ==
::  in this case we test a parent having mixed reads with children that
::  are all read, resulting in a floor up to the parent reads and one
::  read item that comes later
++  state-2
  ^-  source-set
  =/  thrd1  (thread-source-2 flag nest i0)
  =/  thrd2  (thread-source-3 flag nest i0)
  =.  thrd2  thrd2(reads.index [d5 ~])
  =/  chnl  (channel-source flag nest stream.index.thrd1 stream.index.thrd2 i0)
  =.  chnl  chnl(reads.index [d3 ~])
  =/  grp  (group-source flag stream.index.chnl)
  :*  thrd1
      thrd2
      chnl
      grp
      (base-source stream.index.grp)
  ==
++  pre-sync-state-2
  ^-  indices:a
  %-  ~(gas by *indices:a)
  =>  state-2
  .(base [base ~])
++  post-sync-state-2
  ^-  indices:a
  =+  state-2
  =/  new-reads=reads:a  [d3 (my [d5 ~] ~)]
  %-  my
  :~  thrd1
      thrd2
      chnl(reads.index new-reads)
      grp(reads.index new-reads)
      base(reads.index new-reads)
  ==
::  in this case we test multiple parents one with mixed reads and one
::  with all reads
++  state-3
  =/  thrd1-1  (thread-source-1 flag nest i0)
  =/  thrd1-2  (thread-source-2 flag nest i0)
  =/  chnl1  (channel-source flag nest stream.index.thrd1-1 stream.index.thrd1-2 i0)
  =/  grp1  (group-source flag stream.index.chnl1)
  ::
  =/  second-grp=flag:g  [~dev %urbit]
  =/  second-chnl=nest:c  [%chat ~dev %lobby]
  =/  thrd2-1  (thread-source-2 second-grp second-chnl i1)
  =/  thrd2-2  (thread-source-3 second-grp second-chnl i1)
  =/  chnl2
    (channel-source second-grp second-chnl stream.index.thrd2-1 stream.index.thrd2-2 i1)
  =/  grp2  (group-source second-grp stream.index.chnl2)
  ::
  :*  thrd1-1=thrd1-1
      thrd1-2=thrd1-2
      thrd2-1=thrd2-1
      thrd2-2=thrd2-2
      chnl1=chnl1
      chnl2=chnl2
      grp1=grp1
      grp2=grp2
      base=(base-source (uni:on-event:a stream.index.grp1 stream.index.grp2))
  ==
++  pre-sync-state-3
  ^-  indices:a
  %-  ~(gas by *indices:a)
  =>  state-3
  .(base [base ~])
++  post-sync-state-3
  ^-  indices:a
  =+  state-3
  =/  new-reads2=reads:a  [(add d4 i1) ~]
  =/  new-reads1=reads:a
    :-  d-1
    %+  gas:on-read-items:a  *read-items:a
    :~  [d1 ~]
        [d2 ~]
        [d3 ~]
        [d4 ~]
    ==
  =/  base-reads=reads:a
    :-  d-1
    %+  gas:on-read-items:a  items.new-reads1
    :~  [(add d1 i1) ~]
        [(add d2 i1) ~]
        [(add d3 i1) ~]
        [(add d4 i1) ~]
    ==
  %-  my
  :~  thrd1-1
      thrd1-2
      thrd2-1
      thrd2-2
      chnl1(reads.index new-reads1)
      chnl2(reads.index new-reads2)
      grp1(reads.index new-reads1)
      grp2(reads.index new-reads2)
      base(reads.index base-reads)
  ==
::  base
++  base-source
  |=  group-stream=stream:a
  ^-  index-pair
  :-  [%base ~]
  :_  [*@da ~]
  (child-stream group-stream)
::  the group has no posts of its own only from children, it is "unread"
++  group-source
  |=  [=flag:g channel-stream=stream:a]
  ^-  index-pair
  :-  [%group flag]
  :_  [*@da ~]
  (child-stream channel-stream)
::  the channel only has two posts, and it is completely read
++  channel-source
  |=  [=flag:g =nest:c thrd1=stream:a thrd2=stream:a interval=@dr]
  ^-  index-pair
  :-  [%channel nest flag]
  :_  [(add d4 interval) ~]
  %+  uni:on-event:a  (child-stream thrd1)
  %+  gas:on-event:a
    (child-stream thrd2)
  =/  key1  (mod [[~dev d3] d3] interval)
  =/  key2  (mod [[~dev d4] d4] interval)
  :~  [time.key1 [[%post key1 nest flag *story:c |] | |]]
      [time.key2 [[%post key2 nest flag *story:c |] | |]]
  ==
::
::  this thread has two messages and is unread
++  thread-source-1
  %^  thread-source
      [[~zod *@da] *@da]
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
      [[~zod *@da] *@da]
    [*@da ~]
  ~[[[~dev d5] d5]]
++  thread-source
  |=  [parent=message-key:a =reads:a replies=(list message-key:a)]
  |=  [=flag:g =nest:c interval=@dr]
  =.  parent  (mod parent interval)
  ^-  index-pair
  :-  [%thread parent nest flag]
  :_  %=  reads
        floor  (add floor.reads interval)
          items
        %+  gas:on-read-items:a  *read-items:a
        %+  turn
          (tap:on-read-items:a items.reads)
        |=  [=time *]
        [(add time interval) ~]
      ==
  %+  gas:on-event:a  *stream:a
  (turn replies (curr create-reply-pair parent interval))
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
::  summarize: utilities for summarizing groups/chat state in various ways
::
/-  c=channels, cv=channels-ver, ct=chat, chat=chat-2, gv=groups-ver
::
|_  [our=@p now=@da]
::  +range: period of time to summarize over
::  +limit: max amount of msgs to count per channel
::
++  range  ~d7
++  limit  9.999
::
++  scry-path
  |=  [=term =spur]
  [(scot %p our) term (scot %da now) spur]
::
++  summarize-activity
  ?:  .^(? %gu (scry-path %channels /$))
    summarize-activity-new-groups
  summarize-activity-old-groups
::
++  summarize-activity-new-groups
  ^-  $:  sent=@ud
          received=@ud
          most-sent-group=@t
      ==
  =-  :+  s  r
      =/  g=flag:gv
        =<  -
        ::TODO  crashes if no groups
        %+  snag  0
        %+  sort  ~(tap by g)
        |=([[* a=@ud] [* b=@ud]] (gth a b))
      =<  title.meta
      .^  group:v9:gv
        %gx
        (scry-path %groups /v2/groups/(scot %p p.g)/[q.g]/noun)
      ==
  %+  roll
    %~  tap  by
    .^  channels:v8:cv
      %gx
      (scry-path %channels /channels/channels)
    ==
  |=  [[n=nest:c channel:v8:cv] g=(map flag:gv @ud) s=@ud r=@ud]
  ?.  ?=(%chat kind.n)  [g s r]
  =+  .^  paged-posts:v8:cv
        %gx
        %+  scry-path  %channels
        /chat/(scot %p ship.n)/[name.n]/posts/newer/(scot %ud (sub now range))/(scot %ud limit)/outline/channel-posts
      ==
  :-  %+  ~(put by g)  group.perm
      (add (~(gut by g) group.perm 0) (wyt:on-posts:v8:cv posts))
  %+  roll  (tap:on-posts:v8:cv posts)
  |=  [[id-post:c p=(unit post:v8:cv)] s=_s r=_r]
  ?~  p  [s r]
  ?:(=(our author.u.p) [+(s) r] [s +(r)])
::
++  summarize-activity-old-groups
  ^-  $:  sent=@ud
          received=@ud
          most-sent-group=@t
      ==
  =-  :+  s  r
      =/  g=flag:chat
        =<  -
        ::TODO  crashes if no groups
        %+  snag  0
        %+  sort  ~(tap by g)
        |=([[* a=@ud] [* b=@ud]] (gth a b))
      =<  title.meta
      .^  group:v2:gv
        %gx
        (scry-path %groups /groups/(scot %p p.g)/[q.g]/group)
      ==
  %+  roll
    %~  tap  by
    .^  (map flag:chat chat:chat)
      %gx
      (scry-path %chat /chats/chats)
    ==
  =*  onn  ((on time writ:chat) lte)
  |=  [[c=flag:chat chat:chat] g=(map flag:chat @ud) s=@ud r=@ud]
  =+  .^  log=((mop time writ:chat) lte)
        %gx
        %+  scry-path  %chat
        /chat/(scot %p p.c)/[q.c]/writs/newer/(scot %ud (sub now range))/(scot %ud limit)/chat-writs
      ==
  :-  %+  ~(put by g)  group.perm
      (add (~(gut by g) group.perm 0) (wyt:onn log))
  %+  roll  (tap:onn log)
  |=  [[time writ:chat] s=_s r=_r]
  ?:(=(our author) [+(s) r] [s +(r)])
::
++  summarize-inactivity
  ?:  .^(? %gu (scry-path %channels /$))
    summarize-inactivity-new-groups
  summarize-inactivity-old-groups
::
++  summarize-inactivity-new-groups
  ^-  $:  unread-dms=@ud  ::  unread dm count
          unread-etc=@ud  ::  unread chats count
          top-group=@t    ::  most active group
          top-channel=@t  ::  most active channel
      ==
  =+  .^(=unreads:ct %gx (scry-path %chat /unreads/chat-unreads))
  ::  accumulate unread counts
  ::
  =/  dum=@ud
    %-  ~(rep by unreads)
    |=  [[w=whom:ct unread:unreads:ct] n=@ud]
    (add n count)
  :-  dum
  ::  gather all chat channels & their groups & unread counts
  ::
  =/  [duc=@ud faz=(list [g=flag:gv n=nest:c u=@ud])]
    %+  roll
      %~  tap  by
      .^(channels:v8:cv %gx (scry-path %channels /channels/channels))
    =+  .^(=unreads:c %gx (scry-path %channels /unreads/channel-unreads))
    |=  [[n=nest:c channel:v8:cv] duc=@ud faz=(list [flag:gv nest:c @ud])]
    ?.  ?=(%chat kind.n)  [duc faz]  ::  ignore non-chat channels for now
    =/  =unread:c  (~(gut by unreads) n *unread:c)
    :-  (add duc count.unread)
    [[group.perm n count.unread] faz]
  :-  duc
  =.  faz  (sort faz |=([[* * a=@ud] [* * b=@ud]] (gth a b)))
  ::  get display titles of most active channel and its group
  ::
  ::NOTE  in rare cases, we might not know of the existence of the associated
  ::      group. simply skip past it and try the next one...
  =+  .^(=groups:v9:gv %gx (scry-path %groups /v2/groups/noun))
  |-
  ?~  faz  ['???' '???']  ::TODO  better copy
  ~|  i.faz
  ?.  (~(has by groups) g.i.faz)
    $(faz t.faz)
  =/  =group:v9:gv  (~(got by groups) g.i.faz)
  ?~  chat=(~(get by channels.group) n.i.faz)
    $(faz t.faz)
  [title.meta.group title.meta.u.chat]
::
++  summarize-inactivity-old-groups
  ^-  $:  unread-dms=@ud  ::  unread dm count
          unread-etc=@ud  ::  unread chats count
          top-group=@t    ::  most active group
          top-channel=@t  ::  most active channel
      ==
  =+  .^  =briefs:chat
        %gx
        (scry-path %chat /briefs/chat-briefs)
      ==
  ::  accumulate unread counts
  ::
  =/  [dum=@ud duc=@ud]
    %-  ~(rep by briefs)
    |=  [[w=whom:chat brief:briefs:chat] n=@ud m=@ud]
    ?:  ?=(%flag -.w)  [n (add m count)]
    [(add n count) m]
  :+  dum  duc
  ::  gather all chat channels & their groups & unread counts
  ::
  =/  faz=(list [g=flag:chat c=flag:chat n=@ud])
    %+  turn
      %~  tap  by
      .^  (map flag:chat chat:chat)
        %gx
        (scry-path %chat /chats/chats)
      ==
    |=  [c=flag:chat chat:chat]
    :+  group.perm  c
    count:(~(gut by briefs) flag+c *brief:briefs:chat)
  =.  faz  (sort faz |=([[* * a=@ud] [* * b=@ud]] (gth a b)))
  ::  get display titles of most active channel and its group
  ::
  ::NOTE  in rare cases, we might not know of the existence of the associated
  ::      group. simply skip past it and try the next one...
  =+  .^  =groups:v2:gv
        %gx
        (scry-path %groups /groups/noun)
      ==
  |-
  ?~  faz  ['???' '???']  ::TODO  better copy
  ~|  i.faz
  ?.  (~(has by groups) g.i.faz)
    $(faz t.faz)
  =/  =group:v2:gv  (~(got by groups) g.i.faz)
  ?~  chat=(~(get by channels.group) %chat c.i.faz)
    $(faz t.faz)
  [title.meta.group title.meta.u.chat]
--

::  summarize: utilities for summarizing groups/chat state in various ways
::
::REVIEW  v8:old:c might have to be even older, like v1:old:c or w/e
/-  c=channels, ct=chat, chat=chat-2, groups
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
      =/  g=flag:groups
        =<  -
        ::TODO  crashes if no groups
        %+  snag  0
        %+  sort  ~(tap by g)
        |=([[* a=@ud] [* b=@ud]] (gth a b))
      =<  title.meta
      .^  group:groups
        %gx
        (scry-path %groups /groups/(scot %p p.g)/[q.g]/group)
      ==
  %+  roll
    %~  tap  by
    .^  channels:v8:old:c
      %gx
      (scry-path %channels /channels/channels)
    ==
  |=  [[n=nest:c channel:v8:old:c] g=(map flag:groups @ud) s=@ud r=@ud]
  ?.  ?=(%chat kind.n)  [g s r]
  =+  .^  paged-posts:v8:old:c
        %gx
        %+  scry-path  %channels
        /chat/(scot %p ship.n)/[name.n]/posts/newer/(scot %ud (sub now range))/(scot %ud limit)/outline/channel-posts
      ==
  :-  %+  ~(put by g)  group.perm
      (add (~(gut by g) group.perm 0) (wyt:on-posts:v8:old:c posts))
  %+  roll  (tap:on-posts:v8:old:c posts)
  |=  [[id-post:c p=(unit post:v8:old:c)] s=_s r=_r]
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
      .^  group:groups
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
  =/  [duc=@ud faz=(list [g=flag:groups n=nest:c u=@ud])]
    %+  roll
      %~  tap  by
      .^(channels:v8:old:c %gx (scry-path %channels /channels/channels))
    =+  .^(=unreads:c %gx (scry-path %channels /unreads/channel-unreads))
    |=  [[n=nest:c channel:v8:old:c] duc=@ud faz=(list [flag:groups nest:c @ud])]
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
  =+  .^(=groups:groups %gx (scry-path %groups /groups/groups))
  |-
  ?~  faz  ['???' '???']  ::TODO  better copy
  ~|  i.faz
  ?.  (~(has by groups) g.i.faz)
    $(faz t.faz)
  =/  =group:^groups  (~(got by groups) g.i.faz)
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
  =+  .^  =groups:groups
        %gx
        (scry-path %groups /groups/groups)
      ==
  |-
  ?~  faz  ['???' '???']  ::TODO  better copy
  ~|  i.faz
  ?.  (~(has by groups) g.i.faz)
    $(faz t.faz)
  =/  =group:^groups  (~(got by groups) g.i.faz)
  ?~  chat=(~(get by channels.group) %chat c.i.faz)
    $(faz t.faz)
  [title.meta.group title.meta.u.chat]
--
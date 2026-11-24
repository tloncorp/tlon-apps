::  Versioned, bounded native reads for one already-authorized destination.
/-  t=harness-tlon, cv=chat-ver, dv=channels-ver
/+  hp=harness-tlon-history-page, hist=harness-tlon-history,
    paths=harness-tlon-paths
|_  bowl=bowl:gall
+*  read-path  ~(. paths [our now]:bowl)
++  load
  |=  [to=destination:t before=(unit @da) count=@ud]
  ^-  [parent=(unit message:hp) rows=(list row:hp)]
  ?>  &((gth count 0) (lte count 65))
  =/  window=path
    ?~  before  /newest/(scot %ud count)
    /older/(scot %ud u.before)/(scot %ud count)
  ?-  -.to
      %dm
    ?^  parent.to
      =/  post=(may:v7:cv writ:v7:cv)
        .^  (may:v7:cv writ:v7:cv)  %gx
          (dm-post:read-path who.to u.parent.to)
        ==
      ?>  ?=(%& -.post)
      =/  rows
        ?~  before  (top:dm-replies:hist replies:+.post count)
        (bat:dm-replies:hist replies:+.post before count)
      :-  `(dm-post:hp +.post)
      %+  turn  rows
      |=  [at=@da value=(may:v7:cv reply:v7:cv)]
      ^-  row:hp
      [at ?:(?=(%| -.value) ~ `(dm-reply:hp +.value))]
    =/  target=path
      %+  weld
        (dm-writs:read-path who.to)
      (weld window /light/chat-paged-writs-4)
    =/  page=paged-writs:v7:cv  .^(paged-writs:v7:cv %gx target)
    :-  ~
    %+  turn  (tap:on:writs:v7:cv writs.page)
    |=  [at=@da value=(may:v7:cv writ:v7:cv)]
    ^-  row:hp
    [at ?:(?=(%| -.value) ~ `(dm-post:hp +.value))]
      %channel
    ?^  parent.to
      =/  page=paged-posts:v9:dv
        .^  paged-posts:v9:dv  %gx
          %+  weld  (channel-posts:read-path %v4 nest.to)
          /older/(scot %ud +(u.parent.to))/1/outline/channel-posts-4
        ==
      ::  The exclusive upper bound selects the parent at its exact post ID.
      =/  parent  (get:on-posts:v9:dv posts.page u.parent.to)
      ?>  ?=([~ %& *] parent)
      =/  target=path
        %+  weld
          (channel-replies:read-path %v4 nest.to u.parent.to)
        (weld window /channel-replies-4)
      =/  =replies:v9:dv  .^(replies:v9:dv %gx target)
      :-  `(channel-post:hp +.u.parent)
      %+  turn  (tap:on-replies:v9:dv replies)
      |=  [at=@da value=(may:v9:dv reply:v9:dv)]
      ^-  row:hp
      [at ?:(?=(%| -.value) ~ `(channel-reply:hp +.value))]
    =/  target=path
      %+  weld
        (channel-posts:read-path %v4 nest.to)
      (weld window /outline/channel-posts-4)
    =/  page=paged-posts:v9:dv  .^(paged-posts:v9:dv %gx target)
    :-  ~
    %+  turn  (tap:on-posts:v9:dv posts.page)
    |=  [at=@da value=(may:v9:dv post:v9:dv)]
    ^-  row:hp
    [at ?:(?=(%| -.value) ~ `(channel-post:hp +.value))]
  ==
::  Whether a channel message's own author has a bot profile. ~ when local
::  %channels lacks the channel, post, parent or reply: Activity rows outlive
::  a left channel or a deletion, and the exact-message scries crash on a miss.
++  bot-author
  |=  [to=destination:t id=@da]
  ^-  (unit ?)
  ?.  ?=(%channel -.to)  ~
  ?.  .^(? %gu /(scot %p our.bowl)/channels/(scot %da now.bowl)/$)  ~
  ?.  .^(? %gu (channel:read-path %v4 nest.to))  ~
  =/  top=@da  (fall parent.to id)
  =/  page=paged-posts:v9:dv
    .^  paged-posts:v9:dv  %gx
      %+  weld  (channel-posts:read-path %v4 nest.to)
      /older/(scot %ud +(top))/1/outline/channel-posts-4
    ==
  ::  The exclusive upper bound selects the post at its exact ID, if present.
  =/  post  (get:on-posts:v9:dv posts.page top)
  ?~  post  ~
  ?~  parent.to
    =/  =author:v9:dv  ?:(?=(%| -.u.post) author.u.post author:+.+.+.u.post)
    `?=(^ author)
  ::  A deleted parent's replies cannot be read without crashing.
  ?:  ?=(%| -.u.post)  ~
  =/  =replies:v9:dv
    .^  replies:v9:dv  %gx
      %+  weld  (channel-replies:read-path %v4 nest.to u.parent.to)
      /older/(scot %ud +(id))/1/channel-replies-4
    ==
  =/  reply  (get:on-replies:v9:dv replies id)
  ?~  reply  ~
  =/  =author:v9:dv  ?:(?=(%| -.u.reply) author.u.reply author:+.+.+.u.reply)
  `?=(^ author)
--

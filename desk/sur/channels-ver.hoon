/-  c=channels, gv=groups-ver, s=story, m=meta
/+  mp=mop-extensions
|%
::
::  common
::
+$  kind  ?(%diary %heap %chat)
::  $nest: identifier for a channel
+$  nest  [=kind =ship name=term]
+$  id-post  time
+$  id-reply  time
::  $post-toggle: hide or show a particular post by id
+$  post-toggle
  $%  [%hide =id-post]
      [%show =id-post]
  ==
::  $arranged-posts: an array of postIds
+$  arranged-posts  (unit (list id-post))
+$  hidden-posts  (set id-post)
::  $view: the persisted display format for a channel
+$  view  $~(%list ?(%grid %list))
::  $sort: the persisted sort type for a channel
+$  sort  $~(%time ?(%alpha %time %arranged))
+$  client-id  [author=ship sent=time]
+$  plan
  (pair time (unit time))
::
++  rev
  |$  [data]
  [rev=@ud data]
::
++  v9
  =,  v8
  |%
  ::  $v-channels: depends on $v-channel
  +$  v-channels  (map nest v-channel)
  ::  $v-channels: depends on $v-posts
  ++  v-channel
    |^  ,[global local]
    ::  $global: should be identical between ships
    ::
    +$  global
      $:  posts=v-posts
          ::  .count: number of posts, for sequence nr generation
          count=@ud
          order=(rev arranged-posts)
          view=(rev view)
          sort=(rev sort)
          perm=(rev perm)
          meta=(rev (unit @t))
      ==
    ::  $window: sparse set of time ranges
    ::
    ::TODO  populate this
    +$  window  (list [from=time to=time])
    ::  .window: time range for requested posts that we haven't received
    ::  .diffs: diffs for posts in the window, to apply on receipt
    ::
    +$  future
      [=window diffs=(jug id-post u-post)]
    ::  $local: local-only information
    ::
    +$  local
      $:  =net
          =log
          =remark
          =window
          =future
          pending=pending-messages
          =last-updated
      ==
    --
    ::  $v-post: depends on $v-seal
    +$  v-post      [v-seal (rev essay)]
    ::  $v-posts: modified to wrap $v-post in +may
    +$  v-posts     ((mop id-post (may v-post)) lte)
    ::  +on-v-posts: modified to wrap $v-post in +may
    ++  on-v-posts  ((on id-post (may v-post)) lte)
    ::  +mo-v-posts: modified to wrap $v-post in +may
    ++  mo-v-posts  ((mp id-post (may v-post)) lte)
    ::  $v-reply: modified to wrap $memo in +may
    +$  v-reply       [v-reply-seal (rev memo)]
    ::  $v-replies: modified to wrap $v-reply in +may
    +$  v-replies     ((mop id-reply (may v-reply)) lte)
    ::  $on-v-replies: modified to wrap $v-reply in +may
    ++  on-v-replies  ((on id-reply (may v-reply)) lte)
    ::  $mo-v-replies: modified to wrap $v-reply in +may
    ++  mo-v-replies  ((mp id-reply (may v-reply)) lte)
    ::  $v-seal: depends on $v-replies
    +$  v-seal  $+  channel-seal
      $:  id=id-post
          seq=@ud
          mod-at=@da
          replies=v-replies
          reacts=v-reacts
      ==
    ::  $update: depends on $u-channel
    ::
    +$  update   [=time =u-channel]
    ::  $u-channels: depends on $u-channel
    +$  u-channels  [=nest =u-channel]
    ::  $u-channel: depends on $u-post
    +$  u-channel
      $%  [%create =perm meta=(unit @t)]
          [%order (rev order=arranged-posts)]
          [%view (rev =view)]
          [%sort (rev =sort)]
          [%perm (rev =perm)]
          [%meta (rev meta=(unit @t))]
          [%post id=id-post =u-post]
      ==
    ::  $u-post: modified
    ::
    ::  %set: wrap $v-post in may
    ::
    +$  u-post
      $%  [%set post=(may v-post)]
          [%reacts reacts=v-reacts]
          [%essay (rev =essay)]
          [%reply id=id-reply =u-reply]
      ==
    +$  u-reply
      $%  [%set reply=(may v-reply)]  ::TODO  no %essay, inconsistent w/ $u-post
          [%reacts reacts=v-reacts]
      ==
    +$  u-checkpoint  global:v-channel
    ::  $r-channels: depends on $r-channel
    +$  r-channels  [=nest =r-channel]
    +$  r-channel
      $%  [%posts =posts]
          [%post id=id-post =r-post]
          [%pending id=client-id =r-pending]
          [%order order=arranged-posts]
          [%view =view]
          [%sort =sort]
          [%perm =perm]
          [%meta meta=(unit @t)]
          [%create =perm]
          [%join group=flag:gv]
          [%leave ~]
          a-remark
      ==
    ::  $r-post: modified
    ::
    ::  %set: $post wrapped in +may
    +$  r-post
      $%  [%set post=(may post)]
          [%reply id=id-reply =reply-meta =r-reply]
          [%reacts =reacts]
          [%essay =essay]
      ==
    ::  $r-reply: modified
    ::
    ::  %set: $reply wrapped in +may
    +$  r-reply
      $%  [%set reply=(may reply)]
          [%reacts =reacts]
      ==
    ::  $r-channels-simple-post: depends on $r-channel-simple-post
    +$  r-channels-simple-post  [=nest =r-channel-simple-post]
    ::  $r-channel-simple-post: depends on $r-channel
    +$  r-channel-simple-post
      $%  $<(?(%posts %post) r-channel)
          [%posts posts=simple-posts]
          [%post id=id-post r-post=r-simple-post]
      ==
    ::  $r-simple-post: modified
    ::
    ::  %set: $simple-post wrapped in +may
    ::
    +$  r-simple-post
      $%  $<(?(%set %reply) r-post)
          [%set post=(may simple-post)]
          [%reply id=id-reply =reply-meta r-reply=r-simple-reply]
      ==
    ::  $r-simple-reply: modified
    ::
    ::  $set: $simple-reply wrapped in +may
    ::
    +$  r-simple-reply
      $%  $<(%set r-reply)
          [%set reply=(may simple-reply)]
      ==
    ::  $channels: depends on $channel
    +$  channels  (map nest channel)
    ::  $channel: depends on $posts
    ++  channel
      |^  ,[global local]
      +$  global
        $:  =posts
            ::  .count: number of posts, for sequence nr generation
            count=@ud
            order=arranged-posts
            =view
            =sort
            =perm
            meta=(unit @t)
        ==
      ::
      +$  local
        $:  =net
            =remark
            pending=pending-messages
        ==
      --
    +$  channel-heads  (list [=nest recency=time latest=(may post)])
    ::  $paged-posts: depends on $posts
    ::
    +$  paged-posts
      $:  =posts
          newer=(unit time)
          older=(unit time)
          newest=@ud
          total=@ud
      ==
    ::  $paged-simple-posts: depends on $simple-posts
    ::
    +$  paged-simple-posts
      $:  posts=simple-posts
          newer=(unit time)
          older=(unit time)
          newest=@ud
          total=@ud
      ==
    ::  $log: depends on $u-channel
    +$  log     ((mop time u-channel) lte)
    ::  +log-on: depends on $u-channel
    ++  log-on  ((on time u-channel) lte)
    ::  +mo-log: depends on $u-channel
    ++  mo-log  ((mp time u-channel) lte)
    ++  may
      |$  [data]
      ::NOTE  not +each, avoids p= faces for better ergonomics
      $%([%& data] [%| tombstone])
    +$  tombstone
      $:  id=?(id-post id-reply)  ::NOTE  the same type, how convenient!
          =author
          seq=@ud  ::NOTE  0 for replies, but we may need them later™
          del-at=@da
      ==
    ::  $replies: modified to wrap $reply in +may
    +$  replies  ((mop id-reply (may reply)) lte)
    ::  $posts: modified to wrap $post in +may
    +$  posts  ((mop id-post (may post)) lte)
    ::  $simple-posts: modified to wrap $simple-post in +may
    +$  simple-posts  ((mop id-post (may simple-post)) lte)
    ::  $post: depends on $seal
    +$  post   [seal [rev=@ud essay]]
    ::  $simple-seal: depends on $simple-seal
    +$  simple-post  [simple-seal essay]
    ::  $seal: depends on $replies
    +$  seal
      $:  id=id-post
          seq=@ud  ::NOTE  starts at 1, 0 indicates bad migration/broken state
          mod-at=@da
          =reacts
          =replies
          =reply-meta
      ==
    ::  $simple-seal: modified
    ::
    ::  .seq: sequence number
    ::  .mod-at: modified time
    ::
    +$  simple-seal
      $:  id=id-post
          seq=@ud
          mod-at=@da
          =reacts
          replies=simple-replies
          =reply-meta
      ==
    ::  +on-posts: modified no wrap $post in +may
    ++  on-posts    ((on id-post (may post)) lte)
    ::  +on-simple-posts: modified to wrap $simple-post in +may
    ++  on-simple-posts    ((on id-post (may simple-post)) lte)
    ::  +on-replies: modified to wrap $reply in +may
    ++  on-replies  ((on id-reply (may reply)) lte)
    ::  $scam: depends on $scan
    +$  scam
      $:  last=(unit id-post)  ::  last (top-level) message that was searched
          =scan                ::  search results
      ==
    ::  $scan: depends on $reference
    +$  scan  (list reference)
    ::  $reference: modified
    ::
    ::  modified to wrap $post and $simple-reply in +may
    ::
    +$  reference
      $%  [%post post=(may simple-post)]
          [%reply =id-post reply=(may simple-reply)]
      ==
    ::  $said: depends on $reference
    +$  said  (pair nest reference)
  --
++  v8
  |%
  +$  v-channels  (map nest v-channel)
  ++  v-channel
    |^  ,[global local]
    ::  $global: should be identical between ships
    ::
    +$  global
      $:  posts=v-posts
          ::  .count: number of posts, for sequence nr generation
          count=@ud
          order=(rev order=arranged-posts)
          view=(rev =view)
          sort=(rev =sort)
          perm=(rev =perm)
          meta=(rev meta=(unit @t))
      ==
    ::  $window: sparse set of time ranges
    ::
    ::TODO  populate this
    +$  window  (list [from=time to=time])
    ::  .window: time range for requested posts that we haven't received
    ::  .diffs: diffs for posts in the window, to apply on receipt
    ::
    +$  future
      [=window diffs=(jug id-post u-post)]
    ::  $local: local-only information
    ::
    +$  local
      $:  =net
          =log
          =remark
          =window
          =future
          pending=pending-messages
          =last-updated
      ==
    --
  +$  last-updated  ((mop time id-post) lte)
  ++  updated-on   ((on time id-post) lte)
  +$  v-post      [v-seal (rev essay)]
  +$  v-posts     ((mop id-post (unit v-post)) lte)
  ++  on-v-posts  ((on id-post (unit v-post)) lte)
  ++  mo-v-posts  ((mp id-post (unit v-post)) lte)
  +$  v-reply       [v-reply-seal (rev memo)]
  +$  v-replies     ((mop id-reply (unit v-reply)) lte)
  ++  on-v-replies  ((on id-reply (unit v-reply)) lte)
  ++  mo-v-replies  ((mp id-reply (unit v-reply)) lte)
  +$  v-seal
    $:  id=id-post
        seq=@ud
        mod-at=@da
        replies=v-replies
        reacts=v-reacts
    ==
  +$  v-reply-seal
    $:  id=id-reply
        reacts=v-reacts
    ==
  ::
  +$  essay
    $:  memo
        kind=path
        meta=(unit data:m)
        blob=(unit @t)
    ==
  +$  reply-meta
    $:  reply-count=@ud
        last-repliers=(set author)
        last-reply=(unit time)
    ==
  +$  story  story:v1:ver:s
  +$  verse  verse:v1:ver:s
  +$  inline  inline:v1:ver:s
  +$  listing  listing:v1:ver:s
  +$  author  $@(ship bot-meta)
  +$  bot-meta
    $:  =ship
        nickname=(unit @t)
        avatar=(unit @t)
    ==
  +$  memo
    $:  content=story
        =author
        sent=time
    ==
  +$  react
    $@  @t           ::  direct unicode character representation
    $%  [%any p=@t]  ::  any string representation (for backcompat)
    ==
  +$  v-reacts  (map author (rev (unit react)))
  +$  client-id  [author=ship sent=time]
  +$  pending-posts  (map client-id essay)
  +$  pending-replies  (map [top=id-post id=client-id] memo)
  +$  pending-messages
    $:  posts=pending-posts
        replies=pending-replies
    ==
  +$  scam
    $:  last=(unit id-post)  ::  last (top-level) message that was searched
        =scan                ::  search results
    ==
  +$  scan  (list reference)
  +$  reference
    $%  [%post post=simple-post]
        [%reply =id-post reply=simple-reply]
    ==
  +$  said  (pair nest reference)
  +$  net  [p=ship load=_|]
  +$  unreads  (map nest unread)
  +$  unread
    $:  recency=time
        count=@ud
        unread=(unit [id=id-post count=@ud])
        threads=(map id-post [id=id-reply count=@ud])
    ==
  +$  remark  [recency=time last-read=time watching=_| unread-threads=(set id-post)]
  +$  perm
    $:  writers=(set sect:v0:gv)
        group=flag:gv
    ==
  +$  log     ((mop time u-channel) lte)
  ++  log-on  ((on time u-channel) lte)
  ++  mo-log  ((mp time u-channel) lte)
  +$  create-channel
    $:  =kind
        name=term
        group=flag:gv
        title=cord
        description=cord
        meta=(unit @t)
        readers=(set sect:v0:gv)
        writers=(set sect:v0:gv)
    ==
  +$  a-channels
    $%  [%create =create-channel]
        [%pin pins=(list nest)]
        [%channel =nest =a-channel]
        [%toggle-post toggle=post-toggle]
    ==
  +$  a-channel
    $%  [%join group=flag:gv]
        [%leave ~]
        a-remark
        c-channel
    ==
  ::
  +$  a-remark
    $~  [%read ~]
    $%  [%read ~]
        [%read-at =time]
        [%watch ~]
        [%unwatch ~]
    ==
  ::
  +$  a-post  c-post
  +$  a-reply  c-reply
  ::
  +$  c-channels
    $%  [%create =create-channel]
        [%channel =nest =c-channel]
    ==
  +$  c-channel
    $%  [%post =c-post]
        [%view =view]
        [%sort =sort]
        [%meta meta=(unit @t)]
        [%order order=arranged-posts]
        [%add-writers sects=(set sect:v0:gv)]
        [%del-writers sects=(set sect:v0:gv)]
    ==
  ::
  +$  c-post
    $%  [%add =essay]
        [%edit id=id-post =essay]
        [%del id=id-post]
        [%reply id=id-post =c-reply]
        c-react
    ==
  ::
  +$  c-reply
    $%  [%add =memo]
        [%edit id=id-reply =memo]
        [%del id=id-reply]
        c-react
    ==
  ::
  +$  c-react
    $%  [%add-react id=@da p=author q=react]
        [%del-react id=@da p=author]
    ==
  +$  update   [=time =u-channel]
  +$  u-channels  [=nest =u-channel]
  +$  u-channel
    $%  [%create =perm meta=(unit @t)]
        [%order (rev order=arranged-posts)]
        [%view (rev =view)]
        [%sort (rev =sort)]
        [%perm (rev =perm)]
        [%meta (rev meta=(unit @t))]
        [%post id=id-post =u-post]
    ==
  +$  u-post
    $%  [%set post=(unit v-post)]
        [%reacts reacts=v-reacts]
        [%essay (rev =essay)]
        [%reply id=id-reply =u-reply]
    ==
  +$  u-reply
    $%  [%set reply=(unit v-reply)]
        [%reacts reacts=v-reacts]
    ==
  +$  r-channels  [=nest =r-channel]
  +$  r-channel
    $%  [%posts =posts]
        [%post id=id-post =r-post]
        [%pending id=client-id =r-pending]
        [%order order=arranged-posts]
        [%view =view]
        [%sort =sort]
        [%perm =perm]
        [%meta meta=(unit @t)]
        [%create =perm]
        [%join group=flag:gv]
        [%leave ~]
        a-remark
    ==
  +$  r-channels-simple-post  [=nest =r-channel-simple-post]
  +$  r-channel-simple-post
    $%  $<(?(%posts %post) r-channel)
        [%posts posts=simple-posts]
        [%post id=id-post r-post=r-simple-post]
    ==
  +$  r-post
    $%  [%set post=(unit post)]
        [%reply id=id-reply =reply-meta =r-reply]
        [%reacts =reacts]
        [%essay =essay]
    ==
  +$  r-pending
    $%  [%post =essay]
        [%reply top=id-post =reply-meta =memo]
    ==
  +$  r-reply
    $%  [%set reply=(unit reply)]
        [%reacts =reacts]
    ==
  +$  r-simple-post
    $%  $<(?(%set %reply) r-post)
        [%set post=(unit simple-post)]
        [%reply id=id-reply =reply-meta r-reply=r-simple-reply]
    ==
  +$  r-simple-reply
    $%  $<(%set r-reply)
        [%set reply=(unit simple-reply)]
    ==
  +$  channels  (map nest channel)
  ++  channel
    |^  ,[global local]
    +$  global
      $:  =posts
          ::  .count: number of posts, for sequence nr generation
          count=@ud
          order=arranged-posts
          =view
          =sort
          =perm
          meta=(unit @t)
      ==
    ::
    +$  local
      $:  =net
          =remark
          pending=pending-messages
      ==
    --
  +$  channel-heads  (list [=nest recency=time latest=(unit post)])
  +$  paged-posts
    $:  =posts
        newer=(unit time)
        older=(unit time)
        total=@ud
    ==
  +$  paged-simple-posts
    $:  posts=simple-posts
        newer=(unit time)
        older=(unit time)
        total=@ud
    ==
  +$  posts  ((mop id-post (unit post)) lte)
  +$  simple-posts  ((mop id-post (unit simple-post)) lte)
  +$  post  [seal [rev=@ud essay]]
  +$  simple-post  [simple-seal essay]
  +$  seal
    $:  id=id-post
        seq=@ud
        mod-at=@da
        =reacts
        =replies
        =reply-meta
    ==
  +$  simple-seal
    $:  id=id-post
        =reacts
        replies=simple-replies
        =reply-meta
    ==
  +$  reacts  (map author react)
  +$  reply  [reply-seal (rev memo)]
  +$  simple-reply  [reply-seal memo]
  +$  replies     ((mop id-reply (unit reply)) lte)
  +$  simple-replies     ((mop id-reply simple-reply) lte)
  +$  reply-seal  [id=id-reply parent-id=id-post =reacts]
  ++  on-posts    ((on id-post (unit post)) lte)
  ++  on-simple-posts    ((on id-post (unit simple-post)) lte)
  ++  on-replies  ((on id-reply (unit reply)) lte)
  ++  on-simple-replies  ((on id-reply simple-reply) lte)
  --
++  v7
  |%
  +$  v-channels  (map nest v-channel)
  ++  v-channel
    |^  ,[global local]
    +$  global
      $:  posts=v-posts
          order=(rev order=arranged-posts)
          view=(rev =view)
          sort=(rev =sort)
          perm=(rev =perm)
      ==
    +$  local
      $:  =net
          =log
          =remark
          =window
          =future
          pending=pending-messages
          =last-updated
      ==
    +$  future
      [=window diffs=(jug id-post u-post)]
    +$  window  (list [from=time to=time])
    --
  +$  last-updated  ((mop time id-post) lte)
  +$  a-channels
    $%  [%create =create-channel]
        [%pin pins=(list nest)]
        [%channel =nest =a-channel]
        [%toggle-post toggle=post-toggle]
    ==
  +$  create-channel
    $:  =kind
        name=term
        group=flag:gv
        title=cord
        description=cord
        readers=(set sect:gv)
        writers=(set sect:gv)
    ==
  +$  a-channel
    $%  [%join group=flag:gv]
        [%leave ~]
        a-remark
        c-channel
    ==
  ::
  +$  a-remark
    $~  [%read ~]
    $%  [%read ~]
        [%read-at =time]
        [%watch ~]
        [%unwatch ~]
    ==
  +$  v-post      [v-seal (rev essay)]
  +$  v-posts     ((mop id-post (unit v-post)) lte)
  ++  on-v-posts  ((on id-post (unit v-post)) lte)
  ++  mo-v-posts  ((mp id-post (unit v-post)) lte)
  +$  v-seal
    $:  id=id-post
        replies=v-replies
        reacts=v-reacts
    ==
  +$  memo
    $:  content=story
        author=ship
        sent=time
    ==
  +$  essay  [memo =kind-data]
  +$  kind-data
    $%  [%diary title=@t image=@t]
        [%heap title=(unit @t)]
        [%chat kind=$@(~ [%notice ~])]
    ==
  +$  channels  (map nest channel)
  ++  channel
    |^  ,[global local]
    +$  global
      $:  =posts
          order=arranged-posts
          =view
          =sort
          =perm
      ==
    ::
    +$  local
      $:  =net
          =remark
          pending=pending-messages
      ==
    --
  +$  post   [seal (rev essay)]
  +$  seal
    $:  id=id-post
        =reacts
        =replies
        =reply-meta
    ==
  +$  posts   ((mop id-post (unit post)) lte)
  ++  on-posts    ((on id-post (unit post)) lte)
  +$  log     ((mop time u-channel) lte)
  ++  log-on  ((on time u-channel) lte)
  ++  mo-log  ((mp time u-channel) lte)
  +$  paged-posts
    $:  =posts
        newer=(unit time)
        older=(unit time)
        total=@ud
    ==
  +$  channel-heads  (list [=nest recency=time latest=(unit post)])
  +$  u-channel
    $%  [%create =perm]
        [%order (rev order=arranged-posts)]
        [%view (rev =view)]
        [%sort (rev =sort)]
        [%perm (rev =perm)]
        [%post id=id-post =u-post]
    ==
  +$  u-post
    $%  [%set post=(unit v-post)]
        [%reacts reacts=v-reacts]
        [%essay (rev =essay)]
        [%reply id=id-reply =u-reply]
    ==
  +$  r-channels  [=nest =r-channel]
  +$  r-channel
    $%  [%posts =posts]
        [%post id=id-post =r-post]
        [%pending id=client-id =r-pending]
        [%order order=arranged-posts]
        [%view =view]
        [%sort =sort]
        [%perm =perm]
      ::
        [%create =perm]
        [%join group=flag:gv]
        [%leave ~]
        a-remark
    ==
  ::
  +$  r-post
    $%  [%set post=(unit post)]
        [%reply id=id-reply =reply-meta =r-reply]
        [%reacts =reacts]
        [%essay =essay]
    ==
  +$  r-reply
    $%  [%set reply=(unit reply)]
        [%reacts =reacts]
    ==
  ::
  +$  r-pending
    $%  [%post =essay]
        [%reply top=id-post =reply-meta =memo]
    ==
  ::
  +$  r-channels-simple-post  [=nest =r-channel-simple-post]
  +$  r-channel-simple-post
    $%  $<(?(%posts %post) r-channel)
        [%posts posts=simple-posts]
        [%post id=id-post r-post=r-simple-post]
    ==
  ::
  +$  r-simple-post
    $%  $<(?(%set %reply) r-post)
        [%set post=(unit simple-post)]
        [%reply id=id-reply =reply-meta r-reply=r-simple-reply]
    ==
  ::
  +$  r-simple-reply
    $%  $<(%set r-reply)
        [%set reply=(unit simple-reply)]
    ==
  ::
  +$  v-reply       [v-reply-seal (rev memo)]
  ::
  +$  v-reply-seal
    $:  id=id-reply
        reacts=v-reacts
    ==
  +$  c-channels
    $%  [%create =create-channel]
        [%channel =nest =c-channel]
    ==
  +$  c-channel
    $%  [%post =c-post]
        [%view =view]
        [%sort =sort]
        [%order order=arranged-posts]
        [%add-writers sects=(set sect:v0:gv)]
        [%del-writers sects=(set sect:v0:gv)]
    ==
  +$  c-post
    $%  [%add =essay]
        [%edit id=id-post =essay]
        [%del id=id-post]
        [%reply id=id-post =c-reply]
        c-react
    ==
  ::
  +$  c-reply
    $%  [%add =memo]
        [%edit id=id-reply =memo]
        [%del id=id-reply]
        c-react
    ==
  ::
  +$  a-post  c-post
  +$  a-reply  c-reply
  ::
  +$  c-react
    $%  [%add-react id=@da p=ship q=react]
        [%del-react id=@da p=ship]
    ==
  ::
  +$  react  @ta
  +$  v-reacts  (map ship (rev (unit react)))
  +$  reacts  (map ship react)
  ::  $scam: bounded search results
  +$  scam
    $:  last=(unit id-post)  ::  last (top-level) message that was searched
        =scan                ::  search results
    ==
  ::  $scan: search results
  +$  scan  (list reference)
  +$  reference
    $%  [%post post=simple-post]
        [%reply =id-post reply=simple-reply]
    ==
  ::  $said: used for references
  +$  said  (pair nest reference)
  +$  reply       [reply-seal [rev=@ud memo]]
  +$  simple-reply  [reply-seal memo]
  +$  replies     ((mop id-reply (unit reply)) lte)
  +$  simple-replies     ((mop id-reply simple-reply) lte)
  +$  reply-seal  [id=id-reply parent-id=id-post =reacts]
  ++  on-simple-posts    ((on id-post (unit simple-post)) lte)
  ++  on-replies  ((on id-reply (unit reply)) lte)
  +$  v-replies  ((mop id-reply (unit v-reply)) lte)
  ++  on-v-replies  ((on id-reply (unit v-reply)) lte)
  ++  on-simple-replies  ((on id-reply simple-reply) lte)
  +$  simple-post  [simple-seal essay]
  +$  simple-seal
    $:  id=id-post
        =reacts
        replies=simple-replies
        =reply-meta
    ==
  +$  paged-simple-posts
    $:  posts=simple-posts
        newer=(unit time)
        older=(unit time)
        total=@ud
    ==
  +$  u-reply
    $%  [%set reply=(unit v-reply)]
        [%reacts reacts=v-reacts]
    ==
  +$  simple-posts  ((mop id-post (unit simple-post)) lte)
  +$  reply-meta
    $:  reply-count=@ud
        last-repliers=(set ship)
        last-reply=(unit time)
    ==
  +$  pending-posts  (map client-id essay)
  +$  pending-replies  (map [top=id-post id=client-id] memo)
  +$  pending-messages
    $:  posts=pending-posts
        replies=pending-replies
    ==
  +$  channels-0  (map nest channel-0)
  ++  channel-0
    |^  ,[global:channel local]
    +$  local
      $:  =net
          =remark
      ==
    --
  +$  perm
    $:  writers=(set sect:v0:gv)
        group=flag:gv
    ==
  +$  net  [p=ship load=_|]
  +$  remark  [recency=time last-read=time watching=_| unread-threads=(set id-post)]
  +$  unreads  (map nest unread)
  +$  unread
    $:  recency=time
        count=@ud
        unread=(unit [id=id-post count=@ud])
        threads=(map id-post [id=id-reply count=@ud])
    ==
  ++  story  story:v0:ver:s
  ++  verse  verse:v0:ver:s
  ++  inline  inline:v0:ver:s
  ++  listing  listing:v0:ver:s
  --
++  v6
  =,  v7
  |%
  ++  v-channels  (map nest v-channel)
  ++  v-channel
    |^  ,[global:v-channel:v7 local]
    +$  local
      $:  =net:v7
          =log:v-channel:v7
          =remark
          =window:v-channel:v7
          =future:v-channel:v7
          pending=pending-messages:v7
      ==
    --
  --
::
++  v1
  |%
  +$  post  [seal (rev essay)]
  +$  posts  ((mop id-post (unit post)) lte)
  ++  on-posts    ((on id-post (unit post)) lte)
  +$  seal
    $:  id=id-post
        =reacts
        =replies
        =reply-meta
    ==
  +$  react  @ta
  +$  reacts  (map ship react)
  +$  memo
    $:  content=story
        author=ship
        sent=time
    ==
  +$  essay  [memo =kind-data]
  +$  kind-data
    $%  [%diary title=@t image=@t]
        [%heap title=(unit @t)]
        [%chat kind=$@(~ [%notice ~])]
    ==
  +$  replies  ((mop id-reply reply) lte)
  ++  on-replies  ((on id-reply reply) lte)
  +$  reply  [reply-seal [rev=@ud memo]]
  +$  simple-seal
    $:  id=id-post
        =reacts
        replies=simple-replies
        =reply-meta
    ==
  +$  simple-replies  ((mop id-reply simple-reply) lte)
  +$  simple-reply  [reply-seal memo]
  +$  reply-seal  [id=id-reply parent-id=id-post =reacts]
  +$  simple-post  [simple-seal essay]
  +$  simple-posts  ((mop id-post (unit simple-post)) lte)
  ++  on-simple-posts  ((on id-post (unit simple-post)) lte)
  +$  reply-meta
    $:  reply-count=@ud
        last-repliers=(set ship)
        last-reply=(unit time)
    ==
  +$  paged-posts
    $:  =posts
        newer=(unit time)
        older=(unit time)
        total=@ud
    ==
  +$  channels  (map nest channel)
  ++  channel
    |^  ,[global local]
    +$  global
      $:  =posts
          order=arranged-posts
          =view
          =sort
          =perm
      ==
    ::
    +$  local
      $:  =net
          =remark
          pending=pending-messages
      ==
    --
  +$  perm
    $:  writers=(set sect:v0:gv)
        group=flag:gv
    ==
  +$  net  [p=ship load=_|]
  +$  remark  [recency=time last-read=time watching=_| unread-threads=(set id-post)]
  +$  client-id  [author=ship sent=time]
  +$  pending-posts  (map client-id essay)
  +$  pending-replies  (map [top=id-post id=client-id] memo)
  +$  pending-messages
    $:  posts=pending-posts
        replies=pending-replies
    ==
  ++  story  story:v0:ver:s
  ++  verse  verse:v0:ver:s
  ++  inline  inline:v0:ver:s
  ++  listing  listing:v0:ver:s
  --
--

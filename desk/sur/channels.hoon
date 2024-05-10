::  channels: message stream structures
::
::    four shapes that cross client-subscriber-publisher boundaries:
::    - actions    client-to-subscriber change requests (user actions)
::    - commands   subscriber-to-publisher change requests
::    - updates    publisher-to-subscriber change notifications
::    - responses  subscriber-to-client change notifications
::
::        --action-->     --command-->
::    client       subscriber       publisher
::      <--response--     <--update--
::
::    local actions _may_ become responses,
::    remote actions become commands,
::    commands _may_ become updates,
::    updates _may_ become responses.
::
/-  g=groups, c=cite
/+  mp=mop-extensions
|%
+|  %ancients
::
++  mar
  |%
  ++  act  `mark`%channel-action
  ++  cmd  `mark`%channel-command
  ++  upd  `mark`%channel-update
  ++  log  `mark`%channel-logs
  ++  not  `mark`%channel-posts
  --
::
+|  %primitives
::
+$  v-channels  (map nest v-channel)
++  v-channel
  |^  ,[global local]
  ::  $global: should be identical between ships
  ::
  +$  global
    $:  posts=v-posts
        order=(rev order=arranged-posts)
        view=(rev =view)
        sort=(rev =sort)
        perm=(rev =perm)
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
    ==
  --
::  $v-post: a channel post
::
+$  v-post      [v-seal (rev essay)]
+$  id-post     time
+$  v-posts     ((mop id-post (unit v-post)) lte)
++  on-v-posts  ((on id-post (unit v-post)) lte)
++  mo-v-posts  ((mp id-post (unit v-post)) lte)
::  $v-reply: a post comment
::
+$  v-reply       [v-reply-seal (rev memo)]
+$  id-reply      time
+$  v-replies     ((mop id-reply (unit v-reply)) lte)
++  on-v-replies  ((on id-reply (unit v-reply)) lte)
++  mo-v-replies  ((mp time (unit v-reply)) lte)
::  $v-seal: host-side data for a post
::
+$  v-seal  $+  channel-seal
  $:  id=id-post
      replies=v-replies
      reacts=v-reacts
  ==
::  $v-reply-seal: host-side data for a reply
::
+$  v-reply-seal
  $:  id=id-reply
      reacts=v-reacts
  ==
::  $essay: top-level post, with metadata
::
+$  essay  [memo =kind-data]
::  $reply-meta: metadata for all replies
+$  reply-meta
  $:  reply-count=@ud
      last-repliers=(set ship)
      last-reply=(unit time)
  ==
::  $kind-data: metadata for a channel type's "post"
::
+$  kind-data
  $%  [%diary title=@t image=@t]
      [%heap title=(unit @t)]
      [%chat kind=$@(~ [%notice ~])]
  ==
::  $memo: post data proper
::
::    content: the body of the comment
::    author: the ship that wrote the comment
::    sent: the client-side time the comment was made
::
+$  memo
  $:  content=story
      author=ship
      sent=time
  ==
::  $story: post body content
::
+$  story  (list verse)
::  $verse: a chunk of post content
::
::    blocks stand on their own. inlines come in groups and get wrapped
::    into a paragraph
::
+$  verse
  $%  [%block p=block]
      [%inline p=(list inline)]
  ==
::  $listing: recursive type for infinitely nested <ul> or <ol>
+$  listing
  $%  [%list p=?(%ordered %unordered %tasklist) q=(list listing) r=(list inline)]
      [%item p=(list inline)]
  ==
::  $block: post content that sits outside of the normal text
::
::    %image: a visual, we record dimensions for better rendering
::    %cite: an Urbit reference
::    %header: a traditional HTML heading, h1-h6
::    %listing: a traditional HTML list, ul and ol
::    %code: a block of code
::
+$  block  $+  channel-block
  $%  [%image src=cord height=@ud width=@ud alt=cord]
      [%cite =cite:c]
      [%header p=?(%h1 %h2 %h3 %h4 %h5 %h6) q=(list inline)]
      [%listing p=listing]
      [%rule ~]
      [%code code=cord lang=cord]
  ==
::  $inline: post content that flows within a paragraph
::
::    @t: plain text
::    %italics: italic text
::    %bold: bold text
::    %strike: strikethrough text
::    %inline-code: code formatting for small snippets
::    %blockquote: blockquote surrounded content
::    %block: link/reference to blocks
::    %code: code formatting for large snippets
::    %tag: tag gets special signifier
::    %link: link to a URL with a face
::    %break: line break
::
+$  inline  $+  channel-inline
  $@  @t
  $%  [%italics p=(list inline)]
      [%bold p=(list inline)]
      [%strike p=(list inline)]
      [%blockquote p=(list inline)]
      [%inline-code p=cord]
      [%code p=cord]
      [%ship p=ship]
      [%block p=@ud q=cord]
      [%tag p=cord]
      [%link p=cord q=cord]
      [%task p=?(%.y %.n) q=(list inline)]
      [%break ~]
  ==
::
+$  kind  ?(%diary %heap %chat)
::  $nest: identifier for a channel
+$  nest  [=kind =ship name=term]
::  $view: the persisted display format for a channel
+$  view  $~(%list ?(%grid %list))
::  $sort: the persisted sort type for a channel
+$  sort  $~(%time ?(%alpha %time %arranged))
::  $arranged-posts: an array of postIds
+$  arranged-posts  (unit (list time))
::  $hidden-posts: a set of ids for posts that are hidden
+$  hidden-posts  (set id-post)
::  $post-toggle: hide or show a particular post by id
+$  post-toggle
  $%  [%hide =id-post]
      [%show =id-post]
  ==
::  $react: either an emoji identifier like :diff or a URL for custom
+$  react     @ta
+$  v-reacts  (map ship (rev (unit react)))
+$  client-id  [author=ship sent=time]
+$  pending-posts  (map client-id essay)
+$  pending-replies  (map [top=id-post id=client-id] memo)
+$  pending-messages
  $:  posts=pending-posts
      replies=pending-replies
  ==
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
::  $plan: index into channel state
::    p: Post being referred to
::    q: Reply being referred to, if any
::
+$  plan
  (pair time (unit time))
::
::  $net: subscriber-only state
::
+$  net  [p=ship load=_|]
::
::  $unreads: a map of channel unread information, for clients
::  $unread: unread data for a specific channel, for clients
::    recency:   time of most recent message
::    count:     how many posts are unread
::    unread-id: the id of the first unread top-level post
::    threads:   for each unread thread, the id of the first unread reply
::
+$  unreads  (map nest unread)
+$  unread
  $:  recency=time
      count=@ud
      unread=(unit [id=id-post count=@ud])
      threads=(map id-post [id=id-reply count=@ud])
  ==
::  $remark: markers representing unread state
::    recency:        time of most recent message
::    last-read:      time at which the user last read this channel
::    watching:       unused, intended for disabling unread accumulation
::    unread-threads: threads that contain unread messages
::
+$  remark  [recency=time last-read=time watching=_| unread-threads=(set id-post)]
::
::  $perm: represents the permissions for a channel and gives a
::  pointer back to the group it belongs to.
::
+$  perm
  $:  writers=(set sect:g)
      group=flag:g
  ==
::
::  $log: a time ordered history of modifications to a channel
::
+$  log     ((mop time u-channel) lte)
++  log-on  ((on time u-channel) lte)
::
::  $create-channel: represents a request to create a channel
::
::    $create-channel is consumed by the channel agent first and then
::    passed to the groups agent to register the channel with the group.
::
::    Write permission is stored with the specific agent in the channel,
::    read permission is stored with the group's data.
::
+$  create-channel
  $:  =kind
      name=term
      group=flag:g
      title=cord
      description=cord
      readers=(set sect:g)
      writers=(set sect:g)
  ==
::  $outline: abridged $post
::    .replies: number of comments
::
+$  outline
  [replies=@ud replyers=(set ship) essay]
::
++  outlines
  =<  outlines
  |%
  +$  outlines  ((mop time outline) lte)
  ++  on        ((^on time outline) lte)
  --
++  rev
  |$  [data]
  [rev=@ud data]
::
++  apply-rev
  |*  [old=(rev) new=(rev)]
  ^+  [changed=& old]
  ?:  (lth rev.old rev.new)
    &+new
  |+old
::
++  next-rev
  |*  [old=(rev) new=*]
  ^+  [changed=& old]
  ?:  =(+.old new)
    |+old
  &+old(rev +(rev.old), + new)
::
+|  %actions
::
::  some actions happen to be the same as commands, but this can freely
::  change
::
::NOTE  we might want to add a action-id=uuid to this eventually, threading
::      that through all the way, so that an $r-channels may indicate what
::      originally caused it
+$  a-channels
  $%  [%create =create-channel]
      [%pin pins=(list nest)]
      [%channel =nest =a-channel]
      [%toggle-post toggle=post-toggle]
  ==
+$  a-channel
  $%  [%join group=flag:g]
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
+|  %commands
::
+$  c-channels
  $%  [%create =create-channel]
      [%channel =nest =c-channel]
  ==
+$  c-channel
  $%  [%post =c-post]
      [%view =view]
      [%sort =sort]
      [%order order=arranged-posts]
      [%add-writers sects=(set sect:g)]
      [%del-writers sects=(set sect:g)]
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
  $%  [%add-react id=@da p=ship q=react]
      [%del-react id=@da p=ship]
  ==
::
+|  %updates
::
+$  update   [=time =u-channel]
+$  u-channels  [=nest =u-channel]
+$  u-channel
  $%  [%create =perm]
      [%order (rev order=arranged-posts)]
      [%view (rev =view)]
      [%sort (rev =sort)]
      [%perm (rev =perm)]
      [%post id=id-post =u-post]
  ==
::
+$  u-post
  $%  [%set post=(unit v-post)]
      [%reacts reacts=v-reacts]
      [%essay (rev =essay)]
      [%reply id=id-reply =u-reply]
  ==
::
+$  u-reply
  $%  [%set reply=(unit v-reply)]
      [%reacts reacts=v-reacts]
  ==
::
+$  u-checkpoint  global:v-channel
::
+|  %responses
::
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
      [%join group=flag:g]
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
::
+$  r-pending
  $%  [%post =essay]
      [%reply top=id-post =reply-meta =memo]
  ==
+$  r-reply
  $%  [%set reply=(unit reply)]
      [%reacts =reacts]
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
::  versions of backend types with their revision numbers stripped,
::  because the frontend shouldn't care to learn those.
::
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
+$  channels-0  (map nest channel-0)
++  channel-0
  |^  ,[global:channel local]
  +$  local
    $:  =net
        =remark
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
+$  post   [seal [rev=@ud essay]]
+$  simple-post  [simple-seal essay]
+$  seal
  $:  id=id-post
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
+$  reacts      (map ship react)
+$  reply       [reply-seal [rev=@ud memo]]
+$  simple-reply  [reply-seal memo]
+$  replies     ((mop id-reply reply) lte)
+$  simple-replies     ((mop id-reply simple-reply) lte)
+$  reply-seal  [id=id-reply parent-id=id-post =reacts]
++  on-posts    ((on id-post (unit post)) lte)
++  on-simple-posts    ((on id-post (unit simple-post)) lte)
++  on-replies  ((on id-reply reply) lte)
++  on-simple-replies  ((on id-reply simple-reply) lte)
--

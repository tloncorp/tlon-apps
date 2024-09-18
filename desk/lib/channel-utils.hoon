/-  c=channels, g=groups
::  convert a post to a preview for a "said" response
::
|%
::  +uv-* functions convert posts, replies, and reacts into their "unversioned"
::  forms, suitable for responses to our subscribers.
::  +s-* functions convert those posts and replies into their "simple" forms,
::  suitable for responses to subscribers that use an older version of the api,
::  or just don't care about details like edit status.
::  +suv-* functions do both, sequentially.
::
++  uv-channels-1
  |=  =v-channels:c
  ^-  channels-0:c
  %-  ~(run by v-channels)
  |=  channel=v-channel:c
  ^-  channel-0:c
  %*  .  *channel-0:c
    posts  *posts:c
    perm   +.perm.channel
    view   +.view.channel
    sort   +.sort.channel
    order  +.order.channel
  ==
::
++  uv-channels-2
  |=  [=v-channels:c full=?]
  ^-  channels:v1:old:c
  %-  ~(run by v-channels)
  |=  channel=v-channel:c
  ^-  channel:v1:old:c
  =/  base
    %*  .  *channel:v1:old:c
      perm   +.perm.channel
      view   +.view.channel
      sort   +.sort.channel
      order  +.order.channel
      pending  pending.channel
    ==
  ?.  full  base
  %_  base
    posts  (uv-posts posts.channel)
    net  net.channel
    remark  remark.channel
  ==
::
++  uv-channels-3
  |=  [=v-channels:c full=?]
  ^-  channels:c
  %-  ~(run by v-channels)
  |=  channel=v-channel:c
  ^-  channel:c
  =/  base
    %*  .  *channel:c
      perm     +.perm.channel
      view     +.view.channel
      sort     +.sort.channel
      order    +.order.channel
      pending  pending.channel
    ==
  ?.  full  base
  %_  base
    posts   (uv-posts-2 posts.channel)
    net     net.channel
    remark  remark.channel
  ==
::
++  uv-posts
  |=  =v-posts:c
  ^-  posts:v1:old:c
  %+  gas:on-posts:v1:old:c  *posts:v1:old:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(unit v-post:c)]
  ^-  [id-post:c (unit post:v1:old:c)]
  [id-post ?~(v-post ~ `(uv-post u.v-post))]
::
++  uv-posts-2
  |=  =v-posts:c
  ^-  posts:c
  %+  gas:on-posts:c  *posts:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(unit v-post:c)]
  ^-  [id-post:c (unit post:c)]
  [id-post ?~(v-post ~ `(uv-post-2 u.v-post))]
::
++  s-posts
  |=  =posts:c
  ^-  simple-posts:c
  %+  gas:on-simple-posts:c  *simple-posts:c
  %+  turn  (tap:on-posts:c posts)
  |=  [=id-post:c post=(unit post:c)]
  ^-  [id-post:c (unit simple-post:c)]
  [id-post ?~(post ~ `(s-post u.post))]
::
++  suv-posts
  |=  =v-posts:c
  ^-  simple-posts:v1:old:c
  %+  gas:on-simple-posts:v1:old:c  *simple-posts:v1:old:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(unit v-post:c)]
  ^-  [id-post:c (unit simple-post:v1:old:c)]
  [id-post (bind v-post suv-post)]
::
++  uv-post
  |=  =v-post:c
  ^-  post:v1:old:c
  :_  +.v-post
  :*  id.v-post
      (uv-reacts reacts.v-post)
      (uv-replies id.v-post replies.v-post)
      (get-reply-meta v-post)
  ==
::
++  uv-post-2
  |=  =v-post:c
  ^-  post:c
  :_  +.v-post
  :*  id.v-post
      (uv-reacts reacts.v-post)
      (uv-replies-2 id.v-post replies.v-post)
      (get-reply-meta v-post)
  ==
::
++  s-post
  |=  =post:c
  ^-  simple-post:c
  :_  +>.post
  -.post(replies (s-replies replies.post))
::
++  suv-post
  |=  =v-post:c
  ^-  simple-post:c
  (s-post (uv-post-2 v-post))
::
++  uv-posts-without-replies
  |=  =v-posts:c
  ^-  posts:v1:old:c
  %+  gas:on-posts:v1:old:c  *posts:v1:old:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(unit v-post:c)]
  ^-  [id-post:c (unit post:v1:old:c)]
  [id-post ?~(v-post ~ `(uv-post-without-replies u.v-post))]
::
++  uv-posts-without-replies-2
  |=  =v-posts:c
  ^-  posts:c
  %+  gas:on-posts:c  *posts:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(unit v-post:c)]
  ^-  [id-post:c (unit post:c)]
  [id-post ?~(v-post ~ `(uv-post-without-replies-2 u.v-post))]
::
++  suv-posts-without-replies
  |=  =v-posts:c
  ^-  simple-posts:v1:old:c
  %+  gas:on-simple-posts:v1:old:c  *simple-posts:v1:old:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(unit v-post:c)]
  ^-  [id-post:c (unit simple-post:v1:old:c)]
  [id-post ?~(v-post ~ `(suv-post-without-replies u.v-post))]
::
++  suv-posts-without-replies-2
  |=  =v-posts:c
  ^-  simple-posts:c
  %+  gas:on-simple-posts:c  *simple-posts:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(unit v-post:c)]
  ^-  [id-post:c (unit simple-post:c)]
  [id-post (bind v-post suv-post-without-replies)]
::
++  uv-post-without-replies
  |=  post=v-post:c
  ^-  post:v1:old:c
  :_  +.post
  :*  id.post
      (uv-reacts reacts.post)
      *replies:v1:old:c
      (get-reply-meta post)
  ==
::
++  uv-post-without-replies-2
  |=  post=v-post:c
  ^-  post:c
  :_  +.post
  :*  id.post
      (uv-reacts reacts.post)
      *replies:c
      (get-reply-meta post)
  ==
::
++  suv-post-without-replies
  |=  post=v-post:c
  ^-  simple-post:c
  (s-post (uv-post-without-replies-2 post))
::
++  uv-replies
  |=  [parent-id=id-post:c =v-replies:c]
  ^-  replies:v1:old:c
  %+  gas:on-replies:v1:old:c  *replies:v1:old:c
  %+  murn  (tap:on-v-replies:c v-replies)
  |=  [=time v-reply=(unit v-reply:c)]
  ^-  (unit [id-reply:c reply:v1:old:c])
  ?~  v-reply  ~
  `[time (uv-reply parent-id u.v-reply)]
::
++  uv-replies-2
  |=  [parent-id=id-post:c =v-replies:c]
  ^-  replies:c
  %+  gas:on-replies:c  *replies:c
  %+  murn  (tap:on-v-replies:c v-replies)
  |=  [=time v-reply=(unit v-reply:c)]
  ^-  (unit [id-reply:c (unit reply:c)])
  ?~  v-reply  `[time ~]
  `[time `(uv-reply parent-id u.v-reply)]
::
++  s-replies
  |=  =replies:c
  ^-  simple-replies:c
  %+  gas:on-simple-replies:c  *simple-replies:c
  %+  murn  (tap:on-replies:c replies)
  |=  [=time reply=(unit reply:c)]
  ^-  (unit [id-reply:c simple-reply:c])
  ?~  reply  ~
  (some [time (s-reply u.reply)])
::
++  suv-replies
  |=  [parent-id=id-post:c =v-replies:c]
  ^-  simple-replies:c
  (s-replies (uv-replies-2 parent-id v-replies))
::
++  uv-reply
  |=  [parent-id=id-reply:c =v-reply:c]
  ^-  reply:c
  :_  +.v-reply
  [id.v-reply parent-id (uv-reacts reacts.v-reply)]
::
++  s-reply
  |=  =reply:c
  ^-  simple-reply:c
  [-.reply +>.reply]
::
++  suv-reply
  |=  [parent-id=id-reply:c =v-reply:c]
  ^-  simple-reply:c
  (s-reply (uv-reply parent-id v-reply))
::
++  uv-reacts
  |=  =v-reacts:c
  ^-  reacts:c
  %-  ~(gas by *reacts:c)
  %+  murn  ~(tap by v-reacts)
  |=  [=ship (rev:c react=(unit react:c))]
  ?~  react  ~
  (some ship u.react)
::
++  said
  |=  [=nest:c =plan:c posts=v-posts:c]
  ^-  cage
  =/  post=(unit (unit v-post:c))  (get:on-v-posts:c posts p.plan)
  ?~  q.plan
    =/  post=simple-post:c
      ?~  post
        ::TODO  give "outline" that formally declares deletion
        :-  *simple-seal:c
        ?-  kind.nest
          %diary  [*memo:c %diary 'Unknown post' '']
          %heap   [*memo:c %heap ~ 'Unknown link']
          %chat   [[[%inline 'Unknown message' ~]~ ~nul *@da] %chat ~]
        ==
      ?~  u.post
        :-  *simple-seal:c
        ?-  kind.nest
            %diary  [*memo:c %diary 'This post was deleted' '']
            %heap   [*memo:c %heap ~ 'This link was deleted']
            %chat
          [[[%inline 'This message was deleted' ~]~ ~nul *@da] %chat ~]
        ==
      (suv-post-without-replies u.u.post)
    [%channel-said !>(`said:c`[nest %post post])]
  ::
  =/  reply=[reply-seal:c memo:c]
    ?~  post
      [*reply-seal:c ~[%inline 'Comment on unknown post']~ ~nul *@da]
    ?~  u.post
      [*reply-seal:c ~[%inline 'Comment on deleted post']~ ~nul *@da]
    =/  reply=(unit (unit v-reply:c))  (get:on-v-replies:c replies.u.u.post u.q.plan)
    ?~  reply
      [*reply-seal:c ~[%inline 'Unknown comment']~ ~nul *@da]
    ?~  u.reply
      [*reply-seal:c ~[%inline 'This comment was deleted']~ ~nul *@da]
    (suv-reply p.plan u.u.reply)
  [%channel-said !>(`said:c`[nest %reply p.plan reply])]
::
++  was-mentioned
  |=  [=story:c who=ship]
  ^-  ?
  %+  lien  story
  |=  =verse:c
  ?:  ?=(%block -.verse)  |
  %+  lien  p.verse
  (cury test [%ship who])
::
++  flatten
  |=  content=(list verse:c)
  ^-  cord
  %+  rap   3
  %+  turn  content
  |=  v=verse:c
  ^-  cord
  ?-  -.v
      %block  ''
      %inline
    %+  rap  3
    %+  turn  p.v
    |=  c=inline:c
    ^-  cord
    ?@  c  c
    ?-  -.c
        %break                 ''
        %tag                   p.c
        %link                  q.c
        %block                 q.c
        ?(%code %inline-code)  ''
        %ship                  (scot %p p.c)
        %task                  (flatten [%inline q.c]~)
        ?(%italics %bold %strike %blockquote)
      (flatten [%inline p.c]~)
    ==
  ==
::
++  trace
  |=  post=v-post:c
  ^-  outline:c
  =;  replyers=(set ship)
    [~(wyt by replies.post) replyers +>.post]
  =-  (~(gas in *(set ship)) (scag 3 ~(tap in -)))
  %-  ~(gas in *(set ship))
  %+  murn  (tap:on-v-replies:c replies.post)
  |=  [@ reply=(unit v-reply:c)]
  ?~  reply  ~
  (some author.u.reply)
::
++  get-reply-meta
  |=  post=v-post:c
  ^-  reply-meta:c
  :*  (get-non-null-reply-count replies.post)
      (get-last-repliers post ~)
      (biff (ram:on-v-replies:c replies.post) |=([=time *] `time))
  ==
::
++  get-non-null-reply-count
  |=  replies=v-replies:c
  ^-  @ud
  =/  entries=(list [time (unit v-reply:c)])  (bap:on-v-replies:c replies)
  =/  count  0
  |-  ^-  @ud
  ?:  =(~ entries)
    count
  =/  [* reply=(unit v-reply:c)]  -.entries
  ?~  reply  $(entries +.entries)
  $(entries +.entries, count +(count))
::
++  get-last-repliers
  |=  [post=v-post:c pending=(unit ship)]  ::TODO  could just take =v-replies
  ^-  (set ship)
  =/  replyers=(set ship)  ?~(pending ~ (sy u.pending ~))
  =/  entries=(list [time (unit v-reply:c)])  (bap:on-v-replies:c replies.post)
  |-
  ?:  |(=(~ entries) =(3 ~(wyt in replyers)))
    replyers
  =/  [* reply=(unit v-reply:c)]  -.entries
  ?~  reply  $(entries +.entries)
  ?:  (~(has in replyers) author.u.reply)
    $(entries +.entries)
  =.  replyers  (~(put in replyers) author.u.reply)
  $(entries +.entries)
++  perms
  |_  [our=@p now=@da =nest:c group=flag:g]
  ++  am-host  =(our ship.nest)
  ++  groups-scry
    ^-  path
    :-  (scot %p our)
    /groups/(scot %da now)/groups/(scot %p p.group)/[q.group]
  ::
  ++  is-admin
    |=  her=ship
    ?:  =(ship.nest her)  &
    .^  admin=?
    ;:  weld
        /gx
        groups-scry
        /fleet/(scot %p her)/is-bloc/loob
    ==  ==
  ::
  ++  can-write
    |=  [her=ship writers=(set sect:g)]
    ?:  =(ship.nest her)  &
    =/  =path
      %+  welp  groups-scry
      :+  %channel  kind.nest
      /(scot %p ship.nest)/[name.nest]/can-write/(scot %p her)/noun
    =+  .^(write=(unit [bloc=? sects=(set sect:g)]) %gx path)
    ?~  write  |
    =/  perms  (need write)
    ?:  |(bloc.perms =(~ writers))  &
    !=(~ (~(int in writers) sects.perms))
  ::
  ++  can-read
    |=  her=ship
    ?:  =(our her)  &
    =/  =path
      %+  welp  groups-scry
      /can-read/noun
    =/  test=$-([ship nest:g] ?)
      =>  [path=path nest=nest:g ..zuse]  ~+
      .^($-([ship nest] ?) %gx path)
    (test her nest)
  --
::
++  flatten-inline
  |=  i=inline:c
  ^-  cord
  ?@  i  i
  ?-  -.i
    ?(%italics %bold %strike %blockquote)  (rap 3 (turn p.i flatten-inline))
    ?(%inline-code %code %tag)  p.i
    %ship   (scot %p p.i)
    %block  q.i
    %link   q.i
    %task   (rap 3 (turn q.i flatten-inline))
    %break  '\0a'
  ==
::
++  first-inline
  |=  content=story:c
  ^-  (list inline:c)
  ?~  content  ~
  ?:  ?=(%inline -.i.content)
    p.i.content
  ?+  -.p.i.content  $(content t.content)
    %header   q.p.i.content  ::REVIEW  questionable
  ::
      %listing
    |-
    ?-  -.p.p.i.content
      %list  ::TODO  or check listing first?
              ?.  =(~ r.p.p.i.content)
                r.p.p.i.content
              ?~  q.p.p.i.content  ~
              =/  r  $(p.p.i.content i.q.p.p.i.content)
              ?.  =(~ r)  r
              $(q.p.p.i.content t.q.p.p.i.content)
      %item  p.p.p.i.content
    ==
  ==
::
++  en-manx  ::NOTE  more commonly, marl, but that's just (list manx)
  |%
  ++  content  story
  ++  story
    |=  content=story:c
    ^-  marl
    (zing (turn content verse))
  ::
  ++  verse
    |=  =verse:c
    ^-  marl
    ?-  -.verse
      %block  (block p.verse)
    ::
        %inline
      ;+
      ?:  ?=([[%break ~] ~] p.verse)
        ;br;
      ;p
        ;*  (turn p.verse inline)
      ==
    ==
  ::
  ++  block
    |=  =block:c
    ^-  marl
    ?-  -.block
        %image
      ;+
      =/  src=tape  (trip src.block)
      ;div.image
        ;a/"{src}"(target "_blank", rel "noreferrer")
          ;img@"{src}"
            =height  "{(a-co:co height.block)}"
            =width   "{(a-co:co width.block)}"
            =alt     "{?:(=('' alt.block) "image" (trip alt.block))}";
        ==
      ==
    ::
        %cite
      ;+
      ;div.cite
        ; [reference xx]  ::TODO  link to /expose if chan ref?
      ==
    ::
        %header
      ;+
      ?-  p.block
        %h1  ;h1  ;*  (turn q.block inline)  ==
        %h2  ;h2  ;*  (turn q.block inline)  ==
        %h3  ;h3  ;*  (turn q.block inline)  ==
        %h4  ;h4  ;*  (turn q.block inline)  ==
        %h5  ;h5  ;*  (turn q.block inline)  ==
        %h6  ;h6  ;*  (turn q.block inline)  ==
      ==
    ::
        %listing
      ?-  -.p.block
          %item
        |-  ^-  marl
        ?:  ?=([[%break ~] ~] p.p.block)
          ~  ::  filter out trailing newlines
        ?~  p.p.block  ~
        :-  (inline i.p.p.block)
        $(p.p.block t.p.p.block)
      ::
          %list
        %+  weld
          `marl`(turn r.p.block inline)
        ^-  marl
        ;+
        ?-  p.p.block
            %ordered
          ;ol
            ;*  %+  turn  q.p.block
                |=  l=listing:c
                ;li
                  ;*  (^block %listing l)
                ==
          ==
        ::
            %unordered
          ;ul
            ;*  %+  turn  q.p.block
                |=  l=listing:c
                ;li
                  ;*  (^block %listing l)
                ==
          ==
        ::
            %tasklist
          ;ul.tasklist
            ;*  %+  turn  q.p.block
                |=  l=listing:c
                ;li
                  ;*  (^block %listing l)
                ==
          ==
        ==
      ==
    ::
        %rule
      ;+  ;hr;
    ::
        %code
      ;+
      ;pre
        ;code:"{(trip code.block)}"
      ==
    ==
  ::
  ++  inline
    |=  =inline:c
    ^-  manx
    ?@  inline
      ;span:"{(trip inline)}"
    ?-  -.inline
        %italics
      ;em
        ;*  (turn p.inline ^inline)
      ==
    ::
        %bold
      ;strong
        ;*  (turn p.inline ^inline)
      ==
    ::
        %strike
      ;s
        ;*  (turn p.inline ^inline)
      ==
    ::
        %blockquote
      ;blockquote
        ;*  (turn p.inline ^inline)
      ==
    ::
        %inline-code
      ;code.inline-code:"{(trip p.inline)}"
    ::
        %code
      ;pre.code
        ;code:"{(trip p.inline)}"
      ==
    ::
        %ship
      ;span.ship:"{(scow %p p.inline)}"
    ::
        %block
      ;span.block:"[block xx]"
    ::
        %tag
      ;span.tag:"[tag xx]"
    ::
        %link
      ::TODO  prefix // if no protocol in url
      =/  url=tape  (trip p.inline)
      ;a/"{url}"
        =target  "_blank"
        =rel     "noreferrer"
        ; "{?:(=('' q.inline) url (trip q.inline))}"
      ==
    ::
        %task
      ;div.task
        ;+  ?.  p.inline  ;input(type "checkbox", disabled "");
            ;input(type "checkbox", checked "", disabled "");
        ;*  (turn q.inline ^inline)
      ==
    ::
        %break
      ;br;
    ==
  --
--

/-  c=chat, d=channels, s=story, meta
/+  mp=mop-extensions, cv=chat-conv, chv=channel-conv, cu=channel-utils
|_  pac=pact:c
++  mope  ((mp time (may:c writ:c)) lte)
++  gas
  |=  ls=(list [=time writ=(may:c writ:c)])
  ^+  pac
  %_    pac
      wit  (gas:on:writs:c wit.pac ls)
  ::
      dex
    %-  ~(gas by dex.pac)
    %+  turn  ls
    |=  [=time writ=(may:c writ:c)]
    ^-  [id:c _time]
    [?:(?=(%| -.writ) id.writ id.writ) time]
  ==
::
++  unread
  |=  [our=ship recency=time last-read=time unread-threads=(set id:c)]
  ^-  unread:unreads:c
  :-  recency
  =/  unreads=(list [time (may:c writ:c)])
    %+  skim
      %-  bap:on:writs:c
      (lot:on:writs:c wit.pac `last-read ~)
    |=  [=time writ=(may:c writ:c)]
    =/  author  ?:(?=(%| -.writ) author.writ author.writ)
    !=(author our)
  =/  count  (lent unreads)
  =/  unread=(unit [message-key:c @ud])
    ::TODO  in the ~ case, we could traverse further up, to better handle
    ::      cases where the most recent message was deleted.
    ?~  unreads  ~
    =/  item=(may:c writ:c)  +:(rear unreads)
    =/  =message-key:v6:c
      ?:(?=(%| -.item) [id time]:item [id time]:item)
    (some message-key count)
  ::  now do the same for all unread threads
  ::
  =/  [sum=@ud threads=(map message-key:c [message-key:c @ud])]
    %+  roll  ~(tap in unread-threads)
    |=  [=id:c sum=@ud threads=(map message-key:c [message-key:c @ud])]
    =/  parent   (get id)
    ?~  parent   [sum threads]
    ?:  ?=(%| -.writ.u.parent)  [sum threads]
    =*  writ  +.writ.u.parent
    =/  unreads=(list [time (may:c reply:c)])
      %+  skim
        %-  bap:on:replies:c
        (lot:on:replies:c replies.writ `last-read ~)
      |=  [* reply=(may:c reply:c)]
      =/  author  ?:(?=(%| -.reply) author.reply author.reply)
      !=(author our)
    =/  count=@ud  (lent unreads)
    :-  (add sum count)
    ?~  unreads  threads
    %+  ~(put by threads)  [id time]:writ
    =/  item=(may:c reply:c)  +:(rear unreads)
    =/  =message-key:v6:c
      ?:(?=(%| -.item) [id time]:item [id time]:item)
    [message-key count]
  [(add count sum) unread threads]
::
++  get
  |=  =id:c
  ^-  (unit [=time writ=(may:c writ:c)])
  ?~  tim=(~(get by dex.pac) id)
    ~
  ?~  wit=(get:on:writs:c wit.pac u.tim)
    ~
  `[u.tim u.wit]
::
++  jab
  |=  [=id:c fun=$-((may:c writ:c) [pact:c (may:c writ:c)])]
  ^+  pac
  ?~  v=(get id)  pac
  =/  [=pact:c writ=(may:c writ:c)]  (fun writ.u.v)
  =.  wit.pact  (put:on:writs:c wit.pact time.u.v writ)
  pact
::
++  got
  |=  =id:c
  ^-  [=time writ=(may:c writ:c)]
  (need (get id))
::
++  reduce
  |=  [now=time =id:c del=delta:writs:c]
  ^+  pac
  ::  if the post pre-exists we can add it directly,
  ::  %add is handled specially below.
  ::
  =?  upd.pac  &(!?=(%add -.del) (~(has by dex.pac) id))
    (put:updated-on:c upd.pac now (~(got by dex.pac) id))
  ?-  -.del
      %add
    ?:  (~(has by dex.pac) id)
      pac
    =.  num.pac  +(num.pac)
    =+  og-now=now
    |-
    ::TODO  consider: og-now for the time.seal,
    ::      but only if we never use it as a lookup/key!
    =/  =seal:c  [id num.pac now ~ ~ [0 ~ ~]]
    ?:  (has:on:writs:c wit.pac now)
      $(now `@da`(add now ^~((div ~s1 (bex 16)))))
    %_  pac
      wit  (put:on:writs:c wit.pac now %& seal essay.del)
      dex  (~(put by dex.pac) id now)
      upd  (put:updated-on:c upd.pac og-now now)
    ==
  ::
      %del
    =/  tim=(unit time)  (~(get by dex.pac) id)
    ?~  tim  pac
    ?~  writ=(get:on:writs:c wit.pac u.tim)
      pac
    ?:  ?=(%| -.u.writ)
      pac
    =/  =tombstone:c
      :*  id
          seq.u.writ
          u.tim
          author.u.writ
          now
      ==
    pac(wit (put:on:writs:c wit.pac u.tim %| tombstone))
  ::
      %reply
    %+  jab  id
    |=  writ=(may:c writ:c)
    ?:  ?=(%| -.writ)  [pac writ]
    =/  [=pact:c =replies:c]  (reduce-reply replies.writ now id [id delta]:del)
    :-  pact
    %=    writ
      replies  replies
      ::
        reply-count.reply-meta
      (wyt:on:replies:c replies)
      ::
        last-reply.reply-meta
      (biff (ram:on:replies:c replies) |=([=time *] `time))
    ::
        last-repliers.reply-meta
      ^-  (set author:c)
      =|  repliers=(set author:c)
      =/  entries=(list [time (may:c reply:c)])  (bap:on:replies:c replies)
      |-
      ?:  |(=(~ entries) =(3 ~(wyt in repliers)))
        repliers
      =/  [* reply=(may:c reply:c)]  -.entries
      ?:  ?=(%| -.reply)  $(entries +.entries)
      ?:  (~(has in repliers) author.reply)
        $(entries +.entries)
      (~(put in repliers) author.reply)
    ==
  ::
      %add-react
    %+  jab  id
    |=  writ=(may:c writ:c)
    ?:  ?=(%| -.writ)  [pac writ]
    :-  pac
    writ(reacts (~(put by reacts.writ) [author react]:del))
  ::
      %del-react
    %+  jab  id
    |=  writ=(may:c writ:c)
    ?:  ?=(%| -.writ)  [pac writ]
    :-  pac
    writ(reacts (~(del by reacts.writ) author.del))
  ==
::
++  reduce-reply
  |=  [=replies:c now=time parent-id=id:c =id:c delta=delta:replies:c]
  ^-  [pact:c replies:c]
  ?-  -.delta
      %add
    |-
    ?:  (has:on:replies:c replies now)
      $(now `@da`(add now ^~((div ~s1 (bex 16)))))
    =/  reply-seal  [id parent-id now ~]
    ?:  (~(has by dex.pac) id)  [pac replies]
    =.  dex.pac  (~(put by dex.pac) id now)
    [pac (put:on:replies:c replies now %& reply-seal memo.delta)]
  ::
      %del
    =/  tim=(unit time)  (~(get by dex.pac) id)
    ?~  tim  [pac replies]
    ?~  reply=(get:on:replies:c replies u.tim)
      [pac replies]
    ?:  ?=(%| -.u.reply)
      [pac replies]
    =/  =tombstone:c
      :*  id
          0  :: replies don't have seq
          u.tim
          author.u.reply
          now
      ==
    :-  pac
    (put:on:replies:c replies u.tim %| tombstone)
  ::
      %add-react
    :-  pac
    %^  jab-reply  id  replies
    |=  reply=(may:c reply:c)
    ?:  ?=(%| -.reply)  reply
    reply(reacts (~(put by reacts.reply) [author react]:delta))
  ::
      %del-react
    :-  pac
    %^  jab-reply  id  replies
    |=  reply=(may:c reply:c)
    ?:  ?=(%| -.reply)  reply
    reply(reacts (~(del by reacts.reply) author.delta))
  ==
::
++  get-reply
  |=  [=id:c =replies:c]
  ^-  (unit [=time reply=(may:c reply:c)])
  ?~  tim=(~(get by dex.pac) id)        ~
  ?~  qup=(get:on:replies:c replies u.tim)  ~
  `[u.tim u.qup]
++  jab-reply
  |=  [=id:c =replies:c fun=$-((may:c reply:c) (may:c reply:c))]
  ^+  replies
  ?~  v=(get-reply id replies)  replies
  (put:on:replies:c replies time.u.v (fun reply.u.v))
++  give-paged-writs
  |=  [mode=?(%light %heavy) ver=?(%v0 %v1 %v2 %v3) ls=(list [time (may:c writ:c)])]
  ^-  (unit (unit cage))
  =;  p=paged-writs:c
    =/  v4  (v4:paged-writs:v6:cv p)
    ?-  ver
      %v0  ``chat-paged-writs+!>((v3:paged-writs:v4:cv v4))
      %v1  ``chat-paged-writs-1+!>(v4)
      %v2  ``chat-paged-writs-2+!>((v5:paged-writs:v6:cv p))
      %v3  ``chat-paged-writs-3+!>(p)
    ==
  =/  =writs:c
    %+  gas:on:writs:c  *writs:c
    ?:  =(%heavy mode)  ls
    %+  turn  ls
    |=  [=time writ=(may:c writ:c)]
    :-  time
    ?:  ?=(%| -.writ)  writ
    writ(replies *replies:c)
  =/  newer=(unit time)
    ?:  =(~ ls)  ~
    =/  more  (tab:on:writs:c wit.pac `-:(rear ls) 1)
    ?~(more ~ `key:(head more))
  =/  older=(unit time)
    ?:  =(~ ls)  ~
    =/  more  (bat:mope wit.pac `-:(head ls) 1)
    ?~(more ~ `key:(head more))
  :*  writs
      newer
      older
      (wyt:on:writs:c writs)
  ==
::
++  get-around
  |=  [mode=?(%light %heavy) ver=?(%v0 %v1 %v2 %v3) =time count=@ud]
  ^-  (unit (unit cage))
  =/  older  (bat:mope wit.pac `time count)
  =/  newer  (tab:on:writs:c wit.pac `time count)
  =/  writ   (get:on:writs:c wit.pac time)
  =/  writs
    ?~  writ
      (welp older newer)
    (welp (snoc older [time u.writ]) newer)
  (give-paged-writs mode ver writs)
::
++  changes
  |=  since=@da
  ^-  (unit writs:c)
  ?:  (gte since key:(fall (ram:updated-on:c upd.pac) [key=since ~]))
    ~
  %-  some
  ?~  wit.pac  ~
  =/  updated  (tap:updated-on:c (lot:updated-on:c upd.pac `since ~))
  ::NOTE  slightly faster than +put-ing continuously
  =-  (gas:on:writs:c ~ -)
  %+  roll  updated
  |=  [[@da changed=time] out=(list [id=time (may:c writ:c)])]
  ?~  writ=(get:on:writs:c wit.pac changed)
    out
  [[changed u.writ] out]
::
++  peek
  |=  [care=@tas ver=?(%v0 %v1 %v2 %v3) =(pole knot)]
  ^-  (unit (unit cage))
  =*  on   on:writs:c
  ?+    pole  [~ ~]
  ::
      [%newest count=@ mode=?(%light %heavy) ~]
    =/  count  (slav %ud count.pole)
    =/  writs  (top:mope wit.pac count)
    (give-paged-writs mode.pole ver writs)
  ::
      [%older start=@ count=@ mode=?(%light %heavy) ~]
    =/  count  (slav %ud count.pole)
    =/  start  (slav %ud start.pole)
    =/  writs  (bat:mope wit.pac `start count)
    (give-paged-writs mode.pole ver writs)
  ::
      [%newer start=@ count=@ mode=?(%light %heavy) ~]
    =/  count  (slav %ud count.pole)
    =/  start  (slav %ud start.pole)
    =/  writs  (tab:on wit.pac `start count)
    (give-paged-writs mode.pole ver writs)
  ::
      [%around time=@ count=@ mode=?(%light %heavy) ~]
    =/  time    (slav %ud time.pole)
    =/  count   (slav %ud count.pole)
    (get-around mode.pole ver time count)
  ::
      [%around ship=@ time=@ count=@ mode=?(%light %heavy) ~]
    =/  ship    (slav %p ship.pole)
    =/  time    (slav %ud time.pole)
    =/  count   (slav %ud count.pole)
    =/  entry   (get ship `@da`time)
    ?~  entry  ``chat-paged-writs+!>(*paged-writs:c)
    (get-around mode.pole ver time.u.entry count)
  ::
      [%range start=@ end=@ mode=?(%light %heavy) ~]
    ::TODO  support @da format in path for id (or timestamp) ranges?
    =/  start=@ud
      ?:  =(%$ start.pole)  1
      (slav %ud start.pole)
    =/  end=@ud
      ?:  =(%$ end.pole)  num.pac
      (slav %ud end.pole)
    %^    give-paged-writs
        mode.pole
      ver
    ::  queries near end more common, so we make a newest-first list,
    ::  and walk it "backwards" until we extract our desired range
    ::
    =/  wits=(list [time p=(may:c writ:c)])
      (bap:on:writs:c wit.pac)
    |-
    ?~  wits  ~
    =/  seq=@ud
      ?:  ?=(%| -.p.i.wits)  seq.p.i.wits
      seq.p.i.wits
    ?:  (gth seq end)
      $(wits t.wits)
    ?:  (lth seq start)
      ~  ::  done
    :-  i.wits
    $(wits t.wits)
  ::
      [%writ %id ship=@ time=@ ~]
    =/  ship  (slav %p ship.pole)
    =/  time  (slav %ud time.pole)
    ?.  ?=(%u care)
      =/  writ=(may:c writ:c)  writ:(got ship `@da`time)
      ?:  ?=(%v3 ver)  ``chat-writ-3+!>(writ)
      ?:  ?=(%| -.writ)  [~ ~]
      ?-  ver
          %v0  ``writ+!>((v3:writ:v5:cv (v5:writ:v6:cv +.writ)))
          %v1  ``chat-writ-1+!>((v4:writ:v5:cv (v5:writ:v6:cv +.writ)))
          %v2  ``chat-writ-2+!>((v5:writ:v6:cv +.writ))
      ==
    ``loob+!>(?~((get ship `@da`time) | &))
  ==
::
++  search
  |^  |%
      ::NOTE  largely considered deprecated in favor of +tries-bound,
      ::      which (when used sanely) delivers better performance and ux.
      ++  hits-bound  ::  searches until len results
        |%
        ++  mention
          |=  [sip=@ud len=@ud nedl=^ship]
          ^-  scan:c
          (scour-count sip len %mention nedl)
        ::
        ++  text
          |=  [sip=@ud len=@ud nedl=@t]
          ^-  scan:c
          (scour-count sip len %text nedl)
        --
      ::
      ++  tries-bound  ::  searches until sum messages searched
        |%
        ++  mention
          |=  [fro=(unit time) sum=@ud nedl=ship]
          ^-  [(unit time) scan:c]
          (scour-tries fro sum %mention nedl)
        ::
        ++  text
          |=  [fro=(unit time) sum=@ud nedl=@t]
          ^-  [(unit time) scan:c]
          (scour-tries fro sum %text nedl)
        --
      --
  ::
  +$  match-type
    $%  [%mention nedl=ship]
        [%text nedl=@t]
    ==
  ::
  ++  scour-tries
    |=  [from=(unit time) tries=@ud =match-type]
    =*  posts  wit.pac
    =.  posts  (lot:on:writs:c posts ~ from)  ::  verified correct
    =|  s=[tries=_tries last=(unit time) =scan:c]
    =<  [last scan]
    |-  ^+  s
    ?~  posts  s
    ?:  =(0 tries.s)  s
    =.  s  $(posts r.posts)  ::  process latest first
    ?:  =(0 tries.s)  s
    ::
    =.  scan.s
      ?:  ?=(%| -.val.n.posts)  scan.s
      ?.  (match +.val.n.posts match-type)  scan.s
      [[%writ val.n.posts] scan.s]
    ::
    =.  scan.s
      ?:  ?=(%| -.val.n.posts)  scan.s
      =*  id-post  id.val.n.posts
      =*  replies  replies.val.n.posts
      |-  ^+  scan.s
      ?~  replies  scan.s
      =.  scan.s  $(replies r.replies)
      ::
      =.  scan.s
        ?:  ?=(%| -.val.n.replies)  scan.s
        ?.  (match-reply +.val.n.replies match-type)  scan.s
        [[%reply id-post val.n.replies] scan.s]
      ::
      $(replies l.replies)
    ::
    =.  last.s  `key.n.posts
    =.  tries.s  (dec tries.s)
    $(posts l.posts)
  ::
  ++  scour-count
    |=  [sip=@ud len=@ud =match-type]
    ?>  (gth len 0)
    ^-  scan:c
    =+  s=[sip=sip len=len *=scan:c]
    =-  (flop scan)
    |-  ^+  s
    ?~  wit.pac  s
    ?:  =(0 len.s)  s
    =.  s  $(wit.pac r.wit.pac)
    ?:  =(0 len.s)  s
    ::
    =.  s
      ?:  ?=(%| -.val.n.wit.pac)  s
      ?.  (match +.val.n.wit.pac match-type)  s
      ?:  (gth sip.s 0)
        s(sip (dec sip.s))
      s(len (dec len.s), scan [[%writ val.n.wit.pac] scan.s])
    ::
    =.  s
      ?:  ?=(%| -.val.n.wit.pac)  s
      (scour-replies s id.val.n.wit.pac replies.val.n.wit.pac match-type)
    ::
    $(wit.pac l.wit.pac)
  ::
  ++  scour-replies
    |=  [s=[skip=@ud len=@ud =scan:c] =id:c =replies:c =match-type]
    |-  ^+  s
    ?~  replies  s
    ?:  =(0 len.s)  s
    =.  s  $(replies r.replies)
    ?:  =(0 len.s)  s
    ::
    =.  s
      ?:  ?=(%| -.val.n.replies)  s
      ?.  (match-reply +.val.n.replies match-type)  s
      ?:  (gth skip.s 0)
        s(skip (dec skip.s))
      s(len (dec len.s), scan [[%reply id val.n.replies] scan.s])
    ::
    $(replies l.replies)
  ::
  ++  match
    |=  [=writ:c =match-type]
    ^-  ?
    ?-  -.match-type
      %mention  (match-writ-mention nedl.match-type writ)
      %text     (match-writ-text nedl.match-type writ)
    ==
  ::
  ++  match-reply
    |=  [=reply:c =match-type]
    ?-  -.match-type
      %mention  (match-story-mention nedl.match-type content.reply)
      %text     (match-story-text nedl.match-type content.reply)
    ==
  ::
  ++  match-writ-mention
    |=  [nedl=ship =writ:c]
    ^-  ?
    ?:  ?=([%chat %notice ~] kind.writ)  |
    (match-story-mention nedl content.writ)
  ::
  ++  match-story-mention
    |=  [nedl=ship =story:s]
    %+  lien  story
    |=  =verse:s
    ?.  ?=(%inline -.verse)  |
    %+  lien  p.verse
    |=  =inline:s
    ?+  -.inline  |
      %ship                                  =(nedl p.inline)
      ?(%bold %italics %strike %blockquote)  ^$(p.verse p.inline)
    ==
  ::
  ++  match-writ-text
    |=  [nedl=@t =writ:c]
    ?:  ?=([%chat %notice ~] kind.writ)  |
    (match-story-text nedl content.writ)
  ::
  ++  match-story-text
    |=  [nedl=@t =story:s]
    %+  lien  story
    |=  =verse:s
    ?.  ?=(%inline -.verse)  |
    %+  lien  p.verse
    |=  =inline:s
    ?@  inline
      (find nedl inline |)
    ?+  -.inline  |
      ?(%bold %italics %strike %blockquote)  ^$(p.verse p.inline)
      ?(%code %inline-code)                  $(inline p.inline)
      ::
          %link
        ?|  $(inline p.inline)
        ?&  !=(p.inline q.inline)
            $(inline q.inline)
        ==  ==
    ==
  ::
  ++  find
    |=  [nedl=@t hay=@t case=?]
    ^-  ?
    =/  nlen  (met 3 nedl)
    =/  hlen  (met 3 hay)
    ?:  (lth hlen nlen)
      |
    =?  nedl  !case
      (cass nedl)
    =/  pos  0
    =/  lim  (sub hlen nlen)
    |-
    ?:  (gth pos lim)
      |
    ?:  .=  nedl
        ?:  case
          (cut 3 [pos nlen] hay)
        (cass (cut 3 [pos nlen] hay))
      &
    $(pos +(pos))
  ::
  ++  cass
    |=  text=@t
    ^-  @t
    %^    run
        3
      text
    |=  dat=@
    ^-  @
    ?.  &((gth dat 64) (lth dat 91))
      dat
    (add dat 32)
  --
--

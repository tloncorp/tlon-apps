/-  c=chat, d=channels, s=story, meta
/-  old-4=chat-4, old-3=chat-3
/+  mp=mop-extensions, cu=channel-utils
|_  pac=pact:c
++  mope  ((mp time writ:c) lte)
++  gas
  |=  ls=(list [=time =writ:c])
  ^+  pac
  %_    pac
      wit  (gas:on:writs:c wit.pac ls)
  ::
      dex
    %-  ~(gas by dex.pac)
    %+  turn  ls
    |=  [=time =writ:c]
    ^-  [id:c _time]
    [id.writ time]
  ==
::
++  unread
  |=  [our=ship recency=time last-read=time unread-threads=(set id:c)]
  ^-  unread:unreads:c
  :-  recency
  =/  unreads
    %+  skim
      %-  bap:on:writs:c
      (lot:on:writs:c wit.pac `last-read ~)
    |=([=time =writ:c] !=(author.writ our))
  =/  count  (lent unreads)
  =/  unread=(unit [message-key:c @ud])
    ::TODO  in the ~ case, we could traverse further up, to better handle
    ::      cases where the most recent message was deleted.
    ?~  unreads  ~
    (some [id time]:val:(rear unreads) count)
  ::  now do the same for all unread threads
  ::
  =/  [sum=@ud threads=(map message-key:c [message-key:c @ud])]
    %+  roll  ~(tap in unread-threads)
    |=  [=id:c sum=@ud threads=(map message-key:c [message-key:c @ud])]
    =/  parent   (get id)
    ?~  parent   [sum threads]
    =/  unreads
      %+  skim
        %-  bap:on:replies:c
        (lot:on:replies:c replies.writ.u.parent `last-read ~)
      |=([* =reply:c] !=(author.reply our))
    =/  count=@ud  (lent unreads)
    :-  (add sum count)
    ?~  unreads  threads
    %+  ~(put by threads)  [id time]:writ.u.parent
    [[id time]:val:(rear unreads) count]
  [(add count sum) unread threads]
::
++  get
  |=  =id:c
  ^-  (unit [=time =writ:c])
  ?~  tim=(~(get by dex.pac) id)
    ~
  ?~  wit=(get:on:writs:c wit.pac u.tim)
    ~
  `[u.tim u.wit]
::
++  jab
  |=  [=id:c fun=$-(writ:c [pact:c writ:c])]
  ^+  pac
  ?~  v=(get id)  pac
  =/  [=pact:c =writ:c]  (fun writ.u.v)
  =.  wit.pact  (put:on:writs:c wit.pact time.u.v writ)
  pact
::
++  got
  |=  =id:c
  ^-  [=time =writ:c]
  (need (get id))
::
++  reduce
  |=  [now=time =id:c del=delta:writs:c]
  ^+  pac
  ?-  -.del
      %add
    ?:  (~(has by dex.pac) id)
      pac
    =.  num.pac  +(num.pac)
    |-
    =/  =seal:c  [id num.pac now ~ ~ [0 ~ ~]]
    ?:  (has:on:writs:c wit.pac now)
      $(now `@da`(add now ^~((div ~s1 (bex 16)))))
    =.  wit.pac
      (put:on:writs:c wit.pac now seal essay.del)
    pac(dex (~(put by dex.pac) id now))
  ::
      %del
    =/  tim=(unit time)  (~(get by dex.pac) id)
    ?~  tim  pac
    =/  =time  (need tim)
    =^  wit=(unit writ:c)  wit.pac
      (del:on:writs:c wit.pac time)
    pac(dex (~(del by dex.pac) id))
  ::
      %reply
    %+  jab  id
    |=  =writ:c
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
      =/  entries=(list [time reply:c])  (bap:on:replies:c replies)
      |-
      ?:  |(=(~ entries) =(3 ~(wyt in repliers)))
        repliers
      =/  [* =reply:c]  -.entries
      ?:  (~(has in repliers) author.reply)
        $(entries +.entries)
      (~(put in repliers) author.reply)
    ==
  ::
      %add-react
    %+  jab  id
    |=  =writ:c
    :-  pac
    writ(reacts (~(put by reacts.writ) [author react]:del))
  ::
      %del-react
    %+  jab  id
    |=  =writ:c
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
    [pac (put:on:replies:c replies now reply-seal memo.delta)]
  ::
      %del
    =/  tim=(unit time)  (~(get by dex.pac) id)
    ?~  tim  [pac replies]
    =/  =time  (need tim)
    =^  reply=(unit reply:c)  replies
      (del:on:replies:c replies time)
    =.  dex.pac  (~(del by dex.pac) id)
    [pac replies]
  ::
      %add-react
    :-  pac
    %^  jab-reply  id  replies
    |=  =reply:c
    reply(reacts (~(put by reacts.reply) [author react]:delta))
  ::
      %del-react
    :-  pac
    %^  jab-reply  id  replies
    |=  =reply:c
    reply(reacts (~(del by reacts.reply) author.delta))
  ==
::
++  get-reply
  |=  [=id:c =replies:c]
  ^-  (unit [=time =reply:c])
  ?~  tim=(~(get by dex.pac) id)        ~
  ?~  qup=(get:on:replies:c replies u.tim)  ~
  `[u.tim u.qup]
++  jab-reply
  |=  [=id:c =replies:c fun=$-(reply:c reply:c)]
  ^+  replies
  ?~  v=(get-reply id replies)  replies
  (put:on:replies:c replies time.u.v (fun reply.u.v))
++  old-reply-3
  |=  =reply:c
  ^-  reply:old-3
  %=  reply
    reacts  (reacts-1:cu reacts.reply)
    ::  memo
    +  (memo-1:cu +.reply)
  ==
++  old-writ-3
  |=  =writ:c
  ^-  writ:old-3
  :_  =-  ?>(?=([%chat kind:old-3] kind-data.-) -)
      (essay-1:cu +.writ)
  :*  id.writ
      time.writ
      (reacts-1:cu reacts.writ)
      (run:on:replies:c replies.writ old-reply-3)
      (reply-meta-1:cu reply-meta.writ)
  ==
++  old-action-club-3
  |=  =action:club:c
  ^-  action:club:old-3
  =*  delta  q.q.action
  ?:  ?=(%writ -.delta)
    action(diff.q.q (old-diff-writs-3 diff.delta))
  action
++  old-diff-writs-3
  |=  =diff:writs:c
  ^-  diff:writs:old-3
  =*  delta  q.diff
  %=  diff  q
    ?-  -.delta
    ::
        %add
      :*  %add
          (memo-1:cu -.essay.delta)
          ?:(=(/chat-notice kind.essay.delta) [%notice ~] ~)
          time.delta
      ==
    ::
      %del  delta
    ::
        %reply
      %=  delta
        meta  (bind meta.delta reply-meta-1:cu)
        delta  (old-delta-replies-3 delta.delta)
      ==
    ::
        %add-react
      %=  delta
        author  (get-author-ship:cu author.delta)
        react   (need (react-1:cu react.delta))
      ==
    ::
        %del-react
      delta(author (get-author-ship:cu author.delta))
    ==
  ==
::
++  old-response-delta-replies-3
  |=  =response-delta:replies:c
  ^-  response-delta:replies:old-3
  ?-    -.response-delta
    %add  response-delta(memo (memo-1:cu memo.response-delta))
  ::
    %del  [%del ~]
  ::
      %add-react
    %=  response-delta
      author  (get-author-ship:cu author.response-delta)
      react  (need (react-1:cu react.response-delta))
    ==
  ::
      %del-react
    response-delta(author (get-author-ship:cu author.response-delta))
  ==
::
++  old-delta-replies-3
  |=  =delta:replies:c
  ^-  delta:replies:old-3
  ?-    -.delta
    %add  delta(memo (memo-1:cu memo.delta))
  ::
    %del  [%del ~]
  ::
      %add-react
    %=  delta
      author  (get-author-ship:cu author.delta)
      react  (need (react-1:cu react.delta))
    ==
  ::
    %del-react  delta(author (get-author-ship:cu author.delta))
  ==
++  old-response-writs-3
  |=  =response:writs:c
  ^-  response:writs:old-3
  =*  r-delta  response.response
  %=  response  response
    ?-    -.r-delta
        %add
      :*  %add
          (memo-1:cu -.essay.r-delta)
          time.r-delta
      ==
    ::
      %del  [%del ~]
    ::
        %reply
      %=  r-delta
        meta  (bind meta.r-delta reply-meta-1:cu)
        delta  (old-response-delta-replies-3 delta.r-delta)
      ==
    ::
        %add-react
      %=  r-delta
        author  (get-author-ship:cu author.r-delta)
        react  (need (react-1:cu react.r-delta))
      ==
        %del-react
      r-delta(author (get-author-ship:cu author.r-delta))
    ==
  ==
++  old-paged-writs-3
  |=  =paged-writs:c
  ^-  paged-writs:old-3
  %=  paged-writs  writs
    (run:on:writs:c writs.paged-writs old-writ-3)
  ==
++  old-writ-4
  |=  =writ:c
  ^-  writ:old-4
  :_  +.writ
  [id time reacts replies reply-meta]:-.writ
++  old-paged-writs-4
  |=  =paged-writs:c
  ^-  paged-writs:old-4
  %=  paged-writs  writs
    (run:on:writs:c writs.paged-writs old-writ-4)
  ==
++  old-response-writs-4
  |=  =response:writs:c
  ^-  response:writs:old-4
  =*  r-delta  response.response
  %=  response  response
    ?+  -.r-delta  r-delta
      %add  [%add essay time]:r-delta
    ==
  ==
++  give-paged-writs
  |=  [mode=?(%light %heavy) ver=?(%v0 %v1 %v2) ls=(list [time writ:c])]
  ^-  (unit (unit cage))
  =;  p=paged-writs:c
    ?-  ver
      %v0  ``chat-paged-writs+!>((old-paged-writs-3 p))
      %v1  ``chat-paged-writs-1+!>((old-paged-writs-4 p))
      %v2  ``chat-paged-writs-2+!>(p)
    ==
  =/  =writs:c
    %+  gas:on:writs:c  *writs:c
    ?:  =(%heavy mode)  ls
    %+  turn  ls
    |=  [=time =writ:c]
    [time writ(replies *replies:c)]
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
  |=  [mode=?(%light %heavy) ver=?(%v0 %v1 %v2) =time count=@ud]
  ^-  (unit (unit cage))
  =/  older  (bat:mope wit.pac `time count)
  =/  newer  (tab:on:writs:c wit.pac `time count)
  =/  writ   (get:on:writs:c wit.pac time)
  =/  writs
    ?~  writ
      (welp older newer)
    (welp (snoc older [time u.writ]) newer)
  (give-paged-writs mode ver writs)
++  peek
  |=  [care=@tas ver=?(%v0 %v1 %v2) =(pole knot)]
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
    =/  wits=(list [time p=writ:c])
      (bap:on:writs:c wit.pac)
    |-
    ?~  wits  ~
    ?:  (gth seq.p.i.wits end)
      $(wits t.wits)
    ?:  (lth seq.p.i.wits start)
      ~  ::  done
    :-  i.wits
    $(wits t.wits)
  ::
      [%writ %id ship=@ time=@ ~]
    =/  ship  (slav %p ship.pole)
    =/  time  (slav %ud time.pole)
    ?.  ?=(%u care)
      =/  =writ:c  writ:(got ship `@da`time)
      ?-  ver
        %v0  ``writ+!>((old-writ-3 writ))
        %v1  ``chat-writ-1+!>((old-writ-4 writ))
        %v2  ``chat-writ-2+!>(writ)
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
      ?.  (match val.n.posts match-type)  scan.s
      [[%writ val.n.posts] scan.s]
    ::
    =.  scan.s
      =*  id-post  id.val.n.posts
      =*  replies  replies.val.n.posts
      |-  ^+  scan.s
      ?~  replies  scan.s
      =.  scan.s  $(replies r.replies)
      ::
      =.  scan.s
        ?.  (match-reply val.n.replies match-type)  scan.s
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
      ?.  (match val.n.wit.pac match-type)  s
      ?:  (gth sip.s 0)
        s(sip (dec sip.s))
      s(len (dec len.s), scan [[%writ val.n.wit.pac] scan.s])
    ::
    =.  s  (scour-replies s id.val.n.wit.pac replies.val.n.wit.pac match-type)
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
      ?.  (match-reply val.n.replies match-type)  s
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
++  writ-7-to-8
  |=  =writ:old-3
  ^-  writ:old-4
  %=  writ
    reacts  (~(run by reacts.writ) react-7-to-8:cu)
    replies  (run:on:replies:old-3 replies.writ reply-7-to-8)
    :: essay
    +  =-  ?>(?=([%chat *] kind.-) -)
        (essay-7-to-8:cu +.writ)
  ==
++  reply-7-to-8
  |=  =reply:old-3
  ^-  reply:old-4
  %=  reply
    reacts  (~(run by reacts.reply) react-7-to-8:cu)
    ::  memo
    +  (memo-7-to-8:cu +.reply)
  ==
--

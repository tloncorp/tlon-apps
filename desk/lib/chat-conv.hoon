/-  c=chat, ch=channels
/+  ccv=channel-conv
|%
++  v6
  |%
  ++  writ
    |%
    ++  v5
      |=  =writ:v6:c
      ^-  writ:v5:c
      [(v5:seal -.writ) +.writ]
    --
  ++  writs
    |%
    ++  v5
      |=  =writs:v6:c
      ^-  writs:v5:c
      =*  wit  writs.writs
      %+  gas:on:writs:v5:c  ~
      %+  murn
        (tap:on:writs:v6:c writs)
      |=  [=time writ=(may:c writ:c)]
      ?:  ?=(%| -.writ)  ~
      `[time (v5:^writ +.writ)]
    --
  ++  paged-writs
    |%
    ++  v5
      |=  =paged-writs:v6:c
      ^-  paged-writs:v5:c
      %=    paged-writs
          writs  (v5:writs writs.paged-writs)
      ==
    ++  v4
      |=  =paged-writs:v6:c
      ^-  paged-writs:v4:c
      (v4:paged-writs:^v5 (v5 paged-writs))
    --
  ++  response-writs
    |%
    ++  v5
      |=  =response:writs:v6:c
      ^-  response:writs:v5:c
      response
    ++  v4
      |=  =response:writs:v6:c
      ^-  response:writs:v4:c
      (v4:response-writs:^v5 (v5 response))
    --
  ++  replies
    |%
    ++  v5
      |=  =replies:v6:c
      ^-  replies:v5:c
      %+  gas:on:replies:v5:c  ~
      %+  murn
        (tap:on:replies:v6:c replies)
      |=  [=time reply=(may:c reply:c)]
      ?:  ?=(%| -.reply)  ~
      `[time +.reply]
    --
  ++  heads
    |%
    ++  v5
      |=  heads=chat-heads:v6:c
      ^-  chat-heads:v5:c
      %+  turn  heads
      |=  [=whom:c recency=time latest=(unit writ:v6:c)]
      ^-  [whom:c time (unit writ:v5:c)]
      ?~  latest  [whom recency ~]
      :-  whom  :-  recency
      (some (v5:writ u.latest))
    ++  v4
      |=  heads=chat-heads:v6:c
      ^-  chat-heads:v4:c
      (v4:heads:^v5 (v5 heads))
    --
  ++  seal
    |%
    ++  v5
      |=  =seal:v6:c
      ^-  seal:v5:c
      :*  id.seal
          seq.seal
          time.seal
          reacts.seal
          (v5:replies replies.seal)
          reply-meta.seal
      ==
    --
  ++  action-club
    |%
    ++  v5
      |=  =action:club:v6:c
      ^-  action:club:v5:c
      action
    ++  v4
      |=  =action:club:v6:c
      ^-  action:club:v4:c
      (v4:action-club:^v5 (v5 action))
    --
  ++  scam
    |%
    ++  v5
      |=  =scam:v6:c
      ^-  scam:v5:c
      scam(scan (v5:scan scan.scam))
    ++  v4
      |=  =scam:v6:c
      ^-  scam:v4:c
      (v4:scam:^v5 (v5 scam))
    --
  ++  scan
    |%
    ++  v5
      |=  =scan:v6:c
      ^-  scan:v5:c
      %+  murn  scan
      |=  ref=reference:v6:c
      ^-  (unit reference:v5:c)
      ?-  -.ref
        %writ  ?:(?=(%| -.writ.ref) ~ `writ+(v5:writ +.writ.ref))
      ::
          %reply
        ?:  ?=(%| -.reply.ref)
          ~
        `reply+[id.ref +.reply.ref]
      ==
    ++  v4
      |=  =scan:v6:c
      ^-  scan:v4:c
      (v4:scan:^v5 (v5 scan))
    --
  --
++  v5
  |%
  ++  writ
    |%
    ++  v6
      |=  =writ:v5:c
      ^-  writ:v6:c
      :_  +.writ
      =*  seal  -.writ
      :*  id.seal
          seq.seal
          time.seal
          reacts.seal
          (v6:replies replies.seal)
          reply-meta.seal
      ==
    ++  v4
      |=  =writ:v5:c
      ^-  writ:v4:c
      :_  +.writ
      [id time reacts replies reply-meta]:-.writ
    ++  v3
      |=  =writ:v5:c
      ^-  writ:v3:c
      (v3:writ:^v4 (v4 writ))
    --
  ++  reply
    |%
    ++  v4  v3:reply:^v4
    --
  ++  replies
    |%
    ++  v6
      |=  =replies:v5:c
      ^-  replies:v6:c
      %+  gas:on:replies:v6:c  *replies:v6:c
      %+  turn
        (tap:on:replies:v5:c replies)
      |=  [=time =reply:c]
      [time %& reply]
    --
  ++  paged-writs
    |%
    ++  v4
      |=  =paged-writs:v5:c
      ^-  paged-writs:v4:c
      %=    paged-writs
          writs
        (run:on:writs:v5:c writs.paged-writs v4:writ)
      ==
    ++  v3
      |=  =paged-writs:v5:c
      ^-  paged-writs:v3:c
      (v3:paged-writs:^v4 (v4 paged-writs))
    --
  ++  response-writs
    |%
    ++  v4
      |=  =response:writs:v5:c
      ^-  response:writs:v4:c
      =*  r-delta  response.response
      %=    response
          response
        ?+  -.r-delta  r-delta
          %add  [%add essay time]:r-delta
        ==
      ==
    ++  v3
      |=  =response:writs:v5:c
      ^-  response:writs:v3:c
      (v3:response-writs:^v4 (v4 response))
    --
  ++  action-club
    |%
    ++  v4
      |=  =action:club:v5:c
      ^-  action:club:v4:c
      action
    ++  v3
      |=  =action:club:v5:c
      ^-  action:club:v3:c
      (v3:action-club:^v4 (v4 action))
    --
  ++  scan
    |%
    ++  v4
      |=  =scan:v5:c
      ^-  scan:v4:c
      %+  turn  scan
      |=  ref=reference:v5:c
      ^-  reference:v4:c
      ?+  -.ref  ref
        %writ  writ+(v4:writ writ.ref)
      ==
    ++  v3
      |=  =scan:v5:c
      ^-  scan:v3:c
      (v3:scan:^v4 (v4 scan))
    --
  ++  scam
    |%
    ++  v4
      |=  =scam:v5:c
      ^-  scam:v4:c
      scam(scan (v4:scan scan.scam))
    ++  v3
      |=  =scam:v5:c
      ^-  scam:v3:c
      (v3:scam:^v4 (v4 scam))
    --
  ++  heads
    |%
    ++  v4
      |=  heads=chat-heads:v5:c
      ^-  chat-heads:v4:c
      %+  turn  heads
      |=  [=whom:c recency=time latest=(unit writ:v5:c)]
      [whom recency (bind latest v4:writ)]
    ++  v3
      |=  heads=chat-heads:v5:c
      (v3:heads:^v4 (v4 heads))
    --
  --
++  v4
  |%
  ++  writ
    |%
    ++  v3
      |=  =writ:v4:c
      ^-  writ:v3:c
      :_  =-  ?>(?=([%chat kind:v3:c] kind-data.-) -)
          (v7:essay:v9:ccv +.writ)
      :*  id.writ
          time.writ
          (v7:reacts:v9:ccv reacts.writ)
          (run:on:replies:v4:c replies.writ v3:reply)
          (v7:reply-meta:v9:ccv reply-meta.writ)
      ==
    --
  ++  reply
    |%
    ++  v3
      |=  =reply:v4:c
      ^-  reply:v3:c
      %=  reply
        reacts  (v7:reacts:v9:ccv reacts.reply)
        ::  memo
        +  (v7:memo:v9:ccv +.reply)
      ==
    --

  ++  action-club
    |%
    ++  v3
      |=  =action:club:v4:c
      ^-  action:club:v3:c
      =*  delta  q.q.action
      ?:  ?=(%writ -.delta)
        action(diff.q.q (v3:diff-writs diff.delta))
      action
    --
  ++  diff-writs
    |%
    ++  v3
      |=  =diff:writs:v4:c
      ^-  diff:writs:v3:c
      =*  delta  q.diff
      %=  diff  q
        ?-  -.delta
        ::
            %add
          :*  %add
              (v7:memo:v9:ccv -.essay.delta)
              ?:(=(/chat-notice kind.essay.delta) [%notice ~] ~)
              time.delta
          ==
        ::
          %del  delta
        ::
            %reply
          %=  delta
            meta  (bind meta.delta v7:reply-meta:v9:ccv)
            delta  (v3:delta-replies delta.delta)
          ==
        ::
            %add-react
          %=  delta
            author  (v7:author:v9:ccv author.delta)
            react   (v7:react:v9:ccv react.delta)
          ==
        ::
            %del-react
          delta(author (v7:author:v9:ccv author.delta))
        ==
      ==
    --
  ++  delta-replies
    |%
    ++  v3
      |=  =delta:replies:v4:c
      ^-  delta:replies:v3:c
      ?-    -.delta
        %add  delta(memo (v7:memo:v9:ccv memo.delta))
      ::
        %del  [%del ~]
      ::
          %add-react
        %=  delta
          author  (v7:author:v9:ccv author.delta)
          react  (v7:react:v9:ccv react.delta)
        ==
      ::
        %del-react  delta(author (v7:author:v9:ccv author.delta))
      ==
    --
  ++  response-writs
    |%
    ++  v3
      |=  =response:writs:v4:c
      ^-  response:writs:v3:c
      =*  r-delta  response.response
      %=  response  response
        ?-    -.r-delta
            %add
          :*  %add
              (v7:memo:v9:ccv -.essay.r-delta)
              time.r-delta
          ==
        ::
          %del  [%del ~]
        ::
            %reply
          %=  r-delta
            meta  (bind meta.r-delta v7:reply-meta:v9:ccv)
            delta  (v3:response-delta-replies delta.r-delta)
          ==
        ::
            %add-react
          %=  r-delta
            author  (v7:author:v9:ccv author.r-delta)
            react  (v7:react:v9:ccv react.r-delta)
          ==
            %del-react
          r-delta(author (v7:author:v9:ccv author.r-delta))
        ==
      ==
    --
  ++  response-delta-replies
    |%
    ++  v3
      |=  =response-delta:replies:v4:c
      ^-  response-delta:replies:v3:c
      ?-    -.response-delta
        %add  response-delta(memo (v7:memo:v9:ccv memo.response-delta))
      ::
        %del  [%del ~]
      ::
          %add-react
        %=  response-delta
          author  (v7:author:v9:ccv author.response-delta)
          react  (v7:react:v9:ccv react.response-delta)
        ==
      ::
          %del-react
        response-delta(author (v7:author:v9:ccv author.response-delta))
      ==
    --
  ++  paged-writs
    |%
    ++  v3
      |=  =paged-writs:v4:c
      ^-  paged-writs:v3:c
      %=  paged-writs  writs
        (run:on:writs:v4:c writs.paged-writs v3:writ)
      ==
    --
  ++  scan
    |%
    ++  v3
      |=  =scan:v4:c
      ^-  scan:v3:c
      %+  turn  scan
      |=  ref=reference:v4:c
      ^-  reference:v3:c
      ?-  -.ref
        %writ  writ+(v3:writ writ.ref)
        %reply  reply+[id.ref (v3:reply reply.ref)]
      ==
    --
  ++  scam
    |%
    ++  v3
      |=  =scam:v4:c
      ^-  scam:v3:c
      scam(scan (v3:scan scan.scam))
    --
  ++  heads
    |%
    ++  v3
      |=  heads=chat-heads:v4:c
      ^-  chat-heads:v3:c
      %+  turn  heads
      |=  [=whom:c recency=time latest=(unit writ:v4:c)]
      ^-  [whom:c time (unit writ:v3:c)]
      ?~  latest  [whom recency ~]
      :-  whom  :-  recency
      (some (v3:writ u.latest))
    --
  --
++  v3
  |%
  ++  writ
    |%
    ++  v4
      |=  =writ:v3:c
      ^-  writ:v4:c
      %=  writ
        reacts  (v8:reacts:v7:ccv reacts.writ)
        replies  (run:on:replies:v3:c replies.writ v4:reply)
        meta  (v8:reply-meta:v7:ccv meta.writ)
        +  =-  ?>(?=([%chat *] kind.-) -)
            (v8:essay:v7:ccv +.writ)
      ==
    --
  ++  reply
    |%
    ++  v4
      |=  =reply:v3:c
      ^-  reply:v4:c
      %=  reply
        reacts  (v8:reacts:v7:ccv reacts.reply)
        ::  memo
        +  (v8:memo:v7:ccv +.reply)
      ==
    --
  ++  diff-writs
    |%
    ++  v6
      |=  =diff:writs:v3:c
      ^-  diff:writs:v6:c
      (v5 diff)
    ++  v5
      |=  =diff:writs:v3:c
      ^-  diff:writs:v5:c
      (v4 diff)
    ++  v4
      |=  diff=diff:writs:v3:c
      ^-  diff:writs:v4:c
      :-  p.diff
      ?+    -.q.diff  q.diff
          %add
        ^-  delta:writs:c
        [%add [memo [%chat kind] ~ ~]:q.diff time.q.diff]
      ::
          %reply
        [%reply id.q.diff meta.q.diff (v4:delta-replies delta.q.diff)]
      ::
          %add-react
        [%add-react ship.q.diff (v7:react:v8:ccv react.q.diff)]
      ==
    --
  ++  delta-replies
    |%
    ++  v6
      |=  =delta:replies:v3:c
      ^-  delta:replies:v6:c
      (v5 delta)
    ++  v5
      |=  =delta:replies:v3:c
      ^-  delta:replies:v5:c
      (v4 delta)
    ++  v4
      |=  =delta:replies:v3:c
      ^-  delta:replies:v4:c
      ?:  ?=(%add-react -.delta)
        delta(react (v7:react:v8:ccv react.delta))
      delta
    --
  --
++  v2
  |%
  ++  diff-writs
    |%
    ++  v3
      |=  diff=diff:writs:v2:c
      ^-  diff:writs:v3:c
      :-  p.diff
      ?-  -.q.diff
        %add       [%add (v3:memo p.q.diff) ~ ~]
        %del       [%del ~]
        %add-feel  [%add-react +.q.diff]
        %del-feel  [%del-react +.q.diff]
      ==
    --
  ++  memo
    |%
    ++  v3
      |=  memo:v2:c
      ^-  memo:v7:ch
      [(v3:story author content) author sent]
    --
  ++  story
    |%
    ++  v3
      |=  [=ship =content:v2:c]
      ^-  story:v7:ch
      =*  body  p.content
      ?-    -.content
          %notice  ~[%inline pfix.body ship+ship sfix.body]~
          %story
        %+  welp
          (turn p.body (lead %block))
        [%inline q.body]~
      ==
    --
  --
--
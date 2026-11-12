/-  cv=chat-ver, dv=channels-ver
/+  *test, h=harness-tlon-history
|%
++  dm-fixture
  =/  post=writ:v7:cv  *writ:v7:cv
  =.  id.post  [~lux ~2026.9.6]
  =.  +.post  +.post(author ~lux, sent ~2026.9.6, content ~[[%inline ~['parent']]])
  =/  count=@ud  30
  |-
  ?:  =(0 count)  post
  =/  =reply:v7:cv  *reply:v7:cv
  =.  id.reply  [~bud (add ~2026.9.6 count)]
  =.  +.reply  +.reply(author ~bud, sent (add ~2026.9.6 count), content ~[[%inline ~['reply']]])
  %=  $  count  (dec count)  post
      post(replies (put:on:replies:v7:cv replies:-.post (add ~2026.9.6 count) [%& reply]))
  ==
++  test-dm-thread-keeps-parent-and-bounds-newest-replies
  =/  rows  (dm-thread:h dm-fixture)
  ?>  ?=([* * *] rows)
  %-  expect
  !>  ?&  =(20 (lent rows))  =('parent' text.i.rows)  =(~lux author.i.rows)  =(~bud author.i.t.rows)
          =((add ~2026.9.6 12) sent.i.t.rows)  =((add ~2026.9.6 30) sent:(rear rows))
      ==
++  test-dm-thread-skips-deleted-replies
  =/  post  dm-fixture
  =.  replies.post  (put:on:replies:v7:cv replies.post (add ~2026.9.6 30) [%| *tombstone:v7:cv])
  (expect-eq !>(19) !>((lent (dm-thread:h post))))
++  test-channel-thread-keeps-parent-and-skips-tombstones
  =/  =post:v9:dv  *post:v9:dv
  =.  id.post  ~2026.9.6
  =.  +.+.post  +.+.post(author ~lux, sent ~2026.9.6, content ~[[%inline ~['channel parent']]])
  =/  =reply:v9:dv  *reply:v9:dv
  =.  id.reply  ~2026.9.6..00.00.01
  =.  +.+.reply
    +.+.reply(author ~bud, sent ~2026.9.6..00.00.01, content ~[[%inline ~['channel reply']]])
  =/  =replies:v9:dv  (put:on-replies:v9:dv *replies:v9:dv ~2026.9.6..00.00.01 [%& reply])
  =.  replies  (put:on-replies:v9:dv replies ~2026.9.6..00.00.02 [%| *tombstone:v9:dv])
  =/  rows  (channel-thread:h post replies)
  ?>  ?=([* * *] rows)
  %-  expect
  !>  ?&  =(2 (lent rows))  =('channel parent' text.i.rows)  =('channel reply' text.i.t.rows)
          =((scot %da ~2026.9.6..00.00.01) id.i.t.rows)
      ==
--

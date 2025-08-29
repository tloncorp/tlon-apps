/-  spider, c=channels
/+  s=strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
|^
=/  =nest:c  (need !<((unit nest:c) arg))
~&  "getting channel for {<nest>}"
;<  =v-channels:c  bind:m
  (scry:s v-channels:c /gx/channels-server/v0/v-channels/noun)
~&  "got channels"
?~  channel=(~(get by v-channels) nest)
  ~&  "channel not found"
  (pure:m !>(~))
~&  "got channel"
=*  chan  u.channel
=/  =log:c  log.chan
=/  [=state *]
  %^  (dip:log-on:c state)  log
    *state
  |=  [=state =time update=u-channel:v9:c]
  ?+  update  [~ | state]
      [%post * %set %& *]
    :-  ~  :-  |
    =*  post  post.u-post.update
    ?:  =(0 rev.post)  :: new post
      state(adds (~(put by adds.state) id.post [time seq.post]))
    state(edits (~(put by edits.state) id.post rev.post))
  ::
      [%post * %set %| *]
    :-  ~  :-  |
    =*  post  post.u-post.update
    state(dels (~(put by dels.state) id.post [time seq.post]))
  ==
::  compare dels vs adds, both in existence of add and time ordering
=/  missing-adds=(set id-post:c)
  (~(dif in ~(key by dels.state)) ~(key by adds.state))
~&  [%missing-adds missing-adds]
=/  order-issues=(list id-post:c)
  %+  murn
    ~(tap by adds.state)
  |=  [id=id-post:c time=@da seq=@ud]
  ::  ignore if not found we already know missing from above
  ?~  del=(~(get by dels.state) id)  ~
  ::  if the add time is less than the delete time, we're good
  ?:  (lte time log-time.u.del)  ~
  ::  otherwise return this id
  `id
~&  [%order-issues order-issues]
=/  disagreed-seqs=(list id-post:c)
  %+  murn
    ~(tap by dels.state)
  |=  [id=id-post:c time=@da seq=@ud]
  ::  ignore if not found we already know missing from above
  ?~  add=(~(get by adds.state) id)  ~
  ::  if the seqs match, we're good
  ?:  =(seq seq.u.add)  ~
  `id
~&  [%disagreeing-add-del disagreed-seqs]
=/  [* duplicates=(map id-post:c @ud)]
  %+  roll
    ~(tap by adds.state)
  |=  [[id=id-post:c time=@da seq=@ud] [seen=(set @ud) dupes=(map id-post:c @ud)]]
  ?.  (~(has in seen) seq)  [(~(put in seen) seq) dupes]
  [seen (~(put by dupes) id seq)]
~&  [%duplicate-sequences duplicates]
=/  merged-seqs=(set @ud)
  %-  sy
  %+  turn
    (weld ~(tap by adds.state) ~(tap by dels.state))
  |=([* * seq=@ud] seq)
:: this should equal last sequence number
=/  total=@ud  ~(wyt in merged-seqs)
~&  [%total-sequences total]
=/  seq-range=(set @ud)  ?.((gth total 0) ~ (sy (gulf 1 total)))
=/  missing-nos=(set @ud)  (~(dif in seq-range) merged-seqs)
~&  [%missing-sequence-numbers missing-nos]
=/  disagreeing-sequences=(list id-post:c)
  %+  murn
    ~(tap by (~(uni by adds.state) dels.state))
  |=  [id=id-post:c time=@da seq=@ud]
  ?~  post=(get:on-v-posts:c posts.chan id)  ~
  =/  post-seq
    ?-  -.u.post
      %&  seq.u.post
      %|  seq.u.post
    ==
  ?:  =(seq post-seq)  ~
  `id
~&  [%disagreeing-sequences disagreeing-sequences]
(pure:m !>(~))
+$  state
  $:  adds=(map id-post:c [log-time=@da seq=@ud])
      dels=(map id-post:c [log-time=@da seq=@ud])
      edits=(map id-post:c count=@ud)
  ==
--

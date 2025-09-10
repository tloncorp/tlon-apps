/-  spider, c=channels
/+  s=strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
|^
;<  =v-channels:c  bind:m
  (scry:s v-channels:c /gx/channels-server/v0/v-channels/noun)
~&  "got channels"
=;  problematic-channels=(set nest:c)
  ~?  >>>  !=(0 ~(wyt in problematic-channels))
    [%problematic-channels problematic-channels]
  (pure:m !>(~))
%+  roll
  ~(tap by v-channels)
|=  [[=nest:c =v-channel:c] probs=(set nest:c)]
=/  [=state *]
  %^  (dip:log-on:c state)  log.v-channel
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
=/  missing-adds=(list id-post:c)
  ~(tap in (~(dif in ~(key by dels.state)) ~(key by adds.state)))
=/  has-missing-adds  (check-list missing-adds)
~?  >>  has-missing-adds  [nest %missing-adds missing-adds]
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
=/  has-order-issues  (check-list order-issues)
~?  >>  has-order-issues  [nest %order-issues order-issues]
=/  disagreed-seqs=(list id-post:c)
  %+  murn
    ~(tap by dels.state)
  |=  [id=id-post:c time=@da seq=@ud]
  ::  ignore if not found we already know missing from above
  ?~  add=(~(get by adds.state) id)  ~
  ::  if the seqs match, we're good
  ?:  =(seq seq.u.add)  ~
  `id
=/  has-disagreed-seqs  (check-list disagreed-seqs)
~?  >>  has-disagreed-seqs  [nest %disagreeing-add-del disagreed-seqs]
=/  [* duplicates=(map id-post:c @ud)]
  %+  roll
    ~(tap by adds.state)
  |=  [[id=id-post:c time=@da seq=@ud] [seen=(set @ud) dupes=(map id-post:c @ud)]]
  ?.  (~(has in seen) seq)  [(~(put in seen) seq) dupes]
  [seen (~(put by dupes) id seq)]
=/  has-duplicates  !=(0 ~(wyt by duplicates))
~?  >>  has-duplicates  [nest %duplicate-sequences duplicates]
=/  merged-seqs=(set @ud)
  %-  sy
  %+  turn
    (weld ~(tap by adds.state) ~(tap by dels.state))
  |=([* * seq=@ud] seq)
:: this should equal last sequence number
=/  total=@ud  ~(wyt in merged-seqs)
=/  total-posts  (wyt:on-v-posts:c posts.v-channel)
~&  >  [nest %total-sequences total]
~&  >  [nest %total-posts total-posts]
=/  seq-range=(set @ud)  ?:(=(0 total) ~ (sy (gulf 1 total)))
=/  missing-nos=(set @ud)  (~(dif in seq-range) merged-seqs)
=/  has-missing-nos  !=(0 ~(wyt in missing-nos))
~?  >>  has-missing-nos  [nest %missing-sequence-numbers missing-nos]
=/  disagreeing-sequences=(list id-post:c)
  %+  murn
    ~(tap by (~(uni by adds.state) dels.state))
  |=  [id=id-post:c time=@da seq=@ud]
  ?~  post=(get:on-v-posts:c posts.v-channel id)  ~
  =/  post-seq
    ?-  -.u.post
      %&  seq.u.post
      %|  seq.u.post
    ==
  ?:  =(seq post-seq)  ~
  `id
=/  has-disagreeing-sequences  (check-list disagreeing-sequences)
~?  >>  has-disagreeing-sequences  [nest %disagreeing-sequences disagreeing-sequences]
=/  has-problems
  ?|  has-disagreeing-sequences
      has-disagreed-seqs
      has-order-issues
      has-missing-adds
      has-missing-nos
      has-duplicates
  ==
?.  has-problems  probs
(~(put in probs) nest)
+$  state
  $:  adds=(map id-post:c [log-time=@da seq=@ud])
      dels=(map id-post:c [log-time=@da seq=@ud])
      edits=(map id-post:c count=@ud)
  ==
++  check-list
  |=  lst=(list id-post:c)
  !=(0 (lent lst))
--

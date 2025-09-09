/-  spider, c=channels
/+  s=strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
|^
=/  agent=?(%channels %channels-server)
  (need !<((unit ?(%channels %channels-server)) arg))
;<  =v-channels:c  bind:m
  %+  scry:s  v-channels:c
  ?:  ?=(%channels agent)
    /gx/channels/v4/v-channels/noun
  /gx/channels-server/v0/v-channels/noun
=;  [problematic-channels=(set nest:c)]
  =/  has-problems  !=(0 ~(wyt in problematic-channels))
  ~?  >>>  has-problems
    [%problematic-channels problematic-channels]
  ~?  >   !has-problems
    'posts integrity verified'
  (pure:m !>(~))
%+  roll
  ~(tap by v-channels)
|=  [[=nest:c =v-channel:c] probs=(set nest:c)]
=/  remaining=(set @ud)
  ?:  =(0 (wyt:on-v-posts:c posts.v-channel))  ~
  (sy (gulf 1 count.v-channel))
=;  [seen=(set @ud) remaining=(set @ud) dupes=(set @ud)]
  =/  has-dupes  !=(0 ~(wyt in dupes))
  =/  unseen     !=(0 ~(wyt in remaining))
  ~?  >>>  has-dupes  [%dupes nest dupes]
  ~?  >>>  unseen     [%unseen nest remaining]
  ::  if we don't have any duplicates or unseen sequence numbers we're good
  ?.  |(has-dupes unseen)  probs
  (~(put in probs) nest)
%+  roll
  (tap:on-v-posts:c posts.v-channel)
|=  [[id=id-post:c post=(may:c v-post:c)] seen=(set @ud) =_remaining dupes=(set @ud)]
=/  seq=@ud
  ?-  -.post
    %&  seq.post
    %|  seq.post
  ==
?:  (~(has in seen) seq)
  ~&  >>>  [%duplicate-seq seq id nest]
  [seen remaining (~(put in dupes) seq)]
?.  (~(has in remaining) seq)
  ~&  >>>  [%seq-out-of-range seq nest]
  [(~(put in seen) seq) remaining dupes]
[(~(put in seen) seq) (~(del in remaining) seq) dupes]
--

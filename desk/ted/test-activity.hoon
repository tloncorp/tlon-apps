/-  spider, a=activity
/+  s=strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=/  verb  (fall !<((unit ?) arg) |)
;<  our=ship  bind:m  get-our:s
;<  ~  bind:m  (poke-our:s %hood %kiln-nuke !>([%activity |]))
;<  ~  bind:m  (poke-our:s %hood %kiln-revive !>(%activity))
::
::  add an event and get a fact
::
=/  post-time  ~2010.1.1
=/  add-post=action:a
  :-  %add
  ^-  event:a
  :*  %post
      :*  [[~sampel-poster post-time] post-time]
          [%chat ~sampel-palnet %mychat]
          [~sampel-hoster %mygroup]
      ==
      ~[[%inline ~['hello']]]
      |
  ==
;<  ~  bind:m  (watch:s /root [our %activity] /)
;<  ~  bind:m  (poke-our:s %activity %activity-action !>(add-post))
;<  [* add-vase=vase]  bind:m  (take-fact:s /root)
=/  [fact-time=time fact-event=event:a]  !<(time-event:a add-vase)
?>  .=  +.add-post  fact-event
::
::  scry the event we added
::
;<  exists=?  bind:m  (scry:s ? %gu %activity /event/(scot %da fact-time))
?>  exists
;<  scried-event=time-event:a  bind:m  (scry:s time-event:a %gx %activity /event/(scot %da fact-time)/noun)
?>  =(event.scried-event +:add-post)
::
::  scry the full state
::
;<  =full-info:a  bind:m  (scry:s full-info:a %gx %activity /noun)
=/  expected-index  [%channel [%chat ~sampel-palnet %mychat] [~sampel-hoster %mygroup]]
?>  =(1 ~(wyt by stream.full-info))
?>  .=  (silt ~[expected-index])
      ~(key by indices.full-info)
?>  .=  (~(got by unreads.full-info) expected-index)
      [newest=post-time count=1 threads=~]
::
::  read the post and get a fact
::
;<  ~  bind:m  (watch:s /unreads [our %activity] /unreads)
;<  ~  bind:m  (poke-our:s %activity %activity-action !>([%read expected-index %post fact-time]))
;<  [* read-vase=vase]  bind:m  (take-fact:s /unreads)
=/  [=index:a =unread-summary:a]  !<([index:a unread-summary:a] read-vase)
?>  =(index expected-index)
?>  (gth newest.unread-summary post-time)
?>  =(0 count.unread-summary)
::
::  add a second event, which notifies
::
=/  second-post-time  ~2012.1.1
=/  add-second-post=action:a
  :-  %add
  ^-  event:a
  :*  %post
      :*  [[~sampel-poster second-post-time] second-post-time]
          [%chat ~mister-palnet %mister-chat]
          [~mister-hoster %mister-group]
      ==
      ~[[%inline ~['howdy']]]
      &
  ==
;<  ~  bind:m  (watch:s /notifications [our %activity] /notifications)
;<  ~  bind:m  (poke-our:s %activity %activity-action !>(add-second-post))
;<  [* second-add-vase=vase]  bind:m  (take-fact:s /notifications)
=/  [second-fact-time=time second-fact-event=event:a]  !<(time-event:a second-add-vase)
?>  .=  +.add-second-post  second-fact-event
::
::  scry events (paginated)
::
;<  scried-stream=(list time-event:a)  bind:m  (scry:s (list time-event:a) %gx %activity /all/(scot %da fact-time)/2/noun)
?>  =(~[[second-fact-time +.add-second-post]] scried-stream)
::
::  mute a dm
::
=/  adjust-action=action:a
  :*  %adjust
      [%dm %ship ~walnut]
      %hush
  ==
;<  ~  bind:m  (poke-our:s %activity %activity-action !>(adjust-action))
::
::  add two dms. the first is muted and does not notify
::
=/  dm-time  ~2014.1.1
=/  add-dm=action:a
  :-  %add
  ^-  event:a
  :*  %dm-post
      :*  [[~walnut dm-time] dm-time]
          [%ship ~walnut]
      ==
      ~[[%inline ~['hey']]]
      |
  ==
=/  add-second-dm=action:a
  :-  %add
  ^-  event:a
  :*  %dm-post
      :*  [[~walrus dm-time] +(dm-time)]
          [%ship ~walrus]
      ==
      ~[[%inline ~['yo']]]
      |
  ==
;<  ~  bind:m  (poke-our:s %activity %activity-action !>(add-dm))
;<  ~  bind:m  (poke-our:s %activity %activity-action !>(add-second-dm))
::  we cannot assert that we didn't get a fact, so we send another event after
::  and assert that we get that first
;<  [* third-add-vase=vase]  bind:m  (take-fact:s /notifications)
=/  [third-fact-time=time third-fact-event=event:a]  !<(time-event:a third-add-vase)
?>  .=  +.add-second-dm  third-fact-event
(pure:m !>(~))

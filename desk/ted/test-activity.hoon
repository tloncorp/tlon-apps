/-  spider, a=activity
/+  s=strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=/  verb  (fall !<((unit ?) arg) |)
;<  our=ship  bind:m  get-our:s
;<  ~  bind:m  (poke-our:s %hood %kiln-nuke !>([%activity &]))
;<  ~  bind:m  (poke-our:s %hood %kiln-revive !>(%activity))
::
::  add an event and get a fact
::
=/  add-post=action:a
  :-  %add
  ^-  event:a
  :*  %post
      :*  [[~sampel-poster *time] *time]
          [%chat ~sampel-palnet %mychat]
          [~sampel-hoster %mygroup]
      ==
      ~[[%inline ~['hello']]]
      |
  ==
;<  ~  bind:m  (watch:s /root [our %activity] /)
;<  ~  bind:m  (poke-our:s %activity %activity-action !>(add-post))
;<  [=mark =vase]  bind:m  (take-fact:s /root)
=/  [fact-time=time fact-event=event:a]  !<(time-event:a vase)
?>  .=  +.add-post  fact-event
::
::  scry the event we added
::
;<  exists=?  bind:m  (scry:s ? %gu %activity /event/(scot %da fact-time))
?>  exists
;<  scried-event=time-event:a  bind:m  (scry:s time-event:a %gx %activity /event/(scot %da fact-time)/noun)
?>  =(event.scried-event +:add-post)
::
(pure:m !>(~))

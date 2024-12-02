/-  h=hooks, c=channels
:-  %say
|=  $:  [now=@da eny=@uvJ =beak]
        [[=event:h =context:h ~] ~]
    ==
:-  %noun
^-  outcome:h
=-  &+[[[%allowed event] -] state.hook.context]
^-  (list effect:h)
?.  ?=(?(%delay %on-post) -.event)  ~
?:  ?=(%delay -.event)
  =/  =nest:c  [%chat ~bospur-davmyl-nocsyx-lassul %welcome-8458]
  =+  !<(trigger=event:h data.event)
  ?.  ?=([%on-post %add *] trigger)  ~
  =*  post  post.trigger
  =/  =c-react:c  [%add-react id.post author.post ':thumbs-up:']
  ~[[%channels %channel nest %post c-react]]
=/  id  (rsh [3 48] eny.context)
~[[%delay id id.hook.context ~s30 !>(event)]]
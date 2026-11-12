::  Silent, rate-limited audit of unpermissioned addressed activity.
::  No outgoing message, inference or Harness grant.
/-  t=harness-tlon, a=activity-ver
|%
++  sender
  |=  [our=@p event=incoming-event:v8:a]
  ^-  (unit @p)
  =/  who=(unit @p)
    ?+  -.event  ~
      %dm-invite  ?:(?=(%ship -.whom.event) `p.whom.event ~)
      %dm-post  ?:(&(?=(%ship -.whom.event) =(p.whom.event p.id.key.event)) `p.id.key.event ~)
      %dm-reply  ?:(&(?=(%ship -.whom.event) =(p.whom.event p.id.key.event)) `p.id.key.event ~)
      %post  ?:(mention.event `p.id.key.event ~)
      %reply  ?:(|(mention.event =(our p.id.parent.event)) `p.id.key.event ~)
    ==
  ?~  who  ~
  ?:(=(our u.who) ~ who)
++  allowed
  |=  [now=@da who=@p event=@t notices=(list notice:t)]
  ^-  ?
  =/  denied  (skim notices |=(n=notice:t =('permission-denied' kind.n)))
  ?.  (lth (lent (skim denied |=(n=notice:t (gth (add at.n ~m1) now)))) 8)  |
  !(lien denied |=(n=notice:t |(=(event event.n) &(=(who actor.n) (gth (add at.n ~m5) now)))))
--

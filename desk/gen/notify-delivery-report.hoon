::  +notify-delivery-report: show stats about push notification delivery
::
/-  a=activity
::
:-  %say
|=  $:  [now=@da * bec=beak]
        ~
        ~
    ==
:-  %tang  ^-  tang
=+  .^  notifs=(map time-id:a [=event:a first-req=(unit @da)])
      /gx/(scot %p p.bec)/notify/(scot %da now)/note/noun
    ==
::  find report range (oldest & newest timestamp),
::  total notification count, requested notification count,
::  and sum of the time between notification and serving the first request.
::
=+  %+  roll  ~(tap by notifs)
    |=  $:  [=time-id:a =event:a first-req=(unit @da)]
            [old=_now new=@da num=@ud req=@ud sum=@dr]
        ==
    :^    (min old time-id)
        (max new time-id)
      +(num)
    ?~  first-req  [req sum]
    :-  +(req)
    (add sum (sub u.first-req time-id))
::  prep for report rendering
::
=.  old  (sub old (mod old ~d1))
=.  new  (sub new (mod new ~d1))
=/  cen=@ud  (div (mul req 100) num)
=/  avg=@dr  =+((div sum req) (sub - (mod - ~s1)))
::
%-  flop
:~  leaf+"Between {(scow %da old)} and {(scow %da new)},"
    leaf+"Served {(scow %ud req)} out of {(scow %ud num)} notifications ({(scow %ud cen)}%)."
    leaf+"Average time-to-request was {(scow %dr avg)}."
==

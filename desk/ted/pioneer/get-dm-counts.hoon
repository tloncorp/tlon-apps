::  pioneer/get-dm-counts: count sent/received messages in a DM thread
::
::    arg (json):
::      { "ship":  "~target",
::        "limit": 1000           // optional; max writs to inspect (default 1000)
::      }
::
::    note: this samples the most recent .limit writs in the conversation.
::    if you need exact lifetime totals beyond that, raise .limit.
::
::    return:
::      json: { "sent": <n>, "received": <n>, "total": <n>, "sampled": <n> }
::
::    "total" is the pact-reported total (all-time).
::    "sampled" is the number of writs actually inspected for the breakdown.
::
/-  spider, cv=chat-ver
/+  *strandio
=,  strand=strand:spider
=,  dejs:format
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
;<  =bowl:spider  bind:m  get-bowl
=+  !<(arg=(unit json) arg)
?>  ?=(^ arg)
=*  json  u.arg
=/  args=[target=ship limit=(unit @ud)]
  ((ot ship+(se %p) limit+(mu ni) ~) json)
=/  limit=@ud  (fall limit.args 1.000)
=/  =path
  /v4/dm/(scot %p target.args)/writs/newest/(scot %ud limit)/light/chat-paged-writs-4
;<  =paged-writs:v7:cv  bind:m  (scry paged-writs:v7:cv %gx %chat path)
=/  writs-list  (tap:on:writs:v7:cv writs.paged-writs)
::  extract author ship from each writ; treats bot-author entries as their ship
::
=/  author-of
  |=  w=(may:v7:cv writ:v7:cv)
  ^-  ship
  =/  a=author:v7:cv  ?:(?=(%| -.w) author.w author.w)
  ?@(a a ship.a)
=+  %+  roll  writs-list
    |=  [[=time w=(may:v7:cv writ:v7:cv)] sent=@ud recv=@ud]
    =/  who  (author-of w)
    ?:  =(who our.bowl)  [+(sent) recv]
    [sent +(recv)]
=/  out=^json
  %-  pairs:enjs:format
  :~  sent+(numb:enjs:format sent)
      received+(numb:enjs:format recv)
      total+(numb:enjs:format total.paged-writs)
      sampled+(numb:enjs:format (lent writs-list))
  ==
(pure:m !>(out))

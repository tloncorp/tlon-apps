::  pioneer/delete-oldest-dm: delete the oldest message in a DM thread
::
::    arg (json):
::      { "ship": "~target" }
::
::    return:
::      json: { "deleted": true }    if a message was found and deleted
::            { "deleted": false }   if the DM is empty
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
=+  !<(=json arg)
=/  target=ship  ((ot ship+(se %p) ~) json)
=/  empty-out=^json  (frond:enjs:format deleted+b+|)
=/  done-out=^json   (frond:enjs:format deleted+b+&)
::  scry the oldest writ via the %newer paging mode with start=0
::
=/  =path
  :*  %gx  %chat  %v4  %dm  (scot %p target)
      %writs  %newer  (scot %ud 0)  (scot %ud 1)  %light
      %chat-paged-writs-4  ~
  ==
;<  =paged-writs:v7:cv  bind:m  (scry paged-writs:v7:cv path)
=/  writs-list  (tap:on:writs:v7:cv writs.paged-writs)
?~  writs-list  (pure:m !>(empty-out))
=/  oldest=(may:v7:cv writ:v7:cv)  +.i.writs-list
?.  ?=(%& -.oldest)  (pure:m !>(empty-out))
=/  =writ:v7:cv  +.oldest
=/  oldest-id=id:v7:cv  id.-.writ
=/  =delta:writs:v7:cv  [%del ~]
=/  =action:dm:v7:cv  [target oldest-id delta]
;<  ~  bind:m
  (poke [our.bowl %chat] chat-dm-action-2+!>(action))
(pure:m !>(done-out))

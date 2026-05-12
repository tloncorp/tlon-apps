::  pioneer/send-dm: send a plain-text direct message
::
::    arg (json):
::      { "ship": "~target", "text": "..." }
::
::    return: ~ on success
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
=/  args=[target=ship text=@t]
  ((ot ship+(se %p) text+so ~) json)
=/  =essay:v7:cv
  :^  [[[%inline text.args ~] ~] our.bowl now.bowl]   ::  memo
      [%chat /]                                       ::  kind
      ~                                               ::  meta
      ~                                               ::  blob
=/  =action:dm:v7:cv
  :-  target.args
  :-  [our.bowl now.bowl]
  [%add essay ~]
;<  ~  bind:m
  (poke [our.bowl %chat] chat-dm-action-2+!>(action))
(pure:m !>(~))

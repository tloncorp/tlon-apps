::  pioneer/set-contact-nickname: set our profile nickname
::
::    arg (json):
::      { "nickname": "..." }     // pass empty string to clear
::
::    return: ~ on success
::
/-  spider, co=contacts
/+  io=strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
;<  our=@p  bind:m  get-our:io
=+  !<(=json arg)
=/  parse-args
  =,  dejs:format
  (ot nickname+so ~)
=/  nickname=@t  (parse-args json)
=/  patch=contact:co
  ?:  =('' nickname)
    (my [%nickname ~] ~)
  (my [%nickname [%text nickname]] ~)
=/  =action:co  [%self patch]
;<  ~  bind:m  (poke:io [our %contacts] contact-action-1+!>(action))
(pure:m !>(~))

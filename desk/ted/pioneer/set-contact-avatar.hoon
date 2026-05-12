::  pioneer/set-contact-avatar: set our profile avatar URL
::
::    arg (json):
::      { "avatar": "https://..." }     // pass empty string to clear
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
  (ot avatar+so ~)
=/  avatar=@t  (parse-args json)
=/  patch=contact:co
  ?:  =('' avatar)
    (my [%avatar ~] ~)
  (my [%avatar [%look `@ta`avatar]] ~)
=/  =action:co  [%self patch]
;<  ~  bind:m  (poke:io [our %contacts] contact-action-1+!>(action))
(pure:m !>(~))

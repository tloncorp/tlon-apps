::  pioneer/get-contact: read our (or a peer's) contact profile
::
::    arg (json):
::      { "ship": "~target" }    // optional; omit for self
::
::    return:
::      json: { "nickname": "..."|null, "avatar": "..."|null }
::
/-  spider, co=contacts
/+  io=strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
;<  =bowl:spider  bind:m  get-bowl:io
=+  !<(=json arg)
=/  parse-args
  =,  dejs:format
  (ot ship+(mu (se %p)) ~)
=/  who=(unit ship)  (parse-args json)
=/  =path
  ?~  who
    /gx/contacts/v1/self/contact-1
  /gx/contacts/v1/contact/(scot %p u.who)/contact-1
;<  =contact:co  bind:m  (scry:io contact:co path)
=/  nickname=(unit @t)
  =/  v=(unit value:co)  (~(get by contact) %nickname)
  ?~  v  ~
  ?.  ?=(%text -.u.v)  ~
  `p.u.v
=/  avatar=(unit @t)
  =/  v=(unit value:co)  (~(get by contact) %avatar)
  ?~  v  ~
  ?.  ?=(%look -.u.v)  ~
  `(@t p.u.v)
=/  out=^json
  %-  pairs:enjs:format
  :~  nickname+?~(nickname ~ s+u.nickname)
      avatar+?~(avatar ~ s+u.avatar)
  ==
(pure:m !>(out))

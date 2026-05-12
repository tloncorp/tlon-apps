::  pioneer/create-chat-channel: idempotently create a chat channel in a group
::
::    arg (json):
::      { "flag":        "~ship/group-name",
::        "name":        "channel-slug",
::        "title":       "...",
::        "description": "...",     // optional
::        "image":       "..."      // optional, used as channel meta
::      }
::
::    return:
::      json: { "nest": "chat/~our/channel-slug", "created": true|false }
::
/-  spider, g=groups, c=channels, cv=channels-ver
/+  *strandio, gj=groups-json
=,  strand=strand:spider
=,  dejs:format
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
;<  =bowl:spider  bind:m  get-bowl
=+  !<(=json arg)
=/  args=[=flag:g name=@tas title=@t description=(unit @t) image=(unit @t)]
  %.  json
  %-  ot
  :~  flag+flag:dejs:gj
      name+(se %tas)
      title+so
      description+(mu so)
      image+(mu so)
  ==
=/  =nest:c  [%chat our.bowl name.args]
;<  exists=?  bind:m
  (scry ? /gu/channels/v1/chat/(scot %p our.bowl)/[name.args])
=/  nest-str=@t
  (crip "chat/{<our.bowl>}/{(trip name.args)}")
?:  exists
  =/  out=^json
    %-  pairs:enjs:format
    :~  nest+s+nest-str
        created+b+|
    ==
  (pure:m !>(out))
=/  =create-channel:v9:cv
  :*  %chat
      name.args
      flag.args
      title.args
      (fall description.args '')
      image.args
      ~                ::  readers
      ~                ::  writers
  ==
=/  =a-channels:v9:cv  [%create create-channel]
;<  ~  bind:m
  (poke [our.bowl %channels] channel-action-1+!>(a-channels))
=/  out=^json
  %-  pairs:enjs:format
  :~  nest+s+nest-str
      created+b+&
  ==
(pure:m !>(out))

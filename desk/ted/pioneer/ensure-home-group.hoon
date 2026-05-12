::  pioneer/ensure-home-group: idempotently create the home group + default chat channel
::
::    arg (json):
::      { "title":       "Home",
::        "description": "...",          // optional
::        "image":       "...",          // optional
::        "cover":       "..."           // optional
::      }
::
::    creates a group at ~our/home with a "general" chat channel.
::
::    return:
::      json: { "flag": "~our/home", "channel": "chat/~our/general" }
::
/-  spider, g=groups, gv=groups-ver, c=channels, cv=channels-ver, mt=meta
/+  *strandio, gj=groups-json
=,  strand=strand:spider
=,  dejs:format
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
=*  n  (strand ,~)
^-  form:m
;<  =bowl:spider  bind:m  get-bowl
=+  !<(=json arg)
=/  args=[title=@t description=(unit @t) image=(unit @t) cover=(unit @t)]
  %.  json
  %-  ot
  :~  title+so
      description+(mu so)
      image+(mu so)
      cover+(mu so)
  ==
=/  group-name=@tas  %home
=/  channel-name=@tas  %general
=/  =flag:g  [our.bowl group-name]
=/  meta=data:mt
  :*  title.args
      (fall description.args '')
      (fall image.args '')
      (fall cover.args '')
  ==
::
;<  group-exists=?  bind:m
  (scry ? /gu/groups/groups/(scot %p our.bowl)/[group-name])
;<  ~  bind:m
  ?:  group-exists  (pure:n ~)
  =/  =create-group:g
    :*  group-name
        meta
        %secret
        [~ ~]
        ~
    ==
  (poke [our.bowl %groups] group-command+!>(`c-groups:g`[%create create-group]))
::
;<  channel-exists=?  bind:m
  (scry ? /gu/channels/v1/chat/(scot %p our.bowl)/[channel-name])
;<  ~  bind:m
  ?:  channel-exists  (pure:n ~)
  =/  =create-channel:v9:cv
    :*  %chat
        channel-name
        flag
        title.args
        description.meta
        ~
        ~
        ~
    ==
  (poke [our.bowl %channels] channel-action-1+!>(`a-channels:v9:cv`[%create create-channel]))
::
=/  out=^json
  %-  pairs:enjs:format
  :~  flag+s+(crip "{<our.bowl>}/{(trip group-name)}")
      channel+s+(crip "chat/{<our.bowl>}/{(trip channel-name)}")
  ==
(pure:m !>(out))

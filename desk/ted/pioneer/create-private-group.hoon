::  pioneer/create-private-group: idempotently create a private group
::
::    arg (json):
::      { "name":        "group-slug",
::        "title":       "Group Title",
::        "description": "Description text",        // optional, defaults to ""
::        "image":       "https://...",             // optional, defaults to ""
::        "cover":       "https://..."              // optional, defaults to ""
::      }
::
::    return:
::      json: { "flag": "~our/group-slug", "created": true|false }
::
/-  spider, g=groups, gv=groups-ver, mt=meta
/+  *strandio, gj=groups-json
=,  strand=strand:spider
=,  dejs:format
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
;<  =bowl:spider  bind:m  get-bowl
=+  !<(=json arg)
=/  args=[name=@tas title=@t description=(unit @t) image=(unit @t) cover=(unit @t)]
  %.  json
  %-  ot
  :~  name+(se %tas)
      title+so
      description+(mu so)
      image+(mu so)
      cover+(mu so)
  ==
=/  =flag:g  [our.bowl name.args]
::
;<  exists=?  bind:m
  (scry ? /gu/groups/groups/(scot %p our.bowl)/[name.args])
=/  flag-str=@t  (crip "{<our.bowl>}/{(trip name.args)}")
?:  exists
  =/  out=^json
    %-  pairs:enjs:format
    :~  flag+s+flag-str
        created+b+|
    ==
  (pure:m !>(out))
::
=/  meta=data:mt
  :*  title.args
      (fall description.args '')
      (fall image.args '')
      (fall cover.args '')
  ==
=/  =create-group:g
  :*  name.args
      meta
      %secret   ::  privacy: private + hidden
      [~ ~]     ::  banned
      ~         ::  members
  ==
=/  =c-groups:g  [%create create-group]
;<  ~  bind:m  (poke [our.bowl %groups] group-command+!>(c-groups))
=/  out=^json
  %-  pairs:enjs:format
  :~  flag+s+flag-str
      created+b+&
  ==
(pure:m !>(out))

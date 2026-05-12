::  pioneer/create-group-lure-invite: create a shareable group invite link
::
::    arg (json):
::      { "flag":  "~ship/group-name",
::        "title": "Group Title",         // optional; included in metadata
::        "image": "https://..."          // optional; group icon url
::      }
::
::    watches %reel and pokes %reel-describe with the group's id, then
::    returns the URL once the bait provider confirms.
::
::    return:
::      json: { "url": "https://...", "flag": "~ship/group-name" }
::
/-  spider, reel, g=groups
/+  io=strandio, gj=groups-json
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
;<  =bowl:spider  bind:m  get-bowl:io
=+  !<(=json arg)
=/  parse-args
  =,  dejs:format
  %-  ot
  :~  flag+flag:dejs:gj
      title+(mu so)
      image+(mu so)
  ==
=/  args=[=flag:g title=(unit @t) image=(unit @t)]  (parse-args json)
=*  flag  flag.args
=/  flag-str=cord  (crip "{<p.flag>}/{(trip q.flag)}")
=/  fields=(map field:reel cord)
  =/  acc=(map field:reel cord)  ~
  =?  acc  ?=(^ title.args)
    (~(put by acc) %'invitedGroupTitle' u.title.args)
  =?  acc  ?=(^ image.args)
    (~(put by acc) %'invitedGroupIconImageUrl' u.image.args)
  acc
=/  =metadata:v1:reel  [%group fields]
=/  =wire  /group-lure-invite/(scot %da now.bowl)
;<  ~  bind:m
  (watch:io wire [our.bowl %reel] /v1/id-link/[flag-str])
;<  ~  bind:m
  (poke:io [our.bowl %reel] reel-describe+!>([flag-str metadata]))
;<  =cage  bind:m  (take-fact:io wire)
?.  ?=(%json p.cage)
  ~|  unexpected-mark+p.cage  !!
=/  url-json=^json  !<(^json q.cage)
?>  ?=([%s *] url-json)
=/  out=^json
  %-  pairs:enjs:format
  :~  url+s+p.url-json
      flag+s+flag-str
  ==
(pure:m !>(out))

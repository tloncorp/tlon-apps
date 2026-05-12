::  pioneer/create-lure-invite: create a shareable personal invite link
::
::    arg (json):
::      { "id":  "lure-id",       // stable id; reuse to refresh a token
::        "tag": "personal"       // optional, defaults to "personal"
::      }
::
::    watches /v1/id-link/<id> on %reel, pokes %reel-describe, and waits
::    for the bait provider to confirm. then returns the URL.
::
::    return:
::      json: { "url": "https://..." }
::
/-  spider, reel
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
  (ot id+so tag+(mu (se %tas)) ~)
=/  args=[id=@t tag=(unit @tas)]  (parse-args json)
=/  id=cord  id.args
=/  tag=@tas  (fall tag.args %personal)
=/  =metadata:v1:reel  [tag ~]
=/  =wire  /lure-invite/(scot %da now.bowl)
;<  ~  bind:m
  (watch:io wire [our.bowl %reel] /v1/id-link/[id])
;<  ~  bind:m
  (poke:io [our.bowl %reel] reel-describe+!>([id metadata]))
;<  =cage  bind:m  (take-fact:io wire)
?.  ?=(%json p.cage)
  ~|  unexpected-mark+p.cage  !!
=/  url-json=^json  !<(^json q.cage)
?>  ?=([%s *] url-json)
=/  out=^json  (frond:enjs:format url+s+p.url-json)
(pure:m !>(out))

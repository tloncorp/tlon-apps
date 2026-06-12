::  pioneer/create-lure-invite: create a shareable personal invite link
::
::    arg (json):
::      "lure-id",       // string, stable id; reuse to refresh a token
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
=+  !<(arg=(unit json) arg)
?>  ?=(^ arg)
=*  json  u.arg
=/  id=cord  (so:dejs:format json)
=/  =wire  /lure-invite/(scot %da now.bowl)
;<  ~  bind:m
  (watch:io wire [our.bowl %reel] /v1/id-link/[id])
;<  ~  bind:m
  %+  poke:io  [our.bowl %reel]
  reel-describe+!>([id `metadata:reel`[tag=%groups-0 [%'inviteType' 'user'] ~ ~]])
;<  =cage  bind:m  (take-fact:io wire)
?.  ?=(%json p.cage)
  ~|  unexpected-mark+p.cage  !!
=/  url-json=^json  !<(^json q.cage)
?>  ?=([%s *] url-json)
=/  out=^json  (frond:enjs:format url+s+p.url-json)
(pure:m !>(out))

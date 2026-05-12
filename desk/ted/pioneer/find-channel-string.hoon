::  pioneer/find-channel-string: search a channel for a text needle
::
::    arg (json):
::      { "nest":   "chat/~host/channel-name",
::        "needle": "...",
::        "count":  10           // optional, max matches to fetch (default 1)
::      }
::
::    return:
::      json: { "found": true|false, "matches": <n> }
::
/-  spider, c=channels, cv=channels-ver
/+  *strandio, cj=channel-json
=,  strand=strand:spider
=,  dejs:format
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<(=json arg)
=/  args=[=nest:c needle=@t count=(unit @ud)]
  %.  json
  %-  ot
  :~  nest+nest:dejs:cj
      needle+so
      count+(mu ni)
  ==
=*  nest    nest.args
=/  count=@ud  (fall count.args 1)
=/  =path
  :*  %gx  %channels  %v5  kind.nest  (scot %p ship.nest)  name.nest
      %search  %text  (scot %ud 0)  (scot %ud count)  needle.args
      %channel-scan-4  ~
  ==
;<  =scan:v10:cv  bind:m  (scry scan:v10:cv path)
=/  out=^json
  %-  pairs:enjs:format
  :~  found+b+!=(~ scan)
      matches+(numb:enjs:format (lent scan))
  ==
(pure:m !>(out))

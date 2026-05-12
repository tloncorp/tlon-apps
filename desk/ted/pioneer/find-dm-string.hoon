::  pioneer/find-dm-string: search a DM thread for a text needle
::
::    arg (json):
::      { "ship":   "~target",
::        "needle": "...",
::        "count":  10           // optional, max matches (default 1)
::      }
::
::    return:
::      json: { "found": true|false, "matches": <n> }
::
/-  spider, cv=chat-ver
/+  *strandio
=,  strand=strand:spider
=,  dejs:format
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<(=json arg)
=/  args=[target=ship needle=@t count=(unit @ud)]
  %.  json
  %-  ot
  :~  ship+(se %p)
      needle+so
      count+(mu ni)
  ==
=/  count=@ud  (fall count.args 1)
=/  =path
  :*  %gx  %chat  %v4  %dm  (scot %p target.args)
      %search  %text  (scot %ud 0)  (scot %ud count)
      needle.args  %chat-scan-4  ~
  ==
;<  =scan:v7:cv  bind:m  (scry scan:v7:cv path)
=/  out=^json
  %-  pairs:enjs:format
  :~  found+b+!=(~ scan)
      matches+(numb:enjs:format (lent scan))
  ==
(pure:m !>(out))

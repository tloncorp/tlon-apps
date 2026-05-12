::  pioneer/is-agent-running: check whether a named agent is running on this ship
::
::    arg (json):
::      { "agent": "groups" }
::
::    return:
::      json: { "running": true|false }
::
/-  spider
/+  *strandio
=,  strand=strand:spider
=,  dejs:format
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<(=json arg)
=/  app=@tas  ((ot agent+(se %tas) ~) json)
;<  running=?  bind:m  (scry ? /gu/[app]/$)
(pure:m !>((frond:enjs:format running+b+running)))

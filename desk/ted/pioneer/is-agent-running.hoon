::  pioneer/is-agent-running: check whether a named agent is running on this ship
::
::    arg (json):
::      { "agent": "groups" }
::
::    return:
::      json: true|false
::
/-  spider
/+  *strandio
=,  strand=strand:spider
=,  dejs:format
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<(arg=(unit json) arg)
?>  ?=(^ arg)
=*  json  u.arg
=/  app=@tas  ((ot agent+(se %tas) ~) json)
;<  running=?  bind:m  (scry ? /gu/[app]/$)
(pure:m !>(`^json`b+running))

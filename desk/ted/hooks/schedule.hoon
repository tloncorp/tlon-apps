/-  spider, h=hooks
/+  s=strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
|^
=+  !<([~ =id:h =origin:h =action] arg)
;<  our=@p  bind:m  get-our:s
;<  ~  bind:m  (watch:s /responses [our %channels-server] /hooks/v0)
=/  =cage
  :-  %hook-action-0
  !>
  ^-  action:h
  ?:  ?=(%stop -.action)  [%rest id origin]
  [%wait id origin +.action]
;<  ~  bind:m  (poke-our:s %channels-server cage)
;<  =^cage  bind:m  (take-fact:s /responses)
?>  ?=(%hook-response-0 p.cage)
=+  !<(=response:h q.cage)
?>  ?=(?(%wait %rest) -.response)
?:  ?=(%rest -.response)
  ~&  "stopped scheduled hook {<id.response>} running on {<origin.response>}"
  (pure:m !>(~))
;<  now=time  bind:m  get-time:s
=/  fires-at  (add now schedule.response)
~&  "starting hook {<id.response>}, scheduled to run on {<origin.response>} at {<fires-at>}"
(pure:m !>(~))
+$  action
  $%  [%stop ~]
      [%start schedule=@dr =config:h]
  ==
--
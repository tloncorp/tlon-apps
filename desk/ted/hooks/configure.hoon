/-  spider, h=hooks, c=channels
/+  s=strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<([~ =id:h =nest:c =config:h] arg)
;<  our=@p  bind:m  get-our:s
;<  ~  bind:m  (watch:s /responses [our %channels-server] /hooks/v0)
=/  =cage  hook-action-0+!>(`action:h`[%configure id nest config])
;<  ~  bind:m  (poke-our:s %channels-server cage)
;<  =^cage  bind:m  (take-fact:s /responses)
?>  ?=(%hook-response-0 p.cage)
=+  !<(=response:h q.cage)
?>  ?=(%configure -.response)
~&  "hook {<id.response>} running on {<nest.response>} configured"
(pure:m !>(~))
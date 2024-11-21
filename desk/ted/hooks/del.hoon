/-  spider, h=hooks
/+  s=strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<([~ =id:h] arg)
;<  our=@p  bind:m  get-our:s
;<  ~  bind:m  (watch:s /responses [our %channels-server] /hooks/v0)
=/  =cage  hook-action-0+!>(`action:h`[%del id])
;<  ~  bind:m  (poke-our:s %channels-server cage)
;<  =^cage  bind:m  (take-fact:s /responses)
?>  ?=(%hook-response-0 p.cage)
=+  !<(=response:h q.cage)
?>  ?=(%gone -.response)
?>  =(id id.response)
~&  "hook {<id.response>} deleted"
(pure:m !>(~))
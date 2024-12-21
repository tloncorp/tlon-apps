/-  spider, h=hooks, c=channels
/+  s=strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<([~ =nest:c seq=(list id-hook:h)] arg)
;<  our=@p  bind:m  get-our:s
;<  ~  bind:m  (watch:s /responses [our %channels-server] /v0/hooks)
=/  =cage  hook-action-0+!>(`action:h`[%order nest seq])
;<  ~  bind:m  (poke-our:s %channels-server cage)
;<  =^cage  bind:m  (take-fact:s /responses)
?>  ?=(%hook-response-0 p.cage)
=+  !<(=response:h q.cage)
?>  ?=(%order -.response)
%-  (slog (crip "new hook order for {<nest>}") ~)
~&  seq.response
(pure:m !>(~))

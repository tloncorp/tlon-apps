/-  spider, h=hooks
/+  s=strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<([~ name=@t src=@t] arg)
;<  our=@p  bind:m  get-our:s
;<  ~  bind:m  (watch:s /responses [our %channels-server] /v0/hooks)
=/  =cage  hook-action-0+!>(`action:h`[%add name src])
;<  ~  bind:m  (poke-our:s %channels-server cage)
;<  =^cage  bind:m  (take-fact:s /responses)
?>  ?=(%hook-response-0 p.cage)
=+  !<(=response:h q.cage)
?>  ?=(%set -.response)
%-  (slog (crip "hook {<name.response>} added with id {<id.response>}") ~)
?~  error.response  (pure:m !>(~))
%-  (slog 'compilation error:' u.error.response)
(pure:m !>(~))
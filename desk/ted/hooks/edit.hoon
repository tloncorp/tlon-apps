/-  spider, h=hooks
/+  s=strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<([~ =id:h name=@t src=@t] arg)
;<  our=@p  bind:m  get-our:s
;<  ~  bind:m  (watch:s /responses [our %channels-server] /hooks/v0)
=/  =cage  hook-action-0+!>(`action:h`[%edit id name src])
;<  ~  bind:m  (poke-our:s %channels-server cage)
;<  =^cage  bind:m  (take-fact:s /responses)
?>  ?=(%hook-response-0 p.cage)
=+  !<(=response:h q.cage)
?>  ?=(%set -.response)
?~  error.response
  ~&  "hook {<id.response>} edited successfully"
  (pure:m !>(~))
~&  "hook {<id.response>} edited"
~&  "compilation error:"
%-  (slog u.error.response)
(pure:m !>(~))
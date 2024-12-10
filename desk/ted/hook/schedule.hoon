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
;<  ~  bind:m  (watch:s /responses [our %channels-server] /v0/hooks)
=/  =cage
  :-  %hook-action-0
  !>
  ^-  action:h
  ?:  ?=(%stop -.action)  [%rest id origin]
  [%cron id origin +.action]
;<  ~  bind:m  (poke-our:s %channels-server cage)
;<  =^cage  bind:m  (take-fact:s /responses)
?>  ?=(%hook-response-0 p.cage)
=+  !<(=response:h q.cage)
?>  ?=(?(%cron %rest) -.response)
?:  ?=(%rest -.response)
  %-  (slog (crip "stopped scheduled hook {<id.response>} running on {<origin.response>}") ~)
  (pure:m !>(~))
;<  now=time  bind:m  get-time:s
=/  fires-at
  ?@  schedule.response  (add now schedule.response)
  next.schedule.response
%-  (slog (crip "starting hook {<id.response>}, scheduled to run on {<origin.response>} at {<fires-at>}") ~)
(pure:m !>(~))
+$  action
  $%  [%stop ~]
      [%start schedule=$@(@dr schedule:h) =config:h]
  ==
--

/-  spider, h=hooks, c=channels, g=groups
/+  s=strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=/  [example=nest:c target=nest:c]
  (need !<((unit [nest:c nest:c]) arg))
;<  ~  bind:m
  (watch:s /template [ship.example %channels-server] /v0/hooks/template/[kind.example]/[name.example])
;<  =cage  bind:m  (take-fact:s /template)
?>  ?=(%hook-template p.cage)
=+  !<(=template:h q.cage)
=/  =^cage  hook-setup-template+!>([target template])
;<  ~  bind:m  (poke-our:s %channels-server cage)
(pure:m !>(`json`s+'success'))

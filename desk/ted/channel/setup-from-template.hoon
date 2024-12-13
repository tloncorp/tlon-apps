/-  spider, h=hooks, c=channels, g=groups
/+  s=strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=/  [example=nest:c target=nest:c]
  (need !<((unit [nest:c nest:c]) arg))
~&  [example target]
;<  ~  bind:m
  (watch:s /template [ship.example %channels-server] /v0/hooks/template/[kind.example]/[name.example])
~&  "getting template"
;<  =cage  bind:m  (take-fact:s /template)
?>  ?=(%hook-template p.cage)
~&  "received template"
=+  !<(=template:h q.cage)
=/  =^cage  hook-setup-template+!>([target template])
~&  "setting up template"
;<  ~  bind:m  (poke-our:s %channels-server cage)
(pure:m !>(`json`s+'success'))

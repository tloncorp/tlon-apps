/-  spider, h=hooks, c=channels, g=groups
/+  s=strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<([~ =nest:c =flag:g name=(unit @t)] arg)
;<  our=@p  bind:m  get-our:s
;<  eny=@  bind:m  get-entropy:s
=/  id  (end 3^3 eny)
=/  nest-name=term  (cat 3 'channel-' id)
=/  new-nest=nest:c  [kind.nest our nest-name]
=/  =create-channel:c
  :*  kind.nest
      nest-name
      flag
      (fall name '')
      ''
      ~
      ~
  ==
=/  create-cage=cage
  channel-action+!>(`a-channels:c`[%create create-channel])
;<  ~  bind:m  (poke-our:s %channels create-cage)
;<  ~  bind:m
  (watch:s /template [ship.nest %channels-server] /v0/hooks/template/[kind.nest]/[name.nest])
;<  =^cage  bind:m  (take-fact:s /template)
?>  ?=(%hook-template p.cage)
=+  !<(=template:h q.cage)
=/  =cage  hook-setup-template+!>([new-nest template])
;<  ~  bind:m  (poke-our:s %channels-server cage)
(pure:m !>(~))

/-  spider, hood
/+  strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=/  rev=?  |
=+  !<([~ arg=$@(des=desk [des=desk apps=(list dude:gall)])] arg)
;<  our=ship  bind:m  get-our:strandio
;<  now=@da  bind:m  get-time:strandio
=/  [=desk apps=(list dude:gall)]  ?^  arg  [des.arg apps.arg]
:-  des.arg
(turn (get-apps-have:hood our des.arg now) head)
;<  ~  bind:m
%-  send-raw-cards:strandio
=;  cards
  ?.  rev  cards
  %+  welp  cards  :_  ~
  [%pass /poke %agent [our %hood] %poke kiln-revive+!>(desk)]
=-  (turn apps -)
|=  =dude:gall
[%pass /poke %agent [our %hood] %poke kiln-nuke+!>([dude %|])]
;<  ~  bind:m  (trace:strandio leaf+"raze: nuked {<apps>}" ~)
(pure:m !>(~))

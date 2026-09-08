/-  spider
/+  strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<(arg=(unit json) arg)
?>  ?=(^ arg)
?>  ?=(%~ u.arg)
;<  =bowl:spider  bind:m  get-bowl:strandio
=/  ran  (clan:title our.bowl)
?:  ?=([?(%earl %pawn)] ran)
  %+  strand-fail:strand  %invalid-parent-rank
  :_  ~
  :-  %leaf
  "can't create a moon from a {?:(?=(%earl ran) "moon" "comet")}"
=/  mon=ship
  (add our.bowl (lsh 5 (end 5 (shaz eny.bowl))))
;<  ryf=(unit rift)  bind:m
  (scry:strandio (unit rift) /j/ryft/(scot %p mon))
?^  ryf
  %+  strand-fail:strand  %moon-already-exists
  :~  leaf+"can't create {(scow %p mon)}, it already exists."
      leaf+"use |moon-breach and/or |moon-cycle-keys instead."
  ==
=/  cic  (pit:nu:cric:crypto 512 (shaz (jam mon life=1 eny.bowl)) %b ~)
=/  =feed:jael
  [[%2 ~] mon rift=0 [life=1 sec:ex:cic]~]
;<  ~  bind:m
  %-  send-raw-card:strandio
  [%pass /ted/gen-moon %arvo %j %moon mon *id:block:jael %keys [1 1 pub:ex:cic] %.n]
=/  result=json
  %-  pairs:enjs:format
  :~  ship+s+(scot %p mon)
      key+s+(scot %uw (jam feed))
  ==
(pure:m !>(result))

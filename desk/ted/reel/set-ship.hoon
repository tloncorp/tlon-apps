/-  spider
/+  *strandio
=,  strand=strand:spider
=,  strand-fail=strand-fail:libstrand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<(vic=cord arg)
;<  our=@p   bind:m  get-our
=/  url
  ?:  =(vic 'https://tlon.network/lure/')
    "https://tlon.network/v1/lure/bait/who"
  "{(trip vic)}lure/bait/who"
;<  =json  bind:m  (fetch-json url)
=/  =ship  (slav %p (so:dejs:format json))
;<  ~  bind:m  (poke [our %reel] reel-command+!>([%set-ship ship]))
(pure:m !>(~))

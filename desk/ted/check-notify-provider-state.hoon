/-  spider, n=notify, c=channels
/+  strandio
=,  strand=strand:spider
=,  strand-fail=strand-fail:libstrand:spider
|%
++  provider-stats-message
  |=  [ps=provider-state:n our=@p now=@da]
  ^-  a-channels:c
  ~&  [ps]
  =/  ps-list  ~(tap by ps)
  =/  total-providers  (lent ps-list)
  ~&  ['total providers' total-providers]
  =/  total-clients
    %+  roll  ps-list
      |=  [[provider=@tas provider-entry=provider-entry:n] accumulator=@]
      ^-  @
      (add accumulator (lent ~(tap by clients.provider-entry)))
  ~&  ['total clients on all providers' total-clients]
  =/  story=story:c  [[%inline [[%bold ['BotPoast: ' ~]] 'Daily ' [%inline-code '%notify'] ' provider check-in. Total providers: ' [%bold [(scot %u total-providers) ~]] ', total clients: ' [%bold [(scot %u total-clients) ~]] '.' ~]]~]
  =/  essay=essay:c  [[story our now] [%chat ~]]
  =/  nest=nest:c  [%chat ~dotdev-dotdev-finned-palmer %empty-chat]
  =/  channel-action=a-channels:c  [%channel nest [%post [%add essay]]]
  channel-action
--
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
;<  our=@p  bind:m  get-our:strandio
?.  =(our ~nalseg-banmud-finned-palmer)
  (pure:m !>(~))
;<  now=@da  bind:m  get-time:strandio
;<  ps=provider-state:n  bind:m  (scry:strandio provider-state:n /gx/notify/provider-state/noun)
;<  ~  bind:m  (poke:strandio [our %channels] channel-action+!>((provider-stats-message ps our now)))
(pure:m !>(~))

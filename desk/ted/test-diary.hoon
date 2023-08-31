::  TODO: move outside /desk directory, don't ship this
::
::TODO  assert things about state
::TODO  test all actions
::TODO  test cross-ship comms
/-  spider, d=diary, g=groups
/+  s=strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=/  group  %hackers
=/  chan  %hackweek
=/  app  %diary
=/  server  (cat 3 app '-server')
|^
;<  our=ship  bind:m  get-our:s
;<  ~  bind:m  (poke-our:s %hood %kiln-nuke !>([%groups &]))
;<  ~  bind:m  (sleep:s `@dr`0)
;<  ~  bind:m  (poke-our:s %hood %kiln-revive !>(%groups))
;<  ~  bind:m  (sleep:s `@dr`0)
;<  ~  bind:m  (group-create group 'hacking' 'hacked' '' '' [%open ~ ~] ~ |)
;<  ~  bind:m  (act %create chan [our group] 'hack week' 'hacking all week' ~ ~)
;<  ~  bind:m  (act %diary [our chan] %join [our group])
;<  ~  bind:m  (sleep:s `@dr`0)
::  make a bunch of posts
::
=|  count=@ud
|-
;<  send=@da  bind:m  get-time:s
=/  =essay:d  [(cat 3 'on hacking #' (scot %ud count)) '' ~ our send]
;<  ~  bind:m  (act %diary [our chan] %note %add essay)
;<  ~  bind:m  (sleep:s `@dr`0)
?:  (lth count 30)
  $(count +(count))
::  leave a single comment on the last post
::
;<  now=@da  bind:m  get-time:s
=/  =memo:d   [[~ 'hacking is bad' ~] our now]
;<  ~  bind:m  (act %diary [our chan] %note %quip send %add memo)
;<  ~  bind:m  (sleep:s `@dr`0)
::
;<  ~  bind:m  (dbug %diary)
;<  ~  bind:m  (dbug %diary-server)
(pure:m !>(%success))
::
++  act
  |=  =a-shelf:d
  =/  m  (strand ,~)
  ^-  form:m
  (poke-our:s app (cat 3 app '-action') !>(a-shelf))
::
++  group-create
  |=  =create:g
  =/  m  (strand ,~)
  ^-  form:m
  (poke-our:s %groups %group-create !>(create))
::
++  dbug
  |=  =dude:gall
  =/  m  (strand ,~)
  ^-  form:m
  (poke-our:s dude %dbug !>([%state '']))
::
++  get-state
  |=  =dude:gall
  =,  m  (strand vase)
  ^-  form:m
  ;<  =bowl:spider  bind:m  get-bowl
  %-  pure:m
  .^(vase /gx/(scot %p our.bowl)/[dude]/(scot %da now.bowl)/dbug/state/noun)
--

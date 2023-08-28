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
;<  ~  bind:m  (com %create chan [our group] 'hack week' 'hacking all week' ~ ~)
;<  ~  bind:m  (act [our chan] %join [our group])
;<  ~  bind:m  (sleep:s `@dr`0)
;<  note-send-time=@da  bind:m  get-time:s
=/  =essay:d  ['on hacking' '' ~ our note-send-time]
;<  ~  bind:m  (act [our chan] %notes %add essay)
;<  ~  bind:m  (sleep:s `@dr`0)
;<  now=@da  bind:m  get-time:s
=/  =memo:d   [[~ 'hacking is bad' ~] our now]
;<  ~  bind:m  (act [our chan] %notes %quips note-send-time %add memo)
;<  ~  bind:m  (sleep:s `@dr`0)
;<  ~  bind:m  (dbug %diary)
;<  ~  bind:m  (dbug %diary-server)
(pure:m !>(%success))
::
++  com
  |=  =c-shelf:d
  =/  m  (strand ,~)
  ^-  form:m
  (poke-our:s server (cat 3 app '-command') !>(c-shelf))
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
--

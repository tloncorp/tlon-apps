/-  spider, c=chat, g=groups, e=epic
/+  s=strandio
/+  mp=mop-extensions
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=/  verb  (fall !<((unit ?) arg) |)
;<  our=ship  bind:m  get-our:s
=/  group  %tlon-local
=/  archive  %locals-archive
;<  eny=@uv  bind:m  get-entropy:s
=/  uniq  (crip (scag 5 (flop (trip (scot %uv eny)))))
=/  chan  `term`(cat 3 'cafe-' uniq)
=/  chan-archive  [our `term`(cat 3 'cafe-archive' uniq)]
=/  app  %chat
=/  =flag:c  [our chan]
|^
=/  m  (strand ,vase)
:: ;<  ~  band:m  (poke-our:s %hood %kiln-nuke !>([%groups &]))
:: ;<  ~  band:m  (poke-our:s %hood %kiln-revive !>(%groups))
;<  ~  band:m
  =/  m  (strand ,~)
  ?.  verb  (pure:m ~)
  ;<  ~  band:m  (poke-our:s app %verb !>(%loud))
  (pure:m ~)
;<  ~  band:m
  (group-create group 'locals' 'chatting' '' '' [%open ~ ~] ~ |)
;<  ~  band:m
  (group-create archive 'locals-archive' 'chatting' '' '' [%open ~ ~] ~ |)
;<  ~  band:m
  (poke-our:s app %chat-create !>([[our group] chan 'cafe' '' ~ ~]))
::  make a bunch of posts
::
=|  count=@ud
|-
;<  id-msg=id:c  band:m  (add-msg count)
?:  (lth count 30)
  $(count +(count))
::  ensure that messages were processed
::
;<  ch=chat:c  band:m  (get-chat flag)
?>  (eq !>(31) !>((wyt:on:writs:c wit.pact.ch)))
=/  before=@da  -:(snag 0 (top:mope log.ch 11))
::  logs should have one more event for create
::
?>  (eq !>(32) !>((wyt:log-on:c log.ch)))
::  initiate transfer
::
;<  now=@da  band:m  get-time:s
;<  ~  band:m
  %^  poke-our:s  app  %noun 
  !>([%transfer-channel flag [our archive] chan-archive before])
::  check that transfer went through
::
;<  old=chat:c  band:m  (get-chat flag)
;<  new=chat:c  band:m  (get-chat chan-archive)
::  old chat should only have create event and last 10 messages
?>  (eq !>(11) !>((wyt:log-on:c log.old)))
::  new chat should have all logs and messages from before
?>  (eq !>(32) !>((wyt:log-on:c log.new)))
?>  (eq !>(31) !>((wyt:on:writs:c wit.pact.new)))
::
(pure:m !>(%success))
::
++  add-msg
  |=  count=@ud
    =/  m  (strand ,id:c)
  ^-  form:m
  ;<  send=@da  band:m  get-time:s
  =/  =memo:c  [~ our send %story ~ ~[(cat 3 'chatting #' (scot %ud count))]]
  =/  =id:c  [our send]
  ;<  ~  bind:m  (act flag send %writs id %add memo)
  (pure:m id)
::
+$  state
  $:  %2
      chats=(map flag:c chat:c)
      dms=(map ship dm:c)
      clubs=(map id:club:c club:c)
      drafts=(map whom:c story:c)
      pins=(list whom:c)
      bad=(set ship)
      inv=(set ship)
      voc=(map [flag:c id:c] (unit said:c))
      fish=(map [flag:c @] id:c)
      imp=(map flag:c ?)
  ==
::
++  group-create
  |=  =create:g
  =/  m  (strand ,~)
  ^-  form:m
  (poke-our:s %groups %group-create !>(create))
::
++  get-chat
  |=  =flag:c
  =/  m  (strand ,chat:c)
  ^-  form:m
  ;<  st=state  band:m  get-state
  (pure:m (~(got by chats.st) flag))
::
++  get-state
  =/  m  (strand ,state)
  ^-  form:m
  ;<  =bowl:spider  band:m  get-bowl:s
  %-  pure:m
  =<  -
  !<  [state epic:e]
  .^  vase
      /gx/(scot %p our.bowl)/[app]/(scot %da now.bowl)/dbug/state/noun
  ==
::
++  mope  ((mp time diff:c) lte)
::
++  dbug
  |=  =dude:gall
  =/  m  (strand ,~)
  ^-  form:m
  (poke-our:s dude %dbug !>([%state '']))
::
++  eq
  |=  [a=vase b=vase]
  ^-  ?
  ?:  =(q.a q.b)  &
  %-  (slog 'need' (sell a) 'have' (sell b) ~)
  |
::
++  neq
  |=  [a=vase b=vase]
  ^-  ?
  ?:  !=(q.a q.b)  &
  %-  (slog 'need different' (sell a) ~)
  |
::
++  strand
  |*  a=mold
  |%
  ++  def  (^strand a)
  ++  form  form:def
  ++  pure  pure:def
  ++  bind  bind:def
  ++  band
    |*  b=mold
    =/  m  (strand ,a)
    |=  [m-b=(strand-form-raw:rand b) fun=$-(b form:m)]
    ^-  form:m
    ;<  ~  bind:m  (sleep:s `@dr`0)
    ((bind:m b) m-b fun)
  --
::
++  act
  |=  =action:c
  =/  m  (strand ,~)
  ^-  form:m
  (poke-our:s app %chat-action !>(action))
::
--
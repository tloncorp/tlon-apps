::  TODO: move outside /desk directory, don't ship this
::
::TODO  assert things about state
::TODO  test all actions
::TODO  test cross-ship comms
::  - test that partial checkpoint is partial
/-  spider, d=diary, g=groups, e=epic
/+  s=strandio, dl=diary-load
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=/  verb  (fall !<((unit ?) arg) |)
=/  group  %hackers
=/  chan  %hackweek
=/  app  %diary
=/  server  (cat 3 app '-server')
;<  our=ship  bind:m  get-our:s
=/  =flag:d  [our chan]
|^
=/  m  (strand ,vase)
;<  ~  band:m  (poke-our:s %hood %kiln-nuke !>([%groups &]))
;<  ~  band:m  (poke-our:s %hood %kiln-revive !>(%groups))
;<  ~  band:m
  =/  m  (strand ,~)
  ?.  verb  (pure:m ~)
  ;<  ~  band:m  (poke-our:s %diary %verb !>(%loud))
  (poke-our:s %diary-server %verb !>(%loud))
;<  ~  band:m  (group-create group 'hacking' 'hacked' '' '' [%open ~ ~] ~ |)
;<  ~  band:m  (act %create chan [our group] 'hack week' 'hacking all week' ~ ~)
::  make a bunch of posts
::
=|  count=@ud
|-
;<  =id-note:d  band:m  (add-essay count)
?:  (lth count 30)
  $(count +(count))
::  leave a single comment on the last post
::
;<  now=@da  band:m  get-time:s
=/  =memo:d   [[~ 'hacking is bad' ~] our now]
;<  ~  band:m  (act %diary [our chan] %note %quip id-note %add memo)
::
::  ensure that we've got all the same notes on both sides
::
;<  =notes:d  band:m  (check-note-count +(count))
;<  sst=server-state  band:m  get-diary-state
?>  (eq !>(notes) !>(notes:(~(got by shelf.sst) flag)))
::
::  nuke %diary and re-join the channel.  ensure we only got a partial
::  checkpoint
::
;<  ~  band:m  (poke-our:s %hood %kiln-nuke !>([%diary |]))
;<  ~  band:m  (poke-our:s %hood %kiln-revive !>(%groups))
;<  ~  band:m  (act %diary flag %join [our group])
;<  *  band:m  (check-note-count 20)
::
::  post another essay, ensure we got it
::
=.  count  +(count)
;<  *  band:m  (add-essay count)
;<  *  band:m  (check-note-count 21)
::
;<  ~  band:m  test-revs-of-diary
::
(pure:m !>(%success))
::
++  state         state-2:dl
+$  server-state  [%0 =shelf:d]
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
++  get-diary
  =/  m  (strand ,diary:d)
  ^-  form:m
  ;<  st=state  band:m  get-state
  (pure:m (~(got by shelf.st) flag))
::
++  get-state
  =/  m  (strand ,state)
  ^-  form:m
  ;<  =bowl:spider  band:m  get-bowl:s
  %-  pure:m
  =<  -
  !<  [state epic:e]
  .^  vase
      /gx/(scot %p our.bowl)/diary/(scot %da now.bowl)/dbug/state/noun
  ==
::
++  get-diary-state
  =/  m  (strand ,server-state)
  ^-  form:m
  ;<  =bowl:spider  band:m  get-bowl:s
  %-  pure:m
  =<  -
  !<  [server-state epic:e]
  .^  vase
      /gx/(scot %p our.bowl)/diary-server/(scot %da now.bowl)/dbug/state/noun
  ==
::
++  check-note-count
  |=  count=@ud
  =/  m  (strand ,notes:d)
  ^-  form:m
  ;<  =diary:d  band:m  get-diary
  ?>  (eq !>(count) !>(~(wyt by notes.diary)))
  (pure:m notes.diary)
::
++  add-essay
  |=  count=@ud
  =/  m  (strand ,id-note:d)
  ^-  form:m
  ;<  send=@da  band:m  get-time:s
  =/  =essay:d  [(cat 3 'on hacking #' (scot %ud count)) '' ~ our send]
  ;<  ~  bind:m  (act %diary flag %note %add essay)
  (pure:m send)
::
::  test non-note diary commands
::
++  test-revs-of-diary
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  band:m  (act %diary flag %add-writers %del-role ~ ~)
  ::
  ;<  now=@da  band:m  get-time:s
  ;<  old=diary:d  band:m  get-diary
  ?>  (neq !>(%grid) !>(view.view.old))
  ?>  (neq !>(%alpha) !>(sort.sort.old))
  ?>  (neq !>(&) !>((~(has in writers.perm.perm.old) %add-role)))
  ?>  (neq !>(|) !>((~(has in writers.perm.perm.old) %del-role)))
  ?>  (neq !>(`~[now]) !>(order.order.old))
  ::
  ;<  ~  band:m  (act %diary flag %view %grid)
  ;<  ~  band:m  (act %diary flag %sort %alpha)
  ;<  ~  band:m  (act %diary flag %add-writers %add-role ~ ~)
  ;<  ~  band:m  (act %diary flag %del-writers %del-role ~ ~)
  ;<  ~  band:m  (act %diary flag %order ~ now ~)
  ::
  ;<  new=diary:d  band:m  get-diary
  ?>  (eq !>(%grid) !>(view.view.new))
  ?>  (eq !>(%alpha) !>(sort.sort.new))
  ?>  (eq !>(&) !>((~(has in writers.perm.perm.new) %add-role)))
  ?>  (eq !>(|) !>((~(has in writers.perm.perm.new) %del-role)))
  ?>  (eq !>(`~[now]) !>(order.order.new))
  ::
  ?>  (eq !>(+(rev.view.old)) !>(rev.view.new))
  ?>  (eq !>(+(rev.sort.old)) !>(rev.sort.new))
  ?>  (eq !>(+(+(rev.perm.old))) !>(rev.perm.new))
  ?>  (eq !>(+(rev.order.old)) !>(rev.order.new))
  (pure:m ~)
--

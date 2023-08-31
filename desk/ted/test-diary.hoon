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
;<  ~  bind:m  (poke-our:s %hood %kiln-nuke !>([%groups &]))
;<  ~  bind:m  (sleep:s `@dr`0)
;<  ~  bind:m  (poke-our:s %hood %kiln-revive !>(%groups))
;<  ~  bind:m  (sleep:s `@dr`0)
;<  ~  bind:m
  =/  m  (strand ,~)
  ?.  verb  (pure:m ~)
  ;<  ~  bind:m  (poke-our:s %diary %verb !>(%loud))
  (poke-our:s %diary-server %verb !>(%loud))
;<  ~  bind:m  (group-create group 'hacking' 'hacked' '' '' [%open ~ ~] ~ |)
;<  ~  bind:m  (act %create chan [our group] 'hack week' 'hacking all week' ~ ~)
;<  ~  bind:m  (sleep:s `@dr`0)
::  make a bunch of posts
::
=|  count=@ud
|-
;<  =id-note:d  bind:m  (add-essay count)
?:  (lth count 30)
  $(count +(count))
::  leave a single comment on the last post
::
;<  now=@da  bind:m  get-time:s
=/  =memo:d   [[~ 'hacking is bad' ~] our now]
;<  ~  bind:m  (act %diary [our chan] %note %quip id-note %add memo)
;<  ~  bind:m  (sleep:s `@dr`0)
::
::  ensure that we've got all the same notes on both sides
::
;<  =notes:d  bind:m  (check-note-count +(count))
;<  sst=server-state  bind:m  get-diary-state
?>  (eq !>(notes) !>(notes:(~(got by shelf.sst) flag)))
::
::  nuke %diary and re-join the channel.  ensure we only got a partial
::  checkpoint
::
;<  ~  bind:m  (poke-our:s %hood %kiln-nuke !>([%diary |]))
;<  ~  bind:m  (sleep:s `@dr`0)
;<  ~  bind:m  (poke-our:s %hood %kiln-revive !>(%groups))
;<  ~  bind:m  (sleep:s `@dr`0)
;<  ~  bind:m  (act %diary flag %join [our group])
;<  ~  bind:m  (sleep:s `@dr`0)
;<  *  bind:m  (check-note-count 20)
::
::  post another essay, ensure we got it
::
=.  count  +(count)
;<  *  bind:m  (add-essay count)
;<  ~  bind:m  (sleep:s `@dr`0)
;<  *  bind:m  (check-note-count 21)
::
;<  ~  bind:m  test-revs-of-diary
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
  ;<  st=state  bind:m  get-state
  (pure:m (~(got by shelf.st) flag))
::
++  get-state
  =/  m  (strand ,state)
  ^-  form:m
  ;<  =bowl:spider  bind:m  get-bowl:s
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
  ;<  =bowl:spider  bind:m  get-bowl:s
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
  ;<  =diary:d  bind:m  get-diary
  ?>  (eq !>(count) !>(~(wyt by notes.diary)))
  (pure:m notes.diary)
::
++  add-essay
  |=  count=@ud
  =/  m  (strand ,id-note:d)
  ^-  form:m
  ;<  ~  bind:m  (sleep:s `@dr`0)
  ;<  send=@da  bind:m  get-time:s
  =/  =essay:d  [(cat 3 'on hacking #' (scot %ud count)) '' ~ our send]
  ;<  ~  bind:m  (act %diary flag %note %add essay)
  (pure:m send)
::
::  test changing view
::
++  test-revs-of-diary
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (sleep:s `@dr`0)
  ;<  now=@da  bind:m  get-time:s
  ;<  old=diary:d  bind:m  get-diary
  ?>  (neq !>(%grid) !>(view.view.old))
  ?>  (neq !>(%alpha) !>(sort.sort.old))
  ?>  (neq !>(&) !>((~(has in writers.perm.perm.old) %write-role)))
  ?>  (neq !>(`~[now]) !>(order.order.old))
  ::
  ;<  ~  bind:m  (act %diary flag %view %grid)
  ;<  ~  bind:m  (act %diary flag %sort %alpha)
  ;<  ~  bind:m  (act %diary flag %add-writers %write-role ~ ~)
  ;<  ~  bind:m  (act %diary flag %order ~ now ~)
  ;<  ~  bind:m  (sleep:s `@dr`0)
  ::
  ;<  new=diary:d  bind:m  get-diary
  ?>  (eq !>(%grid) !>(view.view.new))
  ?>  (eq !>(%alpha) !>(sort.sort.new))
  ?>  (eq !>(&) !>((~(has in writers.perm.perm.new) %write-role)))
  ?>  (eq !>(`~[now]) !>(order.order.new))
  ::
  ?>  (eq !>(+(rev.view.old)) !>(rev.view.new))
  ?>  (eq !>(+(rev.sort.old)) !>(rev.sort.new))
  ?>  (eq !>(+(rev.perm.old)) !>(rev.perm.new))
  ?>  (eq !>(+(rev.order.old)) !>(rev.order.new))
  (pure:m ~)
--

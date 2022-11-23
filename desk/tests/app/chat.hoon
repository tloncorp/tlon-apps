/-  e=epic, c=chat
/+  *test
/=  agent  /app/chat
|%
+$  current-state
  $:  %1
      chats=(map flag:c chat:c)
      dms=(map ship dm:c)
      clubs=(map id:club:c club:c)
      drafts=(map whom:c story:c)
      pins=(list whom:c)
      bad=(set ship)
      inv=(set ship)
      voc=(map [flag:c id:c] (unit said:c))
  ==
++  chat-1  [~zod %test]
++  bowl
  |=  run=@ud
  ^-  bowl:gall
  :*  [~zod ~zod %chat]
      [~ ~]
      [run `@uvJ`(shax run) (add (mul run ~s1) *time) [~zod %groups ud+run]]
  ==
--
|%
++  zod  `agent:gall`agent
++  wet  `agent:gall`agent
++  test-epic
  =|  run=@ud
  =|  =create:c
  =|  =flag:c
  =^  mov1  agent
    (~(on-poke agent (bowl run)) %chat-create !>(create(name %test)))
  =^  mova  agent
    =+  =<  .(our ~wet)  (bowl run)
    (~(on-poke agent -) %flag !>(flag(q %test)))
  =^  mov2  agent
    =+  =<  .(our ~wet)  (bowl run)
    (~(on-agent agent -) /epic [%fact %epic !>(`epic:e`0)])
  =.  run  +(run)
  =+  !<([=current-state epic=@ud] on-save:agent)
  ~&  >>  chats+chats.current-state
  :: should be 0
  ~&  >>  epic+epic
  :: should be a resub watch task as the epics match.
  ~&  >>  mov2+mov2
  (expect-eq !>(&) !>(&))
--

/-  g=groups-ver
/+  *test, section=harness-tlon-section-tool
|%
++  lib
  =/  =bowl:gall  *bowl:gall
  ~(. section bowl(eny (shas %section-test 1)))
++  args
  |=  fields=(list [@t json])
  (pairs:enjs:format fields)
++  in
  |=  [id=@tas nest=nest:v8:g]
  `[nest:v8:g channel:v9:g]`[nest %*(. *channel:v9:g section id)]
++  group
  ^-  group:v9:g
  %*  .  *group:v9:g
    section-order  ~[%default %ideas %empty]
    sections
      %-  my
      :~  [%default [['General' '' '' ''] ~[[%chat ~nec %a]]]]
          [%ideas [['Ideas' '' '' ''] ~[[%chat ~nec %b] [%heap ~nec %c]]]]
          [%empty [['Empty' '' '' ''] ~]]
      ==
    channels
      (my ~[(in %default [%chat ~nec %a]) (in %ideas [%chat ~nec %b]) (in %ideas [%heap ~nec %c])])
  ==
++  test-create-section-adds-it-last
  =/  change  (command:lib (args ~[['title' %s 'Plans']]) 'create_section' group)
  ?>  ?=(%& -.change)
  =/  act  p.change
  ?>  ?=(%navigation -.act)
  =/  id  (rear order.a-navigation.act)
  %-  expect
  !>  ?&  =('z' (end 3 id))  =(~[%default %ideas %empty id] order.a-navigation.act)
          =([~ [['Plans' '' '' ''] ~]] (~(get by sections.a-navigation.act) id))
      ==
++  test-order-sections-names-each-once
  =/  run
    |=  order=@t
    (command:lib (args ~[['order' %s order]]) 'order_sections' group)
  %-  expect
  !>  ?&  =([%& %navigation ~ ~[%ideas %default %empty]] (run '["ideas","default","empty"]'))
          ?=([%| *] (run '["ideas","default"]'))
          ?=([%| *] (run '["ideas","ideas","default"]'))
      ==
++  test-delete-only-empty-sections
  =/  run
    |=  id=@t
    (command:lib (args ~[['section' %s id]]) 'delete_section' group)
  %-  expect
  !>  ?&  =([%& %section %empty %del ~] (run 'empty'))
          ?=([%| *] (run 'ideas'))
          ?=([%| *] (run 'default'))
          ?=([%| *] (run 'missing'))
      ==
++  test-move-channel
  =/  run
    |=  fields=(list [@t json])
    (command:lib (args fields) 'move_channel' group)
  =/  b  ['channel' %s 'chat/~nec/b']
  %-  expect
  !>  ?&  .=  [%& %channel [%chat ~nec %b] %section %default]
          (run ~[b ['section' %s 'default']])
          ?=([%| *] (run ~[b ['section' %s 'ideas']]))
          .=  [%& %section %ideas %move-nest [%chat ~nec %b] 1]
          (run ~[b ['section' %s 'ideas'] ['index' %s '1']])
          ?=([%| *] (run ~[b ['section' %s 'ideas'] ['index' %s '2']]))
      ==
++  test-rename-keeps-the-rest-of-the-metadata
  %+  expect-eq
    !>(`(each a-group:v8:g @t)`[%& %section %ideas %edit ['Notes' '' '' '']])
  !>((command:lib (args ~[['section' %s 'ideas'] ['title' %s 'Notes']]) 'rename_section' group))
--

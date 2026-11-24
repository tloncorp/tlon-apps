/-  ct=contacts
/+  *test, channel=harness-tlon-channel-tool, ops=harness-tlon-operations
|%
++  args
  |=  fields=(list [@t json])
  (pairs:enjs:format fields)
++  test-channel-actions
  =/  lib  ~(. channel *bowl:gall)
  %-  expect
  !>  ?&  (handles:lib 'pin_message')  (handles:lib 'forward_message')
          (handles:lib 'join_channel')  !(handles:lib 'send_channel')
      ==
++  test-notebooks-are-refused-before-any-read
  =/  lib  ~(. channel *bowl:gall)
  =/  diary  (args ~[['action' %s 'pin_message'] ['channel' %s 'diary/~nec/notes']])
  =/  result  (run:lib diary /tlon-tool/1 ~2026.9.9)
  %-  expect
  !>  ?&  =(~ effect.result)  =('error: ' (end 3^7 body.result))
          =(~ (mole |.((run:lib (args ~[['action' %s 'pin_message']]) /tlon-tool/1 ~2026.9.9))))
      ==
++  test-metadata-images-and-covers
  =/  lib  ~(. ops *bowl:gall)
  =/  old  ['Old' 'About' 'https://a.example/old.png' '#112233']
  %-  expect
  !>  ?&  .=  ['Old' 'About' 'https://a.example/new.png' '#112233']
          (metadata:lib (args ~[['image' %s 'https://a.example/new.png']]) old)
          ::  Models fill unused arguments with empty strings; those keep values.
          .=  old
          (metadata:lib (args ~[['image' %s ''] ['cover' %s '']]) old)
          =(~ (mole |.((metadata:lib (args ~) old))))
      ==
++  test-refresh-contact-subscribes-without-adding
  =/  lib  ~(. ops *bowl:gall)
  =/  card
    %:  mutation:lib
      (args ~[['action' %s 'refresh_contact'] ['ship' %s '~nec']])
      /w
      ~2026.9.9
      'refresh_contact'
    ==
  ?>  ?=([%pass * %agent [@ %contacts] %poke %contact-action-1 *] card)
  (expect-eq !>(`action:ct`[%meet ~[~nec]]) !>(!<(action:ct +127.card)))
--

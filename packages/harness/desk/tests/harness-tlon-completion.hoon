/-  g=groups-ver, s=story, dv=channels-ver
/+  message-tool=harness-tlon-message-tool
/+  *test, spec=harness-tlon-tool, hp=harness-tlon-history-page, policy=harness-tlon-group-policy,
    media=harness-tlon-media, story=harness-tlon-story
|%
++  test-full-body-search-retains-a-bounded-preview
  =/  text  (cat 3 (crip (reap 900 'a')) ' needle')
  =/  =row:hp  [~2026.9.9 `['id' ~lux ~2026.9.9 text |]]
  =/  page  (scan:hp ~[row] 'needle')
  ?~  messages.page  (expect !>(|))
  (expect !>(&(=(800 (met 3 text.i.messages.page)) clipped.i.messages.page)))
++  test-make-message-keeps-full-searchable-content
  =/  text  (cat 3 (crip (reap 900 'a')) ' suffix')
  =/  message  (make-message:hp 'id' ~lux ~2026.9.9 ~[[%inline ~[text]]])
  (expect-eq !>(text) !>(text.message))
++  test-directory-pagination-beyond-first-hundred
  =/  rows=(list json)  (turn (gulf 1 205) |=(n=@ud (numb:enjs:format n)))
  =/  args  (pairs:enjs:format ~[['offset' %s '100']])
  =/  page  (directory:spec args rows)
  ?>  ?=(%o -.page)
  (expect-eq !>([%a (scag 100 (slag 100 rows))]) !>((~(got by p.page) 'items')))
++  test-directory-offset-is-strict
  =/  args  (pairs:enjs:format ~[['offset' %s '-1']])
  (expect-eq !>(~) !>((mole |.((offset:spec args)))))
++  test-delete-group-requires-host-and-exact-confirmation
  =/  okay
    %-  pairs:enjs:format
    ~[['action' %s 'delete_group'] ['group' %s '~lux/test'] ['confirm' %s '~lux/test']]
  =/  bad
    %-  pairs:enjs:format
    ~[['action' %s 'delete_group'] ['group' %s '~lux/test'] ['confirm' %s '~lux/other']]
  %-  expect
  !>  ?&  =([%delete ~] (manage:policy okay ~lux [~lux %test] *group:v9:g))
          =(~ (mole |.((manage:policy bad ~lux [~lux %test] *group:v9:g))))
          =(~ (mole |.((manage:policy okay ~nec [~lux %test] *group:v9:g))))
      ==
++  test-ban-protects-group-host
  =/  args
    %-  pairs:enjs:format
    ~[['action' %s 'ban_member'] ['ship' %s '~lux'] ['confirm' %s '~lux']]
  (expect-eq !>(~) !>((mole |.((manage:policy args ~lux [~lux %test] *group:v9:g)))))
++  test-general-files-reject-active-mime-and-oversize
  %-  expect
  !>  ?&  (file-valid:media 'text/plain' [4 'test'])  !(file-valid:media 'text/html' [4 'test'])
          !(file-valid:media 'image/svg+xml' [4 'test'])
          !(file-valid:media 'text/plain' [8.388.609 1])
          !(file-valid:media 'application/pdf' [4 'test'])
      ==
++  test-file-mime-parameters-are-normalized
  (expect-eq !>('text/plain') !>((file-type:media 'Text/Plain; charset=utf-8')))
++  test-citations-retain-resolvable-native-identity
  =/  content=story:s  ~[[%block %cite %group ~lux %test]]
  (expect-eq !>('[citation: /1/group/~lux/test]') !>((story-to-text:story content)))
::
++  test-directory-byte-limit-counts-escaped-json-and-keeps-whole-rows
  =/  row=json  [%s (crip (reap 9.000 '"'))]
  =/  first  (directory:spec [%o ~] ~[row row])
  =/  second  (directory:spec (pairs:enjs:format ~[['offset' %s '1']]) ~[row row])
  ?>  ?=(%o -.first)
  ?>  ?=(%o -.second)
  =/  oversized=json  [%s (crip (reap 10.000 '"'))]
  ;:  weld
      (expect-eq !>([%a ~[row]]) !>((~(got by p.first) 'items')))
      (expect-eq !>([%s '1']) !>((~(got by p.first) 'next_offset')))
      (expect-eq !>([%a ~[row]]) !>((~(got by p.second) 'items')))
      (expect-eq !>([%b |]) !>((~(got by p.second) 'has_more')))
      (expect-eq !>(~) !>((mole |.((directory:spec [%o ~] ~[oversized])))))
  ==
::
++  test-message-chunks-preserve-utf8-and-reject-interior-byte-offsets
  =/  prefix  (crip (reap 1.999 'x'))
  =/  text  (cat 3 prefix 'éz')
  =/  =message:hp  ['id' ~lux ~2026.10.1 text |]
  =/  lib  ~(. message-tool *bowl:gall)
  =/  first  (render:lib [%o ~] message)
  =/  next  (render:lib (pairs:enjs:format ~[['offset' %s '1.999']]) message)
  ?>  ?=(%o -.first)
  ?>  ?=(%o -.next)
  =/  invalid  (pairs:enjs:format ~[['offset' %s '2.000']])
  ;:  weld
      (expect-eq !>([%s prefix]) !>((~(got by p.first) 'text')))
      (expect-eq !>([%s '1.999']) !>((~(got by p.first) 'next_offset')))
      (expect-eq !>([%s 'éz']) !>((~(got by p.next) 'text')))
      (expect-eq !>(~) !>((~(got by p.next) 'next_offset')))
      (expect-eq !>(~) !>((mole |.((render:lib invalid message)))))
  ==
::
++  edit-args
  |=  parent=(unit @da)
  ^-  json
  %-  pairs:enjs:format
  %+  weld
    :~  ['action' %s 'edit_message']
        ['channel' %s 'chat/~nec/fixture']
        ['message_id' %s (scot %da ?~(parent ~2026.9.6 ~2026.9.7))]
        ['text' %s 'Edited']
    ==
  ?~(parent ~ ~[['parent' %s (scot %da u.parent)]])
++  edit-fixture
  |=  author=author:v10:dv
  ^-  [post:v10:dv reply:v10:dv]
  =/  =post:v10:dv  *post:v10:dv
  =.  +.+.post  +.+.post(author author, sent ~2026.9.6, content ~[[%inline ~['Post']]])
  =/  =reply:v10:dv  *reply:v10:dv
  =.  +.+.reply  +.+.reply(author author, sent ~2026.9.7, content ~[[%inline ~['Reply']]])
  [post reply]
::  +edit: channel command for an edit of the fixture, or ~ when refused
++  edit
  |=  [args=json author=author:v10:dv]
  ^-  (unit *)
  =/  [=post:v10:dv =reply:v10:dv]  (edit-fixture author)
  =/  attempt
    |.
    =/  card  (change:~(. message-tool *bowl:gall) args /fixture)
    ?>  ?=([%pass * %agent [@ %channels] %poke %channel-action-2 *] card)
    =/  [pass=* wire=* agent=* who=* poke=* mark=* data=vase]  card
    !<(a-channels:v10:dv data)
  =/  checked
    %+  mink  [attempt %9 2 %0 1]
    |=  [ref=* raw=*]
    ^-  (unit (unit noun))
    =/  path  ;;(path raw)
    ?:  ?=([%gu *] path)  ``&
    ?:  =(%channel-posts-5 (rear path))
      ``[(put:on-posts:v10:dv ~ ~2026.9.6 [%& post]) ~ ~ 1 1]
    ?:  =(%channel-replies-5 (rear path))
      ``(put:on-replies:v10:dv ~ ~2026.9.7 [%& reply])
    ~
  ?.  ?=(%0 -.checked)  ~
  `product.checked
++  edited
  |=  [parent=(unit @da) author=author:v10:dv]
  ^-  (unit *)
  =/  [=post:v10:dv =reply:v10:dv]  (edit-fixture author)
  =/  edited=story:s  ~[[%inline ~['Edited']]]
  =/  nest=nest:dv  [%chat ~nec %fixture]
  :-  ~
  ^-  a-channels:v10:dv
  ?~  parent
    [%channel nest %post %edit ~2026.9.6 +.+.post(content edited)]
  [%channel nest %post %reply u.parent %edit ~2026.9.7 +.+.reply(content edited)]
++  test-edits-of-the-bots-own-messages-keep-their-author
  ;:  weld
      %+  expect-eq  !>((edited ~ [~zod ~ ~]))
      !>((edit (edit-args ~) [~zod ~ ~]))
      %+  expect-eq  !>((edited `~2026.9.6 [~zod ~ ~]))
      !>((edit (edit-args `~2026.9.6) [~zod ~ ~]))
      %+  expect-eq  !>((edited ~ ~zod))
      !>((edit (edit-args ~) ~zod))
      %+  expect-eq  !>((edited `~2026.9.6 ~zod))
      !>((edit (edit-args `~2026.9.6) ~zod))
  ==
++  test-edits-of-another-authors-message-are-refused
  ;:  weld
      (expect-eq !>(`(unit *)`~) !>((edit (edit-args ~) ~nec)))
      (expect-eq !>(`(unit *)`~) !>((edit (edit-args `~2026.9.6) ~nec)))
      (expect-eq !>(`(unit *)`~) !>((edit (edit-args ~) [~nec ~ ~])))
      (expect-eq !>(`(unit *)`~) !>((edit (edit-args `~2026.9.6) [~nec ~ ~])))
  ==
--

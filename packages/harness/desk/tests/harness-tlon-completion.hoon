/-  g=groups-ver, s=story
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
--

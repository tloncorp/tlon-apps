::  tests for /lib/workspace-config
::
/+  *test, wc=workspace-config
|%
++  doc
  |=  blob=(unit @t)
  ^-  json
  ?~  blob  ~
  (need (de:json:html u.blob))
++  places  (my ~[[%chat 'chat/~dev/chat']])
++  keep  |=(d=(map @t json) d)
::
++  test-add-kit-to-empty-blob
  =/  out  (edit:wc ~ (add-kit:wc ~nec 'Be kind.' '~dev/kit@1.0.0' places))
  %+  expect-eq
    !>  ^-  json
    %-  pairs:enjs:format
    :~  ['version' n+~.2]
        ['bot' s+'~nec']
        ['instructions' s+'Be kind.']
        :-  'kits'
        :-  %a
        :~  %-  pairs:enjs:format
            :~  ['ref' s+'~dev/kit@1.0.0']
                ['places' (pairs:enjs:format ~[['chat' s+'chat/~dev/chat']])]
            ==
        ==
    ==
  !>((doc (need out)))
::
::  a named bot stays, instructions append, unknown keys survive
::
++  test-add-kit-keeps-what-is-there
  =/  blob  '{"version":2,"bot":"~mine","instructions":"First.","color":"red"}'
  =/  out  (edit:wc `blob (add-kit:wc ~nec 'Second.' '~dev/kit@1.0.0' ~))
  =/  jon  (doc (need out))
  ?>  ?=([%o *] jon)
  ;:  weld
    (expect-eq !>(`s+'~mine') !>((~(get by p.jon) 'bot')))
    (expect-eq !>(`s+'First.\0a\0aSecond.') !>((~(get by p.jon) 'instructions')))
    (expect-eq !>(`s+'red') !>((~(get by p.jon) 'color')))
  ==
::
++  test-set-place
  =/  blob  (need (edit:wc ~ (add-kit:wc ~nec '' '~dev/kit@1.0.0' places)))
  =/  out  (edit:wc blob (set-place:wc '~dev/kit@1.0.0' %log 'notes/~dev/log'))
  =/  jon  (doc (need out))
  ?>  ?=([%o *] jon)
  %+  expect-eq
    !>  ^-  (unit json)
    :-  ~
    :-  %a
    :~  %-  pairs:enjs:format
        :~  ['ref' s+'~dev/kit@1.0.0']
            :-  'places'
            %-  pairs:enjs:format
            ~[['chat' s+'chat/~dev/chat'] ['log' s+'notes/~dev/log']]
        ==
    ==
  !>((~(get by p.jon) 'kits'))
::
::  removing the only thing in the document writes null
::
++  test-del-kit-to-null
  =/  blob  (need (edit:wc ~ (add-kit:wc ~nec '' '~dev/kit@1.0.0' places)))
  =/  out  (edit:wc blob |=(d=(map @t json) ((del-kit:wc '~dev/kit@1.0.0') (~(del by d) 'bot'))))
  (expect-eq !>(`(unit (unit @t))`[~ ~]) !>(out))
::
++  test-refuses-newer-and-foreign
  ;:  weld
    (expect-eq !>(~) !>((edit:wc `'{"version":3}' keep)))
    (expect-eq !>(~) !>((edit:wc `'not json' keep)))
    (expect-eq !>(~) !>((edit:wc `'["version",2]' keep)))
  ==
--

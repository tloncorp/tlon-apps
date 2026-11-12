/-  t=harness-tlon
/+  *test, attachment=harness-tlon-attachment
|%
++  args
  |=  fields=(list [@t json])
  (pairs:enjs:format fields)
++  gallery  `destination:t`[%channel [%heap ~nec %pics] ~]
++  chat  `destination:t`[%channel [%chat ~nec %talk] ~]
++  dm  `destination:t`[%dm ~nec ~]
++  refused
  |=  [fields=(list [@t json]) to=destination:t]
  ?=([%| *] (compose:attachment (args fields) to))
++  test-gallery-link-card
  =/  link  ['link' %s 'https://tlon.io']
  %+  expect-eq
    !>(`(each message:attachment @t)`[%& ~[[%block %link 'https://tlon.io' ~]] ~ ~])
  !>((compose:attachment (args ~[link]) gallery))
++  test-gallery-link-with-title
  =/  composed
    (compose:attachment (args ~[['link' %s 'https://tlon.io'] ['title' %s 'Tlon']]) gallery)
  ?>  ?=(%& -.composed)
  %-  expect
  !>  ?&  =(`['Tlon' '' '' ''] meta.p.composed)
          =(~[[%block %link 'https://tlon.io' (my ~[[%title 'Tlon']])]] content.p.composed)
      ==
++  test-file-and-video-blob-entries
  =/  composed
    %-  compose:attachment
    :_  dm
    %-  args
    :~  ['text' %s 'notes attached']
        ['file' %s 'https://a.example/docs/report%20final.pdf']
        ['video' %s 'https://a.example/v.mp4']
    ==
  ?>  ?=(%& -.composed)
  =/  blob  (need (de:json:html (need blob.p.composed)))
  %+  expect-eq
    !>  ^-  json
        :-  %a
        :~  %-  pairs:enjs:format
            :~  ['type' %s 'file']  ['version' (numb:enjs:format 1)]
                ['fileUri' %s 'https://a.example/docs/report%20final.pdf']  ['size' %n '-1']
                ['name' %s 'report final.pdf']
            ==
            %-  pairs:enjs:format
            :~  ['type' %s 'video']  ['version' (numb:enjs:format 1)]
                ['fileUri' %s 'https://a.example/v.mp4']  ['size' %n '-1']  ['name' %s 'v.mp4']
            ==
        ==
  !>(blob)
++  test-refusals
  %-  expect
  !>  ?&  (refused ~[['link' %s 'https://tlon.io']] chat)
          (refused ~[['link' %s 'https://tlon.io'] ['text' %s 'look']] gallery)
          (refused ~[['file' %s 'http://a.example/f.pdf']] chat)
          (refused ~[['file' %s 'https://user:pw@a.example/f.pdf']] chat)
          (refused ~[['file' %s 'https://a.example/a'] ['video' %s 'https://a.example/b']] gallery)
          (refused ~[['title' %s 'Hi'] ['text' %s 'hello']] chat)
          (refused ~ chat)
          ::  An @ in the path is not a credential.
          !(refused ~[['file' %s 'https://medium.example/@writer/post.pdf']] chat)
      ==
--

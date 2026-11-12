/-  hooks
/+  *test, public-html=harness-tlon-publish-html, hook=harness-tlon-hook-tool,
    publishing=harness-tlon-publish-tool
|%
++  test-public-html-escapes-note-and-title
  =/  page  (page:public-html '<script>title</script>' '<img src=x onerror=alert(1)>' ~)
  %-  expect
  !>  ?&  ?=(^ (find "&lt;script&gt;title&lt;/script&gt;" (trip page)))
          ?=(^ (find "&lt;img" (trip page)))  =(~ (find "<script>" (trip page)))
      ==
++  test-public-html-allows-formatting-and-safe-links
  =/  raw
    '<h2>Heading</h2><p><strong>Bold</strong> <a href="https://example.com">link</a></p><br/>'
  (expect !>(?=(^ (mole |.((page:public-html 'Title' '' `raw))))))
++  test-public-html-rejects-active-content
  =/  samples=(list @t)
    :~  '<script>alert(1)</script>'
        '<img src="https://example.com/p.png" onerror="alert(1)"/>'
        '<a href="javascript:alert(1)">x</a>'
        '<a href="javascript&#58;alert(1)">x</a>'
        '<form action="https://example.com"><input/></form>'
        '<iframe src="https://example.com"></iframe>'
        '<svg><script>alert(1)</script></svg>'
        '<p style="display:none">x</p>'
        '<meta http-equiv="refresh" content="0;url=https://example.com"/>'
    ==
  (expect !>((levy samples |=(raw=@t =(~ (mole |.((page:public-html 'Title' '' `raw))))))))
++  test-public-citations-reject-replies-and-arbitrary-desks
  =/  lib  ~(. publishing *bowl:gall)
  =/  bad=(list @t)
    :~  '/1/desk/~lux/base/file'  '/1/group/~lux/test'  '/1/chan/chat/~lux/test/msg/1/2'
        '/1/chan/notes/~lux/test/note/1'  '/1/chan/chat/~lux/test/msg/001'
        '/1/chan/chat/~lux/test/msg/123.456'
    ==
  %-  expect
  !>  %+  levy
        bad
      |=(raw=@t =(~ (mole |.((reference:lib (pairs:enjs:format ~[['citation' %s raw]]))))))
++  test-public-citations-allow-root-channel-posts
  =/  lib  ~(. publishing *bowl:gall)
  =/  good=(list @t)
    :~  '/1/chan/chat/~lux/test/msg/123456'  '/1/chan/diary/~lux/test/note/1'
        '/1/chan/heap/~lux/test/curio/1'
    ==
  %-  expect
  !>  %+  levy
        good
      |=(raw=@t ?=(^ (mole |.((reference:lib (pairs:enjs:format ~[['citation' %s raw]]))))))
++  test-history-message-target-becomes-native-citation
  =/  lib  ~(. publishing *bowl:gall)
  =/  args
    %-  pairs:enjs:format
    ~[['channel' %s 'chat/~lux/test'] ['message_id' %s (scot %da ~2026.9.9)]]
  =/  ref  (reference:lib args)
  ?>  ?=([%chan * %msg @ ~] ref)
  (expect-eq !>((crip (a-co:co ~2026.9.9))) !>(i.t.wer.ref))
++  test-hook-ids-and-config-are-typed
  =/  lib  ~(. hook *bowl:gall)
  =/  config  (config:lib (pairs:enjs:format ~[['config' %s '{"emoji":"ok","delay":"~m1"}']]))
  %-  expect
  !>  ?&  =('ok' (~(got by config) 'emoji'))  =(~ (mole |.((identifier:lib '123'))))
          =(~ (mole |.((config:lib (pairs:enjs:format ~[['config' %s '{"number":3}']])))))
      ==
++  test-hook-compilation-failure-is-not-success
  =/  lib  ~(. hook *bowl:gall)
  =/  args
    %-  pairs:enjs:format
    ~[['action' %s 'add_hook'] ['title' %s 'Fixture'] ['source' %s 'bad']]
  =/  reply=response:hooks  [%set 0v1 'Fixture' 'bad' ['' '' '' ''] `~[leaf+"bad source"]]
  =/  result  (response:lib args reply)
  (expect !>(&(?=(^ result) =('failed:' (end [3 7] u.result)))))
++  test-hook-stop-response-must-match-origin
  =/  lib  ~(. hook *bowl:gall)
  =/  args
    %-  pairs:enjs:format
    ~[['action' %s 'stop_hook'] ['hook_id' %s '0v1'] ['channel' %s 'chat/~lux/test']]
  =/  wrong  (response:lib args [%rest 0v1 ~])
  =/  right  (response:lib args [%rest 0v1 [%chat ~lux %test]])
  (expect !>(&(=(~ wrong) ?=(^ right))))
::
++  test-hook-edit-result-matches-id-source-and-successful-title
  =/  lib  ~(. hook *bowl:gall)
  =/  args
    %-  pairs:enjs:format
    :~  ['action' %s 'edit_hook']
        ['hook_id' %s '0v1']
        ['title' %s 'Requested']
        ['source' %s 'Requested source']
    ==
  =/  reply=response:hooks
    [%set 0v1 'Requested' 'Requested source' ['' '' '' ''] ~]
  ?>  ?=(%set -.reply)
  =/  failed  reply(name 'Stored', error `~[leaf+"compile error"])
  =/  failure  (response:lib args failed)
  ;:  weld
      (expect !>(?=(^ (response:lib args reply))))
      (expect-eq !>(~) !>((response:lib args reply(id 0v2))))
      (expect-eq !>(~) !>((response:lib args reply(src 'Other source'))))
      (expect-eq !>(~) !>((response:lib args reply(name 'Other title'))))
      ::  A compiler failure can retain the stored title; it still settles as failure.
      (expect !>(&(?=(^ failure) =('failed:' (end [3 7] u.failure)))))
  ==
::
++  test-hook-schedule-result-matches-origin-repeat-and-config
  =/  lib  ~(. hook *bowl:gall)
  =/  args
    %-  pairs:enjs:format
    :~  ['action' %s 'schedule_hook']
        ['hook_id' %s '0v1']
        ['channel' %s 'chat/~lux/test']
        ['schedule' %s '~m1']
        ['config' %s '{"emoji":"ok"}']
    ==
  =/  reply=response:hooks
    [%cron 0v1 [%chat ~lux %test] [~2026.10.1 ~m1] (my ~[['emoji' 'ok']])]
  ?>  ?=(%cron -.reply)
  ;:  weld
      (expect !>(?=(^ (response:lib args reply))))
      (expect-eq !>(~) !>((response:lib args reply(id 0v2))))
      (expect-eq !>(~) !>((response:lib args reply(origin ~))))
      (expect-eq !>(~) !>((response:lib args reply(schedule [~2026.10.1 ~m2]))))
      (expect-eq !>(~) !>((response:lib args reply(schedule ~m1))))
      (expect-eq !>(~) !>((response:lib args reply(config ~))))
  ==
::
++  test-hook-read-retains-native-configuration-and-schedules
  =/  =bowl:gall  *bowl:gall
  =.  bowl  bowl(our ~lux, src ~lux, now ~2026.10.1)
  =/  entry  *hook:hooks
  =.  entry
    %*  .  entry
      id  0v1
      name  'Fixture'
      src  'Source'
      config  (my ~[[[%chat ~lux %test] (my ~[['text' 'ok'] ['noun' [1 2]]])]])
    ==
  =/  current  *hooks:hooks
  =.  current
    %*  .  current
      hooks  (my ~[[0v1 entry]])
      crons  (my ~[[0v1 (my ~[[~ [0v1 [~2026.10.1 ~m1] ~]]])]])
    ==
  =/  args
    (pairs:enjs:format ~[['action' %s 'get_hook'] ['hook_id' %s '0v1']])
  =/  attempt
    |.
    =/  result  (run:~(. hook bowl) args /fixture)
    ?>  ?=(~ effect.result)
    (need (de:json:html body.result))
  =/  checked
    %+  mink  [attempt %9 2 %0 1]
    |=  [ref=* raw=*]
    ^-  (unit (unit noun))
    =/  path  ;;(path raw)
    ?:  =(%$ (rear path))  ``&
    ?:  =(%hook-full (rear path))  ``current
    ~
  ?>  ?=(%0 -.checked)
  =/  result  ;;(json product.checked)
  =/  values
    %-  pairs:enjs:format
    :~  ['text' %s 'ok']
        ['noun' %s (scot %uw (jam [1 2]))]
    ==
  =/  config
    (pairs:enjs:format ~[['channel' %s 'chat/~lux/test'] ['values' values]])
  =/  job
    %-  pairs:enjs:format
    :~  ['channel' ~]
        ['next' %s (scot %da ~2026.10.1)]
        ['repeat' %s '~m1']
    ==
  =/  expected
    %-  pairs:enjs:format
    :~  ['hook' (metadata:~(. hook bowl) entry)]
        ['source' %s 'Source']
        ['next_offset' ~]
        ['configurations' %a ~[config]]
        ['schedules' %a ~[job]]
    ==
  (expect-eq !>(expected) !>(result))
--

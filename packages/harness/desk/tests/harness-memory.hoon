/-  h=harness, m=harness-memory, hh=harness-hand
/+  *test, mem=harness-memory, api=harness-memory-json, hp=harness-provider,
    policy=harness-defaults, anthropic=harness-anthropic
|%
++  fixture
  ^-  view:h
  =/  v=view:h  *view:h
  v(config builtin-config:policy)
++  source
  ^-  source:m
  ['first' 0v1 1 ~2026.10.7 '~zod']
++  saved
  (command:api everything:mem *state:m source 'remember' 'project Keep the project small.')
++  test-commands-share-inspect-correct-and-forget
  =/  saved-result  saved
  =/  db  db.saved-result
  =/  inspected  (command:api everything:mem db source 'memory' 'project')
  =/  edited  (command:api everything:mem db source 'remember' 'project Keep the project modular.')
  =/  forgotten  (command:api everything:mem db.edited source 'forget' 'project')
  =/  bad  (command:api everything:mem db source 'forget' 'project extra')
  =/  found  (find "Keep the project small." (trip body.inspected))
  ;:  weld
      (expect !>(?=(^ edit.saved-result)))
      (expect !>(?=(^ found)))
      (expect-eq !>(2) !>(revision:(~(got by records.db.edited) 'project')))
      (expect-eq !>(~) !>(body.value:(~(got by records.db.forgotten) 'project')))
      (expect-eq !>(db) !>(db.bad))
  ==
++  test-disabled-conversations-cannot-read-or-write
  =/  off  (command:api everything:mem db:saved source 'memory' 'off')
  =/  read  (command:api everything:mem db.off source 'memory' 'project')
  =/  write  (command:api everything:mem db.off source 'remember' 'second Another fact.')
  =/  on  (command:api everything:mem db.off source 'memory' 'on')
  ;:  weld
      (expect-eq !>(db.off) !>(db.read))
      (expect-eq !>(db.off) !>(db.write))
      (expect !>((mem-enabled db.on)))
      (expect-eq !>(1) !>(barrier.db.on))
  ==
++  mem-enabled
  |=(db=state:m (enabled:mem db 'first'))
++  test-memory-is-excluded-from-summary-but-counted-in-turn
  =/  v  fixture
  =/  noted  v(memory (pack:mem everything:mem db:saved ~['project'] 4.096))
  %-  expect
  !>  ?&  =((payload:hp v %compaction ~) (payload:hp noted %compaction ~))
          (gth (est-tokens:hp noted ~ ~) (est-tokens:hp v ~ ~))
      ==
++  test-provider-memory-stays-at-user-authority
  %+  roll
    ^-  (list @t)
    :~  'https://api.openai.com/v1/responses'
        'https://api.anthropic.com/v1/messages'
        'https://openrouter.ai/api/v1/chat/completions'
    ==
  |=  [url=@t failures=tang]
  =/  v  fixture
  =.  v  v(url.config url, memory (pack:mem everything:mem db:saved ~['project'] 4.096))
  =/  body  (payload:hp v %turn ~)
  ?>  ?=(%o -.body)
  =/  input
    %-  need
    (~(get by p.body) ?:(=('https://api.openai.com/v1/responses' url) 'input' 'messages'))
  ?>  ?=(%a -.input)
  =/  expected
    ?:  =('https://api.openai.com/v1/responses' url)
      (responses-message:hp 'user' (reference:mem memory.v))
    =/  chat  (pairs:enjs:format ~[['role' %s 'user'] ['content' %s (reference:mem memory.v)]])
    ?:(=('https://api.anthropic.com/v1/messages' url) (message:anthropic chat) chat)
  (weld failures (expect !>((lien p.input |=(entry=json =(entry expected))))))
++  test-recall-sits-just-before-the-latest-user-message
  %+  roll
    ^-  (list @t)
    :~  'https://api.openai.com/v1/responses'
        'https://api.anthropic.com/v1/messages'
        'https://openrouter.ai/api/v1/chat/completions'
    ==
  |=  [url=@t failures=tang]
  =/  v  fixture
  =/  history=(list item:h)
    :~  [%user 'earlier question']
        [%assistant 'earlier answer' ~]
        [%user 'latest question']
    ==
  =.  v  v(url.config url, items history, memory (pack:mem everything:mem db:saved ~['project'] 4.096))
  =/  body  (payload:hp v %turn ~)
  ?>  ?=(%o -.body)
  =/  input  (need (~(get by p.body) ?:(=('https://api.openai.com/v1/responses' url) 'input' 'messages')))
  ?>  ?=(%a -.input)
  =/  encoded=tape  (trip (en:json:html input))
  =/  position  |=(needle=tape (need (find needle encoded)))
  =/  answer  (position "earlier answer")
  =/  recall  (position "Relevant shared memories")
  =/  latest  (position "latest question")
  (weld failures (expect !>(&((lth answer recall) (lth recall latest)))))
::  A channel and the owner's DM, both on the Tlon hand.
::
++  places
  %-  places:mem
  ^-  (list binding:hh)
  :~  ['tlon' 'chat/~zod/general' 'chan' ~['~nec'] &]
      ['tlon' 'dm/~ten' 'owner-dm' ~['~ten'] &]
  ==
++  test-an-owner-save-onto-a-channel-fact-makes-it-private-and-says-so
  =/  channel  `reach:mem`[| 'chan' places ~ nobody:mem]
  =/  owner  `reach:mem`[& 'owner-dm' places ~ nobody:mem]
  =/  in-channel=source:m  ['chan' 0v1 1 ~2026.10.7 '~nec']
  =/  in-dm=source:m  ['owner-dm' 0v2 1 ~2026.10.8 '~ten']
  =/  shared  (command:api channel *state:m in-channel 'remember' 'standup Standup is at nine.')
  =/  same  (command:api owner db.shared in-dm 'remember' 'standup Standup is at nine.')
  =/  moved  (command:api owner db.shared in-dm 'remember' 'standup Standup is at ten.')
  =/  after  (command:api channel db.moved in-channel 'remember' 'standup Standup is at eleven.')
  =/  read  (command:api channel db.moved in-channel 'memory' 'standup')
  ;:  weld
      (expect-eq !>('Memory saved.') !>(body.shared))
      (expect-eq !>('Memory saved.') !>(body.same))
      (expect-eq !>(db.shared) !>(db.same))
      (expect-eq !>(private:api) !>(body.moved))
      (expect-eq !>('owner-dm') !>(sid.source.value:(~(got by records.db.moved) 'standup')))
      (expect-eq !>(unavailable:mem) !>(body.after))
      (expect-eq !>(db.moved) !>(db.after))
      (expect-eq !>('No matching shared memories.') !>(body.read))
  ==
--

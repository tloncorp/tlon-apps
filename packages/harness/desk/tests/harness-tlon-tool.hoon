/-  t=harness-tlon, a=activity-ver
/+  *test, spec=harness-tlon-tool, contact=harness-tlon-contact-tool, ops=harness-tlon-operations,
    deny=harness-tlon-denial, ht=harness-tools, defaults=harness-defaults, clock=harness-tlon-clock
|%
++  test-catalog-and-independent-grant
  %-  expect
  !>  ?&  =(~[%tlon] (tool-families:ht ~[%tlon]))  (tool-granted:ht 'tlon' default-tools:defaults)
          !(tool-granted:ht 'tlon' ~[%tlon-read %tlon-write])
          =(`%harness-tlon (tool-hand:ht 'tlon'))
          =(~[%tlon] (without-tlon:ht ~[%tlon %tlon-read]))
      ==
++  test-parallel-sending-guidance
  =/  jon  schema:spec
  =/  text  (en:json:html jon)
  %+  expect-eq
    !>([& & & &])
  !>  :*  =(%o -.jon)  (find-sub:ht 'automatically delivered' text)
          (find-sub:ht 'parallel channels' text)
          (find-sub:ht 'Do not use send_dm or send_channel to answer that conversation' text)
      ==
++  test-cross-chat-search-guidance
  =/  text  (en:json:html schema:spec)
  %-  expect
  !>  ?&  (find-sub:ht 'searches this and every other DM, group DM and joined channel at once' text)
          (find-sub:ht 'lcm_search covers only your own sessions' text)
      ==
++  test-tlon-tool-replaces-conversation-search
  =/  both  (en:json:html (tool-defs:ht ~[%tlon %tlon-read]))
  =/  read  (en:json:html (tool-defs:ht ~[%tlon-read]))
  %-  expect
  !>  ?&  !(find-sub:ht '"tlon_search_history"' both)
          !(find-sub:ht '"tlon_history_page"' both)
          (find-sub:ht '"tlon_read_history"' both)
          (find-sub:ht '"tlon_search_history"' read)
      ==
++  test-help-topic-aliases
  %-  expect
  !>  ?&  =((help:spec 'groups') (help:spec 'channels'))
          =((help:spec 'contacts') (help:spec 'profile'))
          =((help:spec 'messages') (help:spec 'history'))
      ==
++  test-identifiers
  %-  expect
  !>  ?&  =([~nec %test] (flag:spec '~nec/test'))
          =([%chat ~nec %test] (nest:spec 'chat/~nec/test'))
          =(~ (mole |.((flag:spec '~nec/test/extra'))))  =(~ (mole |.((ship:spec 'nec'))))
          =(~ (mole |.((slug:spec '../escape'))))
      ==
++  test-explicit-destination-and-thread
  =/  parent  (rap 3 '~nec/' (scot %da ~2026.9.9) ~)
  =/  args  (pairs:enjs:format ~[['ship' %s '~nec'] ['parent' %s parent]])
  =/  ambiguous  (pairs:enjs:format ~[['ship' %s '~nec'] ['channel' %s 'chat/~nec/test']])
  %-  expect
  !>  ?&  =(`destination:t`[%dm ~nec `[~nec ~2026.9.9]] (destination:spec args))
          =(~ (mole |.((destination:spec ambiguous))))  =(~ (mole |.((timestamp:spec '123'))))
          =(~ (mole |.((dm-id:spec '~nec/~2026.9.9/extra'))))
      ==
++  blank-arguments
  ^-  json
  =/  schema  schema:spec
  ?>  ?=(%o -.schema)
  =/  function  (~(got by p.schema) 'function')
  ?>  ?=(%o -.function)
  =/  parameters  (~(got by p.function) 'parameters')
  ?>  ?=(%o -.parameters)
  =/  properties  (~(got by p.parameters) 'properties')
  ?>  ?=(%o -.properties)
  [%o (~(run by p.properties) |=(value=json `json`[%s '']))]
++  test-send-dm-with-empty-unused-arguments
  =/  args  blank-arguments
  ?>  ?=(%o -.args)
  =.  p.args  (~(put by p.args) 'action' [%s 'send_dm'])
  =.  p.args  (~(put by p.args) 'ship' [%s '~malmur-halmex'])
  =.  p.args  (~(put by p.args) 'text' [%s 'Hello!'])
  =/  clean
    %-  pairs:enjs:format
    ~[['action' %s 'send_dm'] ['ship' %s '~malmur-halmex'] ['text' %s 'Hello!']]
  =/  lib  ~(. ops *bowl:gall)
  =/  result  (run:lib args /tlon-tool/1 ~2026.9.9)
  %-  expect
  !>  ?&  ?=(^ effect.result)  =((run:lib clean /tlon-tool/1 ~2026.9.9) result)
          =(`destination:t`[%dm ~malmur-halmex ~] (destination:spec args))
      ==
++  test-send-channel-with-empty-unused-arguments
  =/  args  blank-arguments
  ?>  ?=(%o -.args)
  =.  p.args  (~(put by p.args) 'action' [%s 'send_channel'])
  =.  p.args  (~(put by p.args) 'channel' [%s 'chat/~nec/test'])
  =.  p.args  (~(put by p.args) 'text' [%s 'Hello!'])
  =.  p.args  (~(put by p.args) 'parent' [%s (scot %da ~2026.9.8)])
  =/  clean
    %-  pairs:enjs:format
    :~  ['action' %s 'send_channel']  ['channel' %s 'chat/~nec/test']  ['text' %s 'Hello!']
        ['parent' %s (scot %da ~2026.9.8)]
    ==
  =/  lib  ~(. ops *bowl:gall)
  (expect-eq !>((run:lib clean /tlon-tool/1 ~2026.9.9)) !>((run:lib args /tlon-tool/1 ~2026.9.9)))
++  test-optional-argument-defaults
  =/  args  blank-arguments
  =/  nulls  (pairs:enjs:format ~[['ship' ~] ['channel' ~] ['parent' ~] ['offset' ~]])
  =/  rows=(list json)  ~[[%s 'contact']]
  %-  expect
  !>  ?&  =(0 (offset:spec args))  =(0 (offset:spec nulls))
          =('secret' (string:spec args 'privacy' 'secret' 16))
          =('chat' (string:spec args 'kind' 'chat' 16))  !(has:spec args 'path')
          !(has:spec nulls 'ship')  =((directory:spec [%o ~] rows) (directory:spec args rows))
      ==
++  test-null-unused-destination
  =/  args  (pairs:enjs:format ~[['ship' %s '~nec'] ['channel' ~] ['parent' ~]])
  (expect-eq !>(`destination:t`[%dm ~nec ~]) !>((destination:spec args)))
++  test-empty-arguments-do-not-bypass-validation
  =/  empty  blank-arguments
  =/  bad-offset  (pairs:enjs:format ~[['offset' %s 'abc']])
  =/  bad-type  (pairs:enjs:format ~[['ship' %s '~nec'] ['channel' %b |]])
  =/  null-required  (pairs:enjs:format ~[['text' ~]])
  %-  expect
  !>  ?&  =(~ (mole |.((destination:spec empty))))
          =(~ (mole |.((required:spec empty 'text' 16.384))))
          =(~ (mole |.((required:spec null-required 'text' 16.384))))
          =(~ (mole |.((offset:spec bad-offset))))  =(~ (mole |.((destination:spec bad-type))))
      ==
++  test-empty-content-is-explicit
  =/  args  blank-arguments
  =/  keys=(list @t)
    ~['text' 'title' 'description' 'nickname' 'bio' 'status' 'avatar' 'cover' 'source' 'html']
  =/  okay  (levy keys |=(key=@t &((has:spec args key) =('' (string:spec args key 'fallback' 16)))))
  (expect !>(okay))
++  test-null-profile-fields-are-omitted
  =/  args  (pairs:enjs:format ~[['nickname' ~] ['bio' %s ''] ['avatar' ~]])
  =/  edits  (decode:contact args)
  %-  expect
  !>  ?&  =(1 ~(wyt by edits))  =(`~ (~(get by edits) %bio))  !(~(has by edits) %nickname)
          !(~(has by edits) %avatar)
      ==
++  test-profile-patch-preserves-omitted-fields
  =/  args  (pairs:enjs:format ~[['nickname' %s 'Test'] ['bio' %s '']])
  =/  edits  (decode:contact args)
  =/  okay
    ?&  =(2 ~(wyt by edits))
        =(`[%text 'Test'] (~(get by edits) %nickname))
        =(`~ (~(get by edits) %bio))
        !(~(has by edits) %avatar)
        =(~ (mole |.((decode:contact [%o ~]))))
    ==
  (expect !>(okay))
++  test-profile-validates-image-url
  =/  good  (pairs:enjs:format ~[['avatar' %s 'https://example.com/avatar.png']])
  =/  bad  (pairs:enjs:format ~[['avatar' %s 'javascript:alert(1)']])
  (expect !>(&(?=(^ (mole |.((decode:contact good)))) =(~ (mole |.((decode:contact bad)))))))
++  test-metadata-patch-preserves-image-and-cover
  =/  args  (pairs:enjs:format ~[['title' %s 'New']])
  =/  lib  ~(. ops *bowl:gall)
  %+  expect-eq
    !>(['New' 'Description' 'image' 'cover'])
  !>((metadata:lib args ['Old' 'Description' 'image' 'cover']))
++  test-denial-authentic-addresses
  =/  post=incoming-event:v8:a  [%dm-post [[~nec ~2026.9.9] ~2026.9.9] [%ship ~nec] ~ |]
  ?>  ?=(%dm-post -.post)
  %-  expect
  !>  ?&  =(`~nec (sender:deny ~lux post))  =(~ (sender:deny ~lux post(whom [%ship ~zod])))
          =(~ (sender:deny ~nec post))  =(`~nec (sender:deny ~lux [%dm-invite %ship ~nec]))
      ==
++  test-denial-rate-and-deduplication
  =/  notices=(list notice:t)  ~[[0 ~2026.9.9 'permission-denied' ~nec '~nec' 'event']]
  %-  expect
  !>  ?&  !(allowed:deny (add ~2026.9.9 ~m1) ~nec 'next' notices)
          (allowed:deny (add ~2026.9.9 ~m5) ~nec 'next' notices)
          !(allowed:deny (add ~2026.9.9 ~m5) ~nec 'event' notices)
          (allowed:deny ~2026.9.9 ~bud 'new' notices)
      ==
++  test-denial-global-budget
  =/  notices=(list notice:t)
    (turn (gulf 1 8) |=(n=@ud `notice:t`[n ~2026.9.9 'permission-denied' `@p`n '' '']))
  %-  expect
  !>  ?&  !(allowed:deny ~2026.9.9 ~zod 'fresh' notices)
          (allowed:deny (add ~2026.9.9 ~m1) ~zod 'fresh' notices)
      ==
++  test-denial-channel-addressing
  =/  post=incoming-event:v8:a
    [%post [[~nec ~2026.9.9] ~2026.9.9] [%chat ~bud %test] [~bud %test] ~ |]
  ?>  ?=(%post -.post)
  =/  reply=incoming-event:v8:a
    :*  %reply  [[~nec ~2026.9.9] ~2026.9.9]  [[~lux ~2026.9.8] ~2026.9.8]  [%chat ~bud %test]
        [~bud %test]  ~  |
    ==
  %-  expect
  !>  ?&  =(~ (sender:deny ~lux post))  =(`~nec (sender:deny ~lux post(mention &)))
          =(`~nec (sender:deny ~lux reply))
      ==
++  test-tool-deadline-with-tlon-replies-disabled
  =/  state=state-2:t  *state-2:t
  =.  enabled.policy.state  |
  =.  tool-receipts.state
    %-  my
    ~[[0v1 `tool-receipt:t`[['s' 1 ['c' 'tlon' '{}']] %sending 'pending' ~2026.9.9]]]
  %-  expect
  !>  ?&  !enabled.policy.state  =(`(add ~2026.9.9 ~m1) (deadline:clock ~2026.9.9 state))
          =(~ (deadline:clock ~2026.9.9 state(tool-receipts ~)))
      ==
--

::  Group-DM reads and commands retain native identity and membership checks.
/-  c=chat-ver
/+  *test, club=harness-tlon-club-tool
|%
++  fixture-bowl
  ^-  bowl:gall
  =/  =bowl:gall  *bowl:gall
  bowl(our ~lux, src ~lux, now ~2026.10.1)
++  crew
  ^-  crew:club:v7:c
  [(silt ~[~lux ~bud]) ~ ['Fixture' '' '' ''] %done |]
++  post
  =/  post=writ:v7:c  *writ:v7:c
  =.  id.post  [~lux ~2026.9.6]
  =.  +.post
    +.post(author ~lux, sent ~2026.9.6, content ~[[%inline ~['Parent']]])
  =/  =reply:v7:c  *reply:v7:c
  =.  id.reply  [~bud ~2026.9.7]
  =.  +.reply
    +.reply(author ~bud, sent ~2026.9.7, content ~[[%inline ~['Reply']]])
  =.  replies.post
    (put:on:replies:v7:c replies.post ~2026.9.7 [%& reply])
  post(replies (put:on:replies:v7:c replies.post ~2026.9.8 [%| *tombstone:v7:c]))
++  request
  |=  [args=json members=crew:club:v7:c record=writ:v7:c]
  ^-  [body=@t command=(unit action:club:v7:c)]
  =/  attempt
    |.
    =/  result  (run:~(. club fixture-bowl) args /fixture now:fixture-bowl)
    ?~  effect.result  [body.result ~]
    ?>  ?=([%pass * %agent [@ %chat] %poke %chat-club-action-2 *] u.effect.result)
    =/  [pass=* wire=* agent=* who=* poke=* mark=* data=vase]  u.effect.result
    [body.result `!<(action:club:v7:c data)]
  =/  checked
    %+  mink  [attempt %9 2 %0 1]
    |=  [ref=* raw=*]
    ^-  (unit (unit noun))
    =/  path  ;;(path raw)
    ?:  =(%$ (rear path))  ``&
    ?:  ?=([%gx @ %chat @ %clubs %noun ~] path)  ``(my ~[[0v1 members]])
    ?:  =(%chat-writ-4 (rear path))  ``[%& record]
    ~
  ?>  ?=(%0 -.checked)
  ;;([body=@t command=(unit action:club:v7:c)] product.checked)
++  arguments
  |=  action=@t
  (pairs:enjs:format ~[['action' %s action] ['club' %s '0v1']])
++  with-field
  |=  [args=json key=@t value=@t]
  ?>  ?=(%o -.args)
  args(p (~(put by p.args) key [%s value]))
++  field
  |=  [value=json key=@t]
  ?>  ?=(%o -.value)
  (~(got by p.value) key)
::
++  test-invitations-can-be-answered-before-membership
  =/  crew  crew
  =/  args  (arguments 'accept_club_invite')
  =/  result  (request args crew(team ~, net %invited) post)
  =/  expected=action:club:v7:c
    [0v1 (sham [/fixture now:fixture-bowl]) %team ~lux &]
  ;:  weld
      (expect-eq !>(`expected) !>(command.result))
      (expect-eq !>(~) !>((mole |.((request args crew post)))))
  ==
::
++  test-thread-send-retains-parent-and-requires-current-membership
  =/  crew  crew
  =/  args  (arguments 'send_club')
  =.  args  (with-field args 'parent' (cat 3 '~lux/' (scot %da ~2026.9.6)))
  =.  args  (with-field args 'text' 'Reply')
  =/  result  (request args crew post)
  =/  expected=action:club:v7:c
    :*  0v1
        (sham [/fixture now:fixture-bowl])
        %writ
        [~lux ~2026.9.6]
        %reply
        [~lux now:fixture-bowl]
        ~
        %add
        [[~[[%inline ~['Reply']]] ~lux now:fixture-bowl] ~]
        `now:fixture-bowl
    ==
  ;:  weld
      (expect-eq !>(`expected) !>(command.result))
      (expect-eq !>(~) !>((mole |.((request args crew(team ~) post)))))
      (expect-eq !>(~) !>((mole |.((request args crew(net %invited) post)))))
  ==
::
++  test-deletion-requires-confirmation-authorship-and-membership
  =/  crew  crew
  =/  args  (arguments 'delete_club_message')
  =.  args  (with-field args 'message_id' (cat 3 '~lux/' (scot %da ~2026.9.6)))
  =.  args  (with-field args 'confirm' (cat 3 '~lux/' (scot %da ~2026.9.6)))
  =/  result  (request args crew post)
  =/  expected=action:club:v7:c
    [0v1 (sham [/fixture now:fixture-bowl]) %writ [~lux ~2026.9.6] %del ~]
  =/  other  post
  =.  author.other  ~bud
  ;:  weld
      (expect-eq !>(`expected) !>(command.result))
      (expect-eq !>(~) !>((mole |.((request (with-field args 'confirm' 'wrong') crew post)))))
      (expect-eq !>(~) !>((mole |.((request args crew other)))))
      (expect-eq !>(~) !>((mole |.((request args crew(team ~) post)))))
  ==
::
++  test-thread-history-retains-parent-and-skips-tombstones
  =/  args  (with-field (arguments 'club_history') 'parent' (cat 3 '~lux/' (scot %da ~2026.9.6)))
  =/  result  (request args crew post)
  =/  body  (need (de:json:html body.result))
  =/  messages  (field body 'messages')
  ?>  ?=([%a [* ~]] messages)
  ;:  weld
      (expect-eq !>(~) !>(command.result))
      %+  expect-eq
        !>([%s (cat 3 '~lux/' (scot %da ~2026.9.6))])
      !>((field (field body 'parent') 'message_id'))
      %+  expect-eq
        !>([%s (cat 3 '~bud/' (scot %da ~2026.9.7))])
      !>((field i.p.messages 'message_id'))
      (expect-eq !>([%s 'Reply']) !>((field i.p.messages 'text')))
      (expect-eq !>([%n '2']) !>((field body 'scanned')))
      (expect-eq !>([%b |]) !>((field body 'has_more')))
  ==
--

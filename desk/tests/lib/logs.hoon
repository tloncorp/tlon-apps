/-  l=logs
/+  *test, logs
|%
::  a groups nack as gall delivers it: wire label, spans, the error tag,
::  a commit marker, a stdlib span
::
++  nack-tang
  ^-  tang
  :~  leaf+"watch-ack"
      leaf+"/app/groups/hoon:<[2.150 5].[2.152 41]>"
      leaf+"se-c-join-access-denied"
      leaf+"/app/groups/hoon:<[2.149 5].[2.152 41]>"
      leaf+"/app/groups/hoon:<[319 17].[319 51]>"
      leaf+"'commit 938f0c4'"
      leaf+"/app/groups/hoon:<[277 3].[582 5]>"
      leaf+"/sys/vane/gall/hoon:<[1.863 9].[1.863 37]>"
  ==
++  test-fingerprint-signature
  =/  event=log-event:l
    [%fail %error ~[leaf+"group join with token failed"] nack-tang]
  =/  fpr  (need (fingerprint:logs /gall/groups event))
  ;:  weld
    %+  expect-eq
      !>  '/gall/groups | group join with token failed | se-c-join-access-denied | app/groups>sys/vane/gall'
      !>  sig.fpr
    %+  expect-eq
      !>  8
      !>  (met 3 fp.fpr)
  ==
::  line numbers change between commits; the fingerprint must not
::
++  test-fingerprint-ignores-line-numbers
  =/  a=log-event:l
    [%fail %error ~[leaf+"groups failed"] nack-tang]
  =/  b=log-event:l
    :+  %fail  %error
    :-  ~[leaf+"groups failed"]
    :~  leaf+"watch-ack"
        leaf+"/app/groups/hoon:<[2.191 5].[2.193 41]>"
        leaf+"se-c-join-access-denied"
        leaf+"/app/groups/hoon:<[2.190 5].[2.193 41]>"
        leaf+"'commit 0084cc9'"
        leaf+"/sys/vane/gall/hoon:<[1.870 9].[1.870 37]>"
    ==
  %+  expect-eq
    !>  fp:(need (fingerprint:logs /gall/groups a))
    !>  fp:(need (fingerprint:logs /gall/groups b))
::  %-prefixed tags inside brackets, and gall's "! " prefix
::
++  test-fingerprint-bracketed-tag
  =/  event=log-event:l
    :+  %fail  %error
    :-  ~[leaf+"contacts failed"]
    :~  leaf+"%poke-fail"
        leaf+"! [%bad-agent-take ~.contact ~]"
        leaf+"! /app/groups/hoon:<[2.833 7].[2.834 36]>"
    ==
  %+  expect-eq
    !>  '/gall/groups | contacts failed | bad-agent-take | app/groups'
    !>  sig:(need (fingerprint:logs /gall/groups event))
::  data dumps and multi-word lines are not tags; a tang with no tag still
::  yields a signature from message and file chain
::
++  test-fingerprint-no-tag
  =/  event=log-event:l
    :+  %fail  %warn
    :-  ~[leaf+"context sub nacked, will retry" leaf+"[src=~zod context=/channel/chat/~zod/x try=4]"]
    :~  leaf+"watch-ack"
        leaf+"/app/presence/hoon:<[421 5].[426 84]>"
        leaf+"/app/presence/hoon:<[418 5].[426 84]>"
        leaf+"/sys/vane/gall/hoon:<[1.850 9].[1.850 37]>"
    ==
  %+  expect-eq
    !>  '/gall/presence | context sub nacked, will retry | app/presence>sys/vane/gall'
    !>  sig:(need (fingerprint:logs /gall/presence event))
::
++  test-fingerprint-tell-has-none
  %+  expect-eq
    !>  `(unit [fp=@t sig=@t])`~
    !>  (fingerprint:logs /gall/groups [%tell %warn ~[leaf+"hello"]])
--

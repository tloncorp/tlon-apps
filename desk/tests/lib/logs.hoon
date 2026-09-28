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
    %+  expect-eq
      !>  8
      !>  (met 3 exact.fpr)
  ==
::  line numbers change between commits; fingerprint must not, exact should
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
  =/  fa  (need (fingerprint:logs /gall/groups a))
  =/  fb  (need (fingerprint:logs /gall/groups b))
  ;:  weld
    (expect-eq !>(fp.fa) !>(fp.fb))
    (expect !>(!=(exact.fa exact.fb)))
  ==
::  %-prefixed tags inside brackets keep their knots, and gall's "! " prefix
::  is dropped
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
    !>  '/gall/groups | contacts failed | bad-agent-take/contact | app/groups'
    !>  sig:(need (fingerprint:logs /gall/groups event))
::  a ~| dispatch hint becomes the "where" component, and -have/-need
::  narrows a generic nest-fail
::
++  test-fingerprint-hint-and-detail
  =/  event=log-event:l
    :+  %fail  %error
    :-  ~[leaf+"groups failed"]
    :~  leaf+"%fact"
        leaf+"! take %fact failed, closing subscription"
        leaf+"! nest-fail"
        leaf+"! -have.@p"
        leaf+"! -need.%full"
        leaf+"! /app/groups/hoon:<[1.160 9].[1.160 38]>"
        leaf+"! [%on-agent ~.contact %fact]"
        leaf+"! /app/groups/hoon:<[1.051 5].[1.051 24]>"
        leaf+"! /sys/vane/gall/hoon:<[1.863 9].[1.863 37]>"
    ==
  %+  expect-eq
    !>  '/gall/groups | groups failed | nest-fail | on-agent/contact/fact | -have.@p -need.%full | app/groups>sys/vane/gall'
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
        leaf+"[context=/channel/chat/~zod/x src=~zod]"
        leaf+"/sys/vane/gall/hoon:<[1.850 9].[1.850 37]>"
    ==
  %+  expect-eq
    !>  '/gall/presence | context sub nacked, will retry | app/presence>sys/vane/gall'
    !>  sig:(need (fingerprint:logs /gall/presence event))
::  http failure detail survives, ship names in hints do not
::
++  test-fingerprint-code-detail
  =/  event=log-event:l
    :+  %fail  %error
    :-  ~[leaf+"notify failed"]
    :~  leaf+"%arvo-response"
        leaf+"! /app/notify/hoon:<[712 7].[727 70]>"
        leaf+"! mime='text/plain; charset=utf8'"
        leaf+"! code=500"
        leaf+"! [%on-arvo ~.push ~sampel-palnet]"
        leaf+"! /app/notify/hoon:<[708 7].[727 70]>"
    ==
  %+  expect-eq
    !>  '/gall/notify | notify failed | arvo-response | on-arvo/push | code=500 | app/notify'
    !>  sig:(need (fingerprint:logs /gall/notify event))
::
::  the logging door stamps every event with the ship that caused it
::
++  test-src-attached
  =/  =bowl:gall  *bowl:gall
  =.  src.bowl  ~sampel-palnet
  =/  log  ~(. logs [bowl /logs])
  =/  =card:agent:gall  (tell:log %warn ~[leaf+"hi"] ~)
  ?>  ?=([%pass * %agent * %poke *] card)
  =/  act=a-log:l  !<(a-log:l q.cage.task.q.card)
  ?>  ?=(%log -.act)
  %+  expect-eq
    !>  `(unit json)``s+'~sampel-palnet'
    !>  (~(get by (my data.act)) 'src')
::
++  test-fingerprint-tell-has-none
  %+  expect-eq
    !>  `(unit [fp=@t sig=@t exact=@t])`~
    !>  (fingerprint:logs /gall/groups [%tell %warn ~[leaf+"hello"]])
--

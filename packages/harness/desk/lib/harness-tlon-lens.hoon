::  Tlon addressing and pointer metadata around the shared run projection.
/-  t=harness-tlon, hh=harness-hand
/+  report=harness-run-report, policy=harness-tlon-policy
|%
++  payload
  |=  [base=json to=destination:t observation=observation:hh now=@da]
  ^-  json
  ?>  ?=(%o -.base)
  =/  kind=@t  ?:(?=(%dm -.to) 'dm' 'channel')
  =/  conversation=@t
    ?-  -.to
      %dm  (scot %p who.to)
      %channel  (address:policy [%channel nest.to ~])
    ==
  =/  trigger  ?:(?=(%dm -.to) 'dm' 'unknown')
  =/  details
    %-  pairs:enjs:format
    :~  ['type' %s trigger]
        ['messageId' %s event.observation]
        ['authorShip' %s actor.observation]
        ['conversationId' %s conversation]
        ['conversationKind' %s kind]
        ['receivedAt' (stamp:report at.observation)]
        ['preview' %s (preview:report [%user text.observation])]
    ==
  =/  fields=(list [key=@t value=json])
    :~  ['chatType' `json`[%s kind]]
        ['runKind' `json`[%s 'conversation']]
        ['trigger' `json`[%s trigger]]
        ['triggerDetails' details]
        ['updatedAt' (stamp:report now)]
    ==
  =.  p.base
    |-  ^-  (map @t json)
        ?~  fields  p.base
        $(fields t.fields, p.base (~(put by p.base) key.i.fields value.i.fields))
  ::
  (pairs:enjs:format ~[['schemaVersion' %n '1'] ['lens' base]])
::
++  pointer
  |=  [bot=@p id=@uv blob=(unit @t)]
  ^-  @t
  =/  entries=(list json)
    ?~  blob  ~
    =/  parsed  (de:json:html u.blob)
    ?.  ?=([~ %a *] parsed)  ~
    p.u.parsed
  =/  entry
    %-  pairs:enjs:format
    :~  ['type' %s 'tlon-context-lens']
        ['version' %n '1']
        ['lensId' %s (scot %uv id)]
        ['botShip' %s (scot %p bot)]
    ==
  (en:json:html [%a [entry entries]])
--

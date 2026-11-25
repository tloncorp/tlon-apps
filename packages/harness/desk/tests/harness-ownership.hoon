/-  h=harness, t=harness-tlon, a=activity-ver
/+  *test, ownership=harness-ownership, admin=harness-admin, p=harness-tlon-policy
|%
++  identity
  |=  [our=@p who=@p sponsor=@p other-sponsor=@p]
  ^-  ?
  =/  =bowl:gall  *bowl:gall
  =.  our.bowl  our
  =.  now.bowl  ~2026.9.8
  =/  attempt  |.((sibling:~(. ownership bowl) who))
  =/  out
    %+  mink  [attempt %9 2 %0 1]
    |=  [ref=* raw=*]
    ^-  (unit (unit noun))
    =/  path  ;;(path raw)
    ?.  (lien path |=(part=@ta =(%sein part)))  ~
    ?~  path  ~
    ``?:(=((scot %p our) (rear path)) sponsor other-sponsor)
  ?>  ?=(%0 -.out)
  ;;(? product.out)
++  seed
  |=  [our=@p sponsor=@p initialized=@ud explicit=(unit @p)]
  ^-  [initialized=@ud explicit=(unit @p)]
  =/  =bowl:gall  *bowl:gall
  =.  our.bowl  our
  =.  now.bowl  ~2026.9.8
  =/  attempt  |.((initial-owner:~(. ownership bowl) initialized explicit))
  =/  out  (mink [attempt %9 2 %0 1] |=([* *] ``sponsor))
  ?>  ?=(%0 -.out)
  ;;([initialized=@ud explicit=(unit @p)] product.out)
++  test-sibling-identity-uses-live-sponsorship-not-address-parent
  ::  Numeric ranks make fixtures independent of phonetic formatting. Both
  ::  moon addresses have the same apparent parent; their sponsors may differ.
  =/  moon-a=@p  `@p`0x1.0000.0000
  =/  moon-b=@p  `@p`0x2.0000.0000
  %-  expect
  !>  ?&  (identity moon-a moon-b ~nec ~nec)  !(identity moon-a moon-b ~nec ~bud)
          !(identity moon-a ~nec ~nec ~nec)  !(identity ~nec moon-b ~nec ~nec)
          !(identity moon-a moon-a ~nec ~nec)
      ==
++  test-moon-default-owner-is-actual-sponsor-once
  ;:  weld
      (expect-eq !>([1 `~nec]) !>((seed `@p`0x1.0000.0000 ~nec 0 ~)))
      (expect-eq !>([1 `~bud]) !>((seed `@p`0x1.0000.0000 ~nec 0 `~bud)))
      (expect-eq !>([1 ~]) !>((seed `@p`0x1.0000.0000 ~nec 1 ~)))
      (expect-eq !>([1 ~]) !>((seed ~zod ~nec 0 ~)))
  ==
++  origin
  |=  source=input-source:h
  (origin-as source `~nec)
++  origin-as
  |=  [source=input-source:h actor=(unit @p)]
  ^-  (unit term)
  =/  =event:h  [%input-received [0v1 source actor ~ ~2026.9.8 [%user 'request']]]
  (origin:admin ~[event] ~zod `~nec)
++  test-owner-dm-acp-and-local-poke-administer-but-channels-and-other-dms-do-not
  ;:  weld
      (expect-eq !>(`%tlon) !>((origin [%hand 'b' 'tlon' 'dm/~nec' 'e' '~nec'])))
      (expect-eq !>(`%local) !>((origin-as [%acp 'client'] `~zod)))
      (expect-eq !>(`%local) !>((origin-as [%poke ~zod] `~zod)))
      (expect-eq !>(~) !>((origin [%hand 'b' 'tlon' 'chat/~lux/test' 'e' '~nec'])))
      (expect-eq !>(~) !>((origin-as [%hand 'b' 'tlon' 'dm/~bus' 'e' '~bus'] `~bus)))
  ==
++  test-only-owner-direct-input-has-administrative-provenance
  ;:  weld
      (expect-eq !>(`%peer) !>((origin [%peer ~nec 0v1])))
      (expect-eq !>(~) !>((origin [%peer ~bud 0v1])))
      (expect-eq !>(`%tlon) !>((origin [%hand 'b' 'tlon' 'dm/~nec' 'e' '~nec'])))
      (expect-eq !>(~) !>((origin [%hand 'b' 'tlon' 'group/~nec/channel' 'e' '~nec'])))
      (expect-eq !>(~) !>((origin [%timer %cron])))
      (expect-eq !>(~) !>((origin [%work 0v1])))
  ==
++  test-administrative-correlation-roundtrips-and-rejects-other-clients
  =/  =ticket:admin  ['session' 3 'call']
  ;:  weld
      (expect-eq !>(`ticket) !>((decode:admin (connection:admin ticket))))
      (expect-eq !>(~) !>((decode:admin 'ordinary-client')))
  ==
++  provenance
  |=  log=(list event:h)
  [(origin:admin log ~zod `~nec) (peer-source:admin log) (source-actor:admin log)]
++  test-provenance-stops-at-input-boundary
  =/  received=event:h
    [%input-received [0v1 [%peer ~nec 0v1] `~nec ~ ~2026.9.8 [%user 'request']]]
  =/  marker=event:h  [%input-admitted [%user 'input']]
  =/  command=event:h  [%command-completed 0v2 'work' 'result']
  ;:  weld
      (expect-eq !>([~ ~ ~]) !>((provenance ~)))
      (expect-eq !>([`%peer `~nec `~nec]) !>((provenance ~[command received])))
      (expect-eq !>([~ ~ ~]) !>((provenance ~[command marker received])))
  ==
++  test-provenance-uses-only-the-latest-received-input
  =/  peer=event:h
    [%input-received [0v1 [%peer ~nec 0v1] `~nec ~ ~2026.9.8 [%user 'request']]]
  =/  timer=event:h
    [%input-received [0v2 [%timer %cron] ~ ~ ~2026.9.8 [%user 'scheduled']]]
  =/  hand=event:h
    :*  %input-received
        [0v3 [%hand 'b' 'tlon' 'dm/~nec/topic' 'e' '~nec'] `~nec ~ ~2026.9.8 [%user 'direct']]
    ==
  ;:  weld
      (expect-eq !>([~ ~ ~]) !>((provenance ~[timer peer])))
      (expect-eq !>([`%tlon ~ `~nec]) !>((provenance ~[hand peer])))
  ==
::  With the real ownership gate, the owner rule hears a sibling moon as the
::  speaker, and treats a channel it hosts as the owner's, only while sibling
::  moons count as owners. Every ship here has ~nec as its sponsor.
::
++  heard-as
  |=  [siblings=? speaker=@p host=@p]
  ^-  ?
  =/  =bowl:gall  *bowl:gall
  =.  our.bowl  `@p`0x1.0000.0000
  =.  now.bowl  ~2026.9.8
  =/  =policy:t  [& `~nec ~ %mentions (silt ~[speaker]) ~]
  =/  event=incoming-event:v8:a
    [%post [[speaker ~2026.9.8] ~2026.9.8] [%chat host %test] [host %test] ~[[%inline ~['hello']]] |]
  =/  gate  |=(who=@p (owner:~(. ownership bowl) owner.policy siblings who))
  =/  attempt  |.(?=(^ (normalize-owned:p our.bowl now.bowl policy event gate)))
  =/  out  (mink [attempt %9 2 %0 1] |=([* *] ``~nec))
  ?>  ?=(%0 -.out)
  ;;(? product.out)
++  test-a-sibling-moon-is-an-owner-for-the-owner-rule-only-when-enabled
  =/  sibling=@p  `@p`0x2.0000.0000
  %-  expect
  !>  ?&  (heard-as & sibling ~nec)  !(heard-as | sibling ~nec)
          (heard-as & ~nec sibling)  !(heard-as | ~nec sibling)
      ==
--

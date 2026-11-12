/-  h=harness
/+  *test, ownership=harness-ownership, admin=harness-admin
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
  ^-  (unit term)
  =/  =event:h  [%input-received [0v1 source `~nec ~ ~2026.9.8 [%user 'request']]]
  (origin:admin ~[event] ~zod `~nec)
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
--

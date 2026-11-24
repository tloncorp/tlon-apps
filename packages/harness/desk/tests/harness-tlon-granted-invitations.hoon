::  Native invitation projection with synthetic scries, without a Gall agent.
/-  t=harness-tlon
/+  *test, io=harness-tlon-io, ownership=harness-ownership,
    p=harness-tlon-policy
|%
++  invitations
  |=  [our=@p =policy:t siblings=? invited=(set @p) available=?]
  ^-  (list @p)
  =/  =bowl:gall  *bowl:gall
  =.  bowl  bowl(our our, src our, now ~2026.10.1)
  =/  attempt
    |.
    %-  granted-invitations:~(. io bowl)
    |=  who=@p
    =/  owner  (owner:~(. ownership bowl) owner.policy siblings who)
    ?=(^ (grants-owned:p policy who ~ owner))
  =/  out
    %+  mink  [attempt %9 2 %0 1]
    |=  [ref=* raw=*]
    ^-  (unit (unit noun))
    =/  path  ;;(path raw)
    ?:  =(%$ (rear path))  ``available
    ?:  (lien path |=(part=@ta =(%sein part)))  ``~nec
    ?:  (lien path |=(part=@ta =(%invited part)))  ``invited
    ~
  ?>  ?=(%0 -.out)
  ;;((list @p) product.out)
::
++  owned
  |=  owner=(unit @p)
  ^-  policy:t
  [& owner ~ %mentions ~ ~]
::
++  test-allowed-and-trusted-ships-are-accepted
  =/  =policy:t  (owned `~nec)
  =.  allowed.policy  (silt ~[~bud])
  =.  trusted.policy  (my ~[[~wes ~]])
  %+  expect-eq
    !>((silt ~[~nec ~bud ~wes]))
  !>((silt (invitations ~lux policy | (silt ~[~nec ~bud ~wes ~sev]) &)))
++  test-ships-without-access-stay-pending
  =/  =policy:t  (owned `~nec)
  =.  allowed.policy  (silt ~[~bud])
  ;:  weld
      (expect-eq !>(~[~bud]) !>((invitations ~lux policy | (silt ~[~bud ~sev]) &)))
      (expect-eq !>(`(list @p)`~) !>((invitations ~lux policy | (silt ~[~sev ~wes]) &)))
  ==
++  test-disabled-hand-accepts-no-one
  =/  =policy:t  (owned `~nec)
  =.  allowed.policy  (silt ~[~bud])
  =.  enabled.policy  |
  (expect-eq !>(`(list @p)`~) !>((invitations ~lux policy | (silt ~[~nec ~bud]) &)))
++  test-only-pending-explicit-owner-is-accepted
  (expect-eq !>(~[~nec]) !>((invitations ~lux (owned `~nec) | (silt ~[~nec ~bud]) &)))
++  test-owner-replacement-does-not-accept-previous-owner
  (expect-eq !>(~[~bud]) !>((invitations ~lux (owned `~bud) | (silt ~[~nec ~bud]) &)))
++  test-sibling-owner-opt-in-uses-live-ownership
  =/  our=@p  `@p`0x1.0000.0000
  =/  who=@p  `@p`0x2.0000.0000
  ;:  weld
      (expect-eq !>(~[who]) !>((invitations our (owned ~) & (silt ~[who ~bud]) &)))
      (expect-eq !>(`(list @p)`~) !>((invitations our (owned ~) | (silt ~[who ~bud]) &)))
  ==
++  test-absent-chat-and-empty-invitations-accept-no-one
  =/  =policy:t  (owned `~nec)
  =.  allowed.policy  (silt ~[~bud])
  ;:  weld
      (expect-eq !>(`(list @p)`~) !>((invitations ~lux policy | (silt ~[~nec ~bud]) |)))
      (expect-eq !>(`(list @p)`~) !>((invitations ~lux policy | ~ &)))
  ==
++  test-acceptance-is-one-rsvp-on-the-ship-wire
  =/  =bowl:gall  *bowl:gall
  =.  bowl  bowl(our ~lux, src ~lux, now ~2026.10.1)
  %+  expect-eq
    !>(`card:agent:gall`[%pass /invite/dm/~nec %agent [~lux %chat] %poke %chat-dm-rsvp !>([~nec &])])
  !>((accept-invitation:~(. io bowl) ~nec))
--

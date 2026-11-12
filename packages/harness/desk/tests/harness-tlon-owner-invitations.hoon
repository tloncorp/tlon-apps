::  Native invitation projection with synthetic scries, without a Gall agent.
/-  t=harness-tlon
/+  *test, io=harness-tlon-io, ownership=harness-ownership
|%
++  invitations
  |=  [our=@p explicit=(unit @p) siblings=? invited=(set @p) available=?]
  ^-  (list card:agent:gall)
  =/  =bowl:gall  *bowl:gall
  =.  bowl  bowl(our our, src our, now ~2026.10.1)
  =/  attempt
    |.
    (owner-invitations:~(. io bowl) |=(who=@p (owner:~(. ownership bowl) explicit siblings who)))
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
  ;;((list card:agent:gall) product.out)
++  test-only-pending-explicit-owner-is-accepted
  =/  expected=(list card:agent:gall)
    ~[[%pass /invite/dm/~nec %agent [~lux %chat] %poke %chat-dm-rsvp !>([~nec &])]]
  (expect-eq !>(expected) !>((invitations ~lux `~nec | (silt ~[~nec ~bud]) &)))
++  test-owner-replacement-does-not-accept-previous-owner
  =/  expected=(list card:agent:gall)
    ~[[%pass /invite/dm/~bud %agent [~lux %chat] %poke %chat-dm-rsvp !>([~bud &])]]
  (expect-eq !>(expected) !>((invitations ~lux `~bud | (silt ~[~nec ~bud]) &)))
++  test-sibling-owner-opt-in-uses-live-ownership
  =/  our=@p  `@p`0x1.0000.0000
  =/  who=@p  `@p`0x2.0000.0000
  ;:  weld
      (expect !>(=(1 (lent (invitations our ~ & (silt ~[who ~bud]) &)))))
      (expect-eq !>(`(list card:agent:gall)`~) !>((invitations our ~ | (silt ~[who ~bud]) &)))
  ==
++  test-absent-chat-empty-invitations-and-nonowners-emit-nothing
  ;:  weld
      (expect-eq !>(`(list card:agent:gall)`~) !>((invitations ~lux `~nec | (silt ~[~nec]) |)))
      (expect-eq !>(`(list card:agent:gall)`~) !>((invitations ~lux `~nec | ~ &)))
      (expect-eq !>(`(list card:agent:gall)`~) !>((invitations ~lux ~ | (silt ~[~nec]) &)))
  ==
--

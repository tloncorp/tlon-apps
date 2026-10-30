::  groups-ui unit tests
::
::    exercises the %set-order pin reordering added in TLON-5948. the handler is
::    slot-preserving: it reorders only the pins the payload names (deduped, and
::    intersected with the currently-pinned set), substituting them into the
::    slots they already occupy and leaving every omitted pin fixed in place.
::
/-  u=ui, ct=contacts
/+  *test-agent
/=  groups-ui-agent  /app/groups-ui
|%
++  my-agent  %groups-ui
++  whom-a  `whom:u`[%group ~zod %a]
++  whom-b  `whom:u`[%group ~zod %b]
++  whom-c  `whom:u`[%group ~zod %c]
++  whom-z  `whom:u`[%group ~zod %z]
++  whom-d  `whom:u`[%group ~zod %d]
::
++  do-ui-init
  =/  m  (mare ,(list card:agent:gall))
  ^-  form:m
  (do-init my-agent groups-ui-agent)
::
++  do-pins
  |=  =a-pins:u
  =/  m  (mare ,(list card:agent:gall))
  ^-  form:m
  (do-poke ui-action+!>(`action:u`[%pins a-pins]))
::
++  do-add
  |=  =whom:u
  =/  m  (mare ,(list card:agent:gall))
  ^-  form:m
  (do-pins [%add whom])
::
++  do-set-order
  |=  order=(list whom:u)
  =/  m  (mare ,(list card:agent:gall))
  ^-  form:m
  (do-pins [%set-order order])
::
++  do-del
  |=  =whom:u
  =/  m  (mare ,(list card:agent:gall))
  ^-  form:m
  (do-pins [%del whom])
::
++  get-pins
  =/  m  (mare ,(list whom:u))
  ^-  form:m
  ;<  peek=cage  bind:m  (got-peek /x/pins)
  (pure:m !<((list whom:u) q.peek))
::
++  ex-pins
  |=  expected=(list whom:u)
  =/  m  (mare ,~)
  ^-  form:m
  ;<  pins=(list whom:u)  bind:m  get-pins
  (ex-equal !>(pins) !>(expected))
::
++  seed-abc
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-ui-init
  ;<  *  bind:m  (do-add whom-a)
  ;<  *  bind:m  (do-add whom-b)
  ;<  *  bind:m  (do-add whom-c)
  ::  %add appends in poke order, so the baseline is [a b c]
  (ex-pins ~[whom-a whom-b whom-c])
::  +test-set-order-swaps-in-place: a named subset is reordered into its own
::  slots, with the unnamed pin held fixed.
::
++  test-set-order-swaps-in-place
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  seed-abc
  ::  reorder only {a,c}; b is unnamed and stays in slot 1
  ;<  *  bind:m  (do-set-order ~[whom-c whom-a])
  (ex-pins ~[whom-c whom-b whom-a])
::  +test-set-order-full-reverse: naming every pin fully reorders the list.
::
++  test-set-order-full-reverse
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  seed-abc
  ;<  *  bind:m  (do-set-order ~[whom-c whom-b whom-a])
  (ex-pins ~[whom-c whom-b whom-a])
::  +test-set-order-ignores-unknown-and-dups: ids not currently pinned are
::  dropped, repeats collapse to their first occurrence, and the surviving
::  named subset still only reshuffles its own slots.
::
++  test-set-order-ignores-unknown-and-dups
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  seed-abc
  ::  z is unpinned (ignored); the second c is a dup (collapsed); {b,c} swap
  ;<  *  bind:m  (do-set-order ~[whom-c whom-z whom-c whom-b])
  (ex-pins ~[whom-a whom-c whom-b])
::  +test-set-order-empty-is-noop: an empty order names nothing, so the list is
::  left untouched.
::
++  test-set-order-empty-is-noop
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  seed-abc
  ;<  *  bind:m  (do-set-order ~)
  (ex-pins ~[whom-a whom-b whom-c])
::  +test-set-order-then-add-appends: a new pin still appends at the tail after a
::  reorder (the %add tail-append path is unaffected by %set-order).
::
++  test-set-order-then-add-appends
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  seed-abc
  ;<  *  bind:m  (do-set-order ~[whom-c whom-a])
  ;<  *  bind:m  (ex-pins ~[whom-c whom-b whom-a])
  ;<  *  bind:m  (do-add whom-d)
  (ex-pins ~[whom-c whom-b whom-a whom-d])
::  +test-set-order-then-del-removes: %del still removes the named pin after a
::  reorder, leaving the rest in their reordered positions.
::
++  test-set-order-then-del-removes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  seed-abc
  ;<  *  bind:m  (do-set-order ~[whom-c whom-a])
  ;<  *  bind:m  (ex-pins ~[whom-c whom-b whom-a])
  ;<  *  bind:m  (do-del whom-b)
  (ex-pins ~[whom-c whom-a])
::
::  contact discovery
::
++  faux-scry
  |=  book=(set ship)
  |=  =path
  ^-  (unit vase)
  ?+  path  ~
    [%gu @ %chat @ %$ ~]  `!>(|)
    [%gu @ %pals @ %$ ~]  `!>(|)
  ::
      [%gx @ %contacts @ %v1 %book %contact-book-0 ~]
    `!>(`book:ct`(malt (turn ~(tap in book) |=(=ship [ship *page:ct]))))
  ==
::
++  init-discovery
  |=  book=(set ship)
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (set-scry-gate (faux-scry book))
  ;<  *  bind:m  do-ui-init
  (pure:m ~)
::
++  do-discover
  |=  matches=(list discovered-contact:u)
  =/  m  (mare ,(list card:agent:gall))
  ^-  form:m
  (do-poke ui-discover-contacts+!>(matches))
::
++  ex-save
  |=  [our=ship =ship =contact:ct]
  %^  ex-poke  /discover  [our %contacts]
  [%contact-action-1 !>(`action:ct`[%page ship contact])]
::
++  get-ships
  |=  =path
  =/  m  (mare ,(set ship))
  ^-  form:m
  ;<  peek=cage  bind:m  (got-peek-mocked path)
  (pure:m !<((set ship) q.peek))
::  +test-discover-saves-new-match: a new match is saved once, under its
::  address-book name, and skipped when it is matched again.
::
++  test-discover-saves-new-match
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (init-discovery ~)
  ;<  =bowl:gall  bind:m  get-bowl
  ;<  caz=(list card:agent:gall)  bind:m
    (do-discover ~[[~nec `'Nec'] [~nec `'Nec']])
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-save our.bowl ~nec (~(put by *contact:ct) %nickname text+'Nec'))
    ==
  ;<  caz=(list card:agent:gall)  bind:m  (do-discover ~[[~nec `'Nec']])
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  known=(set ship)  bind:m  (get-ships /x/v1/discovery-known)
  (ex-equal !>(known) !>((sy ~[~nec])))
::  +test-discover-skips-related-ships: saved, hidden and suggested ships are
::  never saved by discovery.
::
++  test-discover-skips-related-ships
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (init-discovery (sy ~[~bus]))
  ;<  *  bind:m  (do-poke ui-hide-contact+!>(~nec))
  ;<  *  bind:m  (do-poke ui-add-contact-suggestions+!>(~[~wes]))
  ;<  caz=(list card:agent:gall)  bind:m
    (do-discover ~[[~bus ~] [~nec ~] [~wes ~]])
  (ex-cards caz ~)
::  +test-discover-empty-name: a match with a blank address-book name is
::  saved without a nickname.
::
++  test-discover-empty-name
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (init-discovery ~)
  ;<  =bowl:gall  bind:m  get-bowl
  ;<  caz=(list card:agent:gall)  bind:m  (do-discover ~[[~nec `'']])
  (ex-cards caz (ex-save our.bowl ~nec ~) ~)
::  +test-removed-discovery-is-suggested: a discovered ship that is not in
::  the address book is suggested until it is hidden.
::
++  test-removed-discovery-is-suggested
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (init-discovery ~)
  ;<  *  bind:m  (do-discover ~[[~nec ~]])
  ;<  suggested=(set ship)  bind:m  (get-ships /x/suggested-contacts)
  ;<  ~  bind:m  (ex-equal !>(suggested) !>((sy ~[~nec])))
  ;<  *  bind:m  (do-poke ui-hide-contact+!>(~nec))
  ;<  suggested=(set ship)  bind:m  (get-ships /x/suggested-contacts)
  (ex-equal !>(suggested) !>(*(set ship)))
::  +test-saved-discovery-is-not-suggested: a discovered ship in the address
::  book is not suggested.
::
++  test-saved-discovery-is-not-suggested
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (init-discovery ~)
  ;<  *  bind:m  (do-discover ~[[~nec ~]])
  ;<  ~  bind:m  (set-scry-gate (faux-scry (sy ~[~nec])))
  ;<  suggested=(set ship)  bind:m  (get-ships /x/suggested-contacts)
  (ex-equal !>(suggested) !>(*(set ship)))
::  +test-discover-rejects-foreign-ship: only our own ship may record
::  discoveries.
::
++  test-discover-rejects-foreign-ship
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (init-discovery ~)
  (ex-fail ((do-as ~nec) (do-discover ~[[~nec ~]])))
::  +test-load-state-3: the migration keeps suggestions and pins and starts
::  with nothing discovered.
::
++  test-load-state-3
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (init-discovery ~)
  ;<  *  bind:m
    %+  do-load  groups-ui-agent
    `!>([%3 (sy ~[~nec]) (sy ~[~wes]) ~[whom-a] |])
  ;<  hidden=(set ship)  bind:m  (get-ships /x/hidden-contact-suggestions)
  ;<  ~  bind:m  (ex-equal !>(hidden) !>((sy ~[~nec])))
  ;<  suggested=(set ship)  bind:m  (get-ships /x/suggested-contacts)
  ;<  ~  bind:m  (ex-equal !>(suggested) !>((sy ~[~wes])))
  ;<  ~  bind:m  (ex-pins ~[whom-a])
  ;<  =bowl:gall  bind:m  get-bowl
  ;<  caz=(list card:agent:gall)  bind:m  (do-discover ~[[~bus ~]])
  (ex-cards caz (ex-save our.bowl ~bus ~) ~)
--

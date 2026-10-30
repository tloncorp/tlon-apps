::  groups-ui unit tests
::
::    exercises the %set-order pin reordering added in TLON-5948. the handler is
::    slot-preserving: it reorders only the pins the payload names (deduped, and
::    intersected with the currently-pinned set), substituting them into the
::    slots they already occupy and leaving every omitted pin fixed in place.
::
/-  u=ui
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
++  peek-ui
  |=  =path
  =/  m  (mare ,cage)
  ;<  cards=(list card)  bind:m
    %-  do
    |=  s=state
    =/  peek=(unit (unit cage))
      (~(on-peek agent.s bowl.s) path)
    ?>  ?=([~ ~ *] peek)
    [~[[%give %fact ~[/test-peek] u.u.peek]] agent.s]
  ?>  ?=(^ cards)
  =/  card  i.cards
  ?>  ?=([%give %fact *] card)
  (pure:m cage.p.card)
::
++  test-suggest-contact
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  =bowl  bind:m  get-bowl
  ;<  ~  bind:m  (set-src our.bowl)
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =(pole knot)
    ?+  pole  ~
      [%gu @ ?(%chat %pals) @ %$ ~]  `!>(|)
      [%gx @ %contacts @ %v1 %declined %noun ~]  `!>(*(set ship))
    ==
  ;<  *  bind:m  do-ui-init
  ;<  *  bind:m  (do-poke ui-hide-contact+!>(~sun))
  ;<  *  bind:m  (do-poke ui-suggest-contact+!>(~sun))
  ;<  peek=cage  bind:m  (peek-ui /x/hidden-contact-suggestions)
  ;<  ~  bind:m  (ex-equal q.peek !>(*(set ship)))
  ;<  peek=cage  bind:m  (peek-ui /x/suggested-contacts)
  ;<  ~  bind:m  (ex-equal q.peek !>((silt ~[~sun])))
  ;<  *  bind:m  (do-poke ui-suggest-contact+!>(~sun))
  ;<  peek=cage  bind:m  (peek-ui /x/suggested-contacts)
  ;<  ~  bind:m  (ex-equal q.peek !>((silt ~[~sun])))
  ;<  *  bind:m  (do-poke ui-hide-contact+!>(~sun))
  ;<  peek=cage  bind:m  (peek-ui /x/suggested-contacts)
  ;<  ~  bind:m  (ex-equal q.peek !>(*(set ship)))
  ;<  ~  bind:m  (set-src ~nec)
  (ex-fail (do-poke ui-suggest-contact+!>(~sun)))

::
++  test-declined-suggestion-stays-hidden
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  =bowl  bind:m  get-bowl
  ;<  ~  bind:m  (set-src our.bowl)
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =(pole knot)
    ?+  pole  ~
      [%gu @ ?(%chat %pals) @ %$ ~]  `!>(|)
      [%gx @ %contacts @ %v1 %declined %noun ~]  `!>((silt ~[~sun]))
    ==
  ;<  *  bind:m  do-ui-init
  ;<  *  bind:m  (do-poke ui-add-contact-suggestions+!>(~[~sun ~nec]))
  ;<  *  bind:m  (do-poke ui-hide-contact+!>(~sun))
  ;<  *  bind:m  (do-poke ui-suggest-contact+!>(~sun))
  ;<  peek=cage  bind:m  (peek-ui /x/hidden-contact-suggestions)
  ;<  ~  bind:m  (ex-equal q.peek !>((silt ~[~sun])))
  ;<  peek=cage  bind:m  (peek-ui /x/suggested-contacts)
  (ex-equal q.peek !>((silt ~[~nec])))

::
++  test-suggestion-during-contacts-upgrade
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  =bowl  bind:m  get-bowl
  ;<  ~  bind:m  (set-src our.bowl)
  ;<  ~  bind:m  (set-scry-gate |=(=(pole knot) ~))
  ;<  *  bind:m  do-ui-init
  ;<  *  bind:m  (do-poke ui-hide-contact+!>(~sun))
  ;<  *  bind:m  (do-poke ui-suggest-contact+!>(~sun))
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =(pole knot)
    ?+  pole  ~
      [%gu @ ?(%chat %pals) @ %$ ~]  `!>(|)
      [%gx @ %contacts @ %v1 %declined %noun ~]  `!>(*(set ship))
    ==
  ;<  peek=cage  bind:m  (peek-ui /x/suggested-contacts)
  (ex-equal q.peek !>((silt ~[~sun])))

--

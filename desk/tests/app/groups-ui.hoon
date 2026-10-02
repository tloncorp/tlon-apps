::  groups-ui unit tests
::
::    exercises the %set-order pin reordering added in TLON-5948. the handler is
::    slot-preserving: it reorders only the pins the payload names (deduped, and
::    intersected with the currently-pinned set), substituting them into the
::    slots they already occupy and leaving every omitted pin fixed in place.
::
/-  u=ui, co=contacts
/+  *test-agent
/=  groups-ui-agent  /app/groups-ui
|%
++  my-agent  %groups-ui
::  The verb wrapper also emits diagnostic facts; assert external effects.
++  pass-cards
  |=  cards=(list card:agent:gall)
  (skim cards |=(c=card:agent:gall ?=(%pass -.c)))
::  Retirement migration: only the queued wake may scry Eyre.
++  retirement-scry
  |=  p=path
  ^-  (unit vase)
  ?+  p  ~
    [%e @ %cache @ ~]
      =/  cache=(map @t [@ud (unit cache-entry:eyre)])  ~
      =.  cache  (~(put by cache) '/profile' [1 `*cache-entry:eyre])
      =.  cache  (~(put by cache) '/profile/style.css' [1 `*cache-entry:eyre])
      =.  cache  (~(put by cache) '/profile?keep=1' [1 `*cache-entry:eyre])
      =.  cache  (~(put by cache) '/profile.html' [1 `*cache-entry:eyre])
      =.  cache  (~(put by cache) '/profile.html?keep=1' [1 `*cache-entry:eyre])
      =.  cache  (~(put by cache) '/expose/post' [1 `*cache-entry:eyre])
      =.  cache  (~(put by cache) '/profile-other' [1 `*cache-entry:eyre])
      =.  cache  (~(put by cache) '/expose-other?next=/profile' [1 `*cache-entry:eyre])
      =.  cache  (~(put by cache) '/notes/page' [1 `*cache-entry:eyre])
      =.  cache  (~(put by cache) '/expose/already-cleared' [2 ~])
      `!>(cache)
    [%e @ %bindings @ ~]
      =/  bindings=(list [binding:eyre duct action:eyre])
        :~  [[~ /profile] ~ [%app %profile]]
            [[~ /expose] ~ [%app %expose]]
            [[~ /notes] ~ [%app %notes]]
        ==
      `!>(bindings)
  ==
::
++  test-retirement-load-is-deferred
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-ui-init
  ::  Any scry during load fails: no mock is installed yet.
  ;<  cards=(list card:agent:gall)  bind:m
    (do-load groups-ui-agent `!>([%3 *(set ship) *(set ship) *(list whom:u) |]))
  ;<  bowl=bowl:gall  bind:m  get-bowl
  =/  expected=(list card:agent:gall)
    ~[[%pass /retired-public-pages %arvo %b %wait now.bowl]]
  (ex-equal !>(expected) !>((pass-cards cards)))
::
++  test-retirement-cleans-only-retired-resources
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-ui-init
  ;<  ~  bind:m  (set-scry-gate retirement-scry)
  ;<  cards=(list card:agent:gall)  bind:m
    (do-arvo /retired-public-pages [%behn %wake ~])
  ;<  bowl=bowl:gall  bind:m  get-bowl
  =/  patch=action:co  [%self (~(put by *contact:co) %expose-cites ~)]
  =/  expected=(list card:agent:gall)
    :~  [%pass /retired-public-pages %arvo %e %set-response '/profile' ~]
        [%pass /retired-public-pages %arvo %e %set-response '/profile/style.css' ~]
        [%pass /retired-public-pages %arvo %e %set-response '/profile?keep=1' ~]
        [%pass /retired-public-pages %arvo %e %set-response '/profile.html' ~]
        [%pass /retired-public-pages %arvo %e %set-response '/profile.html?keep=1' ~]
        [%pass /retired-public-pages %arvo %e %set-response '/expose/post' ~]
        [%pass /retired-public-pages/routes %arvo %e %connect [~ /profile] %groups-ui]
        [%pass /retired-public-pages/routes %arvo %e %connect [~ /expose] %groups-ui]
        [%pass /retired-public-pages %agent [our.bowl %contacts] %poke contact-action-1+!>(patch)]
    ==
  (ex-equal !>((sy expected)) !>((sy (pass-cards cards))))
::
++  test-retirement-completion-survives-load
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-ui-init
  ;<  ~  bind:m  (set-scry-gate retirement-scry)
  ;<  *  bind:m  (do-arvo /retired-public-pages [%behn %wake ~])
  ;<  bowl=bowl:gall  bind:m  get-bowl
  ;<  *  bind:m
    (do-agent /retired-public-pages [our.bowl %contacts] [%poke-ack ~])
  ;<  cards=(list card:agent:gall)  bind:m  (do-load groups-ui-agent ~)
  ;<  ~  bind:m  (ex-equal !>(*(list card:agent:gall)) !>((pass-cards cards)))
  ;<  cards=(list card:agent:gall)  bind:m
    (do-arvo /retired-public-pages [%behn %wake ~])
  (ex-equal !>(*(list card:agent:gall)) !>((pass-cards cards)))
::
++  test-retirement-with-empty-cache-still-clears-metadata
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-ui-init
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(~)))
  ;<  cards=(list card:agent:gall)  bind:m
    (do-arvo /retired-public-pages [%behn %wake ~])
  ;<  bowl=bowl:gall  bind:m  get-bowl
  =/  patch=action:co  [%self (~(put by *contact:co) %expose-cites ~)]
  =/  expected=(list card:agent:gall)
    ~[[%pass /retired-public-pages %agent [our.bowl %contacts] %poke contact-action-1+!>(patch)]]
  (ex-equal !>(expected) !>((pass-cards cards)))
::
++  test-retirement-nack-retries
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-ui-init
  ;<  ~  bind:m  (set-scry-gate retirement-scry)
  ;<  *  bind:m  (do-arvo /retired-public-pages [%behn %wake ~])
  ;<  bowl=bowl:gall  bind:m  get-bowl
  ;<  cards=(list card:agent:gall)  bind:m
    (do-agent /retired-public-pages [our.bowl %contacts] [%poke-ack `~])
  =/  expected=(list card:agent:gall)
    ~[[%pass /retired-public-pages %arvo %b %wait (add now.bowl ~s30)]]
  (ex-equal !>(expected) !>((pass-cards cards)))
::
++  test-retirement-disconnects-after-binding-ack
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-ui-init
  ;<  cards=(list card:agent:gall)  bind:m
    (do-arvo /retired-public-pages/routes [%eyre %bound & [~ /profile]])
  =/  expected=(list card:agent:gall)
    ~[[%pass /retired-public-pages/routes %arvo %e %disconnect [~ /profile]]]
  (ex-equal !>(expected) !>((pass-cards cards)))
::
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
--

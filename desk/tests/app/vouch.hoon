::  tests for %vouch, the moon-classification store
::
::    covers: local %vouch-learn records a classification; unknown moons
::    scry as %unknown; a foreign %vouch-real is accepted only from the
::    moon's sponsor; a foreign %vouch-learn is rejected.
::
/-  v=vouch
/+  *test-agent
/=  agent  /app/vouch
|%
++  dap  %vouch
::  a moon (2^32) and its fixed sponsor, derived the same way the agent does
::
++  moon      `@p`(bex 32)
++  parent    (^sein:title moon)
++  stranger  ~ten
::  jael mocks for the sponsor-side keys check: no keys registered for any
::  ship, or keys registered (rift 0) for every ship
::
++  no-keys-scries
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%j @ %ryft @ @ ~] path)
    `!>(`(unit rift)`~)
  ~
++  keyed-scries
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%j @ %ryft @ @ ~] path)
    `!>(`(unit rift)`[~ 0])
  ~
::
::  a local %vouch-learn records the classification; scry reflects it
::
++  test-learn-local
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod)))
  ;<  *  bind:m  (do-poke %vouch-learn !>([moon %bot]))
  (ex-scry-result /x/status/(scot %p moon) !>(`status:v`%bot))
::
::  an unrecorded, unspawned moon of ours scries as %unknown
::
++  test-unknown-default
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (set-scry-gate no-keys-scries)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod)))
  (ex-scry-result /x/status/(scot %p moon) !>(`status:v`%unknown))
::
::  jael-backed classification: an unrecorded moon of OURS that has keys in
::  jael must be real -- steward records %bot BEFORE registering keys, so
::  keys-without-a-%bot-record can only come from |moon
::
++  test-own-keyed-moon-is-real
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (set-scry-gate keyed-scries)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod)))
  (ex-scry-result /x/status/(scot %p moon) !>(`status:v`%real))
::
::  the jael fallback never overrides a recorded %bot
::
++  test-keyed-minted-bot-stays-bot
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (set-scry-gate keyed-scries)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod)))
  ;<  *  bind:m  (do-poke %vouch-learn !>([moon %bot]))
  (ex-scry-result /x/status/(scot %p moon) !>(`status:v`%bot))
::
::  the jael fallback only speaks for OUR OWN moons -- another ship's moon
::  having keys proves nothing we may attest to
::
++  test-foreign-keyed-moon-stays-unknown
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (set-scry-gate keyed-scries)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~bus, src ~bus)))
  (ex-scry-result /x/status/(scot %p moon) !>(`status:v`%unknown))
::
::  a foreign %vouch-real from the moon's sponsor is accepted
::
++  test-real-from-sponsor
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~bus)))
  ;<  *  bind:m  (set-src parent)
  ;<  *  bind:m  (do-poke %vouch-real !>(moon))
  (ex-scry-result /x/status/(scot %p moon) !>(`status:v`%real))
::
::  a foreign %vouch-real from a non-sponsor is rejected
::
++  test-real-from-stranger
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~bus)))
  ;<  *  bind:m  (set-src stranger)
  (ex-fail (do-poke %vouch-real !>(moon)))
::
::  a foreign %vouch-learn (not from our ship) is rejected
::
++  test-learn-foreign-rejected
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~zod)))
  ;<  *  bind:m  (set-src stranger)
  (ex-fail (do-poke %vouch-learn !>([moon %real])))
--

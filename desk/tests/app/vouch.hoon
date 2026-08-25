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
::  an unrecorded moon scries as %unknown
::
++  test-unknown-default
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod)))
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

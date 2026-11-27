::  test-agent: tests for the agent testing library
::
::    +on-peek must run under the test's scry gate, like every other step.
::
/+  *test-agent
!:
::
|%
::  an agent that asks whether %other is running, on poke and on peek
::
++  scrier
  ^-  agent:gall
  |_  =bowl:gall
  +*  this  .
  ++  on-init   `this
  ++  on-save   !>(~)
  ++  on-load   |=(vase `this)
  ++  on-poke
    |=  [mark vase]
    =/  live  .^(? %gu /(scot %p our.bowl)/other/(scot %da now.bowl)/$)
    [[%give %fact ~[/live] %noun !>(live)]~ this]
  ++  on-watch  |=(path `this)
  ++  on-leave  |=(path `this)
  ++  on-peek
    |=  path
    ``noun+!>(.^(? %gu /(scot %p our.bowl)/other/(scot %da now.bowl)/$))
  ++  on-agent  |=([wire sign:agent:gall] `this)
  ++  on-arvo   |=([wire sign-arvo] `this)
  ++  on-fail   |=([term tang] `this)
  --
::
++  setup
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod)))
  ;<  *  bind:m  (do-init %scrier scrier)
  (jab-bowl |=(b=bowl b(now ~2026.1.1)))
::
++  test-poke-scry-uses-the-gate
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(&)))
  ;<  caz=(list card)  bind:m  (do-poke %noun !>(~))
  (ex-cards caz (ex-fact ~[/live] %noun !>(&)) ~)
::
++  test-peek-scry-uses-the-gate
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(&)))
  ;<  =cage  bind:m  (got-peek /x/live)
  (ex-equal q.cage !>(&))
::
::  an unanswered scry fails the step instead of reaching the real ship
::
++  test-unanswered-peek-scry-fails-the-step
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (set-scry-gate |=(path ~))
  (ex-fail (got-peek /x/live))
--

::  tests for %presence
::
::    focused on expiry-timer behavior on the subscriber's ship: every
::    incoming %set fact arms its own expiry timer without cancelling
::    prior ones, so a wake from a stale timer must not delete presence
::    that fresher %sets have kept alive.
::
/-  p=presence
/+  *test-agent
/=  agent  /app/presence
|%
++  dap   %presence
++  t0    ~2024.1.1
++  host  ~ten
::  we are ~zod, in a dm with ~ten. the host (~ten) keys the dm context
::  by the subscriber, /dm/~zod; on receipt we translate it to /dm/~ten.
::
++  sub-wire     `wire`/context/dm/(scot %p ~zod)
++  expire-wire  `wire`/expire/(scot %p host)/computing/dm/(scot %p host)
++  key-theirs   `key:p`[/dm/(scot %p ~zod) host %computing]
++  key-ours     `key:p`[/dm/(scot %p host) host %computing]
++  display      `display:p`[~ `'Thinking...' ~]
::
++  setup
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod)))
  ;<  *  bind:m  (do-init dap agent)
  ::  register our outgoing subscription to the dm host,
  ::  so the harness accepts incoming %facts on the context wire
  ::
  ;<  ~  bind:m
    %-  jab-bowl
    |=  b=bowl
    b(now t0, wex (~(put by wex.b) [sub-wire host dap] [& /v1/(scot %p ~zod)]))
  (pure:m ~)
::
::  an incoming %set fact from the host, timeout ~ (default %computing ~m1)
::
++  do-set-fact
  |=  since=@da
  =/  m  (mare ,(list card))
  ^-  form:m
  %+  do-agent  sub-wire
  :-  [host dap]
  [%fact %presence-update-1 !>(`update-1:p`[%set key-theirs [since ~] display])]
::
++  do-wake
  (do-arvo expire-wire [%behn %wake ~])
::
::  a %set fact stores the (translated) entry, gives %here, arms a timer
::
++  test-set-fact-stores-and-arms-timer
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m  (do-set-fact t0)
  %+  ex-cards  caz
  :~  (ex-fact ~[/v1] %presence-response-1 !>(`response-1:p`[%here key-ours [t0 ~] display]))
      (ex-arvo expire-wire [%b %wait (add t0 ~m1)])
  ==
::
::  a stale timer's wake must not delete presence refreshed by a later %set;
::  once the entry has truly expired, the wake deletes it and gives %gone
::
++  test-stale-expire-preserves-fresh-presence
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (do-set-fact t0)
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now (add t0 ~s30))))
  ;<  *  bind:m  (do-set-fact (add t0 ~s30))
  ::  first timer fires at t0+60s. the second %set keeps the entry
  ::  fresh until t0+90s, so this wake must be a no-op.
  ::
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now (add t0 ~s61))))
  ;<  caz=(list card)  bind:m  do-wake
  ;<  ~  bind:m  (ex-cards caz ~)
  ::  second timer fires at t0+90s. the entry has truly expired,
  ::  so this wake deletes it and notifies subscribers.
  ::
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now (add t0 ~s91))))
  ;<  caz=(list card)  bind:m  do-wake
  %+  ex-cards  caz
  [(ex-fact ~[/v1] %presence-response-1 !>(`response-1:p`[%gone key-ours]))]~
::
::  a wake for an entry we no longer have (eg cleared early) is a no-op
::
++  test-expire-wake-without-entry-is-noop
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now (add t0 ~m5))))
  ;<  caz=(list card)  bind:m  do-wake
  (ex-cards caz ~)
--

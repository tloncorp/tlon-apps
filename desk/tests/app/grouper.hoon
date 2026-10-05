/-  reel
/+  *test-agent, test
/=  grouper-agent  /app/grouper
|%
++  dap  %grouper-test
+$  state-2  [%2 enabled-groups=(set cord) outstanding-pokes=(set (pair ship cord))]
::  +test-load-imports: old state is handed to %reel
::
::  loading pre-forwarder state pokes %reel with it and drops the old
::  bite subscription. the import is kept until %reel acks it.
::
++  test-load-imports
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(our ~sampel-palnet)))
  ;<  =bowl  bind:m  get-bowl
  ;<  *  bind:m  (do-init dap grouper-agent)
  =/  old=state-2  [%2 (sy 'sunrise' ~) (sy [~zod 'x'] ~)]
  ;<  caz=(list card)  bind:m  (do-load grouper-agent `!>(old))
  =/  imp  [%import-grouper (sy 'sunrise' ~) (sy [~zod 'x'] ~)]
  ;<  ~  bind:m
    (ex-cards caz ~[(ex-poke /import [our.bowl %reel] %noun !>(imp))])
  ;<  *  bind:m  (do-agent /import [our.bowl %reel] %poke-ack `~[leaf+"nope"])
  ;<  save=vase  bind:m  get-save
  ;<  ~  bind:m  (ex-equal save !>([%3 `[(sy 'sunrise' ~) (sy [~zod 'x'] ~)]]))
  ;<  *  bind:m  (do-agent /import [our.bowl %reel] %poke-ack ~)
  ;<  save=vase  bind:m  get-save
  (ex-equal save !>([%3 ~]))
::  +test-forward: pokes reach %reel with their sender
::
::  local pokes are passed on as-is. a remote ask is wrapped so %reel
::  answers the asker. remote pokes outside the protocol are refused.
::
++  test-forward
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(our ~sampel-palnet)))
  ;<  =bowl  bind:m  get-bowl
  ;<  *  bind:m  (do-init dap grouper-agent)
  ;<  ~  bind:m  (set-src our.bowl)
  ;<  caz=(list card)  bind:m  (do-poke grouper-enable+!>('sunrise'))
  ;<  ~  bind:m
    (ex-cards caz ~[(ex-poke /forward [our.bowl %reel] grouper-enable+!>('sunrise'))])
  ;<  ~  bind:m  (set-src ~zod)
  ;<  caz=(list card)  bind:m  (do-poke grouper-ask-enabled+!>('sunrise'))
  =/  fwd  `[%forward ship cage]`[%forward ~zod %grouper-ask-enabled !>('sunrise')]
  ;<  ~  bind:m
    (ex-cards caz ~[(ex-poke /forward [our.bowl %reel] %noun !>(fwd))])
  (ex-fail (do-poke grouper-enable+!>('sunrise')))
::  +test-proxy: subscriptions are proxied to %reel
::
++  test-proxy
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(our ~sampel-palnet)))
  ;<  =bowl  bind:m  get-bowl
  ;<  *  bind:m  (do-init dap grouper-agent)
  ;<  ~  bind:m  (set-src our.bowl)
  =/  =path  /group-enabled/~zod/sunrise
  ;<  caz=(list card)  bind:m  (do-watch path)
  ;<  ~  bind:m
    %+  ex-cards  caz
    ~[(ex-task [%proxy path] [our.bowl %reel] %watch path)]
  ;<  caz=(list card)  bind:m
    (do-agent [%proxy path] [our.bowl %reel] %fact json+!>(b+&))
  (ex-cards caz ~[(ex-fact ~[path] %json !>(b+&))])
--

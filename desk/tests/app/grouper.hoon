/+  *test-agent, test
/=  grouper-agent  /app/grouper
|%
++  dap  %grouper-test
+$  state-2  [%2 enabled-groups=(set cord) outstanding-pokes=(set (pair ship cord))]
::  +test-load-imports: old state is handed to %reel
::
::  loading pre-retirement state pokes %reel with the enabled groups and
::  drops the old bite subscription. the import is kept until %reel acks.
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
  =/  imp  [%import-grouper (sy 'sunrise' ~)]
  ;<  ~  bind:m
    (ex-cards caz ~[(ex-poke /import [our.bowl %reel] %noun !>(imp))])
  ;<  *  bind:m  (do-agent /import [our.bowl %reel] %poke-ack `~[leaf+"nope"])
  ;<  save=vase  bind:m  get-save
  ;<  ~  bind:m  (ex-equal save !>([%3 `(sy 'sunrise' ~)]))
  ;<  *  bind:m  (do-agent /import [our.bowl %reel] %poke-ack ~)
  ;<  save=vase  bind:m  get-save
  (ex-equal save !>([%3 ~]))
::  +test-refuses: nothing reaches %grouper any more
::
++  test-refuses
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  =bowl  bind:m  get-bowl
  ;<  *  bind:m  (do-init dap grouper-agent)
  ;<  ~  bind:m  (set-src our.bowl)
  ;<  ~  bind:m  (ex-fail (do-poke grouper-enable+!>('sunrise')))
  (ex-fail (do-watch /group-enabled/~zod/sunrise))
--

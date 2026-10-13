::  desk-install: start the agents in a desk's bill
::
::    Split out of the old -desk-push so that nothing this client runs from an
::    agent duct touches clay's %into (see /ted/desk/filter and
::    urbit/urbit#7427). A kiln poke is just a poke; it is safe from here.
::
::    arg:    [~ =desk]
::    result: %ok
::
/-  spider
/+  *strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  ;;([~ =desk] q.arg)
;<  =bowl:spider  bind:m  get-bowl
;<  ~  bind:m  (poke [our.bowl %hood] %kiln-install !>([desk our.bowl desk]))
(pure:m !>(%ok))

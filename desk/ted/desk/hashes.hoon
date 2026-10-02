::  desk-hashes: content hash of every file in a desk, keyed by clay path
::
::    Renders each file back to %mime through its own mark and hashes the
::    resulting bytes with +shax, so a client holding the on-disk tree can
::    diff against the ship without reimplementing any mark. A file whose
::    mark has no %mime conversion hashes to 0x0, which a client must treat
::    as "always changed".
::
::    +shax hashes the octs atom, so trailing NUL bytes in a file do not
::    contribute; a client must strip them before hashing.
::
::    arg:    [~ =desk]
::    result: (map path @ux)
::
/-  spider
/+  *strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
::  khan's %fyrd and spider's x-urb-jam both deliver a %noun argument as a
::  vase typed *, so !< cannot be used; clam the raw noun instead
=+  ;;([~ =desk] q.arg)
;<  =bowl:spider  bind:m  get-bowl
=/  here=path  /(scot %p our.bowl)/[desk]/(scot %da now.bowl)
=/  files=(list path)  .^((list path) %ct here)
%-  pure:m
!>  ^-  (map path @ux)
%-  ~(gas by *(map path @ux))
%+  turn  files
|=  =path
^-  [^path @ux]
:-  path
=/  mark=@tas  (rear path)
::  arvo type-checks every .^ result against the requested type at runtime
::  and yields nothing on a mismatch, so ask for exactly what ford builds:
::  the mark's dais (%cb) and a vase-to-vase tube (%cc), never a bare gate
=/  res=(each mime tang)
  %-  mule  |.
  =/  =dais:clay  .^(dais:clay %cb (weld here /[mark]))
  =/  =tube:clay  .^(tube:clay %cc (weld here /[mark]/mime))
  !<(mime (tube (vale:dais .^(* %cx (weld here path)))))
?-  -.res
  %&  `@ux`(shax q.q.p.res)
  %|  0x0
==

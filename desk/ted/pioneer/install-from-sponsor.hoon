::  pioneer/install-from-sponsor: track a desk from our sponsor
::
::    equivalent to |install ~sponsor %desk. meant to run on a tlawn moon
::    so its %groups follows the planet's copy (which must be public, see
::    pioneer/publish-desk) rather than the distribution ship.
::
::    arg (json):
::      { "desk":   "groups",
::        "source": "~sampel-palnet"    // optional; defaults to our sponsor
::      }
::
::    kiln drops the desk's existing sync and starts one from the new
::    source when they differ, and is a no-op when they match, so this is
::    safe to run on every boot.
::
::    return:
::      json: { "desk": "groups", "source": "~sampel-palnet" }
::
/-  spider
/+  *strandio
=,  strand=strand:spider
=,  dejs:format
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
;<  =bowl:spider  bind:m  get-bowl
=+  !<(arg=(unit json) arg)
?>  ?=(^ arg)
=*  json  u.arg
=/  args=[=desk source=(unit ship)]
  %.  json
  %-  ou
  :~  desk+(un (se %tas))
      source+(uf ~ (mu (se %p)))
  ==
=/  source=ship
  (fall source.args (sein:title our.bowl now.bowl our.bowl))
?:  =(our.bowl source)
  %+  strand-fail:strand  %source-is-self
  [leaf+"{(scow %p our.bowl)} can't install {(trip desk.args)} from itself"]~
;<  ~  bind:m
  (poke-our %hood kiln-install+!>([desk.args source desk.args]))
=/  out=^json
  %-  pairs:enjs:format
  :~  desk+s+desk.args
      source+s+(scot %p source)
  ==
(pure:m !>(out))

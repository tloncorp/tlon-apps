::  pioneer/publish-desk: make a desk publicly readable
::
::    equivalent to |public %desk. once a planet's %groups is public its
::    tlawn moon can |install %groups from the planet instead of the
::    distribution ship, so the pair can't drift apart on OTA.
::
::    arg (json):
::      { "desk": "groups" }
::
::    return:
::      json: { "desk": "groups", "public": true|false }
::
::    "public" is read back from clay after the poke, so a false here
::    means the permission did not take.
::
/-  spider
/+  *strandio
=,  strand=strand:spider
=,  dejs:format
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<(arg=(unit json) arg)
?>  ?=(^ arg)
=*  json  u.arg
=/  =desk  ((ot desk+(se %tas) ~) json)
;<  ~  bind:m  (poke-our %hood kiln-permission+!>([desk / &]))
;<  perms=[read=dict:clay write=dict:clay]  bind:m
  (scry ,[dict:clay dict:clay] /cp/[desk])
=/  public=?
  ?&  =(%black mod.rul.read.perms)
      =(~ p.who.rul.read.perms)
      =(~ q.who.rul.read.perms)
  ==
=/  out=^json
  %-  pairs:enjs:format
  :~  desk+s+desk
      public+b+public
  ==
(pure:m !>(out))

::  desk-filter: which of these files would actually change the desk
::
::    Read-only. Takes the same delta -desk-push used to commit and returns
::    only the paths that would really move clay: a mime whose parsed noun
::    already matches what clay holds changes nothing, and neither does
::    deleting a path the desk does not have.
::
::    This exists so that the commit itself can be injected on unix's own
::    /sync wire rather than passed from an agent. Clay's %into handler takes
::    the sender as its unix sync duct (=. hez.ruf `hen) and %mont only
::    repairs that duct when it is empty, so an %into from a gall duct
::    silently kills %ergo and |commit for every desk on the pier, for good.
::    See urbit/urbit#7427. Filtering is safe to do from here; committing is
::    not.
::
::    arg:    [~ =desk =mode:clay]
::    result: (list path)
::
/-  spider
/+  *strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
::  the argument arrives as a %noun vase typed *, so clam rather than !<
=+  ;;([~ =desk =mode:clay] q.arg)
;<  =bowl:spider  bind:m  get-bowl
=/  here=path  /(scot %p our.bowl)/[desk]/(scot %da now.bowl)
%-  pure:m
!>  ^-  (list path)
%+  murn  mode
|=  [=path mim=(unit mime)]
^-  (unit ^path)
=/  have=?  .^(? %cu (weld here path))
?~  mim
  ?:(have `path ~)
?.  have  `path
=/  =tube:clay  .^(tube:clay %cc (weld here /mime/(rear path)))
?:  =(q:(tube !>(u.mim)) .^(* %cx (weld here path)))
  ~
`path

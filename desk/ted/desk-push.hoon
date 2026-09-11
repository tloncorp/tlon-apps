::  desk-push: apply a delta to a desk through clay and report the result
::
::    Replaces the mount / rsync / |commit / poll-the-kiln-hash dance. The
::    caller sends only what differs from what clay holds (see -desk-hashes):
::    changed and new files carry a mime, removed files carry ~. One %into
::    commits it all; clay converts each mime through the desk's own marks,
::    including marks that arrive in this same commit.
::
::    Clay gives no gift for %into (%mere is merge-only), so completion is
::    observed by ordering: the commit cards and a zero-length timer go out
::    together, arvo runs the whole commit inside that event, and the wake
::    arrives in the next one. A commit that fails to build crashes its
::    event, so the caller sees a %bail (conn) or a 500 (eyre) carrying the
::    trace rather than a result from this thread.
::
::    The mount is re-asserted so that %into has a mount point to address and
::    so the on-disk copy stays honest. Nothing here sends %dirk, so vere
::    never rescans the directory.
::
::    arg:    [~ =desk =mode:clay install=?]
::    result: [changed=? =aeon hash=@uvI]
::            changed=| means nothing in the delta differed from clay's
::            copy once parsed, so no commit was made
::
/-  spider
/+  *strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
::  the argument arrives as a %noun vase typed *, so clam rather than !<
=+  ;;([~ =desk =mode:clay install=?] q.arg)
;<  =bowl:spider  bind:m  get-bowl
=+  .^(=rock:tire:clay %cx /(scot %p our.bowl)//(scot %da now.bowl)/tire)
?.  (~(has by rock) desk)
  (strand-fail:strand %no-such-desk leaf+"desk-push: %{(trip desk)} does not exist" ~)
=/  here=path  /(scot %p our.bowl)/[desk]/(scot %da now.bowl)
=/  before=aeon:clay  ud:.^(cass:clay %cw here)
=/  hash=@uvI  .^(@uvI %cz here)
::  drop entries that would not change clay: a delete of a file we do not
::  have, or bytes that parse (through the file's own mark) to the noun we
::  already hold. Some marks re-render differently from the bytes on disk, so
::  a byte-level client diff alone would re-send those files every time.
=.  mode
  %+  skip  mode
  |=  [=path mim=(unit mime)]
  ^-  ?
  =/  have=?  .^(? %cu (weld here path))
  ?~  mim  !have
  ?.  have  |
  =/  =tube:clay  .^(tube:clay %cc (weld here /mime/(rear path)))
  =(q:(tube !>(u.mim)) .^(* %cx (weld here path)))
::  commit only when something differs; installing is independent of that
::
=/  n  (strand ,[changed=? =aeon:clay hash=@uvI])
;<  [changed=? =aeon:clay hash=@uvI]  bind:m
  ^-  form:n
  ?~  mode
    (pure:n [| before hash])
  ;<  ~  bind:n
    %-  send-raw-cards
    :~  [%pass /mount %arvo %c %mont desk [[our.bowl desk da+now.bowl] /]]
        [%pass /push %arvo %c %into desk & mode]
    ==
  ;<  ~  bind:n  (sleep ~s0)
  ;<  =bowl:spider  bind:n  get-bowl
  =/  here=path  /(scot %p our.bowl)/[desk]/(scot %da now.bowl)
  =/  after=aeon:clay  ud:.^(cass:clay %cw here)
  ?.  (gth after before)
    %+  strand-fail:strand  %commit-did-not-land
    [leaf+"desk-push: %{(trip desk)} still at revision {<before>}" ~]
  (pure:n [& after .^(@uvI %cz here)])
::  |install our %desk: makes the desk live and starts every agent in its bill.
::  kiln acks before gall has started them; the client polls kiln's zest.
;<  ~  bind:m
  ?.  install  (pure:(strand ,~) ~)
  (poke [our.bowl %hood] %kiln-install !>([desk our.bowl desk]))
%-  pure:m
!>  ^-  [changed=? =aeon:clay hash=@uvI]
[changed aeon hash]

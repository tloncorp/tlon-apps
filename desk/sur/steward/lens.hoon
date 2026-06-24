::  steward lens module: per-run bot introspection types
::
|%
::  $id: gateway-assigned run identifier (the lensId stamped on posts)
::
+$  id  @t
::  $run: a stored lens run record. payload is the opaque run record as
::  $json; steward relays and stores it without interpreting its contents.
::
::    .complete: whether a finalized (final=&) record has been received
::    .received: when the latest record for this id arrived
::    .payload: the run record
::
+$  run
  $:  complete=?
      received=@da
      payload=json
  ==
::  $entry: a run plus its identity, as exposed to observers
::
+$  entry  [[bot=ship =id] =run]
::  $state: stored runs keyed by bot ship and run id (owner role)
::
+$  state  (map [bot=ship =id] run)
::  $action: a lens run milestone; final=& finalizes the run
::
+$  action  [=id payload=json final=?]
::  $update: lens subscription update — a single run entry
::
+$  update  entry
++  v1  .
--

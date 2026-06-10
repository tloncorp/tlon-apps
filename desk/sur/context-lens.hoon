::  lens: shared types for the per-run bot introspection agent
::
|%
::  $id-run: gateway-assigned run identifier (the lensId stamped on posts)
::
+$  id-run  @t
::  $run: a stored run record
::
::    payload is opaque serialized JSON with an inner schemaVersion;
::    ships relay and store it without interpreting its contents.
::    it is a cord rather than a $json because embedding the recursive
::    $json type in mark sample types makes ford's tube nest checks
::    diverge (stack overflow on every json conversion build).
::
+$  run
  $:  complete=?
      received=@da
      payload=@t
  ==
::  $entry: a run plus its identity, as exposed to observers
::
+$  entry  [bot=ship =id-run =run]
::  $action: inbound poke protocol from openclaw-tlon (local gateway only)
::
+$  action
  $%  [%configure owners=(set ship)]
      [%run-event =id-run payload=@t]
      [%run-final =id-run payload=@t]
  ==
::  $signal: bot-ship to owner-ship fan-out pokes
::
+$  signal
  $%  [%run-event =id-run payload=@t]
      [%run-final =id-run payload=@t]
  ==
::  $update: outbound subscription facts and scry results
::
+$  update
  $%  [%run =entry]
      [%runs entries=(list entry)]
  ==
::
++  v1  .
--

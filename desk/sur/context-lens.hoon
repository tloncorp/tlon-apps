::  lens: shared types for the per-run bot introspection agent
::
|%
::  $id-run: gateway-assigned run identifier (the lensId stamped on posts)
::
+$  id-run  @t
::  $run: a stored run record
::
::    payload is opaque JSON with an inner schemaVersion; ships relay
::    and store it without interpreting its contents.
::
+$  run
  $:  complete=?
      received=@da
      payload=json
  ==
::  $entry: a run plus its identity, as exposed to observers
::
+$  entry  [bot=ship =id-run =run]
::  $action: inbound poke protocol from openclaw-tlon (local gateway only)
::
+$  action
  $%  [%configure owners=(set ship)]
      [%run-event =id-run payload=json]
      [%run-final =id-run payload=json]
  ==
::  $signal: bot-ship to owner-ship fan-out pokes
::
+$  signal
  $%  [%run-event =id-run payload=json]
      [%run-final =id-run payload=json]
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

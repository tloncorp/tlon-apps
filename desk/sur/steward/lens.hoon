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
::  $state-0: legacy lens state (agent state-0) — a bare map of runs, no
::  retention config. on-load migrates it into $state with a default cap.
::
+$  state-0  (map [bot=ship =id] run)
::  $state: lens module state.
::
::    .runs: durable store of finalized + partial run records, keyed by
::           [bot id].
::    .max-runs-per-bot: per-bot count cap; the oldest beyond it are pruned
::           on the next insert or %configure. No time-based expiry — lens
::           runs are durable memory, not transient logs.
::
+$  state
  $:  runs=(map [bot=ship =id] run)
      max-runs-per-bot=@ud
  ==
::  $action: lens module inbound actions.
::
::    %entry: gateway pushes a run record (partial or final). data flows in
::            from the bot's gateway (src=our) or fans in from a moon we
::            sponsor (a bot we own). bot → owner.
::    %retry: owner-initiated request to re-dispatch a finalized run that
::            failed or aborted. carries .bot so the agent can route it —
::            owner → bot, with the owner's steward acting as the cross-ship
::            relay when bot != our.
::    %configure: set the per-ship lens retention cap; applied to every bot
::            immediately. local only.
::
+$  action
  $%  [%entry =id payload=json final=?]
      [%retry bot=ship =id]
      [%configure max-runs-per-bot=@ud]
  ==
::  $update: lens subscription / scry update.
::
::    %entry: a stored run record (insert or update), facted on /v1/lens.
::    %retry-requested: a retry was requested for run .id by .requester; the
::            local gateway should re-dispatch. Only emitted on the bot ship.
::    %recent: a batch of entries, returned by the /recent and /since scries
::            so HTTP clients can read them as JSON. Never facted on the sub.
::
+$  update
  $%  [%entry =entry]
      [%retry-requested =id requester=ship]
      [%recent entries=(list entry)]
  ==
++  v1  .
--

/-  spider, sp=steward-prompts
/+  *ph-io, *ph-test
=,  strand=strand:spider
|%
++  original
  ^-  prompts:v1:sp
  (my 'SOUL.md'^'original soul' 'USER.md'^'original user' ~)
++  edited
  ^-  prompts:v1:sp
  (~(put by original) 'SOUL.md' 'edited soul')
++  edit
  ^-  edit:v1:sp
  [%set 'SOUL.md' 'edited soul']
++  updated
  ^-  response-body:v1:sp
  [%updated 'SOUL.md']
::  Fold public projection updates into the complete ship-keyed map that a
::  subscriber sees. A new local watch can receive a snapshot followed by a
::  remote delta before the projection reaches its expected value.
::
++  apply-update
  |=  [files=(map ship prompts:v1:sp) =update:v1:sp]
  ^-  (map ship prompts:v1:sp)
  ?-  -.update
      %files  files.update
      %set
    ?~  entry=(~(get by files) ship.update)
      files
    (~(put by files) ship.update (~(put by u.entry) name.update text.update))
      %del
    ?~  entry=(~(get by files) ship.update)
      files
    (~(put by files) ship.update (~(del by u.entry) name.update))
      %gone  (~(del by files) ship.update)
  ==
::  Public projection assertion. An owner initially receives its own empty
::  snapshot, then the remote bot projection, so retain the watch until the
::  expected full snapshot arrives.
::
++  ex-files
  |=  [who=ship workspace=prompts:v1:sp label=@tas]
  =/  m  (strand ,~)
  ^-  form:m
  =/  wire  /projection/(scot %p who)/[label]
  =/  expected=(map ship prompts:v1:sp)  (my ~nec^workspace ~)
  =|  files=(map ship prompts:v1:sp)
  ;<  ~  bind:m  (watch-app wire [who %steward] /v1/prompts/files)
  %^  (set-timeout-err ,~)  ~s45  ~[leaf+"projection did not reach {<(scow %p who)>}"]
  |-
  =*  loop  $
  ;<  =update:v1:sp  bind:m
    (wait-for-app-fact-value update:v1:sp wire [who %steward])
  =.  files  (apply-update files update)
  ?:  =(expected files)
    (leave-app wire [who %steward])
  loop
::  Configure the bot, publish OC's starting workspace, and trust it on the
::  owner. The bot projection is the owner-visible source of truth.
::
++  prepare
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (poke-app [~nec %steward] steward-action-1+[%configure ~zod])
  ;<  ~  bind:m  (poke-app [~nec %steward] steward-prompts-action-1+[%project original])
  ;<  ~  bind:m  (poke-app [~zod %steward] steward-action-1+[%trust-bot ~nec])
  (ex-files ~zod original %initial)
::  Submit an owner edit through steward's local action. This follows the
::  same watch-then-command relay used by the HTTP endpoint; HTTP parsing and
::  Eyre response framing remain covered by the agent tests.
::
++  submit
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /result [~zod %steward] /v1/prompts/request/0v1)
  (poke-app [~zod %steward] steward-prompts-action-1+[%edit 0v1 ~nec edit])
++  ex-result
  |=  body=response-body:v1:sp
  %^  ex-app-fact  /result  [~zod %steward]
  steward-prompts-response-1+!>(`response:v1:sp`[0v1 body])
++  ex-dispatch
  %^  ex-app-fact  /harness  [~nec %steward]
  steward-prompts-dispatch-1+!>(`dispatch:v1:sp`[0v1 ~zod edit])
::  ~zod edits ~nec's workspace. The simulated OC harness receives the edit,
::  while both projections retain their old contents. It projects the changed
::  workspace, then finalizes the request.
::
++  ph-test-edit-project-finalize
  =/  m  (strand ,~)
  ^-  form:m
  %^  (set-timeout-err ,~)  ~m2  ~[leaf+"edit-project-finalize timed out"]
  ;<  ~  bind:m  prepare
  ;<  ~  bind:m  (watch-app /harness [~nec %steward] /v1/prompts/harness)
  ;<  ~  bind:m  submit
  ;<  ~  bind:m  ex-dispatch
  ;<  ~  bind:m  (ex-files ~nec original %bot-before)
  ;<  ~  bind:m  (ex-files ~zod original %owner-before)
  ;<  ~  bind:m  (poke-app [~nec %steward] steward-prompts-action-1+[%project edited])
  ;<  ~  bind:m  (ex-files ~zod edited %owner-edited)
  ;<  ~  bind:m  (ex-files ~nec edited %bot-edited)
  ;<  ~  bind:m  (poke-app [~nec %steward] steward-prompts-action-1+[%finalize 0v1 updated])
  (ex-result updated)
::  A command accepted by OC survives a harness disconnect. The owner result
::  becomes pending; reconnect replays the same request ID; a late finalization
::  reaches the owner without changing the projected files.
::
++  ph-test-pending-reconnect-late-result
  =/  m  (strand ,~)
  ^-  form:m
  %^  (set-timeout-err ,~)  ~m2  ~[leaf+"pending-reconnect-late-result timed out"]
  ;<  ~  bind:m  prepare
  ;<  ~  bind:m  (watch-app /harness [~nec %steward] /v1/prompts/harness)
  ;<  ~  bind:m  submit
  ;<  ~  bind:m  ex-dispatch
  ;<  ~  bind:m  (leave-app /harness [~nec %steward])
  ;<  ~  bind:m  (ex-result [%pending %acked])
  ;<  ~  bind:m  (ex-files ~nec original %bot-before)
  ;<  ~  bind:m  (ex-files ~zod original %owner-before)
  ;<  ~  bind:m  (watch-app /harness [~nec %steward] /v1/prompts/harness)
  ;<  ~  bind:m  ex-dispatch
  ;<  ~  bind:m  (poke-app [~nec %steward] steward-prompts-action-1+[%finalize 0v1 updated])
  ;<  ~  bind:m  (ex-result updated)
  ;<  ~  bind:m  (ex-files ~nec original %bot-after)
  (ex-files ~zod original %owner-after)
::  With no harness connected, the bot reports harness-offline and both
::  projections retain their contents.
::
++  ph-test-harness-offline
  =/  m  (strand ,~)
  ^-  form:m
  %^  (set-timeout-err ,~)  ~m2  ~[leaf+"harness-offline timed out"]
  ;<  ~  bind:m  prepare
  ;<  ~  bind:m  submit
  ;<  ~  bind:m  (ex-result [%error %harness-offline ~])
  ;<  ~  bind:m  (ex-files ~nec original %bot-offline)
  (ex-files ~zod original %owner-offline)
--

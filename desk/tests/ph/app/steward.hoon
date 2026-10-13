/-  spider, sp=steward-prompts
/+  *ph-io, *ph-test, pj=steward-prompts-json
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
::  Send one HTTP request through the virtual ship's eyre, as the OC harness
::  does in production, and return the response status and start header.
::  Requests here are sequential and answered at once, so the first
::  response effect from .who is this request's.
::
++  send-http
  |=  [who=ship label=@tas =request:http]
  =/  m  (strand ,response-header:http)
  ^-  form:m
  =/  =wire  /http-response/(scot %p who)/[label]
  ;<  ~  bind:m  (watch-our wire %aqua /effect/response)
  =/  =task:eyre  [%request | [%ipv4 .127.0.0.1] request]
  ;<  ~  bind:m  (send-events ~[[%event who [%e /aqua/http/[label]] task]])
  %^  (set-timeout-err ,response-header:http)  ~s45
    ~[leaf+"no http response from {<(scow %p who)>} for {<label>}"]
  |-
  =*  loop  $
  ;<  res=cage  bind:m  (take-fact wire)
  ?>  ?=(%aqua-effect p.res)
  =+  !<(=aqua-effect q.res)
  =*  effect  q.ufs.aqua-effect
  ?.  ?&  =(who who.aqua-effect)
          ?=(%response -.effect)
          ?=(%start -.http-event.effect)
      ==
    loop
  ;<  ~  bind:m  (leave-our wire %aqua)
  (pure:m response-header.http-event.effect)
::  Log in to .who's eyre with its +code and return the session cookie.
::
++  login
  |=  who=ship
  =/  m  (strand ,@t)
  ^-  form:m
  ;<  =bowl:spider  bind:m  get-bowl
  ::  +scry-aqua appends the mark itself, and jael's %code answers only a
  ::  path that ends at the ship, so no trailing /noun here
  ::
  ;<  code=(unit @p)  bind:m
    %+  scry-aqua  (unit @p)
    [who /j/(scot %p who)/code/(scot %da now.bowl)/(scot %p who)]
  =/  body=@t  (cat 3 'password=' (crip (slag 1 (scow %p (need code)))))
  =/  =request:http
    :^  %'POST'  '/~/login'
      ~[['content-type' 'application/x-www-form-urlencoded']]
    `(as-octs:mimes:html body)
  ;<  head=response-header:http  bind:m  (send-http who %login request)
  =/  cookie=(unit @t)  (get-header:http 'set-cookie' headers.head)
  ?~  cookie
    (strand-fail %login ~[leaf+"no session cookie, status {<status-code.head>}"])
  (pure:m (crip (scag (need (find ";" (trip u.cookie))) (trip u.cookie))))
::  POST a JSON body to a harness route on the bot and expect a 200.
::
++  harness-post
  |=  [cookie=@t route=@t label=@tas body=json]
  =/  m  (strand ,~)
  ^-  form:m
  =/  =request:http
    :^  %'POST'  (cat 3 '/steward/~/v1/prompts/' route)
      :~  ['content-type' 'application/json']
          ['cookie' cookie]
      ==
    `(as-octs:mimes:html (en:json:html body))
  ;<  head=response-header:http  bind:m  (send-http ~nec label request)
  ?:  =(200 status-code.head)  (pure:m ~)
  (strand-fail %harness-post ~[leaf+"{(trip route)} returned {<status-code.head>}"])
++  project
  |=  [cookie=@t label=@tas files=prompts:v1:sp]
  %^  harness-post  cookie  'project'
  [label (action:enjs:pj [%project files])]
++  finalize
  |=  [cookie=@t label=@tas body=response-body:v1:sp]
  %^  harness-post  cookie  'finalize'
  :-  label
  %-  pairs:enjs:format
  :~  'requestId'^(request-id:enjs:pj 0v1)
      body+(response-body:enjs:pj body)
  ==
::  Configure the bot, publish OC's starting workspace over HTTP, and trust
::  it on the owner. The bot projection is the owner-visible source of
::  truth. Returns the harness's session cookie on the bot.
::
++  prepare
  =/  m  (strand ,@t)
  ^-  form:m
  ;<  ~  bind:m  (poke-app [~nec %steward] steward-action-1+[%configure ~zod])
  ;<  cookie=@t  bind:m  (login ~nec)
  ;<  ~  bind:m  (project cookie %project-original original)
  ;<  ~  bind:m  (poke-app [~zod %steward] steward-action-1+[%trust-bot ~nec])
  ;<  ~  bind:m  (ex-files ~zod original %initial)
  (pure:m cookie)
::  Submit an owner edit through steward's local action. This follows the
::  same watch-then-command relay used by the owner's HTTP endpoint, whose
::  held response would interleave with the harness's own HTTP replies here;
::  its parsing and framing stay covered by the agent tests.
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
::  workspace, then finalizes the request, both over HTTP as OC does.
::
++  ph-test-edit-project-finalize
  =/  m  (strand ,~)
  ^-  form:m
  %^  (set-timeout-err ,~)  ~m2  ~[leaf+"edit-project-finalize timed out"]
  ;<  cookie=@t  bind:m  prepare
  ;<  ~  bind:m  (watch-app /harness [~nec %steward] /v1/prompts/harness)
  ;<  ~  bind:m  submit
  ;<  ~  bind:m  ex-dispatch
  ;<  ~  bind:m  (ex-files ~nec original %bot-before)
  ;<  ~  bind:m  (ex-files ~zod original %owner-before)
  ;<  ~  bind:m  (project cookie %project-edited edited)
  ;<  ~  bind:m  (ex-files ~zod edited %owner-edited)
  ;<  ~  bind:m  (ex-files ~nec edited %bot-edited)
  ;<  ~  bind:m  (finalize cookie %finalize updated)
  (ex-result updated)
::  A command accepted by OC survives a harness disconnect. The owner result
::  becomes pending; reconnect replays the same request ID; a late finalization
::  reaches the owner without changing the projected files.
::
++  ph-test-pending-reconnect-late-result
  =/  m  (strand ,~)
  ^-  form:m
  %^  (set-timeout-err ,~)  ~m2  ~[leaf+"pending-reconnect-late-result timed out"]
  ;<  cookie=@t  bind:m  prepare
  ;<  ~  bind:m  (watch-app /harness [~nec %steward] /v1/prompts/harness)
  ;<  ~  bind:m  submit
  ;<  ~  bind:m  ex-dispatch
  ;<  ~  bind:m  (leave-app /harness [~nec %steward])
  ;<  ~  bind:m  (ex-result [%pending %acked])
  ;<  ~  bind:m  (ex-files ~nec original %bot-before)
  ;<  ~  bind:m  (ex-files ~zod original %owner-before)
  ;<  ~  bind:m  (watch-app /harness [~nec %steward] /v1/prompts/harness)
  ;<  ~  bind:m  ex-dispatch
  ;<  ~  bind:m  (finalize cookie %finalize updated)
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
  ;<  cookie=@t  bind:m  prepare
  ;<  ~  bind:m  submit
  ;<  ~  bind:m  (ex-result [%error %harness-offline ~])
  ;<  ~  bind:m  (ex-files ~nec original %bot-offline)
  (ex-files ~zod original %owner-offline)
--

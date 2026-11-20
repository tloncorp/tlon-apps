/-  *harness-store, hn=harness-notes, runner=harness-runner
::  Opt-in full-agent evaluation: -test /=harness=/tests-integration/harness-reload
/+  *test-agent, notes=harness-notes
/=  head  /app/harness
/=  up  /tests/harness-upgrade
|%
::  Existing agents are live, but their new endpoints are not loaded yet.
::  A data scry during reload must fail rather than be silently stubbed.
::
++  live-only
  (set-scry-gate |=(p=path ?:(?=([%gu *] p) `!>(&) ~)))
++  reload
  |=  saved=vase
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod)))
  ;<  ~  bind:m  live-only
  (do-load head `saved)
++  watches
  |=  cards=(list card)
  (skim cards |=(c=card ?=([%pass * %agent * %watch *] c)))
++  test-reload-opens-missing-subscriptions
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  caz=(list card)  bind:m  (reload !>(*state-0))
  (ex-equal !>((lent (watches caz))) !>(1))
++  test-reload-reopens-acp-and-leaves-retired-mirror
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ::  Gall kept both subscriptions across the code reload.
  ;<  ~  bind:m
    %-  jab-bowl
    |=  b=bowl
    =.  wex.b  (~(put by wex.b) [/acp/watch ~zod %acp] [& /v1/agent])
    =.  wex.b  (~(put by wex.b) [/harness-grub/sessions ~zod %harness-grub] [& /client/sessions])
    b
  =/  saved=state-0  *state-0
  =.  sessions.saved  (my ~[['peer--~nec' [~ 1]]])
  ;<  caz=(list card)  bind:m  (reload !>(saved))
  ;<  ~  bind:m  (ex-equal !>((lent (watches caz))) !>(1))
  ;<  ~  bind:m
    %+  ex-equal
      !>((lien caz |=(c=card ?=([%pass [%acp %watch ~] %agent * %leave ~] c))))
    !>(&)
  ;<  ~  bind:m
    %+  ex-equal
      !>((lien caz |=(c=card ?=([%pass [%acp %watch ~] %agent * %watch *] c))))
    !>(&)
  ::  An earlier release mirrored sessions into a second agent.
  %+  ex-equal
    !>((lien caz |=(c=card ?=([%pass [%harness-grub %sessions ~] %agent * %leave ~] c))))
  !>(&)
++  test-reload-reobserves-sent-notes-write-without-dispatching-it-again
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  now=@da  ~2026.9.12
  =/  saved=state-0  *state-0
  =/  args=json
    %-  pairs:enjs:format
    ~[['title' %s 'Reload fixture'] ['body' %s 'Already dispatched']]
  =/  prepared
    %:  prepare:notes
      workspace.saved
      workspace-notes.saved
      [%native 'reload']
      'artifact-create'
      args
      'doc'
      now
      0v42
    ==
  ?>  ?=(%& -.prepared)
  =.  pending.workspace-notes.saved  `p.prepared(sent &)
  =/  rid  (request-id:notes p.prepared)
  ::  These cards are inspected, never delivered to the installed Notes agent.
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now now)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  loaded=(list card)  bind:m  (do-load head `!>(saved))
  ;<  after-load=vase  bind:m  get-save
  ;<  acked=(list card)  bind:m
    (do-agent /artifact-notes/request/(scot %uv rid) [~zod %notes] [%watch-ack ~])
  ;<  after-ack=vase  bind:m  get-save
  =/  emitted=(list card)  (weld loaded acked)
  ;<  ~  bind:m
    %+  ex-equal
      !>(pending.workspace-notes:!<(state-0 after-load))
    !>(pending.workspace-notes.saved)
  ;<  ~  bind:m
    %+  ex-equal
      !>(pending.workspace-notes:!<(state-0 after-ack))
    !>(pending.workspace-notes.saved)
  ;<  ~  bind:m
    %+  ex-equal
      !>((lien loaded |=(c=card ?=([%pass [%artifact-notes %request *] %agent * %watch *] c))))
    !>(&)
  %+  ex-equal
    !>((lien emitted |=(c=card ?=([%pass * %agent * %poke %notes-action-1 *] c))))
  !>(|)
::  The reload clears the saved wakes and runner streams, then re-arms each
::  wake from the populated work: the active schedule's next run, the parked
::  runner job, the queued corpus scope and the pending memory capture.
++  test-reload-keeps-populated-state
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  now=@da  ~2026.11.15
  =/  e  expected-current:up
  =.  registry.runners.e
    (~(run by registry.runners.e) |=(r=runner:runner r(stream ~)))
  =.  wake.runners.e  `(add now ~s15)
  =.  schedule-wake.e  `next:(~(got by schedules.e) 0v7a)
  =.  corpus-wake.e  `(add now (div ~s1 10))
  =.  wake.knowledge.e  `(add now ~s1)
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now now)))
  ;<  ~  bind:m  live-only
  ;<  *  bind:m  (do-load head `!>(populated:up))
  ;<  saved=vase  bind:m  get-save
  (ex-same:up saved !>(e))
--

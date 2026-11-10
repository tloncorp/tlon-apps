::  Shared notes are head-local bookkeeping, not an execution lifecycle.
::  The full head runs under test-agent; every scry answers %.n.
/-  h=harness, *harness-store
/+  *test-agent, policy=harness-defaults
/=  head  /app/harness
|%
::  Load saved state as ~zod at now with every scry answered %.n.
::
++  setup
  |=  [now=@da saved=state-0]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now now)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  *  bind:m  (do-load head `!>(saved))
  (pure:m ~)
::
++  do-send
  |=  [session=@t text=@t]
  (do-poke %harness-action !>(`action:h`[%send session text]))
::
++  get-state
  =/  m  (mare ,state-0)
  ^-  form:m
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-0 vase))
::  Any iris request means a provider was asked to act.
::
++  provider-work
  |=  cards=(list card)
  (lien cards |=(=card ?=([%pass * %arvo %i *] card)))
::
++  test-notes-record-and-complete-without-claims-agents-or-approvals
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved=state-0  *state-0
  =.  saved  saved(welcome-seen 1, defaults builtin-config:policy)
  ;<  ~  bind:m  (setup ~2026.9.14 saved)
  ;<  *  bind:m  (do-poke %harness-action !>(`action:h`[%new 'owner' defaults.saved ~s30]))
  ;<  before=state-0  bind:m  get-state
  ;<  noted=(list card)  bind:m
    (do-send 'owner' '/work task-create {"id":"note","title":"Check the forecast"}')
  ;<  recorded=state-0  bind:m  get-state
  ;<  updated=(list card)  bind:m
    %+  do-send  'owner'
    '/work task-update {"id":"note","version":1,"status":"done","outcome":"Answered in the conversation."}'
  ;<  after=state-0  bind:m  get-state
  ;<  *  bind:m
    (do-send 'owner' '/work task-update {"id":"note","version":1,"status":"open"}')
  ;<  final=state-0  bind:m  get-state
  ;<  *  bind:m
    %+  do-send  'owner'
    '/work task-update {"id":"note","version":2,"title":"Forecast answered","description":"A completed request"}'
  ;<  changed=state-0  bind:m  get-state
  ;<  *  bind:m  (do-send 'owner' '/work task-delete {"id":"note","version":3}')
  ;<  removed=state-0  bind:m  get-state
  =/  replies
    %+  murn
      log:(~(got by sessions.after) 'owner')
    |=(e=event:h ?:(?=(%command-completed -.e) `body.e ~))
  ;<  ~  bind:m  (ex-equal !>(?=(^ replies)) !>(&))
  ?>  ?=(^ replies)
  ;<  ~  bind:m
    (ex-equal !>(title:(~(got by tasks.workspace.recorded) 'note')) !>('Check the forecast'))
  ;<  ~  bind:m  (ex-equal !>(status:(~(got by tasks.workspace.after) 'note')) !>(%done))
  ;<  ~  bind:m  (ex-equal !>(artifact:(~(got by tasks.workspace.after) 'note')) !>(~))
  ;<  ~  bind:m  (ex-equal !>(project:(~(got by tasks.workspace.after) 'note')) !>(''))
  ;<  ~  bind:m  (ex-equal !>(requests.work-controls.after) !>(~))
  ;<  ~  bind:m  (ex-equal !>(projects.workspace.after) !>(projects.workspace.before))
  ;<  ~  bind:m  (ex-equal !>(~(key by sessions.after)) !>(~(key by sessions.before)))
  ;<  ~  bind:m  (ex-equal !>(workspace.final) !>(workspace.after))
  ;<  ~  bind:m
    (ex-equal !>(title:(~(got by tasks.workspace.changed) 'note')) !>('Forecast answered'))
  ;<  ~  bind:m  (ex-equal !>(status:(~(got by tasks.workspace.changed) 'note')) !>(%done))
  ;<  ~  bind:m
    %+  ex-equal
      !>(outcome:(~(got by tasks.workspace.changed) 'note'))
    !>('Answered in the conversation.')
  ;<  ~  bind:m  (ex-equal !>(tasks.workspace.removed) !>(~))
  ;<  ~  bind:m  (ex-equal !>(requests.work-controls.removed) !>(~))
  ;<  ~  bind:m  (ex-equal !>(projects.workspace.removed) !>(projects.workspace.before))
  ;<  ~  bind:m  (ex-equal !>(artifacts.workspace.removed) !>(artifacts.workspace.before))
  ;<  ~  bind:m  (ex-equal !>(~(key by sessions.removed)) !>(~(key by sessions.before)))
  ;<  ~  bind:m
    %+  ex-equal
      !>(?=(^ (find (trip 'Answered in the conversation.') (trip i.replies))))
    !>(&)
  (ex-equal !>((provider-work (weld noted updated))) !>(|))
::
++  test-finish-shortcut-uses-current-version-and-keeps-the-result
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  now  ~2026.10.1
  =/  saved=state-0  *state-0
  =.  saved  saved(local-mcp-seen 1, defaults builtin-config:policy)
  =.  sessions.saved  (my ~[['owner' [~[[%config-replaced defaults.saved]] 0]]])
  =.  tasks.workspace.saved
    %-  my
    ~[['note' ['' 'Verify the answer' '' 7 %blocked ~ 'Evidence checked' ~ now]]]
  ;<  ~  bind:m  (setup now saved)
  ;<  finished=(list card)  bind:m  (do-send 'owner' '/work finish note')
  ;<  after=state-0  bind:m  get-state
  =/  task  (~(got by tasks.workspace.after) 'note')
  ;<  ~  bind:m  (ex-equal !>(status.task) !>(%done))
  ;<  ~  bind:m  (ex-equal !>(version.task) !>(8))
  ;<  ~  bind:m  (ex-equal !>(outcome.task) !>('Evidence checked'))
  ;<  ~  bind:m  (ex-equal !>(artifact.task) !>(~))
  ;<  ~  bind:m  (ex-equal !>(requests.work-controls.after) !>(~))
  (ex-equal !>((provider-work finished)) !>(|))
--

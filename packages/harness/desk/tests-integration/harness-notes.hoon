::  Native Notes observation and recovery through the full head, driven by
::  test-agent. No cards are delivered; a saved send fence represents an
::  already dispatched write.
/-  hn=harness-notes, work=harness-workspace, *harness-store
/+  *test-agent, policy=harness-defaults, notes=harness-notes
/=  head  /app/harness
|%
++  t0  ~2026.10.1
::
++  fixture
  ^-  state-0
  =/  saved  *state-0
  =.  saved  saved(defaults builtin-config:policy, local-mcp-seen 1)
  =/  args=json  (pairs:enjs:format ~[['title' %s 'Draft'] ['body' %s 'Body']])
  =/  prepared
    %:  prepare:notes
      workspace.saved
      workspace-notes.saved
      [%native 'original']
      'artifact-create'
      args
      'doc'
      t0
      0v1
    ==
  ?>  ?=(%& -.prepared)
  saved(workspace-notes workspace-notes.saved(pending `p.prepared(sent &)))
::
++  request-id
  =/  saved=state-0  fixture
  (request-id:notes (need pending.workspace-notes.saved))
++  notes-gill  `gill:gall`[~zod %notes]
::  Load the fixture as ~zod with every scry answered %.n. Loading reopens
::  the pending request's watch, so signs on its wire are accepted.
::
++  setup
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now t0)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  (do-load head `!>(fixture))
::
++  do-notes
  |=  [=request:work]
  (do-poke %harness-workspace !>(request))
::
++  get-state
  =/  m  (mare ,state-0)
  ^-  form:m
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-0 vase))
::
++  sends
  |=  cards=(list card)
  ^-  (list card)
  %+  skim  cards
  |=(=card ?=([%pass * %agent * %poke %notes-action-1 *] card))
::
++  test-reload-and-resume-observe-without-resending-a-native-write
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  loaded=(list card)  bind:m  setup
  ;<  acknowledged=(list card)  bind:m
    (do-agent /artifact-notes/request/(scot %uv request-id) notes-gill [%watch-ack ~])
  ;<  failed=(list card)  bind:m
    %^  do-agent  /artifact-notes/send/(scot %uv request-id)  notes-gill
    [%poke-ack `~[leaf+"transport failed"]]
  ;<  uncertain=state-0  bind:m  get-state
  ::  A kick for some other request: its watch is still open (Gall would not
  ::  kick a wire nobody watches), but it must not touch the pending one.
  =/  stale-wire  /artifact-notes/request/(scot %uv +(request-id))
  ;<  ~  bind:m
    %-  jab-bowl
    |=  b=bowl
    b(wex (~(put by wex.b) [stale-wire notes-gill] [& /v1/request/(scot %uv +(request-id))]))
  ;<  stale=(list card)  bind:m  (do-agent stale-wire notes-gill [%kick ~])
  ;<  after-stale=state-0  bind:m  get-state
  =/  args=json  (pairs:enjs:format ~[['id' %s '0v1']])
  ;<  resumed=(list card)  bind:m  (do-notes ['resume' 'notes-resume' args])
  ;<  after=state-0  bind:m  get-state
  =/  pending  (need pending.workspace-notes.after)
  ;<  ~  bind:m  (ex-equal !>(sent.pending) !>(&))
  ;<  ~  bind:m  (ex-equal !>(uncertain.pending) !>(&))
  ;<  ~  bind:m  (ex-equal !>(workspace-notes.after-stale) !>(workspace-notes.uncertain))
  ;<  ~  bind:m  (ex-equal !>(workspace-notes.after) !>(workspace-notes.uncertain))
  ;<  ~  bind:m
    (ex-equal !>((sends :(weld loaded acknowledged failed stale resumed))) !>(~))
  %+  ex-equal
    !>  %+  lien  resumed
        |=(=card ?=([%pass [%artifact-notes %request *] %agent * %watch *] card))
  !>(&)
::
++  test-release-requires-the-current-operation-and-explicit-confirmation
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  setup
  =/  args=json
    %-  pairs:enjs:format
    ~[['id' %s '0v1'] ['confirm' %s 'release another-operation']]
  ;<  *  bind:m  (do-notes ['deny' 'notes-release' args])
  ;<  before=state-0  bind:m  get-state
  =/  confirmed=json
    %-  pairs:enjs:format
    ~[['id' %s '0v1'] ['confirm' %s 'release 0v1']]
  ;<  released=(list card)  bind:m  (do-notes ['release' 'notes-release' confirmed])
  ;<  after=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>(?=(^ pending.workspace-notes.before)) !>(&))
  ;<  ~  bind:m  (ex-equal !>(pending.workspace-notes.after) !>(~))
  ;<  ~  bind:m  (ex-equal !>(artifacts.workspace.after) !>(artifacts.workspace.before))
  ;<  ~  bind:m
    (ex-equal !>(action:(snag 0 history.workspace.after)) !>('notes-release'))
  ;<  ~  bind:m  (ex-equal !>((sends released)) !>(~))
  %+  ex-equal
    !>  %+  lien  released
        |=(=card ?=([%pass [%artifact-notes %request *] %agent * %leave ~] card))
  !>(&)
--

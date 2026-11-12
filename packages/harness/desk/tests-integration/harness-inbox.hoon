::  A full-agent inbox read answers over ACP and leaves owner state untouched.
/-  *harness-store, ac=acp
/+  *test-agent, j=harness-workspace-json, admin=harness-admin
/=  head  /app/harness
|%
++  t0  ~2026.9.12
::  Start from saved state holding one blocked task. Loading opens the ACP
::  subscription that the frame below arrives on.
::
++  setup
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved=state-0  *state-0
  =.  tasks.workspace.saved
    (my ~[['task' ['project' 'Read-only fixture' 'No effects' 1 %blocked ~ '' ~ t0]]])
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now t0)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  *  bind:m  (do-load head `!>(saved))
  (pure:m ~)
::
++  do-inbox-frame
  |=  connection=@t
  =/  frame=@t  '{"jsonrpc":"2.0","id":1,"method":"harness/inbox","params":{"state":"attention"}}'
  =/  =update:v1:ac  [%messages connection %agent ~[[1 t0 frame]]]
  (do-agent /acp/watch [~zod %acp] [%fact %acp-update-1 !>(update)])
::  The JSON-RPC reply, whether sent to the connection or handed back to an
::  admin tool.
::
++  reply
  |=  cards=(list card)
  ^-  @t
  ?~  cards  !!
  =/  card  i.cards
  ?:  ?=([%pass [%acp %send ~] %agent * %poke %acp-action-1 *] card)
    =/  [pass=* wire=* agent=* target=* poke=* mark=* data=vase]  card
    =/  action  !<(action:v1:ac data)
    ?>  ?=(%send -.action)
    payload.action
  ?:  ?=([%pass [%admin %result ~] %agent * %poke %harness-admin-result *] card)
    =/  [pass=* wire=* agent=* target=* poke=* mark=* data=vase]  card
    =/  decoded  !<([@t @t] data)
    +.decoded
  $(cards t.cards)
::
++  acked
  |=  cards=(list card)
  %+  lien  cards
  |=(c=card ?=([%pass [%acp %ack ~] %agent * %poke %acp-action-1 *] c))
::
++  exercise
  |=  connection=@t
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~                bind:m  setup
  ;<  old=vase         bind:m  get-save
  ;<  caz=(list card)  bind:m  (do-inbox-frame connection)
  ;<  new=vase         bind:m  get-save
  =/  before  !<(state-0 old)
  =/  after  !<(state-0 new)
  ;<  ~  bind:m  (ex-equal !>(workspace.after) !>(workspace.before))
  ;<  ~  bind:m  (ex-equal !>(workspace-notes.after) !>(workspace-notes.before))
  ;<  ~  bind:m  (ex-equal !>(hands.after) !>(hands.before))
  ;<  ~  bind:m  (ex-equal !>(schedules.after) !>(schedules.before))
  ;<  ~  bind:m  (ex-equal !>(sessions.after) !>(sessions.before))
  ;<  ~  bind:m  (ex-equal !>((acked caz)) !>(&))
  =/  response  (need (de:json:html (reply caz)))
  =/  result  (get:j response 'result')
  =/  denied  (get:j response 'error')
  ?:  ?=(^ (decode:admin connection))
    (ex-equal !>(&(?=(^ denied) ?=(~ result))) !>(&))
  (ex-equal !>(&(?=(^ result) ?=(~ denied))) !>(&))
::
++  test-owner-read-is-projection-only
  (eval-mare (exercise 'inbox-owner-fixture'))
++  test-model-admin-cannot-read-owner-inbox
  (eval-mare (exercise (connection:admin ['model-session' 1 'admin-tool'])))
--

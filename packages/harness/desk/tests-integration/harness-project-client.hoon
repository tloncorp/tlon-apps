::  Full-agent HTTP routing and persistence, isolated from effect execution.
/-  *harness-store, ac=acp, n=notes
/+  *test-agent, j=harness-workspace-json, admin=harness-admin
/=  head  /app/harness
/=  seed  /tests/harness-project-client
|%
++  request
  |=  body=@t
  ^-  inbound-request:eyre
  :*  |  |  [%ipv4 .127.0.0.1]
      :*  %'POST'  '/harness-project/read'  ~[['authorization' (cat 3 'Bearer ' key:seed)]]
          `(as-octs:mimes:html body)
      ==
  ==
::  Run forms one after another; each exercise reloads its own fixture.
::
++  step  form:(mare ,~)
++  in-order
  |=  forms=(list step)
  =/  m  (mare ,~)
  ^-  form:m
  ?~  forms  (pure:m ~)
  ;<  ~  bind:m  i.forms
  (in-order t.forms)
::  Every scry answers %.n unless a test installs its own gate.
::
++  no-scry  |=(path `!>(|))
::  Load the fixture as the public requester. Public Eyre requests are not
::  delivered as the owner.
::
++  setup-client
  |=  now=@da
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved=state-0  *state-0
  =.  workspace.saved  fixture:seed
  =.  project-clients.saved  issued:seed
  =.  book.workspace-notes.saved  `[~zod %fixture]
  =.  links.workspace-notes.saved
    %-  my
    ~[['document' [42 ~ ~]] ['private' [100 ~ ~]] ['other-document' [99 ~ ~]]]
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~nec, now now)))
  ;<  *  bind:m  (do-load head `!>(saved))
  (pure:m ~)
::
++  headers
  |=  cards=(list card)
  ^-  (list response-header:http)
  %+  murn  cards
  |=  =card
  ?.  ?=([%give %fact * %http-response-header *] card)  ~
  =/  [give=* fact=* paths=* mark=* data=vase]  card
  `!<(response-header:http data)
::
++  bodies
  |=  cards=(list card)
  ^-  (list @t)
  %+  murn  cards
  |=  =card
  ?.  ?=([%give %fact * %http-response-data *] card)  ~
  =/  [give=* fact=* paths=* mark=* data=vase]  card
  =/  body  (need !<((unit octs) data))
  `q.body
::
++  exercise
  |=  [req=inbound-request:eyre code=@ud now=@da]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~                bind:m  (setup-client now)
  ;<  old=vase         bind:m  get-save
  ;<  caz=(list card)  bind:m  (do-poke %handle-http-request !>([`@ta`%client-fixture req]))
  ;<  new=vase         bind:m  get-save
  =/  before  !<(state-0 old)
  =/  after  !<(state-0 new)
  =/  heads  (headers caz)
  ;<  ~  bind:m  (ex-equal !>((lent heads)) !>(1))
  ?>  ?=(^ heads)
  =/  header  i.heads
  =/  datas  (bodies caz)
  ;<  ~  bind:m  (ex-equal !>(?=(^ datas)) !>(&))
  ?>  ?=(^ datas)
  =/  value  (need (de:json:html i.datas))
  ;<  ~  bind:m  (ex-equal !>(status-code.header) !>(code))
  ;<  ~  bind:m  (ex-equal !>(after) !>(before))
  ;<  ~  bind:m  (ex-equal !>((levy caz |=(=card ?=(%give -.card)))) !>(&))
  ;<  ~  bind:m
    %+  ex-equal
      !>  %+  lien  headers.header
          |=([name=@t value=@t] &(=('cache-control' name) =('no-store' value)))
    !>(&)
  ;<  ~  bind:m
    %+  ex-equal
      !>((lien headers.header |=([name=@t value=@t] =('access-control-allow-origin' name))))
    !>(|)
  ?.  ?&  =(200 code)
          =('artifact' (string:j (need (de:json:html q:(need body.request.req))) 'action'))
      ==
    (pure:m ~)
  %+  ex-equal
    !>((string:j (need (get:j value 'content')) 'body'))
  !>('Only the selected native note was read')
::
++  test-http-read-does-not-change-any-durable-state-or-dispatch-effects
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (set-scry-gate no-scry)
  (exercise (request '{"action":"project","args":{"id":"project"}}') 200 ~2026.9.14)
++  test-http-foreign-project-and-task-are-unavailable
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (set-scry-gate no-scry)
  %-  in-order
  :~  (exercise (request '{"action":"project","args":{"id":"other"}}') 404 ~2026.9.14)
      %^  exercise
        (request '{"action":"task","args":{"id":"other-task"}}')
        404
      ~2026.9.14
  ==
++  test-http-writes-and-owner-surfaces-are-denied-before-effects
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  actions
    ^-  (list @t)
    ~['member' 'client-create' 'task-update' 'publish' 'review' 'sessions' 'harness_admin' 'tlon']
  ;<  ~  bind:m  (set-scry-gate no-scry)
  %-  in-order
  %+  turn  actions
  |=  action=@t
  %^  exercise
    (request (en:json:html (pairs:enjs:format ~[['action' %s action] ['args' %o ~]])))
    403
  ~2026.9.14
++  test-http-cookie-is-not-client-authority-and-expiry-is-live
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  req  (request '{"action":"help"}')
  ;<  ~  bind:m  (set-scry-gate no-scry)
  %-  in-order
  :~  %^  exercise
        req(header-list.request ~[['cookie' 'urbauth-~zod=not-a-project-key']])
        401
      ~2026.9.14
      (exercise req 401 ~2026.9.20)
      (exercise req(address [%ipv4 .10.0.0.1]) 403 ~2026.9.14)
      (exercise req(address [%ipv4 .10.0.0.1], secure &) 200 ~2026.9.14)
  ==
++  test-http-bounds-malformed-requests-and-exact-route
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  req  (request '{"action":"help"}')
  ;<  ~  bind:m  (set-scry-gate no-scry)
  %-  in-order
  :~  (exercise (request '{not-json') 400 ~2026.9.14)
      (exercise (request '{"action":"help","args":[]}') 400 ~2026.9.14)
      (exercise req(method.request %'GET') 405 ~2026.9.14)
      (exercise req(url.request '/harness-project/read?key=forbidden') 404 ~2026.9.14)
      (exercise req(body.request `[8.193 'x']) 413 ~2026.9.14)
  ==
::  Answers only the selected note (id 42) and the published listing; any
::  other native note scry blocks and fails the test.
::
++  selected-note-scry
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%gu *] path)  `!>(|)
  ?:  (lien path |=(part=@ta =(%notes-published part)))
    `!>(*(list published-record:n))
  ?.  (lien path |=(part=@ta =('42' part)))  ~
  ?:  (lien path |=(part=@ta =(%note-history part)))
    `!>(*(list note-revision:n))
  ?.  (lien path |=(part=@ta =(%note part)))  ~
  =/  current=note:n  *note:n
  =.  id.current  42
  =.  title.current  'Native selected body'
  =.  body-md.current  'Only the selected native note was read'
  =.  revision.current  1
  `!>(current)
++  test-notes-reads-use-only-selected-native-identities
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (set-scry-gate selected-note-scry)
  (exercise (request '{"action":"artifact","args":{"id":"document"}}') 200 ~2026.9.14)
++  test-unavailable-native-notes-do-not-return-cached-bodies
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (set-scry-gate no-scry)
  (exercise (request '{"action":"artifact","args":{"id":"document"}}') 503 ~2026.9.14)
++  test-metadata-lists-succeed-without-native-body-scries
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (set-scry-gate no-scry)
  %-  in-order
  :~  (exercise (request '{"action":"artifacts"}') 200 ~2026.9.14)
      (exercise (request '{"action":"proposals"}') 200 ~2026.9.14)
  ==
::  A client-create frame from the owner, or from an admin tool connection,
::  arriving on the ACP subscription that loading opens.
::
++  credential-owner
  |=  connection=@t
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved=state-0  *state-0
  =.  workspace.saved  fixture:seed
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now ~2026.9.14)))
  ;<  ~  bind:m  (set-scry-gate no-scry)
  ;<  *  bind:m  (do-load head `!>(saved))
  ;<  old=vase  bind:m  get-save
  =/  params
    %-  pairs:enjs:format
    ~[['action' %s 'client-create'] ['args' (args:seed 'new-key' key:seed 1)]]
  =/  frame
    %-  en:json:html
    %-  pairs:enjs:format
    ~[['jsonrpc' %s '2.0'] ['id' %n '1'] ['method' %s 'harness/workspace'] ['params' params]]
  =/  =update:v1:ac  [%messages connection %agent ~[[1 ~2026.9.14 frame]]]
  ;<  *  bind:m  (do-agent /acp/watch [~zod %acp] [%fact %acp-update-1 !>(update)])
  ;<  new=vase  bind:m  get-save
  =/  before  !<(state-0 old)
  =/  after  !<(state-0 new)
  =/  owner  ?=(~ (decode:admin connection))
  ;<  ~  bind:m  (ex-equal !>(~(wyt by project-clients.after)) !>(?:(owner 1 0)))
  ;<  ~  bind:m  (ex-equal !>(workspace-notes.after) !>(workspace-notes.before))
  ;<  ~  bind:m  (ex-equal !>(sessions.after) !>(sessions.before))
  ;<  ~  bind:m  (ex-equal !>(hands.after) !>(hands.before))
  ;<  ~  bind:m  (ex-equal !>(schedules.after) !>(schedules.before))
  ;<  ~  bind:m  (ex-equal !>(artifacts.workspace.after) !>(artifacts.workspace.before))
  %+  ex-equal
    !>(writes.workspace.after)
  !>(?:(owner +(writes.workspace.before) writes.workspace.before))
++  test-owner-can-issue-without-native-document-effects
  (eval-mare (credential-owner 'owner-client-fixture'))
++  test-administration-tool-cannot-mint-project-credentials
  (eval-mare (credential-owner (connection:admin ['model-session' 1 'admin-call'])))
--

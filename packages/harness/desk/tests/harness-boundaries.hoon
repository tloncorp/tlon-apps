::  Composition contracts: storage, wire shapes and grants remain independent
::  of the reducer. Use fixture credentials only; never inspect real secrets.
/-  h=harness, w=harness-workspace, hn=harness-notes, ws=harness-workspace-search,
    pc=harness-project-client, wc=harness-work-control, *harness-store
/-  hosted=harness-hosted, renew=harness-oauth
/-  c=harness-corpus
/+  *test, storage=harness-store, policy=harness-defaults, hj=harness-json, hp=harness-provider,
    ht=harness-tools, hl=harness
|%
::  A store that has already been through its one-time migrations.
++  current-store  (migrate-memory-prefixes:storage *state-0)
++  test-openai-endpoint-migration-preserves-auth-and-transcripts
  =/  saved=state-0  *state-0
  =/  cfg  builtin-config:policy
  =.  cfg  cfg(url 'https://api.openai.com/v1/chat/completions', model 'gpt-6-luna')
  =.  defaults.saved  cfg
  =.  peer-base.saved  `cfg
  =.  summary-models.saved  [`cfg `cfg]
  =.  sessions.saved
    %-  my
    ~[['fixture' [~[[%input-admitted [%user 'Keep me']] [%config-replaced cfg]] 3]]]
  =/  source=conversation:c  *conversation:c
  =.  source
    %=  source  sid  'fixture'  seen  log:(~(got by sessions.saved) 'fixture')  view
        (play:hl log:(~(got by sessions.saved) 'fixture'))
    ==
  =.  corpus.saved
    corpus.saved(names (my ~[['fixture' 0v1c]]), next 0v33, scopes (my ~[[0v1c source]]))
  =.  provider-keys.saved  (my ~[['openai' 'fixture-api'] ['openai-device' 'fixture-subscription']])
  =/  out  (load:storage !>(saved))
  =/  v  (play:hl log:(~(got by sessions.out) 'fixture'))
  ;:  weld
      (expect-eq !>('https://api.openai.com/v1/responses') !>(url.defaults.out))
      (expect-eq !>(defaults.out) !>(config.v))
      (expect-eq !>(`defaults.out) !>(peer-base.out))
      (expect-eq !>(provider-keys.saved) !>(provider-keys.out))
      (expect-eq !>(names.corpus.saved) !>(names.corpus.out))
      (expect-eq !>(0v33) !>(next.corpus.out))
      (expect-eq !>(config.v) !>(config.view:(~(got by scopes.corpus.out) 0v1c)))
      (expect-eq !>(~[[%user 'Keep me']]) !>(items.v))
      (expect-eq !>(out) !>((load:storage !>(out))))
  ==
++  test-bootstrap-enables-configurable-local-families
  =/  cfg  builtin-config:policy
  =/  expected=(list tool-grant:h)
    ~[[%clay ~] %web %curl %skills %skill-write %author %subagents %peers %corpus %workspace %tlon]
  (expect-eq !>(expected) !>(tools.cfg))
++  test-rehearsal-keeps-only-inherited-reads
  =/  out
    %-  rehearsal-tools:ht
    :~  [%clay /harness/lib]  %web  %skills  %skill-write  %author  %subagents  %peers  %mcp  %code
        %future-tool
    ==
  (expect-eq !>(`(list tool-grant:h)`~[[%clay /harness/lib] %skills]) !>(out))
++  test-rehearsal-does-not-add-read-authority
  (expect-eq !>(`(list term)`~) !>((rehearsal-tools:ht ~[%web %mcp])))
++  test-current-store-load-is-an-identity
  =/  saved=state-0  current-store
  =.  peer-budget-resets.saved  (my ~[[~nec 1.234]])
  =.  defaults.saved  builtin-config:policy
  =.  provider-keys.saved  (my ~[['fixture' 'test-secret']])
  =.  search-config.saved  [%searxng 'https://search.example']
  =.  search-requests.saved  (my ~[[['fixture' 'pending-call'] %searxng]])
  =.  sessions.saved  (my ~[['fixture' [~[[%config-replaced defaults.saved]] 37]]])
  (expect-eq !>(saved) !>((load:storage !>(saved))))
++  test-current-store-retains-workspace-evidence
  =/  saved=state-0  current-store
  =.  writes.workspace.saved  7
  =.  projects.workspace.saved  (my ~[['fixture' ['Keep project' '' 2 ~ |]]])
  =.  project-clients.saved
    (my ~[['retained' ['fixture' 'Revoked fixture' 0x123 ~2026.9.12 ~2026.9.13 `~2026.9.12]]])
  (expect-eq !>(saved) !>((load:storage !>(saved))))
++  test-store-rejects-an-invalid-version
  =/  saved  *state-0
  (expect-fail |.((load:storage !>([%1 +.saved]))))
++  test-store-rejects-a-malformed-envelope
  (expect-fail |.((load:storage !>([%0 ~]))))
++  test-current-store-retains-work-confirmations-and-owner-grants
  =/  saved=state-0  current-store
  =.  owners.work-controls.saved  (sy ~[['binding' 'alice']])
  =.  requests.work-controls.saved
    %-  my
    :~  :*  0v3
            :*  'conversation'  0v1  [%acp 'fixture']  `~zod  'task-create'  [%o ~]  0v2  ~2026.9.13
                %running  ~
            ==
        ==
    ==
  (expect-eq !>(saved) !>((load:storage !>(saved))))
++  test-saved-tool-policy-is-not-replaced-by-bootstrap-defaults
  =/  saved=state-0  current-store
  =/  cfg  builtin-config:policy
  =.  defaults.saved  cfg(tools ~[%author %skill-write [%mcp 'calendar']])
  =.  sessions.saved  (my ~[['fixture' [~[[%config-replaced defaults.saved]] 0]]])
  =.  skills.saved  (my ~[['existing' ['Keep me' 'Explicit owner instructions']]])
  =.  staged.saved  skills.saved
  (expect-eq !>(saved) !>((load:storage !>(saved))))
++  test-config-and-view-share-one-redacted-projection
  =/  cfg=config:h  builtin-config:policy
  =.  key.cfg  'test-secret'
  =/  config  (config-json:hj cfg)
  =/  view  (view-json:hj (play:hl ~[[%config-replaced cfg]]) ~s30)
  ?>  ?=([%o *] config)
  ?>  ?=([%o *] view)
  =/  matches
    %+  lien  ~(tap by p.config)
    |=  [name=@t value=json]
    !=(`value (~(get by p.view) name))
  (expect !>(&(!matches !(~(has by p.config) 'key') !(~(has by p.view) 'key'))))
++  test-schema-discovery-is-not-an-execution-grant
  %-  expect
  !>  ?&  (tool-granted:ht 'http_fetch' ~[%web])  !(tool-granted:ht 'http_fetch' ~[%clay])
          !(tool-granted:ht 'invented_tool' all-tools:ht)
      ==
++  test-work-and-peer-schemas-require-ordinary-json-objects
  =/  defs  (tool-defs:ht ~[%workspace %peers])
  ?>  ?=(%a -.defs)
  %-  zing
  %+  turn
    ^-  (list [@t @t (list @t)])
    :~  ['workspace' 'args' ~['action' 'args']]
        ['call_peer_tool' 'arguments' ~['ship' 'name' 'arguments']]
    ==
  |=  [name=@t key=@t required=(list @t)]
  =/  get
    |=  [j=json k=@t]
    ?>  ?=(%o -.j)
    (need (~(get by p.j) k))
  =/  found  (skim p.defs |=(j=json =([%s name] (get (get j 'function') 'name'))))
  ?>  ?=(^ found)
  =/  schema  i.found
  =/  params  (get (get schema 'function') 'parameters')
  ;:  weld
      (expect-eq !>(`json`[%s 'object']) !>((get (get (get params 'properties') key) 'type')))
      (expect-eq !>(`json`[%a (turn required |=(n=@t `json`[%s n]))]) !>((get params 'required')))
  ==
++  test-provider-catalog-retains-context-metadata
  =/  jon  (need (de:json:html '{"data":[{"id":"fixture","context_length":12345}]}'))
  (expect-eq !>(`(list model-info:hp)`~[['fixture' `12.345]]) !>((parse-model-list:hp jon)))
++  test-provider-catalog-uses-supported-maximum-not-default-working-window
  =/  jon
    %-  need
    %-  de:json:html
    '{"models":[{"slug":"gpt-6-luna","context_window":272000,"max_context_window":872000}]}'
  (expect-eq !>(`(list model-info:hp)`~[['gpt-6-luna' `872.000]]) !>((parse-model-list:hp jon)))
++  test-invalid-maximum-does-not-hide-valid-context-metadata
  =/  jon
    %-  need
    %-  de:json:html
    '{"data":[{"id":"zero","context_length":12345,"max_context_window":0},{"id":"null","context_window":12345,"max_context_window":null}]}'
  %+  expect-eq
    !>(`(list model-info:hp)`~[['zero' `12.345] ['null' `12.345]])
  !>((parse-model-list:hp jon))
--

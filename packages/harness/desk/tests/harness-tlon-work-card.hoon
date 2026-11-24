/-  h=harness, wc=harness-work-control, w=harness-workspace
/+  *test, card=harness-tlon-work-card, control=harness-work-control, j=harness-workspace-json,
    view=harness-work-view, help=harness-work-help, work=harness-workspace
|%
++  request
  ^-  request:wc
  :*  'social'  0v1  [%hand 'binding' 'tlon' 'dm/~zod' 'event' '~zod']  ~  'task-create'  [%o ~]
      0v2  ~2026.9.13  %pending  ~
  ==
++  test-only-a-head-receipt-enables-confirmation-buttons
  =/  r  request
  =/  db=state:wc  [~ (my ~[[0v3 r]])]
  =/  expected  `(encode:control 0v3 r)
  =/  text  (receipt:view (need expected))
  =/  log=(list event:h)  ~[[%command-completed 0v4 'work' text]]
  ;:  weld
      (expect-eq !>(`[0v3 &]) !>((select:card db 'social' 0v1 source.r 0v4 text log expected)))
      (expect-eq !>(`[0v3 |]) !>((select:card db 'social' 0v1 source.r 0v4 text ~ expected)))
      (expect-eq !>(`[0v3 |]) !>((select:card db 'social' 0v1 source.r 0v4 text log ~)))
      (expect-eq !>(~) !>((select:card *state:wc 'social' 0v1 source.r 0v4 text log expected)))
      (expect-eq !>(~) !>((select:card db 'social' 0v9 source.r 0v4 text log expected)))
      (expect-eq !>(~) !>((select:card db 'other' 0v1 source.r 0v4 text log expected)))
  ==
++  test-model-preparation-is-input-local-and-unambiguous
  =/  r  request
  =/  db=state:wc  [~ (my ~[[0v3 r] [0v4 r]])]
  =/  source=input-source:h  [%hand 'binding' 'tlon' 'dm/~zod' 'other-event' '~zod']
  ;:  weld
      (expect-eq !>(~) !>((select:card db 'social' 0v1 source.r 0v4 'model text' ~ ~)))
      (expect-eq !>(~) !>((select:card db 'social' 0v1 source 0v4 'model text' ~ ~)))
  ==
++  buttons
  |=  blob=@t
  ^-  (list @t)
  %+  murn  (components blob)
  |=  c=json
  ?.  |(=(`[%s 'Button'] (get:j c 'component')) =(`[%s 'Choice'] (get:j c 'component')))  ~
  `(string:j c 'id')
++  components
  |=  blob=@t
  ^-  (list json)
  =/  value  (need (de:json:html blob))
  ?>  ?=(%a -.value)
  ?>  ?=(^ p.value)
  =/  entry  i.p.value
  =/  messages  (need (get:j entry 'messages'))
  ?>  ?=(%a -.messages)
  =/  update  (need (get:j (rear p.messages) 'updateComponents'))
  =/  components  (need (get:j update 'components'))
  ?>  ?=(%a -.components)
  p.components
++  test-stale-expired-and-settled-cards-do-not-offer-confirmation
  =/  r  request
  ;:  weld
      %+  expect-eq
        !>(~['action-0' 'action-1' 'action-2'])
      !>((buttons (render:card 0v3 r & & (encode:control 0v3 r))))
      (expect-eq !>(~['inspect']) !>((buttons (render:card 0v3 r | & (encode:control 0v3 r)))))
      %+  expect-eq
        !>(~['action-0' 'action-1'])
      !>((buttons (render:card 0v3 r & | (encode:control 0v3 r))))
      %+  expect-eq
        !>(~['action-0'])
      !>((buttons (render:card 0v3 r(status %done) & & (encode:control 0v3 r(status %done)))))
      (expect !>((lth (met 3 (render:card 0v3 r & & (encode:control 0v3 r))) 32.768)))
  ==
++  test-browsing-is-a-head-command-not-model-prose
  =/  who=authority:w  [& [0v0 'Owner'] 0v0]
  =/  args  (need (arguments:view 'projects' ''))
  =/  text  (render:view 'projects' args (read:j *state:w who 'projects' args))
  =/  log=(list event:h)  ~[[%command-completed 0v4 'work' text]]
  =/  blob  (browse:card *state:w who 0v4 '/work projects' text log)
  ;:  weld
      (expect !>(?=(^ blob)))
      (expect-eq !>(~['action-0']) !>((buttons (need blob))))
      (expect-eq !>(~) !>((browse:card *state:w who 0v4 '/work projects' text ~)))
      (expect-eq !>(~) !>((browse:card *state:w who 0v5 '/work projects' text log)))
      (expect-eq !>(~) !>((browse:card *state:w who 0v4 'model says /work projects' text log)))
      (expect-eq !>(~) !>((browse:card *state:w who 0v4 '/work projects' 'different body' log)))
  ==
++  test-help-has-native-entry-buttons
  =/  who=authority:w  [& [0v0 'Owner'] 0v0]
  =/  text  overview:help
  =/  log=(list event:h)  ~[[%command-completed 0v4 'work' text]]
  ;:  weld
      (expect !>(?=(^ (browse:card *state:w who 0v4 '/work' text log))))
      (expect !>(?=(^ (browse:card *state:w who 0v4 '/work help {}' text log))))
  ==
++  test-navigation-utility-styling-does-not-relabel-records
  ;:  weld
      (expect-eq !>(`['New project' &]) !>((utility:card 'Create project' '/work project-new')))
      %+  expect-eq
        !>(`['Show archived' |])
      !>((utility:card 'Include archived projects' '/work projects all'))
      (expect-eq !>(~) !>((utility:card 'Create project' '/work project exact-record')))
      (expect-eq !>(~) !>((utility:card 'View tasks' '/work task exact-record')))
      (expect-eq !>(~) !>((utility:card 'A long record title' '/work project exact-record')))
      (expect-eq !>(~) !>((utility:card 'A long document name' '/work artifact doc')))
  ==
++  test-changed-read-offers-refresh-not-outdated-actions
  =/  who=authority:w  [& [0v0 'Owner'] 0v0]
  =/  args  (need (arguments:view 'projects' ''))
  =/  text  (render:view 'projects' args (read:j *state:w who 'projects' args))
  =/  log=(list event:h)  ~[[%command-completed 0v4 'work' text]]
  =/  changed  (apply:work *state:w who [%project-create 'new' 'New project' ''] ~2026.9.13)
  ?>  ?=(%& -.changed)
  =/  blob  (need (browse:card p.changed who 0v4 '/work projects' text log))
  ;:  weld
      (expect !>(?=(^ (find (trip 'Refresh view') (trip blob)))))
      (expect-eq !>(~) !>((find (trip '/work project new') (trip blob))))
  ==
++  test-navigation-record-and-utility-events-retain-their-commands
  =/  blob
    %^  navigation:card
      0v4
      'Heading\0aDetails'
    ~[['A record' '/work task exact-id'] ['Tasks' '/work tasks']]
  =/  nodes  (components blob)
  =/  choice  (need (find-node 'action-0' nodes))
  =/  button  (need (find-node 'action-1' nodes))
  =/  options  (need (get:j choice 'options'))
  ?>  ?=(%a -.options)
  =/  option  (snag 0 p.options)
  ;:  weld
      (expect-eq !>('Choice') !>((string:j choice 'component')))
      (expect-eq !>('action-0') !>((string:j option 'id')))
      (expect-eq !>('A record') !>((string:j option 'label')))
      (expect-eq !>('Button') !>((string:j button 'component')))
      (expect-eq !>('secondary') !>((string:j button 'variant')))
      (expect-eq !>('action-1-label') !>((string:j button 'child')))
      (expect-eq !>('tlon.sendMessage') !>((string:j (event option) 'name')))
      (expect-eq !>('tlon.sendMessage') !>((string:j (event button) 'name')))
      %+  expect-eq
        !>('/work task exact-id')
      !>((string:j (need (get:j (event option) 'context')) 'text'))
      (expect-eq !>('/work tasks') !>((string:j (need (get:j (event button) 'context')) 'text')))
  ==
++  find-node
  |=  [id=@t nodes=(list json)]
  |-  ^-  (unit json)
      ?~  nodes  ~
      ?:  =(id (string:j i.nodes 'id'))  `i.nodes
      $(nodes t.nodes)
++  event
  |=  node=json
  (need (get:j (need (get:j node 'action')) 'event'))
--

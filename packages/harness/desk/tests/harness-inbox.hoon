/-  w=harness-workspace, hh=harness-hand, cr=harness-cron, hn=harness-notes
/+  *test, inbox=harness-inbox, j=harness-workspace-json
|%
++  args
  |=  [state=@t kind=@t limit=@ud cursor=(unit @t)]
  ^-  json
  %-  pairs:enjs:format
  :~  ['state' %s state]  ['kind' %s kind]  ['limit' (numb:enjs:format limit)]
      ['cursor' (nullable:j cursor)]
  ==
++  task
  |=  [status=?(%open %claimed %blocked %done) at=@da]
  ^-  task:w
  ['project' 'Inspect the evidence' 'Return sources' 1 status ~ '' ~ at]
++  fixture
  ^-  state:w
  =/  db  *state:w
  =.  tasks.db
    %-  my
    :~  ['open' (task %open ~2026.9.1)]  ['claimed' (task %claimed ~2026.9.2)]
        ['blocked' (task %blocked ~2026.9.3)]  ['done' (task %done ~2026.9.4)]
    ==
  =/  =proposal:w
    :*  'artifact'  1  [0v1 'worker']  0v1  ~2026.9.5  ['Proposed change' 'PRIVATE-PROPOSAL-BODY' ~]
        'Review exact changes'  %pending  ~  ''  ~
    ==
  db(proposals (my ~[['proposal' proposal]]))
++  read
  |=  [db=state:w args=json]
  ^-  json
  =/  result  (read:inbox db *state:hh *(map @uv schedule:cr) *state:hn args ~2026.9.12)
  ?>  ?=(%& -.result)
  p.result
++  rows
  |=  value=json
  ^-  (list json)
  =/  items  (need (get:j value 'items'))
  ?>  ?=(%a -.items)
  p.items
++  test-claimed-is-not-running
  ;:  weld
      (expect-eq !>(%waiting) !>((task-state:inbox (task %claimed ~2026.9.1))))
      (expect-eq !>(%running) !>((input-state:inbox %running ~)))
      (expect-eq !>(%waiting) !>((input-state:inbox %completed ~)))
  ==
++  test-execution-and-delivery-stay-separate
  ;:  weld
      (expect-eq !>(%uncertain) !>((input-state:inbox %cancelled `%uncertain)))
      (expect-eq !>(%blocked) !>((input-state:inbox %completed `%failed)))
      (expect-eq !>(%waiting) !>((input-state:inbox %completed `%pending)))
      (expect-eq !>(%waiting) !>((input-state:inbox %completed `%claimed)))
      (expect-eq !>(%finished) !>((input-state:inbox %completed `%delivered)))
      (expect-eq !>(%blocked) !>((input-state:inbox %failed `%delivered)))
  ==
++  test-filter-before-pagination-with-global-counts
  =/  result  (read fixture (args 'attention' 'all' 1 ~))
  =/  listed  (rows result)
  =/  counts  (need (get:j result 'counts'))
  ;:  weld
      (expect-eq !>(1) !>((lent listed)))
      (expect-eq !>('proposal') !>((string:j (snag 0 listed) 'id')))
      (expect-eq !>(1) !>((number:j counts 'blocked' 0)))
      (expect-eq !>(1) !>((number:j counts 'approval' 0)))
      (expect-eq !>(2) !>((number:j counts 'waiting' 0)))
      (expect !>(?=(^ (optional:j result 'cursor'))))
  ==
++  test-cursor-is-bound-to-current-evidence-and-filters
  =/  first  (read fixture (args 'attention' 'all' 1 ~))
  =/  cursor  (optional:j first 'cursor')
  =/  second  (rows (read fixture (args 'attention' 'all' 1 cursor)))
  =/  changed  fixture
  =.  writes.changed  1
  =/  stale
    %:  read:inbox
      changed
      *state:hh
      *(map @uv schedule:cr)
      *state:hn
      (args 'attention' 'all' 1 cursor)
      ~2026.9.12
    ==
  =/  other
    %:  read:inbox
      fixture
      *state:hh
      *(map @uv schedule:cr)
      *state:hn
      (args 'all' 'all' 1 cursor)
      ~2026.9.12
    ==
  ;:  weld
      (expect-eq !>('blocked') !>((string:j (snag 0 second) 'id')))
      (expect !>(?=(%| -.stale)))
      (expect !>(?=(%| -.other)))
  ==
++  test-source-filter-counts-only-that-source
  =/  result  (read fixture (args 'all' 'task' 32 ~))
  =/  counts  (need (get:j result 'counts'))
  ;:  weld
      (expect-eq !>(4) !>((lent (rows result))))
      (expect-eq !>(0) !>((number:j counts 'approval' 0)))
      (expect-eq !>(2) !>((number:j counts 'waiting' 0)))
  ==
++  test-projection-does-not-copy-proposal-bodies
  =/  result  (read fixture (args 'all' 'proposal' 32 ~))
  =/  listed  (rows result)
  ;:  weld
      (expect-eq !>('Proposed change') !>((string:j (snag 0 listed) 'title')))
      (expect-eq !>('Review exact changes') !>((string:j (snag 0 listed) 'detail')))
      (expect-eq !>(`(unit json)`~) !>((get:j (snag 0 listed) 'body')))
      (expect-eq !>(`(unit json)`~) !>((get:j (snag 0 listed) 'content')))
  ==
++  test-input-time-keeps-admission-when-receipts-are-empty
  =/  =publication:hh
    [0v1 'binding' 'test' 'destination' 'session' %reply '' %pending '' '' ~]
  ;:  weld
      (expect-eq !>(~2026.9.1) !>((input-time:inbox ~2026.9.1 `publication `[0 ~])))
      %+  expect-eq
        !>(~2026.9.3)
      !>  %^  input-time:inbox
            ~2026.9.1
            `publication
          `[1 ~[[~2026.9.3 1 %uncertain 'Inspect evidence']]]
  ==
++  test-inbox-read-is-bounded-and-empty-is-explicit
  =/  empty  (read *state:w (args 'attention' 'all' 24 ~))
  =/  large
    %:  read:inbox
      fixture
      *state:hh
      *(map @uv schedule:cr)
      *state:hn
      (args 'all' 'all' 33 ~)
      ~2026.9.12
    ==
  ;:  weld
      (expect-eq !>(0) !>((lent (rows empty))))
      (expect-eq !>(`(unit @t)`~) !>((optional:j empty 'cursor')))
      (expect !>(?=(%| -.large)))
  ==
++  test-hand-schedule-and-notes-evidence
  =/  hands  *state:hh
  =.  observations.hands
    (my ~[[0v1 ['binding' 'event' 'actor' 'Requested work' ~2026.9.1 %completed]]])
  =.  outbox.hands
    %-  my
    :~  :*  0v1
            :*  0v1  'binding'  'tlon'  'destination'  'session'  %reply  'Delivery evidence'
                %uncertain  'worker'  ''  ~
            ==
        ==
    ==
  =/  job  *schedule:cr
  =.  state.job  %paused
  =.  prompt.job  'Scheduled work'
  =/  pending  *pending:hn
  =.  id.pending  0v2
  =.  uncertain.pending  &
  =.  value.pending  ['Pending document' 'PRIVATE-NOTES-BODY' ~]
  =/  native  *state:hn
  =.  pending.native  `pending
  =/  result
    %:  read:inbox
      *state:w
      hands
      (my ~[[0v3 job]])
      native
      (args 'attention' 'all' 32 ~)
      ~2026.9.12
    ==
  ?>  ?=(%& -.result)
  =/  listed  (rows p.result)
  =/  counts  (need (get:j p.result 'counts'))
  =/  input  (snag 0 (skim listed |=(row=json =('input' (string:j row 'kind')))))
  =/  note  (snag 0 (skim listed |=(row=json =('notes' (string:j row 'kind')))))
  ;:  weld
      (expect-eq !>(3) !>((lent listed)))
      (expect-eq !>(2) !>((number:j counts 'uncertain' 0)))
      (expect-eq !>(1) !>((number:j counts 'blocked' 0)))
      (expect-eq !>('completed') !>((string:j input 'execution')))
      (expect-eq !>('uncertain') !>((string:j input 'delivery')))
      (expect-eq !>('session') !>((string:j input 'sessionId')))
      (expect-eq !>(`(unit json)`[~ ~]) !>((get:j note 'at')))
      (expect-eq !>(`(unit json)`~) !>((get:j note 'body')))
  ==
++  test-input-destination-uses-publication-then-binding
  =/  hands  *state:hh
  =.  observations.hands
    (my ~[[0v1 ['binding' 'event' 'actor' 'Work' ~2026.9.1 %completed]]])
  =/  unbound
    %:  row-json:inbox
      [%waiting ~2026.9.1 %input '0v1']
      *state:w
      hands
      *(map @uv schedule:cr)
      *state:hn
    ==
  =.  bindings.hands
    (my ~[['binding' ['bound-hand' 'bound-address' 'bound-session' ~ &]]])
  =/  bound
    %:  row-json:inbox
      [%waiting ~2026.9.1 %input '0v1']
      *state:w
      hands
      *(map @uv schedule:cr)
      *state:hn
    ==
  =.  outbox.hands
    %-  my
    :~  :*  0v1
            :*  0v1  'binding'  'sent-hand'  'sent-address'  'sent-session'  %reply  'Evidence'
                %delivered  ''  ''  ~
            ==
        ==
    ==
  =/  published
    %:  row-json:inbox
      [%finished ~2026.9.1 %input '0v1']
      *state:w
      hands
      *(map @uv schedule:cr)
      *state:hn
    ==
  ;:  weld
      (expect-eq !>(`(unit json)`[~ ~]) !>((get:j unbound 'sessionId')))
      (expect-eq !>('') !>((string:j unbound 'hand')))
      (expect-eq !>('') !>((string:j unbound 'destination')))
      (expect-eq !>('bound-session') !>((string:j bound 'sessionId')))
      (expect-eq !>('bound-hand') !>((string:j bound 'hand')))
      (expect-eq !>('bound-address') !>((string:j bound 'destination')))
      (expect-eq !>('sent-session') !>((string:j published 'sessionId')))
      (expect-eq !>('sent-hand') !>((string:j published 'hand')))
      (expect-eq !>('sent-address') !>((string:j published 'destination')))
  ==
--

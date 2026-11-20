/-  w=harness-workspace, c=harness-work-control, hh=harness-hand
/+  *test, work=harness-workspace, control=harness-work-control
|%
++  owner  `authority:w`[& [0v0 'Owner'] 0v0]
++  agent  `authority:w`[| [0v1 'Agent'] 0v1]
++  step
  |=  [db=state:w who=authority:w act=action:w]
  =/  out  (apply:work db who act ~2026.9.14)
  ?>  ?=(%& -.out)
  p.out
++  refused
  |=  [db=state:w who=authority:w act=action:w]
  =/  out  (apply:work db who act ~2026.9.14)
  ?=(%| -.out)
++  version
  |=  db=state:w
  version:(~(got by tasks.db) 'task')
++  test-recreated-task-rejects-every-stale-mutation
  =/  first  (step *state:w agent [%task-create 'task' '' 'First task' ''])
  =/  deleted  (step first agent [%task-delete 'task' (version first)])
  =/  next  (step deleted agent [%task-create 'task' '' 'Different task' ''])
  =/  unrelated  (step next agent [%project-create 'other' 'Other work' ''])
  =/  mutations=(list action:w)
    :~  [%task-delete 'task' (version first)]  [%task-claim 'task' (version first)]
        [%task-assign 'task' (version first) ~]
        [%task-update 'task' (version first) %done 'Stale result' ~ ~]
    ==
  ;:  weld
      (expect !>((gth (version next) (version first))))
      (expect !>((levy mutations |=(act=action:w (refused next agent act)))))
      (expect-eq !>((version next)) !>((version unrelated)))
      (expect !>(!(refused unrelated agent [%task-claim 'task' (version next)])))
  ==
++  test-deletion-advances-past-the-record-version
  =/  db  (step *state:w agent [%task-create 'task' '' 'Task' ''])
  =/  task  (~(got by tasks.db) 'task')
  =.  tasks.db  (~(put by tasks.db) 'task' task(version 100))
  =/  removed  (step db agent [%task-delete 'task' 100])
  =/  next  (step removed agent [%task-create 'task' '' 'Replacement' ''])
  (expect !>((gth (version next) 100)))
++  test-private-result-links-do-not-gate-task-bookkeeping
  =/  db  (step *state:w owner [%artifact-create 'private' ~ ['Private' 'Secret' ~]])
  =/  db  (step db owner [%artifact-create 'other-private' ~ ['Other' 'Secret' ~]])
  =/  db  (step db agent [%task-create 'task' '' 'Track work' ''])
  =/  linked  (step db owner [%task-update 'task' (version db) %open '' `'private' ~])
  =/  changed
    %^  step
      linked
      agent
    :*  %task-update  'task'  (version linked)  %blocked  'Need more time'  `'private'
        `['Edited title' 'New brief' '']
    ==
  =/  cleared  (step changed agent [%task-update 'task' (version changed) %open '' ~ ~])
  ;:  weld
      (expect-eq !>(artifacts.linked) !>(artifacts.changed))
      (expect !>(!(can-read:work changed agent (~(got by artifacts.changed) 'private'))))
      %-  expect
      !>  %^  refused
            changed
            agent
          [%task-update 'task' (version changed) %done '' `'other-private' ~]
      %-  expect
      !>((refused cleared agent [%task-update 'task' (version cleared) %done '' `'private' ~]))
      (expect-eq !>(`'private') !>(artifact:(~(got by tasks.changed) 'task')))
  ==
++  fixture
  =/  db  (step *state:w owner [%project-create 'project' 'Project' ''])
  =/  db  (step db owner [%artifact-create 'doc' `'project' ['Document' 'Accepted content' ~]])
  (step db owner [%task-create 'task' '' 'Task' ''])
++  test-archived-result-does-not-block-task-updates
  =/  db  fixture
  =/  linked  (step db owner [%task-update 'task' (version db) %done 'Finished' `'doc' ~])
  =/  archived  (step linked owner [%artifact-archive 'doc' 1 &])
  =/  edited
    %^  step
      archived
      agent
    [%task-update 'task' (version archived) %done 'Clarified outcome' `'doc' ~]
  ;:  weld
      (expect-eq !>(artifacts.archived) !>(artifacts.edited))
      (expect-eq !>('Clarified outcome') !>(outcome:(~(got by tasks.edited) 'task')))
  ==
++  test-document-approval-depends-on-its-record-and-project-not-other-work
  =/  db  fixture
  =/  args  (pairs:enjs:format ~[['id' %s 'doc']])
  =/  before  (snapshot:control db 'artifact-save' args)
  =/  unrelated  (step db agent [%task-update 'task' (version db) %done 'Finished' ~ ~])
  =/  unrelated  (step unrelated owner [%artifact-create 'other' ~ ['Other' 'Unrelated' ~]])
  =/  member  (step unrelated owner [%member 'project' 1 0v1 `%reader])
  =/  content
    %^  step
      unrelated
      owner
    [%artifact-save 'doc' 1 `'project' ['Document' 'Changed body' ~]]
  ;:  weld
      (expect-eq !>(before) !>((snapshot:control unrelated 'artifact-save' args)))
      (expect !>(!=(before (snapshot:control member 'artifact-save' args))))
      (expect !>(!=(before (snapshot:control content 'artifact-save' args))))
  ==
++  test-project-fence-does-not-read-an-artifact-with-the-same-id
  =/  db  fixture
  =/  args  (pairs:enjs:format ~[['id' %s 'project']])
  =/  before  (snapshot:control db 'project-edit' args)
  =/  unrelated  (step db owner [%artifact-create 'project' ~ ['Unrelated namespace' 'Body' ~]])
  =/  edited  (step unrelated owner [%project-edit 'project' 1 'Changed project' '' |])
  ;:  weld
      (expect-eq !>(before) !>((snapshot:control unrelated 'project-edit' args)))
      (expect !>(!=(before (snapshot:control edited 'project-edit' args))))
  ==
++  request
  ^-  request:c
  ['owner' 0v1 [%poke ~zod] `~zod 'artifact-save' [%o ~] 0v2 ~2026.9.14..01.00.00 %pending ~]
++  test-delivery-and-hand-access-bind-only-their-destination-state
  =/  db  fixture
  =/  hands=state:hh  *state:hh
  =/  =binding:hh  ['fixture' 'dm/alice' 'target' ~['alice'] &]
  =.  bindings.hands  (my ~[['binding' binding]])
  =/  names=(map @t @uv)  (my ~[['target' 0v1]])
  =/  owners=(set [binding=@t actor=@t])  ~
  =/  args
    %-  pairs:enjs:format
    :~  ['id' %s 'task']  ['artifact' %s 'doc']  ['revision' %n '1']  ['binding' %s 'binding']
        ['actor' %s 'alice']
    ==
  =/  before  (fence:control db hands names owners 'task-reply' args)
  =/  unrelated  hands(bindings (~(put by bindings.hands) 'other' binding))
  =/  moved  hands(bindings (~(put by bindings.hands) 'binding' binding(address 'dm/bob')))
  =/  reincarnated  (~(put by names) 'target' 0v2)
  =/  granted  (~(put in owners) ['binding' 'alice'])
  =/  access-before  (fence:control db hands names owners 'hand-access' args)
  =/  access-after  (fence:control db hands names granted 'hand-access' args)
  ;:  weld
      (expect-eq !>(before) !>((fence:control db unrelated names owners 'task-reply' args)))
      (expect-eq !>(before) !>((fence:control db hands names granted 'task-reply' args)))
      (expect !>(!=(before (fence:control db moved names owners 'task-reply' args))))
      (expect !>(!=(before (fence:control db hands reincarnated owners 'task-reply' args))))
      (expect !>(!=(access-before access-after)))
  ==
++  ledger
  |=  r=request:c
  ^-  state:c
  [~ (~(gas by *(map @uv request:c)) (turn (gulf 1 capacity:control) |=(id=@uv [id r])))]
++  test-capacity-counts-active-work-and-preserves-history
  =/  r  request
  =/  done  (ledger r(status %done, result `[%& [%s 'Receipt']]))
  =/  admitted  (prepare:control done 0v10000 r ~2026.9.14)
  =/  expired  (prepare:control (ledger r(expires ~2026.9.13)) 0v10000 r ~2026.9.14)
  =/  rejected  (prepare:control (ledger r(status %rejected)) 0v10000 r ~2026.9.14)
  =/  pending  (prepare:control (ledger r) 0v10000 r ~2026.9.14)
  =/  running
    %:  prepare:control
      (ledger r(status %running, expires ~2026.9.13))
      0v10000
      r
      ~2026.9.14
    ==
  ?>  ?=(%& -.admitted)
  ;:  weld
      (expect-eq !>((~(got by requests.done) 0v1)) !>((~(got by requests.p.admitted) 0v1)))
      (expect-eq !>(+(capacity:control)) !>(~(wyt by requests.p.admitted)))
      (expect !>(?=(%& -.expired)))
      (expect !>(?=(%& -.rejected)))
      (expect !>(?=(%| -.pending)))
      (expect !>(?=(%| -.running)))
  ==
++  test-historical-reply-deduplication-survives-new-admission
  =/  r  request
  =/  args
    %-  pairs:enjs:format
    :~  ['id' %s 'task']  ['artifact' %s 'doc']  ['revision' %n '1']  ['binding' %s 'binding']
        ['actor' %s 'alice']
    ==
  =/  db  (ledger r(status %rejected))
  =.  requests.db  (~(put by requests.db) 0v1 r(action 'task-reply', args args, status %done))
  =/  out  (prepare:control db 0v10000 r ~2026.9.14)
  ?>  ?=(%& -.out)
  (expect-eq !>(`0v1) !>((reply-request:control p.out args)))
--

/-  w=harness-workspace, s=harness-workspace-search
/+  *test, idx=harness-workspace-search, work=harness-workspace
|%
++  owner  `authority:w`[& [0v0 'Owner'] 0v0]
++  step
  |=  [db=state:w act=action:w]
  ^-  state:w
  =/  out  (apply:work db owner act ~2026.9.11)
  ?>  ?=(%& -.out)
  p.out
++  fixture
  =/  db  (step *state:w [%artifact-create 'doc' ~ ['Title' 'alpha shared' ~]])
  (step db [%artifact-save 'doc' 1 ~ ['Title' 'beta shared' ~]])
++  indexed
  (work:idx (sync:idx *state:s *state:w fixture ~2026.9.11) fixture 8 65.536)
++  test-multiple-revisions-collapse-before-pagination
  =/  result  (search:idx indexed 'shared')
  ;:  weld
      (expect-eq !>(1) !>(~(wyt by result)))
      (expect-eq !>((silt `(list @ud)`~[1 2])) !>((~(got by result) [%artifact 'doc'])))
  ==
++  test-all-query-words-must-match-one-revision
  (expect-eq !>(*matches:s) !>((search:idx indexed 'alpha beta')))
++  test-old-version-matches-remain-searchable
  %+  expect-eq
    !>((silt `(list @ud)`~[1]))
  !>((~(got by (search:idx indexed 'alpha')) [%artifact 'doc']))
++  test-changed-metadata-is-hidden-until-reindexed
  =/  db  fixture
  =/  art  (~(got by artifacts.db) 'doc')
  =/  rev  (~(got by revisions.art) 2)
  =.  artifacts.db
    %+  ~(put by artifacts.db)
      'doc'
    art(revisions (~(put by revisions.art) 2 rev(value value.rev(title 'Renamed'))))
  =/  pending  (sync:idx indexed fixture db ~2026.9.12)
  =/  ready  (work:idx pending db 8 65.536)
  ;:  weld
      (expect-eq !>(1) !>(~(wyt by queued.pending)))
      (expect !>(!(live:idx pending db [[%artifact 'doc'] 2])))
      (expect !>((live:idx ready db [[%artifact 'doc'] 2])))
      %+  expect-eq
        !>((silt `(list @ud)`~[1]))
      !>((~(got by (search:idx ready 'title')) [%artifact 'doc']))
  ==
++  test-project-and-task-text-are-indexed-in-bounded-work
  =/  db  (step fixture [%project-create 'project' 'Community orchard' 'A shared harvest'])
  =/  db  (step db [%task-create 'task' 'project' 'Plan orchard' 'Estimate supplies'])
  =/  pending  (sync:idx *state:s *state:w db ~2026.9.11)
  =/  partial  (work:idx pending db 1 65.536)
  =/  ready  (work:idx partial db 8 65.536)
  ;:  weld
      (expect-eq !>(3) !>(~(wyt by queued.partial)))
      (expect-eq !>(2) !>(~(wyt by (search:idx ready 'orchard'))))
  ==
--

/-  w=harness-workspace
/+  *test, work=harness-workspace, j=harness-workspace-json, client=harness-project-client
|%
++  owner  `authority:w`[& [0v0 'Owner'] 0v0]
++  step
  |=  [db=state:w act=action:w at=@da]
  ^-  state:w
  =/  out  (apply:work db owner act at)
  ?>  ?=(%& -.out)
  p.out
++  ids
  |=  [db=state:w action=@t args=json]
  ^-  (list @t)
  =/  page  (read:j db owner action args)
  =/  items  (need (get:j page 'items'))
  ?>  ?=(%a -.items)
  (turn p.items |=(row=json (string:j row 'id')))
++  fixture
  ^-  state:w
  =/  db  (step *state:w [%project-create 'older' 'Older' ''] ~2026.9.10)
  =/  db  (step db [%project-create 'newer' 'Newer' ''] ~2026.9.11)
  =/  db  (step db [%artifact-create 'old-doc' `'older' ['Old' 'Body' ~]] ~2026.9.10)
  =/  db  (step db [%artifact-create 'new-doc' `'older' ['New' 'Body' ~]] ~2026.9.11)
  =/  db  (step db [%task-create 'old-task' 'older' 'Old' ''] ~2026.9.10)
  (step db [%task-create 'new-task' 'older' 'New' ''] ~2026.9.11)
++  test-newest-records-come-first-before-pagination
  =/  first  (pairs:enjs:format ~[['limit' %n '1']])
  =/  second  (pairs:enjs:format ~[['limit' %n '1'] ['offset' %n '1']])
  ;:  weld
      (expect-eq !>(~['newer']) !>((ids fixture 'projects' first)))
      (expect-eq !>(~['older']) !>((ids fixture 'projects' second)))
      (expect-eq !>(~['new-doc']) !>((ids fixture 'artifacts' first)))
      (expect-eq !>(~['old-doc']) !>((ids fixture 'artifacts' second)))
      (expect-eq !>(~['new-task']) !>((ids fixture 'tasks' first)))
      (expect-eq !>(~['old-task']) !>((ids fixture 'tasks' second)))
  ==
++  test-edits-move-records-first-without-depending-on-audit-retention
  =/  db  (step fixture [%project-edit 'older' 1 'Edited' '' |] ~2026.9.12)
  =/  db  (step db [%artifact-save 'old-doc' 1 `'older' ['Edited' 'Body' ~]] ~2026.9.12)
  =/  version  version:(~(got by tasks.db) 'old-task')
  =/  db  (step db [%task-update 'old-task' version %done 'Finished' ~ ~] ~2026.9.12)
  =.  history.db  ~
  ;:  weld
      (expect-eq !>(~['older' 'newer']) !>((ids db 'projects' [%o ~])))
      (expect-eq !>(~['old-doc' 'new-doc']) !>((ids db 'artifacts' [%o ~])))
      (expect-eq !>(~['old-task' 'new-task']) !>((ids db 'tasks' [%o ~])))
  ==
++  test-ties-are-stable-and-filtering-precedes-pagination
  =/  db  (step fixture [%project-create 'alpha' 'Alpha' ''] ~2026.9.11)
  =/  db  (step db [%task-create 'foreign-task' 'newer' 'Foreign' ''] ~2026.9.12)
  =/  args  (pairs:enjs:format ~[['project' %s 'older'] ['limit' %n '1']])
  ;:  weld
      (expect-eq !>(~['alpha' 'newer' 'older']) !>((ids db 'projects' [%o ~])))
      (expect-eq !>(~['new-task']) !>((ids db 'tasks' args)))
      (expect-eq !>(~['new-doc' 'old-doc']) !>((ids (view:client db 'older') 'artifacts' [%o ~])))
      %+  expect-eq
        !>(`(unit @da)`~)
      !>((~(get by recency:(view:client db 'older')) [%project 'newer']))
  ==
++  test-proposal-decisions-count-as-recent-activity
  =/  db  (step fixture [%propose 'first' 'old-doc' 1 ['Proposed' 'Body' ~] 'Review'] ~2026.9.12)
  =/  db  (step db [%propose 'second' 'new-doc' 1 ['Proposed' 'Body' ~] 'Review'] ~2026.9.13)
  =/  decided  (step db [%review 'first' | 'Keep the current document'] ~2026.9.14)
  ;:  weld
      (expect-eq !>(~['second' 'first']) !>((ids db 'proposals' [%o ~])))
      (expect-eq !>(~['first' 'second']) !>((ids decided 'proposals' [%o ~])))
      (expect-eq !>(~['old-doc' 'new-doc']) !>((ids decided 'artifacts' [%o ~])))
  ==
++  test-revisions-use-numeric-newest-first-order
  =/  db  fixture
  =/  art  (~(got by artifacts.db) 'old-doc')
  =/  rev  (~(got by revisions.art) 1)
  =.  revisions.art  (my ~[[1 rev] [2 rev] [3 rev] [4 rev] [12 rev]])
  =.  artifacts.db  (~(put by artifacts.db) 'old-doc' art(head 12))
  =/  page  (read:j db owner 'revisions' (pairs:enjs:format ~[['id' %s 'old-doc']]))
  =/  items  (need (get:j page 'items'))
  ?>  ?=(%a -.items)
  (expect-eq !>(~[12 4 3 2 1]) !>((turn p.items |=(row=json (number:j row 'revision' 0)))))
--

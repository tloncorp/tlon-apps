/-  w=harness-workspace
/+  *test, work=harness-workspace, j=harness-workspace-json, tools=harness-tools
|%
++  owner  `authority:w`[& [0v0 'Owner'] 0v0]
++  worker  `authority:w`[| [0v1 'Worker'] 0v1]
++  maintainer  `authority:w`[| [0v2 'Maintainer'] 0v2]
++  step
  |=  [db=state:w who=authority:w act=action:w]
  ^-  state:w
  =/  out  (apply:work db who act ~2026.9.13)
  ?>  ?=(%& -.out)
  p.out
++  refused
  |=  [db=state:w who=authority:w act=action:w]
  =/  out  (apply:work db who act ~2026.9.13)
  ?=(%| -.out)
++  fixture
  =/  db  (step *state:w owner [%project-create 'project' 'Shared work' 'Purpose'])
  =/  db  (step db owner [%member 'project' 1 0v1 `%contributor])
  =/  db  (step db owner [%member 'project' 2 0v2 `%maintainer])
  =/  db  (step db owner [%task-create 'task' 'project' 'Inspect' 'Return evidence'])
  (step db worker [%task-claim 'task' version:(~(got by tasks.db) 'task')])
++  test-maintainer-edits-details-but-never-access-or-archive
  =/  db  fixture
  =/  edited  (step db maintainer [%project-edit 'project' 3 'Updated purpose' 'Keep the scope' |])
  =/  denied
    %+  turn
      ^-  (list action:w)
      ~[[%member 'project' 3 0v3 `%maintainer] [%project-edit 'project' 3 'Shared work' '' &]]
    |=  act=action:w
    (refused db maintainer act)
  ;:  weld
      (expect !>((levy denied |=(ok=? ok))))
      (expect-eq !>('Updated purpose') !>(title:(~(got by projects.edited) 'project')))
      (expect-eq !>(`actor:w`[0v2 'Maintainer']) !>(by:(snag 0 history.edited)))
      (expect !>((refused db worker [%project-edit 'project' 3 'No' '' |])))
  ==
++  test-maintainer-coordinates-without-impersonating-the-claimant
  =/  db  fixture
  =/  blocked
    %^  step
      db
      maintainer
    [%task-update 'task' version:(~(got by tasks.db) 'task') %blocked 'Waiting for evidence' ~ ~]
  =/  released
    %^  step
      blocked
      maintainer
    [%task-update 'task' version:(~(got by tasks.blocked) 'task') %open 'Available again' ~ ~]
  ;:  weld
      %+  expect-eq
        !>(`(unit actor:w)`[~ [0v1 'Worker']])
      !>(claimant:(~(got by tasks.blocked) 'task'))
      (expect-eq !>(`actor:w`[0v2 'Maintainer']) !>(by:(snag 0 history.blocked)))
      (expect-eq !>(`(unit actor:w)`~) !>(claimant:(~(got by tasks.released) 'task')))
      %-  expect
      !>  %^  refused
            blocked
            maintainer
          [%task-update 'task' version:(~(got by tasks.db) 'task') %done 'Stale' ~ ~]
  ==
++  test-task-coordination-does-not-use-document-membership
  =/  db  fixture
  =/  revoked  (step db owner [%member 'project' 3 0v2 `%reader])
  =/  stranger=authority:w  [| [0v3 'Maintainer'] 0v3]
  ;:  weld
      %-  expect
      !>  ?!  %^  refused
                revoked
                maintainer
              [%task-update 'task' version:(~(got by tasks.revoked) 'task') %done 'Checked' ~ ~]
      %-  expect
      !>  ?!  %^  refused
                db
                stranger
              [%task-update 'task' version:(~(got by tasks.db) 'task') %done 'Checked' ~ ~]
      (expect !>((refused revoked maintainer [%project-edit 'project' 4 'No' '' |])))
  ==
++  test-maintainer-children-use-live-root-scope-not-new-approval-power
  =/  child=authority:w  [| [0v9 'Live child'] 0v2]
  =/  db
    %^  step
      fixture
      child
    [%artifact-create 'draft' `'project' ['Proposed work' 'Exact content' ~]]
  =/  denied
    %+  turn
      ^-  (list action:w)
      :~  [%review 'draft' & 'Approve']  [%review 'draft' | 'Reject']
          [%artifact-save 'draft' 0 `'project' ['Replace' 'No' ~]]
          [%publish 'draft' 1 0 0 'leak' 'No']  [%unpublish 'draft' 0]
          [%artifact-archive 'draft' 0 &]
      ==
    |=  act=action:w
    (refused db child act)
  ;:  weld
      (expect !>((levy denied |=(ok=? ok))))
      (expect-eq !>(by.child) !>(by:(~(got by proposals.db) 'draft')))
      (expect-eq !>(0) !>(head:(~(got by artifacts.db) 'draft')))
  ==
++  test-unclaimed-work-updates-with-agent-tool-authority
  =/  db  (step fixture owner [%task-create 'note' 'project' 'Research' ''])
  =/  done
    %^  step
      db
      worker
    [%task-update 'note' version:(~(got by tasks.db) 'note') %done 'Answered in chat' ~ ~]
  =/  stranger=authority:w  [| [0v7 'Another conversation'] 0v7]
  ;:  weld
      (expect-eq !>(%done) !>(status:(~(got by tasks.done) 'note')))
      (expect-eq !>(~) !>(artifact:(~(got by tasks.done) 'note')))
      %-  expect
      !>  ?!  %^  refused
                db
                stranger
              [%task-update 'note' version:(~(got by tasks.db) 'note') %done 'Checked' ~ ~]
      %-  expect
      !>  %^  refused
            done
            worker
          [%task-update 'note' version:(~(got by tasks.db) 'note') %open 'Stale' ~ ~]
  ==
++  test-role-does-not-add-resource-or-administration-grants
  ;:  weld
      (expect !>((model-action:j 'project-edit')))
      (expect !>(!(model-action:j 'member')))
      (expect !>(!(model-action:j 'review')))
      (expect !>(!(model-action:j 'client-create')))
      (expect !>(!(tool-granted:tools 'tlon' ~[%workspace])))
      (expect !>(!(tool-granted:tools 'harness_admin' ~[%workspace])))
      (expect !>((tool-granted:tools 'workspace' (scheduled-tools:tools ~[%workspace]))))
  ==
++  test-json-decoder-admits-only-the-three-known-roles
  =/  args  (need (de:json:html '{"id":"project","version":3,"scope":"0v2","role":"maintainer"}'))
  =/  decoded  (decode:j fixture 'member' args '')
  =/  invalid  (need (de:json:html '{"id":"project","version":3,"scope":"0v2","role":"owner"}'))
  =/  refused  (mule |.((decode:j fixture 'member' invalid '')))
  ;:  weld
      (expect-eq !>(`action:w`[%member 'project' 3 0v2 `%maintainer]) !>(decoded))
      (expect !>(?=(%| -.refused)))
  ==
--

/-  w=harness-workspace
/+  *test, work=harness-workspace, j=harness-workspace-json, view=harness-work-view
|%
++  agent  `authority:w`[| [0v1 'Research'] 0v1]
++  other  `authority:w`[| [0v2 'Writing'] 0v2]
++  step
  |=  [db=state:w who=authority:w act=action:w]
  =/  out  (apply:work db who act ~2026.9.14)
  ?>  ?=(%& -.out)
  p.out
++  refused
  |=  [db=state:w who=authority:w act=action:w]
  =/  out  (apply:work db who act ~2026.9.14)
  ?=(%| -.out)
++  test-task-stands-alone-and-agents-coordinate-without-membership
  =/  args  (need (de:json:html '{"id":"task","title":"Check the forecast"}'))
  =/  db  (step *state:w agent (decode:j *state:w 'task-create' args ''))
  =/  assigned  (step db other [%task-assign 'task' 1 `[0v1 'Research']])
  =/  done  (step assigned other [%task-update 'task' 2 %done 'Answered in the conversation' ~ ~])
  =/  record  (read:j done agent 'task' (pairs:enjs:format ~[['id' %s 'task']]))
  =/  links  (all-actions:view 'task' [%o ~] record)
  ;:  weld
      (expect-eq !>(~) !>(projects.done))
      (expect-eq !>(~) !>((need (get:j record 'project'))))
      %+  expect-eq
        !>(`(unit actor:w)`[~ [0v1 'Research']])
      !>(claimant:(~(got by tasks.done) 'task'))
      (expect-eq !>(`actor:w`[0v2 'Writing']) !>(by:(snag 0 history.done)))
      (expect-eq !>(%done) !>(status:(~(got by tasks.done) 'task')))
      (expect !>(!(lien links |=([label=@t command=@t] =('Open project' label)))))
      (expect !>((refused done agent [%task-update 'task' 1 %open '' ~ ~])))
      (expect !>((refused db [| [0v0 'No agent'] 0v0] [%task-update 'task' 1 %done '' ~ ~])))
  ==
++  test-project-groups-work-without-granting-document-access
  =/  db  (step *state:w agent [%project-create 'project' 'Research' ''])
  =/  db  (step db other [%task-create 'task' 'project' 'Compare sources' ''])
  =/  assigned
    %^  step
      db
      agent
    [%task-assign 'task' version:(~(got by tasks.db) 'task') `[0v2 'Writing']]
  =/  unassigned
    %^  step
      assigned
      other
    [%task-assign 'task' version:(~(got by tasks.assigned) 'task') ~]
  ;:  weld
      (expect-eq !>(~) !>(members:(~(got by projects.unassigned) 'project')))
      (expect-eq !>(~) !>(claimant:(~(got by tasks.unassigned) 'task')))
      (expect-eq !>(~) !>(artifacts.unassigned))
      %-  expect
      !>((refused assigned agent [%task-claim 'task' version:(~(got by tasks.assigned) 'task')]))
      (expect !>(!(can-contribute:work unassigned other 'project')))
      %-  expect
      !>((refused db other [%artifact-create 'private' `'project' ['Private' 'No grant' ~]]))
  ==
++  test-task-metadata-preserves-assignment-and-rejects-invalid-details
  =/  db  (step *state:w agent [%task-create 'task' '' 'First title' ''])
  =/  db  (step db other [%task-assign 'task' 1 `[0v1 'Research']])
  =/  args  (need (de:json:html '{"id":"task","version":2,"title":"Edited title"}'))
  =/  edited  (step db other (decode:j db 'task-update' args ''))
  =/  blank  (need (de:json:html '{"id":"task","version":3,"title":""}'))
  =/  missing  (need (de:json:html '{"id":"task","version":3,"project":"missing"}'))
  ;:  weld
      %+  expect-eq
        !>(claimant:(~(got by tasks.db) 'task'))
      !>(claimant:(~(got by tasks.edited) 'task'))
      (expect !>((refused edited other (decode:j edited 'task-update' blank ''))))
      (expect !>((refused edited other (decode:j edited 'task-update' missing ''))))
  ==
++  test-task-details-and-deletion-are-versioned-bookkeeping
  =/  db  (step *state:w agent [%project-create 'project' 'Research' ''])
  =/  db  (step db agent [%task-create 'task' '' 'First title' 'First brief'])
  =/  args
    %-  need
    %-  de:json:html
    '{"id":"task","version":2,"title":"Edited title","description":"Edited brief","project":"project"}'
  =/  edited  (step db other (decode:j db 'task-update' args ''))
  =/  moved  (~(got by tasks.edited) 'task')
  =/  clear  (need (de:json:html '{"id":"task","version":3,"project":null,"description":""}'))
  =/  ungrouped  (step edited agent (decode:j edited 'task-update' clear ''))
  =/  task  (~(got by tasks.ungrouped) 'task')
  =/  removed  (step ungrouped other [%task-delete 'task' version.task])
  ;:  weld
      (expect-eq !>('Edited title') !>(title.moved))
      (expect-eq !>('Edited brief') !>(description.moved))
      (expect-eq !>('project') !>(project.moved))
      (expect-eq !>(%open) !>(status.moved))
      (expect-eq !>(~) !>(members:(~(got by projects.edited) 'project')))
      (expect-eq !>('') !>(project.task))
      (expect-eq !>('') !>(description.task))
      (expect-eq !>('Edited title') !>(title.task))
      (expect !>((refused ungrouped agent [%task-delete 'task' version.moved])))
      (expect !>((refused ungrouped [| [0v0 'No agent'] 0v0] [%task-delete 'task' version.task])))
      (expect-eq !>(~) !>(tasks.removed))
      (expect-eq !>(projects.ungrouped) !>(projects.removed))
      (expect-eq !>(artifacts.ungrouped) !>(artifacts.removed))
      (expect-eq !>('task-delete') !>(action:(snag 0 history.removed)))
  ==
--

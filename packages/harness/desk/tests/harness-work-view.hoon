/-  w=harness-workspace
/+  *test, view=harness-work-view, j=harness-workspace-json, work=harness-workspace,
    copy=harness-work-copy
|%
++  owner  `authority:w`[& [0v0 'Owner'] 0v0]
++  step
  |=  [db=state:w act=action:w]
  =/  out  (apply:work db owner act ~2026.9.13)
  ?>  ?=(%& -.out)
  p.out
++  fixture
  =/  db  (step *state:w [%project-create 'active' 'Weekend plans' 'A small project'])
  =/  db  (step db [%project-create 'archive' 'Archived project' ''])
  =/  db  (step db [%task-create 'active-task' 'active' 'Packing list' 'Bring a raincoat'])
  =/  db  (step db [%task-create 'archive-task' 'archive' 'Archived task' ''])
  (step db [%project-edit 'archive' 1 'Archived project' '' &])
++  items
  |=  value=json
  =/  rows  (need (get:j value 'items'))
  ?>  ?=(%a -.rows)
  p.rows
++  test-creation-needs-a-title-and-keeps-it-literal
  =/  project  (need (creation:view 'project-new' 'Weekend "plans"'))
  =/  task  (need (creation:view 'task-new' 'Draft a packing list'))
  ;:  weld
      (expect-eq !>(~) !>((creation:view 'project-new' '')))
      (expect-eq !>(~) !>((creation:view 'task-new' '')))
      (expect-eq !>('project-create') !>(action.project))
      (expect-eq !>('Weekend "plans"') !>((string:j args.project 'title')))
      (expect-eq !>(~) !>((optional:j args.task 'project')))
      (expect-eq !>('Draft a packing list') !>((string:j args.task 'title')))
  ==
++  test-actions-retain-project-and-task-version
  =/  args  (need (arguments:view 'project' 'active'))
  =/  links  (actions:view 'project' args (read:j fixture owner 'project' args))
  =/  task-args  (need (arguments:view 'task' 'active-task'))
  =/  task-links  (actions:view 'task' task-args (read:j fixture owner 'task' task-args))
  ;:  weld
      (expect !>((lien links |=(link=[label=@t command=@t] =('View tasks' label.link)))))
      (expect-eq !>((command:view 'task' task-args)) !>(+:(snag 0 task-links)))
      (expect-eq !>(2) !>((lent task-links)))
  ==
++  test-human-arguments-keep-json-filters-and-offer-shortcuts
  ;:  weld
      (expect-eq !>((arguments:view 'projects' '')) !>((arguments:view 'projects' '{}')))
      %+  expect-eq
        !>((need (de:json:html '{"includeArchived":true}')))
      !>((need (arguments:view 'tasks' 'all')))
      %+  expect-eq
        !>((need (de:json:html '{"id":"active"}')))
      !>((need (arguments:view 'project' 'active')))
      %+  expect-eq
        !>((cat 3 '/work project ' (ref:copy 'p' 'active')))
      !>((command:view 'project' (need (arguments:view 'project' 'active'))))
      (expect-eq !>(~) !>((arguments:view 'projects' '[]')))
  ==
++  test-archive-filter-precedes-pagination-and-retains-machine-history
  =/  args  (need (de:json:html '{"includeArchived":false,"limit":1}'))
  =/  projects  (read:j fixture owner 'projects' args)
  =/  tasks  (read:j fixture owner 'tasks' args)
  =/  stranger=authority:w  [| [0v3 'Stranger'] 0v3]
  ;:  weld
      (expect-eq !>('active') !>((string:j (snag 0 (items projects)) 'id')))
      (expect-eq !>('active-task') !>((string:j (snag 0 (items tasks)) 'id')))
      (expect-eq !>(`(unit json)`[~ ~]) !>((get:j projects 'nextOffset')))
      (expect-eq !>(`(unit json)`[~ ~]) !>((get:j tasks 'nextOffset')))
      (expect-eq !>(2) !>((lent (items (read:j fixture owner 'projects' [%o ~])))))
      (expect-eq !>(2) !>((lent (items (read:j fixture owner 'tasks' [%o ~])))))
      (expect-eq !>(1) !>((lent (items (read:j fixture stranger 'projects' args)))))
      (expect-eq !>(1) !>((lent (items (read:j fixture stranger 'tasks' args)))))
  ==
++  test-readable-list-and-exact-filtered-next-command
  =/  args  (need (de:json:html '{"project":"active","includeArchived":false,"limit":1}'))
  =/  db  (step fixture [%task-create 'another' 'active' 'Another task' ''])
  =/  result  (read:j db owner 'tasks' args)
  =/  text  (render:view 'tasks' args result)
  =/  next-args
    %-  need
    (de:json:html '{"project":"active","includeArchived":false,"limit":1,"offset":1}')
  =/  next  (read:j db owner 'tasks' next-args)
  ;:  weld
      (expect-eq !>(~) !>((de:json:html text)))
      (expect-eq !>(1) !>((lent (items next))))
      (expect !>(!=((string:j (snag 0 (items result)) 'id') (string:j (snag 0 (items next)) 'id'))))
      %+  expect-eq
        !>(next-args)
      !>  %^  read-arguments:view
            db
            'tasks'
          (need (de:json:html (rsh [3 12] (command:view 'tasks' next-args))))
      %+  expect-eq
        !>('Line one Line two')
      !>((label:view (pairs:enjs:format ~[['title' %s 'Line one\0aLine two']])))
  ==
++  test-empty-and-detail-views-are-plain-text
  =/  args  (need (arguments:view 'projects' ''))
  =/  empty  (render:view 'projects' args (read:j *state:w owner 'projects' args))
  =/  project-args  (need (arguments:view 'project' 'active'))
  =/  task-args  (need (arguments:view 'task' 'active-task'))
  ;:  weld
      (expect !>(?=(^ (find (trip 'No active projects.') (trip empty)))))
      %+  expect-eq
        !>(~)
      !>  %-  de:json:html
          (render:view 'project' project-args (read:j fixture owner 'project' project-args))
      %+  expect-eq
        !>(~)
      !>((de:json:html (render:view 'task' task-args (read:j fixture owner 'task' task-args))))
  ==
++  test-draft-review-and-document-pages-keep-exact-content
  =/  args  (need (arguments:view 'proposal' 'draft'))
  =/  value
    %-  pairs:enjs:format
    :~  :*  'proposal'
            %-  pairs:enjs:format
            :~  ['id' %s 'draft']  ['artifact' %s 'doc']  ['title' %s 'Draft title']
                ['status' %s 'pending']
            ==
        ==
        :*  'content'
            %-  pairs:enjs:format
            :~  ['revision' %n '1']  ['body' %s 'Exact "quoted" line\0aSecond line']
                ['sources' %a ~]  ['nextOffset' %n '8000']  ['nextSourceOffset' ~]
            ==
        ==
    ==
  =/  links=(list [label=@t command=@t])  (actions:view 'proposal' args value)
  =/  excerpt
    %+  find
      (trip 'Exact "quoted" line\0aSecond line')
    (trip (render:view 'proposal' args value))
  ;:  weld
      (expect !>(?=(^ excerpt)))
      (expect-eq !>(4) !>((lent links)))
      %+  expect-eq
        !>((command:view 'proposal' (need (de:json:html '{"id":"draft","offset":8000}'))))
      !>(+:(snag 0 links))
      (expect !>((lien links |=([label=@t command=@t] =('Save draft' label)))))
  ==
++  test-artifact-pages-pin-revision-and-both-offsets
  =/  args  (need (de:json:html '{"id":"doc","offset":10,"sourceOffset":3}'))
  =/  value
    %-  pairs:enjs:format
    :~  ['artifact' (pairs:enjs:format ~[['id' %s 'doc']])]
        ['content' (need (de:json:html '{"revision":7,"nextOffset":20,"nextSourceOffset":6}'))]
    ==
  =/  links  (actions:view 'artifact' args value)
  =/  text-args  (need (de:json:html '{"id":"doc","revision":7,"offset":20,"sourceOffset":3}'))
  =/  source-args  (need (de:json:html '{"id":"doc","revision":7,"offset":10,"sourceOffset":6}'))
  ;:  weld
      (expect-eq !>(4) !>((lent links)))
      (expect-eq !>(['Continue reading' (command:view 'artifact' text-args)]) !>((snag 0 links)))
      (expect-eq !>(['More sources' (command:view 'artifact' source-args)]) !>((snag 1 links)))
      (expect-eq !>('Review drafts') !>(-:(snag 2 links)))
      (expect-eq !>(['Tasks' '/work tasks']) !>((snag 3 links)))
  ==
--

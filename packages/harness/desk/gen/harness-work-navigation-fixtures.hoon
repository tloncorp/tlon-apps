::  Native presentation fixtures from the shipping renderer; no persisted work.
/-  h=harness, w=harness-workspace
/+  card=harness-tlon-work-card, view=harness-work-view, j=harness-workspace-json,
    work=harness-workspace, help=harness-work-help
:-  %say
|=  [[now=@da eny=@uvJ bec=beak] ~ ~]
:-  %tang
=/  owner=authority:w  [& [0v0 'Owner'] 0v0]
=/  step
  |=  [db=state:w act=action:w]
  =/  out  (apply:work db owner act ~2026.9.13)
  ?>  ?=(%& -.out)
  p.out
=/  db  (step *state:w [%project-create 'weekend' 'Weekend plans' 'Keep the trip simple.'])
=/  db
  %+  step
    db
  :*  %task-create  'packing'  'weekend'  'Draft a packing list'
      'Prepare a short list for a rainy weekend.'
  ==
=/  db  (step db [%project-create 'garden' 'Garden' ''])
=/  db  (step db [%project-create 'house' 'Household repairs and improvements' ''])
=/  db  (step db [%project-create 'reading' 'Reading group' ''])
=/  db
  %+  step
    db
  [%project-create 'travel' 'A long project name for planning a trip with friends' '']
=/  db
  %+  step
    db
  :*  %artifact-create  'checklist'  `'weekend'
      ['Weekend checklist' 'Bring raincoats and a spare pair of socks.' ~]
  ==
=/  db
  %+  step
    db
  :*  %propose  'draft-checklist'  'checklist'  1
      ['Weekend checklist' 'Bring raincoats, spare socks, and a shared first-aid kit.' ~]
      'Complete the packing list.'
  ==
=/  version  version:(~(got by tasks.db) 'packing')
=/  done-db
  %+  step
    db
  [%task-update 'packing' version %done 'The packing list is ready.' `'checklist' ~]
=/  blocked-db
  %+  step
    db
  :*  %task-update  'packing'  version  %blocked
      'Waiting for the trip dates before finishing the list.'  ~  ~
  ==
=/  row
  |=  [db=state:w action=@t argument=@t]
  ^-  json
  =/  args  (need (arguments:view action argument))
  ?>  ?=(%o -.args)
  =/  value
    %:  read:j
      db
      owner
      action
      [%o (~(put by (~(put by p.args) 'paged' [%b &])) 'limit' [%n '4'])]
    ==
  =/  text  (render:view action args value)
  =/  prompt  (rap 3 ~['/work ' action ' ' argument])
  =/  log=(list event:h)  ~[[%command-completed 0v4 'work' text]]
  =/  blob  (need (browse:card db owner 0v4 prompt text log))
  (pairs:enjs:format ~[['text' %s text] ['blob' %s blob]])
=/  help-log=(list event:h)  ~[[%command-completed 0v4 'work' overview:help]]
=/  fixtures
  %-  pairs:enjs:format
  :~  ['Projects' (row db 'projects' '')]
      ['Project' (row db 'project' 'weekend')]
      ['Tasks' (row db 'tasks' '{"project":"weekend"}')]
      ['Task' (row db 'task' 'packing')]
      ['Done' (row done-db 'task' 'packing')]
      ['Blocked' (row blocked-db 'task' 'packing')]
      ['Drafts' (row db 'proposals' '{"artifact":"checklist"}')]
      ['Draft' (row db 'proposal' 'draft-checklist')]
      ['Document' (row db 'artifact' 'checklist')]
      ['Empty' (row *state:w 'projects' '')]
      :*  'Help'
          %-  pairs:enjs:format
          :~  ['text' %s overview:help]
              ['blob' %s (need (browse:card db owner 0v4 '/work' overview:help help-log))]
          ==
      ==
  ==
~[[%leaf (trip (cat 3 'HARNESS_WORK_NAVIGATION ' (en:json:html fixtures)))]]

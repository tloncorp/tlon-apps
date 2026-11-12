::  Human read views and complete receipts. Tool results stay structured.
/-  w=harness-workspace
/+  wj=harness-workspace-json, copy=harness-work-copy
|%
++  creation
  |=  [action=@t text=@t]
  ^-  (unit [action=@t args=json])
  ?:  =('project-new' action)
    ?:  =('' text)  ~
    `['project-create' (pairs:enjs:format ~[['title' %s text]])]
  ?:  =('' text)  ~
  `['task-create' (pairs:enjs:format ~[['title' %s text]])]
++  creation-help
  |=  [action=@t text=@t]
  ^-  @t
  ?:  =('project-new' action)
    'What is the project called?\0aFor example: /work project-new Weekend plans'
  'What needs doing? Tell me here in chat. A task can stand alone or belong to a project.'
++  all-actions
  |=  [action=@t args=json value=json]
  ^-  (list [label=@t command=@t])
  |^
    ?:  =('proposals' action)  proposal-list
    ?:  |(=('proposal' action) =('artifact' action))  document-actions
    ?:  |(=('projects' action) =('tasks' action))  record-list
    ?:  =('project' action)  project-actions
    ?>  =('task' action)
    task-actions
  ::
  ++  proposal-list
    =/  items  (need (get:wj value 'items'))
    ?>  ?=(%a -.items)
    =/  links=(list [label=@t command=@t])
      %+  turn  p.items
      |=  row=json
      =/  status  (status:copy (string:wj row 'status'))
      [(rap 3 ~[(label row) ' — ' status]) (inspect 'proposal' row)]
    =/  next  (need (get:wj value 'nextOffset'))
    ?>  ?=(%o -.args)
    =?  links  !=(~ next)
      (snoc links ['Next page' (command action [%o (~(put by p.args) 'offset' next)])])
    (snoc links ['Tasks' '/work tasks'])
  ::
  ++  document-actions
    =/  record  (need (get:wj value action))
    =/  links=(list [label=@t command=@t])  ~
    =/  content  (need (get:wj value 'content'))
    =?  links  !=(~ content)
      ?>  ?=(%o -.args)
      ::  Reading another page of a saved document pins the same revision.
      =/  fixed=json
        ?:  =('artifact' action)
          [%o (~(put by p.args) 'revision' (need (get:wj content 'revision')))]
        args
      ?>  ?=(%o -.fixed)
      =/  next  (need (get:wj content 'nextOffset'))
      =?  links  !=(~ next)
        (snoc links ['Continue reading' (command action [%o (~(put by p.fixed) 'offset' next)])])
      =/  sources  (need (get:wj content 'nextSourceOffset'))
      ?:  =(~ sources)  links
      (snoc links ['More sources' (command action [%o (~(put by p.fixed) 'sourceOffset' sources)])])
    ?:  =('artifact' action)  (snoc links ['Tasks' '/work tasks'])
    =?  links  =('pending' (string:wj record 'status'))
      =/  id  (string:wj record 'id')
      %+  weld  links
      :~  ['Save draft' (command 'review' (pairs:enjs:format ~[['id' %s id] ['accept' %b &]]))]
          ['Reject draft' (command 'review' (pairs:enjs:format ~[['id' %s id] ['accept' %b |]]))]
      ==
    %+  snoc
      links
    :*  'Read saved document'
        (command 'artifact' (pairs:enjs:format ~[['id' %s (string:wj record 'artifact')]]))
    ==
  ::
  ++  record-list
    =/  projects  =('projects' action)
    =/  items  (need (get:wj value 'items'))
    ?>  ?=(%a -.items)
    =/  links=(list [label=@t command=@t])
      %+  turn  p.items
      |=  row=json
      =/  suffix
        ?:  projects  ?:((boolean:wj row 'archived' |) ' — archived' '')
        (cat 3 ' — ' (status:copy (string:wj row 'status')))
      [(cat 3 (label row) suffix) (inspect ?:(projects 'project' 'task') row)]
    =/  next  (need (get:wj value 'nextOffset'))
    ?>  ?=(%o -.args)
    =?  links  !=(~ next)
      (snoc links ['Next page' (command action [%o (~(put by p.args) 'offset' next)])])
    =/  all  (boolean:wj args 'includeArchived' |)
    =/  toggle  [%o (~(put by (~(del by p.args) 'offset')) 'includeArchived' [%b !all])]
    =.  links
      %+  snoc
        links
      [?:(all 'Active projects only' 'Include archived projects') (command action toggle)]
    ?:  projects
      (weld links ~[['Create project' '/work project-new'] ['View tasks' '/work tasks']])
    (weld links ~[['Add task' '/work task-new'] ['View projects' '/work projects']])
  ::
  ++  project-actions
    =/  id  (string:wj value 'id')
    =/  archived  (boolean:wj value 'archived' |)
    =/  links=(list [label=@t command=@t])
      :~  :*  'View tasks'
              %+  command
                'tasks'
              (pairs:enjs:format ~[['project' %s id] ['includeArchived' %b archived]])
          ==
      ==
    (snoc links ['All active projects' '/work projects'])
  ::
  ++  task-actions
    =/  links=(list [label=@t command=@t])
      ~[['Refresh task' (inspect 'task' value)]]
    =/  project  (optional:wj value 'project')
    =?  links  ?=(^ project)
      (snoc links ['Open project' (command 'project' (pairs:enjs:format ~[['id' %s u.project]]))])
    =/  artifact  (optional:wj value 'artifact')
    =?  links  ?=(^ artifact)
      %+  weld  links
      :~  ['Review drafts' (command 'proposals' (pairs:enjs:format ~[['artifact' %s u.artifact]]))]
          ['Read saved document' (command 'artifact' (pairs:enjs:format ~[['id' %s u.artifact]]))]
      ==
    =?  links  &(!=('done' (string:wj value 'status')) ?=(^ artifact))
      =/  update
        %-  pairs:enjs:format
        :~  ['id' %s (string:wj value 'id')]
            ['version' (need (get:wj value 'version'))]
            ['status' %s 'done']
            ['artifact' %s u.artifact]
            ['outcome' %s (string:wj value 'outcome')]
        ==
      (snoc links ['Mark complete' (command 'task-update' update)])
    =?  links  &(=('done' (string:wj value 'status')) ?=(^ artifact))
      (snoc links ['Send here' (inspect 'task-send' value)])
    links
  --
++  actions
  |=  [action=@t args=json value=json]
  ^-  (list [label=@t command=@t])
  =/  all=(list [label=@t command=@t])  (all-actions action args value)
  ?:  =('task' action)
    =/  more  ['More actions' (inspect 'more' value)]
    =/  artifact  (optional:wj value 'artifact')
    ?^  artifact
      ~[['Read result' (command 'artifact' (pairs:enjs:format ~[['id' %s u.artifact]]))] more]
    ~[['Refresh task' (inspect 'task' value)] more]
  ?:  =('artifact' action)
    =/  record  (need (get:wj value 'artifact'))
    =/  draft
      :*  'Review drafts'
          (command 'proposals' (pairs:enjs:format ~[['artifact' %s (string:wj record 'id')]]))
      ==
    (weld (skim all |=([label=@t command=@t] !=('Tasks' label))) ~[draft ['Tasks' '/work tasks']])
  ?:  =('project' action)  (scag 2 all)
  ?:  |(=('projects' action) =('tasks' action))
    %+  skim  all
    |=  [label=@t command=@t]
    ?!  ?|  =('View tasks' label)
            =('View projects' label)
            =('Active projects only' label)
            =('Include archived projects' label)
        ==
  all
++  handles
  |=  action=@t
  %+  lien
    `(list @t)`~['projects' 'project' 'tasks' 'task' 'proposals' 'proposal' 'artifact']
  |=(a=@t =(a action))
++  arguments
  |=  [action=@t text=@t]
  ^-  (unit json)
  =/  listing  |(=('projects' action) =('tasks' action) =('proposals' action))
  =/  parsed=(unit json)
    ?:  =('' text)  `[%o ~]
    ?:  &(listing =('all' text))
      `(pairs:enjs:format ~[['includeArchived' %b &]])
    ?:  &(!listing !=(0x7b (end 3 text)))
      `(pairs:enjs:format ~[['id' %s text]])
    (de:json:html text)
  ?~  parsed  ~
  ?.  ?=(%o -.u.parsed)  ~
  ?.  |(=('projects' action) =('tasks' action))  parsed
  ?:  ?=(^ (get:wj u.parsed 'includeArchived'))  parsed
  `[%o (~(put by p.u.parsed) 'includeArchived' [%b |])]
++  read-arguments
  |=  [db=state:w action=@t args=json]
  ^-  json
  ?>  ?=(%o -.args)
  =/  id  (optional:wj args 'id')
  =?  args  ?=(^ id)
    =/  [kind=@t ids=(list @t)]
      ?:  =('project' action)  ['p' ~(tap in ~(key by projects.db))]
      ?:  =('proposal' action)  ['v' ~(tap in ~(key by proposals.db))]
      ?:  =('artifact' action)  ['d' ~(tap in ~(key by artifacts.db))]
      ['t' ~(tap in ~(key by tasks.db))]
    [%o (~(put by p.args) 'id' [%s (resolve:copy kind u.id ids)])]
  =/  project  (optional:wj args 'project')
  =?  args  ?=(^ project)
    :*  %o
        %+  ~(put by p.args)
          'project'
        [%s (resolve:copy 'p' u.project ~(tap in ~(key by projects.db)))]
    ==
  =/  artifact  (optional:wj args 'artifact')
  =?  args  ?=(^ artifact)
    :*  %o
        %+  ~(put by p.args)
          'artifact'
        [%s (resolve:copy 'd' u.artifact ~(tap in ~(key by artifacts.db)))]
    ==
  args
++  command
  |=  [action=@t args=json]
  ?:  %+  lien
        `(list @t)`~['project' 'task' 'task-send' 'more' 'finish' 'artifact' 'proposal']
      |=(a=@t =(a action))
    =/  kind
      ?:  =('project' action)  'p'
      ?:  =('artifact' action)  'd'
      ?:  =('proposal' action)  'v'
      't'
    =/  id  (ref:copy kind (string:wj args 'id'))
    ::  Paged document commands retain their exact revision and offsets.
    ?:  &(|(=('artifact' action) =('proposal' action)) ?=(%o -.args) (gth ~(wyt by p.args) 1))
      (rap 3 ~['/work ' action ' ' (en:json:html [%o (~(put by p.args) 'id' [%s id])])])
    (rap 3 ~['/work ' action ' ' id])
  ?:  =('review' action)
    %+  rap
      3
    :~  '/work '  ?:((boolean:wj args 'accept' |) 'accept' 'decline')  ' '
        (ref:copy 'v' (string:wj args 'id'))
    ==
  ?>  ?=(%o -.args)
  =/  project  (optional:wj args 'project')
  =?  args  ?=(^ project)  [%o (~(put by p.args) 'project' [%s (ref:copy 'p' u.project)])]
  =/  artifact  (optional:wj args 'artifact')
  =?  args  ?=(^ artifact)  [%o (~(put by p.args) 'artifact' [%s (ref:copy 'd' u.artifact)])]
  (rap 3 ~['/work ' action ' ' (en:json:html args)])
++  inspect
  |=  [action=@t row=json]
  (command action (pairs:enjs:format ~[['id' %s (string:wj row 'id')]]))
++  label
  |=  row=json
  ^-  @t
  ::  A record title occupies one line; record text never supplies commands.
  %-  crip
  %+  turn  (trip (string:wj row 'title'))
  |=  c=@t
  ?:  (lth c 32)  ' '
  c
++  field
  |=  [row=json key=@t heading=@t]
  ^-  @t
  =/  value  (optional:wj row key)
  ?~  value  ''
  (rap 3 ~['\0a\0a' heading u.value])
++  render
  |=  [action=@t args=json value=json]
  ^-  @t
  (rap 3 ~[(summary action args value) '\0a' (footer:copy (actions action args value))])
++  summary
  |=  [action=@t args=json value=json]
  ^-  @t
  ?:  =('proposals' action)
    =/  items  (need (get:wj value 'items'))
    ?>  ?=(%a -.items)
    (rap 3 ~['Drafts' ?~(p.items '\0aNo drafts here yet.' '\0aChoose a draft to read.')])
  ?:  |(=('proposal' action) =('artifact' action))
    =/  record  (need (get:wj value action))
    =/  content  (need (get:wj value 'content'))
    =/  body
      ?:  =(~ content)  'There is no saved result yet. Review the draft first.'
      (rap 3 ~[(string:wj content 'body') (sources:copy content)])
    %-  rap
    :-  3
    :~  (label record)
        ?:(=('proposal' action) (cat 3 ' — ' (string:wj record 'status')) '')
        '\0a\0a'
        body
    ==
  =/  projects  =('projects' action)
  ?:  |(projects =('tasks' action))
    =/  items  (need (get:wj value 'items'))
    ?>  ?=(%a -.items)
    =/  all  (boolean:wj args 'includeArchived' |)
    =/  filtered  &(!projects ?=(^ (optional:wj args 'project')))
    =/  heading
      ?:  projects  ?:(all 'Projects (including archived)' 'Active projects')
      ?:(all 'Tasks (including archived projects)' 'Tasks')
    =/  body
      ?:  =(~ p.items)
        ?:  (gth (number:wj args 'offset' 0) 0)  '\0a\0aNo more results on this page.'
        ?:  filtered  '\0a\0aNo tasks match this project filter.'
        ?:  projects  ?:(all '\0a\0aNo projects yet.' '\0a\0aNo active projects.')
        '\0a\0aNo tasks yet.'
      ''
    (rap 3 ~[heading body])
  ?:  =('project' action)
    %+  rap
      3
    :~  (label value)  ?:((boolean:wj value 'archived' |) ' — archived' '')
        (field value 'description' '')
    ==
  ?>  =('task' action)
  %-  rap
  :-  3
  :~  (label value)
      '\0a'
      (status:copy (string:wj value 'status'))
      (field value 'description' '')
      (field value 'outcome' '')
  ==
++  receipt
  |=  value=json
  ^-  @t
  (receipt:copy value)
--

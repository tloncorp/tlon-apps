/-  notes
/+  default-agent, dbug
^-  agent:gall
|%
+$  card  card:agent:gall
+$  current-state  state:notes

++  role-for
  |=  [=current-state notebook-id=@ud who=ship]
  ^-  (unit role:notes)
  =/  members=(unit notebook-members:notes)
    (~(get by members.current-state) notebook-id)
  ?~  members
    ~
  (~(get by u.members) who)

++  can-view
  |=  [=current-state notebook-id=@ud who=ship]
  ^-  ?
  ?~  (role-for current-state notebook-id who)
    %.n
  %.y

++  can-edit
  |=  [=current-state notebook-id=@ud who=ship]
  ^-  ?
  =/  r=(unit role:notes)
    (role-for current-state notebook-id who)
  ?~  r
    %.n
  ?-  u.r
    %owner  %.y
    %editor %.y
    %viewer %.n
  ==

++  all-folders-in-notebook
  |=  [=current-state notebook-id=@ud]
  ^-  (list folder:notes)
  %-  murn
  ~(tap by folders.current-state)
  |=  [[@ud folder:notes] ?]
  ?:  =(notebook-id q notebook-id)
    [~ q]
  ~

++  all-notes-in-notebook
  |=  [=current-state notebook-id=@ud]
  ^-  (list note:notes)
  %-  murn
  ~(tap by notes.current-state)
  |=  [[@ud note:notes] ?]
  ?:  =(notebook-id q notebook-id)
    [~ q]
  ~

++  all-notes-in-folder
  |=  [=current-state notebook-id=@ud folder-id=@ud]
  ^-  (list note:notes)
  %-  murn
  ~(tap by notes.current-state)
  |=  [[@ud note:notes] ?]
  ?:  &((=(notebook-id q notebook-id) =(folder-id q folder-id)))
    [~ q]
  ~

++  folder-children-ids
  |=  [=current-state notebook-id=@ud parent-id=@ud]
  ^-  (list @ud)
  %-  murn
  ~(tap by folders.current-state)
  |=  [[@ud folder:notes] ?]
  ?~  parent-folder-id.q
    ~
  ?:  &((=(notebook-id q notebook-id) =(u.parent-folder-id.q parent-id)))
    [~ p]
  ~

++  subtree-folder-ids
  |=  [=current-state notebook-id=@ud root-id=@ud]
  ^-  (set @ud)
  =|  seen=(set @ud)
  =|  todo=(list @ud)
  =.  todo  ~[root-id]
  |-
  ?~  todo
    seen
  =/  cur=@ud  i.todo
  =.  todo  t.todo
  ?:  (~(has in seen) cur)
    $(seen seen, todo todo)
  =/  kids=(list @ud)
    (folder-children-ids current-state notebook-id cur)
  =.  seen  (~(put in seen) cur)
  =.  todo  (weld kids todo)
  $(seen seen, todo todo)

++  note-ids-in-folder-set
  |=  [=current-state folder-ids=(set @ud)]
  ^-  (list @ud)
  %-  murn
  ~(tap by notes.current-state)
  |=  [[@ud note:notes] ?]
  ?:  (~(has in folder-ids) folder-id.q)
    [~ p]
  ~

++  del-many-folders
  |=  [folders-map=(map @ud folder:notes) ids=(list @ud)]
  ^-  (map @ud folder:notes)
  ?~  ids
    folders-map
  $(ids t.ids, folders-map (~(del by folders-map) i.ids))

++  del-many-notes
  |=  [notes-map=(map @ud note:notes) ids=(list @ud)]
  ^-  (map @ud note:notes)
  ?~  ids
    notes-map
  $(ids t.ids, notes-map (~(del by notes-map) i.ids))
--
=|  current-state
=*  state  -
%-  agent:dbug
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)

++  on-init
  ^-  (quip card _this)
  =/  empty-notebooks  *(map @ud notebook:notes)
  =/  empty-folders  *(map @ud folder:notes)
  =/  empty-notes  *(map @ud note:notes)
  =/  empty-members  *(map @ud notebook-members:notes)
  `this(state [%0 empty-notebooks empty-folders empty-notes empty-members 0])

++  on-save  !>(state)

++  on-load
  |=  =vase
  ^-  (quip card _this)
  `this(state !<(state:notes vase))

++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+  mark  (on-poke:def mark vase)
    %notes-action
  =/  act=action:notes  !<(action:notes vase)
  ?-    -.act
      %create-notebook
    =/  notebook-id=@ud  +(next-id.state)
    =/  new-notebook=notebook:notes
      [notebook-id title.act src.bowl now.bowl]
    =/  members=notebook-members:notes
      (~(put by *(map ship role:notes)) src.bowl %owner)
    =/  root-folder-id=@ud  +(notebook-id)
    =/  root-folder=folder:notes
      [root-folder-id notebook-id '/' ~ src.bowl now.bowl now.bowl]
    =/  next-state=state:notes
      state(
        notebooks (~(put by notebooks.state) notebook-id new-notebook),
        folders (~(put by folders.state) root-folder-id root-folder),
        members (~(put by members.state) notebook-id members),
        next-id root-folder-id
      )
    =/  ev=event:notes
      [%notebook-created notebook-id src.bowl]
    :_  this(state next-state)
    ~[[%give %fact ~[/events/(scot %ud notebook-id)] %notes-event !>(ev)]]
  ::
      %set-role
    =/  actor-role=(unit role:notes)
      (role-for state notebook-id.act src.bowl)
    ?~  actor-role
      ~|('notes ACL: actor is not a notebook member' !!)
    ?.  =(%owner u.actor-role)
      ~|('notes ACL: only owner may set roles (TODO: owner-transfer flow)' !!)
    =/  existing=notebook-members:notes
      (~(gut by members.state notebook-id.act *(map ship role:notes)))
    =/  target-members=notebook-members:notes
      (~(put by existing) who.act role.act)
    =/  next-members
      (~(put by members.state) notebook-id.act target-members)
    =/  ev=event:notes
      [%role-changed notebook-id.act who.act role.act src.bowl]
    :_  this(state state(members next-members))
    ~[[%give %fact ~[/events/(scot %ud notebook-id.act)] %notes-event !>(ev)]]
  ::
      %create-folder
    ?.  (can-edit state notebook-id.act src.bowl)
      ~|('notes ACL: not allowed to create folder in notebook' !!)
    ?~  parent-folder-id.act
      ~|('notes: parent folder id required (root is created with notebook)' !!)
    =/  parent=(unit folder:notes)
      (~(get by folders.state) u.parent-folder-id.act)
    ?~  parent
      ~|('notes: parent folder not found' !!)
    ?.  =(notebook-id.u.parent notebook-id.act)
      ~|('notes: parent folder notebook mismatch' !!)
    =/  folder-id=@ud  +(next-id.state)
    =/  new-folder=folder:notes
      [folder-id notebook-id.act name.act parent-folder-id.act src.bowl now.bowl now.bowl]
    =/  next-folders
      (~(put by folders.state) folder-id new-folder)
    =/  ev=event:notes
      [%folder-created folder-id notebook-id.act src.bowl]
    :_  this(state state(folders next-folders, next-id folder-id))
    ~[[%give %fact ~[/events/(scot %ud notebook-id.act)] %notes-event !>(ev)]]
  ::
      %rename-folder
    ?.  (can-edit state notebook-id.act src.bowl)
      ~|('notes ACL: not allowed to rename folder in notebook' !!)
    =/  old=(unit folder:notes)
      (~(get by folders.state) folder-id.act)
    ?~  old
      ~|('notes: folder not found' !!)
    ?.  =(notebook-id.u.old notebook-id.act)
      ~|('notes: folder notebook mismatch' !!)
    =/  next-folder=folder:notes
      u.old(name name.act, updated-at now.bowl)
    =/  next-folders
      (~(put by folders.state) folder-id.act next-folder)
    =/  ev=event:notes
      [%folder-renamed folder-id.act notebook-id.act src.bowl]
    :_  this(state state(folders next-folders))
    ~[[%give %fact ~[/events/(scot %ud notebook-id.act)] %notes-event !>(ev)]]
  ::
      %move-folder
    ?.  (can-edit state notebook-id.act src.bowl)
      ~|('notes ACL: not allowed to move folder in notebook' !!)
    =/  old=(unit folder:notes)
      (~(get by folders.state) folder-id.act)
    ?~  old
      ~|('notes: folder not found' !!)
    ?.  =(notebook-id.u.old notebook-id.act)
      ~|('notes: folder notebook mismatch' !!)
    ?~  parent-folder-id.u.old
      ~|('notes: cannot move root folder' !!)
    ?.  !=(folder-id.act new-parent-folder-id.act)
      ~|('notes: cannot move folder into itself' !!)
    =/  parent=(unit folder:notes)
      (~(get by folders.state) new-parent-folder-id.act)
    ?~  parent
      ~|('notes: new parent folder not found' !!)
    ?.  =(notebook-id.u.parent notebook-id.act)
      ~|('notes: new parent folder notebook mismatch' !!)
    =/  subtree=(set @ud)
      (subtree-folder-ids state notebook-id.act folder-id.act)
    ?:  (~(has in subtree) new-parent-folder-id.act)
      ~|('notes: cannot move folder into its own descendant' !!)
    =/  next-folder=folder:notes
      u.old(parent-folder-id `new-parent-folder-id.act, updated-at now.bowl)
    =/  next-folders
      (~(put by folders.state) folder-id.act next-folder)
    =/  ev=event:notes
      [%folder-moved folder-id.act notebook-id.act src.bowl]
    :_  this(state state(folders next-folders))
    ~[[%give %fact ~[/events/(scot %ud notebook-id.act)] %notes-event !>(ev)]]
  ::
      %delete-folder
    ?.  (can-edit state notebook-id.act src.bowl)
      ~|('notes ACL: not allowed to delete folder in notebook' !!)
    =/  old=(unit folder:notes)
      (~(get by folders.state) folder-id.act)
    ?~  old
      ~|('notes: folder not found' !!)
    ?.  =(notebook-id.u.old notebook-id.act)
      ~|('notes: folder notebook mismatch' !!)
    ?~  parent-folder-id.u.old
      ~|('notes: cannot delete root folder' !!)
    =/  subtree=(set @ud)
      (subtree-folder-ids state notebook-id.act folder-id.act)
    =/  subtree-list=(list @ud)
      ~(tap in subtree)
    =/  note-ids=(list @ud)
      (note-ids-in-folder-set state subtree)
    ?:  ?&(!recursive.act !=(1 (lent subtree-list)))
      ~|('notes: folder has descendants (set recursive %.y)' !!)
    ?:  ?&(!recursive.act !=(0 (lent note-ids)))
      ~|('notes: folder has notes (set recursive %.y)' !!)
    =/  next-folders=(map @ud folder:notes)
      ?.  recursive.act
        (~(del by folders.state) folder-id.act)
      (del-many-folders folders.state subtree-list)
    =/  next-notes=(map @ud note:notes)
      ?.  recursive.act
        notes.state
      (del-many-notes notes.state note-ids)
    =/  ev=event:notes
      [%folder-deleted folder-id.act notebook-id.act src.bowl]
    :_  this(state state(folders next-folders, notes next-notes))
    ~[[%give %fact ~[/events/(scot %ud notebook-id.act)] %notes-event !>(ev)]]
  ::
      %create-note
    ?.  (can-edit state notebook-id.act src.bowl)
      ~|('notes ACL: not allowed to create note in notebook' !!)
    =/  folder=(unit folder:notes)
      (~(get by folders.state) folder-id.act)
    ?~  folder
      ~|('notes: target folder not found' !!)
    ?.  =(notebook-id.u.folder notebook-id.act)
      ~|('notes: folder notebook mismatch' !!)
    =/  note-id=@ud  +(next-id.state)
    =/  new-note=note:notes
      [note-id notebook-id.act folder-id.act title.act body-md.act 1 src.bowl now.bowl]
    =/  next-notes
      (~(put by notes.state) note-id new-note)
    =/  next-state=state:notes
      state(notes next-notes, next-id note-id)
    =/  ev=event:notes
      [%note-created note-id notebook-id.act src.bowl]
    :_  this(state next-state)
    ~[[%give %fact ~[/events/(scot %ud notebook-id.act)] %notes-event !>(ev)]]
  ::
      %move-note
    =/  old=(unit note:notes)
      (~(get by notes.state) note-id.act)
    ?~  old
      ~|('notes: note not found' !!)
    ?.  (can-edit state notebook-id.u.old src.bowl)
      ~|('notes ACL: not allowed to move note' !!)
    ?.  =(notebook-id.u.old notebook-id.act)
      ~|('notes: notebook mismatch' !!)
    =/  target=(unit folder:notes)
      (~(get by folders.state) folder-id.act)
    ?~  target
      ~|('notes: target folder not found' !!)
    ?.  =(notebook-id.u.target notebook-id.act)
      ~|('notes: target folder notebook mismatch' !!)
    =/  next-note=note:notes
      u.old(folder-id folder-id.act, updated-by src.bowl, updated-at now.bowl)
    =/  next-notes
      (~(put by notes.state) note-id.act next-note)
    =/  ev=event:notes
      [%note-moved note-id.act notebook-id.act folder-id.act src.bowl]
    :_  this(state state(notes next-notes))
    ~[[%give %fact ~[/events/(scot %ud notebook-id.act)] %notes-event !>(ev)]]
  ::
      %delete-note
    =/  old=(unit note:notes)
      (~(get by notes.state) note-id.act)
    ?~  old
      ~|('notes: note not found' !!)
    ?.  (can-edit state notebook-id.u.old src.bowl)
      ~|('notes ACL: not allowed to delete note' !!)
    ?.  =(notebook-id.u.old notebook-id.act)
      ~|('notes: notebook mismatch' !!)
    =/  next-notes
      (~(del by notes.state) note-id.act)
    =/  ev=event:notes
      [%note-deleted note-id.act notebook-id.act src.bowl]
    :_  this(state state(notes next-notes))
    ~[[%give %fact ~[/events/(scot %ud notebook-id.act)] %notes-event !>(ev)]]
  ::
      %update-note
    =/  old=(unit note:notes)
      (~(get by notes.state) note-id.act)
    ?~  old
      ~|('notes: note not found' !!)
    ?.  (can-edit state notebook-id.u.old src.bowl)
      ~|('notes ACL: not allowed to update note' !!)
    ?.  =(revision.u.old expected-revision.act)
      ~|('notes: revision conflict (TODO return structured conflict payload)' !!)
    =/  next-note=note:notes
      u.old(body-md body-md.act, revision +(revision.u.old), updated-by src.bowl, updated-at now.bowl)
    =/  next-notes
      (~(put by notes.state) note-id.act next-note)
    =/  ev=event:notes
      [%note-updated note-id.act notebook-id.u.old revision.next-note src.bowl]
    :_  this(state state(notes next-notes))
    ~[[%give %fact ~[/events/(scot %ud notebook-id.u.old)] %notes-event !>(ev)]]
  ==

    %notes-query
  =/  q=query:notes  !<(query:notes vase)
  =/  res=query-result:notes
    ?-    -.q
        %list-notebooks
      [%notebooks notebooks.state]
    ::
        %get-notebook
      ?:  (can-view state notebook-id.q src.bowl)
        [%notebook (~(get by notebooks.state) notebook-id.q)]
      [%forbidden 'not a notebook member']
    ::
        %get-note
      =/  n=(unit note:notes)
        (~(get by notes.state) note-id.q)
      ?~  n
        [%note ~]
      ?:  (can-view state notebook-id.u.n src.bowl)
        [%note n]
      [%forbidden 'not a notebook member']
    ::
        %list-folders
      ?:  (can-view state notebook-id.q src.bowl)
        [%folders (all-folders-in-notebook state notebook-id.q)]
      [%forbidden 'not a notebook member']
    ::
        %list-notes
      ?:  (can-view state notebook-id.q src.bowl)
        [%notes (all-notes-in-notebook state notebook-id.q)]
      [%forbidden 'not a notebook member']
    ::
        %list-notes-in-folder
      ?:  (can-view state notebook-id.q src.bowl)
        [%notes (all-notes-in-folder state notebook-id.q folder-id.q)]
      [%forbidden 'not a notebook member']
    ==
  :_  this
  ~[[%give %fact ~[/query] %notes-result !>(res)]]
  ==

++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
      [%x %notebooks ~]
    ``noun+!>(notebooks.state)
  ::
      [%x %notes ~]
    ``noun+!>(notes.state)
  ::
      [%x %folders ~]
    ``noun+!>(folders.state)
  ::
      [%x %notebook @ud ~]
    =/  nid=@ud  i.t.path
    ?.  (can-view state nid src.bowl)
      [~ ~]
    =/  nb=(unit notebook:notes)
      (~(get by notebooks.state) nid)
    ?~  nb
      [~ ~]
    ``noun+!>(u.nb)
  ::
      [%x %note @ud ~]
    =/  note-id=@ud  i.t.path
    =/  n=(unit note:notes)
      (~(get by notes.state) note-id)
    ?~  n
      [~ ~]
    ?.  (can-view state notebook-id.u.n src.bowl)
      [~ ~]
    ``noun+!>(u.n)
  ==

++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?+  path  (on-watch:def path)
      [%events @ud ~]
    ?.  (can-view state i.t.path src.bowl)
      ~|('notes ACL: not allowed to watch notebook events' !!)
    `this
  ==

++  on-leave   on-leave:def
++  on-fail    on-fail:def
++  on-agent   on-agent:def
++  on-arvo    on-arvo:def
--

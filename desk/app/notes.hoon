::  notes: shared notebooks agent
::
/-  notes
/+  default-agent, dbug, verb
::
|%
+$  card  card:agent:gall
--
::
=|  state:notes
=*  current-state  -
::
%-  agent:dbug
%+  verb  |
^-  agent:gall
::
=<
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)
::
::  lifecycle
::
++  on-init
  ^-  (quip card _this)
  =/  empty-notebooks  *(map @ud notebook:notes)
  =/  empty-folders  *(map @ud folder:notes)
  =/  empty-notes  *(map @ud note:notes)
  =/  empty-members  *(map @ud notebook-members:notes)
  :_  this(state [%0 empty-notebooks empty-folders empty-notes empty-members 0])
  ~
::
++  on-save
  !>(state)
::
++  on-load
  |=  old=vase
  ^-  (quip card _this)
  =/  old-state=state:notes
    !<(state:notes old)
  :_  this(state old-state)
  ~
::
::  pokes
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+  mark  (on-poke:def mark vase)
      %notes-action
    ?>  =(our src):bowl
    =/  act=action:notes
      !<(action:notes vase)
    ?-  -.act
        %create-notebook
      =/  notebook-id=@ud
        +(next-id.state)
      =/  root-folder-id=@ud
        +(notebook-id)
      =/  members=notebook-members:notes
        (~(put by *(map ship role:notes)) src.bowl %owner)
      =/  notebook=notebook:notes
        [notebook-id title.act src.bowl now.bowl now.bowl]
      =/  root-folder=folder:notes
        [root-folder-id notebook-id '/' ~ src.bowl now.bowl now.bowl]
      =/  next-state=state:notes
        state(
          notebooks (~(put by notebooks.state) notebook-id notebook),
          folders (~(put by folders.state) root-folder-id root-folder),
          members (~(put by members.state) notebook-id members),
          next-id root-folder-id
        )
      :_  this(state next-state)
      (event-cards notebook-id [%notebook-created notebook-id src.bowl])
    ::
        %rename-notebook
      =/  notebook=notebook:notes
        (need-notebook notebook-id.act)
      ?>  (is-owner notebook-id.act src.bowl)
      =/  next-state=state:notes
        state(notebooks (~(put by notebooks.state) notebook-id.act notebook(title title.act, updated-at now.bowl)))
      :_  this(state next-state)
      (event-cards notebook-id.act [%notebook-renamed notebook-id.act src.bowl])
    ::
        %invite-member
      =/  notebook=notebook:notes
        (need-notebook notebook-id.act)
      ?>  (is-owner notebook-id.act src.bowl)
      ?<  =(who.act owner.notebook)
      ?<  =(%owner role.act)
      =/  notebook-members=notebook-members:notes
        (~(gut by members.state notebook-id.act *(map ship role:notes)))
      ?<  (~(has by notebook-members) who.act)
      =/  next-members=(map @ud notebook-members:notes)
        (~(put by members.state) notebook-id.act (~(put by notebook-members) who.act role.act))
      =/  next-state=state:notes
        (touch-notebook state(notebooks notebooks.state, members next-members) notebook-id.act)
      :_  this(state next-state)
      (event-cards notebook-id.act [%member-invited notebook-id.act who.act role.act src.bowl])
    ::
        %remove-member
      =/  notebook=notebook:notes
        (need-notebook notebook-id.act)
      ?>  (is-owner notebook-id.act src.bowl)
      ?<  =(who.act owner.notebook)
      =/  notebook-members=notebook-members:notes
        (~(gut by members.state notebook-id.act *(map ship role:notes)))
      ?>  (~(has by notebook-members) who.act)
      =/  next-members=(map @ud notebook-members:notes)
        (~(put by members.state) notebook-id.act (~(del by notebook-members) who.act))
      =/  next-state=state:notes
        (touch-notebook state(notebooks notebooks.state, members next-members) notebook-id.act)
      :_  this(state next-state)
      (event-cards notebook-id.act [%member-removed notebook-id.act who.act src.bowl])
    ::
        %set-role
      =/  notebook=notebook:notes
        (need-notebook notebook-id.act)
      ?>  (is-owner notebook-id.act src.bowl)
      ?<  =(who.act owner.notebook)
      ?<  =(%owner role.act)
      =/  notebook-members=notebook-members:notes
        (~(gut by members.state notebook-id.act *(map ship role:notes)))
      ?>  (~(has by notebook-members) who.act)
      =/  next-members=(map @ud notebook-members:notes)
        (~(put by members.state) notebook-id.act (~(put by notebook-members) who.act role.act))
      =/  next-state=state:notes
        (touch-notebook state(notebooks notebooks.state, members next-members) notebook-id.act)
      :_  this(state next-state)
      (event-cards notebook-id.act [%role-changed notebook-id.act who.act role.act src.bowl])
    ::
        %create-folder
      ?>  (can-edit notebook-id.act src.bowl)
      ?^  parent-folder-id.act
        ~
      !!
      =/  parent=folder:notes
        (need-folder u.parent-folder-id.act)
      ?>  =(notebook-id.parent notebook-id.act)
      =/  folder-id=@ud
        +(next-id.state)
      =/  next-folder=folder:notes
        [folder-id notebook-id.act name.act parent-folder-id.act src.bowl now.bowl now.bowl]
      =/  next-state=state:notes
        (touch-notebook state(folders (~(put by folders.state) folder-id next-folder), next-id folder-id) notebook-id.act)
      :_  this(state next-state)
      (event-cards notebook-id.act [%folder-created folder-id notebook-id.act src.bowl])
    ::
        %rename-folder
      ?>  (can-edit notebook-id.act src.bowl)
      =/  folder=folder:notes
        (need-folder folder-id.act)
      ?>  =(notebook-id.folder notebook-id.act)
      =/  next-state=state:notes
        (touch-notebook state(folders (~(put by folders.state) folder-id.act folder(name name.act, updated-at now.bowl))) notebook-id.act)
      :_  this(state next-state)
      (event-cards notebook-id.act [%folder-renamed folder-id.act notebook-id.act src.bowl])
    ::
        %move-folder
      ?>  (can-edit notebook-id.act src.bowl)
      =/  folder=folder:notes
        (need-folder folder-id.act)
      ?>  =(notebook-id.folder notebook-id.act)
      ?^  parent-folder-id.folder
        ~
      !!
      ?>  !=(folder-id.act new-parent-folder-id.act)
      =/  parent=folder:notes
        (need-folder new-parent-folder-id.act)
      ?>  =(notebook-id.parent notebook-id.act)
      =/  subtree=(set @ud)
        (subtree-folder-ids notebook-id.act folder-id.act)
      ?<  (~(has in subtree) new-parent-folder-id.act)
      =/  next-folder=folder:notes
        folder(parent-folder-id `new-parent-folder-id.act, updated-at now.bowl)
      =/  next-state=state:notes
        (touch-notebook state(folders (~(put by folders.state) folder-id.act next-folder)) notebook-id.act)
      :_  this(state next-state)
      (event-cards notebook-id.act [%folder-moved folder-id.act notebook-id.act src.bowl])
    ::
        %delete-folder
      ?>  (can-edit notebook-id.act src.bowl)
      =/  folder=folder:notes
        (need-folder folder-id.act)
      ?>  =(notebook-id.folder notebook-id.act)
      ?^  parent-folder-id.folder
        ~
      !!
      =/  subtree=(set @ud)
        (subtree-folder-ids notebook-id.act folder-id.act)
      =/  subtree-list=(list @ud)
        ~(tap in subtree)
      =/  note-ids=(list @ud)
        (note-ids-in-folder-set subtree)
      ?.  recursive.act
        ?>  =(1 (lent subtree-list))
      ?>  =(0 (lent note-ids))
      =/  next-folders=(map @ud folder:notes)
        ?.  recursive.act
          (~(del by folders.state) folder-id.act)
        (del-many-folders folders.state subtree-list)
      =/  next-notes=(map @ud note:notes)
        ?.  recursive.act
          notes.state
        (del-many-notes notes.state note-ids)
      =/  next-state=state:notes
        (touch-notebook state(folders next-folders, notes next-notes) notebook-id.act)
      :_  this(state next-state)
      (event-cards notebook-id.act [%folder-deleted folder-id.act notebook-id.act src.bowl])
    ::
        %create-note
      ?>  (can-edit notebook-id.act src.bowl)
      =/  folder=folder:notes
        (need-folder folder-id.act)
      ?>  =(notebook-id.folder notebook-id.act)
      =/  note-id=@ud
        +(next-id.state)
      =/  note=note:notes
        [note-id notebook-id.act folder-id.act title.act ~ body-md.act src.bowl now.bowl src.bowl now.bowl 1]
      =/  next-state=state:notes
        (touch-notebook state(notes (~(put by notes.state) note-id note), next-id note-id) notebook-id.act)
      :_  this(state next-state)
      (event-cards notebook-id.act [%note-created note-id notebook-id.act src.bowl])
    ::
        %rename-note
      =/  note=note:notes
        (need-note note-id.act)
      ?>  (can-edit notebook-id.note src.bowl)
      ?>  =(notebook-id.note notebook-id.act)
      =/  next-note=note:notes
        note(title title.act, updated-by src.bowl, updated-at now.bowl)
      =/  next-state=state:notes
        (touch-notebook state(notes (~(put by notes.state) note-id.act next-note)) notebook-id.act)
      :_  this(state next-state)
      (event-cards notebook-id.act [%note-renamed note-id.act notebook-id.act src.bowl])
    ::
        %move-note
      =/  note=note:notes
        (need-note note-id.act)
      ?>  (can-edit notebook-id.note src.bowl)
      ?>  =(notebook-id.note notebook-id.act)
      =/  folder=folder:notes
        (need-folder folder-id.act)
      ?>  =(notebook-id.folder notebook-id.act)
      =/  next-note=note:notes
        note(folder-id folder-id.act, updated-by src.bowl, updated-at now.bowl)
      =/  next-state=state:notes
        (touch-notebook state(notes (~(put by notes.state) note-id.act next-note)) notebook-id.act)
      :_  this(state next-state)
      (event-cards notebook-id.act [%note-moved note-id.act notebook-id.act folder-id.act src.bowl])
    ::
        %delete-note
      =/  note=note:notes
        (need-note note-id.act)
      ?>  (can-edit notebook-id.note src.bowl)
      ?>  =(notebook-id.note notebook-id.act)
      =/  next-state=state:notes
        (touch-notebook state(notes (~(del by notes.state) note-id.act)) notebook-id.act)
      :_  this(state next-state)
      (event-cards notebook-id.act [%note-deleted note-id.act notebook-id.act src.bowl])
    ::
        %update-note
      =/  note=note:notes
        (need-note note-id.act)
      ?>  (can-edit notebook-id.note src.bowl)
      ?>  =(revision.note expected-revision.act)
      =/  next-note=note:notes
        note(body-md body-md.act, updated-by src.bowl, updated-at now.bowl, revision +(revision.note))
      =/  next-state=state:notes
        (touch-notebook state(notes (~(put by notes.state) note-id.act next-note)) notebook-id.note)
      :_  this(state next-state)
      (event-cards notebook-id.note [%note-updated note-id.act notebook-id.note revision.next-note src.bowl])
    ==
  ::
      %notes-query
    ?>  =(our src):bowl
    ::  This poke-based query path is temporary. Peeks can replace it later.
    =/  query=query:notes
      !<(query:notes vase)
    =/  result=query-result:notes
      ?-  -.query
          %list-notebooks
        [%notebooks notebooks.state]
      ::
          %get-notebook
        ?.  (can-view notebook-id.query src.bowl)
          [%forbidden 'not a notebook member']
        [%notebook (~(get by notebooks.state) notebook-id.query)]
      ::
          %get-note
        =/  note=(unit note:notes)
          (~(get by notes.state) note-id.query)
        ?~  note
          [%note ~]
        ?.  (can-view notebook-id.u.note src.bowl)
          [%forbidden 'not a notebook member']
        [%note note]
      ::
          %list-folders
        ?.  (can-view notebook-id.query src.bowl)
          [%forbidden 'not a notebook member']
        [%folders (all-folders-in-notebook notebook-id.query)]
      ::
          %list-notes
        ?.  (can-view notebook-id.query src.bowl)
          [%forbidden 'not a notebook member']
        [%notes (all-notes-in-notebook notebook-id.query)]
      ::
          %list-notes-in-folder
        ?.  (can-view notebook-id.query src.bowl)
          [%forbidden 'not a notebook member']
        [%notes (all-notes-in-folder notebook-id.query folder-id.query)]
      ==
    :_  this
    ~[[%give %fact ~[/query] %notes-result !>(result)]]
  ==
::
::  peeks and watches
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?>  =(our src):bowl
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
      [%x %notebook =id ~]
    =/  notebook-id=@ud
      (slav %ud id)
    ?.  (can-view notebook-id src.bowl)
      [~ ~]
    =/  notebook=(unit notebook:notes)
      (~(get by notebooks.state) notebook-id)
    ?~  notebook
      [~ ~]
    ``noun+!>(u.notebook)
  ::
      [%x %note =id ~]
    =/  note-id=@ud
      (slav %ud id)
    =/  note=(unit note:notes)
      (~(get by notes.state) note-id)
    ?~  note
      [~ ~]
    ?.  (can-view notebook-id.u.note src.bowl)
      [~ ~]
    ``noun+!>(u.note)
  ==
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?+  path  (on-watch:def path)
      [%events =id ~]
    ?>  (can-view (slav %ud id) src.bowl)
    :_  this
    ~
  ==
::
++  on-agent  on-agent:def
++  on-arvo   on-arvo:def
++  on-leave  on-leave:def
++  on-fail   on-fail:def
--
::
::  helpers
::
|%
++  role-for
  |=  [notebook-id=@ud who=ship]
  ^-  (unit role:notes)
  =/  notebook-members=(unit notebook-members:notes)
    (~(get by members.state) notebook-id)
  ?~  notebook-members
    ~
  (~(get by u.notebook-members) who)
::
++  can-view
  |=  [notebook-id=@ud who=ship]
  ^-  ?
  ?~  (role-for notebook-id who)  |
  &
::
++  can-edit
  |=  [notebook-id=@ud who=ship]
  ^-  ?
  =/  role=(unit role:notes)
    (role-for notebook-id who)
  ?~  role
    |
  ?-  u.role
    %owner  &
    %editor &
    %viewer |
  ==
::
++  is-owner
  |=  [notebook-id=@ud who=ship]
  ^-  ?
  =/  role=(unit role:notes)
    (role-for notebook-id who)
  ?~  role
    |
  =(%owner u.role)
::
++  need-notebook
  |=  notebook-id=@ud
  ^-  notebook:notes
  (need (~(get by notebooks.state) notebook-id))
::
++  need-folder
  |=  folder-id=@ud
  ^-  folder:notes
  (need (~(get by folders.state) folder-id))
::
++  need-note
  |=  note-id=@ud
  ^-  note:notes
  (need (~(get by notes.state) note-id))
::
++  touch-notebook
  |=  [current=state:notes notebook-id=@ud]
  ^-  state:notes
  =/  notebook=(unit notebook:notes)
    (~(get by notebooks.current) notebook-id)
  =?  current  ?=([~ *] notebook)
    current(notebooks (~(put by notebooks.current) notebook-id u.notebook(updated-at now.bowl)))
  current
::
++  event-cards
  |=  [notebook-id=@ud event=event:notes]
  ^-  (list card)
  ~[[%give %fact ~[/events/(scot %ud notebook-id)] %notes-event !>(event)]]
::
++  all-folders-in-notebook
  |=  notebook-id=@ud
  ^-  (list folder:notes)
  %-  murn
  ~(tap by folders.state)
  |=  [@ud folder=folder:notes]
  ?.  =(notebook-id.folder notebook-id)
    ~
  `folder
::
++  all-notes-in-notebook
  |=  notebook-id=@ud
  ^-  (list note:notes)
  %-  murn
  ~(tap by notes.state)
  |=  [@ud note=note:notes]
  ?.  =(notebook-id.note notebook-id)
    ~
  `note
::
++  all-notes-in-folder
  |=  [notebook-id=@ud folder-id=@ud]
  ^-  (list note:notes)
  %-  murn
  ~(tap by notes.state)
  |=  [@ud note=note:notes]
  ?.  &((=(notebook-id.note notebook-id) =(folder-id.note folder-id)))
    ~
  `note
::
++  folder-children-ids
  |=  [notebook-id=@ud parent-id=@ud]
  ^-  (list @ud)
  %-  murn
  ~(tap by folders.state)
  |=  [folder-id=@ud folder=folder:notes]
  ?~  parent-folder-id.folder
    ~
  ?.  &((=(notebook-id.folder notebook-id) =(u.parent-folder-id.folder parent-id)))
    ~
  `folder-id
::
++  subtree-folder-ids
  |=  [notebook-id=@ud root-id=@ud]
  ^-  (set @ud)
  =|  seen=(set @ud)
  =|  todo=(list @ud)
  =.  todo  ~[root-id]
  |-
  ?~  todo
    seen
  =/  folder-id=@ud
    i.todo
  =.  todo  t.todo
  ?:  (~(has in seen) folder-id)
    $(seen seen, todo todo)
  =/  kids=(list @ud)
    (folder-children-ids notebook-id folder-id)
  =.  seen  (~(put in seen) folder-id)
  =.  todo  (weld kids todo)
  $(seen seen, todo todo)
::
++  note-ids-in-folder-set
  |=  folder-ids=(set @ud)
  ^-  (list @ud)
  %-  murn
  ~(tap by notes.state)
  |=  [note-id=@ud note=note:notes]
  ?.  (~(has in folder-ids) folder-id.note)
    ~
  `note-id
::
++  del-many-folders
  |=  [folders-map=(map @ud folder:notes) ids=(list @ud)]
  ^-  (map @ud folder:notes)
  ?~  ids
    folders-map
  $(ids t.ids, folders-map (~(del by folders-map) i.ids))
::
++  del-many-notes
  |=  [notes-map=(map @ud note:notes) ids=(list @ud)]
  ^-  (map @ud note:notes)
  ?~  ids
    notes-map
  $(ids t.ids, notes-map (~(del by notes-map) i.ids))
--

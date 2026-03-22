::  notes: shared notebook Gall agent
::
/-  notes
/+  default-agent, dbug, verb, notes-json
/=  index  /lib/notes-ui
|%
+$  card  card:agent:gall
+$  state-0  state-0:notes
::  raw-state: in-memory state without %0 tag
+$  raw-state
  $:  notebooks=(map @ud notebook:notes)
      folders=(map @ud folder:notes)
      notes=(map @ud note:notes)
      members=(map @ud notebook-members:notes)
      next-id=@ud
  ==
--
=|  state=raw-state
%-  agent:dbug
%+  verb  |
^-  agent:gall
=<
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)
    hc    ~(. +> [bowl state])
++  on-init
  ^-  (quip card _this)
  :_  this
  :~  [%pass /eyre/notes %arvo %e %connect [~ /notes] %notes]
  ==
::
++  on-save
  ^-  vase
  !>([%0 state])
::
++  on-load
  |=  old=vase
  ^-  (quip card _this)
  =/  s=state-0:notes  !<(state-0:notes old)
  :_  this(state [notebooks.s folders.s notes.s members.s next-id.s])
  :~  [%pass /eyre/notes %arvo %e %connect [~ /notes] %notes]
  ==
::
++  on-poke
  |=  [poke-mark=term poke-vase=vase]
  ^-  (quip card _this)
  ?+  poke-mark  (on-poke:def poke-mark poke-vase)
      %handle-http-request
    =/  req  !<([eyre-id=@ta =inbound-request:eyre] poke-vase)
    =/  data=octs  [(met 3 index) index]
    =/  headers=(list [key=@t value=@t])
      :~  ['content-type' 'text/html']
      ==
    =/  =response-header:http  [200 headers]
    :_  this
    :~  [%give %fact [/http-response/[eyre-id.req]]~ %http-response-header !>(response-header)]
        [%give %fact [/http-response/[eyre-id.req]]~ %http-response-data !>(`data)]
        [%give %kick [/http-response/[eyre-id.req]]~ ~]
    ==
  ::
      %notes-action
    ?>  =(our src):bowl
    =/  act=action:notes
      !<(action:notes poke-vase)
    ?-  -.act
        %create-notebook
      ::  allocate notebook id and root folder id
      =/  nid=@ud  +(next-id.state)
      =/  rfid=@ud  +(nid)
      =/  mbrs=notebook-members:notes
        (~(put by *(map ship role:notes)) src.bowl %owner)
      =/  nb=notebook:notes
        [nid title.act src.bowl now.bowl now.bowl]
      =/  rf=folder:notes
        [rfid nid '/' ~ src.bowl now.bowl now.bowl]
      =/  next=raw-state
        %_  state
          notebooks  (~(put by notebooks.state) nid nb)
          folders    (~(put by folders.state) rfid rf)
          members    (~(put by members.state) nid mbrs)
          next-id    rfid
        ==
      :_  this(state next)
      (event-cards:hc [%notebook-created nid src.bowl])
    ::
        %rename-notebook
      =/  nb=notebook:notes  (need-notebook:hc notebook-id.act)
      ?>  (is-owner:hc notebook-id.act src.bowl)
      =/  new-nb=notebook:notes
        nb(title title.act, updated-at now.bowl)
      =/  next=raw-state
        state(notebooks (~(put by notebooks.state) notebook-id.act new-nb))
      :_  this(state next)
      (event-cards:hc [%notebook-renamed notebook-id.act src.bowl])
    ::
        %invite-member
      =/  nb=notebook:notes  (need-notebook:hc notebook-id.act)
      ?>  (is-owner:hc notebook-id.act src.bowl)
      =/  mbrs=notebook-members:notes
        (~(got by members.state) notebook-id.act)
      =/  new-mbrs=notebook-members:notes
        (~(put by mbrs) who.act role.act)
      =/  next=raw-state
        state(members (~(put by members.state) notebook-id.act new-mbrs))
      :_  this(state next)
      (event-cards:hc [%member-invited notebook-id.act who.act role.act src.bowl])
    ::
        %remove-member
      =/  nb=notebook:notes  (need-notebook:hc notebook-id.act)
      ?>  (is-owner:hc notebook-id.act src.bowl)
      ::  cannot remove yourself as owner
      ?<  =(who.act src.bowl)
      =/  mbrs=notebook-members:notes
        (~(got by members.state) notebook-id.act)
      =/  new-mbrs=notebook-members:notes
        (~(del by mbrs) who.act)
      =/  next=raw-state
        state(members (~(put by members.state) notebook-id.act new-mbrs))
      :_  this(state next)
      (event-cards:hc [%member-removed notebook-id.act who.act src.bowl])
    ::
        %set-role
      =/  nb=notebook:notes  (need-notebook:hc notebook-id.act)
      ?>  (is-owner:hc notebook-id.act src.bowl)
      ::  cannot change your own role
      ?<  =(who.act src.bowl)
      =/  mbrs=notebook-members:notes
        (~(got by members.state) notebook-id.act)
      ?>  (~(has by mbrs) who.act)
      =/  new-mbrs=notebook-members:notes
        (~(put by mbrs) who.act role.act)
      =/  next=raw-state
        state(members (~(put by members.state) notebook-id.act new-mbrs))
      :_  this(state next)
      (event-cards:hc [%role-changed notebook-id.act who.act role.act src.bowl])
    ::
        %create-folder
      =/  nb=notebook:notes  (need-notebook:hc notebook-id.act)
      ?>  (can-edit:hc notebook-id.act src.bowl)
      ::  validate parent if specified
      ?^  parent-folder-id.act
        =/  pf=folder:notes  (need-folder:hc u.parent-folder-id.act)
        ?>  =(notebook-id.pf notebook-id.act)
        =/  fid=@ud  +(next-id.state)
        =/  nf=folder:notes
          [fid notebook-id.act name.act parent-folder-id.act src.bowl now.bowl now.bowl]
        =/  next=raw-state
          %_  state
            folders  (~(put by folders.state) fid nf)
            next-id  fid
          ==
        :_  this(state (touch-notebook:hc next notebook-id.act))
        (event-cards:hc [%folder-created fid notebook-id.act src.bowl])
      ::  parent is root (empty)
      =/  fid=@ud  +(next-id.state)
      =/  nf=folder:notes
        [fid notebook-id.act name.act ~ src.bowl now.bowl now.bowl]
      =/  next=raw-state
        %_  state
          folders  (~(put by folders.state) fid nf)
          next-id  fid
        ==
      :_  this(state (touch-notebook:hc next notebook-id.act))
      (event-cards:hc [%folder-created fid notebook-id.act src.bowl])
    ::
        %rename-folder
      =/  nb=notebook:notes  (need-notebook:hc notebook-id.act)
      ?>  (can-edit:hc notebook-id.act src.bowl)
      =/  fld=folder:notes  (need-folder:hc folder-id.act)
      ?>  =(notebook-id.fld notebook-id.act)
      =/  new-fld=folder:notes
        fld(name name.act, updated-at now.bowl)
      =/  next=raw-state
        state(folders (~(put by folders.state) folder-id.act new-fld))
      :_  this(state (touch-notebook:hc next notebook-id.act))
      (event-cards:hc [%folder-renamed folder-id.act notebook-id.act src.bowl])
    ::
        %move-folder
      =/  nb=notebook:notes  (need-notebook:hc notebook-id.act)
      ?>  (can-edit:hc notebook-id.act src.bowl)
      =/  fld=folder:notes  (need-folder:hc folder-id.act)
      ?>  =(notebook-id.fld notebook-id.act)
      =/  npf=folder:notes  (need-folder:hc new-parent-folder-id.act)
      ?>  =(notebook-id.npf notebook-id.act)
      ::  cannot move folder into itself or its descendants
      =/  subtree=(set @ud)  (subtree-folder-ids:hc folder-id.act)
      ?<  (~(has in subtree) new-parent-folder-id.act)
      =/  new-fld=folder:notes
        fld(parent-folder-id `new-parent-folder-id.act, updated-at now.bowl)
      =/  next=raw-state
        state(folders (~(put by folders.state) folder-id.act new-fld))
      :_  this(state (touch-notebook:hc next notebook-id.act))
      (event-cards:hc [%folder-moved folder-id.act notebook-id.act src.bowl])
    ::
        %delete-folder
      =/  nb=notebook:notes  (need-notebook:hc notebook-id.act)
      ?>  (can-edit:hc notebook-id.act src.bowl)
      =/  fld=folder:notes  (need-folder:hc folder-id.act)
      ?>  =(notebook-id.fld notebook-id.act)
      ::  cannot delete root folder
      ?>  ?=(^ parent-folder-id.fld)
      ?:  recursive.act
        ::  delete folder and all children recursively
        =/  del-fids=(set @ud)  (subtree-folder-ids:hc folder-id.act)
        =/  del-nids=(set @ud)  (note-ids-in-folder-set:hc del-fids)
        =/  next=raw-state
          %_  state
            folders  (del-many-folders:hc folders.state del-fids)
            notes    (del-many-notes:hc notes.state del-nids)
          ==
        :_  this(state (touch-notebook:hc next notebook-id.act))
        (event-cards:hc [%folder-deleted folder-id.act notebook-id.act src.bowl])
      ::  non-recursive: fail if has children
      =/  children=(list @ud)  (folder-children-ids:hc folder-id.act)
      ?>  =(~ children)
      =/  child-notes=(list note:notes)  (all-notes-in-folder:hc folder-id.act)
      ?>  =(~ child-notes)
      =/  next=raw-state
        state(folders (~(del by folders.state) folder-id.act))
      :_  this(state (touch-notebook:hc next notebook-id.act))
      (event-cards:hc [%folder-deleted folder-id.act notebook-id.act src.bowl])
    ::
        %create-note
      =/  nb=notebook:notes  (need-notebook:hc notebook-id.act)
      ?>  (can-edit:hc notebook-id.act src.bowl)
      =/  fld=folder:notes  (need-folder:hc folder-id.act)
      ?>  =(notebook-id.fld notebook-id.act)
      =/  nid=@ud  +(next-id.state)
      =/  nt=note:notes
        :*  nid
            notebook-id.act
            folder-id.act
            title.act
            ~
            body-md.act
            src.bowl
            now.bowl
            src.bowl
            now.bowl
            0
        ==
      =/  next=raw-state
        %_  state
          notes    (~(put by notes.state) nid nt)
          next-id  nid
        ==
      :_  this(state (touch-notebook:hc next notebook-id.act))
      (event-cards:hc [%note-created nid notebook-id.act src.bowl])
    ::
        %rename-note
      =/  nb=notebook:notes  (need-notebook:hc notebook-id.act)
      ?>  (can-edit:hc notebook-id.act src.bowl)
      =/  nt=note:notes  (need-note:hc note-id.act)
      ?>  =(notebook-id.nt notebook-id.act)
      =/  new-nt=note:notes
        %_  nt
          title       title.act
          updated-by  src.bowl
          updated-at  now.bowl
          revision    +(revision.nt)
        ==
      =/  next=raw-state
        state(notes (~(put by notes.state) note-id.act new-nt))
      :_  this(state (touch-notebook:hc next notebook-id.act))
      (event-cards:hc [%note-renamed note-id.act notebook-id.act src.bowl])
    ::
        %move-note
      =/  nb=notebook:notes  (need-notebook:hc notebook-id.act)
      ?>  (can-edit:hc notebook-id.act src.bowl)
      =/  nt=note:notes  (need-note:hc note-id.act)
      =/  fld=folder:notes  (need-folder:hc folder-id.act)
      ?>  =(notebook-id.fld notebook-id.act)
      =/  old-nbid=@ud  notebook-id.nt
      =/  new-nt=note:notes
        %_  nt
          notebook-id  notebook-id.act
          folder-id    folder-id.act
          updated-by   src.bowl
          updated-at   now.bowl
          revision     +(revision.nt)
        ==
      =/  next=raw-state
        state(notes (~(put by notes.state) note-id.act new-nt))
      =/  next2=raw-state  (touch-notebook:hc next notebook-id.act)
      =/  next3=raw-state
        ?:  =(old-nbid notebook-id.act)
          next2
        (touch-notebook:hc next2 old-nbid)
      :_  this(state next3)
      (event-cards:hc [%note-moved note-id.act notebook-id.act folder-id.act src.bowl])
    ::
        %delete-note
      =/  nb=notebook:notes  (need-notebook:hc notebook-id.act)
      ?>  (can-edit:hc notebook-id.act src.bowl)
      =/  nt=note:notes  (need-note:hc note-id.act)
      ?>  =(notebook-id.nt notebook-id.act)
      =/  next=raw-state
        state(notes (~(del by notes.state) note-id.act))
      :_  this(state (touch-notebook:hc next notebook-id.act))
      (event-cards:hc [%note-deleted note-id.act notebook-id.act src.bowl])
    ::
        %update-note
      =/  nt=note:notes  (need-note:hc note-id.act)
      ?>  (can-edit:hc notebook-id.nt src.bowl)
      ::  optimistic concurrency check
      ?>  =(revision.nt expected-revision.act)
      =/  new-nt=note:notes
        %_  nt
          body-md     body-md.act
          updated-by  src.bowl
          updated-at  now.bowl
          revision    +(revision.nt)
        ==
      =/  next=raw-state
        state(notes (~(put by notes.state) note-id.act new-nt))
      :_  this(state (touch-notebook:hc next notebook-id.nt))
      (event-cards:hc [%note-updated note-id.act notebook-id.nt revision.new-nt src.bowl])
    ::
        %batch-import
      ?>  (can-edit:hc notebook-id.act src.bowl)
      =|  cards=(list card)
      =/  items=(list [title=@t body-md=@t])  notes.act
      |-
      ?~  items
        [cards this]
      =/  nid=@ud  next-id.state
      =/  nt=note:notes
        :*  nid
            notebook-id.act
            folder-id.act
            title.i.items
            ~
            body-md.i.items
            src.bowl
            now.bowl
            src.bowl
            now.bowl
            1
        ==
      =.  state
        %_  state
          notes    (~(put by notes.state) nid nt)
          next-id  +(next-id.state)
        ==
      =.  state  (touch-notebook:hc state notebook-id.act)
      =.  cards
        %+  weld  cards
        (event-cards:hc [%note-created nid notebook-id.act src.bowl])
      $(items t.items)
    ::
        %batch-import-tree
      ?>  (can-edit:hc notebook-id.act src.bowl)
      =|  cards=(list card)
      =/  items=(list import-node:notes)  tree.act
      =|  stack=(list [remaining=(list import-node:notes) folder-id=@ud])
      =/  fid=@ud  parent-folder-id.act
      |-
      ?~  items
        ?~  stack
          [cards this]
        $(items remaining.i.stack, fid folder-id.i.stack, stack t.stack)
      ?-  -.i.items
          %note
        =/  nid=@ud  next-id.state
        =/  nt=note:notes
          :*  nid
              notebook-id.act
              fid
              title.i.items
              ~
              body-md.i.items
              src.bowl
              now.bowl
              src.bowl
              now.bowl
              1
          ==
        =.  state
          %_  state
            notes    (~(put by notes.state) nid nt)
            next-id  +(next-id.state)
          ==
        =.  cards
          %+  weld  cards
          (event-cards:hc [%note-created nid notebook-id.act src.bowl])
        $(items t.items)
      ::
          %folder
        =/  new-fid=@ud  next-id.state
        =/  nf=folder:notes
          [new-fid notebook-id.act name.i.items `fid src.bowl now.bowl now.bowl]
        =.  state
          %_  state
            folders  (~(put by folders.state) new-fid nf)
            next-id  +(next-id.state)
          ==
        =.  cards
          %+  weld  cards
          (event-cards:hc [%folder-created new-fid notebook-id.act src.bowl])
        ::  push current remaining onto stack, descend into children
        $(items children.i.items, stack [[t.items fid] stack], fid new-fid)
      ==
    ==
  ==
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  ~
    ::  /x/ui - serve the frontend
      [%x %ui ~]
    ``html+!>(index)
    ::  /x/notebooks - list all notebooks
      [%x %notebooks ~]
    =/  nbs=(list json)
      %+  turn  ~(val by notebooks.state)
      notebook:enjs:notes-json
    ``json+!>([%a nbs])
    ::  /x/notebook/<id> - get single notebook
      [%x %notebook @ ~]
    =/  nid=@ud  (slav %ud i.t.t.path)
    =/  nb=(unit notebook:notes)  (~(get by notebooks.state) nid)
    ?~  nb  ``json+!>(~)
    ``json+!>((notebook:enjs:notes-json u.nb))
    ::  /x/folders/<notebook-id> - list folders in notebook
      [%x %folders @ ~]
    =/  nid=@ud  (slav %ud i.t.t.path)
    =/  flds=(list json)
      %+  turn  (all-folders-in-notebook:hc nid)
      folder:enjs:notes-json
    ``json+!>([%a flds])
    ::  /x/folder/<id> - get single folder
      [%x %folder @ ~]
    =/  fid=@ud  (slav %ud i.t.t.path)
    =/  fld=(unit folder:notes)  (~(get by folders.state) fid)
    ?~  fld  ``json+!>(~)
    ``json+!>((folder:enjs:notes-json u.fld))
    ::  /x/notes/<notebook-id> - list notes in notebook
      [%x %notes @ ~]
    =/  nid=@ud  (slav %ud i.t.t.path)
    =/  nts=(list json)
      %+  turn  (all-notes-in-notebook:hc nid)
      note:enjs:notes-json
    ``json+!>([%a nts])
    ::  /x/notes/<notebook-id>/<folder-id> - list notes in folder
      [%x %notes @ @ ~]
    =/  nid=@ud  (slav %ud i.t.t.path)
    =/  fid=@ud  (slav %ud i.t.t.t.path)
    =/  nts=(list json)
      %+  turn  (all-notes-in-folder:hc fid)
      note:enjs:notes-json
    ``json+!>([%a nts])
    ::  /x/note/<id> - get single note
      [%x %note @ ~]
    =/  nid=@ud  (slav %ud i.t.t.path)
    =/  nt=(unit note:notes)  (~(get by notes.state) nid)
    ?~  nt  ``json+!>(~)
    ``json+!>((note:enjs:notes-json u.nt))
    ::  /x/members/<notebook-id> - get notebook members
      [%x %members @ ~]
    =/  nid=@ud  (slav %ud i.t.t.path)
    =/  mbrs=(unit notebook-members:notes)  (~(get by members.state) nid)
    ?~  mbrs  ``json+!>(~)
    =/  mlist=(list json)
      %+  turn  ~(tap by u.mbrs)
      |=  [who=ship r=role:notes]
      %-  pairs:enjs:format
      :~  ['ship' s+(scot %p who)]
          ['role' s+(scot %tas r)]
      ==
    ``json+!>([%a mlist])
  ==
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?+  path  (on-watch:def path)
      [%http-response *]
    `this
  ::
      [%events ~]
    ?>  =(our src):bowl
    `this
  ==
::
++  on-agent  on-agent:def
++  on-arvo
  |=  [wir=wire sig=sign-arvo]
  ^-  (quip card _this)
  ?+  sig  (on-arvo:def wir sig)
    [%eyre %bound *]  `this
  ==
++  on-leave  on-leave:def
++  on-fail   on-fail:def
--
::  helper core
|_  [=bowl:gall state=raw-state]
::  role-for: get role of ship in notebook, ~ if not member
++  role-for
  |=  [notebook-id=@ud who=ship]
  ^-  (unit role:notes)
  =/  mbrs=(unit notebook-members:notes)
    (~(get by members.state) notebook-id)
  ?~  mbrs  ~
  (~(get by u.mbrs) who)
::
::  can-view: check if ship can view notebook
++  can-view
  |=  [notebook-id=@ud who=ship]
  ^-  ?
  ?~  (role-for notebook-id who)  |
  &
::
::  can-edit: check if ship can edit notebook (owner or editor)
++  can-edit
  |=  [notebook-id=@ud who=ship]
  ^-  ?
  =/  r=(unit role:notes)  (role-for notebook-id who)
  ?~  r  |
  ?|  =(u.r %owner)
      =(u.r %editor)
  ==
::
::  is-owner: check if ship is notebook owner
++  is-owner
  |=  [notebook-id=@ud who=ship]
  ^-  ?
  =/  r=(unit role:notes)  (role-for notebook-id who)
  ?~  r  |
  =(u.r %owner)
::
::  need-notebook: get notebook or crash
++  need-notebook
  |=  notebook-id=@ud
  ^-  notebook:notes
  (~(got by notebooks.state) notebook-id)
::
::  need-folder: get folder or crash
++  need-folder
  |=  folder-id=@ud
  ^-  folder:notes
  (~(got by folders.state) folder-id)
::
::  need-note: get note or crash
++  need-note
  |=  note-id=@ud
  ^-  note:notes
  (~(got by notes.state) note-id)
::
::  touch-notebook: update notebook timestamp
++  touch-notebook
  |=  [st=raw-state notebook-id=@ud]
  ^-  raw-state
  =/  nb=(unit notebook:notes)  (~(get by notebooks.st) notebook-id)
  ?~  nb  st
  st(notebooks (~(put by notebooks.st) notebook-id u.nb(updated-at now.bowl)))
::
::  event-cards: create cards to send event to subscribers
++  event-cards
  |=  evt=event:notes
  ^-  (list card)
  :~  [%give %fact ~[/events] %notes-event !>(evt)]
  ==
::
::  all-folders-in-notebook: list all folders for a notebook
++  all-folders-in-notebook
  |=  notebook-id=@ud
  ^-  (list folder:notes)
  %+  murn  ~(tap by folders.state)
  |=  [fid=@ud fld=folder:notes]
  ?:  =(notebook-id.fld notebook-id)
    `fld
  ~
::
::  all-notes-in-notebook: list all notes for a notebook
++  all-notes-in-notebook
  |=  notebook-id=@ud
  ^-  (list note:notes)
  %+  murn  ~(tap by notes.state)
  |=  [nid=@ud nt=note:notes]
  ?:  =(notebook-id.nt notebook-id)
    `nt
  ~
::
::  all-notes-in-folder: list all notes in a folder
++  all-notes-in-folder
  |=  folder-id=@ud
  ^-  (list note:notes)
  %+  murn  ~(tap by notes.state)
  |=  [nid=@ud nt=note:notes]
  ?:  =(folder-id.nt folder-id)
    `nt
  ~
::
::  folder-children-ids: get direct child folder ids
++  folder-children-ids
  |=  folder-id=@ud
  ^-  (list @ud)
  %+  murn  ~(tap by folders.state)
  |=  [fid=@ud fld=folder:notes]
  ?~  parent-folder-id.fld  ~
  ?:  =(u.parent-folder-id.fld folder-id)
    `fid
  ~
::
::  subtree-folder-ids: get folder and all descendants
++  subtree-folder-ids
  |=  folder-id=@ud
  ^-  (set @ud)
  =/  acc=(set @ud)  (silt ~[folder-id])
  =/  queue=(list @ud)  ~[folder-id]
  |-
  ?~  queue  acc
  =/  children=(list @ud)  (folder-children-ids i.queue)
  %=  $
    queue  (weld t.queue children)
    acc    (~(gas in acc) children)
  ==
::
::  note-ids-in-folder-set: get all note ids in a set of folders
++  note-ids-in-folder-set
  |=  fids=(set @ud)
  ^-  (set @ud)
  %-  silt
  %+  murn  ~(tap by notes.state)
  |=  [nid=@ud nt=note:notes]
  ?:  (~(has in fids) folder-id.nt)
    `nid
  ~
::
::  del-many-folders: delete multiple folders from map
++  del-many-folders
  |=  [fmap=(map @ud folder:notes) fids=(set @ud)]
  ^-  (map @ud folder:notes)
  %-  ~(rep in fids)
  |=  [fid=@ud acc=_fmap]
  (~(del by acc) fid)
::
::  del-many-notes: delete multiple notes from map
++  del-many-notes
  |=  [nmap=(map @ud note:notes) nids=(set @ud)]
  ^-  (map @ud note:notes)
  %-  ~(rep in nids)
  |=  [nid=@ud acc=_nmap]
  (~(del by acc) nid)
--

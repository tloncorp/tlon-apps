/-  notes
/+  default-agent, dbug
^-  agent:gall
|%
+$  card  card:agent:gall
::  TODO: add versioned state migration strategy before shipping.
+$  current-state  state:notes
::
++  role-for
  |=  [=current-state notebook-id=@ud who=ship]
  ^-  (unit role:notes)
  =/  members=(unit notebook-members:notes)
    (~(get by members.current-state) notebook-id)
  ?~  members
    ~
  (~(get by u.members) who)
::
++  can-view
  |=  [=current-state notebook-id=@ud who=ship]
  ^-  ?
  ?~  (role-for current-state notebook-id who)
    %.n
  %.y
::
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
--
=|  current-state
=*  state  -
%-  agent:dbug
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)
++  on-init
  ^-  (quip card _this)
  =/  empty  *(map @ud notebook:notes)
  =/  empty-notes  *(map @ud note:notes)
  =/  empty-members  *(map @ud notebook-members:notes)
  `this(state [%0 empty empty-notes empty-members 0])
::
++  on-save  !>(state)
++  on-load
  |=  =vase
  ^-  (quip card _this)
  `this(state !<(state:notes vase))
::
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
      =/  next-notebooks
        (~(put by notebooks.state) notebook-id new-notebook)
      =/  next-members
        (~(put by members.state) notebook-id members)
      =/  next-state=state:notes
        [%0 next-notebooks notes.state next-members notebook-id]
      :-  ~
      this(state next-state)
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
      `this(state state(members next-members))
    ::
        %create-note
      ?.  (can-edit state notebook-id.act src.bowl)
        ~|('notes ACL: not allowed to create note in notebook' !!)
      =/  note-id=@ud  +(next-id.state)
      =/  new-note=note:notes
        [note-id notebook-id.act title.act body-md.act 1 src.bowl now.bowl]
      =/  next-notes
        (~(put by notes.state) note-id new-note)
      =/  next-state=state:notes
        state(notes next-notes, next-id note-id)
      `this(state next-state)
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
      `this(state state(notes next-notes))
    ==
  ==
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
      [%x %notebooks ~]
    ``noun+!>(notebooks.state)
  ::
      [%x %notes ~]
    ``noun+!>(notes.state)
  ==
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?+  path  (on-watch:def path)
      [%events @ud ~]
    ?.  (can-view state i.t.path src.bowl)
      ~|('notes ACL: not allowed to watch notebook events' !!)
    `this
  ==
::
++  on-leave   on-leave:def
++  on-fail    on-fail:def
++  on-agent   on-agent:def
++  on-arvo    on-arvo:def
--

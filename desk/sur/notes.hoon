::  notes: shared notebook surface types
::
|%
+$  role
  ::  notebook ACL role:
  ::    %owner  full control and membership management
  ::    %editor  may mutate folders and notes
  ::    %viewer  read-only access
  ?(%owner %editor %viewer)
::
+$  notebook
  ::  shared notebook container:
  ::    id            stable notebook id
  ::    title         display title
  ::    created-by    ship that created the notebook
  ::    created-at    creation timestamp
  ::    updated-at    last notebook-level metadata change
  $:  id=@ud
      title=@t
      created-by=ship
      created-at=@da
      updated-at=@da
  ==
::
+$  folder
  ::  folder inside a notebook tree:
  ::    id                stable folder id
  ::    notebook-id       owning notebook
  ::    name              display name
  ::    parent-folder-id  parent folder, ~ for the root
  ::    created-by        ship that created the folder
  ::    created-at        creation timestamp
  ::    updated-at        last structural rename/move timestamp
  $:  id=@ud
      notebook-id=@ud
      name=@t
      parent-folder-id=(unit @ud)
      created-by=ship
      created-at=@da
      updated-at=@da
  ==
::
+$  note
  ::  markdown note stored in Gall state:
  ::    id            stable note id
  ::    notebook-id   owning notebook
  ::    folder-id     containing folder
  ::    title         display title
  ::    slug          optional stable path slug
  ::    body-md       markdown body
  ::    created-by    ship that created the note
  ::    created-at    creation timestamp
  ::    updated-by    ship that last changed the note
  ::    updated-at    last edit/move/rename timestamp
  ::    revision      monotonic optimistic-concurrency counter
  $:  id=@ud
      notebook-id=@ud
      folder-id=@ud
      title=@t
      slug=(unit @t)
      body-md=@t
      created-by=ship
      created-at=@da
      updated-by=ship
      updated-at=@da
      revision=@ud
  ==
::
+$  notebook-members
  ::  notebook membership map from ship to ACL role
  (map ship role)
::
+$  action
  ::  local UI mutations sent as pokes
  $%  [%create-notebook title=@t]
      [%rename-notebook notebook-id=@ud title=@t]
      [%invite-member notebook-id=@ud who=ship role=role]
      [%remove-member notebook-id=@ud who=ship]
      [%set-role notebook-id=@ud who=ship role=role]
      [%create-folder notebook-id=@ud parent-folder-id=(unit @ud) name=@t]
      [%rename-folder notebook-id=@ud folder-id=@ud name=@t]
      [%move-folder notebook-id=@ud folder-id=@ud new-parent-folder-id=@ud]
      [%delete-folder notebook-id=@ud folder-id=@ud recursive=?]
      [%create-note notebook-id=@ud folder-id=@ud title=@t body-md=@t]
      [%rename-note notebook-id=@ud note-id=@ud title=@t]
      [%move-note note-id=@ud notebook-id=@ud folder-id=@ud]
      [%delete-note note-id=@ud notebook-id=@ud]
      [%update-note note-id=@ud body-md=@t expected-revision=@ud]
      [%batch-import notebook-id=@ud folder-id=@ud notes=(list [title=@t body-md=@t])]
      $:  %batch-import-tree
          notebook-id=@ud
          parent-folder-id=@ud
          tree=(list import-node)
      ==
  ==
::
+$  import-node
  $%  [%folder name=@t children=(list import-node)]
      [%note title=@t body-md=@t]
  ==
::
+$  query
  ::  ad-hoc query pokes; peeks can replace these later
  $%  [%list-notebooks ~]
      [%get-notebook notebook-id=@ud]
      [%get-note note-id=@ud]
      [%list-folders notebook-id=@ud]
      [%list-notes notebook-id=@ud]
      [%list-notes-in-folder notebook-id=@ud folder-id=@ud]
  ==
::
+$  query-result
  ::  response payload for %notes-query
  $%  [%notebooks notebooks=(map @ud notebook)]
      [%notebook notebook=(unit notebook)]
      [%note note=(unit note)]
      [%folders folders=(list folder)]
      [%notes notes=(list note)]
      [%forbidden reason=@t]
  ==
::
+$  event
  ::  notebook domain events for UI sync
  $%  [%notebook-created notebook-id=@ud actor=ship]
      [%notebook-renamed notebook-id=@ud actor=ship]
      [%member-invited notebook-id=@ud who=ship role=role actor=ship]
      [%member-removed notebook-id=@ud who=ship actor=ship]
      [%role-changed notebook-id=@ud who=ship role=role actor=ship]
      [%folder-created folder-id=@ud notebook-id=@ud actor=ship]
      [%folder-renamed folder-id=@ud notebook-id=@ud actor=ship]
      [%folder-moved folder-id=@ud notebook-id=@ud actor=ship]
      [%folder-deleted folder-id=@ud notebook-id=@ud actor=ship]
      [%note-created note-id=@ud notebook-id=@ud actor=ship]
      [%note-renamed note-id=@ud notebook-id=@ud actor=ship]
      [%note-moved note-id=@ud notebook-id=@ud folder-id=@ud actor=ship]
      [%note-deleted note-id=@ud notebook-id=@ud actor=ship]
      [%note-updated note-id=@ud notebook-id=@ud revision=@ud actor=ship]
  ==
::
+$  state-0
  ::  initial persisted state:
  ::    notebooks  notebook records by id
  ::    folders    folder records by id
  ::    notes      note records by id
  ::    members    notebook ACLs by notebook id
  ::    next-id    monotonic id allocator
  [%0 notebooks=(map @ud notebook) folders=(map @ud folder) notes=(map @ud note) members=(map @ud notebook-members) next-id=@ud]
::
+$  state
  state-0
--

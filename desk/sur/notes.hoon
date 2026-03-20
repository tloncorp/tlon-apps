|%
::  NOTEBOOK MVP SURFACE TYPES (MVP scaffold)
::  TODO: split into versioned state + migration molds as this stabilizes.
+$  role  ?(%owner %editor %viewer)

+$  notebook
  $:  id=@ud
      title=@t
      created-by=ship
      created-at=@da
  ==

+$  folder
  $:  id=@ud
      notebook-id=@ud
      name=@t
      parent-folder-id=(unit @ud)
      created-by=ship
      created-at=@da
      updated-at=@da
  ==

+$  note
  $:  id=@ud
      notebook-id=@ud
      folder-id=@ud
      title=@t
      body-md=@t
      revision=@ud
      updated-by=ship
      updated-at=@da
  ==

+$  notebook-members  (map ship role)

+$  action
  $%  [%create-notebook title=@t]
      [%set-role notebook-id=@ud who=ship role=role]
      [%create-folder notebook-id=@ud parent-folder-id=(unit @ud) name=@t]
      [%rename-folder notebook-id=@ud folder-id=@ud name=@t]
      [%move-folder notebook-id=@ud folder-id=@ud new-parent-folder-id=@ud]
      [%delete-folder notebook-id=@ud folder-id=@ud recursive=?]
      [%create-note notebook-id=@ud folder-id=@ud title=@t body-md=@t]
      [%move-note note-id=@ud notebook-id=@ud folder-id=@ud]
      [%delete-note note-id=@ud notebook-id=@ud]
      [%update-note note-id=@ud body-md=@t expected-revision=@ud]
  ==

+$  query
  $%  [%list-notebooks ~]
      [%get-notebook notebook-id=@ud]
      [%get-note note-id=@ud]
      [%list-folders notebook-id=@ud]
      [%list-notes notebook-id=@ud]
      [%list-notes-in-folder notebook-id=@ud folder-id=@ud]
  ==

+$  query-result
  $%  [%notebooks notebooks=(map @ud notebook)]
      [%notebook notebook=(unit notebook)]
      [%note note=(unit note)]
      [%folders folders=(list folder)]
      [%notes notes=(list note)]
      [%forbidden reason=@t]
  ==

+$  event
  $%  [%notebook-created notebook-id=@ud actor=ship]
      [%role-changed notebook-id=@ud who=ship role=role actor=ship]
      [%folder-created folder-id=@ud notebook-id=@ud actor=ship]
      [%folder-renamed folder-id=@ud notebook-id=@ud actor=ship]
      [%folder-moved folder-id=@ud notebook-id=@ud actor=ship]
      [%folder-deleted folder-id=@ud notebook-id=@ud actor=ship]
      [%note-created note-id=@ud notebook-id=@ud actor=ship]
      [%note-moved note-id=@ud notebook-id=@ud folder-id=@ud actor=ship]
      [%note-deleted note-id=@ud notebook-id=@ud actor=ship]
      [%note-updated note-id=@ud notebook-id=@ud revision=@ud actor=ship]
  ==

+$  state-0
  [%0 notebooks=(map @ud notebook) folders=(map @ud folder) notes=(map @ud note) members=(map @ud notebook-members) next-id=@ud]

+$  state  state-0
--

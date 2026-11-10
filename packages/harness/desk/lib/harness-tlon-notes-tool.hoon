::  Native Notes, including explicitly confirmed inert public snapshots.
/-  n=notes, g=groups-ver
/+  spec=harness-tlon-tool, hp=harness-tlon-history-page,
    publish-html=harness-tlon-publish-html, imports=harness-tlon-notes-import,
    policy=harness-tlon-group-policy
|_  bowl=bowl:gall
::
++  handles
  |=  action=@t
  =/  actions=(list @t)
    :~  'list_notebooks'
        'list_notebook_invites'
        'get_notebook'
        'list_notebook_members'
        'list_folders'
        'list_notes'
        'get_note'
        'note_revisions'
        'create_notebook'
        'rename_notebook'
        'delete_notebook'
        'set_notebook_visibility'
        'invite_to_notebook'
        'join_notebook'
        'leave_notebook'
        'accept_notebook_invite'
        'decline_notebook_invite'
        'create_folder'
        'rename_folder'
        'move_folder'
        'delete_folder'
        'create_note'
        'edit_note'
        'rename_note'
        'move_note'
        'delete_note'
        'restore_note'
        'list_published_notes'
        'get_note_publication'
        'publish_note'
        'unpublish_note'
        'plan_notes_import'
        'import_notes'
    ==
  (lien actions |=(value=@t =(value action)))
::
++  id
  |=  flag=flag:n
  (rap 3 (scot %p ship.flag) '/' name.flag ~)
::
++  mutates
  |=  action=@t
  =/  reads=(list @t)
    :~  'list_notebooks'
        'list_notebook_invites'
        'get_notebook'
        'list_notebook_members'
        'list_folders'
        'list_notes'
        'get_note'
        'note_revisions'
        'list_published_notes'
        'get_note_publication'
        'plan_notes_import'
    ==
  &((handles action) !(lien reads |=(item=@t =(item action))))
::
++  groups
  ^-  groups:v9:g
  .^(groups:v9:g %gx /(scot %p our.bowl)/groups/(scot %da now.bowl)/v2/groups/noun)
::
++  readers
  |=  args=json
  ^-  (set @tas)
  =/  value  (need (de:json:html (string:spec args 'readers' '[]' 4.096)))
  ?>  &(?=(%a -.value) (lte (lent p.value) 64))
  =/  rows  (turn p.value |=(item=json (slug:spec (so:dejs:format item))))
  =/  roles  (silt rows)
  ?>  =((lent rows) ~(wyt in roles))
  roles
::
++  affiliations
  |=  flag=flag:n
  ^-  (list [flag=flag:n channel=channel:v9:g])
  %+  murn  ~(tap by groups)
  |=  [group-flag=flag:n group=group:v9:g]
  =/  channel  (~(get by channels.group) [%notes flag])
  ?~  channel  ~
  `[group-flag u.channel]
::
++  created
  |=  [args=json item=notebook-summary:n]
  =/  linked  (has:spec args 'group')
  =/  verified
    ?.  linked  &
    =/  group-flag  (flag:spec (required:spec args 'group' 256))
    =/  rows  (affiliations flag.item)
    %+  lien  rows
    |=  row=[flag=flag:n channel=channel:v9:g]
    &(=(group-flag flag.row) =((readers args) readers.channel.row))
  %-  pairs:enjs:format
  :~  ['status' %s ?:(verified 'saved' 'uncertain')]
      ['notebook' %s (id flag.item)]
      ['root_folder_id' %s (scot %ud +(id.notebook.item))]
      ['channel' ?:(linked [%s (cat 3 'notes/' (id flag.item))] ~)]
      ['group_listing_verified' %b &(linked verified)]
      :-  'note'
      :-  %s
      ?:  verified  'Native Notes creation confirmed.'
      'Notebook created; group listing/readers are not yet verified. Inspect get_notebook before writing; do not repeat creation.'
  ==
::
++  import-data
  |=  args=json
  ^-  [flag=flag:n folder=@ud tree=(list import-node:n) revision=@t]
  =/  =flag:n  (flag:spec (required:spec args 'notebook' 256))
  =/  folder  (number:spec args 'folder_id' 0)
  =/  folders=(list folder:n)
    .^  (list folder:n)  %gx
      /(scot %p our.bowl)/notes/(scot %da now.bowl)/v0/folders/(scot %p ship.flag)/[name.flag]/noun
    ==
  ?>  (lien folders |=(item=folder:n =(folder id.item)))
  =/  notes=(list note:n)
    .^  (list note:n)  %gx
      /(scot %p our.bowl)/notes/(scot %da now.bowl)/v0/notes/(scot %p ship.flag)/[name.flag]/noun
    ==
  =/  tree  (tree:imports args)
  ::  The plan token binds the tree to the current destination contents.
  [flag folder tree (scot %uv (sham [%notes-import flag folder folders notes tree]))]
::
++  deletion-confirmed
  |=  args=json
  ^-  ?
  =/  action  (required:spec args 'action' 32)
  ?.  |(=('delete_notebook' action) =('delete_channel' action))  |
  =/  flag
    ?:  =('delete_notebook' action)  (flag:spec (required:spec args 'notebook' 256))
    =/  nest  (group-nest:spec (required:spec args 'channel' 256))
    ?>  =(%notes kind.nest)
    +.nest
  =/  rows=(list notebook-summary:n)
    .^  (list notebook-summary:n)  %gx
      /(scot %p our.bowl)/notes/(scot %da now.bowl)/v0/notebooks/noun
    ==
  !(lien rows |=(item=notebook-summary:n =(flag flag.item)))
::
++  publication-confirmed
  |=  args=json
  ^-  ?
  =/  action  (required:spec args 'action' 32)
  ?>  |(=('publish_note' action) =('unpublish_note' action))
  =/  flag  (flag:spec (required:spec args 'notebook' 256))
  =/  note-id  (number:spec args 'note_id' 0)
  =/  rows=(list published-record:n)
    .^  (list published-record:n)  %gx
      /(scot %p our.bowl)/notes/(scot %da now.bowl)/v0/published/notes-published
    ==
  =/  visible  (lien rows |=(item=published-record:n &(=(flag flag.item) =(note-id note-id.item))))
  =(visible =('publish_note' action))
::
++  notebook-json
  |=  item=notebook-summary:n
  %-  pairs:enjs:format
  :~  ['notebook' %s (id flag.item)]
      ['title' %s title.notebook.item]
      ['root_folder_id' %s (scot %ud +(id.notebook.item))]
      ['visibility' %s visibility.item]
  ==
::
++  chunk
  |=  [args=json body=@t]
  ^-  json
  =/  start  (offset:spec args)
  =/  total  (met 3 body)
  ?>  (lte start total)
  =/  rest  (rsh [3 start] body)
  ?>  ?|  =('' rest)
          (lth (end [3 1] rest) 128)
          (gte (end [3 1] rest) 192)
      ==
  =/  text  (clip-text:hp rest 2.000)
  =/  next-offset  (add start (met 3 text))
  %-  pairs:enjs:format
  :~  ['text' %s text]
      ['total_bytes' (numb:enjs:format total)]
      ['next_offset' ?:((lth next-offset total) [%s (scot %ud next-offset)] ~)]
  ==
::
++  run
  |=  [args=json wire=wire]
  ^-  [body=@t effect=(unit card:agent:gall)]
  ?>  .^(? %gu /(scot %p our.bowl)/notes/(scot %da now.bowl)/$)
  =/  action  (required:spec args 'action' 32)
  ?:  =('plan_notes_import' action)
    (run-plan-import args)
  ?:  =('list_published_notes' action)
    (run-published args)
  ?:  =('list_notebooks' action)
    (run-notebooks args)
  ?:  =('list_notebook_invites' action)
    (run-invites args)
  =/  =flag:n
    ?:  =('create_notebook' action)  [our.bowl %unused]
    (flag:spec (required:spec args 'notebook' 256))
  =/  prefix=path  /(scot %p our.bowl)/notes/(scot %da now.bowl)/v0
  =/  suffix=path  /(scot %p ship.flag)/[name.flag]
  ?:  =('get_note_publication' action)
    (run-publication args flag)
  ?:  =('get_notebook' action)
    (run-notebook flag prefix suffix)
  ?:  =('list_notebook_members' action)
    (run-members args prefix suffix)
  ?:  =('list_folders' action)
    (run-folders args prefix suffix)
  ?:  =('list_notes' action)
    (run-notes args prefix suffix)
  ?:  |(=('get_note' action) =('note_revisions' action))
    (run-note args action prefix suffix)
  ::  Native Notes reports mutation outcomes through the request subscription.
  =/  command=a-notes:n  (mutation args action flag prefix suffix)
  ?>  ?=([@ @ ~] wire)
  =/  request-id=@uv  (slav %uv i.t.wire)
  :*  'pending: awaiting native Notes result'
      :-  ~
      :*  %pass  wire  %agent  [our.bowl %notes]  %poke  %notes-action-1
          !>(`action:v1:n`[request-id command])
      ==
  ==
::
++  run-plan-import
  |=  args=json
  ^-  [body=@t effect=(unit card:agent:gall)]
  =/  data  (import-data args)
  =/  sizes  (sizes:imports tree.data)
  =/  preview
    %-  pairs:enjs:format
    :~  ['revision' %s revision.data]
        ['notes' (numb:enjs:format notes.sizes)]
        ['folders' (numb:enjs:format folders.sizes)]
        ['body_bytes' (numb:enjs:format bytes.sizes)]
        ['confirm' %s (rap 3 (id flag.data) '/folder/' (scot %ud folder.data) ~)]
        :*  'note'  %s
            'Adds new items without overwriting existing items. Confirm this exact tree and destination. Never repeat an uncertain import automatically.'
        ==
    ==
  [(en:json:html preview) ~]
::
++  run-published
  |=  args=json
  ^-  [body=@t effect=(unit card:agent:gall)]
  =/  rows=(list published-record:n)
    .^  (list published-record:n)  %gx
      /(scot %p our.bowl)/notes/(scot %da now.bowl)/v0/published/notes-published
    ==
  =/  items
    %+  turn  rows
    |=  item=published-record:n
    %-  pairs:enjs:format
    :~  ['notebook' %s (id flag.item)]
        ['note_id' %s (scot %ud note-id.item)]
        ['public_path' %s (rap 3 '/notes/pub/' (id flag.item) '/' (scot %ud note-id.item) ~)]
    ==
  [(en:json:html (directory:spec args items)) ~]
::
++  run-notebooks
  |=  args=json
  ^-  [body=@t effect=(unit card:agent:gall)]
  =/  rows=(list notebook-summary:n)
    .^  (list notebook-summary:n)  %gx
      /(scot %p our.bowl)/notes/(scot %da now.bowl)/v0/notebooks/noun
    ==
  [(en:json:html (directory:spec args (turn rows notebook-json))) ~]
::
++  run-invites
  |=  args=json
  ^-  [body=@t effect=(unit card:agent:gall)]
  =/  rows=(list invite-record:n)
    .^((list invite-record:n) %gx /(scot %p our.bowl)/notes/(scot %da now.bowl)/v0/invites/noun)
  =/  items
    %+  turn  rows
    |=  item=invite-record:n
    %-  pairs:enjs:format
    :~  ['notebook' %s (id flag.item)]
        ['title' %s title.invite-info.item]
        ['from' %s (scot %p from.invite-info.item)]
    ==
  [(en:json:html (directory:spec args items)) ~]
::
++  run-publication
  |=  [args=json flag=flag:n]
  ^-  [body=@t effect=(unit card:agent:gall)]
  =/  note-id  (number:spec args 'note_id' 0)
  ?>  (gth note-id 0)
  =/  rows=(list published-record:n)
    .^  (list published-record:n)  %gx
      /(scot %p our.bowl)/notes/(scot %da now.bowl)/v0/published/notes-published
    ==
  =/  visible
    %+  lien
      rows
    |=(item=published-record:n &(=(flag flag.item) =(note-id note-id.item)))
  =/  publication
    %-  pairs:enjs:format
    :~  ['published' %b visible]
        :*  'public_path'
            ?:(visible [%s (rap 3 '/notes/pub/' (id flag) '/' (scot %ud note-id) ~)] ~)
        ==
        :*  'note'  %s
            'Public HTML is a snapshot, not live Markdown. Unpublishing cannot erase copies or caches held by other people.'
        ==
    ==
  [(en:json:html publication) ~]
::
++  run-notebook
  |=  [flag=flag:n prefix=path suffix=path]
  ^-  [body=@t effect=(unit card:agent:gall)]
  =/  item=notebook-detail:n
    .^(notebook-detail:n %gx (weld prefix (weld /notebook (weld suffix /noun))))
  =/  linked  (affiliations flag)
  =/  links
    %+  turn  linked
    |=  row=[flag=flag:n channel=channel:v9:g]
    %-  pairs:enjs:format
    :~  ['group' %s (id flag.row)]
        ['readers' %a (turn ~(tap in readers.channel.row) |=(role=@tas [%s role]))]
    ==
  =/  base  (notebook-json item)
  ?>  ?=(%o -.base)
  =/  body  (en:json:html [%o (~(put by p.base) 'group_channels' [%a links])])
  ?>  (lte (met 3 body) 23.000)
  [body ~]
::
++  run-members
  |=  [args=json prefix=path suffix=path]
  ^-  [body=@t effect=(unit card:agent:gall)]
  =/  rows=(list member-record:n)
    .^((list member-record:n) %gx (weld prefix (weld /members (weld suffix /noun))))
  =/  items
    %+  turn  rows
    |=  item=member-record:n
    (pairs:enjs:format ~[['ship' %s (scot %p ship.item)] ['role' %s role.item]])
  [(en:json:html (directory:spec args items)) ~]
::
++  run-folders
  |=  [args=json prefix=path suffix=path]
  ^-  [body=@t effect=(unit card:agent:gall)]
  =/  rows=(list folder:n)
    .^((list folder:n) %gx (weld prefix (weld /folders (weld suffix /noun))))
  =/  items
    %+  turn  rows
    |=  folder=folder:n
    %-  pairs:enjs:format
    :~  ['folder_id' %s (scot %ud id.folder)]
        ['name' %s name.folder]
        :*  'parent_folder_id'
            ?~(parent-folder-id.folder ~ [%s (scot %ud u.parent-folder-id.folder)])
        ==
    ==
  [(en:json:html (directory:spec args items)) ~]
::
++  run-notes
  |=  [args=json prefix=path suffix=path]
  ^-  [body=@t effect=(unit card:agent:gall)]
  =/  rows=(list note:n)
    .^((list note:n) %gx (weld prefix (weld /notes (weld suffix /noun))))
  =/  items
    %+  turn  rows
    |=  note=note:n
    %-  pairs:enjs:format
    :~  ['note_id' %s (scot %ud id.note)]
        ['title' %s title.note]
        ['folder_id' %s (scot %ud folder-id.note)]
        ['revision' %s (scot %ud revision.note)]
    ==
  [(en:json:html (directory:spec args items)) ~]
::
++  run-note
  |=  [args=json action=@t prefix=path suffix=path]
  ^-  [body=@t effect=(unit card:agent:gall)]
  =/  note-id  (number:spec args 'note_id' 0)
  ?>  (gth note-id 0)
  ?:  =('note_revisions' action)
    =/  rows=(list note-revision:n)
      .^  (list note-revision:n)  %gx
        (weld prefix (weld /note-history (weld suffix /(scot %ud note-id)/noun)))
      ==
    =/  items
      %+  turn  rows
      |=  revision=note-revision:n
      %-  pairs:enjs:format
      :~  ['revision' %s (scot %ud rev.revision)]
          ['title' %s title.revision]
          ['author' %s (scot %p author.revision)]
          ['at' %s (scot %da at.revision)]
      ==
    [(en:json:html (directory:spec args items)) ~]
  =/  =note:n
    .^(note:n %gx (weld prefix (weld /note (weld suffix /(scot %ud note-id)/noun))))
  ?:  (has:spec args 'revision')
    =/  revision  (number:spec args 'revision' 0)
    =/  rows=(list note-revision:n)
      .^  (list note-revision:n)  %gx
        (weld prefix (weld /note-history (weld suffix /(scot %ud note-id)/noun)))
      ==
    =/  found  (skim rows |=(item=note-revision:n =(revision rev.item)))
    ?~  found  !!
    =/  result
      %-  pairs:enjs:format
      :~  ['note_id' %s (scot %ud note-id)]
          ['revision' %s (scot %ud revision)]
          ['title' %s title.i.found]
          ['body' (chunk args body-md.i.found)]
      ==
    [(en:json:html result) ~]
  =/  result
    %-  pairs:enjs:format
    :~  ['note_id' %s (scot %ud note-id)]
        ['revision' %s (scot %ud revision.note)]
        ['title' %s title.note]
        ['folder_id' %s (scot %ud folder-id.note)]
        ['body' (chunk args body-md.note)]
    ==
  [(en:json:html result) ~]
::
++  mutation
  |=  [args=json action=@t flag=flag:n prefix=path suffix=path]
  ^-  a-notes:n
  ?:  =('create_notebook' action)
    =/  title  (required:spec args 'title' 128)
    ?.  (has:spec args 'group')
      ?>  !(has:spec args 'readers')
      [%create-notebook title]
    =/  group-flag=flag:n  (flag:spec (required:spec args 'group' 256))
    =/  group  (~(got by groups) group-flag)
    ?>  (admin:policy our.bowl ship.group-flag group)
    =/  allowed  (readers args)
    ?>  (levy ~(tap in allowed) |=(role=@tas (~(has by roles.group) role)))
    [%create-group-notebook title group-flag allowed]
  ?:  =('join_notebook' action)  [%join flag]
  ?:  =('leave_notebook' action)  [%leave flag]
  ?:  =('accept_notebook_invite' action)  [%accept-invite flag]
  ?:  =('decline_notebook_invite' action)  [%decline-invite flag]
  :-  %notebook
  :-  flag
  ?:  =('import_notes' action)
    =/  data  (import-data args)
    ?>  =(revision.data (required:spec args 'revision' 128))
    ?>  .=  (rap 3 (id flag) '/folder/' (scot %ud folder.data) ~)
        (required:spec args 'confirm' 384)
    [%batch-import-tree folder.data tree.data]
  ?:  =('set_notebook_visibility' action)
    ?>  =((id flag) (required:spec args 'confirm' 256))
    ?>  =(~ (affiliations flag))
    =/  visibility  (required:spec args 'visibility' 16)
    ?>  ?=(?(%public %private) visibility)
    [%visibility visibility]
  ?:  =('rename_notebook' action)  [%rename (required:spec args 'title' 128)]
  ?:  =('delete_notebook' action)
    ?>  =((id flag) (required:spec args 'confirm' 256))
    [%delete ~]
  ?:  =('invite_to_notebook' action)
    [%invite (ship:spec (required:spec args 'ship' 128))]
  ?:  =('create_folder' action)
    [%create-folder (number:spec args 'folder_id' 0) (required:spec args 'title' 128)]
  ?:  =('create_note' action)
    :*  %create-note  (number:spec args 'folder_id' 0)  (required:spec args 'title' 128)
        (string:spec args 'text' '' 16.384)
    ==
  ?:  ?|  =('rename_folder' action)
          =('move_folder' action)
          =('delete_folder' action)
      ==
    =/  folder-id  (number:spec args 'folder_id' 0)
    ?>  (gth folder-id 0)
    :-  %folder
    :-  folder-id
    ?:  =('rename_folder' action)
      [%rename (required:spec args 'title' 128)]
    ?:  =('move_folder' action)
      [%move (number:spec args 'new_parent' 0)]
    ?>  =((scot %ud folder-id) (required:spec args 'confirm' 256))
    [%delete =('true' (string:spec args 'recursive' 'false' 5))]
  (note-mutation args action flag prefix suffix)
::
++  note-mutation
  |=  [args=json action=@t flag=flag:n prefix=path suffix=path]
  ^-  a-notebook:n
  =/  note-id  (number:spec args 'note_id' 0)
  ?>  (gth note-id 0)
  :-  %note
  :-  note-id
  ?:  |(=('publish_note' action) =('unpublish_note' action))
    =/  target  (rap 3 (id flag) '/note/' (scot %ud note-id) ~)
    ?>  =(target (required:spec args 'confirm' 384))
    ?:  =('unpublish_note' action)  [%unpublish ~]
    =/  =note:n
      .^(note:n %gx (weld prefix (weld /note (weld suffix /(scot %ud note-id)/noun))))
    ?>  (has:spec args 'revision')
    ?>  =((number:spec args 'revision' 0) revision.note)
    =/  html=(unit @t)
      ?:((has:spec args 'html') `(required:spec args 'html' 16.384) ~)
    [%publish (page:publish-html title.note body-md.note html)]
  ?:  =('rename_note' action)
    [%rename (required:spec args 'title' 128)]
  ?:  =('move_note' action)  [%move (number:spec args 'folder_id' 0)]
  ?:  =('delete_note' action)
    ?>  =((scot %ud note-id) (required:spec args 'confirm' 256))
    [%delete ~]
  ?>  (has:spec args 'revision')
  ?:  =('restore_note' action)
    [%restore (number:spec args 'revision' 0)]
  ?>  =('edit_note' action)
  ?>  (has:spec args 'text')
  [%update (string:spec args 'text' '' 16.384) (number:spec args 'revision' 0)]
--

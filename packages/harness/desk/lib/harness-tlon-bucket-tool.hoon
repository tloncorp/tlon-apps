::  Buckets: a group's shared files and folders, as the production CLI
::  manages them. This ship's %buckets keeps a replica of each bucket it can
::  read and forwards changes to the host. A file's bytes travel through
::  Tlon's Memex service over HTTP, so reading or uploading them is not
::  offered here.
/-  b=buckets, g=groups-ver
/+  spec=harness-tlon-tool, group-tool=harness-tlon-group-tool,
    policy=harness-tlon-group-policy
|_  bowl=bowl:gall
+$  result  [body=@t effect=(unit card:agent:gall)]
::
++  handles
  |=  action=@t
  =/  actions=(list @t)
    :~  'list_buckets'  'list_bucket_files'  'search_bucket_files'  'create_bucket'
        'create_bucket_folder'  'rename_bucket_entry'  'move_bucket_entry'
        'delete_bucket_folder'  'set_bucket_writers'
    ==
  (lien actions |=(value=@t =(value action)))
::
++  agent  /(scot %p our.bowl)/buckets/(scot %da now.bowl)
::
++  run
  |=  [args=json wire=wire]
  ^-  result
  =/  action  (required:spec args 'action' 32)
  ?>  (handles action)
  ?.  .^(? %gu (weld agent /$))
    ['error: this ship does not run %buckets; it needs a newer Tlon' ~]
  ?:  =('list_buckets' action)
    [(en:json:html (directory:spec args (turn summaries summary-json))) ~]
  ?:  =('create_bucket' action)  (create args wire)
  =/  =flag:b  (flag:spec (required:spec args 'bucket' 256))
  ::  A missing bucket's scry is [~ ~], which crashes; ask whether it exists.
  ?.  .^(? %gu :(weld agent /joined/(scot %p ship.flag) /[name.flag]))
    ['error: no bucket with that ID on this ship; use list_buckets' ~]
  =/  state  (snapshot flag)
  ?:  |(=('list_bucket_files' action) =('search_bucket_files' action))
    [(en:json:html (files args action state)) ~]
  =/  change  (entry-change args action flag state)
  ?:  ?=(%| -.change)  [(cat 3 'error: ' p.change) ~]
  (command action [%bucket flag p.change] wire)
::
++  command
  |=  [action=@t act=a-buckets:b wire=wire]
  ^-  result
  =/  =command:b  [(sham [now.bowl eny.bowl act]) act]
  :_  `[%pass wire %agent [our.bowl %buckets] %poke %buckets-action-1 !>(command)]
  %+  rap  3
  :~  'accepted: local Tlon acknowledged '  action
      '; the bucket host applies it; verify with list_bucket_files or list_buckets'
  ==
::
++  summaries
  ^-  (list summary:b)
  .^((list summary:b) %gx (weld agent /v1/buckets/noun))
::
++  snapshot
  |=  =flag:b
  ^-  bucket-state:b
  =/  =response:b
    .^(response:b %gx :(weld agent /v1/buckets/(scot %p ship.flag) /[name.flag] /noun))
  ?>  ?=(%snapshot -.response)
  bucket-state.response
::
++  flag-id
  |=  flag=[@p @tas]
  (rap 3 (scot %p -.flag) '/' +.flag ~)
::
++  role-list
  |=  roles=(set @tas)
  ^-  json
  [%a (turn ~(tap in roles) |=(role=@tas [%s role]))]
::
++  summary-json
  |=  =summary:b
  ^-  json
  %-  pairs:enjs:format
  :~  ['bucket' %s (flag-id flag.summary)]
      ['title' %s title.bucket.summary]
      ['group' %s (flag-id group.summary)]
      ['writers' (role-list writers.summary)]
  ==
::
++  files
  |=  [args=json action=@t state=bucket-state:b]
  ^-  json
  =/  rows  ~(val by entries.state)
  =/  picked
    ?:  =('search_bucket_files' action)
      =/  needle  (crip (cass (trip (required:spec args 'query' 128))))
      (skim rows |=(=entry:b (matches needle entry)))
    =/  parent=(unit @ud)
      ?.((has:spec args 'folder_id') ~ `(number:spec args 'folder_id' 0))
    (skim rows |=(=entry:b =(parent parent.entry)))
  %-  pairs:enjs:format
  :~  ['title' %s title.bucket.state]
      ['writers' (role-list writers.state)]
      :*  'entries'
          %+  directory:spec  args
          (turn (sort picked |=([a=entry:b z=entry:b] (aor name.a name.z))) entry-json)
      ==
      :*  'note'  %s
          'Folders and files only; reading or uploading a file\'s contents is done in the app.'
      ==
  ==
::
++  matches
  |=  [needle=@t =entry:b]
  ^-  ?
  =/  in  |=(text=@t ?=(^ (find (trip needle) (cass (trip text)))))
  ?|  (in name.entry)
      (in (scot %p created-by.entry))
      &(?=(%file -.kind.entry) (in mime.file.kind.entry))
  ==
::
++  entry-json
  |=  =entry:b
  ^-  json
  =/  base=(list [@t json])
    :~  ['entry_id' %s (crip (a-co:co id.entry))]
        ['parent' ?~(parent.entry ~ [%s (crip (a-co:co u.parent.entry))])]
        ['name' %s name.entry]
        ['created_by' %s (scot %p created-by.entry)]
        ['updated' %s (scot %da updated-at.entry)]
    ==
  =/  kind=(list [@t json])
    ?:  ?=(%folder -.kind.entry)  ~[['kind' %s 'folder']]
    :~  ['kind' %s 'file']
        ['mime' %s mime.file.kind.entry]
        ['size' (numb:enjs:format size.file.kind.entry)]
        ['status' %s status.file.kind.entry]
    ==
  (pairs:enjs:format (weld base kind))
::
::  +folder: an optional folder argument, which must name a folder
::
++  folder
  |=  [args=json key=@t state=bucket-state:b]
  ^-  (each (unit @ud) @t)
  ?.  (has:spec args key)  [%& ~]
  =/  id  (number:spec args key 0)
  =/  found  (~(get by entries.state) id)
  ?:  |(?=(~ found) !?=(%folder -.kind.u.found))
    [%| 'that folder ID is not a folder in this bucket; use list_bucket_files']
  [%& `id]
::
::  +roles: a JSON-array string of a group's role IDs; [] means every member
::
++  roles
  |=  [raw=@t group=group:v9:g]
  ^-  (unit (set @tas))
  =/  parsed  (de:json:html raw)
  ?.  ?=([~ %a *] parsed)  ~
  =/  ids
    %+  murn  p.u.parsed
    |=  item=json
    ?.  ?=(%s -.item)  ~
    (rush p.item sym)
  ?.  =((lent ids) (lent p.u.parsed))  ~
  ::  An unknown role would be dropped, quietly widening the set.
  ?.  (levy ids |=(role=@tas (~(has by roles.group) role)))  ~
  `(silt ids)
::
++  entry-change
  |=  [args=json action=@t =flag:b state=bucket-state:b]
  ^-  (each a-bucket:b @t)
  ?:  =('create_bucket_folder' action)
    =/  parent  (folder args 'folder_id' state)
    ?:  ?=(%| -.parent)  [%| p.parent]
    [%& %create-folder p.parent (required:spec args 'name' 255)]
  ?:  =('set_bucket_writers' action)
    =/  group  (~(get by groups:~(. group-tool bowl)) group.state)
    ?~  group  [%| 'this ship is not in the bucket\'s group']
    =/  writers  (roles (required:spec args 'writers' 4.096) u.group)
    ?~  writers
      [%| 'writers must be a JSON array of the group\'s role IDs, or [] for every member']
    [%& %set-writers u.writers]
  =/  id  (number:spec args 'entry_id' 0)
  =/  entry  (~(get by entries.state) id)
  ?~  entry  [%| 'no entry with that entry_id; use list_bucket_files']
  ?:  =('rename_bucket_entry' action)
    [%& %entry id %rename (required:spec args 'name' 255)]
  ?:  =('move_bucket_entry' action)
    =/  parent  (folder args 'new_parent' state)
    ?:  ?=(%| -.parent)  [%| p.parent]
    [%& %entry id %move p.parent]
  ?>  =('delete_bucket_folder' action)
  ?.  ?=(%folder -.kind.u.entry)
    [%| 'only empty folders can be deleted here; delete files in the app']
  ?:  (lien ~(val by entries.state) |=(=entry:b =(`id parent.entry)))
    [%| 'that folder is not empty']
  [%& %entry id %delete |]
::
++  create
  |=  [args=json wire=wire]
  ^-  result
  =/  group-flag  (flag:spec (required:spec args 'group' 256))
  =/  group  (~(get by groups:~(. group-tool bowl)) group-flag)
  ?~  group  ['error: this ship is not in that group; use list_groups' ~]
  ?.  (admin:policy our.bowl -.group-flag u.group)
    ['error: making a bucket needs the group host or an admin' ~]
  ::  The host refuses this asynchronously, where a tool result can't see it.
  ?.  ?=(%duke (clan:title -.group-flag))
    ['error: only a group hosted on a planet can have a bucket' ~]
  =/  name  (slug:spec (required:spec args 'name' 63))
  ?:  (lien summaries |=(=summary:b =(flag.summary [-.group-flag name])))
    ['error: the group already has a bucket with that name' ~]
  =/  readers  (roles (string:spec args 'readers' '[]' 4.096) u.group)
  =/  writers  (roles (string:spec args 'writers' '[]' 4.096) u.group)
  ?:  |(?=(~ readers) ?=(~ writers))
    ['error: readers and writers must be JSON arrays of the group\'s role IDs; [] means everyone' ~]
  =/  title  (required:spec args 'title' 128)
  (command 'create_bucket' [%create name title group-flag u.readers u.writers] wire)
--

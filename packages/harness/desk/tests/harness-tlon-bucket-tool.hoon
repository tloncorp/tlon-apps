/-  b=buckets, g=groups-ver
/+  *test, bucket=harness-tlon-bucket-tool
|%
++  lib  ~(. bucket *bowl:gall)
++  args
  |=  fields=(list [@t json])
  (pairs:enjs:format fields)
++  group
  ^-  group:v9:g
  %*(. *group:v9:g roles (my ~[[%admin *role:v9:g] [%editor *role:v9:g]]))
++  item
  |=  [id=@ud parent=(unit @ud) name=@t kind=entry-kind:b]
  ^-  [@ud entry:b]
  [id `entry:b`[id parent name ~nec ~2026.9.1 ~nec ~2026.9.2 kind]]
++  state
  ^-  bucket-state:b
  %*  .  *bucket-state:b
    entries
      %-  my
      :~  (item 1 ~ 'Plans' [%folder ~])
          (item 2 `1 'roadmap.pdf' [%file 'application/pdf' 10 ~ 'k' %ready])
          (item 3 ~ 'Empty' [%folder ~])
          (item 4 ~ 'notes.txt' [%file 'text/plain' 3 ~ 'j' %ready])
      ==
  ==
++  change
  |=  [fields=(list [@t json]) action=@t]
  (entry-change:lib (args fields) action [~nec %files] state)
++  test-roles-must-exist-in-the-group
  %-  expect
  !>  ?&  =(`(silt ~[%admin]) (roles:lib '["admin"]' group))
          =(`~ (roles:lib '[]' group))
          =(~ (roles:lib '["admin","nobody"]' group))
          =(~ (roles:lib '"admin"' group))
      ==
++  test-folders
  =/  in-plans  ~[['name' %s 'Q3'] ['folder_id' %s '1']]
  =/  in-file  ~[['name' %s 'Q3'] ['folder_id' %s '2']]
  =/  into-plans  ~[['entry_id' %s '4'] ['new_parent' %s '1']]
  %-  expect
  !>  ?&  =([%& %create-folder `1 'Q3'] (change in-plans 'create_bucket_folder'))
          ::  A file is not a folder to create in.
          ?=([%| *] (change in-file 'create_bucket_folder'))
          =([%& %entry 4 %move `1] (change into-plans 'move_bucket_entry'))
          =([%& %entry 2 %move ~] (change ~[['entry_id' %s '2']] 'move_bucket_entry'))
      ==
++  test-delete-only-empty-folders
  %-  expect
  !>  ?&  =([%& %entry 3 %delete |] (change ~[['entry_id' %s '3']] 'delete_bucket_folder'))
          ?=([%| *] (change ~[['entry_id' %s '1']] 'delete_bucket_folder'))
          ?=([%| *] (change ~[['entry_id' %s '4']] 'delete_bucket_folder'))
          ?=([%| *] (change ~[['entry_id' %s '9']] 'delete_bucket_folder'))
      ==
++  test-listing-and-search
  =/  root  (files:lib (args ~) 'list_bucket_files' state)
  =/  found  (files:lib (args ~[['query' %s 'PDF']]) 'search_bucket_files' state)
  =/  names
    |=  listing=json
    =/  text  (en:json:html listing)
    :~  ?=(^ (find "roadmap.pdf" (trip text)))
        ?=(^ (find "notes.txt" (trip text)))
        ?=(^ (find "Plans" (trip text)))
    ==
  %-  expect
  !>  ?&  =(~[| & &] (names root))
          =(~[& | |] (names found))
      ==
--

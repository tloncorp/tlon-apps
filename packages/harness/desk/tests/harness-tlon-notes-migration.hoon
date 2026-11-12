::  Planner snapshots and batch limits use synthetic native reads only.
/-  n=notes, g=groups-ver, d=channels-ver
/+  *test, migration=harness-tlon-notes-migration
|%
++  migration-core  ~(. migration bowl)
+$  snapshot
  $:  permission=perm:v9:d
      groups=groups:v9:g
      folders=(list folder:n)
      detail=notebook-detail:n
      notes=(list note:n)
      page=paged-posts:v10:d
  ==
++  bowl
  ^-  bowl:gall
  =/  context  *bowl:gall
  context(our ~lux, src ~lux, now ~2026.10.1)
++  rows
  |=  [count=@ud text=@t]
  ^-  (list [@da (may:v10:d post:v10:d)])
  ?:  =(0 count)  ~
  %+  turn  (gulf 1 count)
  |=  index=@ud
  =/  post  *post:v10:d
  =/  at  (add ~2026.9.9 index)
  =.  post
    post(id at, seq index, sent at, author ~lux, content ~[[%inline ~[text]]])
  [at [%& post]]
++  fixture
  |=  [count=@ud text=@t]
  ^-  snapshot
  =/  permission  *perm:v9:d
  =.  permission  permission(group [~lux %test], writers (silt ~[%editors]))
  =/  channel  *channel:v9:g
  =.  channel  channel(readers (silt ~[%editors]), meta ['Diary' '' '' ''])
  =/  group  *group:v9:g
  =.  channels.group
    (my ~[[[%diary ~lux %source] channel] [[%notes ~lux %book] channel]])
  =/  folder  *folder:n
  =.  folder  folder(id 1, name 'Root')
  =/  detail  *notebook-detail:n
  =.  flag.detail  [~lux %book]
  =/  page  *paged-posts:v10:d
  =.  page  page(total count, newest count)
  =.  posts.page
    %+  roll  (rows count text)
    |=  [row=[@da (may:v10:d post:v10:d)] posts=posts:v10:d]
    (put:on-posts:v10:d posts -.row +.row)
  [permission (my ~[[[~lux %test] group]]) ~[folder] detail ~ page]
++  with-planner
  |=  $:  planner=$-(json plan:migration-core)
          args=json
          snapshot=snapshot
      ==
  ^-  (unit plan:migration-core)
  =/  attempt  |.((planner args))
  =/  checked
    %+  mink  [attempt %9 2 %0 1]
    |=  [ref=* raw=*]
    ^-  (unit (unit noun))
    =/  path  ;;(path raw)
    ?:  =(path /gx/~lux/channels/(scot %da now:bowl)/diary/~lux/source/perm/channel-perm)
      ``permission.snapshot
    ?:  =(path /gx/~lux/groups/(scot %da now:bowl)/v2/groups/noun)
      ``groups.snapshot
    ?:  =(path /gx/~lux/notes/(scot %da now:bowl)/v0/folders/~lux/book/noun)
      ``folders.snapshot
    ?:  =(path /gx/~lux/notes/(scot %da now:bowl)/v0/notebook/~lux/book/noun)
      ``detail.snapshot
    ?:  =(path /gx/~lux/notes/(scot %da now:bowl)/v0/notes/~lux/book/noun)
      ``notes.snapshot
    =/  outline  /gx/~lux/channels/(scot %da now:bowl)/v5/diary/~lux/source/posts
    ?:  =(path (weld outline /newest/5.001/outline/channel-posts-5))
      ``page.snapshot
    ~
  ?.  ?=(%0 -.checked)  ~
  `;;(plan:migration-core product.checked)
++  args
  %-  pairs:enjs:format
  ~[['channel' %s 'diary/~lux/source'] ['notebook' %s '~lux/book']]
++  field
  |=  [value=json key=@t]
  ^-  json
  ?>  ?=(%o -.value)
  (~(got by p.value) key)
++  imported-note
  |=  [post=post:v10:d folder=@ud]
  ^-  note:n
  =/  converted  (converted:migration-core 'diary/~lux/source' post)
  =/  note  *note:n
  note(id 1, folder-id folder, title title.converted, body-md body.converted)
++  row-post
  |=  row=[@da (may:v10:d post:v10:d)]
  ^-  post:v10:d
  ?>  ?=(%& -.+.row)
  +.+.row
++  test-plan-binds-the-source-and-destination-snapshot
  =/  snapshot  (fixture 3 'Body')
  =/  first  (need (with-planner prepare:migration-core args snapshot))
  =/  changed  snapshot(notes ~[(imported-note (row-post (snag 0 (rows 1 'Body'))) 1)])
  =/  second  (need (with-planner prepare:migration-core args changed))
  ;:  weld
      (expect-eq !>(3) !>((lent batch.first)))
      (expect-eq !>([%b &]) !>((field preview.first 'ready')))
      (expect-eq !>([%n '1']) !>((field preview.second 'already_imported')))
      (expect-eq !>(2) !>((lent batch.second)))
      (expect !>(!=(revision.first revision.second)))
  ==
++  test-planning-without-a-destination-does-not-read-folder-parameters
  =/  without
    %-  pairs:enjs:format
    ~[['channel' %s 'diary/~lux/source'] ['folder_id' %s 'invalid']]
  =/  result  (need (with-planner prepare:migration-core without (fixture 1 'Body')))
  ;:  weld
      (expect-eq !>([%b |]) !>((field preview.result 'ready')))
      (expect-eq !>(~) !>((field preview.result 'revision')))
      (expect-eq !>(1) !>((lent batch.result)))
  ==
++  test-planner-rejects-partial-pages-and-mismatched-readers
  =/  snapshot  (fixture 1 'Body')
  =/  group  (~(got by groups.snapshot) [~lux %test])
  =/  target  (~(got by channels.group) [%notes ~lux %book])
  =.  channels.group  (~(put by channels.group) [%notes ~lux %book] target(readers ~))
  =/  mismatched  snapshot(groups (my ~[[[~lux %test] group]]))
  ;:  weld
      (expect-eq !>(~) !>((with-planner prepare:migration-core args snapshot(total.page 2))))
      %+  expect-eq
        !>(~)
      !>((with-planner prepare:migration-core args snapshot(older.page `~2026.9.1)))
      (expect-eq !>(~) !>((with-planner prepare:migration-core args mismatched)))
  ==
++  test-collection-scans-imports-and-conflicts-after-the-batch-limit
  =/  rows  (rows 67 'Body')
  =/  imported  (imported-note (row-post (snag 65 rows)) 1)
  =/  conflict  (imported-note (row-post (snag 66 rows)) 2)
  =/  lib  ~(. migration bowl)
  =/  result  (collect:lib 'diary/~lux/source' rows (index:lib ~[imported conflict]) 1)
  %-  expect
  !>  ?&  =(67 eligible.result)  =(1 imported.result)  =(1 conflicts.result)
          =(64 (lent batch.result))  =(8 (lent titles.result))
      ==
++  test-byte-limited-batches-do-not-skip-ahead-to-smaller-posts
  =/  large  (rows 2 (crip (reap 70.000 'a')))
  =/  rows  (weld large (rows 1 'Small'))
  =/  result  (collect:migration-core 'diary/~lux/source' rows ~ 1)
  %-  expect
  !>  ?&  =(3 eligible.result)  =(1 (lent batch.result))
          (gth bytes.result batch-bytes.result)  (lte batch-bytes.result 131.072)
      ==
--

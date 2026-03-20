/-  *notes
/+  *test-agent
/=  notes-agent  /app/notes
|%
++  dap  %notes

++  test-create-notebook-root
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  caz=(list card)  b  (do-init dap notes-agent)
  ;<  =bowl:gall       b  get-bowl
  ;<  caz=(list card)  b
    (do-poke %notes-action !>([%create-notebook 'Demo']))
  ;<  ~                b
    %+  ex-cards  caz
    :~  (ex-fact ~[/events/1] %notes-event !>([%notebook-created 1 src.bowl]))
    ==
  ;<  peek=(unit (unit cage))  b  (get-peek /x/notebook/1)
  =/  cag  (need (need peek))
  =/  expected-notebook=notebook:notes
    [1 'Demo' src.bowl now.bowl]
  ;<  ~  b
    %+  ex-equal
      !>(cag)
      !>(noun+!>(expected-notebook))
  ;<  peek=(unit (unit cage))  b  (get-peek /x/folders)
  =/  folders-cag  (need (need peek))
  =/  root-folder=folder:notes
    [2 1 '/' ~ src.bowl now.bowl now.bowl]
  =/  expected-folders=(map @ud folder:notes)
    (~(put by *(map @ud folder:notes)) 2 root-folder)
  %+  ex-equal
    !>(folders-cag)
    !>(noun+!>(expected-folders))

++  test-recursive-delete-folder-tree
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  *  b  (do-init dap notes-agent)
  ;<  =bowl:gall  b  get-bowl
  :: notebook id=1, root folder id=2
  ;<  *  b  (do-poke %notes-action !>([%create-notebook 'Demo']))
  :: child folder id=3
  ;<  *  b  (do-poke %notes-action !>([%create-folder 1 `2 'Drafts']))
  :: note id=4 in folder 3
  ;<  *  b  (do-poke %notes-action !>([%create-note 1 3 'N1' '# hi']))
  ;<  caz=(list card)  b
    (do-poke %notes-action !>([%delete-folder 1 3 %.y]))
  ;<  ~  b
    %+  ex-cards  caz
    :~  (ex-fact ~[/events/1] %notes-event !>([%folder-deleted 3 1 src.bowl]))
    ==
  ;<  peek=(unit (unit cage))  b  (get-peek /x/folders)
  =/  folders-cag  (need (need peek))
  =/  root-folder=folder:notes
    [2 1 '/' ~ src.bowl now.bowl now.bowl]
  =/  expected-folders=(map @ud folder:notes)
    (~(put by *(map @ud folder:notes)) 2 root-folder)
  ;<  ~  b
    %+  ex-equal
      !>(folders-cag)
      !>(noun+!>(expected-folders))
  ;<  peek=(unit (unit cage))  b  (get-peek /x/notes)
  =/  notes-cag  (need (need peek))
  %+  ex-equal
    !>(notes-cag)
    !>(noun+!>(*(map @ud note:notes)))
--

/-  n=notes, w=harness-workspace, hn=harness-notes
/+  *test, notes=harness-notes, work=harness-workspace
|%
++  fixture
  ^-  state:w
  =/  out
    %:  apply:work
      *state:w
      [& [0v0 'Owner'] 0v0]
      [%artifact-create 'doc' ~ ['Title' 'Body' ~]]
      ~2026.9.11
    ==
  ?>  ?=(%& -.out)
  p.out
++  test-projection-preserves-unrelated-workspace-state
  =/  db=state:w  fixture
  =.  writes.db  37
  ;:  weld
      (expect-eq !>(db) !>((project-book:notes db *state:hn *notebook-state:n)))
      (expect-eq !>(db) !>((project-update:notes db *state:hn [%note 999 %deleted ~])))
  ==
++  test-native-deletion-only-removes-the-linked-artifact
  =/  db=state:w  fixture
  =.  writes.db  37
  =/  native=state:hn  *state:hn
  =.  links.native  (~(put by links.native) 'doc' [42 ~ ~])
  =/  expected  db(artifacts ~, recency ~, writes 38)
  ;:  weld
      (expect-eq !>(expected) !>((project-book:notes db native *notebook-state:n)))
      (expect-eq !>(expected) !>((project-update:notes db native [%note 42 %deleted ~])))
  ==
++  test-native-public-path
  (expect-eq !>('/notes/pub/~zod/harness/42') !>((public-path:notes [~zod %harness] 42)))
++  test-native-updates-maintain-recency-without-read-time-replay
  =/  native=state:hn  *state:hn
  =.  links.native  (my ~[['doc' [42 ~ ~]]])
  =/  =note:n  *note:n
  =.  id.note  42
  =.  title.note  'Renamed'
  =.  body-md.note  'Body'
  =.  updated-at.note  ~2026.9.14
  =/  update=u-notebook:n  [%note 42 %updated note]
  =/  db  (project-update:notes fixture native update)
  =/  book=notebook-state:n  *notebook-state:n
  =.  notes.book  (my ~[[42 note]])
  ;:  weld
      (expect-eq !>(`~2026.9.14) !>((~(get by recency.db) [%artifact 'doc'])))
      (expect-eq !>(db) !>((project-update:notes db native update)))
      (expect-eq !>(recency.db) !>(recency:(project-book:notes fixture native book)))
  ==
++  test-metadata-lists-do-not-read-native-document-bodies
  ;:  weld
      (expect !>(!(needs-notes:notes 'artifacts')))
      (expect !>(!(needs-notes:notes 'proposals')))
      (expect !>(!(needs-notes:notes 'projects')))
      (expect !>(!(needs-notes:notes 'tasks')))
      (expect !>((needs-notes:notes 'artifact')))
      (expect !>((needs-notes:notes 'revision')))
      (expect !>((needs-notes:notes 'proposal')))
      (expect !>((needs-notes:notes 'task-reply')))
  ==
++  test-decorating-empty-pages-preserves-json-null
  =/  page=json  (pairs:enjs:format ~[['items' %a ~] ['nextOffset' ~] ['referenceOnly' %b &]])
  =/  nested=json  [%a ~[~ page [%s 'unchanged']]]
  ;:  weld
      (expect-eq !>(`json`~) !>((decorate:notes *state:hn ~)))
      (expect-eq !>(page) !>((decorate:notes *state:hn page)))
      (expect-eq !>(nested) !>((decorate:notes *state:hn nested)))
  ==
++  native-fixture
  ^-  state:hn
  %*  .  *state:hn
    book  `[~zod %harness]
    folder  1
    links  (my ~[['doc' [42 ~ ~]]])
  ==
++  test-rename-retains-the-receipt-and-current-revision-snapshot
  =/  args=json  (pairs:enjs:format ~[['id' %s 'doc'] ['title' %s 'Renamed']])
  =/  out
    %:  prepare:notes
      fixture  native-fixture  [%native 'rename']  'artifact-rename'  args  'fallback'
      ~2026.9.11  0v2
    ==
  =/  expected=pending:hn
    :*  0v2  [%native 'rename']  'artifact-rename'  args  'doc'
        (~(got by artifacts:fixture) 'doc')  *content:w  [0v0 'Owner']  ~  %write  |
        [%notebook [~zod %harness] %note 42 %rename 'Renamed']  |
    ==
  (expect-eq !>(`(each pending:hn @t)`[%& expected]) !>(out))
++  test-body-save-keeps-its-receipt-without-an-accepted-projection
  =/  args=json
    %-  pairs:enjs:format
    :~  ['id' %s 'doc']  ['base' %n '1']  ['title' %s 'Title']  ['body' %s 'New body']
    ==
  =/  out
    %:  prepare:notes
      fixture  native-fixture  [%work 0v9]  'artifact-save'  args  'fallback'
      ~2026.9.11  0v3
    ==
  ?>  ?=(%& -.out)
  ;:  weld
      (expect-eq !>(0v3) !>(id.p.out))
      (expect-eq !>(`reply:hn`[%work 0v9]) !>(reply.p.out))
      (expect-eq !>(args) !>(args.p.out))
      (expect-eq !>('doc') !>(artifact.p.out))
      (expect-eq !>(`content:w`['Title' 'New body' ~]) !>(value.p.out))
      (expect !>(?=(~ revisions.candidate.p.out)))
      (expect !>(!sent.p.out))
      (expect !>(!uncertain.p.out))
      %+  expect-eq
        !>(`a-notes:n`[%notebook [~zod %harness] %note 42 %update 'New body' 0])
      !>(command.p.out)
  ==
++  test-create-is-native-and-has-no-accepted-projection
  =/  args=json  (pairs:enjs:format ~[['title' %s 'Draft'] ['body' %s 'Native body']])
  =/  out
    %:  prepare:notes
      *state:w
      *state:hn
      [%native 'test']
      'artifact-create'
      args
      'doc'
      ~2026.9.11
      0v1
    ==
  ?>  ?=(%& -.out)
  ;:  weld
      (expect-eq !>(%book) !>(stage.p.out))
      (expect-eq !>(`a-notes:n`[%create-notebook 'Harness artifacts']) !>(command.p.out))
      (expect !>(?=(~ revisions.candidate.p.out)))
  ==
--

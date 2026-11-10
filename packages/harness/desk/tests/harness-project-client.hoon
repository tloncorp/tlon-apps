/-  pc=harness-project-client, w=harness-workspace
/+  *test, client=harness-project-client, j=harness-workspace-json
|%
++  key  'hpr_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
++  second-key  'hpr_abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
++  args
  |=  [id=@t key=@t days=@ud]
  %-  pairs:enjs:format
  :~  ['id' %s id]  ['project' %s 'project']  ['version' %n '1']  ['label' %s 'Read fixture']
      ['key' %s key]  ['days' (numb:enjs:format days)]
  ==
++  fixture
  ^-  state:w
  =/  db  *state:w
  =.  projects.db
    %-  my
    :~  ['project' ['Shared project' 'Purpose' 1 (my ~[[0v9 %maintainer]]) |]]
        ['other' ['Private other project' '' 1 ~ |]]
    ==
  =/  =artifact:w
    :*  0v1  `'project'  'Shared document'  1
        (my ~[[1 [~2026.9.13 [0v9 'Author'] ['Shared document' 'SELECTED-CONTENT' ~]]]])  ~  0  |
    ==
  =.  artifacts.db
    %-  my
    :~  ['document' artifact]  ['private' artifact(project ~, label 'PRIVATE-CONTENT')]
        ['other-document' artifact(project `'other')]
    ==
  =.  tasks.db
    %-  my
    :~  ['task' ['project' 'Shared task' '' 1 %open ~ '' ~ ~2026.9.13]]
        ['other-task' ['other' 'PRIVATE-TASK' '' 1 %open ~ '' ~ ~2026.9.13]]
    ==
  =.  proposals.db
    %-  my
    :~  :*  'proposal'
            :*  'document'  1  [0v9 'Author']  0v9  ~2026.9.13
                ['Shared document' 'Proposed change' ~]  'Review me'  %pending  ~  ''  ~
            ==
        ==
        :*  'other-proposal'
            :*  'other-document'  1  [0v9 'Author']  0v9  ~2026.9.13  ['Other' 'PRIVATE-PROPOSAL' ~]
                ''  %pending  ~  ''  ~
            ==
        ==
    ==
  db
++  issued
  ^-  state:pc
  =/  out  (owner-request:client *state:pc fixture 'client-create' (args 'client' key 7) ~2026.9.13)
  ?>  ?=(%& -.out)
  db.p.out
++  read
  |=  [action=@t args=json]
  ^-  json
  =/  out  (read:client fixture 'project' action args)
  ?>  ?=(%& -.out)
  p.out
++  test-key-format-and-authorization-header-are-exact
  ;:  weld
      (expect !>((valid-key:client key)))
      (expect !>(!(valid-key:client 'short')))
      (expect !>(!(valid-key:client (cat 3 key '0'))))
      (expect-eq !>(`key) !>((header-key:client ~[['Authorization' (cat 3 'Bearer ' key)]])))
      (expect-eq !>(`(unit @t)`~) !>((header-key:client ~[['cookie' (cat 3 'Bearer ' key)]])))
      %+  expect-eq
        !>(`(unit @t)`~)
      !>  %-  header-key:client
          ~[['authorization' (cat 3 'Bearer ' key)] ['Authorization' (cat 3 'Bearer ' second-key)]]
  ==
++  test-creation-stores-a-digest-and-redacts-the-owner-response
  =/  out  (owner-request:client *state:pc fixture 'client-create' (args 'client' key 7) ~2026.9.13)
  ?>  ?=(%& -.out)
  =/  stored  (~(got by db.p.out) 'client')
  ;:  weld
      (expect-eq !>((digest:client key)) !>(digest.stored))
      (expect-eq !>(~2026.9.20) !>(expires.stored))
      (expect-eq !>('read-only') !>((string:j result.p.out 'access')))
      (expect-eq !>(`(unit json)`~) !>((get:j result.p.out 'key')))
      (expect-eq !>(`(unit json)`~) !>((get:j result.p.out 'digest')))
  ==
++  test-repeat-create-never-extends-expiry-or-changes-scope
  =/  db  issued
  =/  repeat  (owner-request:client db fixture 'client-create' (args 'client' key 7) ~2026.9.14)
  =/  changed
    %:  owner-request:client
      db
      fixture
      'client-create'
      (args 'client' second-key 7)
      ~2026.9.14
    ==
  =/  extended  (owner-request:client db fixture 'client-create' (args 'client' key 30) ~2026.9.14)
  ?>  ?=(%& -.repeat)
  ;:  weld
      (expect-eq !>(db) !>(db.p.repeat))
      (expect !>(?=(%| -.changed)))
      (expect !>(?=(%| -.extended)))
  ==
++  test-revocation-is-durable-and-cannot-be-replayed-away
  =/  out  (owner-request:client issued fixture 'client-revoke' (args 'client' '' 7) ~2026.9.14)
  ?>  ?=(%& -.out)
  =/  db  db.p.out
  =/  replay  (owner-request:client db fixture 'client-create' (args 'client' key 7) ~2026.9.15)
  =/  duplicate
    %:  owner-request:client
      db
      fixture
      'client-create'
      (args 'different-id' key 7)
      ~2026.9.15
    ==
  ;:  weld
      (expect !>(?=(~ (authenticate:client db fixture key ~2026.9.15))))
      (expect !>(?=(%| -.replay)))
      (expect !>(?=(%| -.duplicate)))
  ==
++  test-expiry-and-project-archival-fence-every-read
  =/  archived  fixture
  =/  project  (~(got by projects.archived) 'project')
  =.  projects.archived  (~(put by projects.archived) 'project' project(archived &))
  ;:  weld
      (expect !>(?=(^ (authenticate:client issued fixture key ~2026.9.19))))
      (expect !>(?=(~ (authenticate:client issued fixture key ~2026.9.20))))
      (expect !>(?=(~ (authenticate:client issued archived key ~2026.9.14))))
      (expect !>(?=(~ (authenticate:client issued fixture second-key ~2026.9.14))))
  ==
++  test-expiry-bounds-are-explicit
  =/  short
    %:  owner-request:client
      *state:pc
      fixture
      'client-create'
      (args 'client' key 0)
      ~2026.9.13
    ==
  =/  long
    %:  owner-request:client
      *state:pc
      fixture
      'client-create'
      (args 'client' key 31)
      ~2026.9.13
    ==
  (expect !>(&(?=(%| -.short) ?=(%| -.long))))
++  test-read-view-strips-private-data-and-real-membership
  =/  db  (view:client fixture 'project')
  ;:  weld
      (expect-eq !>(1) !>(~(wyt by projects.db)))
      (expect-eq !>(1) !>(~(wyt by artifacts.db)))
      (expect-eq !>(1) !>(~(wyt by proposals.db)))
      (expect-eq !>(1) !>(~(wyt by tasks.db)))
      (expect-eq !>((my ~[[0v1 %reader]])) !>(members:(~(got by projects.db) 'project')))
      (expect-eq !>(`(list audit:w)`~) !>(history.db))
  ==
++  test-foreign-identities-cannot-be-read-even-with-colliding-owner-scope
  =/  checks
    %+  turn
      ^-  (list [@t @t])
      :~  ['artifact' 'private']  ['artifact' 'other-document']  ['task' 'other-task']
          ['proposal' 'other-proposal']  ['project' 'other']
      ==
    |=  [action=@t id=@t]
    =/  out  (read:client fixture 'project' action (pairs:enjs:format ~[['id' %s id]]))
    ?=(%| -.out)
  (expect !>((levy checks |=(ok=? ok))))
++  test-readable-project-has-no-member-list-or-write-authority
  =/  project  (read 'project' (pairs:enjs:format ~[['id' %s 'project']]))
  =/  task  (read 'task' (pairs:enjs:format ~[['id' %s 'task']]))
  =/  allowed
    %+  turn
      ^-  (list @t)
      :~  'task-update'  'task-create'  'task-claim'  'project-edit'  'member'  'client-create'
          'client-revoke'  'clients'  'artifact-create'  'propose'  'review'  'publish'  'unpublish'
          'sessions'  'audit'  'preview'  'tlon'  'harness_admin'
      ==
    |=  action=@t
    !(read-action:client action)
  ;:  weld
      (expect-eq !>('reader') !>((string:j project 'role')))
      (expect-eq !>(`(unit json)`[~ ~]) !>((get:j project 'members')))
      (expect-eq !>('Shared task') !>((string:j task 'title')))
      (expect !>((levy allowed |=(ok=? ok))))
  ==
++  test-client-list-size-uses-model-read-bounds
  =/  refused  (read:client fixture 'project' 'tasks' (pairs:enjs:format ~[['limit' %n '5']]))
  (expect !>(?=(%| -.refused)))
--

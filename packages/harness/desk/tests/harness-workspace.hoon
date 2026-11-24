/-  w=harness-workspace
/+  *test, work=harness-workspace, document=harness-document, codec=harness-workspace-json
|%
++  owner  `authority:w`[& [0v0 'Owner'] 0v0]
++  agent  `authority:w`[| [0v1 'researcher'] 0v1]
++  other  `authority:w`[| [0v2 'writer'] 0v2]
++  value  `content:w`['Community plan' 'A durable document.' ~]
++  step
  |=  [db=state:w who=authority:w act=action:w]
  ^-  state:w
  =/  out  (apply:work db who act ~2026.9.11)
  ?>  ?=(%& -.out)
  p.out
++  project
  ^-  state:w
  =/  db  (step *state:w owner [%project-create 'project' 'Community' 'Shared research'])
  (step db owner [%member 'project' 1 0v1 `%contributor])
++  fixture
  (step project owner [%artifact-create 'document' `'project' value])
++  test-agent-draft-needs-owner-review
  =/  db  (step project agent [%artifact-create 'draft' `'project' value])
  =/  art  (~(got by artifacts.db) 'draft')
  =/  proposal  (~(got by proposals.db) 'draft')
  =/  refused  (apply:work db agent [%review 'draft' & 'Approve myself'] ~2026.9.11)
  =/  accepted  (step db owner [%review 'draft' & 'Reviewed'])
  ;:  weld
      (expect-eq !>(0) !>(head.art))
      (expect-eq !>(%pending) !>(status.proposal))
      (expect !>(?=(%| -.refused)))
      (expect-eq !>(1) !>(head:(~(got by artifacts.accepted) 'draft')))
  ==
++  test-project-membership-does-not-leak-to-other-conversations
  =/  db  fixture
  =/  art  (~(got by artifacts.db) 'document')
  ;:  weld
      (expect !>((can-read:work db agent art)))
      (expect !>(!(can-read:work db other art)))
      (expect !>(!(can-read:work db [| [0v3 'researcher'] 0v3] art)))
  ==
++  test-concurrent-edits-reject-stale-proposals
  =/  db  (step fixture agent [%propose 'proposal' 'document' 1 value 'Improve it'])
  =/  updated  (step db owner [%artifact-save 'document' 1 `'project' ['New title' 'New body' ~]])
  =/  refused  (apply:work updated owner [%review 'proposal' & 'Accept'] ~2026.9.11)
  ;:  weld
      (expect !>(?=(%| -.refused)))
      (expect-eq !>(%pending) !>(status:(~(got by proposals.updated) 'proposal')))
      (expect-eq !>(2) !>(head:(~(got by artifacts.updated) 'document')))
  ==
++  test-revoked-contributors-cannot-propose-or-have-old-work-auto-accepted
  =/  db  (step fixture agent [%propose 'proposal' 'document' 1 value 'Improve it'])
  =/  db  (step db owner [%member 'project' 2 0v1 ~])
  =/  refused  (apply:work db owner [%review 'proposal' & 'Accept'] ~2026.9.11)
  =/  write  (apply:work db agent [%propose 'second' 'document' 1 value 'Again'] ~2026.9.11)
  (expect !>(&(?=(%| -.refused) ?=(%| -.write))))
++  test-publication-stays-on-explicit-revision
  =/  db  (step fixture owner [%publish 'document' 1 1 0 'community' '<p>Approved</p>'])
  =/  db
    %^  step
      db
      owner
    [%artifact-save 'document' 1 `'project' ['Private draft' 'Do not publish' ~]]
  =/  art  (~(got by artifacts.db) 'document')
  =/  unpublished  (step db owner [%unpublish 'document' 1])
  ?>  ?=(^ publication.art)
  ;:  weld
      (expect-eq !>(1) !>(revision.u.publication.art))
      (expect-eq !>('<p>Approved</p>') !>(html.u.publication.art))
      (expect-eq !>(`(map @t id:w)`~) !>(slugs.unpublished))
  ==
++  test-two-agents-cannot-claim-one-task
  =/  db  (step project owner [%member 'project' 2 0v2 `%contributor])
  =/  db  (step db owner [%task-create 'task' 'project' 'Research costs' 'Return evidence'])
  =/  version  version:(~(got by tasks.db) 'task')
  =/  claimed  (step db agent [%task-claim 'task' version])
  =/  refused  (apply:work claimed other [%task-claim 'task' version] ~2026.9.11)
  =/  updated
    %^  step
      claimed
      other
    :*  %task-update  'task'  version:(~(got by tasks.claimed) 'task')  %done
        'Verified by the coordinator'  ~  ~
    ==
  ;:  weld
      (expect !>(?=(%| -.refused)))
      %+  expect-eq
        !>(`(unit actor:w)`[~ [0v1 'researcher']])
      !>(claimant:(~(got by tasks.updated) 'task'))
      (expect-eq !>(`actor:w`[0v2 'writer']) !>(by:(snag 0 history.updated)))
  ==
++  test-public-renderer-keeps-markup-inert
  =/  html
    %+  page:document
      '<script>title</script>'
    '# Heading\0a\0a**Bold** and [friend](https://example.com).\0a\0a<script>alert(1)</script>\0a\0a```\0a<private>\0a```'
  ;:  weld
      (expect !>(?=(^ (split:document "&lt;script&gt;title" (trip html)))))
      (expect !>(?=(^ (split:document "<strong>Bold</strong>" (trip html)))))
      (expect !>(?=(~ (split:document "<script>" (trip html)))))
      (expect !>(!(safe-url:document 'javascript:alert(1)')))
  ==
++  test-project-scope-cannot-expose-private-history
  =/  db  (step project owner [%artifact-create 'private' ~ value])
  =/  refused  (apply:work db owner [%artifact-save 'private' 1 `'project' value] ~2026.9.11)
  (expect !>(?=(%| -.refused)))
++  test-new-artifact-cannot-overwrite-existing-proposal
  =/  db  (step fixture agent [%propose 'collision' 'document' 1 value 'Original'])
  =/  refused  (apply:work db agent [%artifact-create 'collision' `'project' value] ~2026.9.11)
  (expect !>(?=(%| -.refused)))
++  test-owner-task-update-retains-an-explicit-claimant
  =/  db  (step project owner [%task-create 'task' 'project' 'Write' ''])
  =/  db  (step db owner [%task-update 'task' version:(~(got by tasks.db) 'task') %claimed '' ~ ~])
  (expect-eq !>(`(unit actor:w)`[~ [0v0 'Owner']]) !>(claimant:(~(got by tasks.db) 'task')))
++  test-content-pagination-is-parsed-only-for-present-content
  =/  project-args  (pairs:enjs:format ~[['id' %s 'project']])
  =/  unrelated
    %-  pairs:enjs:format
    :~  ['id' %s 'project']  ['paged' %s 'invalid']
        ['offset' %s 'invalid']  ['sourceOffset' %s 'invalid']
    ==
  =/  missing
    %-  pairs:enjs:format
    :~  ['id' %s 'document']  ['revision' %n '999']
        ['offset' %s 'invalid']  ['sourceOffset' %s 'invalid']
    ==
  =/  present
    (pairs:enjs:format ~[['id' %s 'document'] ['offset' %s 'invalid']])
  =/  page  (read:codec fixture owner 'artifact' missing)
  ;:  weld
      %+  expect-eq
        !>((read:codec fixture owner 'project' project-args))
      !>((read:codec fixture owner 'project' unrelated))
      (expect-eq !>(`(unit json)`[~ ~]) !>((get:codec page 'content')))
      (expect-eq !>(~) !>((mole |.((read:codec fixture owner 'artifact' present)))))
  ==
++  test-json-offsets-use-ungrouped-decimal
  =/  args=json  [%o (my ~[['offset' [%n '8000']]])]
  =/  invalid=json  [%o (my ~[['offset' [%n '8.000']]])]
  =/  refused  (mule |.((number:codec invalid 'offset' 0)))
  ;:  weld
      (expect-eq !>(8.000) !>((number:codec args 'offset' 0)))
      (expect !>(?=(%| -.refused)))
  ==
++  test-empty-directory-first-page
  =/  args=json  [%o (my ~[['offset' [%n '0']] ['limit' [%n '24']]])]
  =/  result  (page:codec ~ args &)
  ;:  weld
      (expect-eq !>(0) !>((number:codec args 'offset' 99)))
      (expect-eq !>(`json`[%a ~]) !>((need (get:codec result 'items'))))
      (expect-eq !>(`json`~) !>((need (get:codec result 'nextOffset'))))
  ==
::
++  test-revision-pages-preserve-utf-eight-and-page-sources-independently
  =/  prefix  (rap 3 (reap 7.999 'a'))
  =/  body  (cat 3 prefix '🙂 tail')
  =/  sources=(list source:w)
    ~[['one' 'url-1'] ['two' 'url-2'] ['three' 'url-3'] ['four' 'url-4'] ['five' 'url-5']]
  =/  =revision:w  [~2026.10.1 [0v1 'Writer'] ['Title' body sources]]
  =/  first  (revision-json:codec 1 revision | 0 0)
  =/  second
    %:  revision-json:codec
      1
      revision
      |
      (number:codec first 'nextOffset' 0)
      (number:codec first 'nextSourceOffset' 0)
    ==
  =/  complete  (revision-json:codec 1 revision & 0 0)
  ;:  weld
      (expect-eq !>(prefix) !>((string:codec first 'body')))
      (expect-eq !>('🙂 tail') !>((string:codec second 'body')))
      (expect-eq !>(body) !>((cat 3 (string:codec first 'body') (string:codec second 'body'))))
      (expect-eq !>(sources) !>((weld (sources:codec first) (sources:codec second))))
      (expect-eq !>(body) !>((string:codec complete 'body')))
      (expect-eq !>(sources) !>((sources:codec complete)))
      (expect-eq !>(`json`~) !>((need (get:codec second 'nextOffset'))))
      (expect-eq !>(`json`~) !>((need (get:codec second 'nextSourceOffset'))))
  ==
::
++  test-revision-page-rejects-an-offset-inside-a-character
  =/  =revision:w  [~2026.10.1 [0v1 'Writer'] ['Title' '🙂 tail' ~]]
  =/  invalid  (mule |.((revision-json:codec 1 revision | 1 0)))
  =/  beyond  (mule |.((revision-json:codec 1 revision | 99 0)))
  ;:  weld
      (expect !>(?=(%| -.invalid)))
      (expect !>(?=(%| -.beyond)))
  ==
++  test-accepted-mutations-record-one-audit-entry
  =/  db  (step fixture agent [%propose 'proposal' 'document' 1 value 'Review this'])
  =.  db  (step db owner [%task-create 'task' 'project' 'Research' ''])
  =/  version  version:(~(got by tasks.db) 'task')
  =/  actions=(list action:w)
    :~  [%project-create 'new-project' 'Title' 'Description']
        [%project-edit 'project' 2 'Updated project' '' |]
        [%member 'project' 2 0v2 `%contributor]
        [%artifact-create 'new-document' `'project' value]
        [%artifact-save 'document' 1 `'project' value]
        [%artifact-archive 'document' 1 &]
        [%propose 'new-proposal' 'document' 1 value 'Review this']
        [%review 'proposal' & 'Accepted']
        [%publish 'document' 1 1 0 'document' '<p>Document</p>']
        [%unpublish 'document' 0]
        [%task-create 'new-task' 'project' 'Research' '']
        [%task-claim 'task' version]
        [%task-assign 'task' version `by:agent]
        [%task-update 'task' version %done 'Complete' ~ ~]
        [%task-delete 'task' version]
    ==
  %-  zing
  %+  turn  actions
  |=  action=action:w
  =/  out  (apply:work db owner action ~2026.9.12)
  ?>  ?=(%& -.out)
  =/  expected=audit:w  [~2026.9.12 by:owner (scot %tas -.action) id.action]
  ;:  weld
      (expect-eq !>(+(writes.db)) !>(writes.p.out))
      (expect-eq !>([expected history.db]) !>(history.p.out))
  ==
--

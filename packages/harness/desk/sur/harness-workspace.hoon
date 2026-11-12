::  Durable work records owned by the Harness head, independent of sessions'
::  inference lifecycle. Scope IDs survive conversation rename, never reuse.
|%
+$  id  @t
+$  actor  [scope=@uv label=@t]
+$  source  [label=@t url=@t]
+$  content  [title=@t body=@t sources=(list source)]
+$  revision  [at=@da by=actor value=content]
+$  publication  [revision=@ud slug=@t html=@t at=@da]
+$  artifact
  $:  owner=@uv
      project=(unit id)
      label=@t
      head=@ud
      revisions=(map @ud revision)
      publication=(unit publication)
      exposure=@ud
      archived=?
  ==
+$  role  ?(%reader %contributor %maintainer)
+$  project
  $:  title=@t
      description=@t
      version=@ud
      members=(map @uv role)
      archived=?
  ==
+$  proposal
  $:  artifact=id
      base=@ud
      by=actor
      access=@uv
      at=@da
      value=content
      reason=@t
      status=?(%pending %accepted %rejected)
      decided=(unit @da)
      decision=@t
      revision=(unit @ud)
  ==
+$  task
  ::  An empty project is ungrouped work. Assignment never grants authority.
  $:  project=id
      title=@t
      description=@t
      version=@ud
      status=?(%open %claimed %blocked %done)
      claimant=(unit actor)
      outcome=@t
      artifact=(unit id)
      updated=@da
  ==
+$  audit  [at=@da by=actor action=@t target=id]
+$  record-key  [kind=?(%artifact %project) id=id]
+$  state
  $:  %0
      recency=(map record-key @da)
      artifacts=(map id artifact)
      projects=(map id project)
      proposals=(map id proposal)
      tasks=(map id task)
      slugs=(map @t id)
      history=(list audit)
      writes=@ud
      bytes=@ud
  ==
::  Only the head constructs authority. owner=true is never model-selectable.
::  Actor is the actual worker; access is its live root membership identity.
+$  authority  [owner=? by=actor access=@uv]
+$  action
  $%  [%project-create id=id title=@t description=@t]
      [%project-edit id=id version=@ud title=@t description=@t archived=?]
      [%member id=id version=@ud scope=@uv role=(unit role)]
      [%artifact-create id=id project=(unit id) value=content]
      [%artifact-save id=id base=@ud project=(unit id) value=content]
      [%artifact-archive id=id base=@ud archived=?]
      [%propose id=id artifact=id base=@ud value=content reason=@t]
      [%review id=id accept=? reason=@t]
      [%publish id=id revision=@ud head=@ud exposure=@ud slug=@t html=@t]
      [%unpublish id=id exposure=@ud]
      [%task-create id=id project=id title=@t description=@t]
      [%task-claim id=id version=@ud]
      [%task-assign id=id version=@ud assignee=(unit actor)]
      $:  %task-update  id=id  version=@ud  status=?(%open %claimed %blocked %done)  outcome=@t
          artifact=(unit id)  details=(unit [title=@t description=@t project=id])
      ==
      [%task-delete id=id version=@ud]
  ==
+$  request  [id=@t action=@t args=json]
--

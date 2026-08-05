|%
::
+$  cron-id  @uv
+$  run-id   @uv
+$  memory-id  @uv
::
+$  cron-status  ?(%active %paused %cancelled)
+$  run-status   ?(%pending %running %completed %failed %cancelled)
+$  memory-kind  ?(%user-profile %agent-profile %preference %fact %note %summary)
+$  memory-scope  ?(%global %agent %dm %channel %group)
+$  memory-status  ?(%active %proposed %archived)
+$  memory-source  ?(%user %agent %system %tool)
+$  memory-pressure  ?(%normal %high %full)
::
+$  schedule
  $%  [%once next=@da]
      [%interval next=@da every=@dr]
  ==
::
+$  target
  $%  [%delegated-dm moon=ship]
      [%none ~]
  ==
::
+$  tool-policy
  $%  [%all ~]
      [%none ~]
      [%only tools=(list @t)]
  ==
::
+$  delivery
  $%  [%delegated-dm moon=ship post-id=(unit @t)]
      [%none ~]
  ==
::
+$  cron
  $:  id=cron-id
      title=(unit @t)
      prompt=@t
      status=cron-status
      schedule=schedule
      target=target
      tool-policy=tool-policy
      created-at=@da
      updated-at=@da
      last-fired-at=(unit @da)
  ==
::
+$  run
  $:  id=run-id
      cron-id=cron-id
      status=run-status
      prompt=@t
      target=target
      tool-policy=tool-policy
      scheduled-for=@da
      fired-at=@da
      claimed-at=(unit @da)
      completed-at=(unit @da)
      output-preview=(unit @t)
      delivery=(unit delivery)
      error=(unit @t)
      created-at=@da
      updated-at=@da
  ==
::
+$  memory-subject
  $%  [%none ~]
      [%ship who=ship]
      [%opaque subject=@t]
  ==
::
+$  memory-evidence-ref
  $%  [%chat-post channel-id=@t post-id=@t reply-id=(unit @t)]
      [%agent-run run-id=run-id]
      [%external uri=@t]
  ==
::
+$  memory
  $:  id=memory-id
      kind=memory-kind
      scope=memory-scope
      subject=memory-subject
      key=(unit @t)
      title=(unit @t)
      body=@t
      tags=(list @t)
      priority=@ud
      pinned=?
      status=memory-status
      source=memory-source
      evidence-refs=(list memory-evidence-ref)
      valid-from=(unit @da)
      valid-to=(unit @da)
      created-at=@da
      updated-at=@da
      archived-at=(unit @da)
  ==
::
+$  create
  $:  id=(unit cron-id)
      title=(unit @t)
      prompt=@t
      schedule=schedule
      target=target
      tool-policy=(unit tool-policy)
      status=(unit cron-status)
  ==
::
+$  update
  $:  id=cron-id
      title=(unit (unit @t))
      prompt=(unit @t)
      schedule=(unit schedule)
      target=(unit target)
      tool-policy=(unit tool-policy)
  ==
::
+$  completion
  $:  run-id=run-id
      output-preview=(unit @t)
      delivery=(unit delivery)
  ==
::
+$  failure
  $:  run-id=run-id
      error=@t
  ==
::
+$  memory-create
  $:  kind=memory-kind
      scope=memory-scope
      subject=memory-subject
      key=(unit @t)
      title=(unit @t)
      body=@t
      tags=(unit (list @t))
      priority=(unit @ud)
      pinned=(unit ?)
      status=(unit memory-status)
      source=memory-source
      evidence-refs=(unit (list memory-evidence-ref))
      valid-from=(unit @da)
      valid-to=(unit @da)
  ==
::
+$  memory-upsert
  $:  kind=memory-kind
      scope=memory-scope
      subject=memory-subject
      key=@t
      title=(unit @t)
      body=@t
      tags=(unit (list @t))
      priority=(unit @ud)
      pinned=(unit ?)
      status=(unit memory-status)
      source=memory-source
      evidence-refs=(unit (list memory-evidence-ref))
      valid-from=(unit @da)
      valid-to=(unit @da)
  ==
::
+$  memory-patch
  $:  id=memory-id
      key=(unit (unit @t))
      title=(unit (unit @t))
      body=(unit @t)
      tags=(unit (list @t))
      priority=(unit @ud)
      pinned=(unit ?)
      status=(unit memory-status)
      evidence-refs=(unit (list memory-evidence-ref))
      valid-from=(unit (unit @da))
      valid-to=(unit (unit @da))
  ==
::
+$  action
  $%  [%create create=create]
      [%update update=update]
      [%pause id=cron-id]
      [%resume id=cron-id]
      [%cancel id=cron-id]
      [%delete id=cron-id]
      [%run-now id=cron-id]
      [%run-started run-id=run-id]
      [%run-completed completion=completion]
      [%run-failed failure=failure]
  ==
::
+$  memory-action
  $%  [%create create=memory-create]
      [%upsert upsert=memory-upsert]
      [%update patch=memory-patch]
      [%archive id=memory-id]
      [%delete id=memory-id]
  ==
::
+$  init
  $:  crons=(list cron)
      runs=(list run)
  ==
::
+$  memory-stats
  $:  total=@ud
      active=@ud
      proposed=@ud
      archived=@ud
      active-capacity=@ud
      retained-capacity=@ud
      memory-pressure=memory-pressure
  ==
::
+$  memory-init
  $:  memories=(list memory)
      stats=memory-stats
  ==
::
+$  update-fact
  $%  [%init init=init]
      [%cron-created cron=cron]
      [%cron-updated cron=cron]
      [%cron-deleted id=cron-id]
      [%run-requested run=run]
      [%run-updated run=run]
  ==
::
+$  memory-update-fact
  $%  [%init init=memory-init]
      [%memory-created memory=memory stats=memory-stats]
      [%memory-updated memory=memory stats=memory-stats]
      [%memory-archived memory=memory stats=memory-stats]
      [%memory-deleted id=memory-id stats=memory-stats]
  ==
--

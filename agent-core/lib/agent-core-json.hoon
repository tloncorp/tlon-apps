/-  ac=agent-core
|%
++  ms-to-dr
  |=  ms=@ud
  ^-  @dr
  `@dr`(div (mul ~s1 ms) 1.000)
::
++  dr-to-ms
  |=  dur=@dr
  ^-  @ud
  `@ud`(div dur (div ~s1 1.000))
::
++  enjs
  =,  enjs:format
  |%
  ++  id
    |=  id=@uv
    s+(scot %uv id)
  ::
  ++  unit-text
    |=  val=(unit @t)
    ?~(val ~ s+u.val)
  ::
  ++  unit-time
    |=  val=(unit @da)
    ?~(val ~ (time u.val))
  ::
  ++  memory-subject
    |=  sub=memory-subject:ac
    ^-  json
    ?-  -.sub
      %none    ~
      %ship    s+(scot %p who.sub)
      %opaque  s+subject.sub
    ==
  ::
  ++  schedule
    |=  sch=schedule:ac
    ^-  json
    ?-  -.sch
      %once
        %-  pairs
        :~  kind+s+'once'
            next+(time next.sch)
        ==
      %interval
        %-  pairs
        :~  kind+s+'interval'
            next+(time next.sch)
            every+(numb (dr-to-ms every.sch))
        ==
    ==
  ::
  ++  target
    |=  tar=target:ac
    ^-  json
    ?-  -.tar
      %none
        %-  pairs
        :~  kind+s+'none'
        ==
      %delegated-dm
        %-  pairs
        :~  kind+s+'delegated-dm'
            moon+s+(scot %p moon.tar)
        ==
    ==
  ::
  ++  tool-policy
    |=  pol=tool-policy:ac
    ^-  json
    ?-  -.pol
      %all
        %-  pairs
        :~  kind+s+'all'
        ==
      %none
        %-  pairs
        :~  kind+s+'none'
        ==
      %only
        %-  pairs
        :~  kind+s+'only'
            tools+a/(turn tools.pol |=(tool=@t s+tool))
        ==
    ==
  ::
  ++  delivery
    |=  del=delivery:ac
    ^-  json
    ?-  -.del
      %none
        %-  pairs
        :~  kind+s+'none'
        ==
      %delegated-dm
        %-  pairs
        :~  kind+s+'delegated-dm'
            moon+s+(scot %p moon.del)
            ['postId' (unit-text post-id.del)]
        ==
    ==
  ::
  ++  unit-delivery
    |=  val=(unit delivery:ac)
    ?~(val ~ (delivery u.val))
  ::
  ++  memory-evidence-ref
    |=  ref=memory-evidence-ref:ac
    ^-  json
    ?-  -.ref
      %chat-post
        %-  pairs
        :~  kind+s+'chat-post'
            ['channelId' s+channel-id.ref]
            ['postId' s+post-id.ref]
            ['replyId' (unit-text reply-id.ref)]
        ==
      %agent-run
        %-  pairs
        :~  kind+s+'agent-run'
            ['runId' (id run-id.ref)]
        ==
      %external
        %-  pairs
        :~  kind+s+'external'
            uri+s+uri.ref
        ==
    ==
  ::
  ++  cron
    |=  cr=cron:ac
    %-  pairs
    :~  id+(id id.cr)
        title+(unit-text title.cr)
        prompt+s+prompt.cr
        status+s+status.cr
        schedule+(schedule schedule.cr)
        target+(target target.cr)
        ['toolPolicy' (tool-policy tool-policy.cr)]
        ['createdAt' (time created-at.cr)]
        ['updatedAt' (time updated-at.cr)]
        ['lastFiredAt' (unit-time last-fired-at.cr)]
    ==
  ::
  ++  run
    |=  ru=run:ac
    %-  pairs
    :~  id+(id id.ru)
        ['cronId' (id cron-id.ru)]
        status+s+status.ru
        prompt+s+prompt.ru
        target+(target target.ru)
        ['toolPolicy' (tool-policy tool-policy.ru)]
        ['scheduledFor' (time scheduled-for.ru)]
        ['firedAt' (time fired-at.ru)]
        ['claimedAt' (unit-time claimed-at.ru)]
        ['completedAt' (unit-time completed-at.ru)]
        ['outputPreview' (unit-text output-preview.ru)]
        delivery+(unit-delivery delivery.ru)
        error+(unit-text error.ru)
        ['createdAt' (time created-at.ru)]
        ['updatedAt' (time updated-at.ru)]
    ==
  ::
  ++  memory
    |=  mem=memory:ac
    %-  pairs
    :~  id+(id id.mem)
        kind+s+kind.mem
        scope+s+scope.mem
        subject+(memory-subject subject.mem)
        key+(unit-text key.mem)
        title+(unit-text title.mem)
        body+s+body.mem
        tags+a/(turn tags.mem |=(tag=@t s+tag))
        priority+(numb priority.mem)
        pinned+b+pinned.mem
        status+s+status.mem
        source+s+source.mem
        ['evidenceRefs' a/(turn evidence-refs.mem memory-evidence-ref)]
        ['validFrom' (unit-time valid-from.mem)]
        ['validTo' (unit-time valid-to.mem)]
        ['createdAt' (time created-at.mem)]
        ['updatedAt' (time updated-at.mem)]
        ['archivedAt' (unit-time archived-at.mem)]
    ==
  ::
  ++  memory-stats
    |=  sta=memory-stats:ac
    %-  pairs
    :~  total+(numb total.sta)
        active+(numb active.sta)
        proposed+(numb proposed.sta)
        archived+(numb archived.sta)
        ['activeCapacity' (numb active-capacity.sta)]
        ['retainedCapacity' (numb retained-capacity.sta)]
        ['memoryPressure' s+memory-pressure.sta]
    ==
  ::
  ++  init
    |=  ini=init:ac
    %-  pairs
    :~  crons+a/(turn crons.ini cron)
        runs+a/(turn runs.ini run)
    ==
  ::
  ++  memory-init
    |=  ini=memory-init:ac
    %-  pairs
    :~  memories+a/(turn memories.ini memory)
        stats+(memory-stats stats.ini)
    ==
  ::
  ++  update
    |=  upd=update-fact:ac
    ?-  -.upd
      %init
        %-  frond
        :-  'init'
        (init init.upd)
      %cron-created
        %-  frond
        :-  'cronCreated'
        (cron cron.upd)
      %cron-updated
        %-  frond
        :-  'cronUpdated'
        (cron cron.upd)
      %cron-deleted
        %-  frond
        :-  'cronDeleted'
        (pairs ~[['id' (id id.upd)]])
      %run-requested
        %-  frond
        :-  'runRequested'
        (run run.upd)
      %run-updated
        %-  frond
        :-  'runUpdated'
        (run run.upd)
    ==
  ::
  ++  memory-update
    |=  upd=memory-update-fact:ac
    ?-  -.upd
      %init
        %-  frond
        :-  'init'
        (memory-init init.upd)
      %memory-created
        %-  pairs
        :~  ['memoryCreated' (memory memory.upd)]
            stats+(memory-stats stats.upd)
        ==
      %memory-updated
        %-  pairs
        :~  ['memoryUpdated' (memory memory.upd)]
            stats+(memory-stats stats.upd)
        ==
      %memory-archived
        %-  pairs
        :~  ['memoryArchived' (memory memory.upd)]
            stats+(memory-stats stats.upd)
        ==
      %memory-deleted
        %-  pairs
        :~  ['memoryDeleted' (pairs ~[['id' (id id.upd)]])]
            stats+(memory-stats stats.upd)
        ==
    ==
  --
::
++  dejs
  =,  dejs:format
  |%
  ++  id  (se %uv)
  ++  ship  (se %p)
  ++  status
    (su (perk %active %paused %cancelled ~))
  ++  run-status
    (su (perk %pending %running %completed %failed %cancelled ~))
  ++  memory-kind
    (su (perk %user-profile %agent-profile %preference %fact %note %summary ~))
  ++  memory-scope
    (su (perk %global %agent %dm %channel %group ~))
  ++  memory-status
    (su (perk %active %proposed %archived ~))
  ++  memory-source
    (su (perk %user %agent %system %tool ~))
  ++  maybe
    |*  wit=fist
    |=  jon=(unit json)
    ?~(jon ~ `(wit u.jon))
  ::
  ++  memory-subject
    |=  [scope=memory-scope:ac subj=(unit (unit @t))]
    ^-  memory-subject:ac
    ?-  scope
      %global
        ?~  subj  [%none ~]
        ?~  u.subj  [%none ~]
        !!
      %agent
        ?~  subj  !!
        ?~  u.subj  !!
        =/  who=(unit ship)  (slaw %p u.u.subj)
        ?~  who  !!
        [%ship u.who]
      %dm
        ?~  subj  !!
        ?~  u.subj  !!
        =/  who=(unit ship)  (slaw %p u.u.subj)
        ?~  who  !!
        [%ship u.who]
      %channel
        ?~  subj  !!
        ?~  u.subj  !!
        ?>  !=('' u.u.subj)
        [%opaque u.u.subj]
      %group
        ?~  subj  !!
        ?~  u.subj  !!
        ?>  !=('' u.u.subj)
        [%opaque u.u.subj]
    ==
  ::
  ++  schedule
    |=  jon=json
    ^-  schedule:ac
    =/  [kind=(unit @t) next=(unit @da) every=(unit @ud)]
      %.  jon
      %-  ou
      :~  ['kind' (maybe so)]
          ['next' (maybe di)]
          ['every' (maybe ni)]
      ==
    ?>  ?=(^ kind)
    =/  k=term  (rash u.kind sym)
    ?-  k
      %once
        ?>  ?=(^ next)
        [%once u.next]
      %interval
        ?>  ?&  ?=(^ next)
                ?=(^ every)
                !=(0 u.every)
            ==
        [%interval u.next (ms-to-dr u.every)]
      *  !!
    ==
  ::
  ++  target
    |=  jon=json
    ^-  target:ac
    =/  [kind=(unit @t) moon=(unit ship)]
      %.  jon
      %-  ou
      :~  ['kind' (maybe so)]
          ['moon' (maybe ship)]
      ==
    ?>  ?=(^ kind)
    =/  k=term  (rash u.kind sym)
    ?-  k
      %none          [%none ~]
      %delegated-dm
        ?>  ?=(^ moon)
        [%delegated-dm u.moon]
      *  !!
    ==
  ::
  ++  tool-policy
    |=  jon=json
    ^-  tool-policy:ac
    =/  [kind=(unit @t) tools=(unit (list @t))]
      %.  jon
      %-  ou
      :~  ['kind' (maybe so)]
          ['tools' (maybe (ar so))]
      ==
    ?>  ?=(^ kind)
    =/  k=term  (rash u.kind sym)
    ?-  k
      %all   [%all ~]
      %none  [%none ~]
      %only
        ?>  ?=(^ tools)
        [%only u.tools]
      *  !!
    ==
  ::
  ++  delivery
    |=  jon=json
    ^-  delivery:ac
    =/  [kind=(unit @t) moon=(unit ship) post-id=(unit (unit @t))]
      %.  jon
      %-  ou
      :~  ['kind' (maybe so)]
          ['moon' (maybe ship)]
          ['postId' (maybe (mu so))]
      ==
    ?>  ?=(^ kind)
    =/  k=term  (rash u.kind sym)
    ?-  k
      %none          [%none ~]
      %delegated-dm
        ?>  ?=(^ moon)
        [%delegated-dm u.moon ?~(post-id ~ u.post-id)]
      *  !!
    ==
  ::
  ++  memory-evidence-ref
    |=  jon=json
    ^-  memory-evidence-ref:ac
    =/  [kind=(unit @t) channel-id=(unit @t) post-id=(unit @t) reply-id=(unit (unit @t)) run-id=(unit run-id:ac) uri=(unit @t)]
      %.  jon
      %-  ou
      :~  ['kind' (maybe so)]
          ['channelId' (maybe so)]
          ['postId' (maybe so)]
          ['replyId' (maybe (mu so))]
          ['runId' (maybe id)]
          ['uri' (maybe so)]
      ==
    ?>  ?=(^ kind)
    =/  k=term  (rash u.kind sym)
    ?-  k
      %chat-post
        ?>  ?&  ?=(^ channel-id)
                ?=(^ post-id)
            ==
        [%chat-post u.channel-id u.post-id ?~(reply-id ~ u.reply-id)]
      %agent-run
        ?>  ?=(^ run-id)
        [%agent-run u.run-id]
      %external
        ?>  ?=(^ uri)
        [%external u.uri]
      *  !!
    ==
  ::
  ++  create
    |=  jon=json
    ^-  create:ac
    =/  [prompt=@t sch=schedule:ac tar=target:ac]
      %.  jon
      %-  ot
      :~  ['prompt' so]
          ['schedule' schedule]
          ['target' target]
      ==
    =/  [cid=(unit cron-id:ac) title=(unit (unit @t)) pol=(unit tool-policy:ac) st=(unit cron-status:ac)]
      %.  jon
      %-  ou
      :~  ['id' (maybe id)]
          ['title' (maybe (mu so))]
          ['toolPolicy' (maybe tool-policy)]
          ['status' (maybe status)]
      ==
    [cid ?~(title ~ u.title) prompt sch tar pol st]
  ::
  ++  memory-create
    |=  jon=json
    ^-  memory-create:ac
    =/  [kind=memory-kind:ac scope=memory-scope:ac body=@t source=memory-source:ac]
      %.  jon
      %-  ot
      :~  ['kind' memory-kind]
          ['scope' memory-scope]
          ['body' so]
          ['source' memory-source]
      ==
    =/  [subject=(unit (unit @t)) key=(unit (unit @t)) title=(unit (unit @t)) tags=(unit (list @t)) priority=(unit @ud) pinned=(unit ?) st=(unit memory-status:ac) evidence-refs=(unit (list memory-evidence-ref:ac)) valid-from=(unit (unit @da)) valid-to=(unit (unit @da))]
      %.  jon
      %-  ou
      :~  ['subject' (maybe (mu so))]
          ['key' (maybe (mu so))]
          ['title' (maybe (mu so))]
          ['tags' (maybe (ar so))]
          ['priority' (maybe ni)]
          ['pinned' (maybe bo)]
          ['status' (maybe memory-status)]
          ['evidenceRefs' (maybe (ar memory-evidence-ref))]
          ['validFrom' (maybe (mu di))]
          ['validTo' (maybe (mu di))]
      ==
    :*  kind
        scope
        (memory-subject scope subject)
        ?~(key ~ u.key)
        ?~(title ~ u.title)
        body
        tags
        priority
        pinned
        st
        source
        evidence-refs
        ?~(valid-from ~ u.valid-from)
        ?~(valid-to ~ u.valid-to)
    ==
  ::
  ++  memory-upsert
    |=  jon=json
    ^-  memory-upsert:ac
    =/  [kind=memory-kind:ac scope=memory-scope:ac key=@t body=@t source=memory-source:ac]
      %.  jon
      %-  ot
      :~  ['kind' memory-kind]
          ['scope' memory-scope]
          ['key' so]
          ['body' so]
          ['source' memory-source]
      ==
    =/  [subject=(unit (unit @t)) title=(unit (unit @t)) tags=(unit (list @t)) priority=(unit @ud) pinned=(unit ?) st=(unit memory-status:ac) evidence-refs=(unit (list memory-evidence-ref:ac)) valid-from=(unit (unit @da)) valid-to=(unit (unit @da))]
      %.  jon
      %-  ou
      :~  ['subject' (maybe (mu so))]
          ['title' (maybe (mu so))]
          ['tags' (maybe (ar so))]
          ['priority' (maybe ni)]
          ['pinned' (maybe bo)]
          ['status' (maybe memory-status)]
          ['evidenceRefs' (maybe (ar memory-evidence-ref))]
          ['validFrom' (maybe (mu di))]
          ['validTo' (maybe (mu di))]
      ==
    :*  kind
        scope
        (memory-subject scope subject)
        key
        ?~(title ~ u.title)
        body
        tags
        priority
        pinned
        st
        source
        evidence-refs
        ?~(valid-from ~ u.valid-from)
        ?~(valid-to ~ u.valid-to)
    ==
  ::
  ++  update-cron
    |=  jon=json
    ^-  update:ac
    =/  cid=cron-id:ac
      %.  jon
      %-  ot
      :~  ['id' id]
      ==
    =/  [title=(unit (unit @t)) prompt=(unit @t) sch=(unit schedule:ac) tar=(unit target:ac) pol=(unit tool-policy:ac)]
      %.  jon
      %-  ou
      :~  ['title' (maybe (mu so))]
          ['prompt' (maybe so)]
          ['schedule' (maybe schedule)]
          ['target' (maybe target)]
          ['toolPolicy' (maybe tool-policy)]
      ==
    [cid title prompt sch tar pol]
  ::
  ++  memory-patch
    |=  jon=json
    ^-  memory-patch:ac
    =/  mid=memory-id:ac
      %.  jon
      %-  ot
      :~  ['id' id]
      ==
    =/  [key=(unit (unit @t)) title=(unit (unit @t)) body=(unit @t) tags=(unit (list @t)) priority=(unit @ud) pinned=(unit ?) st=(unit memory-status:ac) evidence-refs=(unit (list memory-evidence-ref:ac)) valid-from=(unit (unit @da)) valid-to=(unit (unit @da))]
      %.  jon
      %-  ou
      :~  ['key' (maybe (mu so))]
          ['title' (maybe (mu so))]
          ['body' (maybe so)]
          ['tags' (maybe (ar so))]
          ['priority' (maybe ni)]
          ['pinned' (maybe bo)]
          ['status' (maybe memory-status)]
          ['evidenceRefs' (maybe (ar memory-evidence-ref))]
          ['validFrom' (maybe (mu di))]
          ['validTo' (maybe (mu di))]
      ==
    [mid key title body tags priority pinned st evidence-refs valid-from valid-to]
  ::
  ++  id-object
    |=  jon=json
    ^-  cron-id:ac
    %.  jon
    %-  ot
    :~  ['id' id]
    ==
  ::
  ++  memory-id-object
    |=  jon=json
    ^-  memory-id:ac
    %.  jon
    %-  ot
    :~  ['id' id]
    ==
  ::
  ++  run-id-object
    |=  jon=json
    ^-  run-id:ac
    %.  jon
    %-  ot
    :~  ['runId' id]
    ==
  ::
  ++  completion
    |=  jon=json
    ^-  completion:ac
    =/  rid=run-id:ac
      %.  jon
      %-  ot
      :~  ['runId' id]
      ==
    =/  [preview=(unit (unit @t)) del=(unit (unit delivery:ac))]
      %.  jon
      %-  ou
      :~  ['outputPreview' (maybe (mu so))]
          ['delivery' (maybe (mu delivery))]
      ==
    [rid ?~(preview ~ u.preview) ?~(del ~ u.del)]
  ::
  ++  failure
    |=  jon=json
    ^-  failure:ac
    %.  jon
    %-  ot
    :~  ['runId' id]
        ['error' so]
    ==
  ::
  ++  action
    |=  jon=json
    ^-  action:ac
    ?>  ?=([%o *] jon)
    =/  obj=(map @t json)  p.jon
    =+  got=(~(get by obj) 'create')
    ?^  got  [%create (create u.got)]
    =+  got=(~(get by obj) 'update')
    ?^  got  [%update (update-cron u.got)]
    =+  got=(~(get by obj) 'pause')
    ?^  got  [%pause (id-object u.got)]
    =+  got=(~(get by obj) 'resume')
    ?^  got  [%resume (id-object u.got)]
    =+  got=(~(get by obj) 'cancel')
    ?^  got  [%cancel (id-object u.got)]
    =+  got=(~(get by obj) 'delete')
    ?^  got  [%delete (id-object u.got)]
    =+  got=(~(get by obj) 'runNow')
    ?^  got  [%run-now (id-object u.got)]
    =+  got=(~(get by obj) 'runStarted')
    ?^  got  [%run-started (run-id-object u.got)]
    =+  got=(~(get by obj) 'runCompleted')
    ?^  got  [%run-completed (completion u.got)]
    =+  got=(~(get by obj) 'runFailed')
    ?^  got  [%run-failed (failure u.got)]
    !!
  ::
  ++  memory-action
    |=  jon=json
    ^-  memory-action:ac
    ?>  ?=([%o *] jon)
    =/  obj=(map @t json)  p.jon
    ?>  =(1 (lent ~(tap by obj)))
    =+  got=(~(get by obj) 'create')
    ?^  got  [%create (memory-create u.got)]
    =+  got=(~(get by obj) 'upsert')
    ?^  got  [%upsert (memory-upsert u.got)]
    =+  got=(~(get by obj) 'update')
    ?^  got  [%update (memory-patch u.got)]
    =+  got=(~(get by obj) 'archive')
    ?^  got  [%archive (memory-id-object u.got)]
    =+  got=(~(get by obj) 'delete')
    ?^  got  [%delete (memory-id-object u.got)]
    !!
  --
--

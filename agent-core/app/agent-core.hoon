::  agent-core: durable cron scheduling ledger for local agent prompts
::
/-  ac=agent-core
/+  default-agent
|%
+$  card  card:agent:gall
+$  state-0
  $:  %0
      crons=(map cron-id:ac cron:ac)
      runs=(map run-id:ac run:ac)
      counter=@ud
  ==
+$  state-1
  $:  %1
      crons=(map cron-id:ac cron:ac)
      runs=(map run-id:ac run:ac)
      memories=(map memory-id:ac memory:ac)
      counter=@ud
  ==
+$  versioned-state
  $%  state-1
      state-0
  ==
+$  current-state  state-1
::
++  migrate-state
  |=  old=versioned-state
  ^-  current-state
  ?-  -.old
    %0  [%1 crons.old runs.old *(map memory-id:ac memory:ac) counter.old]
    %1  old
  ==
--
=|  current-state
=*  state  -
^-  agent:gall
=<
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %.n) bowl)
      cor   ~(. +> [bowl ~])
  ++  on-init
    ^-  (quip card _this)
    [~ this]
  ++  on-save  !>(state)
  ++  on-load
    |=  old=vase
    ^-  (quip card _this)
    [~ this(state (migrate-state !<(versioned-state old)))]
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state
      abet:(poke:cor mark vase)
    [cards this]
  ++  on-watch
    |=  =path
    ^-  (quip card _this)
    =^  cards  state
      abet:(watch:cor path)
    [cards this]
  ++  on-leave  on-leave:def
  ++  on-peek  peek:cor
  ++  on-agent  on-agent:def
  ++  on-arvo
    |=  [=wire sign=sign-arvo]
    ^-  (quip card _this)
    =^  cards  state
      abet:(arvo:cor wire sign)
    [cards this]
  ++  on-fail  on-fail:def
  --
::
|_  [=bowl:gall cards=(list card)]
++  cor   .
++  abet  [(flop cards) state]
++  emit  |=(=card cor(cards [card cards]))
++  give  |=(=gift:agent:gall (emit %give gift))
::
++  cron-list
  ^-  (list cron:ac)
  %+  turn  ~(tap by crons)
  |=  [id=cron-id:ac cr=cron:ac]
  cr
::
++  run-list
  ^-  (list run:ac)
  %+  turn  ~(tap by runs)
  |=  [id=run-id:ac ru=run:ac]
  ru
::
++  active-run-list
  ^-  (list run:ac)
  %+  skim  run-list
  |=  ru=run:ac
  ?|  =(%pending status.ru)
      =(%running status.ru)
  ==
::
++  pending-run-list
  ^-  (list run:ac)
  %+  skim  run-list
  |=  ru=run:ac
  =(%pending status.ru)
::
++  memory-active-capacity  4.096
++  memory-retained-capacity  8.192
::
++  memory-list
  ^-  (list memory:ac)
  %+  turn  ~(tap by memories)
  |=  [id=memory-id:ac mem=memory:ac]
  mem
::
++  sort-memories
  |=  mems=(list memory:ac)
  ^-  (list memory:ac)
  %+  sort  mems
  |=  [a=memory:ac b=memory:ac]
  (gth updated-at.a updated-at.b)
::
++  non-archived-memory-list
  ^-  (list memory:ac)
  %+  skim  memory-list
  |=  mem=memory:ac
  !=(%archived status.mem)
::
++  active-status-memory-list
  ^-  (list memory:ac)
  %+  skim  memory-list
  |=  mem=memory:ac
  =(%active status.mem)
::
++  pinned-active-memory-list
  ^-  (list memory:ac)
  %+  skim  memory-list
  |=  mem=memory:ac
  ?&  =(%active status.mem)
      pinned.mem
  ==
::
++  memories-since
  |=  since=@da
  ^-  (list memory:ac)
  %+  skim  memory-list
  |=  mem=memory:ac
  (gth updated-at.mem since)
::
++  global-memory-list
  ^-  (list memory:ac)
  %+  skim  non-archived-memory-list
  |=  mem=memory:ac
  =(%global scope.mem)
::
++  scoped-ship-memory-list
  |=  [sco=memory-scope:ac who=ship]
  ^-  (list memory:ac)
  %+  skim  non-archived-memory-list
  |=  mem=memory:ac
  ?&  =(sco scope.mem)
      =([%ship who] subject.mem)
  ==
::
++  text-len
  |=  txt=@t
  ^-  @ud
  (lent (trip txt))
::
++  valid-text-max
  |=  [txt=@t max=@ud]
  ^-  ?
  (lte (text-len txt) max)
::
++  valid-unit-text-max
  |=  [txt=(unit @t) max=@ud]
  ^-  ?
  ?~  txt  &
  (valid-text-max u.txt max)
::
++  valid-key
  |=  key=(unit @t)
  ^-  ?
  ?~  key  &
  ?&  !=('' u.key)
      (valid-text-max u.key 128)
  ==
::
++  valid-tags
  |=  tags=(list @t)
  ^-  ?
  ?&  (lte (lent tags) 12)
      %+  levy  tags
      |=  tag=@t
      (valid-text-max tag 64)
  ==
::
++  valid-reply-id
  |=  rid=(unit @t)
  ^-  ?
  ?~  rid  &
  ?&  !=('' u.rid)
      (valid-text-max u.rid 128)
  ==
::
++  valid-evidence-ref
  |=  ref=memory-evidence-ref:ac
  ^-  ?
  ?-  -.ref
    %chat-post
      ?&  !=('' channel-id.ref)
          (valid-text-max channel-id.ref 256)
          !=('' post-id.ref)
          (valid-text-max post-id.ref 128)
          (valid-reply-id reply-id.ref)
      ==
    %agent-run
      &
    %external
      ?&  !=('' uri.ref)
          (valid-text-max uri.ref 1.024)
      ==
  ==
::
++  valid-evidence-refs
  |=  refs=(list memory-evidence-ref:ac)
  ^-  ?
  ?&  (lte (lent refs) 8)
      %+  levy  refs
      |=  ref=memory-evidence-ref:ac
      (valid-evidence-ref ref)
  ==
::
++  valid-memory-subject
  |=  mem=memory:ac
  ^-  ?
  =/  sub=memory-subject:ac  subject.mem
  ?-  scope.mem
    %global
      =(%none -.sub)
    %agent
      ?=(%ship -.sub)
    %dm
      ?=(%ship -.sub)
    %channel
      ?-  -.sub
        %opaque  !=('' subject.sub)
        *        |
      ==
    %group
      ?-  -.sub
        %opaque  !=('' subject.sub)
        *        |
      ==
  ==
::
++  valid-memory
  |=  mem=memory:ac
  ^-  ?
  ?&  (valid-memory-subject mem)
      (valid-key key.mem)
      (valid-unit-text-max title.mem 256)
      (valid-text-max body.mem 4.096)
      (valid-tags tags.mem)
      (lte priority.mem 100)
      (valid-evidence-refs evidence-refs.mem)
  ==
::
++  non-archived-count
  ^-  @ud
  (lent non-archived-memory-list)
::
++  can-add-memory
  |=  st=memory-status:ac
  ^-  ?
  ?&  (lth (lent memory-list) memory-retained-capacity)
      ?:  =(%archived st)
        &
      (lth non-archived-count memory-active-capacity)
  ==
::
++  valid-capacity-transition
  |=  [old=memory:ac new=memory:ac]
  ^-  ?
  ?:  ?&  =(%archived status.old)
          !=(%archived status.new)
      ==
    (lth non-archived-count memory-active-capacity)
  &
::
++  memory-key-matches
  |=  [mem=memory:ac sco=memory-scope:ac sub=memory-subject:ac key=@t]
  ^-  ?
  ?&  !=(%archived status.mem)
      =(sco scope.mem)
      =(sub subject.mem)
      ?=(^ key.mem)
      =(key u.key.mem)
  ==
::
++  duplicate-memory-id
  |=  [self=(unit memory-id:ac) sco=memory-scope:ac sub=memory-subject:ac key=(unit @t)]
  ^-  (unit memory-id:ac)
  ?~  key  ~
  =/  hits=(list memory-id:ac)
    %+  murn  ~(tap by memories)
    |=  [mid=memory-id:ac mem=memory:ac]
    ?:  ?&  (memory-key-matches mem sco sub u.key)
            ?~(self & !=(u.self mid))
        ==
      `mid
    ~
  ?~  hits  ~
  `i.hits
::
++  memory-stats
  ^-  memory-stats:ac
  =/  all=(list memory:ac)  memory-list
  =/  active=@ud
    %-  lent
    %+  skim  all
    |=  mem=memory:ac
    =(%active status.mem)
  =/  proposed=@ud
    %-  lent
    %+  skim  all
    |=  mem=memory:ac
    =(%proposed status.mem)
  =/  archived=@ud
    %-  lent
    %+  skim  all
    |=  mem=memory:ac
    =(%archived status.mem)
  =/  used=@ud  (add active proposed)
  =/  pressure=memory-pressure:ac
    ?:  (gte used memory-active-capacity)  %full
    ?:  (gte (mul used 100) (mul memory-active-capacity 95))  %high
    %normal
  :*  (lent all)
      active
      proposed
      archived
      memory-active-capacity
      memory-retained-capacity
      pressure
  ==
::
++  has-active-run
  |=  cid=cron-id:ac
  ^-  ?
  %+  lien  run-list
  |=  ru=run:ac
  ?&  =(cid cron-id.ru)
      ?|  =(%pending status.ru)
          =(%running status.ru)
      ==
  ==
::
++  valid-schedule
  |=  sch=schedule:ac
  ^-  ?
  ?-  -.sch
    %once      &
    %interval  !=(0 every.sch)
  ==
::
++  schedule-next
  |=  sch=schedule:ac
  ^-  @da
  ?-  -.sch
    %once      next.sch
    %interval  next.sch
  ==
::
++  advance-interval
  |=  [n=@da every=@dr now=@da]
  ^-  @da
  ?:  (gth n now)  n
  $(n (add n every))
::
++  cron-wire
  |=  [id=cron-id:ac scheduled-for=@da]
  ^-  wire
  /cron/(scot %uv id)/(scot %da scheduled-for)
::
++  new-id
  |=  salt=@tas
  ^-  @uv
  `@uv`(shax (jam [salt counter now.bowl eny.bowl]))
::
++  schedule-cron
  |=  cr=cron:ac
  ^+  cor
  ?.  =(%active status.cr)  cor
  =/  wen=@da  (schedule-next schedule.cr)
  (emit [%pass (cron-wire id.cr wen) %arvo %b %wait wen])
::
++  give-update
  |=  [paths=(list path) upd=update-fact:ac]
  ^+  cor
  (give %fact paths %agent-cron-update !>(upd))
::
++  give-cron-created
  |=  cr=cron:ac
  ^+  cor
  (give-update ~[/v0 /v0/crons] [%cron-created cr])
::
++  give-cron-updated
  |=  cr=cron:ac
  ^+  cor
  (give-update ~[/v0 /v0/crons] [%cron-updated cr])
::
++  give-cron-deleted
  |=  id=cron-id:ac
  ^+  cor
  (give-update ~[/v0 /v0/crons] [%cron-deleted id])
::
++  give-run-requested
  |=  ru=run:ac
  ^+  cor
  (give-update ~[/v0 /v0/runs] [%run-requested ru])
::
++  give-run-updated
  |=  ru=run:ac
  ^+  cor
  (give-update ~[/v0 /v0/runs] [%run-updated ru])
::
++  give-memory-update
  |=  upd=memory-update-fact:ac
  ^+  cor
  (give %fact ~[/v0/memory] %agent-memory-update !>(upd))
::
++  give-memory-created
  |=  mem=memory:ac
  ^+  cor
  (give-memory-update [%memory-created mem memory-stats])
::
++  give-memory-updated
  |=  mem=memory:ac
  ^+  cor
  (give-memory-update [%memory-updated mem memory-stats])
::
++  give-memory-archived
  |=  mem=memory:ac
  ^+  cor
  (give-memory-update [%memory-archived mem memory-stats])
::
++  give-memory-deleted
  |=  id=memory-id:ac
  ^+  cor
  (give-memory-update [%memory-deleted id memory-stats])
::
++  init-fact
  |=  [cs=(list cron:ac) rs=(list run:ac)]
  ^-  update-fact:ac
  [%init [cs rs]]
::
++  memory-init-fact
  |=  mems=(list memory:ac)
  ^-  memory-update-fact:ac
  [%init [(sort-memories mems) memory-stats]]
::
++  watch
  |=  =path
  ^+  cor
  ?>  =(src our):bowl
  ?+  path  ~|(bad-watch-path+path !!)
    [%v0 ~]
      (give-update ~[/v0] (init-fact cron-list active-run-list))
    [%v0 %crons ~]
      (give-update ~[/v0/crons] (init-fact cron-list ~))
    [%v0 %runs ~]
      (give-update ~[/v0/runs] (init-fact ~ active-run-list))
    [%v0 %memory ~]
      (give-memory-update (memory-init-fact non-archived-memory-list))
  ==
::
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+  pole  [~ ~]
    [%x %v0 ~]
      ``agent-cron-update+!>((init-fact cron-list active-run-list))
    [%x %v0 %crons ~]
      ``agent-cron-update+!>((init-fact cron-list ~))
    [%x %v0 %crons id=@ ~]
      =/  cid=cron-id:ac  (slav %uv id.pole)
      =/  old=(unit cron:ac)  (~(get by crons) cid)
      ?~  old  [~ ~]
      ``agent-cron-update+!>(`update-fact:ac`[%cron-updated u.old])
    [%x %v0 %runs ~]
      ``agent-cron-update+!>((init-fact ~ run-list))
    [%x %v0 %runs %pending ~]
      ``agent-cron-update+!>((init-fact ~ pending-run-list))
    [%x %v0 %runs id=@ ~]
      =/  rid=run-id:ac  (slav %uv id.pole)
      =/  old=(unit run:ac)  (~(get by runs) rid)
      ?~  old  [~ ~]
      ``agent-cron-update+!>(`update-fact:ac`[%run-updated u.old])
    [%x %v0 %memory ~]
      ``agent-memory-update+!>((memory-init-fact non-archived-memory-list))
    [%x %v0 %memory %all ~]
      ``agent-memory-update+!>((memory-init-fact memory-list))
    [%x %v0 %memory %active ~]
      ``agent-memory-update+!>((memory-init-fact active-status-memory-list))
    [%x %v0 %memory %pinned ~]
      ``agent-memory-update+!>((memory-init-fact pinned-active-memory-list))
    [%x %v0 %memory %since since=@ ~]
      =/  wen=@da  (slav %da since.pole)
      ``agent-memory-update+!>((memory-init-fact (memories-since wen)))
    [%x %v0 %memory %id id=@ ~]
      =/  mid=memory-id:ac  (slav %uv id.pole)
      =/  old=(unit memory:ac)  (~(get by memories) mid)
      ?~  old  [~ ~]
      ``agent-memory-update+!>(`memory-update-fact:ac`[%memory-updated u.old memory-stats])
    [%x %v0 %memory %global ~]
      ``agent-memory-update+!>((memory-init-fact global-memory-list))
    [%x %v0 %memory %dm who=@ ~]
      =/  who-ship=ship  (slav %p who.pole)
      ``agent-memory-update+!>((memory-init-fact (scoped-ship-memory-list %dm who-ship)))
    [%x %v0 %memory %agent who=@ ~]
      =/  who-ship=ship  (slav %p who.pole)
      ``agent-memory-update+!>((memory-init-fact (scoped-ship-memory-list %agent who-ship)))
    [%x %v0 %memory %stats ~]
      ``agent-memory-update+!>((memory-init-fact ~))
  ==
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?>  =(src our):bowl
  ?+  mark  ~|(bad-poke-mark+mark !!)
    %agent-cron-action
      =/  act=action:ac  !<(action:ac vase)
      ?-  -.act
        %create         (create-cron create.act)
        %update         (update-cron update.act)
        %pause          (set-cron-status id.act %paused)
        %resume         (set-cron-status id.act %active)
        %cancel         (set-cron-status id.act %cancelled)
        %delete         (delete-cron id.act)
        %run-now        (run-now id.act)
        %run-started    (run-started run-id.act)
        %run-completed  (run-completed completion.act)
        %run-failed     (run-failed failure.act)
      ==
    %agent-memory-action
      =/  act=memory-action:ac  !<(memory-action:ac vase)
      ?-  -.act
        %create   (create-memory create.act)
        %upsert   (upsert-memory upsert.act)
        %update   (update-memory patch.act)
        %archive  (archive-memory id.act)
        %delete   (delete-memory id.act)
      ==
  ==
::
++  memory-from-create
  |=  [mid=memory-id:ac req=memory-create:ac wen=@da]
  ^-  memory:ac
  =/  st=memory-status:ac  ?~(status.req %active u.status.req)
  :*  mid
      kind.req
      scope.req
      subject.req
      key.req
      title.req
      body.req
      ?~(tags.req ~ u.tags.req)
      ?~(priority.req 50 u.priority.req)
      ?~(pinned.req %.n u.pinned.req)
      st
      source.req
      ?~(evidence-refs.req ~ u.evidence-refs.req)
      valid-from.req
      valid-to.req
      wen
      wen
      ?:(=(%archived st) `wen ~)
  ==
::
++  memory-from-upsert
  |=  [mid=memory-id:ac req=memory-upsert:ac created=@da wen=@da]
  ^-  memory:ac
  =/  st=memory-status:ac  ?~(status.req %active u.status.req)
  :*  mid
      kind.req
      scope.req
      subject.req
      `key.req
      title.req
      body.req
      ?~(tags.req ~ u.tags.req)
      ?~(priority.req 50 u.priority.req)
      ?~(pinned.req %.n u.pinned.req)
      st
      source.req
      ?~(evidence-refs.req ~ u.evidence-refs.req)
      valid-from.req
      valid-to.req
      created
      wen
      ?:(=(%archived st) `wen ~)
  ==
::
++  apply-memory-patch
  |=  [old=memory:ac req=memory-patch:ac]
  ^-  memory:ac
  =/  mem=memory:ac  old
  =.  key.mem  ?~(key.req key.mem u.key.req)
  =.  title.mem  ?~(title.req title.mem u.title.req)
  =.  body.mem  ?~(body.req body.mem u.body.req)
  =.  tags.mem  ?~(tags.req tags.mem u.tags.req)
  =.  priority.mem  ?~(priority.req priority.mem u.priority.req)
  =.  pinned.mem  ?~(pinned.req pinned.mem u.pinned.req)
  =.  status.mem  ?~(status.req status.mem u.status.req)
  =.  evidence-refs.mem  ?~(evidence-refs.req evidence-refs.mem u.evidence-refs.req)
  =.  valid-from.mem  ?~(valid-from.req valid-from.mem u.valid-from.req)
  =.  valid-to.mem  ?~(valid-to.req valid-to.mem u.valid-to.req)
  =.  archived-at.mem
    ?:  =(%archived status.mem)
      ?~(archived-at.mem `now.bowl archived-at.mem)
    ~
  =.  updated-at.mem  now.bowl
  mem
::
++  create-memory
  |=  req=memory-create:ac
  ^+  cor
  =/  mid=memory-id:ac  (new-id %memory)
  =/  mem=memory:ac  (memory-from-create mid req now.bowl)
  ?>  (valid-memory mem)
  =/  duplicate=(unit memory-id:ac)
    (duplicate-memory-id ~ scope.mem subject.mem key.mem)
  ?>  ?|  =(%archived status.mem)
          ?=(~ duplicate)
      ==
  ?>  (can-add-memory status.mem)
  =.  counter  +(counter)
  =.  memories  (~(put by memories) mid mem)
  (give-memory-created mem)
::
++  upsert-memory
  |=  req=memory-upsert:ac
  ^+  cor
  =/  existing=(unit memory-id:ac)
    (duplicate-memory-id ~ scope.req subject.req `key.req)
  ?~  existing
    =/  mid=memory-id:ac  (new-id %memory)
    =/  mem=memory:ac  (memory-from-upsert mid req now.bowl now.bowl)
    ?>  (valid-memory mem)
    ?>  (can-add-memory status.mem)
    =.  counter  +(counter)
    =.  memories  (~(put by memories) mid mem)
    (give-memory-created mem)
  =/  old=(unit memory:ac)  (~(get by memories) u.existing)
  ?>  ?=(^ old)
  =/  mem=memory:ac
    (memory-from-upsert u.existing req created-at.u.old now.bowl)
  ?>  (valid-memory mem)
  =/  duplicate=(unit memory-id:ac)
    (duplicate-memory-id `u.existing scope.mem subject.mem key.mem)
  ?>  ?|  =(%archived status.mem)
          ?=(~ duplicate)
      ==
  =.  memories  (~(put by memories) u.existing mem)
  ?:  ?&  !=(%archived status.u.old)
          =(%archived status.mem)
      ==
    (give-memory-archived mem)
  (give-memory-updated mem)
::
++  update-memory
  |=  req=memory-patch:ac
  ^+  cor
  =/  old=(unit memory:ac)  (~(get by memories) id.req)
  ?>  ?=(^ old)
  =/  mem=memory:ac  (apply-memory-patch u.old req)
  ?>  (valid-memory mem)
  =/  duplicate=(unit memory-id:ac)
    (duplicate-memory-id `id.req scope.mem subject.mem key.mem)
  ?>  ?|  =(%archived status.mem)
          ?=(~ duplicate)
      ==
  ?>  (valid-capacity-transition u.old mem)
  =.  memories  (~(put by memories) id.req mem)
  ?:  ?&  !=(%archived status.u.old)
          =(%archived status.mem)
      ==
    (give-memory-archived mem)
  (give-memory-updated mem)
::
++  archive-memory
  |=  mid=memory-id:ac
  ^+  cor
  =/  old=(unit memory:ac)  (~(get by memories) mid)
  ?>  ?=(^ old)
  =/  mem=memory:ac  u.old
  =.  status.mem  %archived
  =.  archived-at.mem  `now.bowl
  =.  updated-at.mem  now.bowl
  =.  memories  (~(put by memories) mid mem)
  (give-memory-archived mem)
::
++  delete-memory
  |=  mid=memory-id:ac
  ^+  cor
  ?>  (~(has by memories) mid)
  =.  memories  (~(del by memories) mid)
  (give-memory-deleted mid)
::
++  create-cron
  |=  req=create:ac
  ^+  cor
  ?>  (valid-schedule schedule.req)
  =/  generated=cron-id:ac  (new-id %cron)
  =.  counter  +(counter)
  =/  cid=cron-id:ac  ?~(id.req generated u.id.req)
  ?>  !(~(has by crons) cid)
  =/  st=cron-status:ac  ?~(status.req %active u.status.req)
  =/  pol=tool-policy:ac  ?~(tool-policy.req [%all ~] u.tool-policy.req)
  =/  cr=cron:ac
    :*  cid
        title.req
        prompt.req
        st
        schedule.req
        target.req
        pol
        now.bowl
        now.bowl
        ~
    ==
  =.  crons  (~(put by crons) cid cr)
  =.  cor  ?:(=(%active st) (schedule-cron cr) cor)
  (give-cron-created cr)
::
++  update-cron
  |=  req=update:ac
  ^+  cor
  =/  old=(unit cron:ac)  (~(get by crons) id.req)
  ?>  ?=(^ old)
  =/  cr=cron:ac  u.old
  =.  title.cr  ?~(title.req title.cr u.title.req)
  =.  prompt.cr  ?~(prompt.req prompt.cr u.prompt.req)
  =.  schedule.cr  ?~(schedule.req schedule.cr u.schedule.req)
  =.  target.cr  ?~(target.req target.cr u.target.req)
  =.  tool-policy.cr  ?~(tool-policy.req tool-policy.cr u.tool-policy.req)
  ?>  (valid-schedule schedule.cr)
  =.  updated-at.cr  now.bowl
  =.  crons  (~(put by crons) id.req cr)
  =.  cor  ?:(=(%active status.cr) (schedule-cron cr) cor)
  (give-cron-updated cr)
::
++  set-cron-status
  |=  [cid=cron-id:ac st=cron-status:ac]
  ^+  cor
  =/  old=(unit cron:ac)  (~(get by crons) cid)
  ?>  ?=(^ old)
  =/  cr=cron:ac  u.old
  =.  status.cr  st
  =.  updated-at.cr  now.bowl
  =.  crons  (~(put by crons) cid cr)
  =.  cor  ?:(=(%active st) (schedule-cron cr) cor)
  (give-cron-updated cr)
::
++  delete-cron
  |=  cid=cron-id:ac
  ^+  cor
  ?>  (~(has by crons) cid)
  =.  crons  (~(del by crons) cid)
  (give-cron-deleted cid)
::
++  run-now
  |=  cid=cron-id:ac
  ^+  cor
  =/  old=(unit cron:ac)  (~(get by crons) cid)
  ?>  ?=(^ old)
  (create-run u.old now.bowl now.bowl)
::
++  create-run
  |=  [cr=cron:ac scheduled-for=@da fired-at=@da]
  ^+  cor
  =/  rid=run-id:ac  (new-id %run)
  =.  counter  +(counter)
  =/  ru=run:ac
    :*  rid
        id.cr
        %pending
        prompt.cr
        target.cr
        tool-policy.cr
        scheduled-for
        fired-at
        ~
        ~
        ~
        ~
        ~
        fired-at
        fired-at
    ==
  =.  runs  (~(put by runs) rid ru)
  (give-run-requested ru)
::
++  run-started
  |=  rid=run-id:ac
  ^+  cor
  =/  old=(unit run:ac)  (~(get by runs) rid)
  ?>  ?=(^ old)
  =/  ru=run:ac  u.old
  ?.  =(%pending status.ru)  cor
  =.  status.ru  %running
  =.  claimed-at.ru  `now.bowl
  =.  updated-at.ru  now.bowl
  =.  runs  (~(put by runs) rid ru)
  (give-run-updated ru)
::
++  run-completed
  |=  com=completion:ac
  ^+  cor
  =/  old=(unit run:ac)  (~(get by runs) run-id.com)
  ?>  ?=(^ old)
  =/  ru=run:ac  u.old
  ?.  ?|  =(%pending status.ru)
          =(%running status.ru)
      ==
    cor
  =.  status.ru  %completed
  =.  completed-at.ru  `now.bowl
  =.  output-preview.ru  output-preview.com
  =.  delivery.ru  delivery.com
  =.  error.ru  ~
  =.  updated-at.ru  now.bowl
  =.  runs  (~(put by runs) run-id.com ru)
  (give-run-updated ru)
::
++  run-failed
  |=  fail=failure:ac
  ^+  cor
  =/  old=(unit run:ac)  (~(get by runs) run-id.fail)
  ?>  ?=(^ old)
  =/  ru=run:ac  u.old
  ?.  ?|  =(%pending status.ru)
          =(%running status.ru)
      ==
    cor
  =.  status.ru  %failed
  =.  completed-at.ru  `now.bowl
  =.  output-preview.ru  ~
  =.  delivery.ru  ~
  =.  error.ru  `error.fail
  =.  updated-at.ru  now.bowl
  =.  runs  (~(put by runs) run-id.fail ru)
  (give-run-updated ru)
::
++  arvo
  |=  [=(pole knot) sign=sign-arvo]
  ^+  cor
  ?+  pole  cor
    [%cron id=@ scheduled-for=@ ~]
      ?>  ?=([%behn %wake *] sign)
      =/  cid=cron-id:ac  (slav %uv id.pole)
      =/  wen=@da  (slav %da scheduled-for.pole)
      (handle-wake cid wen)
  ==
::
++  handle-wake
  |=  [cid=cron-id:ac scheduled-for=@da]
  ^+  cor
  =/  old=(unit cron:ac)  (~(get by crons) cid)
  ?~  old  cor
  =/  cr=cron:ac  u.old
  ?.  ?&  =(%active status.cr)
          =((schedule-next schedule.cr) scheduled-for)
      ==
    cor
  =.  cor  ?:((has-active-run cid) cor (create-run cr scheduled-for now.bowl))
  =.  last-fired-at.cr  `now.bowl
  =.  updated-at.cr  now.bowl
  =.  cr
    ?-  -.schedule.cr
      %once
        cr(status %cancelled)
      %interval
        =/  next=@da
          (advance-interval (add scheduled-for every.schedule.cr) every.schedule.cr now.bowl)
        cr(schedule [%interval next every.schedule.cr])
    ==
  =.  crons  (~(put by crons) cid cr)
  =.  cor  (give-cron-updated cr)
  =.  cor  ?:(=(%active status.cr) (schedule-cron cr) cor)
  cor
--

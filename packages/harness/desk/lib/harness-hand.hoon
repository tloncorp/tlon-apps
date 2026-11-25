::  Pure binding, admission, and delivery bookkeeping. No transport or scheduler.
/-  h=harness, hh=harness-hand
|%
::
++  terminal
  |=  status=delivery-state:hh
  |(=(%delivered status) =(%abandoned status))
::
++  generated
  |=  id=@t
  =('hand--' (end [3 6] id))
::
::  ~['*'] admits any actor. The adapter that binds it gates its speakers.
++  actor-allowed
  |=  [actors=(list @t) actor=@t]
  ^-  ?
  |(=(~['*'] actors) (lien actors |=(allowed=@t =(allowed actor))))
::
++  get-control
  |=  [db=state:hh id=input-id:h]
  ^-  control:hh
  (fall (~(get by controls.db) id) *control:hh)
::
++  input-id
  |=  [binding=@t event=@t]
  ^-  input-id:h
  (end [3 16] (shas %hand-input (jam [binding event])))
::  A hand's event id for a channel message heard without a mention starts
::  with .unaddressed-prefix: the bot may leave it unanswered.
::
++  unaddressed-prefix  'unaddressed/'
++  unaddressed
  |=  event=@t
  ^-  ?
  =(unaddressed-prefix (end [3 (met 3 unaddressed-prefix)] event))
::  +message-event: .event without .unaddressed-prefix
::
++  message-event
  |=  event=@t
  ^-  @t
  ?.  (unaddressed event)  event
  (rsh [3 (met 3 unaddressed-prefix)] event)
::
++  id-json
  |=  id=input-id:h
  ^-  json
  [%s (scot %uv id)]
::
++  admission-json
  |=  [id=input-id:h observation=observation:hh]
  ^-  json
  %-  pairs:enjs:format
  :~  ['inputId' (id-json id)]
      ['phase' %s phase.observation]
      ['sourceEvent' %s event.observation]
  ==
::
++  publication-json
  |=  [db=state:hh id=input-id:h publication=publication:hh]
  ^-  json
  =/  control  (get-control db id)
  %-  pairs:enjs:format
  :~  ['version' (numb:enjs:format 2)]
      ['attempt' (numb:enjs:format attempt.control)]
      :-  'resolutions'
      :-  %a
      %+  turn  (flop resolutions.control)
      |=  resolution=resolution:hh
      %-  pairs:enjs:format
      :~  ['at' %s (scot %da at.resolution)]
          ['attempt' (numb:enjs:format attempt.resolution)]
          ['outcome' %s outcome.resolution]
          ['reason' %s reason.resolution]
      ==
      ['effectId' (id-json id)]
      ['inputId' (id-json input.publication)]
      ['binding' %s binding.publication]
      ['hand' %s hand.publication]
      ['address' %s address.publication]
      ['sessionId' %s sid.publication]
      ['capability' %s 'publish']
      ['kind' %s kind.publication]
      ['text' %s body.publication]
      ['status' %s status.publication]
      ['worker' %s worker.publication]
      ['externalId' %s external.publication]
      :-  'receipts'
      :-  %a
      %+  turn  (flop receipts.publication)
      |=  receipt=receipt:hh
      %-  pairs:enjs:format
      :~  ['at' %s (scot %da at.receipt)]
          ['status' %s status.receipt]
          ['worker' %s worker.receipt]
          ['externalId' %s external.receipt]
      ==
  ==
::
++  outbox-json
  |=  [ledger=indexed:hh hand=@t]
  ^-  json
  =*  db  db.ledger
  :-  %a
  %+  murn  ~(tap in open.index.ledger)
  |=  id=input-id:h
  ^-  (unit json)
  =/  publication  (~(get by outbox.db) id)
  ?~  publication  ~
  ?.  =(hand hand.u.publication)  ~
  ?:  (terminal status.u.publication)  ~
  =/  config  (~(get by bindings.db) binding.u.publication)
  ?~  config  ~
  ?.  enabled.u.config  ~
  `(publication-json db id u.publication)
::
++  pending-publications
  |=  [ledger=indexed:hh hand=@t]
  ^-  (list [id=input-id:h pub=publication:hh])
  =*  db  db.ledger
  ::  Retained receipts are evidence, not the runnable queue. Filter before
  ::  sorting, and resolve admission timestamps once rather than per compare.
  =/  pending
    %+  murn  ~(tap in open.index.ledger)
    |=  id=input-id:h
    ^-  (unit [at=@da id=input-id:h pub=publication:hh])
    =/  found  (~(get by outbox.db) id)
    ?~  found  ~
    =/  pub  u.found
    ?.  &(=(hand hand.pub) =(%pending status.pub))  ~
    =/  obs  (~(get by observations.db) input.pub)
    ?~  obs  ~
    `[at.u.obs id pub]
  =.  pending
    %+  sort  pending
    |=  [a=[at=@da id=input-id:h pub=publication:hh] b=[at=@da id=input-id:h pub=publication:hh]]
    ?:  =(at.a at.b)  (lth id.a id.b)
    (lth at.a at.b)
  (turn pending |=([at=@da id=input-id:h pub=publication:hh] [id pub]))
::
++  claim-json
  |=  [db=state:hh id=input-id:h publication=publication:hh acquired=?]
  ^-  json
  =/  value  (publication-json db id publication)
  ?>  ?=(%o -.value)
  [%o (~(put by p.value) 'acquired' [%b acquired])]
::
::  +status-json: a binding's newest 256 observations and any active work
::  older than them, so the reply does not grow with history
::
++  status-json
  |=  [db=state:hh binding=@t]
  ^-  json
  =/  config  (~(get by bindings.db) binding)
  ?~  config  ~
  =/  rows=(list [at=@da id=input-id:h])
    %+  murn  ~(tap by observations.db)
    |=  [id=input-id:h observation=observation:hh]
    ?.  =(binding binding.observation)  ~
    `[at.observation id]
  =/  shown  (newest 256 rows)
  =/  listed  (silt shown)
  =/  older=(list input-id:h)
    %+  murn  rows
    |=  [at=@da id=input-id:h]
    ?:  (~(has in listed) id)  ~
    =/  observation  (~(got by observations.db) id)
    ?.  ?=(?(%queued %running) phase.observation)  ~
    `id
  =/  inputs=(list json)
    %+  turn  (weld shown older)
    |=(id=input-id:h (admission-json id (~(got by observations.db) id)))
  %-  pairs:enjs:format
  %+  weld  (binding-fields binding u.config)
  :~  ['observationCount' (numb:enjs:format (lent rows))]
      ['observations' %a inputs]
  ==
::
++  binding-fields
  |=  [id=@t config=binding:hh]
  ^-  (list [@t json])
  :~  ['binding' %s id]
      ['hand' %s hand.config]
      ['address' %s address.config]
      ['sessionId' %s sid.config]
      ['enabled' %b enabled.config]
      ['actors' %a (turn actors.config |=(a=@t `json`[%s a]))]
  ==
::
++  apply
  |=  [db=state:hh action=action:hh now=@da]
  ^-  (each [db=state:hh result=json] @t)
  ?-  -.action
    %register  (apply-register db action now)
    %bind  (apply-bind db action now)
      %enable
    =/  config  (~(get by bindings.db) id.action)
    ?~  config  [%| 'Unknown binding']
    =/  changed  u.config(enabled enabled.action)
    =.  bindings.db  (~(put by bindings.db) id.action changed)
    ::  Turning a hand off enables or disables every conversation at once;
    ::  its rows are read through %status.
    [%& db (pairs:enjs:format (binding-fields id.action changed))]
    %remove  (apply-remove db action now)
    %observe  (apply-observe db action now)
    %notify  (apply-notify db action now)
    %claim  (apply-claim db action now)
      %receipt
    =/  control  (get-control db effect.action)
    ?.  =(1 attempt.control)  [%| 'An explicit attempt is required after recovery or retry']
    $(action [%receipt-at hand.action effect.action worker.action 1 status.action external.action])
    %receipt-at  (apply-receipt-at db action now)
    %retry  (apply-retry db action now)
      %status
    ?.  (~(has by bindings.db) binding.action)  [%| 'Unknown binding']
    [%& db (status-json db binding.action)]
      %outbox
    [%& db (outbox-json [db (reindex db)] hand.action)]
      %publications
    [%& db (publications-json [db (reindex db)] hand.action after.action limit.action)]
      %effect
    =/  publication  (~(get by outbox.db) effect.action)
    ?~  publication  [%| 'Unknown effect']
    ?.  =(hand.action hand.u.publication)  [%| 'Wrong hand']
    [%& db (publication-json db effect.action u.publication)]
      %resolve
    (resolve db action now)
      %health
    [%& db (health-json db hand.action now)]
      %archive
    (archive db binding.action)
      %records
    [%& db (records-json db binding.action after.action limit.action)]
      %retire
    (retire db binding.action digest.action location.action now)
  ==
::
++  apply-register
  |=  [db=state:hh action=action:hh now=@da]
  ^-  (each [db=state:hh result=json] @t)
  ?>  ?=(%register -.action)
  =/  id=@t  (cat 3 'hand--' (scot %ud next-binding.db))
  =.  next-binding.db  +(next-binding.db)
  ::  Allocation skips every retained identity, including detached bindings.
  ?:  ?|  (~(has by bindings.db) id)
          (~(has in retired.db) id)
          (lien retirements.db |=(receipt=retirement:hh =(binding.receipt id)))
          %+  lien
            ~(val by observations.db)
          |=(observation=observation:hh =(binding.observation id))
      ==
    $(db db)
  (bind-config db id config.action)
::
++  apply-bind
  |=  [db=state:hh action=action:hh now=@da]
  ^-  (each [db=state:hh result=json] @t)
  ?>  ?=(%bind -.action)
  ?:  (generated id.action)  [%| 'The hand-- namespace is allocated by register']
  (bind-config db id.action config.action)
::
++  apply-remove
  |=  [db=state:hh action=action:hh now=@da]
  ^-  (each [db=state:hh result=json] @t)
  ?>  ?=(%remove -.action)
  =/  config  (~(get by bindings.db) id.action)
  ?~  config  [%| 'Unknown binding']
  ?:  %+  lien
        ~(val by observations.db)
      |=(observation=observation:hh =(binding.observation id.action))
    [%| 'Export and retire a binding that has observations']
  =.  bindings.db  (~(del by bindings.db) id.action)
  =?  retired.db  !(generated id.action)  (~(put in retired.db) id.action)
  [%& db (pairs:enjs:format ~)]
::
++  apply-observe
  |=  [db=state:hh action=action:hh now=@da]
  ^-  (each [db=state:hh result=json] @t)
  ?>  ?=(%observe -.action)
  =/  config  (~(get by bindings.db) binding.action)
  ?~  config  [%| 'Unknown binding']
  ?.  enabled.u.config  [%| 'Binding is disabled']
  ?.  (actor-allowed actors.u.config actor.action)
    [%| 'Actor is not allowed by this binding']
  ?.  ?&  !=('' event.action)
          !=('' text.action)
          (lte (met 3 text.action) 65.536)
          (lte (met 3 event.action) 512)
      ==
    [%| 'Expected nonempty source event and text within admission limits']
  =/  id  (input-id binding.action event.action)
  =/  seen  (~(get by observations.db) id)
  ::  Replays return their first admission even when the queue is now full.
  ?^  seen
    ?.  &(=(actor.action actor.u.seen) =(text.action text.u.seen))
      [%| 'Source event already admitted with different content']
    [%& db (admission-json id u.seen)]
  ?:  (gte (lent queue.db) 128)  [%| 'Admission queue is full; retry the same source event later']
  =/  counts=[binding=@ud session=@ud]  (queued-counts db binding.action sid.u.config)
  ?:  |((gte binding.counts 8) (gte session.counts 16))
    [%| 'This binding or session has reached its waiting-work limit']
  =/  =observation:hh  [binding.action event.action actor.action text.action now %queued]
  =.  observations.db  (~(put by observations.db) id observation)
  =.  queue.db  (snoc queue.db id)
  [%& db (admission-json id observation)]
::
++  apply-notify
  |=  [db=state:hh action=action:hh now=@da]
  ^-  (each [db=state:hh result=json] @t)
  ?>  ?=(%notify -.action)
  ::  A literal notification shares admission and delivery bookkeeping,
  ::  but completes immediately without entering model execution.
  =/  id  (input-id binding.action event.action)
  =/  old  (~(get by observations.db) id)
  =/  admitted  (apply db [%observe binding.action event.action actor.action text.action] now)
  ?:  ?=(%| -.admitted)  admitted
  ?^  old
    =/  publication  (~(get by outbox.db) id)
    ?.  ?&  ?=(^ publication)
            =(%completed phase.u.old)
            =(%reply kind.u.publication)
            =(text.action body.u.publication)
        ==
      [%| 'Source event already belongs to different work']
    [%& db (admission-json id u.old)]
  =.  db  db.p.admitted
  =/  observation  (~(got by observations.db) id)
  =/  config  (~(got by bindings.db) binding.action)
  =/  =publication:hh
    :*  id  binding.action  hand.config  address.config  sid.config
        %reply  text.action  %pending  ''  ''  ~
    ==
  =.  observations.db  (~(put by observations.db) id observation(phase %completed))
  =.  queue.db  (skip queue.db |=(queued=input-id:h =(id queued)))
  =.  outbox.db  (~(put by outbox.db) id publication)
  [%& db (admission-json id observation(phase %completed))]
::
++  apply-claim
  |=  [db=state:hh action=action:hh now=@da]
  ^-  (each [db=state:hh result=json] @t)
  ?>  ?=(%claim -.action)
  ?.  (lte (met 3 worker.action) 128)  [%| 'Worker identity exceeds its limit']
  =/  publication  (~(get by outbox.db) effect.action)
  ?~  publication  [%| 'Unknown effect']
  ?.  &(=(hand.action hand.u.publication) !=('' worker.action))
    [%| 'Wrong hand or missing worker identity']
  =/  config  (~(get by bindings.db) binding.u.publication)
  ?.  &(?=(^ config) enabled.u.config)  [%| 'Binding is disabled']
  ?.  ?|  =(%pending status.u.publication)
          &(=(%claimed status.u.publication) =(worker.action worker.u.publication))
      ==
    [%| 'Effect is not available to this worker']
  ?:  =(%claimed status.u.publication)  [%& db (claim-json db effect.action u.publication %.n)]
  =.  u.publication
    %=  u.publication
      status  %claimed
      worker  worker.action
      receipts  [[now %claimed worker.action ''] receipts.u.publication]
    ==
  =/  control  (get-control db effect.action)
  =.  controls.db  (~(put by controls.db) effect.action control(attempt +(attempt.control)))
  =.  outbox.db  (~(put by outbox.db) effect.action u.publication)
  [%& db (claim-json db effect.action u.publication %.y)]
::
++  apply-receipt-at
  |=  [db=state:hh action=action:hh now=@da]
  ^-  (each [db=state:hh result=json] @t)
  ?>  ?=(%receipt-at -.action)
  ?.  (lte (met 3 external.action) 2.048)  [%| 'External receipt exceeds its limit']
  =/  publication  (~(get by outbox.db) effect.action)
  ?~  publication  [%| 'Unknown effect']
  ?.  =(attempt.action attempt:(get-control db effect.action))  [%| 'Stale delivery attempt']
  ?.  ?&  =(hand.action hand.u.publication)  !=('' worker.action)
          =(worker.action worker.u.publication)
      ==
    [%| 'Receipt does not match the claiming hand and worker']
  ?:  =(status.action status.u.publication)
    ?.  =(external.action external.u.publication)  [%| 'Conflicting receipt']
    [%& db (publication-json db effect.action u.publication)]
  ?.  ?=(?(%claimed %uncertain) status.u.publication)  [%| 'Effect cannot accept this receipt']
  =/  value=publication:hh  u.publication
  =.  value
    %=  value
      status  status.action
      external  external.action
      receipts  [[now status.action worker.action external.action] receipts.value]
    ==
  =.  outbox.db  (~(put by outbox.db) effect.action value)
  [%& db (publication-json db effect.action value)]
::
++  apply-retry
  |=  [db=state:hh action=action:hh now=@da]
  ^-  (each [db=state:hh result=json] @t)
  ?>  ?=(%retry -.action)
  =/  publication  (~(get by outbox.db) effect.action)
  ?~  publication  [%| 'Unknown effect']
  ?.  &(=(hand.action hand.u.publication) =(%failed status.u.publication))
    [%| 'Only a confirmed failed delivery may be retried; reconcile uncertain outcomes first']
  ?:  (gte (lent receipts.u.publication) 96)
    [%| 'Delivery retry budget exhausted; resolve or abandon the publication']
  =.  u.publication
    %=  u.publication
      status  %pending
      worker  ''
      external  ''
      receipts  [[now %pending '' ''] receipts.u.publication]
    ==
  =.  outbox.db  (~(put by outbox.db) effect.action u.publication)
  [%& db (publication-json db effect.action u.publication)]
::
++  bind-config
  |=  [db=state:hh id=@t config=binding:hh]
  ^-  (each [db=state:hh result=json] @t)
  ?.  &(!=('' id) !=('' hand.config) !=('' address.config) !=(~ actors.config))
    [%| 'Binding, hand, address, and an explicit actor allowlist are required']
  ?.  ?&  (lte (met 3 id) 128)
          (lte (met 3 hand.config) 128)
          (lte (met 3 address.config) 2.048)
          (lte (lent actors.config) 128)
      ==
    [%| 'Binding metadata exceeds its limits']
  ?.  (levy actors.config |=(actor=@t (lte (met 3 actor) 512)))
    [%| 'Actor identity exceeds its limit']
  =/  existing  (~(get by bindings.db) id)
  ?^  existing
    ?.  =(u.existing config)  [%| 'Binding identities are immutable; use a new id']
    ::  Rebinding happens on every message; its rows are read through %status.
    [%& db (pairs:enjs:format (binding-fields id u.existing))]
  ?:  ?|  (~(has in retired.db) id)
          (lien ~(val by observations.db) |=(observation=observation:hh =(binding.observation id)))
      ==
    [%| 'Retired binding ids cannot be reused']
  =.  bindings.db  (~(put by bindings.db) id config)
  [%& db (status-json db id)]
::
++  queued-counts
  |=  [db=state:hh binding=@t sid=session-id:h]
  ^-  [binding=@ud session=@ud]
  %+  roll  queue.db
  |=  [id=input-id:h counts=[binding=@ud session=@ud]]
  =/  observation  (need (~(get by observations.db) id))
  =/  config  (need (~(get by bindings.db) binding.observation))
  :-  (add binding.counts ?:(=(binding binding.observation) 1 0))
  (add session.counts ?:(=(sid sid.config) 1 0))
::
++  resolve
  |=  $:  db=state:hh
          $=  action
          $:  %resolve
              hand=@t
              effect=input-id:h
              attempt=@ud
              status=?(%delivered %failed %uncertain %abandoned)
              external=@t
              reason=@t
          ==
          now=@da
      ==
  ^-  (each [db=state:hh result=json] @t)
  =/  publication  (~(get by outbox.db) effect.action)
  ?~  publication  [%| 'Unknown effect']
  =/  control  (get-control db effect.action)
  ?.  &(=(hand.action hand.u.publication) =(attempt.action attempt.control))
    [%| 'Wrong hand or stale recovery attempt']
  ?:  (terminal status.u.publication)  [%| 'Publication is already terminal']
  ?.  &(!=('' reason.action) (lte (met 3 reason.action) 1.024) (lte (met 3 external.action) 2.048))
    [%| 'A bounded, explicit recovery reason is required']
  ?:  &((gte (lent resolutions.control) 32) !=(%abandoned status.action))
    [%| 'Recovery budget exhausted; archive an explicit abandonment']
  ::  Recovery advances the attempt so a late worker cannot overwrite it.
  =/  attempt=@ud  +(attempt.control)
  =.  controls.db
    %+  ~(put by controls.db)
      effect.action
    [attempt [[now attempt status.action reason.action] resolutions.control]]
  =.  u.publication
    %=  u.publication
      status  status.action
      worker  ''
      external  external.action
      receipts  [[now status.action '' external.action] receipts.u.publication]
    ==
  =.  outbox.db  (~(put by outbox.db) effect.action u.publication)
  [%& db (publication-json db effect.action u.publication)]
::
++  health-json
  |=  [db=state:hh hand=@t now=@da]
  ^-  json
  =/  claims=(list json)
    %+  murn  ~(tap by outbox.db)
    |=  [id=input-id:h publication=publication:hh]
    ^-  (unit json)
    ?.  ?&  =(hand hand.publication)
            |(=(%claimed status.publication) =(%uncertain status.publication))
        ==
      ~
    =/  age=@dr  ?~(receipts.publication ~s0 (sub now (min now at.i.receipts.publication)))
    %-  some
    %-  pairs:enjs:format
    :~  ['effectId' (id-json id)]
        ['binding' %s binding.publication]
        ['status' %s status.publication]
        ['worker' %s worker.publication]
        ['attempt' (numb:enjs:format attempt:(get-control db id))]
        ['ageSeconds' (numb:enjs:format (div age ~s1))]
        ['stale' %b (gte age ~m5)]
    ==
  %-  pairs:enjs:format
  :~  ['claims' %a claims]
      ['waiting' (numb:enjs:format (lent queue.db))]
      ['retainedObservations' (numb:enjs:format ~(wyt by observations.db))]
      ['queueLimit' (numb:enjs:format 128)]
      ['bindingQueueLimit' (numb:enjs:format 8)]
      ['sessionQueueLimit' (numb:enjs:format 16)]
  ==
::
++  binding-ids
  |=  [db=state:hh binding=@t]
  ^-  (list input-id:h)
  %-  sort
  :_  lth
  %+  murn  ~(tap by observations.db)
  |=  [id=input-id:h observation=observation:hh]
  ^-  (unit input-id:h)
  ?:(=(binding binding.observation) `id ~)
::
++  publications-json
  |=  [ledger=indexed:hh hand=@t after=(unit input-id:h) limit=@ud]
  ^-  json
  =*  db  db.ledger
  =/  ids=(list input-id:h)
    %-  sort
    :_  lth
    %+  murn  ~(tap in open.index.ledger)
    |=  id=input-id:h
    ^-  (unit input-id:h)
    =/  publication  (~(get by outbox.db) id)
    ?~  publication  ~
    ?.  &(=(hand hand.u.publication) !(terminal status.u.publication))  ~
    ?:  &(?=(^ after) (lte id u.after))  ~
    =/  config  (~(get by bindings.db) binding.u.publication)
    ?~  config  ~
    ?.  enabled.u.config  ~
    `id
  =/  page  (scag (min (max 1 (min 4 limit)) (lent ids)) ids)
  =/  records=(list json)
    %+  turn  page
    |=  id=input-id:h
    (publication-json db id (need (~(get by outbox.db) id)))
  %-  pairs:enjs:format
  :~  ['records' %a records]
      ['next' ?:((gth (lent ids) (lent page)) (id-json (rear page)) ~)]
  ==
::
++  archive-digest
  |=  [db=state:hh binding=@t]
  ^-  @uvH
  =/  records=(list noun)
    %+  turn  (binding-ids db binding)
    |=  id=input-id:h
    ^-  noun
    [id (~(get by observations.db) id) (~(get by outbox.db) id) (get-control db id)]
  (shas %hand-archive (jam [binding (~(get by bindings.db) binding) records]))
::
++  archive
  |=  [db=state:hh binding=@t]
  ^-  (each [db=state:hh result=json] @t)
  =/  config  (~(get by bindings.db) binding)
  ?:  &(?=(^ config) enabled.u.config)  [%| 'Disable the binding before exporting it']
  =/  ids  (binding-ids db binding)
  ?:  &(=(~ config) =(~ ids))  [%| 'Unknown binding']
  =/  working=?
    %+  lien  ids
    |=  id=input-id:h
    =/  observation  (need (~(get by observations.db) id))
    |(=(%queued phase.observation) =(%running phase.observation))
  ?:  working
    [%| 'Finish or cancel queued and active work before archiving']
  =/  unsettled=?
    %+  lien  ids
    |=  id=input-id:h
    =/  publication  (~(get by outbox.db) id)
    ?~  publication  %.n
    !(terminal status.u.publication)
  ?:  unsettled
    [%| 'Resolve every publication before archiving']
  :+  %&  db
  %-  pairs:enjs:format
  :~  ['binding' %s binding]
      ['digest' %s (scot %uv (archive-digest db binding))]
      ['records' (numb:enjs:format (lent ids))]
      ['config' (status-json db binding)]
  ==
::
++  records-json
  |=  [db=state:hh binding=@t after=(unit input-id:h) limit=@ud]
  ^-  json
  =/  ids  (skip (binding-ids db binding) |=(id=input-id:h ?~(after %.n (lte id u.after))))
  =/  page  (scag (min (max 1 (min 4 limit)) (lent ids)) ids)
  =/  records=(list json)
    %+  turn  page
    |=  id=input-id:h
    =/  observation  (need (~(get by observations.db) id))
    =/  publication  (~(get by outbox.db) id)
    %-  pairs:enjs:format
    :~  ['inputId' (id-json id)]
        ['event' %s event.observation]
        ['actor' %s actor.observation]
        ['text' %s text.observation]
        ['at' %s (scot %da at.observation)]
        ['phase' %s phase.observation]
        ['publication' ?~(publication ~ (publication-json db id u.publication))]
    ==
  %-  pairs:enjs:format
  :~  ['digest' %s (scot %uv (archive-digest db binding))]
      ['records' %a records]
      ['next' ?:((gth (lent ids) (lent page)) (id-json (rear page)) ~)]
  ==
::
++  retire
  |=  [db=state:hh binding=@t digest=@uvH location=@t now=@da]
  ^-  (each [db=state:hh result=json] @t)
  =/  prior  (skim retirements.db |=(r=retirement:hh &(=(binding binding.r) =(digest digest.r))))
  ?^  prior
    ?.  &(=(digest digest.i.prior) =(location location.i.prior))
      [%| 'Conflicting retirement receipt']
    :*  %&  db
        %-  pairs:enjs:format
        ~[['retired' %s binding] ['digest' %s (scot %uv digest)] ['location' %s location]]
    ==
  =/  ready  (archive db binding)
  ?:  ?=(%| -.ready)  ready
  ?.  =(digest (archive-digest db binding))  [%| 'Archive changed; export it again before retiring']
  ?.  &(!=('' location) (lte (met 3 location) 2.048))  [%| 'An archive location is required']
  =/  ids  (binding-ids db binding)
  =.  db
    |-
    ?~  ids  db
    %=  $
      ids  t.ids
      db
        %=  db
          observations  (~(del by observations.db) i.ids)
          outbox  (~(del by outbox.db) i.ids)
          controls  (~(del by controls.db) i.ids)
        ==
    ==
  =.  bindings.db  (~(del by bindings.db) binding)
  =?  retired.db  !(generated binding)  (~(put in retired.db) binding)
  =.  retirements.db
    [[binding digest location now] (scag (min 127 (lent retirements.db)) retirements.db)]
  :*  %&  db
      %-  pairs:enjs:format
      ~[['retired' %s binding] ['digest' %s (scot %uv digest)] ['location' %s location]]
  ==
::
++  next
  |=  [db=state:hh sid=session-id:h]
  ^-  (unit input-id:h)
  ?:  (~(has by active.db) sid)  ~
  =/  remaining  queue.db
  |-
  ?~  remaining  ~
  =/  observation  (~(get by observations.db) i.remaining)
  ?~  observation  $(remaining t.remaining)
  =/  config  (~(get by bindings.db) binding.u.observation)
  ?~  config  $(remaining t.remaining)
  ?.  &(enabled.u.config =(sid sid.u.config))  $(remaining t.remaining)
  `i.remaining
::
++  start
  |=  [db=state:hh sid=session-id:h id=input-id:h]
  ^-  state:hh
  =/  observation  (need (~(get by observations.db) id))
  %=  db
    observations  (~(put by observations.db) id observation(phase %running))
    queue  (skip queue.db |=(i=input-id:h =(i id)))
    active  (~(put by active.db) sid id)
  ==
::
++  finish
  |=  [db=state:hh sid=session-id:h kind=?(%reply %failure %cancelled) body=@t]
  ^-  state:hh
  =/  id  (~(get by active.db) sid)
  ?~  id  db
  =/  observation  (need (~(get by observations.db) u.id))
  =/  config  (need (~(get by bindings.db) binding.observation))
  =/  =phase:hh
    ?-  kind
      %reply  %completed
      %failure  %failed
      %cancelled  %cancelled
    ==
  =/  =publication:hh
    :*  u.id  binding.observation  hand.config  address.config  sid
        kind  body  %pending  ''  ''  ~
    ==
  %=  db
    observations  (~(put by observations.db) u.id observation(phase phase))
    active  (~(del by active.db) sid)
    outbox  (~(put by outbox.db) u.id publication)
  ==
::
::  With .who, only that actor's waiting inputs.
++  cancel-queued
  |=  [db=state:hh sid=session-id:h who=(unit @t)]
  ^-  state:hh
  =/  waiting  queue.db
  |-
  ?~  waiting  db
  =/  id  i.waiting
  =/  observation  (need (~(get by observations.db) id))
  =/  config  (need (~(get by bindings.db) binding.observation))
  ?.  =(sid sid.config)  $(waiting t.waiting)
  ?.  |(?=(~ who) =(u.who actor.observation))  $(waiting t.waiting)
  =.  observations.db  (~(put by observations.db) id observation(phase %cancelled))
  =.  queue.db  (skip queue.db |=(i=input-id:h =(i id)))
  $(waiting t.waiting)
::
++  detach-session
  |=  [db=state:hh sid=session-id:h now=@da]
  ^-  state:hh
  db:(detach-session-indexed [db (reindex db)] sid now)
::
::  +reindex: derive the index of a whole ledger
::
++  reindex
  |=  db=state:hh
  ^-  index:hh
  =/  open=(set input-id:h)
    %-  silt
    %+  weld
      %+  murn  ~(tap by observations.db)
      |=  [id=input-id:h observation=observation:hh]
      ?.(?=(?(%queued %running) phase.observation) ~ `id)
    %+  murn  ~(tap by outbox.db)
    |=  [id=input-id:h publication=publication:hh]
    ?:((terminal status.publication) ~ `id)
  =/  rows=(map @t (list [at=@da id=input-id:h]))
    %+  roll  ~(tap by observations.db)
    |=  $:  [id=input-id:h observation=observation:hh]
            rows=(map @t (list [at=@da id=input-id:h]))
        ==
    =/  config  (~(get by bindings.db) binding.observation)
    ?~  config  rows
    (~(put by rows) hand.u.config [[at.observation id] (~(gut by rows) hand.u.config ~)])
  =/  sessions=(jug session-id:h @t)
    %+  roll  ~(tap by bindings.db)
    |=  [[id=@t config=binding:hh] sessions=(jug session-id:h @t)]
    (~(put ju sessions) sid.config id)
  [open (~(run by rows) window) sessions]
::
++  unfinished
  |=  [db=state:hh id=input-id:h]
  ^-  ?
  =/  observation  (~(get by observations.db) id)
  ?:  &(?=(^ observation) ?=(?(%queued %running) phase.u.observation))  &
  =/  publication  (~(get by outbox.db) id)
  &(?=(^ publication) !(terminal status.u.publication))
::
::  +window: a hand's newest 64 observations, newest first, ties by id
::
++  window
  |=  rows=(list [at=@da id=input-id:h])
  ^-  (list input-id:h)
  (newest 64 rows)
::
::  +newest: the newest .count rows, newest first, ties by id
::
++  newest
  |=  [count=@ud rows=(list [at=@da id=input-id:h])]
  ^-  (list input-id:h)
  %+  turn
    %+  scag  count
    %+  sort  rows
    |=  [a=[at=@da id=input-id:h] b=[at=@da id=input-id:h]]
    ?:  =(at.a at.b)  (lth id.a id.b)
    (gth at.a at.b)
  tail
::
::  +reckon: update the index for one record that was added or changed
::
::    Observations are only deleted by retirement, which rebuilds its hand,
::    so a window can only gain members here.
::
++  reckon
  |=  [=index:hh db=state:hh id=input-id:h]
  ^-  index:hh
  =.  open.index
    ?:  (unfinished db id)  (~(put in open.index) id)
    (~(del in open.index) id)
  =/  observation  (~(get by observations.db) id)
  ?~  observation  index
  =/  config  (~(get by bindings.db) binding.u.observation)
  ?~  config  index
  =/  ids  (~(gut by recent.index) hand.u.config ~)
  ?^  (find ~[id] ids)  index
  =/  rows  (turn ids |=(i=input-id:h [at:(~(got by observations.db) i) i]))
  =.  recent.index
    (~(put by recent.index) hand.u.config (window [[at.u.observation id] rows]))
  index
::
::  +enroll: list or unlist binding .id after an action created or deleted it
::
::    A binding's session never changes, so only creation and deletion move
::    it; disabling one keeps it listed.
::
++  enroll
  |=  [=index:hh before=state:hh after=state:hh id=@t]
  ^-  index:hh
  =/  config  (~(get by bindings.after) id)
  ?^  config  index(sessions (~(put ju sessions.index) sid.u.config id))
  =/  old  (~(get by bindings.before) id)
  ?~  old  index
  index(sessions (~(del ju sessions.index) sid.u.old id))
::
::  +session-bindings: the bindings that name .sid, by the index
::
++  session-bindings
  |=  [ledger=indexed:hh sid=session-id:h]
  ^-  (list [id=@t config=binding:hh])
  %+  murn  ~(tap in (~(get ju sessions.index.ledger) sid))
  |=  id=@t
  =/  config  (~(get by bindings.db.ledger) id)
  ?~(config ~ `[id u.config])
::
++  session-bound
  |=  [ledger=indexed:hh sid=session-id:h]
  ^-  ?
  ?=(^ (session-bindings ledger sid))
::
++  session-hand
  |=  [ledger=indexed:hh sid=session-id:h hand=@t]
  ^-  ?
  (lien (session-bindings ledger sid) |=([@t config=binding:hh] =(hand hand.config)))
::
++  session-enabled
  |=  [ledger=indexed:hh sid=session-id:h]
  ^-  ?
  (lien (session-bindings ledger sid) |=([@t config=binding:hh] enabled.config))
::
::  +apply-indexed: +apply, bringing the index up to date for the records
::  the action changed
::
++  apply-indexed
  |=  [ledger=indexed:hh action=action:hh now=@da]
  ^-  (each [ledger=indexed:hh result=json] @t)
  ?:  ?=(%outbox -.action)  [%& ledger (outbox-json ledger hand.action)]
  ?:  ?=(%publications -.action)
    [%& ledger (publications-json ledger hand.action after.action limit.action)]
  =/  applied  (apply db.ledger action now)
  ?:  ?=(%| -.applied)  applied
  =*  db  db.p.applied
  =/  changed=(list input-id:h)
    ?+  -.action  ~
      %observe  ~[(input-id binding.action event.action)]
      %notify  ~[(input-id binding.action event.action)]
      %claim  ~[effect.action]
      %receipt  ~[effect.action]
      %receipt-at  ~[effect.action]
      %retry  ~[effect.action]
      %resolve  ~[effect.action]
      %retire  (binding-ids db.ledger binding.action)
    ==
  =/  next=index:hh
    %+  roll  changed
    |=([id=input-id:h index=_index.ledger] (reckon index db id))
  =/  retired=(unit binding:hh)
    ?.  ?=(%retire -.action)  ~
    (~(get by bindings.db.ledger) binding.action)
  =?  recent.next  ?=(^ retired)
    =/  rows
      %+  murn  ~(tap by observations.db)
      |=  [id=input-id:h observation=observation:hh]
      ^-  (unit [at=@da id=input-id:h])
      =/  config  (~(get by bindings.db) binding.observation)
      ?.  &(?=(^ config) =(hand.u.retired hand.u.config))  ~
      `[at.observation id]
    ?~  rows  (~(del by recent.next) hand.u.retired)
    (~(put by recent.next) hand.u.retired (window rows))
  =/  touched=(unit @t)
    ?+  -.action  ~
      %bind  `id.action
      %register  `(cat 3 'hand--' (scot %ud (dec next-binding.db)))
      %remove  `id.action
      %retire  `binding.action
    ==
  =?  next  ?=(^ touched)  (enroll next db.ledger db u.touched)
  [%& [db next] result.p.applied]
::
++  start-indexed
  |=  [ledger=indexed:hh sid=session-id:h id=input-id:h]
  ^-  indexed:hh
  =/  db  (start db.ledger sid id)
  [db (reckon index.ledger db id)]
::
++  finish-indexed
  |=  [ledger=indexed:hh sid=session-id:h kind=?(%reply %failure %cancelled) body=@t]
  ^-  indexed:hh
  =/  id  (~(get by active.db.ledger) sid)
  =/  db  (finish db.ledger sid kind body)
  ?~  id  [db index.ledger]
  [db (reckon index.ledger db u.id)]
::
++  cancel-queued-indexed
  |=  [ledger=indexed:hh sid=session-id:h who=(unit @t)]
  ^-  indexed:hh
  =/  db  (cancel-queued db.ledger sid who)
  =/  waiting  (silt queue.db)
  :-  db
  %+  roll  queue.db.ledger
  |=  [id=input-id:h index=_index.ledger]
  ?:  (~(has in waiting) id)  index
  (reckon index db id)
::
++  detach-session-indexed
  |=  [ledger=indexed:hh sid=session-id:h now=@da]
  ^-  indexed:hh
  ::  The caller fences execution first. Keep delivery evidence, including
  ::  claimed or uncertain sends; only undispatched output can be abandoned.
  ?>  !(~(has by active.db.ledger) sid)
  =.  ledger  (cancel-queued-indexed ledger sid ~)
  =*  db  db.ledger
  =.  bindings.db
    %+  roll  (session-bindings ledger sid)
    |=  [[id=@t config=binding:hh] bindings=_bindings.db]
    (~(put by bindings) id config(enabled |))
  %+  roll  ~(tap in open.index.ledger)
  |=  [id=input-id:h next=_ledger]
  =/  publication  (~(get by outbox.db.next) id)
  ?~  publication  next
  ?.  &(=(sid sid.u.publication) =(%pending status.u.publication))  next
  =.  u.publication
    %=  u.publication
      status  %abandoned
      receipts  [[now %abandoned '' ''] receipts.u.publication]
    ==
  =/  control  (get-control db.next id)
  =.  control
    %=  control  resolutions
        :*  [now attempt.control %abandoned 'Conversation deleted before dispatch']
            resolutions.control
        ==
    ==
  =.  db.next
    %=  db.next
      outbox  (~(put by outbox.db.next) id u.publication)
      controls  (~(put by controls.db.next) id control)
    ==
  next(index (reckon index.next db.next id))
::
++  json-action
  |=  value=json
  ^-  action:hh
  =,  dejs:format
  =/  id  (cu |=(s=@t (need (slaw %uv s))) so)
  =/  binding  (ot ~[hand+so address+so ['sessionId' so] actors+(ar so) enabled+bo])
  %.  value
  %-  of
  :~  bind+(ot ~[id+so config+binding])
      register+(ot ~[config+binding])
      enable+(ot ~[id+so enabled+bo])
      remove+(ot ~[id+so])
      observe+(ot ~[binding+so event+so actor+so text+so])
      notify+(ot ~[binding+so event+so actor+so text+so])
      claim+(ot ~[hand+so effect+id worker+so])
      receipt+(ot ~[hand+so effect+id worker+so status+json-receipt-status external+so])
      :-  %receipt-at
      (ot ~[hand+so effect+id worker+so attempt+ni status+json-receipt-status external+so])
      :-  %resolve
      (ot ~[hand+so effect+id attempt+ni status+json-resolution-status external+so reason+so])
      retry+(ot ~[hand+so effect+id])
      status+(ot ~[binding+so])
      outbox+(ot ~[hand+so])
      publications+(ot ~[hand+so after+(mu id) limit+ni])
      effect+(ot ~[hand+so effect+id])
      health+(ot ~[hand+so])
      archive+(ot ~[binding+so])
      records+(ot ~[binding+so after+(mu id) limit+ni])
      retire+(ot ~[binding+so digest+id location+so])
  ==
::
++  json-resolution-status
  |=  value=json
  ^-  ?(%delivered %failed %uncertain %abandoned)
  =/  s  (so:dejs:format value)
  ?>  ?=(?(%delivered %failed %uncertain %abandoned) s)
  s
::
++  json-receipt-status
  |=  value=json
  ^-  ?(%delivered %failed %uncertain)
  =/  s  (so:dejs:format value)
  ?>  ?=(?(%delivered %failed %uncertain) s)
  s
::
++  json-request
  =,  dejs:format
  ^-  $-(json request:hh)
  (ot ~[id+so action+json-action])
--

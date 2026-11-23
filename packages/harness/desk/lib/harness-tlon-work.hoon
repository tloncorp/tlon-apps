::  Owner-visible work is a bounded projection of admission and delivery,
::  never a second queue. Reading this page cannot start or retry any work.
/-  t=harness-tlon, hh=harness-hand
/+  p=harness-tlon-policy, hd=harness-hand, hp=harness-tlon-history-page
|%
+$  row  [at=@da key=@uv value=json]
++  phase
  |=  [observation=observation:hh publication=(unit publication:hh)]
  ^-  @t
  ?^  publication
    ?-  status.u.publication
      %pending  'completed'
      %claimed  'sending'
      %delivered  'delivered'
      %failed  'send-failed'
      %uncertain  'uncertain'
      %abandoned  'abandoned'
    ==
  ?-  phase.observation
    %queued  'received'
    %running  'working'
    %completed  'completed'
    %failed  'failed'
    %cancelled  'cancelled'
  ==
++  earlier
  |=  [a=[at=@da key=@uv] b=[at=@da key=@uv]]
  |((lth at.a at.b) &(=(at.a at.b) (lth key.a key.b)))
++  page
  |=  [state=state-2:t ledger=state:hh before=@t]
  ^-  json
  |^
    =/  cursor=(unit [at=@da key=@uv])
      ?:  =('' before)  ~
      ?>  (lte (met 3 before) 256)
      =/  parsed  ;;([%1 at=@da key=@uv] (cue (slav %uv before)))
      ?>  &((lte (met 0 at.parsed) 128) (lte (met 0 key.parsed) 256))
      `[at.parsed key.parsed]
    =/  observations
      (murn ~(tap by observations.ledger) observation-row)
    =/  admissions
      (turn ~(tap by jobs.state) admission-row)
    =/  rows  (weld observations admissions)
    =.  rows  (sort rows |=([a=row b=row] (earlier [at.b key.b] [at.a key.a])))
    ::  Put pre-admission work first without fabricating a timestamp. A stable
    ::  sort key of the maximal timestamp keeps its cursor distinct from history.
    =?  rows  ?=(^ cursor)
      (skim rows |=(record=row (earlier [at.record key.record] u.cursor)))
    =/  selected  (scag 16 rows)
    =/  next=(unit @t)
      ?.  (gth (lent rows) 16)  ~
      =/  last  (rear selected)
      `(scot %uv (jam [%1 at.last key.last]))
    %-  pairs:enjs:format
    :~  ['records' %a (turn selected |=(record=row value.record))]
        ['next' ?~(next ~ [%s u.next])]
        ['limit' %n '16']
    ==
  ::
  ++  observation-row
    |=  [id=@uv observation=observation:hh]
    ^-  (unit row)
    =/  binding  (~(get by bindings.ledger) binding.observation)
    ?.  &(?=(^ binding) =('tlon' hand.u.binding))  ~
    =/  publication  (~(get by outbox.ledger) id)
    =/  route  (~(get by routes.state) sid.u.binding)
    =/  current
      ?&  ?=(^ route)
          enabled.policy.state
          enabled.u.binding
          =(%ready phase.u.route)
          =(binding.observation binding.u.route)
      ==
    :-  ~
    :*  at.observation  (sham [%input id])
        %-  pairs:enjs:format
        :~  ['kind' %s 'input']
            ['id' %s (scot %uv id)]
            ['at' %s (scot %da at.observation)]
            ['sessionId' %s sid.u.binding]
            ['binding' %s binding.observation]
            ['actor' %s actor.observation]
            ['destination' %s address.u.binding]
            ['text' %s (clip-text:hp text.observation 256)]
            ['reply' ?~(publication ~ [%s (clip-text:hp body.u.publication 512)])]
            ['status' %s (phase observation publication)]
            ['current' %b current]
            ['attempt' (numb:enjs:format attempt:(get-control:hd ledger id))]
            ['externalId' ?~(publication ~ [%s external.u.publication])]
            ['canRetry' %b ?~(publication | &(current =(%failed status.u.publication)))]
            ['canResolve' %b ?~(publication | !(terminal:hd status.u.publication))]
        ==
    ==
  ::
  ++  admission-row
    |=  [id=@uv job=job:t]
    ^-  row
    ::  Adapter jobs precede ledger admission. Their key and original text
    ::  remain available after an explicit setup/queue failure.
    :*  `@da`(dec (bex 128))  (sham [%admission id])
        %-  pairs:enjs:format
        :~  ['kind' %s 'admission']
            ['id' %s (scot %uv id)]
            ['sessionId' %s sid.job]
            ['actor' %s (scot %p actor.input.job)]
            ['destination' %s (address:p to.input.job)]
            ['text' %s (clip-text:hp text.input.job 256)]
            ['status' %s 'received']
            ['stage' %s stage.job]
            ['error' %s error.job]
            ['canRetry' %b &]
        ==
    ==
  --
--

::  verifier tests: xx
::
::    generally:
::    ~zod is the host,
::    ~nec is the primary user
::
/-  v=verifier
/+  *test-agent
::
/=  agent  /app/verifier
::
|%
++  dap  %verifier
+$  card  card:agent:gall
::
++  do-as  ::  temporary src.bowl
  |=  who=ship
  =/  m  (mare ,(list card))
  |=  do=form:m
  ^-  form:m
  ;<  pre=bowl:gall    bind:m  get-bowl
  ;<  ~                bind:m  (set-bowl pre(src who))
  ;<  cas=(list card)  bind:m  do
  ;<  ~                bind:m  (jab-bowl |=(b=bowl:gall b(src src.pre)))
  (pure:m cas)
::
++  ex-verifier-update
  |=  [for=@p upd=identifier-update:v]
  ::TODO  this is a bit weird, maybe.
  ::      want to test received sign against faux pubkey instead
  :: =?  upd  ?=([%status * %done *] upd)
  ::   :: ?>  ?=([%status * %done *] upd)
  ::   :: ~!  upd
  ::   =-  upd(sig.sign.status -)
  ::   (faux-sign [~zod id [when proof]:status]:upd)
  (ex-fact ~[/records/(scot %p for)] %verifier-update !>(upd))
::
++  branch
  =/  m  (mare ,~)
  |=  l=(list form:m)
  ^-  form:m
  =/  n=@ud  0
  |=  s=state
  |-  ^-  output:m
  ?~  l  [%& ~ s]
  =/  o  (i.l s)
  ?:  ?=(%& -.o)  $(l t.l, n +(n))
  [%| (cat 3 'failed in branch ' (scot %ud n)) p.o]
::
++  faux-life  1
++  faux-seed
  |=  for=@p
  ^-  seed:jael
  [for faux-life sec:ex:(pit:nu:crub:crypto 8 for) ~]
::
++  faux-sign
  |=  [host=@p id=identifier:v when=@da proof=(unit proof:v)]
  ^-  @ux
  =/  msg=@  (jam `signed-data-0:v`[%verified when id proof])
  (sign:as:(nol:nu:crub:crypto key:(faux-seed host)) msg)
::
++  faux-scry
  |=  =path
  ^-  (unit vase)
  ?+  path
      ~&([%faux-scry-miss path] ~)
    [%j @ %vile @ ~]  `!>((jam (faux-seed (slav %p i.t.path))))
  ==
::
++  user-does
  |=  [who=@p cmd=user-command:v]
  %-  (do-as who)
  (do-poke %verifier-user-command !>(cmd))
::
++  user-asks
  |=  [who=@p qer=user-query:v]
  %-  (do-as who)
  (do-poke %verifier-query !>(qer))
::
++  host-does
  |=  cmd=host-command:v
  (do-poke %verifier-host-command !>(cmd))
--
::
|%
++  test-dummy-request
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (set-scry-gate faux-scry)
  ;<  *  bind:m  (do-init dap agent)
  ;<  ~  bind:m  (wait ~d1)
  ::  user requests a dummy id, is told to wait for approval
  ::
  =/  id  [%dummy 'test']
  ;<  cas=(list card)  bind:m
    (user-does ~nec %start id)
  ;<  ~  bind:m
    (ex-cards cas (ex-verifier-update ~nec %status id %wait ~) ~)
  ::
  %-  branch
  |^  :~  host-approves
          host-rejects
      ==
  ::  host approves the request, id becomes registered
  ::
  ++  host-approves
    =/  sig=@ux
      (faux-sign ~zod id ~2000.1.2 ~)
    ;<  ~  bind:m
      (ex-scry-result /u/attestations/(scot %ux sig) !>(|))
    ;<  cas=(list card)  bind:m
      (host-does %dummy +.id %grant)
    ;<  ~  bind:m
      =/  =attestation:v
        [~2000.1.2 ~ [~zod 1 %0 sig]]
      ::TODO  don't test signature value, test whether it matches pubkey
      (ex-cards cas (ex-verifier-update ~nec %status id %done attestation) ~)
    ::TODO  check scry (not state, that's too direct for tests. should test api)
    ::      (right??)
    ;<  ~  bind:m
      (ex-scry-result /u/attestations/(scot %ux sig) !>(&))
    (pure:m ~)
  ::  host rejects the request, id gets freed up again
  ::
  ++  host-rejects
    ;<  cas=(list card)  bind:m
      (host-does %dummy +.id %reject)
    ;<  ~  bind:m
      (ex-cards cas (ex-verifier-update ~nec %status id %gone) ~)
    ::TODO  check that you can make another attempt?
    (pure:m ~)
  --
::
++  test-urbit-request
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (set-scry-gate faux-scry)
  ;<  *  bind:m  (do-init dap agent)
  ;<  ~  bind:m  (wait ~d1)
  ::  user requests an urbit id, is told to confirm from the other urbit
  ::
  =/  id  [%urbit ~bud]
  ;<  cas=(list card)  bind:m
    (user-does ~nec %start id)
  ;<  ~  bind:m
    (ex-cards cas (ex-verifier-update ~nec %status id %want %urbit 620.187) ~)
  ::
  %-  branch
  |^  :~  user-confirms
      ==
  ::  user confirms by registering the opposite too
  ::
  ++  user-confirms
    (pure:m ~)
    ::TODO  this was changed, update
    :: =/  di  [%urbit ~nec]
    :: =/  sig=@ux  (faux-sign ~zod id ~2000.1.2 ~)
    :: =/  gis=@ux  (faux-sign ~zod di ~2000.1.2 ~)
    :: ::  when the other side requests to bind the other direction,
    :: ::  complete registration for both
    :: ::
    :: ;<  cas=(list card)  bind:m
    ::   (user-does ~bud %start di)
    :: ;<  ~  bind:m
    ::   =/  at=attestation:v  [~2000.1.2 ~ [~zod 1 %0 sig]]
    ::   =/  ta=attestation:v  [~2000.1.2 ~ [~zod 1 %0 gis]]
    ::   ::TODO  don't test signature value, test whether it matches pubkey
    ::   %+  ex-cards  cas
    ::   :~  (ex-verifier-update ~nec %status id %done at)
    ::       (ex-verifier-update ~bud %status di %done ta)
    ::   ==
    :: ;<  ~  bind:m  (ex-scry-result /u/attestations/(scot %ux sig) !>(&))
    :: ;<  ~  bind:m  (ex-scry-result /u/attestations/(scot %ux gis) !>(&))
    :: ::TODO  other scries?
    :: (pure:m ~)
  --
::
++  test-duplicate
  %-  eval-mare
  =/  m  (mare ,~)
  ::
  =/  id=identifier:v  [%dummy 'test']
  ::
  ;<  *  bind:m  (do-init dap agent)
  =/  =state:v
    [(my [id *id-state:v] ~) (my [*@p (sy id ~)] ~) ~]
  ;<  *  bind:m  (do-load agent `!>([%0 state]))
  ::  attempting to register an already-registered id should nack
  ::
  ;<  ~  bind:m
    %-  ex-fail
    (user-does ~nec %start id)
  (pure:m ~)
::
++  state-from-records
  |=  records=(map identifier:v id-state:v)
  ^-  state:v
  :-  records
  %+  roll  ~(tap by records)
  |=  $:  [id=identifier:v id-state:v]
          [owners=(jug ship identifier:v) attested=(map @ux identifier:v)]
      ==
  ?.  ?=(%done -.status)  [owners attested]
  :-  (~(put ju owners) for id)
  (~(put by attested) sig.sign.status id)
::
++  query-setup
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  =/  =state:v
    %-  state-from-records
    %-  ~(gas by *(map identifier:v id-state:v))
    :~  =/  id=identifier:v  [%dummy 'test-id']
        =/  wen=@da  ~2222.2.2
        [id ~nec %done wen ~ ~zod faux-life %0 (faux-sign ~zod id wen ~)]
    ==
  ;<  *  bind:m  (do-load agent `!>([%0 state]))
  (pure:m ~)
::
++  expect-query-response
  |=  [who=@p qer=user-query:v res=_+:*query-result:v]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  caz=(list card)  bind:m  (user-asks who qer)
  =-  (ex-cards caz - ~)
  (ex-poke /query/result [who dude.qer] %verifier-result !>([nonce.qer res]))
::
++  test-query-has-any
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  query-setup
  ;<  ~  bind:m
    %^  expect-query-response  ~fed
      [[%some-dude %my-nonce] %has-any ~nec %dummy]
    [%has-any &]
  ;<  ~  bind:m
    %^  expect-query-response  ~fed
      [[%my-dude %some-nonce] %has-any ~nec %urbit]
    [%has-any |]
  (pure:m ~)
::
++  test-query-valid
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  query-setup
  ;<  ~  bind:m
    %^  expect-query-response  ~fed
      [[%some-dude %my-nonce] %valid (faux-sign ~zod [%dummy 'test-id'] ~2222.2.2 ~)]
    [%valid &]
  ;<  ~  bind:m
    %^  expect-query-response  ~fed
      [[%my-dude %some-nonce] %valid 0xdead.beef]
    [%valid |]
  (pure:m ~)
::
++  test-query-whose
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  query-setup
  ;<  ~  bind:m
    %^  expect-query-response  ~fed
      [[%some-dude %my-nonce] %whose %dummy 'test-id']
    [%whose `~nec]
  ;<  ~  bind:m
    %^  expect-query-response  ~fed
      [[%my-dude %some-nonce] %whose %dummy 'not-in-use']
    [%whose ~]
  (pure:m ~)
::
::TODO  test that timeout timers get set & fire when waiting on user action
::TODO  test watch permissions on /records/~nec
::TODO  test initial /records response
::TODO  test revocation command
--

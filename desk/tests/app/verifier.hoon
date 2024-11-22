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
++  ex-verifier-update
  =/  initial=?  |
  |=  [for=@p upd=identifier-update:v]
  ::TODO  this is a bit weird, maybe.
  ::      want to test received sign against faux pubkey instead
  :: =?  upd  ?=([%status * %done *] upd)
  ::   :: ?>  ?=([%status * %done *] upd)
  ::   :: ~!  upd
  ::   =-  upd(sig.sign.status -)
  ::   (faux-sign [~zod id [when proof]:status]:upd)
  =/  paths=(list path)
    ?:(initial ~ ~[/records/(scot %p for)])
  (ex-fact paths %verifier-update !>(upd))
::
++  branch
  =/  m  (mare ,~)
  |=  l=(list [t=@t f=form:m])  ::NOTE  can't seem to use $^ here
  ^-  form:m
  =/  e=tang  ~
  |=  s=state
  |-  ^-  output:m
  ?~  l
    ?.  =(~ e)  [%| e]
    [%& ~ s]
  =/  o  (f.i.l s)
  =?  e  ?=(%| -.o)
    =-  (weld e `tang`-)
    [(rap 3 'failed in branch ' t.i.l ':' ~) p.o]
  $(l t.l)
::
++  faux-life  1
++  faux-seed
  |=  for=@p
  ^-  seed:jael
  [for faux-life sec:ex:(pit:nu:crub:crypto 8 for) ~]
::
++  faux-sign
  |=  [host=@p for=@p id=identifier:v when=@da proof=(unit proof:v)]
  ^-  @ux
  =/  msg=@  (jam `signed-data-0:v`[%verified when for id proof])
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
++  make-attestation
  |=  [for=@p id=identifier:v proof=(unit proof:v)]
  =/  m  (mare ,attestation:v)
  ;<  bowl:gall  bind:m  get-bowl
  =/  sig=@ux
    (faux-sign our for id now proof)
  (pure:m now ~ [our faux-life %0 sig])
::
++  get-state
  =/  m  (mare state:v)
  ;<  =vase  bind:m  get-save
  =+  !<([[%negotiate *] =^vase] vase)
  =+  !<([%0 =state:v] vase)
  (pure:m state)
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
++  do-setup
  =/  m  (mare ,~)
  ;<  ~  bind:m  (set-scry-gate faux-scry)
  ;<  *  bind:m  (do-init dap agent)
  (pure:m ~)
::
::  action tests
::
++  test-dummy-request
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  do-setup
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
  |^  :~  'host approves'^host-approves
          'host rejects'^host-rejects
      ==
  ::  host approves the request, id becomes registered
  ::
  ++  host-approves
    ;<  at=attestation:v  bind:m  (make-attestation ~nec id ~)
    ;<  ~  bind:m
      (ex-scry-result /u/attestations/(scot %ux sig.sign.at) !>(|))
    ;<  cas=(list card)  bind:m
      (host-does %dummy +.id %grant)
    ;<  ~  bind:m
      ::TODO  don't test signature value, test whether it matches pubkey
      (ex-cards cas (ex-verifier-update ~nec %status id %done at) ~)
    ::TODO  check scry (not state, that's too direct for tests. should test api)
    ::      (right??)
    ;<  ~  bind:m
      (ex-scry-result /u/attestations/(scot %ux sig.sign.at) !>(&))
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
  ;<  ~  bind:m  do-setup
  ;<  ~  bind:m  (wait ~d1)
  =/  id  [%urbit ~bud]
  ::  registration hasn't started yet, so trying to confirm should crash
  ::
  ;<  ~  bind:m
    (ex-fail (user-does ~bud %work id %urbit 620.187))
  ::  user requests an urbit id, is told to confirm from the other urbit
  ::
  ;<  cas=(list card)  bind:m
    (user-does ~nec %start id)
  ;<  ~  bind:m
    (ex-cards cas (ex-verifier-update ~nec %status id %want %urbit 620.187) ~)
  ::
  %-  branch
  |^  :~  'confirm correct'^confirm-correct
          'confirm incorrect'^confirm-incorrect
          'confirm unrelated'^confirm-unrelated
      ==
  ::  user confirms by giving the pin from the other ship
  ::
  ++  confirm-correct
    ;<  cas=(list card)  bind:m
      (user-does ~bud %work id %urbit 620.187)
    ;<  at=attestation:v  bind:m  (make-attestation ~nec id ~)
    ;<  ~  bind:m
      ::TODO  don't test signature value, test whether it matches pubkey
      %+  ex-cards  cas
      [(ex-verifier-update ~nec %status id %done at)]~
    ;<  ~  bind:m  (ex-scry-result /u/attestations/(scot %ux sig.sign.at) !>(&))
    ;<  ~  bind:m
      ::TODO  test via scries instead?
      ;<  =state:v  bind:m  get-state
      %-  branch
      :~  'rec'^(ex-equal !>((~(get by records.state) id)) !>(`[~nec *config:v %done at]))
          'own'^(ex-equal !>((~(get ju owners.state) ~nec)) !>([id ~ ~]))
          'att'^(ex-equal !>((~(get by attested.state) sig.sign.at)) !>(`id))
      ==
    (pure:m ~)
  ::
  ++  confirm-incorrect
    %-  ex-fail  ::TODO  should cancel, or re-set the pin
    (user-does ~bud %work id %urbit 111.111)
  ::
  ++  confirm-unrelated
    %-  ex-fail
    (user-does ~fed %work id %urbit 620.187)
  --
::
++  do-setup-with-id
  |=  id=identifier:v
  =/  m  (mare ,~)
  ;<  *  bind:m  do-setup
  =/  =state:v
    :*  records=(my [id ~nec *config:v %done *attestation:v] ~)
        owners=(my [~nec (sy id ~)] ~)
        attested=(my [*@ux id] ~)
    ==
  ;<  *  bind:m  (do-load agent `!>([%0 state]))
  (pure:m ~)
::
++  test-duplicate
  %-  eval-mare
  =/  m  (mare ,~)
  =/  id=identifier:v  [%dummy 'test']
  ;<  *  bind:m  (do-setup-with-id id)
  ::  attempting to register an already-registered id should nack
  ::
  ;<  ~  bind:m
    %-  ex-fail
    (user-does ~fed %start id)
  (pure:m ~)
::
++  test-config
  %-  eval-mare
  =/  m  (mare ,~)
  =/  id=identifier:v  [%dummy 'test']
  ;<  *  bind:m  (do-setup-with-id id)
  ::  can't config if it's not yours
  ::
  ;<  ~  bind:m  (ex-fail (user-does ~fed %config id %public))
  ::  setting config should emit a fact
  ::
  ;<  cas=(list card)  bind:m
    (user-does ~nec %config id %public)
  ;<  ~  bind:m
    %+  ex-cards  cas
    [(ex-verifier-update ~nec %config id %public)]~
  (pure:m ~)
::
++  test-revoke
  %-  eval-mare
  =/  m  (mare ,~)
  =/  id=identifier:v  [%dummy 'test']
  ;<  *  bind:m  (do-setup-with-id id)
  ::  can't revoke if it's not yours
  ::
  ;<  ~  bind:m  (ex-fail (user-does ~fed %revoke id))
  ::  revoking removes it from state, sends an update
  ::
  ;<  cas=(list card)  bind:m  (user-does ~nec %revoke id)
  ;<  ~  bind:m
    %+  ex-cards  cas
    [(ex-verifier-update ~nec %status id %gone)]~
  ;<  ~  bind:m
    ::TODO  test via scries instead?
    ;<  =state:v  bind:m  get-state
    %-  branch
    :~  'rec'^(ex-equal !>((~(get by records.state) id)) !>(~))
        'own'^(ex-equal !>((~(get ju owners.state) ~nec)) !>(~))
    ==
  (pure:m ~)
::
++  test-revoke-perms
  %-  eval-mare
  =/  m  (mare ,~)
  =/  id=identifier:v  [%dummy 'test']
  ;<  *  bind:m  (do-setup-with-id id)
  ::  can't revoke if it's not yours
  ::
  (ex-fail (user-does ~fed %revoke id))
::
::  subscription tests
::
++  test-watch-records
  %-  eval-mare
  =/  m  (mare ,~)
  =/  id=identifier:v  [%dummy 'test']
  ;<  ~  bind:m  (do-setup-with-id id)
  ;<  cas=(list card)  bind:m
    ((do-as ~nec) (do-watch /records/~nec))
  %+  ex-cards  cas
  :~  (%*(. ex-verifier-update initial &) ~nec %full [[id *config:v %done *attestation:v] ~ ~])
  ==
::
++  test-watch-records-perms
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  do-setup
  (ex-fail (do-watch /records/~nec))
::
::  query tests
::
++  state-from-records
  |=  records=(map identifier:v record:v)
  ^-  state:v
  :-  records
  %+  roll  ~(tap by records)
  |=  $:  [id=identifier:v record:v]
          [owners=(jug ship identifier:v) attested=(map @ux identifier:v)]
      ==
  ?.  ?=(%done -.status)  [owners attested]
  :-  (~(put ju owners) for id)
  (~(put by attested) sig.sign.status id)
::
++  do-query-setup
  =/  m  (mare ,~)
  ;<  ~  bind:m  do-setup
  =/  =state:v
    %-  state-from-records
    %-  ~(gas by *(map identifier:v record:v))
    :~  =/  id=identifier:v  [%dummy 'test-id']
        =/  wen=@da  ~2222.2.2
        ::TODO  mb use +make-attestation instead
        [id ~nec %hidden %done wen ~ ~zod faux-life %0 (faux-sign ~zod ~nec id wen ~)]
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
  ;<  ~  bind:m  do-query-setup
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
  ;<  ~  bind:m  do-query-setup
  ;<  ~  bind:m
    %^  expect-query-response  ~fed
      [[%some-dude %my-nonce] %valid (faux-sign ~zod ~nec [%dummy 'test-id'] ~2222.2.2 ~)]
    [%valid &]
  ;<  ~  bind:m
    %^  expect-query-response  ~fed
      [[%my-dude %some-nonce] %valid 0xdead.beef]
    [%valid |]
  (pure:m ~)
::
++  test-query-whose  ::  with respect for different configs
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  do-query-setup
  =/  id=identifier:v  [%dummy 'test-id']
  ::  discoverability config %hidden
  ::
  ;<  ~  bind:m
    %^  expect-query-response  ~fed
      [[%some-dude %my-nonce] %whose id]
    [%whose ~]
  ::  discoverability config %public
  ::
  ;<  *  bind:m
    (user-does ~nec %config id %public)
  ;<  ~  bind:m
    %^  expect-query-response  ~fed
      [[%some-dude %my-nonce] %whose id]
    [%whose `~nec]
  ::  discoverability config %verified
  ::
  ;<  *  bind:m
    (user-does ~nec %config id %verified)
  ;<  ~  bind:m
    %^  expect-query-response  ~fed
      [[%some-dude %my-nonce] %whose id]
    [%whose ~]
  ;<  *  bind:m  ::  ~fed registers a %dummy id of its own
    ;<  *  bind:m  (user-does ~fed %start %dummy 'FED')
    ;<  *  bind:m  (host-does %dummy 'FED' %grant)
    (pure:m ~)
  ;<  ~  bind:m
    %^  expect-query-response  ~fed
      [[%some-dude %my-nonce] %whose id]
    [%whose `~nec]
  ::  discoverability of non-existing
  ::
  ;<  ~  bind:m
    %^  expect-query-response  ~fed
      [[%my-dude %some-nonce] %whose %dummy 'not-in-use']
    [%whose ~]
  (pure:m ~)
::
::TODO  test that timeout timers get set & fire when waiting on user action
::
::TODO  test lanyard:
::TODO  test resubscribe on poke nack
::TODO  test %full handling
--

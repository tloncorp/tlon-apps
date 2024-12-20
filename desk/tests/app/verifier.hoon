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
++  phone-api-base   'https://phone.api/base'
++  phone-api-key    'api-key'
++  attempt-timeout  ~h1
::
++  ex-verifier-update
  =/  initial=?  |
  |=  [for=@p upd=update:v]
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
++  ex-http-request
  =/  config=outbound-config:iris
    %*(. *outbound-config:iris retries 0)
  |=  [=wire req=request:http]
  (ex-card %pass wire %arvo %i %request req config)
::
++  ex-phone-api-req
  |=  [=wire =method:http path=@t body=(unit @t)]
  %+  ex-http-request  wire
  =/  hes=header-list:http
    :~  ['content-type' 'application/json']
        ['x-vnd-apikey' phone-api-key]
    ==
  [method (cat 3 phone-api-base path) hes (bind body as-octs:mimes:html)]
::
++  do-http-response
  |=  [=wire hed=response-header:http fil=(unit mime-data:iris)]
  (do-arvo wire %iris %http-response %finished hed fil)
::
++  do-phone-api-res
  |=  [=wire code=@ud body=(unit @t)]
  %+  do-http-response  wire
  :-  [code ~]
  (bind body (cork as-octs:mimes:html (lead 'application/json')))
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
    [(rap 3 'failed in branch \'' t.i.l '\':' ~) p.o]
  $(l t.l)
::
++  merge  ::  branch with shared, cached continuation
  |*  a=mold  ::  arg for constructing continuation, comes out of branches
  =/  w  (mare a)
  =/  m  (mare ,~)
  |=  [l=(list [t=@t f=form:w]) n=$-(a form:m)]
  ^-  form:m
  =|  err=tang
  =|  per=(map tang @t)
  =|  cac=(map @ output:m)
  |=  sat=state
  |-  ^-  output:m
  ?~  l
    ?.  =(~ err)  [%| err]
    [%& ~ sat]
  =^  res=output:m  cac
    ::  the below is essentially (((bind:m a) f.i.l n) sat)
    ::  but with the n invocation cached
    ::
    =/  wes=output:w  (f.i.l sat)
    ?:  ?=(%| -.wes)  [wes cac]
    ?^  hit=(~(get by cac) (mug p.wes))
      [u.hit cac]
    =/  res=output:m  ((n out.p.wes) state.p.wes)
    [res (~(put by cac) (mug p.wes) res)]
  ::  when printing fail traces, if a previous branch had an identical failure,
  ::  just print a reference to that for brevity
  ::
  =?  err  ?=(%| -.res)
    =-  (weld err `tang`-)
    :-  (rap 3 'failed in merge branch \'' t.i.l '\':' ~)
    ?~  pev=(~(get by per) p.res)  p.res
    [(rap 3 '[same as in merge branch \'' u.pev '\']' ~)]~
  =?  per  &(?=(%| -.res) !(~(has by per) p.res))
    (~(put by per) p.res t.i.l)
  $(l t.l)
::
++  faux-life  1
++  faux-seed
  |=  for=@p
  ^-  seed:jael
  [for faux-life sec:ex:(pit:nu:crub:crypto 8 for) ~]
::
++  faux-sign
  |*  [host=@p dat=*]
  ^-  (urbit-signature:v _dat)
  =/  sig=@ux  (sigh:as:(nol:nu:crub:crypto key:(faux-seed host)) (jam dat))
  [host faux-life dat sig]
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
  %-  pure:m
  :+  now  ~
  :-  (faux-sign our `half-sign-data-0:v`[%0 %verified now for -.id])
  (faux-sign our `full-sign-data-0:v`[%0 %verified now for id proof])
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
    %+  ex-cards  cas
    :~  (ex-verifier-update ~nec %status id %wait ~)
      ::
        %+  ex-arvo  /expire/dummy/(scot %t 'test')/(scot %da ~2000.1.2)
        [%b %wait (add ~2000.1.2 attempt-timeout)]
    ==
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
      (ex-scry-result /u/attestations/(scot %ux sig.full-sign.at) !>(|))
    ;<  cas=(list card)  bind:m
      (host-does %dummy +.id %grant)
    ;<  ~  bind:m
      ::TODO  don't test signature value, test whether it matches pubkey
      (ex-cards cas (ex-verifier-update ~nec %status id %done at) ~)
    ::TODO  check scry (not state, that's too direct for tests. should test api)
    ::      (right??)
    ;<  ~  bind:m
      (ex-scry-result /u/attestations/(scot %ux sig.full-sign.at) !>(&))
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
    %+  ex-cards  cas
    :~  (ex-verifier-update ~nec %status id %want %urbit 620.187)
      ::
        %+  ex-arvo  /expire/urbit/(scot %p ~bud)/(scot %da ~2000.1.2)
        [%b %wait (add ~2000.1.2 attempt-timeout)]
    ==
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
    ;<  ~  bind:m  (ex-scry-result /u/attestations/(scot %ux sig.full-sign.at) !>(&))
    ;<  ~  bind:m
      ::TODO  test via scries instead?
      ;<  =state:v  bind:m  get-state
      %-  branch
      :~  'rec'^(ex-equal !>((~(get by records.state) id)) !>(`[~nec ~2000.1.2 *config:v %done at]))
          'own'^(ex-equal !>((~(get ju owners.state) ~nec)) !>([id ~ ~]))
          'ath'^(ex-equal !>((~(get by attested.state) sig.half-sign.at)) !>(`id))
          'atf'^(ex-equal !>((~(get by attested.state) sig.full-sign.at)) !>(`id))
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
++  test-phone-request
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  do-setup
  ;<  ~  bind:m  (wait ~d1)
  ::
  ;<  ~  bind:m
    %-  ex-fail
    %-  (do-as ~nec)
    (do-poke %noun !>([%set-phone-api phone-api-base phone-api-key ~]))
  ;<  caz=(list card)  bind:m
    (do-poke %noun !>([%set-phone-api phone-api-base phone-api-key ~]))
  ;<  ~  bind:m  (ex-cards caz ~)
  ::
  =/  nr=@t             '+123456789'
  =/  id=identifier:v   [%phone nr]
  =/  wir=wire          /id/phone/(scot %t nr)
  ::  user requests a phone nr, is told to wait for the service,
  ::  and service does a status request
  ::
  ;<  caz=(list card)  bind:m
    (user-does ~nec %start id)
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-verifier-update ~nec %status id %wait ~)
      ::
        %+  ex-arvo  /expire/phone/(scot %t nr)/(scot %da ~2000.1.2)
        [%b %wait (add ~2000.1.2 attempt-timeout)]
      ::
        %+  ex-phone-api-req  (snoc wir %status)
        [%'POST' '/status' `'{"phoneNumber":"+123456789","ship":"~nec"}']
    ==
  ::
  |^  %-  branch
      :~  'status bad'^status-bad
          'status verified'^status-verified
          'status unverified'^status-unverified
      ==
  ++  status-bad
    %+  (merge (list card))
      :~  :-  '400 response'
          %+  do-phone-api-res  (snoc wir %status)
          [400 `'{"message":"Forbidden"}']
        ::
          :-  'bad json'
          %+  do-phone-api-res  (snoc wir %status)
          [200 `'"bad json"']
      ==
    rejected  ::TODO  and log report sent
  ::
  ++  status-verified
    %+  (merge (list card))
      :~  :-  'status a'
          %+  do-phone-api-res  (snoc wir %status)
          [200 `'{"known":true,"verified":true,"matchingShip":true}']
        ::
          :-  'status b'  ::NOTE  shouldn't happen
          %+  do-phone-api-res  (snoc wir %status)
          [200 `'{"known":false,"verified":true,"matchingShip":true}']
      ==
    registered
  ::
  ++  status-unverified
    %+  (merge (list card))
      ::  all of the below should be treated as unverified phone nrs
      ::
      ::TODO  test without matchingship in the known:false cases
      :~  :-  'status a'
          %+  do-phone-api-res  (snoc wir %status)
          [200 `'{"known":true,"verified":false,"matchingShip":true}']
        ::
          :-  'status b'
          %+  do-phone-api-res  (snoc wir %status)
          [200 `'{"known":true,"verified":true,"matchingShip":false}']
        ::
          :-  'status c'
          %+  do-phone-api-res  (snoc wir %status)
          [200 `'{"known":false,"verified":false}']
        ::
          :-  'status d'  ::NOTE  shouldn't happen
          %+  do-phone-api-res  (snoc wir %status)
          [200 `'{"known":false,"verified":false,"matchingShip":true}']
        ::
          :-  'status e'  ::NOTE  shouldn't happen
          %+  do-phone-api-res  (snoc wir %status)
          [200 `'{"known":false,"verified":true,"matchingShip":false}']
        ::
          :-  'status f'
          %+  do-phone-api-res  (snoc wir %status)
          [200 `'{"known":true,"verified":false,"matchingShip":false}']
      ==
    |=  caz=(list card)
    ;<  ~  bind:m
      %+  ex-cards  caz
      :_  ~
      %+  ex-phone-api-req  (snoc wir %verify)
      [%'POST' '/verify' `'{"phoneNumber":"+123456789"}']
    ::
    |^  (branch 'start verify fail'^verify-fail 'start verify ok'^verify-ok ~)
    ++  verify-fail
      ;<  caz=(list card)  bind:m
        %+  do-phone-api-res  (snoc wir %verify)
        [400 `'{"message":,"Forbidden"}']
      (rejected caz)
    ::
    ++  verify-ok
      ;<  caz=(list card)  bind:m
        (do-phone-api-res (snoc wir %verify) [200 ~])
      ;<  ~  bind:m
        (ex-cards caz (ex-verifier-update ~nec %status id %want %phone %otp) ~)
      ::  user submits the otp code they received
      ::
      ;<  caz=(list card)  bind:m
        (user-does ~nec %work id %phone '333777')
      ;<  ~  bind:m
        %+  ex-cards  caz
        :~  (ex-verifier-update ~nec %status id %wait ~)
          ::
            %+  ex-phone-api-req  (snoc wir %submit)
            [%'PATCH' '/verify' `'{"otp":"333777","phoneNumber":"+123456789"}']
        ==
      ::
      |^  (branch 'otp bad'^otp-bad 'otp good'^otp-good ~)
      ++  otp-bad
        ::  if the otp code is wrong, should update status to ask for a retry
        ::
        ;<  caz=(list card)  bind:m
          %+  do-phone-api-res  (snoc wir %submit)
          [400 `'{"message":"Invalid or expired OTP."}']
        (ex-cards caz (ex-verifier-update ~nec %status id %want %phone %otp) ~)
        ::TODO  limit failed attempts? time registration attempt out after a while?
      ::
      ++  otp-good
        ::TODO  also test good after initial failed attempt?
        ;<  caz=(list card)  bind:m
          (do-phone-api-res (snoc wir %submit) [200 ~])
        (registered caz)
      --
    --
  ::
  ++  rejected
    |=  caz=(list card)
    ;<  ~  bind:m
      %+  ex-cards  caz
      [(ex-verifier-update ~nec %status id %gone)]~
    ::TODO  test via scries instead?
    ;<  =state:v  bind:m  get-state
    %-  branch
    :~  'rec'^(ex-equal !>((~(get by records.state) id)) !>(~))
        'own'^(ex-equal !>((~(get ju owners.state) ~nec)) !>(~))
    ==
  ::
  ++  registered
    |=  caz=(list card)
    ;<  at=attestation:v  bind:m  (make-attestation ~nec id ~)
    ;<  ~  bind:m
      ::TODO  don't test signature value, test whether it matches pubkey
      %+  ex-cards  caz
      [(ex-verifier-update ~nec %status id %done at)]~
    ::TODO  test via scries instead?
    ;<  =state:v  bind:m  get-state
    %-  branch
    :~  'rec'^(ex-equal !>((~(get by records.state) id)) !>(`[~nec ~2000.1.2 *config:v %done at]))
        'own'^(ex-equal !>((~(get ju owners.state) ~nec)) !>([id ~ ~]))
        'ath'^(ex-equal !>((~(get by attested.state) sig.half-sign.at)) !>(`id))
        'atf'^(ex-equal !>((~(get by attested.state) sig.full-sign.at)) !>(`id))
    ==
  --
::
++  do-setup-with-id
  =/  =status:v  [%done *attestation:v]
  |=  id=identifier:v
  =/  m  (mare ,~)
  ;<  *  bind:m  do-setup
  =/  =state:v
    :*  records=(my [id ~nec ~2000.1.2 *config:v status] ~)
        owners=?:(?=(%done -.status) (my [~nec (sy id ~)] ~) ~)
        attested=(my [*@ux id] ~)
        limits=~
        phone-api=['https://phone.api/base' 'api-key' ~]
        domain=`'http://sampel.net'
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
++  test-expire-unfinished
  %-  eval-mare
  =/  m  (mare ,~)
  =/  id=identifier:v  [%phone '+123456789']
  ;<  *  bind:m  (%*(. do-setup-with-id status [%want %phone %otp]) id)
  ::  should delete state if the registration never finished
  ::
  ;<  caz=(list card)  bind:m
    (do-arvo /expire/[-.id]/(scot %t +.id)/(scot %da ~2000.1.2) %behn %wake ~)
  ;<  ~  bind:m
    %+  ex-cards  caz
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
++  test-expire-unfinished-stale
  %-  eval-mare
  =/  m  (mare ,~)
  =/  id=identifier:v  [%phone '+123456789']
  ;<  *  bind:m  (%*(. do-setup-with-id status [%want %phone %otp]) id)
  ::  should delete state if the registration never finished
  ::
  ;<  caz=(list card)  bind:m
    (do-arvo /expire/phone/(scot %t +.id)/(scot %da ~2000.1.1) %behn %wake ~)
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  ~  bind:m
    ::TODO  test via scries instead?
    ;<  =state:v  bind:m  get-state
    (ex-equal !>((~(has by records.state) id)) !>(&))
  (pure:m ~)
::
++  test-expire-done
  %-  eval-mare
  =/  m  (mare ,~)
  =/  id=identifier:v  [%dummy 'test']
  ;<  *  bind:m  (do-setup-with-id id)
  ::  should _not_ delete state if the registration did finish
  ::
  ;<  caz=(list card)  bind:m
    (do-arvo /expire/dummy/(scot %t 'test')/(scot %da ~2000.1.2) %behn %wake ~)
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  ~  bind:m
    ::TODO  test via scries instead?
    ;<  =state:v  bind:m  get-state
    %-  branch
    :~  'rec'^(ex-equal !>((~(has by records.state) id)) !>(&))
        'own'^(ex-equal !>((~(has ju owners.state) ~nec id)) !>(&))
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
  =<  [owners attested ~ ['' '' ~] ~]
  %+  roll  ~(tap by records)
  |=  $:  [id=identifier:v record:v]
          [owners=(jug ship identifier:v) attested=(map @ux identifier:v)]
      ==
  ?.  ?=(%done -.status)  [owners attested]
  :-  (~(put ju owners) for id)
  (~(gas by attested) sig.half-sign.status^id sig.full-sign.status^id ~)
::
++  do-query-setup
  =/  m  (mare ,~)
  ;<  ~  bind:m  do-setup
  =/  id=identifier:v  [%dummy 'test-id']
  =/  wen=@da  ~2222.2.2
  ;<  ~  bind:m  (jab-bowl |=(b=bowl:gall b(now wen)))
  ;<  at=attestation:v  bind:m  (make-attestation ~nec id ~)
  =/  =state:v
    %-  state-from-records
    %-  ~(gas by *(map identifier:v record:v))
    :~  [id ~nec wen %hidden %done at]
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
      :+  [%some-dude %my-nonce]
        %valid
      sig:(faux-sign ~zod `full-sign-data-0:v`[%0 %verified ~2222.2.2 ~nec [%dummy 'test-id'] ~])
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

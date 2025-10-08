::  verifier tests: xx
::
::    generally:
::    ~zod is the host,
::    ~nec is the primary user
::
/-  verifier
/+  *test-agent
::
/=  agent  /app/verifier
::
|%
++  v  (verifier)
++  dap  %verifier
+$  card  card:agent:gall
::
++  phone-api-base      'https://phone.api/base'
++  phone-api-key       'api-key'
++  twitter-api-bearer  'someBearerToken'
++  attempt-timeout     ~h1
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
++  faux-deed
  |=  for=@p
  ^-  [=life =pass sig=(unit @)]
  [faux-life pub:ex:(pit:nu:crub:crypto 8 for) ~]
::
++  faux-sign
  |*  [host=@p dat=*]
  ^-  (signed:v _dat)
  =/  sig=@ux  (sigh:as:(nol:nu:crub:crypto key:(faux-seed host)) (jam dat))
  [host faux-life dat sig]
::
++  faux-scry
  |=  =path
  ^-  (unit vase)
  ?+  path
      ~&([%faux-scry-miss path] ~)
    [%j @ %vile @ ~]      `!>((jam (faux-seed (slav %p i.t.path))))
    [%j @ %lyfe @ @ ~]    `!>((some faux-life))
    [%j @ %deed @ @ @ ~]  `!>((faux-deed (slav %p i.t.t.t.t.path)))  ::NOTE  static life
  ==
::
++  make-attestation
  |=  [for=@p id=identifier:v proof=(unit proof:v)]
  =/  m  (mare ,attestation:v)
  ;<  bowl:gall  bind:m  get-bowl
  %-  pure:m
  :-  (faux-sign our `half-sign-data:v`[%0 %verified %half now for -.id])
  (faux-sign our `full-sign-data:v`[%0 %verified %full now for id proof])
::
++  get-state
  =/  m  (mare state:v)
  ;<  =vase  bind:m  get-save
  =+  !<([[%negotiate *] =^vase] vase)
  =+  !<([%1 =state:v] vase)
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
  (do-poke %verifier-user-query !>(qer))
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
  ;<  *  bind:m  (do-poke %noun !>([%set-phone-api 'xx' 'xx' ~]))
  ;<  *  bind:m  (do-poke %noun !>([%set-twitter-api 'xx']))
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
    :~  (ex-verifier-update ~nec %status id 'awaiting manual approval' %wait ~)
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
      (ex-scry-result /u/attestations/(scot %ux sig.full.at) !>(|))
    ;<  cas=(list card)  bind:m
      (host-does %dummy +.id %grant)
    ;<  ~  bind:m
      ::TODO  don't test signature value, test whether it matches pubkey
      (ex-cards cas (ex-verifier-update ~nec %status id 'registration completed' %done at) ~)
    ::TODO  check scry (not state, that's too direct for tests. should test api)
    ::      (right??)
    ;<  ~  bind:m
      (ex-scry-result /u/attestations/(scot %ux sig.full.at) !>(&))
    (pure:m ~)
  ::  host rejects the request, id gets freed up again
  ::
  ++  host-rejects
    ;<  cas=(list card)  bind:m
      (host-does %dummy +.id %reject)
    ;<  ~  bind:m
      (ex-cards cas (ex-verifier-update ~nec %status id 'revoked' %gone ~) ~)
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
  =/  nonce=@ux              0x5266.a39d
  =/  dat=sign-data:urbit:v  [%urbit %0 ~nec nonce]
  =/  sig=payload:urbit:v    (faux-sign ~bud dat)
  ::  registration hasn't started yet, so trying to confirm should crash
  ::
  ;<  ~  bind:m
    (ex-fail (user-does ~bud %work id %urbit sig))
  ::  user requests an urbit id, is told to confirm from the other urbit
  ::
  ;<  cas=(list card)  bind:m
    (user-does ~nec %start id)
  ;<  ~  bind:m
    %+  ex-cards  cas
    :~  (ex-verifier-update ~nec %status id 'prove ownership' %want %urbit nonce)
      ::
        %+  ex-arvo  /expire/urbit/(scot %p ~bud)/(scot %da ~2000.1.2)
        [%b %wait (add ~2000.1.2 attempt-timeout)]
    ==
  ::
  %-  branch
  |^  :~  'submit correct'^submit-correct
          'submit bad signature'^submit-bad-signature
          'submit bad target'^submit-bad-target
          'submit by unrelated'^submit-by-unrelated
      ==
  ::  user submits a signature from the other ship
  ::
  ++  submit-correct
    ;<  cas=(list card)  bind:m
      (user-does ~bud %work id %urbit sig)
    ;<  at=attestation:v  bind:m  (make-attestation ~nec id `[%urbit sig])
    ;<  ~  bind:m
      ::TODO  don't test signature value, test whether it matches pubkey
      %+  ex-cards  cas
      [(ex-verifier-update ~nec %status id 'registration completed' %done at)]~
    ;<  ~  bind:m  (ex-scry-result /u/attestations/(scot %ux sig.full.at) !>(&))
    ;<  ~  bind:m
      ::TODO  test via scries instead?
      ;<  =state:v  bind:m  get-state
      %-  branch
      :~  'rec'^(ex-equal !>((~(get by records.state) id)) !>(`[~nec ~2000.1.2 *config:v %done at]))
          'own'^(ex-equal !>((~(get ju owners.state) ~nec)) !>([id ~ ~]))
          'ath'^(ex-equal !>((~(get by attested.state) sig.half.at)) !>(`id))
          'atf'^(ex-equal !>((~(get by attested.state) sig.full.at)) !>(`id))
      ==
    (pure:m ~)
  ::
  ++  submit-bad-signature
    %-  ex-fail
    (user-does ~bud %work id %urbit sig(sig +(sig.sig)))
  ::
  ++  submit-bad-target
    %-  ex-fail
    (user-does ~bud %work id %urbit (faux-sign ~bud dat(other ~fun)))
  ::
  ++  submit-by-unrelated
    %-  ex-fail
    (user-does ~fed %work id %urbit (faux-sign ~fed dat))
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
    :~  (ex-verifier-update ~nec %status id 'checking number' %wait ~)
      ::
        %+  ex-arvo  /expire/phone/(scot %t nr)/(scot %da ~2000.1.2)
        [%b %wait (add ~2000.1.2 attempt-timeout)]
      ::
        %+  ex-phone-api-req  (snoc wir %status)
        [%'POST' '/status' `'{"phoneNumber":"+123456789","ship":"~nec"}']
    ==
  ::
  |^  %-  branch
      :~  'status request canceled'^status-cancel
          'status bad'^status-bad
          'status verified'^status-verified
          'status unverified'^status-unverified
      ==
  ++  status-cancel
    ;<  caz=(list card)  bind:m
      (do-arvo (snoc wir %status) %iris %http-response %cancel ~)
    %+  ex-cards  caz  :_  ~
    %+  ex-phone-api-req  (snoc wir %status)
    [%'POST' '/status' `'{"phoneNumber":"+123456789","ship":"~nec"}']
  ::
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
    errored  ::TODO  and log report sent
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
    |^  %-  branch
        :~  'start verify request canceled'^verify-cancel
            'start verify fail'^verify-fail
            'start verify ok'^verify-ok
        ==
    ++  verify-cancel
      ;<  caz=(list card)  bind:m
        (do-arvo (snoc wir %verify) %iris %http-response %cancel ~)
      %+  ex-cards  caz  :_  ~
      %+  ex-phone-api-req  (snoc wir %verify)
      [%'POST' '/verify' `'{"phoneNumber":"+123456789"}']
    ::
    ++  verify-fail
      ;<  caz=(list card)  bind:m
        %+  do-phone-api-res  (snoc wir %verify)
        [400 `'{"message":,"Forbidden"}']
      (errored caz)
    ::
    ++  verify-ok
      ;<  caz=(list card)  bind:m
        (do-phone-api-res (snoc wir %verify) [200 ~])
      ;<  ~  bind:m
        (ex-cards caz (ex-verifier-update ~nec %status id 'submit otp' %want %phone %otp) ~)
      ::  user submits the otp code they received
      ::
      ;<  caz=(list card)  bind:m
        (user-does ~nec %work id %phone '333777')
      ;<  ~  bind:m
        %+  ex-cards  caz
        :~  (ex-verifier-update ~nec %status id 'checking otp' %wait ~)
          ::
            %+  ex-phone-api-req  (snoc wir %submit)
            [%'PATCH' '/verify' `'{"otp":"333777","phoneNumber":"+123456789"}']
        ==
      ::
      |^  %-  branch
          :~  'otp request canceled'^otp-cancel
              'otp bad'^otp-bad
              'otp good'^otp-good
          ==
      ++  otp-cancel
        ;<  caz=(list card)  bind:m
          (do-arvo (snoc wir %submit) %iris %http-response %cancel ~)
        %+  ex-cards  caz  :_  ~
        (ex-verifier-update ~nec %status id 'service error, try again' %want %phone %otp)
      ::
      ++  otp-bad
        ::  if the otp code is wrong, should update status to ask for a retry
        ::
        ;<  caz=(list card)  bind:m
          %+  do-phone-api-res  (snoc wir %submit)
          [400 `'{"message":"Invalid or expired OTP."}']
        (ex-cards caz (ex-verifier-update ~nec %status id 'invalid otp, try again' %want %phone %otp) ~)
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
  ++  errored
    |=  caz=(list card)
    ;<  ~  bind:m
      %+  ex-cards  caz
      [(ex-verifier-update ~nec %status id 'service error' %gone ~)]~
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
      [(ex-verifier-update ~nec %status id 'registration completed' %done at)]~
    ::TODO  test via scries instead?
    ;<  =state:v  bind:m  get-state
    %-  branch
    :~  'rec'^(ex-equal !>((~(get by records.state) id)) !>(`[~nec ~2000.1.2 *config:v %done at]))
        'own'^(ex-equal !>((~(get ju owners.state) ~nec)) !>([id ~ ~]))
        'ath'^(ex-equal !>((~(get by attested.state) sig.half.at)) !>(`id))
        'atf'^(ex-equal !>((~(get by attested.state) sig.full.at)) !>(`id))
    ==
  --
::
++  test-twitter-request
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  do-setup
  ;<  ~  bind:m  (wait ~d1)
  ::
  ;<  ~  bind:m
    %-  ex-fail
    %-  (do-as ~nec)
    (do-poke %noun !>([%set-twitter-api twitter-api-bearer]))
  ;<  caz=(list card)  bind:m
    (do-poke %noun !>([%set-twitter-api twitter-api-bearer]))
  ;<  ~  bind:m  (ex-cards caz ~)
  ::
  ;<  caz=(list card)  bind:m
    (ex-fail (user-does ~nec %start %twitter 'CapitalsHandle'))
  ::
  =/  handle=@t         'tloncorporation'
  =/  id=identifier:v   [%twitter handle]
  =/  wir=wire          /id/twitter/(scot %t handle)
  ::  user requests a twitter handle, is given a nonce to sign a message with,
  ::  submits a tweet id whose post contains the signature jam
  ::
  =/  nonce=@ux
    0x9fd7.fbc0
  =/  want-status=status:v
    [%want %twitter %post nonce]
  ;<  caz=(list card)  bind:m
    (user-does ~nec %start id)
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-verifier-update ~nec %status id 'prove ownership' want-status)
      ::
        %+  ex-arvo  /expire/twitter/(scot %t handle)/(scot %da ~2000.1.2)
        [%b %wait (add ~2000.1.2 attempt-timeout)]
    ==
  ::
  =/  pid=@t         '112233445566778899'
  =/  req-wire=wire  (weld wir /post/(scot %t pid))
  ;<  caz=(list card)  bind:m
    (user-does ~nec %work id %twitter %post pid)
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-verifier-update ~nec %status id 'checking tweet' %wait ~ want-status)
      ::
        %+  ex-http-request  req-wire
        :+  %'GET'
          %+  rap  3
          :~  'https://api.x.com/2/tweets/'
              pid
              '?user.fields=username,id'
              '&tweet.fields=author_id,entities'
              '&expansions=author_id'
          ==
        :_  ~
        ['authorization' (cat 3 'Bearer ' twitter-api-bearer)]~
    ==
  ::
  =/  good-pay=payload:twitter:v
    %+  faux-sign  ~nec
    [%twitter %0 handle nonce]
  =/  good-blob=@t
    (crip ((w-co:co 1) (jam good-pay)))
  ::TODO  want to unit-test +parse-twitter-post instead?
  |^  %-  branch
      :~  'api unauthorized'^api-unauthorized
          'api rate-limited'^api-rate-limited
          'tweet not found'^tweet-not-found
          'tweet protected'^tweet-protected
          'bad response'^bad-response
          'bad handle'^bad-handle
          'bad tweet'^bad-tweet
          'bad nonce'^bad-nonce
          'bad sign'^bad-sign
          ::TODO  good sig but incorrect author
          'good'^good
      ==
  ::
  ++  do-twitter-api-res
    |=  [code=@ud jot=@t]
    %+  do-http-response  req-wire
    :-  [code ~]  ::NOTE  real response has many headers, that we don't look at
    `['application/json; charset=utf-8' (as-octs:mimes:html jot)]
  ::
  ++  api-unauthorized
    ;<  caz=(list card)  bind:m
      (do-twitter-api-res 401 'whatever')
    (errored caz)
  ::
  ++  api-rate-limited
    ;<  caz=(list card)  bind:m
      (do-twitter-api-res 429 'whatever')
    ((held %rate-limited) caz)
  ::
  ++  tweet-not-found
    ;<  caz=(list card)  bind:m
      (do-twitter-api-res 404 'whatever')
    ((held %not-found) caz)
  ::
  ++  tweet-protected
    ;<  caz=(list card)  bind:m
      %+  do-twitter-api-res  200
      '''
      { "errors": [ {
        "resource_id": "1879974887965749623",
        "parameter": "id",
        "resource_type": "tweet",
        "section": "data",
        "title": "Authorization Error",
        "value": "1879974887965749623",
        "detail": "Sorry, you are not authorized to see the Tweet with id: [1879974887965749623].",
        "type": "https://api.twitter.com/2/problems/not-authorized-for-resource"
      } ] }
      '''
    ((held %protected) caz)
  ::
  ++  bad-response
    ;<  caz=(list card)  bind:m
      (do-twitter-api-res 200 'whatever')
    (errored caz)
  ::
  ++  bad-handle
    ;<  caz=(list card)  bind:m
      (do-twitter-api-res 200 (make-tweet-json(handle 'miss') good-blob))
    ((held %bad-handle) caz)
  ::
  ++  bad-tweet
    %+  (merge (list card))
      =-  %+  turn  -
          |=  [l=@t t=@t]
          [l (do-twitter-api-res 200 (make-tweet-json t))]
      :~  :-  'no recognizable jam'
          'Some tweet without a giant base64-encoded jam inside of it.'
        ::
          :-  'jam of malformed noun'
          'Some tweet with a strange jam inside of it: T90NUtJXZPn4LOOCSLFc4LZCt~f5rg6Qb68ENinuw~E0w1D-7yR6CANHrdc3H0113-c0sjYJVJ-6s~DKGxS1u1DpfDe2RHWIy4K7DPigDTe8MoY~TpCPrqSnaX-A6wdUP-f0201VcHIOKz2Qe~U1'
        ::
          :-  'jam packed too tight with other text'
          (cat 3 good-blob 'conjoining')
      ==
    (held %bad-tweet)
  ::
  ++  bad-sign
    ;<  caz=(list card)  bind:m
      ::  'jam containing invalid signature'
      %+  do-twitter-api-res  200
      %-  make-tweet-json
      'Some tweet with a poorly-signed jam inside of it: 1V~uNyQNNIYok850~oo77-S177wZJ5eL~y~FyxzmAUrd0S~rL6thrzjpOHJudFxLOKlYSQg0INhflFfGwDic3h~U0j-LZU083sTJbEMKjuUejuNJPuSeCY0pVcHEWdbKWnw5NN'
    ((held %bad-sign) caz)
  ::
  ++  bad-nonce
    ;<  caz=(list card)  bind:m
      ::  'jam signed with the wrong nonce'
      %+  do-twitter-api-res  200
      %-  make-tweet-json
      %-  crip  %-  (w-co:co 1)  %-  jam
      ^-  payload:twitter:v
      %+  faux-sign  ~nec
      [%twitter %0 handle 0xdead.dead]
    ((held %bad-nonce) caz)
  ::
  ++  good
    %+  (merge (list card))
      =-  %+  turn  -
          |=  [l=@t t=@t]
          [l (do-twitter-api-res 200 (make-tweet-json t))]
      :~  :-  'plain'
          good-blob
        ::
          :-  'pad left'
          (cat 3 'Here is your blob: ' good-blob)
        ::
          :-  'pad left tight'
          %+  rap  3
          :~  'this-works-because-tail-bytes-dont-count'
              good-blob
              '\\nAnd this should parse as separate.'
          ==
        ::
          :-  'pad right'
          (cat 3 good-blob ' should be it.')
        ::
          :-  'pad both'
          (rap 3 'Some tweet containing very tasty ' good-blob ' jam.' ~)
      ==
    registered
  ::
  ++  make-tweet-json
    |=  text=@t
    %+  rap  3
    :~  '''
        {
          "data": {
            "author_id": "998877665544332211",
            "id": "112233445566778899",
            "text": "
        '''
        text
        '''
        "
          },
          "includes": {
            "users": [
              {
                "id": "998877665544332211",
                "name": "Tlon Corporation",
                "username": "
        '''
        handle
        '''
        "
              }
            ]
          }
        }
        '''
    ==
  ::
  ++  held
    |=  why=@t
    |=  caz=(list card)
    ;<  ~  bind:m
      %+  ex-cards  caz
      [(ex-verifier-update ~nec %status id (cat 3 'tweet rejected, try again: ' why) want-status)]~
    ;<  =state:v  bind:m  get-state
    (ex-equal !>((~(has by records.state) id)) !>(&))
  ::
  ++  errored
    |=  caz=(list card)
    ;<  ~  bind:m
      %+  ex-cards  caz
      [(ex-verifier-update ~nec %status id 'service error' %gone ~)]~
    ::TODO  test via scries instead?
    ;<  =state:v  bind:m  get-state
    %-  branch
    :~  'rec'^(ex-equal !>((~(get by records.state) id)) !>(~))
        'own'^(ex-equal !>((~(get ju owners.state) ~nec)) !>(~))
    ==
  ::
  ++  registered
    |=  caz=(list card)
    ;<  at=attestation:v  bind:m  (make-attestation ~nec id `[%tweet pid])
    ;<  ~  bind:m
      ::TODO  don't test signature value, test whether it matches pubkey
      %+  ex-cards  caz
      [(ex-verifier-update ~nec %status id 'registration completed' %done at)]~
    ::TODO  test via scries instead?
    ;<  =state:v  bind:m  get-state
    ;<  ~  bind:m
      %-  branch
      :~  'rec'^(ex-equal !>((~(get by records.state) id)) !>(`[~nec ~2000.1.2 *config:v %done at]))
          'own'^(ex-equal !>((~(get ju owners.state) ~nec)) !>([id ~ ~]))
          'ath'^(ex-equal !>((~(get by attested.state) sig.half.at)) !>(`id))
          'atf'^(ex-equal !>((~(get by attested.state) sig.full.at)) !>(`id))
          'lup'^(ex-equal !>((~(get by lookups.state) sig.good-pay)) !>(`id))
          'rev'^(ex-equal !>((~(get ju reverse.state) id)) !>([sig.good-pay ~ ~]))
      ==
    ::  revocation cleans out that state
    ::
    ;<  *  bind:m  (user-does ~nec %revoke id)
    ;<  =state:v  bind:m  get-state
    %-  branch
    :~  'rec'^(ex-equal !>((~(get by records.state) id)) !>(~))
        'own'^(ex-equal !>((~(get ju owners.state) ~nec)) !>(~))
        'ath'^(ex-equal !>((~(get by attested.state) sig.half.at)) !>(~))
        'atf'^(ex-equal !>((~(get by attested.state) sig.full.at)) !>(~))
        'lup'^(ex-equal !>((~(get by lookups.state) sig.good-pay)) !>(~))
        'rev'^(ex-equal !>((~(get ju reverse.state) id)) !>(~))
    ==
  --
::
++  do-setup-with-id
  =/  =status:v  [%done *attestation:v]
  |=  id=identifier:v
  =/  m  (mare ,~)
  ;<  *  bind:m  do-setup
  =/  =state:v
    %*  .  *state:v
      records      (my [id ~nec ~2000.1.2 *config:v status] ~)
      owners       ?:(?=(%done -.status) (my [~nec (sy id ~)] ~) ~)
      attested     (my [*@ux id] ~)
    ::
      phone-api    ['https://phone.api/base' 'api-key' ~]
      twitter-api  [bearer=twitter-api-bearer]
      domain       `'http://sampel.net'
    ==
  ;<  *  bind:m  (do-load agent `!>([%1 state]))
  (pure:m ~)
::
++  test-duplicate
  %-  eval-mare
  =/  m  (mare ,~)
  =/  id=identifier:v  [%dummy 'test']
  ;<  *  bind:m  (do-setup-with-id id)
  ::  attempting to register an already-registered id should immediately
  ::  send a %gone status
  ::
  ;<  caz=(list card)  bind:m  (user-does ~fed %start id)
  ;<  ~  bind:m
    %+  ex-cards  caz
    [(ex-verifier-update ~fed %status id 'already registered' %gone ~)]~
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
    [(ex-verifier-update ~nec %status id 'revoked' %gone ~)]~
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
    ?>  ?=(%phone -.id)
    (do-arvo /expire/[-.id]/(scot %t +.id)/(scot %da ~2000.1.2) %behn %wake ~)
  ;<  ~  bind:m
    %+  ex-cards  caz
    [(ex-verifier-update ~nec %status id 'registration timed out' %gone ~)]~
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
    ?>  ?=(%phone -.id)
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
  =-  %*(. *state:v records records, owners owners, attested attested)
  %+  roll  ~(tap by records)
  |=  $:  [id=identifier:v record:v]
          [owners=(jug ship identifier:v) attested=(map @ux identifier:v)]
      ==
  ?.  ?=(%done -.status)  [owners attested]
  :-  (~(put ju owners) for id)
  (~(gas by attested) sig.half.status^id sig.full.status^id ~)
::
++  do-query-setup
  |=  $@  entries=_1
      [entries=@ud =config:v]
  =/  [entries=@ud =config:v]
    ?^(+< +< [+< %hidden])
  =/  m  (mare ,~)
  ;<  ~  bind:m  do-setup
  =/  base-id    [%dummy 'test-id']
  =/  base-ship  ~nec
  =/  wen=@da  ~2222.2.2
  ;<  ~  bind:m  (jab-bowl |=(b=bowl:gall b(now wen)))
  =|  records=(map identifier:v record:v)
  =/  i  0
  |-  =*  loop  $
  ?:  (lth i entries)
    =/  this-id
      ?:  =(0 i)  base-id
      base-id(+ (rap 3 +.base-id ' ' (scot %ud i) ~))
    =/  this-ship
      (add base-ship i)
    ;<  at=attestation:v  bind:m
      (make-attestation this-ship this-id ~)
    =.  records
      %+  ~(put by records)  this-id
      [this-ship wen config %done at]
    $(i +(i))
  ;<  *  bind:m  (do-load agent `!>([%1 (state-from-records records)]))
  (pure:m ~)
::
++  expect-query-response
  |=  [who=@p qer=user-query:v res=_+:*query-result:v]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  caz=(list card)  bind:m  (user-asks who qer)
  ::NOTE  if you don't put a face on the +ex-poke product,
  ::      the +ex-cards in the product gate's context
  ::      will shadow the local +ex-cards!!
  =;  ex
    (ex-cards caz ex ~)
  (ex-poke /query/result [who dude.qer] %verifier-result !>([nonce.qer res]))
::
++  test-query-has-any
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (do-query-setup)
  ;<  ~  bind:m
    %^  expect-query-response  ~fed
      [[%some-dude %my-nonce] %has-any ~nec %dummy]
    [%has-any &]
  ::  started but incomplete registrations don't count
  ::
  ;<  *  bind:m  (user-does ~nec %start %urbit ~fun)
  ;<  ~  bind:m
    %^  expect-query-response  ~fed
      [[%my-dude %some-nonce] %has-any ~nec %urbit]
    [%has-any |]
  (pure:m ~)
::
++  test-query-valid
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (do-query-setup)
  ;<  ~  bind:m
    %^  expect-query-response  ~fed
      :+  [%some-dude %my-nonce]
        %valid
      sig:(faux-sign ~zod `full-sign-data:v`[%0 %verified %full ~2222.2.2 ~nec [%dummy 'test-id'] ~])
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
  ;<  ~  bind:m  (do-query-setup)
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
++  test-query-whose-bulk
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (do-query-setup 10 %public)
  ::
  ;<  ~  bind:m
    %^  expect-query-response  ~fed
      =;  s=(set identifier:v)
        [[%some-dude %my-nonce] %whose-bulk 0x0 ~ s ~]
      (sy [%dummy 'test-id'] [%dummy 'test-id 1'] [%dummy 'test-id x'] ~)
    :+  %whose-bulk
      0xcfc7.1531.8e8b.0153.9b11.db7f.bbc2.0a6c.
        1311.c6a7.2292.b906.96c2.6466.f03d.2ddb
    %-  ~(gas by *(map identifier:v (unit @p)))
    :~  :-  [%dummy 'test-id']    `~nec
        :-  [%dummy 'test-id 1']  `~bud
        :-  [%dummy 'test-id x']  ~
    ==
  ::
  (pure:m ~)
::
::  rate-limiting tests
::
++  test-query-rate-limits
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (do-query-setup)
  =/  id=identifier:v  [%dummy 'test-id']
  =/  request
    |=  res=result:query-result:v
    %^  expect-query-response  ~fed
      [[%some-dude %my-nonce] %whose id]
    res
  ::  exhaust our allotted requests
  ::
  =/  n=@ud  queries:*allowance:v
  |-  =*  loop  $
  ?.  =(0 n)
    ;<  ~  bind:m  (request %whose ~)
    loop(n (dec n))
  ::  next request should go over the limit
  ::
  ;<  ~  bind:m  (request %rate-limit ~)
  ::  waiting for a little bit should let us make some requests again
  ::
  ;<  ~  bind:m  (wait ~m16)
  =.  n  3
  |-  =*  loop  $
  ?.  =(0 n)
    ;<  ~  bind:m  (request %whose ~)
    loop(n (dec n))
  (request %rate-limit ~)
::
++  test-query-rate-limits-pool
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (do-query-setup)
  =/  id=identifier:v  [%dummy 'test-id']
  =/  m1=@p  ~sampel-sampel-sampel-sampel
  =/  m2=@p  ~simpel-sampel-sampel-sampel
  =/  m3=@p  ~simpel-simpel-sampel-sampel
  =/  request
    |=  [as=@p res=result:query-result:v]
    %^  expect-query-response  as
      [[%some-dude %my-nonce] %whose id]
    res
  ::  exhaust our allotted requests
  ::
  =/  n=@ud  queries:allowance:pool:rates:v
  |-  =*  loop  $
  ?.  =(0 n)
    ;<  ~  bind:m  (request m1 %whose ~)
    ;<  ~  bind:m  (request m2 %whose ~)
    loop(n (sub n 2))
  ::  next request should go over the limit,
  ::  even though nobody has hit their _individual_ limit yet
  ::
  ;<  ~  bind:m  (request m1 %rate-limit ~)
  ;<  ~  bind:m  (request m2 %rate-limit ~)
  ;<  ~  bind:m  (request m3 %rate-limit ~)
  ::  waiting for a little bit should let them make some requests again
  ::
  ;<  ~  bind:m  (wait ~m1.s31)
  ;<  ~  bind:m  (request m1 %whose ~)
  ;<  ~  bind:m  (request m2 %whose ~)
  ;<  ~  bind:m  (request m3 %whose ~)
  ::  until the limit gets hit again
  ::
  ;<  ~  bind:m  (request m3 %rate-limit ~)
  (pure:m ~)
::
++  test-query-bulk-rate-limits
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (do-query-setup)
  =/  base  batch:*allowance:v
  =/  query
    :*  %whose-bulk
        last-salt=0x0
        last=*(set identifier:v)
      ::
        ^=  add
        %-  ~(gas in *(set identifier:v))
        (turn (gulf 1 base) |=(a=@ [%dummy (scot %ud a)]))
      ::
        del=*(set identifier:v)
    ==
  ::  can keep querying the same large set indefinitely
  ::
  =|  eny=@
  =/  n=@ud  10
  |-  =*  loop  $
  ?.  =(0 n)
    ;<  ~  bind:m  (jab-bowl |=(b=bowl b(eny eny)))
    =/  expected-salt  (shas %whose-salt eny)
    ;<  *  bind:m
      (user-asks ~fed [%some-dude %my-nonce] query)
    %_  loop
      n    (dec n)
      eny  +(eny)
      last-salt.query  expected-salt
      last.query       (~(uni in last.query) add.query)
      add.query        ~
    ==
  ::  but can only do additions at limited rate,
  ::  and breaking set continuity causes the whole set to count again.
  ::
  =.  add.query
    %-  ~(gas in *(set identifier:v))
    (turn (gulf +(base) (add base 5)) |=(a=@ [%dummy (scot %ud a)]))
  %-  branch
  :~  :-  'eager'
      %^  expect-query-response  ~fed
        [[%some-dude %my-nonce] query]
      [%rate-limit ~]
    ::
      :-  'continuous'
      ;<  ~  bind:m  (wait ~h12)
      %^  expect-query-response  ~fed
        [[%some-dude %my-nonce] query]
      :+  %whose-bulk
        last-salt.query  ::NOTE  we didn't update the eny.bowl
      %-  ~(gas by *(map identifier:v (unit @p)))
      %+  turn
        ~(tap in (~(uni in last.query) add.query))
      (late ~)
    ::
      :-  'discontinuous'
      ;<  ~  bind:m  (wait ~h12)
      =.  last-salt.query  0xdead
      %^  expect-query-response  ~fed
        [[%some-dude %my-nonce] query]
      [%rate-limit ~]
  ==
::
++  test-query-bulk-max-size
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (do-query-setup)
  =/  base  0
  =/  step  batch:*allowance:v
  =/  query
    :*  %whose-bulk
        last-salt=0x0
        last=*(set identifier:v)
        add=*(set identifier:v)
        del=*(set identifier:v)
    ==
  ::  keep expanding the set we ask about
  ::
  =|  eny=@
  =/  n=@ud  batch-upper-bound:rates:v
  |-  =*  loop  $
  ?.  =(0 n)
    =.  last.query  (~(uni in last.query) add.query)
    =/  a  (min n step)
    =.  add.query
      %-  ~(gas in *(set identifier:v))
      (turn (gulf base (add base (dec a))) |=(a=@ [%dummy (scot %ud a)]))
    =.  n  (sub n a)
    =.  base  (add base step)
    ;<  ~  bind:m  (jab-bowl |=(b=bowl b(eny eny)))
    =/  expected-salt  (shas %whose-salt eny)
    ;<  *  bind:m
      (user-asks ~fed [%some-dude %my-nonce] query)
    ;<  ~  bind:m  (wait ~d365)
    %_  loop
      eny  +(eny)
      last-salt.query  expected-salt
    ==
  ::  expect the next one to crash due to too-big bulk request
  ::
  =.  last.query  (~(uni in last.query) add.query)
  =.  add.query   (sy [%dummy (scot %ud base)] ~)
  (ex-fail (user-asks ~fed [%some-dude %my-nonce] query))
::
++  test-phone-text-rate-limits
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  do-setup
  ::  request verification texts until we hit the expected limit
  ::
  =/  n=@ud  phone:*allowance:v
  |-  =*  loop  $
  ?.  =(0 n)
    ;<  *  bind:m  (user-does ~nec %start %phone (scot %ud n))
    ;<  *  bind:m  (user-does ~nec %revoke %phone (scot %ud n))
    loop(n (dec n))
  =/  id=identifier:v  [%phone '+123456789']
  ;<  caz=(list card)  bind:m
    (user-does ~nec %start id)
  ;<  ~  bind:m
    %+  ex-cards  caz
    [(ex-verifier-update ~nec %status id 'rate limited' %gone ~)]~
  ::  if we wait, we may continue new attempts
  ::
  ;<  ~  bind:m  (wait p:phone:rates:v)
  ;<  *  bind:m  (user-does ~nec %start %phone '+123456789')
  ::
  (pure:m ~)
::
++  test-tweet-rate-limits
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  do-setup
  ::  check the submitted tweet until we hit the expected limit
  ::
  =/  id=identifier:v  [%twitter 'blah']
  =/  n=@ud  tweet:*allowance:v
  |-  =*  loop  $
  ?.  =(0 n)
    ;<  *  bind:m  (user-does ~nec %start id)
    ;<  *  bind:m  (user-does ~nec %work id %twitter %post '112233445566778899')
    ;<  *  bind:m  (user-does ~nec %revoke id)
    loop(n (dec n))
  ;<  *  bind:m  (user-does ~nec %start id)
  ;<  caz=(list card)  bind:m
    (user-does ~nec %work id %twitter %post '112233445566778899')
  ;<  ~  bind:m
    %+  ex-cards  caz
    [(ex-verifier-update ~nec %status id 'rate limited' %want %twitter %post 0x9fd7.fbc0)]~
  ::  if we wait, we may continue new attempts
  ::
  ;<  ~  bind:m  (wait p:tweet:rates:v)
  ;<  *  bind:m  (user-does ~nec %work id %twitter %post '112233445566778899')
  ::
  (pure:m ~)
::
::TODO  test lanyard:
::TODO  test resubscribe on poke nack
::TODO  test %full handling
::TODO  test %kick handling behavior, regression from 78f1b76b8
--

::  verifier: identifier verification service
::
::    tracks in-progress and completed identifier registrations. acts as a
::    central authority for attesting to ownership registrations, but also
::    distributes signatures on those attestations and optional proofs for
::    decentralized fact-checking.
::
::    this agent should generally be talked to through the companion agent
::    %lanyard, which in turn acts as a client to this server.
::
::    clients subscribe on a per-ship subscription path like /records/~nym
::    to receive updates about their own "records". learning about others'
::    registrations only happens through sending queries through pokes and
::    getting poked back with the response. we do this, gall issues aside,
::    so that we can easily rate-limit queries. if we don't, brute-forcing
::    discovery of someone's identifiers becomes possible.
::
::    note that the marks and subscription paths are not versioned.
::    intended, supported usage is through the lanyard agent, which does
::    version negotiation with this based on /lib/negotiate.
::
/-  verifier
/+  hu=http-utils, logs,
    dbug, verb, negotiate
/=  display  /app/verifier/display
=,  (verifier)
::
%-  %-  agent:negotiate
    [notify=| expose=[~.verifier^%0 ~ ~] expect=~]
%-  agent:dbug
%^  verb  |  %warn
::
=>
|%
+$  state-1  [%1 state]
+$  card     card:agent:gall
::
++  attempt-timeout  ~h1
++  binding  /verifier
::
++  id-wire
  |=  id=identifier
  ^-  wire
  ?-  -.id
    %dummy    /dummy/(scot %t +.id)
    %urbit    /urbit/(scot %p +.id)
    %phone    /phone/(scot %t +.id)
    %twitter  /twitter/(scot %t +.id)
    %website  /website/(scot %t (en-turf:html +.id))
  ==
::
++  wire-id
  |=  =wire
  ^-  (unit identifier)
  ?.  ?=([id-kind @ *] wire)  ~
  ?-  i.wire
    %dummy    (bind (slaw %t i.t.wire) (lead %dummy))
    %urbit    (bind (slaw %p i.t.wire) (lead %urbit))
    %phone    (bind (slaw %t i.t.wire) (lead %phone))
    %twitter  (bind (slaw %t i.t.wire) (lead %twitter))
    %website  (bind (biff (slaw %t i.t.wire) de-turf:html) (lead %website))
  ==
::
++  give-endpoint
  |=  base=(unit @t)
  ^-  card
  =/  upd=update
    [%endpoint base]
  [%give %fact ~[/endpoint] %verifier-update !>(upd)]
::
++  give-update
  |=  [for=@p upd=update]
  ^-  card
  [%give %fact ~[/records/(scot %p for)] %verifier-update !>(upd)]
::
++  give-status
  |=  [for=@p id=identifier why=@t status=$%([%gone ~] status)]
  ^-  card
  (give-update for %status id why status)
::
++  give-config
  |=  [for=@p id=identifier =config]
  ^-  card
  (give-update for %config id config)
::  +l: specialized wrapper for logging library
::
++  l
  |_  [our=@p for=(unit @p) kind=(unit @t)]
  ++  fail
    ::TODO  maybe always slog the trace?
    |=  [desc=term trace=tang]
    %-  link
    (~(fail logs our /logs) desc trace deez)
  ::
  ++  tell
    |=  [=volume:logs =echo:logs]
    %-  link
    (~(tell logs our /logs) volume echo deez)
  ::
  ++  deez  ::  details, log metadata
    ^-  (list [@t json])
    :-  %flow^s+'verifier'
    =;  l=(list (unit [@t json]))
      (murn l same)
    :~  ?~(for ~ `[%registrant s+(scot %p u.for)])
        ?~(kind ~ `[%id-kind s+u.kind])
    ==
  ::
  ++  link  ::  construct accumulator
    |=  cad=card
    |*  [caz=(list card) etc=*]
    [[cad caz] etc]
  --
::  +phone: %phone id helpers, initialized with api key details
::
++  phone
  |_  [base=@t key=@t basic=(unit [user=@t pass=@t])]
  ::  +req-api:  make a request to the api
  ::
  ::    %status: request registration status for the .nr of .who
  ::    %verify: send an otp text to the .nr
  ::    %submit: check correctness of the .otp submitted by the user
  ::
  ++  req-api
    |=  $:  nr=@t
            $=  req
            $%  [%status who=@p]
                [%verify ~]
                [%submit otp=@t]
        ==  ==
    ^-  card
    :+  %pass  /id/phone/(scot %t nr)/[-.req]
    :+  %arvo  %i
    =;  =request:http
      [%request request %*(. *outbound-config:iris retries 0)]
    =/  heads=header-list:http
      :+  'content-type'^'application/json'
        'x-vnd-apikey'^key
      ?~  basic  ~
      =/  bas
        =,  mimes:html
        (en:base64 (as-octs (rap 3 [user ':' pass ~]:u.basic)))
      ['authorization'^(cat 3 'Basic ' bas)]~
    =*  make-body  :(cork pairs:enjs:format en:json:html as-octs:mimes:html some)
    ?-  -.req
        %status
      :^  %'POST'  (cat 3 base '/status')  heads
      (make-body 'phoneNumber'^s+nr 'ship'^s+(scot %p who.req) ~)
    ::
        %verify
      :^  %'POST'  (cat 3 base '/verify')  heads
      (make-body 'phoneNumber'^s+nr ~)
    ::
        %submit
      :^  %'PATCH'  (cat 3 base '/verify')  heads
      (make-body 'phoneNumber'^s+nr 'otp'^s+otp.req ~)
    ==
  ::  +parse-status: parse response to /status request
  ::
  ::    the request json has the following shape, where the matchingShip
  ::    key is optional.
  ::    { "known": true, "verified": true, "matchingShip": true }
  ::
  ++  parse-status
    |=  jon=json
    ^-  (unit [known=? verified=? matching=(unit ?)])
    ?.  ?=([%o *] jon)  ~
    =*  bo  bo:dejs-soft:format
    =/  k  (biff (~(get by p.jon) 'known') bo)
    =/  v  (biff (~(get by p.jon) 'verified') bo)
    =/  m  (biff (~(get by p.jon) 'matchingShip') bo)
    ?.  &(?=(^ k) ?=(^ v))  ~
    `[u.k u.v m]
  --
::  +twitter: %twitter id helpers, initialized with api key details
::
++  twitter
  =>  [^twitter .]
  |_  [=bowl:gall bearer=@t]
  ::  +req-post: request a tweet (body + metadata) by tweet id
  ::
  ++  req-post
    |=  [handle=@t tweet=@t]
    ^-  card
    =;  =request:http
      :+  %pass  /id/twitter/(scot %t handle)/post/(scot %t tweet)
      [%arvo %i %request request %*(. *outbound-config:iris retries 0)]
    =/  heads=header-list:http
      ['authorization' (cat 3 'Bearer ' bearer)]~
    =-  [%'GET' - heads ~]
    ::TODO  query params could be tighter if we're only looking at plaintext body,
    ::      don't need entities
    %+  rap  3
    :~  'https://api.x.com/2/tweets/'
        tweet
        '?user.fields=username,id'
        '&tweet.fields=author_id,entities'
        '&expansions=author_id'
    ==
  ::  +parse-post: parse a response to the +req-post request
  ::
  ::    extracts the tweet body and metadata from the response,
  ::    extracts the signed payload from the tweet body,
  ::    and validates the signature on that.
  ::
  ++  parse-post
    |=  $:  [handle=@t nonce=@ux]
            [hed=response-header:http bod=(unit mime-data:iris)]
        ==
    ^-  ?([%good sig=@ux] %rate-limited %unauthorized %not-found %protected %bad-handle %bad-tweet %bad-nonce %bad-sign %bad)
    ?+  status-code.hed  %bad
      %400  %bad
      %401  %unauthorized
      %404  %not-found
      %429  %rate-limited
    ::
        %200
      ?~  bod  %bad
      ?~  jon=(de:json:html q.data.u.bod)  %bad
      =,  dejs-soft:format
      =/  [[text=@t uid=@t] usr=(map @t @t)]
        =-  (fall - ['' ''] ~)
        %.  u.jon
        %-  ot
        :~  'data'^(ot 'text'^so 'author_id'^so ~)
          ::
            =;  u  'includes'^(ot 'users'^u ~)
            (cu ~(gas by *(map @t @t)) (ar (ot 'id'^so 'username'^so ~)))
        ==
      ?~  nom=(~(get by usr) uid)
        =;  nauth  ?:(nauth %protected %bad)
        ::TODO  do better
        ?=(^ (find "not-authorized-for-resource" (trip q.data.u.bod)))
      ::  we only ever operate on lowercased handles
      ::
      =.  u.nom  (crip (cass (trip u.nom)))
      ?:  !=(u.nom handle)  %bad-handle
      =/  pull
        ::NOTE  the twitter api returns newlines as backslash-n, so newlines
        ::      directly preceding the blob will be included in its result.
        ::      however, for any valid jam, appending arbitrary bytes does not
        ::      change the result of cueing it: cue simply does not read into the
        ::      extraneous bytes. so we only need to worry about content directly
        ::      _after_ the blob, and there newlines will properly demarcate the
        ::      end of the blob (as will spaces and other non-siw:ab characters),
        ::      because they start with a backslash.
        |^  wrap
        ++  wrap  %+  knee  *@  |.  ~+
                  ;~(pose ;~(sfix blob (star next)) ;~(pfix next wrap))
        ::NOTE  bare signature is ~84 chars. the jam always larger, but never
        ::      larger than a tweet (280 chars).
        ++  blob  (bass 64 (stun [84 280] siw:ab))
        --
      =/  pay=(unit payload)
        ?~  jaw=(rush text pull)  ~
        (biff (mole |.((cue u.jaw))) (soft payload))
      ?~  pay  %bad-tweet
      ?.  =(nonce.dat.u.pay nonce)  %bad-nonce
      ?:((validate-signature bowl u.pay) [%good sig.u.pay] %bad-sign)
    ==
  --
::  +website: %website id helpers
::
++  website
  =>  [^website .]
  |%
  ::  +make-link: the well-known link for a given .turf
  ::
  ++  make-link
    |=  =turf
    %+  rap  3
    :~  'https://'  ::NOTE  secure verification only
        (en-turf:html turf)
        well-known:website
    ==
  ::  +req-challenge: request the well-known link for a given .turf
  ::
  ++  req-challenge
    |=  =turf
    ^-  card
    =;  =request:http
      :+  %pass
        ::TODO  use +id-wire xx
        /id/website/(scot %t (en-turf:html turf))/challenge
      [%arvo %i %request request *outbound-config:iris]
    [%'GET' (make-link turf) ~ ~]
  ::  +parse-challenge: parse the body of the response to +req-challenge
  ::
  ++  parse-challenge
    |=  [=bowl:gall nonce=@ux fil=(unit mime-data:iris)]
    ^-  ?(%good %bad-res %bad-nonce %bad-sign)
    ?~  fil  %bad-res
    =/  =coin
      %+  fall
        (rush q.data.u.fil ;~(sfix nuck:so gay))
      [%$ %$ q.data.u.fil]
    =/  pay=(unit payload:website)
      =-  (biff (mole -) (soft payload:website))
      |.
      ?-  -.coin
        %$     (cue q.p.coin)
        %blob  p.coin
        %many  ~
      ==
    ?~  pay  %bad-res
    ?.  =(nonce.dat.u.pay nonce)  %bad-nonce
    ?:((validate-signature bowl u.pay) %good %bad-sign)
  --
::  +validate-signature: check any $signed signature
::
++  validate-signature
  |=  [=bowl:gall sign=(signed)]
  ^-  ?
  ::TODO  only count as legit if signature is with latest known life?
  ::  if we don't know the current life of the signer,
  ::  or the life used to sign is beyond what we know,
  ::  we can't validate locally.
  ::
  =+  .^(lyf=(unit life) %j /(scot %p our.bowl)/lyfe/(scot %da now.bowl)/(scot %p who.sign))
  ?~  |(?=(~ lyf) (gth lyf.sign u.lyf))  |
  ::  jael should have the pubkey. get it and validate.
  ::
  =+  .^([life =pass *] %j /(scot %p our.bowl)/deed/(scot %da now.bowl)/(scot %p who.sign)/(scot %ud lyf.sign))
  (safe:as:(com:nu:crub:crypto pass) sig.sign (jam dat.sign))
::  +revoke: remove the .id registration from state
::
++  revoke
  |=  $:  [state =bowl:gall]
          [id=identifier rec=(unit record)]
          why=@t
      ==
  =*  state  +<-<
  ^-  (quip card _state)
  =.  rec  ?^(rec rec (~(get by records) id))
  ?~  rec  [~ state]
  %-  (~(tell l our.bowl `for.u.rec `-.id) %info ~['registration revoked' why])
  :-  [(give-status for.u.rec id why %gone ~)]~
  =?  attested  ?=(%done -.status.u.rec)
    %.  sig.full.status.u.rec
    %~  del  by
    (~(del by attested) sig.half.status.u.rec)
  %_  state
    records  (~(del by records) id)
    owners   (~(del ju owners) for.u.rec id)
    lookups  %+  roll  ~(tap in (~(get ju reverse) id))
             |=([l=@ =_lookups] (~(del by lookups) l))
    reverse  (~(del by reverse) id)
  ==
::  +register: complete the registration of .id, generating attestations
::
++  register
  |=  $:  [state =bowl:gall]
          [id=identifier rec=record]
          proof=(unit proof)
      ==
  =*  state  +<-<
  ^-  (quip card _state)
  =/  tat=attestation
    (attest [our now]:bowl for.rec id proof)
  =.  status.rec  [%done tat]
  %-  (~(tell l our.bowl `for.rec `-.id) %info ['registration completed']~)
  :-  [(give-status for.rec id 'registration completed' status.rec)]~
  %_  state
    records   (~(put by records) id rec)
    attested  (~(gas by attested) sig.half.tat^id sig.full.tat^id ~)
  ==
::  +sign: turn any data into a $signed noun
::
++  sign
  |*  [[our=@p now=@da] dat=*]
  ^-  (signed _dat)
  =+  =>  [our=our now=now feed=feed ..lull]  ~+
      ;;(=feed (cue .^(@ %j /(scot %p our)/vile/(scot %da now))))
  =/  seed=[who=@p lyf=life key=ring]
    ?-  feed
      [@ *]       [who.feed lyf.feed key.feed]
      [[%1 *] *]  [who.feed (rear kyz.feed)]
      [[%2 *] *]  [who.feed (rear kyz.feed)]
    ==
  ?>  =(who.seed our)
  =/  sig=@ux  (sigh:as:(nol:nu:crub:crypto key.seed) (jam dat))
  [our lyf.seed dat sig]
::  +attest: sign both "full" and "half" attestations
::
++  attest
  |=  [[our=@p now=@da] for=@p id=identifier proof=(unit proof)]
  ^-  attestation
  :-  (sign [our now] `half-sign-data`[%0 %verified %half now for -.id])
  (sign [our now] `full-sign-data`[%0 %verified %full now for id proof])
::  +get-allowance: get the rate-limiting balance .for needs to use
::
++  get-allowance
  |=  [[solo=(map @p allowance) pool=allowance] for=@p now=@da]
  |^  ^-  [solo=allowance pool=(unit allowance)]
      =/  risk=?
        ?=(?(%pawn %earl) (clan:title for))
      :-  ?~  lim=(~(get by solo) for)
            %*(. *allowance since now)
          (step-allowance u.lim max=*allowance | now (sub now since.u.lim))
      ?.  risk  ~
      `(step-allowance pool max=allowance:pool:rates & now (sub now since.pool))
  ::
  ++  step-allowance  ::  increment all allowance
    |=  [a=allowance m=allowance pool=? now=@da d=@dr]
    ^+  a
    :*  now
        (calc-new phone.a phone.m d (get-rate pool %phone))
        (calc-new photp.a photp.m d (get-rate pool %photp))
        (calc-new tweet.a tweet.m d (get-rate pool %tweet))
        (calc-new fetch.a fetch.m d (get-rate pool %fetch))
        (calc-new queries.a queries.m d (get-rate pool %queries))
        (calc-new batch.a batch.m d (get-rate pool %batch))
        last-batch.a
    ==
  ::
  ++  get-rate  ::  refill rate for individual or for pool
    |=  $:  pool=?
            what=?(%phone %photp %tweet %fetch %queries %batch)
        ==
    ^-  [n=@ud p=@dr]
    ?-  what
      %phone    ?.(pool phone:rates phone:pool:rates)
      %photp    ?.(pool photp:rates photp:pool:rates)
      %tweet    ?.(pool tweet:rates tweet:pool:rates)
      %fetch    ?.(pool fetch:rates fetch:pool:rates)
      %queries  ?.(pool queries:rates queries:pool:rates)
      %batch    ?.(pool batch:rates batch:pool:rates)
    ==
  ::
  ++  calc-new  ::  increment i up to m, given that d amount of time passed
    |=  [i=@ud m=@ud d=@dr [n=@ud p=@dr]]
    ^-  @ud
    (min (add i (calc-gain d n p)) m)
  ::
  ++  calc-gain  ::  n per p, over d amount of time
    |=  [d=@dr [n=@ud p=@dr]]
    ^-  @ud
    (abs:si (need (toi:rd (mul:rd (sun:rd n) (div:rd (sun:rd `@`d) (sun:rd `@`p))))))
  --
::  +stab-allowance: apply payment function .f, indicating success or limit
::
++  stab-allowance
  |=  [limits=[solo=(map @p allowance) pool=allowance] for=@p now=@da]
  |=  f=$-(allowance (unit allowance))
  ^-  [pass=? =_limits]
  =+  (get-allowance limits for now)
  =+  s=(f solo)
  ?~  s  [| limits]
  ?~  pool
    [& limits(solo (~(put by solo.limits) for u.s))]
  =+  p=(f u.pool)
  ?~  p  [| limits]
  [& limits(pool u.p, solo (~(put by solo.limits) for u.s))]
::  +find-whose: resolve a single %whose query
::
++  find-whose
  |=  [id=identifier sat=(unit record) src=(set identifier)]
  ^-  (unit @p)
  ?~  sat  ~
  ?.  ?=(%done -.status.u.sat)  ~
  =;  vis=?
    ?:(vis `for.u.sat ~)
  ?-  config.u.sat
    %public  &
    %hidden  |
  ::
      %verified
    %+  lien  ~(tap in src)
    |=(i=identifier =(-.i -.id))
  ==
--
::
=|  state-1
=*  state  -
::
=+  log=l
::
^-  agent:gall
|_  =bowl:gall
+*  this     .
    l        log(our our.bowl)
    phone    ~(. ^phone phone-api)
    twitter  ~(. ^twitter bowl twitter-api)
::
++  on-save  !>(state)
++  on-init
  ^-  (quip card _this)
  :_  this
  [%pass /eyre %arvo %e %connect [~ binding] dap.bowl]~
::
++  on-load
  |=  ole=vase
  |^  ^-  (quip card _this)
      =/  old=state-any  !<(state-any ole)
      =?  old  ?=(%0 -.old)  (state-0-to-1 old)
      ?>  ?=(%1 -.old)
      =.  state  old
      ::  we always send an endpoint update, to trigger lanyard clients
      ::  to send us their invite links if necessary
      ::
      [[(give-endpoint domain)]~ this]
  ::
  +$  state-any  $%(state-0 state-1)
  ::
  +$  state-0
    $:  %0
        records=(map identifier record)
        owners=(jug ship identifier)
        attested=(map @ux identifier)
        lookups=(map @ identifier)
        reverse=(jug identifier @)
      ::
        limits=[solo=(map @p allowance) pool=_allowance:pool:rates]
      ::
        ::NOTE  basic auth only needed for staging api key
        phone-api=[base=@t key=@t basic=(unit [user=@t pass=@t])]
        twitter-api=[bearer=@t]
        domain=(unit @t)  ::  as 'https://example.org:123/verifier'
    ==
  ++  state-0-to-1
    |=  s=state-0
    ^-  state-1
    s(- %1, domain [domain.s invites=~])
  --
::
++  on-poke
  |=  [=mark =vase]
  =-  -(log ^^l)  ::  reset any .log deets we might've set
  ^-  (quip card _this)
  ~|  [%on-poke mark=mark]
  ?+  mark  !!
      %noun
    ?+  q.vase
      ?.  ?=([@ *] q.vase)  !!
      $(mark -.q.vase, vase (slot 3 vase))
    ::
        [%set-phone-api *]
      ?>  =(our src):bowl
      [~ this(phone-api !<([@t @t (unit [@t @t])] (slot 3 vase)))]
    ::
        [%set-twitter-api *]
      ?>  =(our src):bowl
      [~ this(twitter-api !<(@t (slot 3 vase)))]
    ::
        [%set-domain base=(unit @t)]
      ?>  =(our src):bowl
      ?:  =(base.q.vase domain)  [~ this]
      :-  [(give-endpoint base.q.vase)]~
      this(domain base.q.vase)
    ::
        [%stats ~]
      ?>  =(our src):bowl
      =;  =tang
        %-  (tell:l %info tang)
        %-  (slog tang)
        [~ this]
      =+  %-  ~(rep by records)
          |=  [[id=identifier record] sum=@ud suz=(map id-kind [done=@ud pend=@ud])]
          :-  +(sum)
          %+  ~(put by suz)  -.id
          =+  (~(gut by suz) -.id [done=0 pend=0])
          ?:  ?=(%done -.status)
            [+(done) pend]
          [done +(pend)]
      =+  tac=(cork a-co:co crip)
      :-  (cat 3 (tac sum) ' registrations total')
      %+  turn  ~(tap by suz)
      |=  [k=id-kind done=@ud pend=@ud]
      (rap 3 '%' k ': ' (tac done) ?:(=(0 pend) ~ [' (+' (tac pend) ' pending)' ~]))
    ==
  ::
      %verifier-user-command
    =+  !<(cmd=user-command vase)
    ?-  -.cmd
        %start
      =.  for.log   `src.bowl
      =.  kind.log  `-.id.cmd
      ?:  (~(has by records) id.cmd)
        ::  can't register something for which a record already exists,
        ::  but we do want to notify the user of this.
        ::
        [[(give-status src.bowl id.cmd 'already registered' %gone ~)]~ this]
      =/  [why=@t =status]
        ?-  -.id.cmd
          %dummy    :-  'awaiting manual approval'
                    [%wait ~]
          %urbit    :-  'prove ownership'
                    [%want %urbit (end 5 (shas %urbit eny.bowl))]
          %phone    ?<  =(['' '' ~] phone-api)
                    ['checking number' %wait ~]
          %twitter  ?<  =('' twitter-api)
                    ?>  =(+.id.cmd (crip (cass (trip +.id.cmd))))
                    :-  'prove ownership'
                    [%want %twitter %post (end 5 (shas %twitter eny.bowl))]
          %website  ?>  ?=([@ @ *] +.id.cmd)  ::NOTE  at least second-level
                    :-  'prove ownership'
                    [%want %website %sign (end 5 (shas %website eny.bowl))]
        ==
      =^  pass=?  limits
        ::  only %phone registrations make an api request right at the start,
        ::  (the +req-api:phone call at the end of this hoon)
        ::  so check those for rate-limits here
        ::
        ?.  ?=(%phone -.id.cmd)  [& limits]
        %-  (stab-allowance limits src.bowl now.bowl)
        |=  lim=allowance
        ?:  =(0 phone.lim)  ~
        `lim(phone (dec phone.lim))
      ?.  pass
        %-  (tell:l %info 'rate limited (phone text)' ~)
        :_  this
        [(give-status src.bowl id.cmd 'rate limited' %gone ~)]~
      =.  records
        %+  ~(put by records)  id.cmd
        [src.bowl now.bowl *config status]
      =.  owners
        (~(put ju owners) src.bowl id.cmd)
      %-  (tell:l %info 'started registration' ~)
      :_  this
      :+  (give-status src.bowl id.cmd why status)
        :+  %pass  [%expire (snoc (id-wire id.cmd) (scot %da now.bowl))]
        [%arvo %b %wait (add now.bowl attempt-timeout)]
      ?.  ?=(%phone -.id.cmd)  ~
      [(req-api:phone +.id.cmd %status src.bowl)]~
    ::
        %config
      =/  rec  (~(got by records) id.cmd)
      ?>  =(src.bowl for.rec)
      :-  [(give-config src.bowl id.cmd config.cmd)]~
      this(records (~(put by records) id.cmd rec(config config.cmd)))
    ::
        %revoke
      =/  rec  (~(got by records) id.cmd)
      ?>  =(src.bowl for.rec)
      =^  caz  +.state  (revoke [+.state bowl] [id.cmd `rec] 'revoked')
      [caz this]
    ::
        %work
      =*  id  id.cmd
      ?-  -.work.cmd
          %urbit
        ?>  ?=(%urbit -.id)
        ::  to complete verification of an urbit,
        ::  the urbit being verified must submit,
        ::  for a pending verification,
        ::  the corresponding signature.
        ::
        ?>  =(src.bowl +.id)
        =/  rec  (~(got by records) id)
        ?>  ?=([%want %urbit *] status.rec)
        =*  sig  sig.work.cmd
        ?>  ?&  =(other.dat.sig for.rec)
                =(nonce.dat.sig nonce.status.rec)
                (validate-signature bowl sig)
            ==
        =^  caz  +.state
          (register [+.state bowl] [id rec] `[%urbit sig.work.cmd])
        [caz this]
      ::
          %phone
        ?>  ?=(%phone -.id)
        =/  rec  (~(got by records) id)
        ?>  =(src.bowl for.rec)
        ?>  =([%want %phone %otp] status.rec)  ::NOTE  tmi
        =^  pass  limits
          %-  (stab-allowance limits [src now]:bowl)
          |=  lim=allowance
          ?:  =(0 photp.lim)  ~
          `lim(photp (dec photp.lim))
        ?.  pass
          %-  (tell:l %info 'rate limited (phone otp check)' ~)
          :_  this
          [(give-status src.bowl id 'rate limited' status.rec)]~
        =.  status.rec  [%wait ~]
        :_  this(records (~(put by records) id rec))
        :~  (give-status src.bowl id 'checking otp' status.rec)
            (req-api:phone +.id %submit otp.work.cmd)
        ==
      ::
          %twitter
        ?>  ?=(%twitter -.id)
        =/  rec  (~(got by records) id)
        ?>  =(src.bowl for.rec)
        ?>  |(?=([%want %twitter %post *] status.rec))  ::NOTE  tmi hack
        =^  pass  limits
          %-  (stab-allowance limits [src now]:bowl)
          |=  lim=allowance
          ?:  =(0 tweet.lim)  ~
          `lim(tweet (dec tweet.lim))
        ?.  pass
          %-  (tell:l %info 'rate limited (tweet fetch)' ~)
          :_  this
          [(give-status src.bowl id 'rate limited' status.rec)]~
        =.  status.rec  [%wait `status.rec]
        :_  this(records (~(put by records) id rec))
        :~  (give-status src.bowl id 'checking tweet' status.rec)
            (req-post:twitter +.id id.work.cmd)
        ==
      ::
          %website
        ?>  ?=(%website -.id)
        =/  rec  (~(got by records) id)
        ?>  =(src.bowl for.rec)
        ?>  |(?=([%want %website %sign *] status.rec))  ::NOTE  tmi hack
        =^  pass  limits
          %-  (stab-allowance limits [src now]:bowl)
          |=  lim=allowance
          ?:  =(0 fetch.lim)  ~
          `lim(fetch (dec fetch.lim))
        ?.  pass
          %-  (tell:l %info 'rate limited (website fetch)' ~)
          :_  this
          [(give-status src.bowl id 'rate limited' status.rec)]~
        =.  status.rec  [%wait `status.rec]
        :_  this(records (~(put by records) id rec))
        :~  (give-status src.bowl id 'checking proof' status.rec)
            (req-challenge:website +.id)
        ==
      ==
    ::
        %invite
      =-  [~ this(invites -)]
      ?~  url.cmd
        (~(del by invites) src.bowl)
      (~(put by invites) src.bowl u.url.cmd)
    ==
  ::
      %verifier-host-command
    ?>  =(src our):bowl
    =+  !<(cmd=host-command vase)
    |-
    ?-  -.cmd
        %revoke
      =*  id  id.cmd
      =/  rec  (~(got by records) id)
      =^  caz  +.state  (revoke [+.state bowl] [id.cmd `rec] 'revoked')
      [caz this]
    ::
        %dummy
      =/  id=identifier  [%dummy id.cmd]
      =/  rec  (~(got by records) id)
      ?:  ?=(%reject do.cmd)
        $(cmd [%revoke id])
      =^  caz  +.state  (register [+.state bowl] [id rec] ~)
      [caz this]
    ==
  ::
      %verifier-user-query
    =.  for.log  `src.bowl
    =+  !<(qer=user-query vase)
    =;  [res=result:query-result nu=_state]
      =.  state  nu
      %-  ?.  ?=(%rate-limit -.res)  same
          =/  kind=@t
            ?.  ?=(%whose-bulk +<.qer)  '(query)'
            '(whose bulk query)'
          (tell:l %info (cat 3 'rate limited ' kind) ~)
      :_  this
      =/  =cage  [%verifier-result !>([nonce.qer res])]
      [%pass /query/result %agent [src.bowl dude.qer] %poke cage]~
    ?-  +<.qer
        ?(%has-any %valid %whose)
      =^  pass  limits
        %-  (stab-allowance limits src.bowl now.bowl)
        |=  lim=allowance
        ?:  =(0 queries.lim)  ~
        `lim(queries (dec queries.lim))
      :_  state
      ?.  pass
        [%rate-limit ~]
      ?-  +<.qer
          %has-any
        :-  %has-any
        %+  lien  ~(tap in (~(get ju owners) who.qer))
        |=  id=identifier
        ::TODO  should not be %hidden ?
        ?&  =(-.id kind.qer)
            ?=(%done =<(-.status (~(gut by records) id *record)))
        ==
      ::
          %valid
        [%valid (~(has by attested) sig.qer)]
      ::
          %whose
        :-  %whose
        (find-whose id.qer (~(get by records) id.qer) (~(get ju owners) src.bowl))
      ==
    ::
        %whose-bulk
      ::  first, rate-limiting logic
      ::NOTE  this is "differential contact discovery", from Hagen et al. (2022)
      ::      https://eprint.iacr.org/2022/875.pdf
      ::
      ::  bulk: full set to query on
      ::  cost: .batch.lims allowance cost of resolving .bulk
      ::
      =/  bulk=(set identifier)
        (~(dif in (~(uni in last.qer) add.qer)) del.qer)
      ?:  (gth ~(wyt in bulk) batch-upper-bound:rates)
        ~|(%bulk-too-big !!)
      =/  cost=@
        ::  calculate their proclaimed hash by salting the "last" set with the
        ::  provided salt. for the first request case, it doesn't matter that
        ::  the client can't provide a salt that results in the "expected"
        ::  (in reality bunted) hash, because the request should only have
        ::  additions, no pre-existing entries in the set.
        ::
        =/  lash=@
          ::  the set must be well-formed, to ensure the same data always has the
          ::  same shape
          ::
          ?>  ~(apt in last.qer)
          (shas last-salt.qer (jam last.qer))
        ::  if the query has continuity with the previous batch from the
        ::  requester, they only "pay" for the new entries
        ::
        ?:  =(lash last-batch:(~(gut by solo.limits) src.bowl *allowance))
          ~(wyt in add.qer)
        ::  if there is discontinuity, consider the entirety of the
        ::  request new, and make them "pay" for each entry
        ::
        ~(wyt in bulk)
      =/  salt  (shas %whose-salt eny.bowl)
      =^  pass  limits
        %-  (stab-allowance limits src.bowl now.bowl)
        |=  lim=allowance
        ?:  (gth cost batch.lim)  ~
        :-  ~
        ::NOTE  this also writes the last-batch hash to the shared pool,
        ::      but we don't really care. the value there is never checked.
        %_  lim
          batch       (sub batch.lim cost)
          last-batch  (shas salt (jam bulk))
        ==
      :_  state
      ?.  pass
        [%rate-limit ~]
      ::  assuming the prior didn't crash, we can proceed with the query
      ::
      :+  %whose-bulk  salt
      %-  ~(rep in bulk)
      =/  own  (~(get ju owners) src.bowl)
      |=  [id=identifier out=(map identifier (unit @p))]
      %+  ~(put by out)  id
      (find-whose id (~(get by records) id) own)
    ==
  ::
      %handle-http-request
    ::TODO  rate-limiting
    =+  !<(order:hu vase)
    ?.  ?=(%'GET' method.request)
      [(spout:hu id [405 ~] `(as-octs:mimes:html 'read-only')) this]
    =/  qer=query:hu  (purse:hu url.request)
    =*  fof
      %.  :_  this
          (spout:hu id [404 ~] `(as-octs:mimes:html 'not found'))
      %+  tell:l  %info
      :~  'serving 404'
          (cat 3 'on ' (spat site.qer))
          (cat 3 'to ' (scot ?-(-.address %ipv4 %if, %ipv6 %is) +.address))
      ==
    ?.  ?=([%verifier *] site.qer)
      fof
    ?+  t.site.qer  fof
        [%attestations @ ~]
      ?~  sig=(slaw %uw i.t.t.site.qer)   fof
      ?~  aid=(~(get by attested) u.sig)  fof
      ?~  rec=(~(get by records) u.aid)   fof
      ?.  ?=(%done -.status.u.rec)        fof
      =/  url  (~(get by invites) for.u.rec)
      ?:  =(sig.half.status.u.rec u.sig)
        [(spout:hu id [200 ~] `(display url | +.status.u.rec)) this]
      ?:  =(sig.full.status.u.rec u.sig)
        [(spout:hu id [200 ~] `(display url & +.status.u.rec)) this]
      ::  if we make it into this branch our bookkeeping is bad
      ::
      ~&  [dap.bowl %no-such-sig sig=`@uw`u.sig in=u.aid]
      %.  fof
      %+  tell:l  %crit
      ~['bad bookkeeping' 'failed to look up signature' (scot %uw u.sig)]
    ::
        [%lookup @ ~]
      ::TODO  any atom format?
      ?~  num=(slaw %uw i.t.t.site.qer)  fof
      ?~  aid=(~(get by lookups) u.num)  fof
      ?~  rec=(~(get by records) u.aid)  fof
      ?.  ?=(%done -.status.u.rec)       fof
      =/  url  (~(get by invites) for.u.rec)
      [(spout:hu id [200 ~] `(display url & +.status.u.rec)) this]
    ==
  ==
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ?:  =(/logs wire)
    [~ this]
  ?:  =(/query/result wire)
    ::  we don't care whether they ack the query response poke or not,
    ::  we did what we had to, everything else is up to them.
    ::
    [~ this]
  ~&  [dap.bowl %on-agent-strange-wire wire]
  ~|  wire
  !!  ::NOTE  logged in +on-fail
::
++  on-arvo
  |=  [=wire sign=sign-arvo]
  =-  -(log ^^l)  ::  reset any .log deets we might've set
  ^-  (quip card _this)
  ::NOTE  including this ~| means that, when logging traces, we might send
  ::      full identifiers over the wire...
  ~|  wire=wire
  ?+  wire  ~|(%strange-wire !!)
      [%eyre ~]
    [~ this]  ::TODO  print on bind failure
  ::
      [%expire id-kind @ @ ~]
    =.  kind.log  `i.t.wire
    ?>  ?=([%behn %wake *] sign)
    ?^  error.sign
      %-  (slog dap.bowl 'wake failed' u.error.sign)
      %-  (fail:l %wake 'verifier wake failed' u.error.sign)
      [~ this]
    =/  id=identifier  (need (wire-id t.wire))
    =/  start=@da      (slav %da i.t.t.t.wire)
    ?~  rec=(~(get by records) id)  [~ this]
    =.  for.log  `for.u.rec
    ?.  =(start start.u.rec)        [~ this]
    ?:  ?=(%done -.status.u.rec)    [~ this]
    ::  registration attempt took too long, abort it
    ::
    %-  ?.  ?=(%wait -.status.u.rec)  same
        (tell:l %warn 'verifier dropped the ball' ~)
    =^  caz  +.state  (revoke [+.state bowl] [id rec] 'registration timed out')
    [caz this]
  ::
      [%id %phone @ ?(%status %verify %submit) ~]
    =*  step  i.t.t.t.wire
    =.  kind.log  `%phone
    ~|  [- +<]:sign
    ?>  ?=([%iris %http-response *] sign)
    =*  res  client-response.sign
    =/  nr  (slav %t i.t.t.wire)
    =/  id  [%phone nr]
    ::  if the id was removed (cancelled or revoked by the user), no-op
    ::
    ?~  rec=(~(get by records) id)
      [~ this]
    =.  for.log  `for.u.rec
    ::  we should've put the id into a waiting state,
    ::  for which we'll now handle our continuation
    ::
    ?>  =(%wait -.status.u.rec)  ::NOTE  avoid tmi
    =/  err-msg  'something went wrong'
    =*  abort
      %.  =^  caz  +.state  (revoke [+.state bowl] [id rec] 'service error')
          [caz this]
      =;  =echo:logs
        (tell:l %warn echo)
      :~  'internal phone api error:'
          (cat 3 'during %' step)
          err-msg
      ==
    =/  failed-otp=?  |
    =/  why=@t  'submit otp'
    =*  want-otp
      =.  status.u.rec  [%want %phone %otp]
      %-  ?.  failed-otp  same
          (tell:l %info 'phone otp rejected' ~)
      :-  [(give-status for.u.rec id why status.u.rec)]~
      this(records (~(put by records) id u.rec))
    ::  %progress responses are unexpected, the runtime doesn't support them
    ::  right now. if they occur, just treat them as cancels and retry.
    ::
    =?  res  ?=(%progress -.res)
      ~&  [dap.bowl %strange-iris-progress-response]  ::TODO  log properly
      [%cancel ~]
    ::  we might get a %cancel if the runtime was restarted during our
    ::  request. try to pick up where we left off.
    ::
    ?:  ?=(%cancel -.res)
      %-  (tell:l %info (cat 3 'retrying cancelled phone api request %' step) ~)
      ?-  step
          %status
        :_  this
        [(req-api:phone nr %status for.u.rec)]~
      ::
          %verify
        :_  this
        [(req-api:phone nr %verify ~)]~
      ::
          %submit
        ::  we don't store the otp from the user command, so can't retry.
        ::  treat this as failure, make the user re-submit.
        ::
        =.  why  'service error, try again'
        want-otp
      ==
    ?>  ?=(%finished -.res)
    =*  cod  status-code.response-header.res
    =/  jon=json
      ?~  full-file.res  ~
      (fall (de:json:html q.data.u.full-file.res) ~)
    ?-  step
        %status
      ::  for not-ok status codes, abort the registration flow
      ::
      ?.  =(200 cod)
        ~&  [dap.bowl %bad-status cod]
        =.  err-msg  (cat 3 'bad status code ' (scot %ud cod))
        abort
      ::
      =/  sat=(unit [known=? verified=? matching=(unit ?)])
        (parse-status:phone jon)
      ::
      ?~  sat
        ~&  [dap.bowl %bad-status-json jon]
        =.  err-msg
          %^  cat  3  'bad status json: '
          ?~(full-file.res '[missing]' q.data.u.full-file.res)
        abort
      =,  u.sat
      ::  if phone nr has previously been verified by the ship trying to
      ::  register it, short-circuit to success
      ::
      ?:  &(verified (fall matching |))
        =^  caz  +.state  (register [+.state bowl] [id u.rec] ~)
        [caz this]
      ::  otherwise, start verification process
      ::
      [[(req-api:phone nr %verify ~)]~ this]
    ::
        %verify
      ?.  =(200 cod)
        ~&  [dap.bowl %bad-verify cod]
        =.  err-msg  (cat 3 'bad status code ' (scot %ud cod))
        abort
      ::  otp text got sent, ask the user to submit the code
      ::
      =.  why  'submit otp'
      want-otp
    ::
        %submit
      ?:  =(200 cod)
        =^  caz  +.state  (register [+.state bowl] [id u.rec] ~)
        [caz this]
      ::  otp code wasn't correct, but user may retry
      ::
      =.  failed-otp  &
      =.  why  'invalid otp, try again'
      want-otp
    ==
  ::
      [%id %twitter @ %post @ ~]
    =.  kind.log  `%twitter
    ~|  [- +<]:sign
    ?>  ?=([%iris %http-response *] sign)
    =*  res  client-response.sign
    =/  handle  (slav %t i.t.t.wire)
    =/  id      [%twitter handle]
    =/  tweet   (slav %t i.t.t.t.t.wire)
    ::  if the id was removed (cancelled or revoked by the user), no-op
    ::
    ?~  rec=(~(get by records) id)
      [~ this]
    =.  for.log  `for.u.rec
    =*  deets
      :~  %id-kind^'twitter'
          %registrant^(scot %p for.u.rec)
      ==
    ::  we should've put the id into a waiting state with retained work details,
    ::  for which we'll now handle our continuation
    ::
    =/  status  status.u.rec  ::NOTE  to avoid tmi
    ?>  ?=([%wait ~ %want %twitter %post @] status)
    ::  %progress responses are unexpected, the runtime doesn't support them
    ::  right now. if they occur, just treat them as cancels and retry.
    ::
    =?  res  ?=(%progress -.res)
      ~&  [dap.bowl %strange-iris-progress-response]
      [%cancel ~]
    ::  we might get a %cancel if the runtime was restarted during our
    ::  request. try to pick up where we left off.
    ::
    ?:  ?=(%cancel -.res)
      %-  (tell:l %info 'retrying cancelled twitter api request' ~)
      [[(req-post:twitter handle tweet)]~ this]
    ?>  ?=(%finished -.res)
    ::
    =/  result
      (parse-post:twitter [handle nonce.u.pre.status] +.res)
    %-  %+  tell:l  %info
        :~  (cat 3 'twitter api response: %' ?@(result result -.result))
            (cat 3 'status code: ' (crip (a-co:co status-code.response-header.res)))
            ?~  full-file.res  'no body'
            q.data.u.full-file.res
        ==
    ::
    =*  abort
      %-  (tell:l %warn (cat 3 'twitter verification aborted with result %' result) ~)
      =^  caz  +.state  (revoke [+.state bowl] [id rec] 'service error')
      [caz this]
    =*  hold
      %-  (tell:l %info (cat 3 'twitter verification rejected with result %' result) ~)
      ::TODO  include msg in the status?
      =.  status.u.rec  u.pre.status
      =/  why=@t  (cat 3 'tweet rejected, try again: ' result)
      :-  [(give-status for.u.rec id why status.u.rec)]~
      this(records (~(put by records) id u.rec))
    ::TODO  auto-retry when rate-limited? response contains x-rate-limit-reset
    ::      header which has a unix timestamp, so we could get tight here.
    ::      but we probably don't want to squeeze ourselves, instead prevent
    ::      getting into overage in the first place.
    ?-  result
      %rate-limited  hold
      %unauthorized  abort
      %not-found     hold
      %protected     hold
      %bad-handle    hold
      %bad-tweet     hold
      %bad-nonce     hold
      %bad-sign      hold
      %bad           abort
    ::
        [%good @]
      =^  caz  +.state  (register [+.state bowl] [id u.rec] `[%tweet tweet])
      =.  lookups  (~(put by lookups) sig.result id)
      =.  reverse  (~(put ju reverse) id sig.result)
      [caz this]
    ==
  ::
      [%id %website @ %challenge ~]
    =.  kind.log  `%website
    ~|  [- +<]:sign
    ?>  ?=([%iris %http-response *] sign)
    =*  res  client-response.sign
    =/  =turf  (need (de-turf:html (slav %t i.t.t.wire)))
    =/  id     [%website turf]
    ::  if the id was removed (cancelled or revoked by the user), no-op
    ::
    ?~  rec=(~(get by records) id)
      [~ this]
    =.  for.log  `for.u.rec
    ::  we should be awaiting this response to the challenge
    ::
    =/  status  status.u.rec  ::NOTE  to avoid tmi
    ?>  ?=([%wait ~ %want %website %sign @] status)
    ::  %progress responses are unexpected, the runtime doesn't support them
    ::  right now. if they occur, just treat them as cancels and retry.
    ::
    =?  res  ?=(%progress -.res)
      ~&  [dap.bowl %strange-iris-progress-response]
      [%cancel ~]
    ::  we might get a %cancel if the runtime was restarted during our
    ::  request. try to pick up where we left off.
    ::
    ?:  ?=(%cancel -.res)
      %-  (tell:l %info 'retrying cancelled website challenge request' ~)
      [[(req-challenge:website turf)]~ this]
    ?>  ?=(%finished -.res)
    ::
    =/  result=?(%good %bad-res %bad-nonce %bad-sign)
      (parse-challenge:website bowl nonce.u.pre.status full-file.res)
    ::
    ?.  ?=(%good result)
      %-  (tell:l %info (cat 3 'website verification rejected with result %' result) ~)
      =.  status.u.rec  u.pre.status
      =/  why=@t  (cat 3 'well-known rejected, try again: ' result)
      :-  [(give-status for.u.rec id why status.u.rec)]~
      this(records (~(put by records) id u.rec))
    ::
    =/  link=@t  (make-link:website turf)
    =^  caz  +.state  (register [+.state bowl] [id u.rec] `[%link link])
    [caz this]
  ==
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  :_  this
  ?:  ?=([%http-response *] path)
    ~
  ?:  ?=([%endpoint ~] path)
    =/  upd=update
      [%endpoint domain]
    [%give %fact ~ %verifier-update !>(upd)]~
  ?>  ?=([%records @ ~] path)
  =+  who=(slav %p i.t.path)
  ?>  =(src.bowl who)
  =+  %-  ~(rep in (~(get ju owners) who))
      |=  [id=identifier all=(map identifier id-state)]
      (~(put by all) id +>:(~(got by records) id))
  =/  upd=update  [%full all]
  [%give %fact ~ %verifier-update !>(upd)]~
::
++  on-leave  |=(* `this)
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
      [%x %whey ~]
    :^  ~  ~  %mass
    !>  ^-  (list mass)
    :~  'records'^&+records
        'indices'^&+[owners attested lookups reverse]
    ==
  ::
      [?(%x %u) %records user=@ *]
    !!
  ::
      [?(%x %u) %attestations sig=@ ~]
    =/  sig=@ux  (slav %ux i.t.t.path)
    ``loob+!>((~(has by attested) sig))
  ::
      [%x %dbug %state ~]
    =;  typ
      ``noun+!>(;;([%0 typ] state))
    ::  get the state type with lightly obfuscated identifiers,
    ::  to avoid leaking those details to well-intentioned operators
    ::
    =<  state
    %-  verifier
    $%  [%dummy @uw]
        [%urbit @uw]
        [%phone @uw]
        [%twitter @uw]
        [%website (list @uw)]
    ==
  ==
::
++  on-fail
  |=  [=term =tang]
  ^-  (quip card _this)
  %-  (fail:l term tang)
  %-  (slog (rap 3 dap.bowl ' +on-fail: %' term ~) tang)
  [~ this]
--

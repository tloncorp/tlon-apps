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
/-  *verifier
/+  hu=http-utils, dbug, verb, negotiate
::
%-  %-  agent:negotiate
    [notify=| expose=[~.verifier^%0 ~ ~] expect=~]
%-  agent:dbug
%+  verb  |
::
=>
|%
+$  state-0  [%0 state]
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
  ==
::
++  give-endpoint
  |=  base=(unit @t)
  ^-  card
  =/  upd=update
    :-  %endpoint
    ?~(base ~ `(cat 3 u.base (spat binding)))
  [%give %fact ~[/endpoint] %verifier-update !>(upd)]
::
++  give-update
  |=  [for=@p upd=update]
  ^-  card
  [%give %fact ~[/records/(scot %p for)] %verifier-update !>(upd)]
::
++  give-status
  |=  [for=@p id=identifier status=$%([%gone why=@t] status)]
  ^-  card
  (give-update for %status id status)
::
++  give-config
  |=  [for=@p id=identifier =config]
  ^-  card
  (give-update for %config id config)
::
++  req-phone-api
  |=  $:  [base=@t key=@t basic=(unit [user=@t pass=@t])]
          nr=@t
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
::
++  req-twitter-post
  |=  [bearer=@t handle=@t tweet=@t]
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
::
++  parse-twitter-post
  |=  $:  =bowl:gall
          [handle=@t nonce=@ux]
          [hed=response-header:http bod=(unit mime-data:iris)]
      ==
  ^-  ?([%good sig=@ux] %rate-limited %unauthorized %not-found %protected %bad-tweet %bad-nonce %bad-sign %bad)
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
    ?:  !=(u.nom handle)  %bad
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
    =/  pay=(unit payload:twitter)
      ?~  jaw=(rush text pull)  ~
      (biff (mole |.((cue u.jaw))) (soft payload:twitter))
    ?~  pay  %bad-tweet
    ?.  =(nonce.dat.u.pay nonce)  %bad-nonce
    ?:((validate-signature bowl u.pay) [%good sig.u.pay] %bad-sign)
  ==
::
++  validate-signature
  |=  [=bowl:gall sign=(urbit-signature)]
  ^-  ?
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
  :-  [(give-status for.rec id status.rec)]~
  %_  state
    records   (~(put by records) id rec)
    owners    (~(put ju owners) for.rec id)
    attested  (~(gas by attested) sig.half-sign.tat^id sig.full-sign.tat^id ~)
  ==
::
++  sign
  |*  [[our=@p now=@da] dat=*]
  ^-  (urbit-signature _dat)
  =+  =>  [our=our now=now ..lull]  ~+
      ;;(=seed:jael (cue .^(@ %j /(scot %p our)/vile/(scot %da now))))
  ?>  =(who.seed our)
  =/  sig=@ux  (sigh:as:(nol:nu:crub:crypto key.seed) (jam dat))
  [our lyf.seed dat sig]
::
++  attest
  |=  [[our=@p now=@da] for=@p id=identifier proof=(unit proof)]
  ^-  attestation
  :+  now  proof
  :-  (sign [our now] `half-sign-data-0`[%0 %verified now for -.id])
  (sign [our now] `full-sign-data-0`[%0 %verified now for id proof])
::
++  get-allowance
  ::TODO  don't give comets allowance? or just much more stingy?
  |=  [lims=(map @p allowance) for=@p now=@da]
  ^-  allowance
  ?~  lim=(~(get by lims) for)
    %*(. *allowance since now)
  =/  max  *allowance
  =/  d    (sub now since.u.lim)
  :*  now
      (calc-new phone.u.lim phone.max d phone:rates)
      (calc-new tweet.u.lim tweet.max d tweet:rates)
      (calc-new queries.u.lim queries.max d queries:rates)
      (calc-new batch.u.lim batch.max d batch:rates)
      last-batch.u.lim
  ==
::
++  calc-new
  |=  [i=@ud m=@ud d=@dr n=@ud p=@dr]
  ^-  @ud
  (min (add i (calc-gain d n p)) m)
::
++  calc-gain
  |=  [d=@dr n=@ud p=@dr]
  ^-  @ud
  (abs:si (need (toi:rd (mul:rd (sun:rd n) (div:rd (sun:rd `@`d) (sun:rd `@`p))))))
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
::
++  display
  |=  [full=? tat=attestation]
  ^-  octs
  %-  as-octs:mimes:html
  %+  rap  3
  :~  'verified that '
      (scot %p for.dat.half-sign.tat)
      ' has '
    ::
      ?.  full
        ?-  kind.dat.half-sign.tat
          %dummy    'a dummy identifier'
          %urbit    'another urbit'
          %phone    'a phone number'
          %twitter  'an x.com account'
        ==
      =*  id  id.dat.full-sign.tat
      ?-  -.id.dat.full-sign.tat
        %dummy    (cat 3 'dummy id ' +.id)
        %urbit    (cat 3 'control over ' (scot %p +.id))
        %phone    (cat 3 'phone nr ' +.id)
        %twitter  (cat 3 'x.com account @' +.id)
      ==
    ::
      ' on '
      (scot %da (sub when.tat (mod when.tat ~d1)))
  ==
--
::
=|  state-0
=*  state  -
::
^-  agent:gall
|_  =bowl:gall
+*  this  .
::
++  on-save  !>(state)
++  on-init
  ^-  (quip card _this)
  :_  this
  [%pass /eyre %arvo %e %connect [~ binding] dap.bowl]~
::
++  on-load
  |=  ole=vase
  ^-  (quip card _this)
  [~ this(state !<(state-0 ole))]
::
++  on-poke
  |=  [=mark =vase]
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
    ==
  ::
      %verifier-user-command
    =+  !<(cmd=user-command vase)
    ?-  -.cmd
        %start
      ::TODO  careful with moons for ids that require signing, we can't know
      ::      their keys ahead of time...
      ::REVIEW  or is that not a problem, considering the moon will need to
      ::        talk to us before we try verifying?
      ?<  (~(has by records) id.cmd)
      =/  =status
        ?-  -.id.cmd
          %dummy    [%wait ~]
          %urbit    [%want %urbit (~(rad og eny.bowl) 1.000.000)]
          %phone    [%wait ~]
          %twitter  ?>  =(+.id.cmd (crip (cass (trip +.id.cmd))))
                    [%want %twitter %post (end 5 (shas %twitter eny.bowl))]
        ==
      =.  records
        %+  ~(put by records)  id.cmd
        [src.bowl now.bowl *config status]
      =?  limits  ?=(%phone -.id.cmd)
        =/  lim  (get-allowance limits src.bowl now.bowl)
        =.  phone.lim
          ~|  %would-exceed-rate-limit
          (dec phone.lim)
        (~(put by limits) src.bowl lim)
      :_  this
      :+  (give-status src.bowl id.cmd status)
        :+  %pass  [%expire (snoc (id-wire id.cmd) (scot %da now.bowl))]
        [%arvo %b %wait (add now.bowl attempt-timeout)]
      ?.  ?=(%phone -.id.cmd)  ~
      [(req-phone-api phone-api +.id.cmd %status src.bowl)]~
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
      ::TODO  de-dupe with the host command?
      :-  [(give-status src.bowl id.cmd [%gone 'revoked'])]~
      =?  owners    ?=(%done -.status.rec)
        (~(del ju owners) for.rec id.cmd)
      =?  attested  ?=(%done -.status.rec)
        %.  sig.full-sign.status.rec
        %~  del  by
        (~(del by attested) sig.half-sign.status.rec)
      %_  this
        records  (~(del by records) id.cmd)
        lookups  %+  roll  ~(tap in (~(get ju reverse) id.cmd))
                 |=([l=@ =_lookups] (~(del by lookups) l))
        reverse  (~(del by reverse) id.cmd)
      ==
    ::
        %work
      =*  id  id.cmd
      ?-  -.work.cmd
          %urbit
        ?>  ?=(%urbit -.id)
        ::  to complete verification of an urbit,
        ::  the urbit being verified must submit,
        ::  for a pending verification,
        ::  the matching pin.
        ::
        ?>  =(src.bowl +.id)
        =/  rec  (~(got by records) id)
        ?>  ?=([%want %urbit *] status.rec)
        ::TODO  mismatching pin should cancel, or change the pin,
        ::      to prevent brute-forcing
        ?>  =(pin.work.cmd pin.status.rec)
        ::
        ::TODO  should the urbit provide a proof saying "x controls me"?
        ::      wouldn't that be better than a pin anyway?
        =^  caz  +.state  (register [+.state bowl] [id rec] ~)
        [caz this]
      ::
          %phone
        ?>  ?=(%phone -.id)
        =/  rec  (~(got by records) id)
        ?>  =(src.bowl for.rec)
        ?>  =([%want %phone %otp] status.rec)  ::NOTE  tmi
        ::TODO  rate-limit attempts?
        =.  status.rec  [%wait ~]
        :_  this(records (~(put by records) id rec))
        :~  (give-status src.bowl id status.rec)
            (req-phone-api phone-api +.id %submit otp.work.cmd)
        ==
      ::
          %twitter
        ?>  ?=(%twitter -.id)
        =/  rec  (~(got by records) id)
        ?>  =(src.bowl for.rec)
        ?>  |(?=([%want %twitter %post *] status.rec))  ::NOTE  tmi hack
        =.  limits
          =/  lim  (get-allowance limits [src now]:bowl)
          =.  tweet.lim
            ~|  %would-exceed-rate-limit
            (dec tweet.lim)
          (~(put by limits) src.bowl lim)
        =.  status.rec  [%wait `status.rec]
        :_  this(records (~(put by records) id rec))
        :~  (give-status src.bowl id status.rec)
            (req-twitter-post twitter-api +.id id.work.cmd)
        ==
      ==
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
      =?  owners    ?=(%done -.status.rec)
        (~(del ju owners) for.rec id)
      =?  attested  ?=(%done -.status.rec)
        %.  sig.full-sign.status.rec
        %~  del  by
        (~(del by attested) sig.half-sign.status.rec)
      :-  [(give-status for.rec id [%gone 'revoked'])]~
      this(records (~(del by records) id))
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
      %verifier-query
    =+  !<(qer=user-query vase)
    =;  [res=result:query-result nu=_state]
      =.  state  nu
      :_  this
      =/  =cage  [%verifier-result !>([nonce.qer res])]
      [%pass /query/result %agent [src.bowl dude.qer] %poke cage]~
    ?-  +<.qer
        ?(%has-any %valid %whose)
      =/  lims=allowance
        (get-allowance limits src.bowl now.bowl)
      =.  queries.lims
        ~|  %would-exceed-rate-limit
        (dec queries.lims)
      :_  state(limits (~(put by limits) src.bowl lims))
      ?-  +<.qer
          %has-any
        :-  %has-any
        %+  lien  ~(tap in (~(get ju owners) who.qer))
        |=(id=identifier =(-.id kind.qer))
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
      ::REVIEW  sha-256 fine, or do we want sha-512 (or other) for some reason?
      ::
      ::  lims: rate-limiting allowance pool
      ::  bulk: full set to query on
      ::  cost: .batch.lims allowance cost of resolving .bulk
      ::
      =/  lims=allowance
        (get-allowance limits src.bowl now.bowl)
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
        ?:  =(lash last-batch.lims)
          ~(wyt in add.qer)
        ::  if there is discontinuity, consider the entirety of the
        ::  request new, and make them "pay" for each entry
        ::
        ~(wyt in bulk)
      =.  batch.lims
        ~|  %would-exceed-rate-limit
        (sub batch.lims cost)
      =/  salt             (shas %whose-salt eny.bowl)
      =.  last-batch.lims  (shas salt (jam bulk))
      :_  state(limits (~(put by limits) src.bowl lims))
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
    :_  this  ::  never change state
    =+  !<(order:hu vase)
    ?.  ?=(%'GET' method.request)
      (spout:hu id [405 ~] `(as-octs:mimes:html 'read-only'))
    =/  qer=query:hu  (purse:hu url.request)
    =*  fof  (spout:hu id [404 ~] `(as-octs:mimes:html 'not found'))
    ?.  ?=([%verifier *] site.qer)
      fof
    ?+  t.site.qer  fof
        [%attestations @ ~]
      ?~  sig=(slaw %uw i.t.t.site.qer)   fof
      ?~  aid=(~(get by attested) u.sig)  fof
      ?~  rec=(~(get by records) u.aid)   fof
      ?.  ?=(%done -.status.u.rec)        fof
      ?:  =(sig.half-sign.status.u.rec u.sig)
        (spout:hu id [200 ~] `(display | +.status.u.rec))
      ?:  =(sig.full-sign.status.u.rec u.sig)
        (spout:hu id [200 ~] `(display & +.status.u.rec))
      ::  if we make it into this branch our bookkeeping is bad
      ::
      ~&  [dap.bowl %no-such-sig sig=`@uw`u.sig in=u.aid]
      fof
    ::
        [%lookup @ ~]
      ::TODO  any atom format?
      ?~  num=(slaw %uw i.t.t.site.qer)  fof
      ?~  aid=(~(get by lookups) u.num)  fof
      ?~  rec=(~(get by records) u.aid)  fof
      ?.  ?=(%done -.status.u.rec)       fof
      (spout:hu id [200 ~] `(display & +.status.u.rec))
    ==
  ==
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ?:  =(/query/result wire)
    ::  we don't care whether they ack the query response poke or not,
    ::  we did what we had to, everything else is up to them.
    ::
    [~ this]
  ~&  [dap.bowl %on-agent-strange-wire wire]
  ~|  wire
  !!
::
++  on-arvo
  |=  [=wire sign=sign-arvo]
  ^-  (quip card _this)
  ~|  wire=wire
  ?+  wire  ~|(%strange-wire !!)
      [%eyre ~]
    [~ this]  ::TODO  print on bind failure
  ::
      [%expire id-kind @ @ ~]
    ?>  ?=([%behn %wake *] sign)
    ?^  error.sign
      ::TODO  log
      %.  [~ this]
      (slog dap.bowl 'wake failed' u.error.sign)
    =/  id=identifier  (need (wire-id t.wire))
    =/  start=@da      (slav %da i.t.t.t.wire)
    ?~  rec=(~(get by records) id)  [~ this]
    ?.  =(start start.u.rec)        [~ this]
    ?:  ?=(%done -.status.u.rec)    [~ this]
    ~?  ?=(%wait -.status.u.rec)  [dap.bowl %dropped-the-ball -.id]
    ::  registration attempt took too long, abort it
    ::
    :-  [(give-status for.u.rec id [%gone 'registration timed out'])]~
    this(records (~(del by records) id))
  ::
      [%id %phone @ ?(%status %verify %submit) ~]
    ~|  [- +<]:sign
    ?>  ?=([%iris %http-response *] sign)
    =*  res  client-response.sign
    =/  nr  (slav %t i.t.t.wire)
    =/  id  [%phone nr]
    ::  if the id was removed (cancelled or revoked by the user), no-op
    ::
    ?~  rec=(~(get by records) id)
      [~ this]
    ::  we should've put the id into a waiting state,
    ::  for which we'll now handle our continuation
    ::
    ?>  =(%wait -.status.u.rec)  ::NOTE  avoid tmi
    =*  abort
      ::TODO  and log
      :-  [(give-status for.u.rec id [%gone 'service error'])]~
      this(records (~(del by records) id))
    =*  want-otp
      =.  status.u.rec  [%want %phone %otp]
      :_  this(records (~(put by records) id u.rec))
      [(give-status for.u.rec id status.u.rec)]~
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
      ?-  i.t.t.t.wire
          %status
        :_  this
        [(req-phone-api phone-api nr %status for.u.rec)]~
      ::
          %verify
        :_  this
        [(req-phone-api phone-api nr %verify ~)]~
      ::
          %submit
        ::  we don't store the otp from the user command, so can't retry.
        ::  treat this as failure, make the user re-submit.
        ::
        want-otp
      ==
    ?>  ?=(%finished -.res)
    =*  cod  status-code.response-header.res
    =/  jon=json
      ?~  full-file.res  ~
      (fall (de:json:html q.data.u.full-file.res) ~)
    ?-  i.t.t.t.wire
        %status
      ::  for not-ok status codes, abort the registration flow
      ::
      ?.  =(200 cod)
        ~&  [dap.bowl %bad-status cod]
        abort
      =/  sat=(unit [known=? verified=? matching=(unit ?)])
        ?.  ?=([%o *] jon)  ~
        =*  bo  bo:dejs-soft:format
        =/  k  (biff (~(get by p.jon) 'known') bo)
        =/  v  (biff (~(get by p.jon) 'verified') bo)
        =/  m  (biff (~(get by p.jon) 'matchingShip') bo)
        ?.  &(?=(^ k) ?=(^ v))  ~
        `[u.k u.v m]
      ?~  sat
        ~&  [dap.bowl %bad-status-json jon]
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
      [[(req-phone-api phone-api nr %verify ~)]~ this]
    ::
        %verify
      ?.  =(200 cod)
        ~&  [dap.bowl %bad-verify cod]
        abort
      ::  otp text got sent, ask the user to submit the code
      ::
      want-otp
    ::
        %submit
      ?:  =(200 cod)
        =^  caz  +.state  (register [+.state bowl] [id u.rec] ~)
        [caz this]
      ::  otp code wasn't correct, but user may retry
      ::TODO  limit attempts?
      ::
      want-otp
    ==
  ::
      [%id %twitter @ %post @ ~]
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
    ::  we should've put the id into a waiting state with retained work details,
    ::  for which we'll now handle our continuation
    ::
    =/  status  status.u.rec  ::NOTE  to avoid tmi
    ?>  ?=([%wait ~ %want %twitter %post @] status)
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
      :_  this
      [(req-twitter-post twitter-api handle tweet)]~
    ?>  ?=(%finished -.res)
    =/  result
      (parse-twitter-post bowl [handle nonce.u.pre.status] +.res)
    ::TODO  log all non-good results?
    =*  abort
      ::TODO  and log
      :-  [(give-status for.u.rec id [%gone 'service error'])]~
      this(records (~(del by records) id))
    =*  hold
      ::TODO  include msg in the status?
      =.  status.u.rec  u.pre.status
      :-  [(give-status for.u.rec id status.u.rec)]~
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
      :-  %endpoint
      ?~(domain ~ `(cat 3 u.domain (spat binding)))
    [%give %fact ~ %verifier-update !>(upd)]~
  ?>  ?=([%records @ ~] path)
  =+  who=(slav %p i.t.path)
  ?>  =(src.bowl who)
  ::TODO  but looking at owners here means we miss ids in pending states...
  ::      can we just change owners to mean "owners of flows" instead of
  ::      "owners of verifieds"?
  :: =+  %-  ~(rep in (~(get ju owners) who))
  ::     |=  [id=identifier all=(map identifier id-state)]
  ::     (~(put by all) id +>:(~(got by records) id))
  =+  %-  ~(rep by records)
      |=  [[id=identifier =record] all=(map identifier id-state)]
      ?.  =(src.bowl for.record)  all
      (~(put by all) id +>.record)
  =/  upd=update  [%full all]
  [%give %fact ~ %verifier-update !>(upd)]~
::
++  on-leave  |=(* `this)
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
      [?(%x %u) %records user=@ *]
    !!
  ::
      [?(%x %u) %attestations sig=@ ~]
    =/  sig=@ux  (slav %ux i.t.t.path)
    ``loob+!>((~(has by attested) sig))
  ==
::
++  on-fail
  |=  [=term =tang]
  ^-  (quip card _this)
  %.  [~ this]
  (slog (rap 3 dap.bowl ' +on-fail: ' term ~) tang)
--

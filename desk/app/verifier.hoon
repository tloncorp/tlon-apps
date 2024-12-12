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
    %dummy  /dummy/(scot %t +.id)
    %urbit  /urbit/(scot %p +.id)
    %phone  /phone/(scot %t +.id)
  ==
::
++  wire-id
  |=  =wire
  ^-  (unit identifier)
  ?.  ?=([id-kind @ *] wire)  ~
  ?-  i.wire
    %dummy  (bind (slaw %t i.t.wire) (lead %dummy))
    %urbit  (bind (slaw %p i.t.wire) (lead %urbit))
    %phone  (bind (slaw %t i.t.wire) (lead %phone))
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
  |=  [for=@p id=identifier status=?(%gone status)]
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
++  register
  |=  $:  [[%0 state] =bowl:gall]
          [id=identifier rec=record]
          proof=(unit proof)
      ==
  =*  state  +<-<
  ^-  (quip card _state)
  =/  tat=attestation
    (attest our.bowl now.bowl for.rec id proof)
  =.  status.rec  [%done tat]
  :-  [(give-status for.rec id status.rec)]~
  %_  state
    records   (~(put by records) id rec)
    owners    (~(put ju owners) for.rec id)
    attested  (~(gas by attested) sig.half-sign.tat^id sig.full-sign.tat^id ~)
  ==
::
++  sign
  |*  [our=@p now=@da dat=*]
  ^-  (urbit-signature _dat)
  =+  =>  [our=our now=now ..lull]  ~+
      ;;(=seed:jael (cue .^(@ %j /(scot %p our)/vile/(scot %da now))))
  ?>  =(who.seed our)
  =/  sig=@ux  (sigh:as:(nol:nu:crub:crypto key.seed) (jam dat))
  [our lyf.seed dat sig]
::
++  attest
  |=  [our=@p now=@da for=@p id=identifier proof=(unit proof)]
  ^-  attestation
  :+  now  proof
  :-  (sign our now `half-sign-data-0`[%0 %verified now for -.id])
  (sign our now `full-sign-data-0`[%0 %verified now for id proof])
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
          %dummy  'a dummy identifier'
          %urbit  'another urbit'
          %phone  'a phone number'
        ==
      =*  id  id.dat.full-sign.tat
      ?-  -.id.dat.full-sign.tat
        %dummy  (cat 3 'dummy id ' +.id)
        %urbit  (cat 3 'control over ' (scot %p +.id))
        %phone  (cat 3 'phone nr ' +.id)
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
        [%set-domain base=(unit @t)]
      ?:  =(base.q.vase domain)  [~ this]
      :-  [(give-endpoint base.q.vase)]~
      this(domain base.q.vase)
    ==
  ::
      %verifier-user-command
    =+  !<(cmd=user-command vase)
    ?-  -.cmd
        %start
      ?<  (~(has by records) id.cmd)
      =/  =status
        ?-  -.id.cmd
          %dummy  [%wait ~]
          %urbit  [%want %urbit (~(rad og eny.bowl) 1.000.000)]
          %phone  [%wait ~]
        ==
      =.  records
        %+  ~(put by records)  id.cmd
        [src.bowl now.bowl *config status]
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
      :-  [(give-status src.bowl id.cmd %gone)]~
      =?  owners    ?=(%done -.status.rec)
        (~(del ju owners) for.rec id.cmd)
      =?  attested  ?=(%done -.status.rec)
        %.  sig.full-sign.status.rec
        %~  del  by
        (~(del by attested) sig.half-sign.status.rec)
      this(records (~(del by records) id.cmd))
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
        =^  caz  state  (register [state bowl] [id rec] ~)
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
      :-  [(give-status for.rec id %gone)]~
      this(records (~(del by records) id))
    ::
        %dummy
      =/  id=identifier  [%dummy id.cmd]
      =/  rec  (~(got by records) id)
      ?:  ?=(%reject do.cmd)
        $(cmd [%revoke id])
      =^  caz  state  (register [state bowl] [id rec] ~)
      [caz this]
    ==
  ::
      %verifier-query
    ::TODO  crash for rate-limiting
    :_  this
    =+  !<(qer=user-query vase)
    =;  res=(unit _+:*query-result)
      ?~  res  !!
      =/  =cage  [%verifier-result !>([nonce.qer u.res])]
      [%pass /query/result %agent [src.bowl dude.qer] %poke cage]~
    ?-  +<.qer
        %has-any
      :+  ~  %has-any
      %+  lien  ~(tap in (~(get ju owners) who.qer))
      |=(id=identifier =(-.id kind.qer))
    ::
        %valid
      `[%valid (~(has by attested) sig.qer)]
    ::
        %whose
      :+  ~  %whose
      ?~  sat=(~(get by records) id.qer)  ~
      ?.  ?=(%done -.status.u.sat)  ~
      =;  vis=?
        ?:(vis `for.u.sat ~)
      ?-  config.u.sat
        %public  &
        %hidden  |
      ::
          %verified
        %+  lien  ~(tap in (~(get ju owners) src.bowl))
        |=(id=identifier =(-.id -.id.qer))
      ==
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
    :-  [(give-status for.u.rec id %gone)]~
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
      :-  [(give-status for.u.rec id %gone)]~
      this(records (~(del by records) id))
    ::TODO  handle %cancel. retry! or for %submit, set status to %want again?
    ::TODO  what about %progress?
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
        =^  caz  state  (register [state bowl] [id u.rec] ~)
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
      =.  status.u.rec  [%want %phone %otp]
      :_  this(records (~(put by records) id u.rec))
      [(give-status for.u.rec id status.u.rec)]~
    ::
        %submit
      ?:  =(200 cod)
        =^  caz  state  (register [state bowl] [id u.rec] ~)
        [caz this]
      ::  otp code wasn't correct, but user may retry
      ::TODO  limit attempts?
      ::
      =.  status.u.rec  [%want %phone %otp]
      :_  this(records (~(put by records) id u.rec))
      [(give-status for.u.rec id status.u.rec)]~
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

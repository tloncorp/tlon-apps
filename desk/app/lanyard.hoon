::  lanyard: verification service client
::
::    tracks information related to registration and queries made by the local
::    user. this includes status on in-progress registrations, attestations for
::    completes ones, and outstanding queries.
::
::    in response to status and configuration changes, it injects information
::    about the user's registrations into the contacts profile.
::
::    latest api version is v1.
::    poke marks:
::    - %lanyard-command-1: $command:l:verifier
::    - %lanyard-query-1: $query:l:verifier
::    all subscription paths give facts with following mark:
::    - %lanyard-update-1: $update:l:verifier
::    subscription paths:
::    - /v1
::      %lanyard-update-1
::      firehose, everything below
::    - /v1/query
::      %lanyard-update-1 (only %query $updates)
::      all query results
::    - /v1/query/[uv-nonce]
::      %lanyard-update-1 (only %query $updates)
::      results for that nonce
::    - /v1/records
::      %lanyard-update-1 (%full $update as initial response)
::      all registration updates
::
/-  verifier, c=contacts
/+  logs,
    dbug, verb, negotiate
=,  (verifier)
::
%-  %-  agent:negotiate
    [notify=| expose=[~.lanyard^%1 ~ ~] expect=[%verifier^[~.verifier^%0 ~ ~] ~ ~]]
%-  agent:dbug
%+  verb  |
::
=>
|%
++  default  ~patpet-dopped  ::  tlon service provider
+$  state-0
  $:  %0
      records=(map key [=config why=@t =status])   ::  ours
      display=(map key ?(%full %half))             ::  on contacts profile
      ledgers=(map @p (unit @t))                   ::  services w/ base urls
      queries=(map @uv (each [q=question:l a=result:l] question:l))  ::  asked
  ==
+$  key      [h=@p id=identifier]  ::TODO  use more widely
+$  card     card:agent:gall
::
++  join-service
  |=  [our=@p host=@p]
  ^-  (list card)
  :~  [%pass /verifier %agent [host %verifier] %watch /records/(scot %p our)]
      [%pass /verifier/endpoint %agent [host %verifier] %watch /endpoint]
  ==
::
++  sign
  |*  [[our=@p now=@da] dat=*]
  ^-  (signed _dat)
  =+  =>  [our=our now=now ..lull]  ~+
      ;;(=seed:jael (cue .^(@ %j /(scot %p our)/vile/(scot %da now))))
  ?>  =(who.seed our)
  =/  sig=@ux  (sigh:as:(nol:nu:crub:crypto key.seed) (jam dat))
  [our lyf.seed dat sig]
::
++  valid-jam
  |=  [[our=@p now=@da] dat=@]
  ^-  [valid=(unit ?) sig=(unit @ux)]
  =/  sign=(unit (signed))
    %+  biff
      (mole |.((cue dat)))
    (soft (signed ?(half-sign-data full-sign-data)))
  ?~  sign  [`| ~]
  :_  `sig.u.sign
  ::  if we don't know the current life of the signer,
  ::  or the life used to sign is beyond what we know,
  ::  we can't validate locally.
  ::
  =+  .^(lyf=(unit life) %j /(scot %p our)/lyfe/(scot %da now)/(scot %p who.u.sign))
  ?~  |(?=(~ lyf) (gth lyf.u.sign u.lyf))
    ~
  ::  jael should have the pubkey. get it and validate.
  ::
  =+  .^([life =pass (unit @ux)] %j /(scot %p our)/deed/(scot %da now)/(scot %p who.u.sign)/(scot %ud lyf.u.sign))
  `(safe:as:(com:nu:crub:crypto pass) sig.u.sign (jam dat.u.sign))
::
++  inflate-contacts-profile
  |=  $:  [our=@p now=@da]
          records=(map key [=config @t =status])
          display=(map key ?(%half %full))
          ledgers=(map @p (unit @t))
      ==
  ^-  (unit card)
  ::  if the contacts agent isn't running, that's slightly unexpected
  ::  (but not impossible). we choose to no-op for now.
  ::
  ?.  .^(? %gu /(scot %p our)/contacts/(scot %da now)/$)
    ~
  =+  =>  [our=our now=now c=c ..lull]  ~+
      .^(orig=contact:c %gx /(scot %p our)/contacts/(scot %da now)/v1/self/contact-1)
  ::  build a new contact to submit
  ::
  =;  =contact:c
    ?:  =(orig contact)  ~
    =/  =action:c  [%self contact]
    =/  =cage      [%contact-action-1 !>(action)]
    `[%pass /contacts/set %agent [our %contacts] %poke cage]
  %-  ~(gas by *contact:c)
  ::  start by clearing out all our entries for a fresh start
  ::
  %+  weld
    %+  turn  ~(tap by orig)
    |=  [=term =value:c]
    :-  term
    ?:(=(%lanyard- (end 3^8 term)) ~ value)
  ^-  (list [term value:c])
  ::  then look at our records and inject as appropriate
  ::
  =<  out
  %-  ~(rep by display)
  |^  |=  $:  [=key lev=?(%half %full)]
              counts=(map id-kind @ud)
              out=(list [term value:c])
          ==
      =+  n=(~(gut by counts) -.id.key 0)
      :-  (~(put by counts) -.id.key +(n))
      ?~  rec=(~(get by records) key)  out
      (weld out (make-details key n ?=(%full lev)))
  ::
  ++  make-details
    |=  [=key num=@ud ful=?]
    ^-  (list [term value:c])
    ?~  rec=(~(get by records) key)  ~
    ?.  ?=(%done -.status.u.rec)  ~
    =/  nom  (cury (cury make-name -.id.key) num)
    =/  dat=(signed ?(half-sign-data full-sign-data))
      ?:  ful  full.status.u.rec
      half.status.u.rec
    =;  dats=(list (unit [term value:c]))
      (murn dats same)
    :~  `[(nom %since) [%date when.dat.dat]]
        `[(nom %sign) [%text (scot %uw (jam dat))]]
      ::
        ?~  url=(make-url h.key sig.dat)  ~
        `[(nom %url) [%text u.url]]
      ::
        ?.  ful  ~
        =-  `[(nom %value) [%text -]]
        ?>  ?=(%full +>-.dat.dat)
        =*  id  id.dat.dat
        ?-  -.id
          %dummy    +.id
          %urbit    (scot %p +.id)
          %phone    +.id
          %twitter  +.id
          %website  (en-turf:html +.id)
        ==
    ==
  ::
  ++  make-name
    |=  [kin=id-kind num=@ud etc=term]
    ^-  term
    (rap 3 %lanyard- kin '-' (crip (a-co:co num)) '-' etc ~)
  ::
  ++  make-url
    |=  [h=@p sig=@]
    %+  bind  (~(gut by ledgers) h ~)
    |=  base=@t
    (rap 3 base '/attestations/' (scot %uw sig) ~)
  --
::
++  lo
  |_  [our=@p host=(unit @p) kind=(unit @t)]
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
  ++  deez
    ^-  (list [@t json])
    :-  %flow^s+'verifier'
    =;  l=(list (unit [@t json]))
      (murn l same)
    :~  ?~(host ~ `[%service s+(scot %p u.host)])
        ?~(kind ~ `[%id-kind s+u.kind])
    ==
  ::
  ++  link
    |=  cad=card
    |*  [caz=(list card) etc=*]
    [[cad caz] etc]
  --
::
++  vp
  |=  [v=?(%v1) p=(list path)]
  ^+  p
  (turn p (lead v))
--
::
=|  state-0
=*  state  -
::
=+  log=lo
::
^-  agent:gall
|_  =bowl:gall
+*  this  .
    lo    log(our our.bowl)
::
++  on-save  !>(state)
++  on-init
  ^-  (quip card _this)
  ::  ahead-of-time subscribe to the default service provider,
  ::  (for easier post-nuke (or post-breach) restoration,)
  ::  and make sure our contacts profile is "clean", matching our empty state.
  ::
  :_  this(ledgers (~(put by ledgers) default ~))
  %+  weld
    (join-service our.bowl default)
  (drop (inflate-contacts-profile [our now]:bowl records display ledgers))
::
++  on-load
  |=  ole=vase
  ^-  (quip card _this)
  =.  state  !<(state-0 ole)
  :_  this
  (drop (inflate-contacts-profile [our now]:bowl records display ledgers))
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ~|  [%on-poke mark=mark]
  ?+  mark  !!
      %noun
    ?.  ?=([@ *] q.vase)  !!
    $(mark -.q.vase, vase (slot 3 vase))
  ::
      %json  ::TMP
    =;  cmd=command:l
      $(mark %lanyard-command-1, vase !>(-))
    %.  !<(jon=json vase)
    =,  dejs:format
    =/  pid   'id'^(of %dummy^so %urbit^(se %p) %phone^so %twitter^so ~)
    =/  pork  'work'^(of %phone^(ot 'otp'^so ~) ~)
    %-  ot
    :~  'host'^(mu (se %p))
        'command'^(of %start^(ot pid ~) %work^(ot pid pork ~) ~)
    ==
  ::
      %lanyard-command-1
    =+  !<(cmd=command:l vase)
    =/  host=@p
      ?~(host.cmd default u.host.cmd)
    ::  sometimes we may do work "for others"
    ::
    ?:  ?=(%work-for +<.cmd)
      :_  this
      =/  cmd=user-command
        :+  %work  [%urbit our.bowl]
        ::  sign to prove we are the same person as for.cmd
        ::
        :-  %urbit
        %+  sign  [our now]:bowl
        ^-  sign-data:urbit
        [%urbit %0 for.cmd nonce.cmd]
      =/  =cage
        [%verifier-user-command !>(`user-command`cmd)]
      [%pass /verifier/work-for %agent [host %verifier] %poke cage]~
    ::  normalize the identifier and construct the global key
    ::
    =.  cmd
      ?+  cmd  cmd
        [* @ %twitter @]      cmd(+.id (crip (cass (trip +.id.cmd))))
        [* @ [%twitter @] *]  cmd(+.id (crip (cass (trip +.id.cmd))))
      ==
    =/  key
      :-  host
      ?-(+<.cmd ?(%start %revoke) id.cmd, ?(%config %work %profile) id.cmd)
    ::  handle local commands locally
    ::
    ?:  ?=(%profile +<.cmd)
      =.  display
        ?:  ?=(%none show.cmd)  (~(del by display) key)
        (~(put by display) key show.cmd)
      :_  this
      (drop (inflate-contacts-profile [our now]:bowl records display ledgers))
    ::  if the target service is unknown, do setup for it
    ::
    =^  caz  this
      ?:  (~(has by ledgers) host)  [~ this]
      :-  (join-service our.bowl host)
      this(ledgers (~(put by ledgers) host ~))
    ::  can only %start ids we haven't already worked with,
    ::  cannot do anything but %start ids we've never worked with.
    ::
    ?>  !=(?=(%start +<.cmd) (~(has by records) key))
    ::  we apply creation eagerly, but don't apply revocation eagerly:
    ::  we can't re-start the identifier until the host has acknowledged
    ::  the revocation anyway, lest we become unable to disambiguate the
    ::  %gone update for the one we revoked vs the new one we started.
    ::
    :_  =?  records  ?=(%start +<.cmd)
          (~(put by records) key *config 'starting' %wait ~)
        this
    ::NOTE  important to do setup before we poke, and important that the
    ::      /records subscription has the same wire as the below poke,
    ::      so that they get handled in the specified order.
    %+  weld  caz
    ^-  (list card)
    :-  =/  =cage
          [%verifier-user-command !>(`user-command`+.cmd)]
        [%pass /verifier %agent [host %verifier] %poke cage]
    ?.  ?=(%start +<.cmd)  ~
    =/  upd=update:l  [%status key 'starting' %wait ~]
    [%give %fact (vp %v1 ~[/ /records]) %lanyard-update-1 !>(upd)]~
  ::
      %lanyard-query-1
    =+  !<(qer=query:l vase)
    =/  [host=@p nonce=@]
      :-  ?~(host.qer default u.host.qer)
      ?^  nonce.qer  u.nonce.qer
      =+  non=(end 6 eny.bowl)
      |-(?:((~(has by queries) non) $(non +(non)) non))
    ?<  (~(has by queries) nonce)
    ?.  ?=(%valid-jam -.query.qer)
      :_  this(queries (~(put by queries) nonce [%| query.qer]))
      ::TODO  time out query responses?
      =/  =cage
        [%verifier-user-query !>(`user-query`[[dap.bowl nonce] query.qer])]
      [%pass /query/(scot %uv nonce) %agent [host %verifier] %poke cage]~
    ::  handle %valid-jam queries locally first, we should be able to say
    ::  something about the signature without going over the network.
    ::
    ::NOTE  this only validates the jam on its own merits (as a $signed),
    ::      the client is responsible for making sure it's not validating
    ::      e.g. a %website signature when it's presented as an %urbit one.
    ::
    ::  valid: if we know, validity of the signature
    ::  sig:   the signature being validated. if ~, valid is always |.
    ::
    =/  [valid=(unit ?) sig=(unit @ux)]
      (valid-jam [our now]:bowl +.query.qer)
    =.  queries
      %+  ~(put by queries)  nonce
      ?~  valid  [%| query.qer]
      [%& query.qer %valid-jam u.valid]
    :_  this
    =*  give
      =/  upd=update:l  [%query nonce %valid-jam (need valid)]
      [%give %fact (vp %v1 ~[/ /query /query/(scot %uv nonce)]) %lanyard-update-1 !>(upd)]
    =*  ask
      =/  =cage
        [%verifier-user-query !>(`user-query`[[dap.bowl nonce] %valid u.sig])]
      [%pass /query/(scot %uv nonce) %agent [host %verifier] %poke cage]
    ?~  sig      [give]~  ::  can't ask, give our result
    ?~  valid    [ask]~   ::  don't know, defer to service
    ?.  u.valid  [give]~  ::  invalid, no need to ask further
    [ask]~                ::  seems valid, ask service
  ::
      %verifier-result
    =+  !<(res=query-result vase)
    =/  qer  (~(got by queries) nonce.res)
    =/  qes
      ?-  -.qer
        %|  p.qer
        %&  q.p.qer
      ==
    =/  rez=result:l
      ?.  ?=(%valid-jam -.qes)    +.res
      ?:  ?=(%rate-limit +<.res)  +.res
      ?>  ?=(%valid +<.res)
      [%valid-jam & valid.res]
    ::  we don't keep query results around in state right now,
    ::  instead relying purely on subscription updates to get the result out.
    ::
    :_  this(queries (~(del by queries) nonce.res))
    =/  upd=update:l  [%query nonce.res rez]
    [%give %fact (vp %v1 ~[/ /query /query/(scot %uv nonce.res)]) %lanyard-update-1 !>(upd)]~
  ==
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ~|  wire=wire
  ?+  wire  !!
    [%logs ~]  [~ this]
  ::
      [%verifier ?(~ [?(%endpoint %work-for) ~])]
    =*  host  src.bowl
    =.  host.log  `host
    ?.  (~(has by ledgers) host)
      ::  we don't care for this ledger anymore, should've cleaned up,
      ::  make doubly-sure here.
      ::
      ~&  [dap.bowl %uninterested host -.sign]
      %-  (tell:lo %warn (cat 3 'uninterested in %' -.sign) ~)
      :_  this
      ?.  ?=(%fact -.sign)  ~
      [%pass wire %agent [host %verifier] %leave ~]~
    ?-  -.sign
        %poke-ack
      ?<  ?=([%endpoint ~] t.wire)  ::NOTE  no pokes on /endpoint
      ?~  p.sign
        ::  the command is being processed, we'll get updates as facts
        ::  on our subscription
        ::
        ::TODO  for /work-for, tell client the operation succeeded?
        [~ this]
      ::  the command failed to process, which is generally unexpected.
      ::  (we should have checked for sanity based on local state beforehand.)
      ::  resubscribe to get the full state again.
      ::TODO  and bubble action failure up to the client
      %-  (slog 'lanyard: poke-nacked' u.p.sign)
      %-  (tell:lo %warn 'poke-nacked' u.p.sign)
      ::
      :_  this
      =/  =dock  [host %verifier]
      :~  [%pass /verifier %agent dock %leave ~]
          [%pass /verifier %agent dock %watch /records/(scot %p our.bowl)]
      ==
    ::
        %watch-ack
      ?~  p.sign  [~ this]
      ::TODO  track verifier connection status?
      ::      or say "should never happen" because of version negotiation?
      %-  (tell:lo %warn 'verifier subscription nacked' u.p.sign)
      %-  (slog 'failed verifier sub' >host< u.p.sign)
      [~ this]
    ::
        %kick
      :_  this
      ::NOTE  this will give us a fresh %full %verifier-update, which will
      ::      guarantee we regain consistency with the host. handling of other
      ::      facts below therefore isn't afraid to crash in unexpected
      ::      scenarios.
      =/  =path  ?~(t.wire /records/(scot %p our.bowl) /endpoint)
      [%pass wire %agent [default %verifier] %watch path]~
    ::
        %fact
      ?.  =(%verifier-update p.cage.sign)
        %-  (tell:lo %warn (cat 3 'unexpected fact from verifier: %' p.cage.sign) ~)
        ~&  [dap.bowl %unexpected-verifier-fact p.cage.sign]
        [~ this]
      =+  !<(upd=update q.cage.sign)
      ?-  -.upd
          %full
        ::  update our state to match what we received,
        ::  making sure to drop removed entries for this host
        ::
        =.  records
          (my (skip ~(tap by records) |*(* =(+<-< host))))
        =/  new=_records
          %-  malt  ::NOTE  +my doesn't work lol
          %+  turn  ~(tap by all.upd)
          |=  [id=identifier id-state]
          :-  [host id]
          [config '' status]  ::NOTE  only scenario where .why is empty string
        =.  records  (~(uni by records) new)
        :_  this
        :_  (drop (inflate-contacts-profile [our now]:bowl records display ledgers))
        =/  upd=update:l  [%full new]
        [%give %fact (vp %v1 ~[/ /records]) %lanyard-update-1 !>(upd)]
      ::
          %config
        =*  key  [host id.upd]
        =.  records
          =+  rec=(~(got by records) key)
          (~(put by records) key rec(config config.upd))
        :_  this
        =/  upd=update:l  upd(id key)
        [%give %fact (vp %v1 ~[/ /records]) %lanyard-update-1 !>(upd)]~
      ::
          %status
        =*  key  [host id.upd]
        =.  records
          =+  rec=(~(gut by records) key *[=config why=@t =status])
          ?:  ?=(%gone -.status.upd)  (~(del by records) key)
          (~(put by records) key rec(status status.upd))
        =?  display  ?=(%gone -.status.upd)
          (~(del by display) key)
        :_  this
        :-  =/  upd=update:l  upd(id key)
            [%give %fact (vp %v1 ~[/ /records]) %lanyard-update-1 !>(upd)]
        %-  zing
        ^-  (list (list card))
        :~  ::  update the contacts profile if needed
            ::
            ?.  ?=(?(%gone %done) -.status.upd)  ~
            (drop (inflate-contacts-profile [our now]:bowl records display ledgers))
          ::
            ::  if the update says we need to verify our domain,
            ::  and we know this ship is serving on that domain,
            ::  put the challenge in the cache, and prompt the
            ::  service to check it.
            ::NOTE  we don't care about clearing this cache entry even when
            ::      registration completes. the part of the .well-known
            ::      namespace we bind to is "ours", and gets recycled for
            ::      the next relevant registration anyway.
            ::
            ?.  ?&  ?=(%website -.id.upd)
                    ?=([%want %website %sign *] status.upd)
                  ::
                    =+  bas=(cat 3 'https://' (en-turf:html +.id.upd))
                    =-  =(bas (end 3^(met 3 bas) (fall - '')))
                    .^((unit @t) %ex /(scot %p our.bowl)//(scot %da now.bowl)/eauth/url)
                ==
              ~
            :~  :+  %pass  /id/(scot %p -.key)/website/(scot %t (en-turf:html +.id.upd))
                =;  entry=cache-entry:eyre
                  [%arvo %e %set-response well-known:website `entry]
                =;  pay=payload:website
                  [| %payload [200 ~] `(as-octs:mimes:html (jam pay))]
                (^sign [our now]:bowl %website %0 [+.id nonce.status]:upd)
              ::
                =/  =cage
                  :-  %verifier-user-command
                  !>(`user-command`[%work id.upd %website %sign])
                [%pass /verifier %agent [host %verifier] %poke cage]
            ==
        ==
      ::
          %endpoint
        ?:  =(base.upd (~(got by ledgers) host))  [~ this]
        =.  ledgers  (~(put by ledgers) host base.upd)
        :_  this
        (drop (inflate-contacts-profile [our now]:bowl records display ledgers))
      ==
    ==
  ::
      [%query @ ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  [~ this]
    ::  query failed
    ::
    =/  nonce=@  (slav %uv i.t.wire)
    ::  we don't keep query results around in state right now,
    ::  instead relying purely on subscription updates to get the result out.
    ::
    :_  this(queries (~(del by queries) nonce))
    =/  upd=update:l  [%query nonce %fail 'poke nacked']
    [%give %fact (vp %v1 ~[/ /query /query/[i.t.wire]]) %lanyard-update-1 !>(upd)]~
  ::
      [%contacts %set ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  [~ this]
    %-  (tell:lo %crit 'failed to update contacts' u.p.sign)
    %-  (slog (cat 3 dap.bowl ': failed to update contacts') u.p.sign)
    [~ this]
  ==
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  :_  this
  ?>  ?=([%v1 *] path)
  =/  path  t.path
  ?+  path  !!
    ~             ~  ::TODO  include initial response?
    [%query ~]    ~
    [%query @ ~]  =<(~ (slav %uv i.t.path))
    [%records ~]  [%give %fact ~ %lanyard-update-1 !>(`update:l`[%full records])]~
  ==
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  =.  path  ::TODO  hack
    ?>  ?=([%x *] path)
    t.path
  ?.  ?=([%v1 *] path)  [~ ~]
  =/  path  t.path
  ?+  path  [~ ~]
    ~             ``noun+!>([records display ledgers queries])
    [%records ~]  ``noun+!>(records)
  ::
      [%records %json ~]  ::TMP
    :^  ~  ~  %json
    !>  ^-  json
    =,  enjs:format
    :-  %a
    %+  turn  ~(tap by records)
    |=  [[h=@p id=identifier] =config why=@t =status]
    ^-  json
    %-  pairs
    :~  :-  'identifier'
        %+  frond  -.id
        ?-  -.id
          %dummy    [%s +.id]
          %urbit    [%s (scot %p +.id)]
          %phone    [%s +.id]
          %twitter  [%s +.id]
          %website  [%s (en-turf:html +.id)]
        ==
      ::
        :-  'record'
        %-  pairs
        :~  'config'^[%o 'discoverable'^s+discoverable.config ~ ~]
            'status'^[%s -.status]
            'why'^[%s why]
        ==
    ==
  ::
      [%record ?([@ @ ~] [@ @ @ ~])]
    =;  key=[@p identifier]
      ``noun+!>((~(got by records) key))
    :-  ?:(?=([@ @ ~] t.path) default (slav %p i.t.path))
    =/  dip  ?:(?=([@ @ ~] t.path) t.path t.t.path)
    ?+  dip  !!
      [%dummy @ ~]    [-.dip (slav %t +<.dip)]
      [%urbit @ ~]    [-.dip (slav %p +<.dip)]
      [%phone @ ~]    [-.dip (slav %t +<.dip)]
      [%twitter @ ~]  [-.dip (slav %t +<.dip)]
      [%website @ ~]  [-.dip (need (de-turf:html (slav %t +<.dip)))]
    ==
  ::
    [%display ~]    ``noun+!>(display)
    [%queries ~]    ``noun+!>(queries)
    [%queries @ ~]  ``noun+!>((~(got by queries) (slav %uv i.t.path)))
  ::
      [%proof ?(%twitter %website) ?(%jam %url %text %bundle) ?([@ ~] [@ @ ~])]
    =/  key=[@p $>(?(%twitter %website) identifier)]
      =*  k  t.t.t.path
      =*  i  ?:(?=([@ ~] k) i.k i.t.k)
      :-  ?:(?=([@ ~] k) default (slav %p i.k))
      ::TODO  use +wire-id and friends?
      ?-  i.t.path
        %twitter  [%twitter (slav %t i)]
        %website  [%website (need (de-turf:html (slav %t i)))]
      ==
    ?~  rec=(~(get by records) key)  ~
    =/  pay=(unit (signed))
      ?+  status.u.rec  ~
          [%want %twitter %post *]
        ^-  (unit payload:twitter)
        ?>  ?=(%twitter +<.key)
        `(sign [our now]:bowl [%twitter %0 +>.key nonce.status.u.rec])
      ::
          [%want %website %sign *]
        ^-  (unit payload:website)
        ?>  ?=(%website +<.key)
        `(sign [our now]:bowl [%website %0 +>.key nonce.status.u.rec])
      ==
    ?~  pay  ~
    =*  jam  (^jam u.pay)
    =*  url  %+  rap  3
             :~  (fall (~(gut by ledgers) -.key ~) '')
                 '/lookup/'
                 (scot %uw sig.u.pay)
             ==
    ?-  i.t.t.path
      %jam  ``jam+!>(jam)
      %url  ``tape+!>((trip url))
    ::
        %text
      :^  ~  ~  %tape
      !>  %-  trip
      %+  rap  3
      :~  'Verifying myself: I am '  (scot %p our.bowl)  ' on Urbit.\0a\0a'
          (crip ((w-co:co 1) jam))  '\0a'
          url
      ==
    ::
      %bundle  ``noun+!>([(crip ((w-co:co 1) jam)) url])
    ==
  ::
      [%valid-jam @ ~]
    =/  dat=@  (slav %uw i.t.path)
    =+  (valid-jam [our now]:bowl dat)
    ``noun+!>(valid)
  ==
::
++  on-leave  |=(* `this)
++  on-arvo   |=(* `this)
::
++  on-fail
  |=  [=term =tang]
  ^-  (quip card _this)
  %-  (fail:lo term tang)
  %-  (slog (rap 3 dap.bowl ' +on-fail: %' term ~) tang)
  [~ this]
--

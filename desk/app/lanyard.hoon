::  lanyard: verification service client
::
::    xx overview
::    remembers state concerning ourselves and
::
::    xx intended usage
::
::    xx api
::
/-  *verifier, c=contacts
/+  dbug, verb, negotiate
::
%-  %-  agent:negotiate
    [notify=| expose=[~.lanyard^%0 ~ ~] expect=[%verifier^[~.verifier^%0 ~ ~] ~ ~]]
%-  agent:dbug
%+  verb  |
::
=>
|%
++  default  ~mapryl-bolnub-palfun-foslup  ::TODO
+$  state-0
  $:  %0
      records=(map [h=@p id=identifier] id-state)  ::  ours
      provers=(map identifier @p)                  ::  from  ::TODO  unused
      ledgers=(map @p (unit @t))                   ::  services w/ base urls
      queries=(map @uv (each [q=question:l a=result:l] question:l))  ::  asked
  ==
+$  card     card:agent:gall
::
++  join-service
  |=  [our=@p host=@p]
  ^-  (list card)
  :~  [%pass /verifier %agent [host %verifier] %watch /records/(scot %p our)]
      [%pass /verifier/endpoint %agent [host %verifier] %watch /endpoint]
  ==
::
++  inflate-contacts-profile
  |=  $:  [our=@p now=@da]
          records=(map [h=@p id=identifier] id-state)
          ledgers=(map @p (unit @t))
      ==
  ^-  (unit card)
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
    %+  skip  ~(tap by orig)
    |=  [=term *]
    =(%lanyard- (end 3^8 term))
  ^-  (list [term value:c])
  ::  then look at our records and inject as appropriate
  ::
  =+  %+  roll  ~(tap by records)
      |=  $:  [[h=@p id=identifier] id-state]
              urbits=(map @p [h=@p (urbit-signature full-sign-data-0)])
              phone=(unit [h=@p (urbit-signature half-sign-data-0)])
          ==
      =*  nop  [urbits phone]
      ?.  ?=(%done -.status)  nop
      ::TODO  check privacy control? if we do, make %config facts call this too.
      ::TODO  for duplicates, don't overwrite versions that are clickable,
      ::      with unclickable versions
      ?-  -.id
        %dummy  nop
        %urbit  [(~(put by urbits) +.id h full-sign.status) phone]
        %phone  [urbits `[h half-sign.status]]
      ==
  =/  make-url
    |=  [h=@p sig=@]
    %+  bind  (~(gut by ledgers) h ~)
    |=  base=@t
    (rap 3 base '/attestations/' (scot %uw sig) ~)
  %+  weld
    ::  for "has verified a phone nr" status
    ::
    ^-  (list [term value:c])
    ?~  phone  ~
    ~?  !?=(%phone kind.dat.u.phone)  [%lanyard %strange-phone-sign-mismatch kind.dat.u.phone]
    :+  [%lanyard-tmp-phone-since %date when.dat.u.phone]
      [%lanyard-tmp-phone-sign %text (scot %uw (jam +.u.phone))]
    ?~  url=(make-url h.u.phone sig.u.phone)  ~
    [%lanyard-tmp-phone-url %text u.url]~
  ::  for "also knows as" display
  ::
  ^-  (list [term value:c])
  ?:  =(~ urbits)  ~
  :-  [%lanyard-tmp-urbits %set (~(run in ~(key by urbits)) (lead %ship))]
  %-  zing
  %+  turn  ~(tap by urbits)
  |=  [who=@p h=@p sign=(urbit-signature full-sign-data-0)]
  ^-  (list [term value:c])
  :-  :_  [%text (scot %uw (jam sign))]
      (rap 3 %lanyard-tmp-urbit- (rsh 3^1 (scot %p who)) '-sign' ~)
  ?~  url=(make-url h sig.sign)  ~
  :_  ~
  :_  [%text u.url]
  (rap 3 %lanyard-tmp-urbit- (rsh 3^1 (scot %p who)) '-url' ~)
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
  [~ this]
::
++  on-load
  |=  ole=vase
  ^-  (quip card _this)
  =.  state  !<(state-0 ole)
  :_  this
  (drop (inflate-contacts-profile [our now]:bowl records ledgers))
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
      %lanyard-command
    =+  !<(cmd=command:l vase)
    =/  host=@p
      ?~(host.cmd default u.host.cmd)
    =/  key
      :-  host
      ?-(+<.cmd ?(%start %revoke) id.cmd, ?(%config %work) id.cmd)
    ::  if the target service is unknown, do setup for it
    ::
    =^  caz  this
      ::REVIEW  is this check a mistake? should we check for subs in the bowl?
      ?:  (~(has by ledgers) host)  [~ this]
      :-  (join-service our.bowl host)
      this(ledgers (~(put by ledgers) host ~))
    ::  can only %start ids we haven't already worked with,
    ::  cannot do anything but %start ids we've never worked with.
    ::
    ?>  !=(?=(%start +<.cmd) (~(has by records) key))
    ::  we apply creation eagerly, but don't apply revocation eagerly:
    ::  we can't re-start the identifier until the host has acknowledged
    ::  the revocation anyway.
    ::
    :_  =?  records  ?=(%start +<.cmd)
          (~(put by records) key *config %wait ~)
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
    =/  upd=update:l  [%status key %wait ~]
    [%give %fact ~[/ /records] %lanyard-update !>(upd)]~
  ::
      %lanyard-query
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
        [%verifier-query !>(`user-query`[[dap.bowl nonce] query.qer])]
      [%pass /query/(scot %uv nonce) %agent [host %verifier] %poke cage]~
    ::  handle %valid-jam queries locally first, we should be able to say
    ::  something about the signature without going over the network.
    ::
    ::TODO  should this check for expected kind/id too?
    ::      otherwise you could inject any valid signature and it'd
    ::      show up as "yes legit", despite not matching what it was
    ::      displayed as...
    ::      but that (like the cue & soft) is something the client could check..
    ::
    ::  valid: if we know, validity of the signature
    ::  sig:   the signature being validated. if ~, valid is always |.
    ::
    =/  [valid=(unit ?) sig=(unit @ux)]
      =/  sign=(unit (urbit-signature))
        %+  biff
          (mole |.((cue +.query.qer)))
        (soft (urbit-signature ?(half-sign-data-0 full-sign-data-0)))
      ?~  sign  [`| ~]
      :_  `sig.u.sign
      ::  if we don't know the current life of the signer,
      ::  or the life used to sign is beyond what we know,
      ::  we can't validate locally.
      ::
      =+  .^(lyf=(unit life) %j /(scot %p our.bowl)/lyfe/(scot %da now.bowl)/(scot %p who.u.sign))
      ?~  |(?=(~ lyf) (gth lyf.u.sign u.lyf))
        ~
      ::  jael should have the pubkey. get it and validate.
      ::
      =+  .^([life =pass (unit @ux)] %j /(scot %p our.bowl)/deed/(scot %da now.bowl)/(scot %p who.u.sign)/(scot %ud lyf.u.sign))
      `(safe:as:(com:nu:crub:crypto pass) sig.u.sign (jam dat.u.sign))
    =.  queries
      %+  ~(put by queries)  nonce
      ?~  valid  [%| query.qer]
      [%& query.qer %valid-jam u.valid]
    :_  this
    =*  give
      =/  upd=update:l  [%query nonce %valid-jam (need valid)]
      [%give %fact ~[/ /query /query/(scot %uv nonce)] %lanyard-update !>(upd)]
    =*  ask
      =/  =cage
        [%verifier-query !>(`user-query`[[dap.bowl nonce] %valid u.sig])]
      [%pass /query/(scot %uv nonce) %agent [host %verifier] %poke cage]
    ?~  sig      [give]~  ::  can't ask, give our result
    ?~  valid    [ask]~   ::  don't know, defer to service
    ?.  u.valid  [give]~  ::  invalid, no need to ask further
    ~[ask give]           ::  valid, give intermediate result and ask service
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
      ?.  ?=(%valid-jam -.qes)  +.res
      ?>  ?=(%valid +<.res)
      [%valid-jam & valid.res]
    ::TODO  mark result for deletion after time?
    :_  this(queries (~(put by queries) nonce.res [%& qes rez]))
    =/  upd=update:l  [%query res]  ::TODO  different?
    [%give %fact ~[/ /query /query/(scot %uv nonce.res)] %lanyard-update !>(upd)]~
  ==
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ~|  wire=wire
  ?+  wire  !!
      [%verifier ?(~ [%endpoint ~])]
    ?.  (~(has by ledgers) src.bowl)
      ::  we don't care for this ledger anymore, should've cleaned up,
      ::  make doubly-sure here.
      ::
      ~&  [dap.bowl %uninterested src.bowl -.sign]
      :_  this
      ?.  ?=(%fact -.sign)  ~
      [%pass wire %agent [src.bowl %verifier] %leave ~]~
    ?-  -.sign
        %poke-ack
      ?>  ?=(~ t.wire)  ::NOTE  no pokes on /endpoint
      ?~  p.sign
        ::  the command is being processed, we'll get updates as facts
        ::  on our subscription
        ::
        [~ this]
      ::  the command failed to process, which is generally unexpected.
      ::  (we should have checked for sanity based on local state beforehand.)
      ::  resubscribe to get the full state again.
      ::TODO  and bubble action failure up to the client
      ::
      :_  this
      =/  =dock  [src.bowl %verifier]
      :~  [%pass /verifier %agent dock %leave ~]
          [%pass /verifier %agent dock %watch /records/(scot %p our.bowl)]
      ==
    ::
        %watch-ack
      ?~  p.sign  [~ this]
      %.  [~ this]
      ::TODO  track verifier connection status?
      ::      or say "should never happen" because of version negotiation?
      (slog 'failed verifier sub' >src.bowl< u.p.sign)
    ::
        %kick
      :_  this
      ::NOTE  this will give us a fresh %full %verifier-update, which will
      ::      guarantee we regain consistency with the host. handling of other
      ::      facts below therefore isn't afraid to crash in unexpected
      ::      scenarios.
      =/  =path  ?~(t.wire /endpoint /records/(scot %p our.bowl))
      [%pass /verifier %agent [default %verifier] %watch path]~
    ::
        %fact
      ?.  =(%verifier-update p.cage.sign)
        ~&  [dap.bowl %unexpected-verifier-fact p.cage.sign]
        [~ this]
      =+  !<(upd=update q.cage.sign)
      ?-  -.upd
          %full
        ::  update our state to match what we received,
        ::  making sure to drop removed entries for this host
        ::
        =.  records
          (my (skip ~(tap by records) |*(* =(+<-< src.bowl))))
        =/  new=_records
          %-  malt  ::NOTE  +my doesn't work lol
          (turn ~(tap by all.upd) |*(* +<(- [src.bowl +<-])))
        =.  records  (~(uni by records) new)
        :_  this
        :_  (drop (inflate-contacts-profile [our now]:bowl records ledgers))
        =/  upd=update:l  [%full new]
        [%give %fact ~[/ /records] %lanyard-update !>(upd)]
      ::
          %config
        =*  key  [src.bowl id.upd]
        =.  records
          =+  rec=(~(got by records) key)
          (~(put by records) key rec(config config.upd))
        :_  this
        =/  upd=update:l  upd(id key)
        [%give %fact ~[/ /records] %lanyard-update !>(upd)]~
      ::
          %status
        =*  key  [src.bowl id.upd]
        =.  records
          =+  rec=(~(gut by records) key *id-state)
          ?:  ?=(%gone status.upd)  (~(del by records) key)
          (~(put by records) key rec(status status.upd))
        :_  this
        :-  =/  upd=update:l  upd(id key)
            [%give %fact ~[/ /records] %lanyard-update !>(upd)]
        ?.  ?=(?(%gone [%done *]) status.upd)  ~
        (drop (inflate-contacts-profile [our now]:bowl records ledgers))
      ::
          %endpoint
        ?:  =(base.upd (~(got by ledgers) src.bowl))  [~ this]
        =.  ledgers  (~(put by ledgers) src.bowl base.upd)
        :_  this
        (drop (inflate-contacts-profile [our now]:bowl records ledgers))
      ==
    ==
  ::
      [%query @ ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  [~ this]
    ::  query failed
    ::
    =/  nonce=@  (slav %uv i.t.wire)
    ?~  qer=(~(get by queries) nonce)
      ~&  [dap.bowl %strange-disappeared-query nonce]
      [~ this]
    =/  qes
      ?-  -.u.qer
        %|  p.u.qer
        %&  q.p.u.qer
      ==
    ::TODO  mark result for deletion after time?
    :_  this(queries (~(put by queries) nonce &+[qes %fail 'poke nacked']))
    =/  upd=update:l  [%query nonce %fail 'poke nacked']  ::TODO  different?
    [%give %fact ~[/ /query /query/[i.t.wire]] %lanyard-update !>(upd)]~
  ::
      [%contacts %set ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  [~ this]
    %.  [~ this]
    (slog (cat 3 dap.bowl ': failed to update contacts') u.p.sign)
  ==
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  :_  this
  ?+  path  !!
    ~             ~  ::TODO  include initial response?
    [%query ~]    ~
    [%query @ ~]  =<(~ (slav %uv i.t.path))
    [%records ~]  [%give %fact ~ %lanyard-update !>(`update:l`[%full records])]~
  ==
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
    [%records ~]  ``noun+!>(records)
  ::
      [%record ?([@ @ ~] [@ @ @ ~])]
    =;  key=[@p identifier]
      ``noun+!>((~(got by records) key))
    :-  ?:(?=([@ @ ~] t.path) default (slav %p i.t.path))
    =/  dip  ?:(?=([@ @ ~] t.path) t.path t.t.path)
    ?+  dip  !!
      [%dummy @ ~]  [-.dip (slav %t +<.dip)]
      [%urbit @ ~]  [-.dip (slav %p +<.dip)]
      [%phone @ ~]  [-.dip (slav %t +<.dip)]
    ==
  ::
    [%queries ~]    ``noun+!>(queries)
    [%queries @ ~]  ``noun+!>((~(got by queries) (slav %uv i.t.path)))
  ==
::
++  on-leave  |=(* `this)
++  on-arvo   |=(* `this)
::
++  on-fail
  |=  [=term =tang]
  ^-  (quip card _this)
  %.  [~ this]
  (slog (rap 3 dap.bowl ' +on-fail: ' term ~) tang)
--

::  verifier: identifier verification service
::
::    xx overview
::
::    xx intended usage
::
::    xx namespace
::    /records
::            /[user]
::                   /id/[kind]/[etc]  ->  full record?
::                   /id/[kind]        ->  have any?
::                                   /proof  ->  ??
::    /attestations/[signature]  ->  y/n on whether the relevant record is still valid
::
::
::TODO  per-id-nonce or just @p for subscription updates?
::
::TODO
::  v General verification flow for manually-approved dummy identifiers
::    Alternatively, for something more immediately real, do verification of "other urbits I control"
::  Minimal verification metadata & attestations
::  Binary response for "has ~x verified any y identifiers"
::  v Binary response for "is this attestation still valid"
::  Respond to requests containing identifiers with matching ship(s)
::    No rate-limiting yet
::
::TODO  considerations:
::  - should we re-sign attestations when our networking keys change?
::    - if we do, should we invalidate the old ones?
::
/-  *verifier
/+  dbug, verb, negotiate
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
++  give-status
  |=  [for=@p id=identifier status=?(%gone status)]
  ^-  card
  =/  upd=identifier-update
    [%status id status]
  [%give %fact ~[/records/(scot %p for)] %verifier-update !>(upd)]
::
++  attest
  |=  [our=@p now=@da id=identifier proof=(unit proof)]
  ^-  attestation
  :+  now  proof
  ^-  urbit-signature
  =+  ;;(=seed:jael (cue .^(@ %j /(scot %p our)/vile/(scot %da now))))
  ?>  =(who.seed our)
  =/  msg=@    (jam `signed-data-0`[%verified now id proof])
  =/  sig=@ux  (sign:as:(nol:nu:crub:crypto key.seed) msg)
  [our lyf.seed %0 sig]
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
  [%pass /eyre %arvo %e %connect [~ /verifier] dap.bowl]~
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
    ?.  ?=([@ *] q.vase)  !!
    $(mark -.q.vase, vase (slot 3 vase))
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
        ==
      =.  records
        %+  ~(put by records)  id.cmd
        [src.bowl status]
      :_  this
      [(give-status src.bowl id.cmd status)]~
    ::
        %revoke
      ::TODO  if the crash here is unexpected to the client, it should
      ::      either forget everything & resub, or forget just this id?
      ?>  =(src.bowl for:(~(got by records) id.cmd))
      :_  this(records (~(del by records) id.cmd))
      [(give-status src.bowl id.cmd %gone)]~
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
        (~(del by attested) sig.sign.status.rec)
      :-  [(give-status for.rec id %gone)]~
      this(records (~(del by records) id))
    ::
        %dummy
      =/  id=identifier  [%dummy id.cmd]
      =/  rec  (~(got by records) id)
      ?:  ?=(%reject do.cmd)
        $(cmd [%revoke id])
      =/  tat=attestation
        (attest our.bowl now.bowl id ~)
      =.  status.rec  [%done tat]
      :-  [(give-status for.rec id status.rec)]~
      %_  this
        records   (~(put by records) id rec)
        owners    (~(put ju owners) for.rec id)
        attested  (~(put by attested) sig.sign.tat id)
      ==
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
      `for.u.sat
    ==
  ==
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  !!
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?>  ?=([%records @ ~] path)
  =+  who=(slav %p i.t.path)
  ?>  =(src.bowl who)
  ::TODO  give full state
  [~ this]
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
++  on-leave  |=(* `this)
++  on-arvo   |=(* `this)
::
++  on-fail
  |=  [=term =tang]
  ^-  (quip card _this)
  %.  [~ this]
  (slog (rap 3 dap.bowl ' +on-fail: ' term ~) tang)
--

::  pasaporte: verification service client
::
::    xx overview
::    remembers state concerning ourselves and
::
::    xx intended usage
::
::    xx api
::
/-  *verifier
/+  dbug, verb, negotiate
::
%-  %-  agent:negotiate
    [notify=| expose=[~.lanyard^%0 ~ ~] expect=[%verifier^[~.verifier^%0 ~ ~] ~ ~]]
%-  agent:dbug
%+  verb  |
::
=>
|%
++  default  ~zod  ::TODO
+$  state-0
  $:  %0
      records=(map [h=@p id=identifier] id-state)  ::  ours
      provers=(jug identifier @p)                  ::  from
      queries=(map @ _+:*user-query)               ::  asked
  ==
+$  card     card:agent:gall
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
  [%pass /verifier %agent [default %verifier] %watch /records/(scot %p our.bowl)]~
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
      %lanyard-command
    =+  !<(cmd=command:l vase)
    =/  host=@p
      ?~(-.cmd default host.u.cmd)
    =/  key
      :-  host
      ?-(+<.cmd ?(%start %revoke) id.cmd, ?(%config %work) id.cmd)
    ::  can only %start ids we haven't already worked with,
    ::  cannot do anything but %start ids we've never worked with.
    ::
    ?>  !=(?=(%start +<.cmd) (~(has by records) key))
    :-  =/  =cage
          [%verifier-command !>(`user-command`+.cmd)]
        [%pass /verifier %agent [host %verifier] %poke cage]~
    =?  records  ?=(%start +<.cmd)
      (~(put by records) key *config %wait ~)
    ::NOTE  we don't apply revocation eagerly, we can't re-start the identifier
    ::      until the host has acknowledged the revocation anyway
    this
  ::
      %lanyard-query
    =+  !<(qer=query:l vase)
    =/  [host=@p nonce=@]
      :-  ?~(-.qer default host.u.qer)
      =+  non=(end 6 eny.bowl)
      |-(?:((~(has by queries) non) $(non +(non)) non))
    ?<  (~(has by queries) nonce)
    :_  this(queries (~(put by queries) nonce +.qer))
    =/  =cage
      [%verifier-query !>(`user-query`[[dap.bowl nonce] +.qer])]
    [%pass /query/(scot %uv nonce) %agent [host %verifier] %poke cage]~
  ::
      %verifier-result
    =+  !<(res=query-result vase)
    ?>  (~(has by queries) nonce.res)
    :_  this(queries (~(del by queries) nonce.res))
    =/  upd=update:l  [%query res]  ::TODO  different?
    [%give %fact ~[/ /query /query/(scot %uv nonce.res)] %lanyard-update !>(upd)]~
  ==
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ~|  wire=wire
  ?+  wire  !!
      [%verifier ~]
    ?-  -.sign
        %poke-ack
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
      [%pass /verifier %agent [default %verifier] %watch /records/(scot %p our.bowl)]~
    ::
        %fact
      ?.  =(%verifier-update p.cage.sign)
        ~&  [dap.bowl %unexpected-verifier-fact p.cage.sign]
        [~ this]
      =+  !<(upd=identifier-update q.cage.sign)
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
        :_  this(records (~(uni by records) new))
        =/  upd=update:l
          [%full new]
        [%give %fact ~[/ /records] %lanyard-update !>(upd)]~
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
        =/  upd=update:l  upd(id key)
        [%give %fact ~[/ /records] %lanyard-update !>(upd)]~
      ==
    ==
  ::
      [%query @ ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  [~ this]
    ::  query failed
    ::
    =/  nonce=@  (slav %uv i.t.wire)
    ?.  (~(has by queries) nonce)
      ~&  [dap.bowl %strange-disappeared-query nonce]
      [~ this]
    :_  this(queries (~(del by queries) nonce))
    =/  upd=update:l  [%query nonce %fail]  ::TODO  different?
    [%give %fact ~[/ /query /query/[i.t.wire]] %lanyard-update !>(upd)]~
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

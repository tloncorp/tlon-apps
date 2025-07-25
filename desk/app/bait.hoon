/-  reel
/+  default-agent, verb, dbug, server, logs, *reel
|%
+$  card  card:agent:gall
+$  versioned-state
  $%  state-0
      state-1
      state-2
  ==
::
+$  state-0
  $:  %0
      todd=(map [inviter=ship token=cord] description=cord)
  ==
+$  state-1
  $:  %1
      token-metadata=(map [inviter=ship token=cord] metadata:reel)
  ==
+$  state-2
  $:  %2
      token-metadata=(map token:reel metadata:reel)
  ==
--
::
|%
++  landing-page
  |=  =metadata:reel
  ^-  manx
  =/  description
    ?.  =(tag.metadata 'groups-0')  ""
    (trip (~(got by fields.metadata) 'description'))
  ;html
    ;head
      ;title:"Lure"
    ==
    ;body
      ;p: {description}
      Enter your @p:
      ;form(method "post")
        ;input(type "text", name "ship", id "ship", placeholder "~sampel");
        ;button(type "submit"):"Request invite"
      ==
      ;script: ship = document.cookie.split("; ").find((row) => row.startsWith("ship="))?.split("=")[1]; document.getElementById("ship").value=(ship || "~sampel-palnet")
    ==
  ==
::
++  sent-page
  |=  invitee=ship
  ^-  manx
  ;html
    ;head
      ;title:"Lure"
    ==
    ;body
      Your invite has been sent!  Go to your ship to accept it.
      ;script: document.cookie="ship={(trip (scot %p invitee))}"
    ==
  ==
--
::
=|  state-2
=*  state  -
::
%-  agent:dbug
%+  verb  |
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)
    log   ~(. logs [our.bowl /logs])
::
++  on-init
  ^-  (quip card _this)
  [[%pass /eyre/connect %arvo %e %connect [~ /lure] dap.bowl]~ this]
::
++  on-save  !>(state)
++  on-load
  |=  old-state=vase
  ^-  (quip card _this)
  =/  old  !<(versioned-state old-state)
  ?-  -.old
      %2
    `this(state old)
  ::
      %1
    =/  new-metadata
      %-  ~(gas by *(map token:reel metadata:reel))
      %+  turn
        ~(tap by token-metadata.old)
      |=  [[inviter=ship =token:reel] meta=metadata:reel]
      =/  new-token
        (rap 3 (scot %p inviter) '/' token ~)
      [new-token meta]
    `this(state [%2 new-metadata])
  ::
      %0
    `this(state *state-2)
  ==
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+    mark  (on-poke:def mark vase)
      %handle-http-request
    =+  !<([id=@ta inbound-request:eyre] vase)
    |^
    :_  this
    =/  full-line=request-line:server  (parse-request-line:server url.request)
    =/  line
      ?:  ?=([%lure @ *] site.full-line)
        t.site.full-line
      ?:  ?=([@ @ *] site.full-line)
        site.full-line
      !!
    ?+    method.request  (give not-found:gen:server)
      %'GET'  (get-request line)
    ::
        %'OPTIONS'
      %-  give
      =;  =header-list:http
        [[204 header-list] ~]
      :~  :-  'access-control-allow-methods'
          =-  (fall - '*')
          (get-header:http 'access-control-request-method' header-list.request)
        ::
          :-  'access-control-allow-headers'
          =-  (fall - '*')
          (get-header:http 'access-control-request-headers' header-list.request)
      ==
    ::
        %'POST'
      ?~  body.request
        :_  (give (not-found 'body not found'))
        %^  tell:log  %crit
          ~['POST body not found']
        ~['event'^s+'Lure POST Fail' 'flow'^s+'lure']
      ?.  =('ship=%7E' (end [3 8] q.u.body.request))
        :_  (give (not-found 'ship not found in body'))
        %^  tell:log  %crit
          ~['ship not found in POST body']
        ~['event'^s+'Lure POST Fail' 'flow'^s+'lure']
      =/  joiner=@p  (slav %p (cat 3 '~' (rsh [3 8] q.u.body.request)))
      ::
      =/  token
        ?~  ext.full-line  i.line
        (crip "{(trip i.line)}.{(trip u.ext.full-line)}")
      =>
        |%
        ++  lure-log
          |=  [=volume:logs event=@t =echo:logs]
          %^  tell:log  volume
            echo
          :~  'event'^s+event
              'flow'^s+'lure'
              'lure-id'^s+token
              'lure-joiner'^s+(scot %p joiner)
          ==
        --
      =;  [bite=(unit bite:reel) inviter=(unit ship)]
        ?~  bite
          :_  (give (not-found 'invite token not found'))
          %^  lure-log  %crit  'Invite Token Missing'
          ~[leaf+"invite token {<token>} not found"]
        ?~  inviter
          :_  (give (not-found 'inviter not found'))
          %^  lure-log  %crit  'Inviter Not Found'
          ~['inviter not found']
        ^-  (list card)
        :*  %^  lure-log  %info  'Invite Redeemed'
            ~[leaf+"{<joiner>} redeemed lure invite from {<u.inviter>}"]
            ::
            :*  %pass  /bite  %agent  [u.inviter %reel]
                %poke  %reel-bite  !>(u.bite)
            ==
          (give (manx-response:gen:server (sent-page joiner)))
        ==
      =/  =(pole knot)  line
      ?:  ?=([@ @ ~] line)
        =/  inviter  (slav %p i.line)
        =/  old-token  i.t.line
        :_  `inviter
        `[%bite-1 old-token joiner inviter]
      =/  =metadata:reel  (~(gut by token-metadata) token *metadata:reel)
      ?~  type=(~(get by fields.metadata) 'bite-type')
        [~ ~]
      ?>  =('2' u.type)
      :-  `[%bite-2 token joiner metadata]
      ?~  inviter-field=(~(get by fields.metadata) 'inviter')
        ~
      `(slav %p u.inviter-field)
    ==
    ++  get-request
      |=  =(pole knot)
      ^-  (list card)
      %-  give
      ?+  pole  not-found:gen:server
          [%bait %who ~]
        (json-response:gen:server s+(scot %p our.bowl))
      ::
          [ship=@ name=@ %metadata ~]
        =/  token  (crip "{(trip ship.pole)}/{(trip name.pole)}")
        =/  =metadata:reel
          (~(gut by token-metadata) token *metadata:reel)
        (json-response:gen:server (enjs-metadata metadata))
      ::
          [token=@ %metadata ~]
        =/  =metadata:reel
          (~(gut by token-metadata) token.pole *metadata:reel)
        (json-response:gen:server (enjs-metadata metadata))
      ::
          [token=* ~]
        =/  token  (crip (join '/' pole))
        =/  =metadata:reel
          (~(gut by token-metadata) token *metadata:reel)
        (manx-response:gen:server (landing-page metadata))
      ==
    ::
    ++  allow
      |=  simple-payload:http
      ^-  simple-payload:http
      :_  data
      :-  status-code.response-header
      [['access-control-allow-origin' '*'] headers.response-header]
    ++  not-found
      |=  body=cord
      [[404 ~] `(as-octs:mimes:html body)]
    ++  give
      |=  =simple-payload:http
      (give-simple-payload:app:server id (allow simple-payload))
    --
      %bait-describe
    =+  !<([=nonce:reel =metadata:reel] vase)
    =/  =token:reel  (scot %uv (end [3 16] eny.bowl))
    :_  this(token-metadata (~(put by token-metadata) token metadata))
    =/  =cage  reel-confirmation+!>([nonce token])
    ~[[%pass /confirm/[nonce] %agent [src.bowl %reel] %poke cage]]
  ::
      %bait-undescribe
    =+  !<(token=cord vase)
    `this(token-metadata (~(del by token-metadata) token))
  ::
      %bind-slash
    :_  this
    ~[[%pass /eyre/connect %arvo %e %connect [~ /] dap.bowl]]
  ::
      %unbind-slash
    :_  this
    ~[[%pass /eyre/connect %arvo %e %connect [~ /] %docket]]
  ==
::
++  on-agent  on-agent:def
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?+  path  (on-watch:def path)
    [%http-response *]  `this
  ==
++  on-leave  on-leave:def
++  on-peek   on-peek:def
++  on-arvo
  |=  [=wire =sign-arvo]
  ^-  (quip card _this)
  ?+    sign-arvo  (on-arvo:def wire sign-arvo)
      [%eyre %bound *]
    ~?  !accepted.sign-arvo
      [dap.bowl 'eyre bind rejected!' binding.sign-arvo]
    [~ this]
  ==
::
++  on-fail
  |=  [=term =tang]
  ^-  (quip card _this)
  :_  this
  [(fail:log term tang ~)]~
--

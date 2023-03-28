/-  reel, chat
/+  default-agent, verb, dbug, server
::
|%
+$  card  card:agent:gall
+$  versioned-state
  $%  state-0
  ==
+$  state-0
  $:  %0
      token=cord
      pals-tag=cord
      dm-text=cord
  ==
--
|%
++  landing-page
  |=  [token=cord dm-text=cord pals-tag=cord description=cord]
  ^-  manx
  ;html
    ;head
      ;title:"Greetings"
    ==
    ;body
      ;form(method "post")
        invite link token (should be URL-safe)
        ;input(type "text", name "token", value "{(trip token)}");

        pals tag for invitee
        ;input(type "text", name "pals-tag", value "{(trip pals-tag)}");

        direct message contents (sent to the invitee after clicking)
        ;textarea(name "dm-text"):"{(trip dm-text)}"

        invite link description
        ;textarea(name "description"):"{(trip description)}"

        On save, you\'ll get an invite link
        ;button(type "submit"):"Save"
      ==
    ==
  ==
::
++  sent-page
  |=  [our=ship bait=cord token=cord]
  ^-  manx
  ;html
    ;head
      ;title:"Greetings"
    ==
    ;body
      Here is your invite link:

      {(trip bait)}{<our>}/{(trip token)}
    ==
  ==
++  frisk  ::  parse url-encoded form args
  |=  body=@t
  %-  ~(gas by *(map @t @t))
  (fall (rush body yquy:de-purl:html) ~)
--
::
=|  state-0
=*  state  -
%-  agent:dbug
^-  agent:gall
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %.n) bowl)
::
++  on-init
  :_  this
  :~  [%pass /bite-wire %agent [our.bowl %reel] %watch /bites]
      [%pass /eyre/connect %arvo %e %connect [~ /greeting] dap.bowl]
  ==
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+  mark  !!
    %leave  :_  this  ~[[%pass /bite-wire %agent [our.bowl %reel] %leave ~]]
    %watch  :_  this  ~[[%pass /bite-wire %agent [our.bowl %reel] %watch /bites]]
    ::
      %handle-http-request
    =+  !<([id=@ta inbound-request:eyre] vase)
    |^
    =/  line=request-line:server  (parse-request-line:server url.request)
    =/  m=metadata:reel
      .^(metadata:reel %gx [(scot %p our.bowl) %reel (scot %da now.bowl) %metadata token %noun ~])
    ?+    method.request  :_  this  (give not-found:gen:server)
        %'GET'
      =/  description
        (fall (~(get by fields.m) 'description') '')
      :_  this  (give (manx-response:gen:server (landing-page token dm-text pals-tag description)))
        %'POST'
      ?~  body.request
        :_  this  (give not-found:gen:server)
      =/  params  ~(got by (frisk q.u.body.request))
      =/  bait
        .^(cord %gx [(scot %p our.bowl) %reel (scot %da now.bowl) %service %noun ~])
      =/  new-meta=metadata:reel
        [%greeting-0 (~(put by fields.m) 'description' (params 'description'))]
      :_  this(token (params 'token'), dm-text (params 'dm-text'), pals-tag (params 'pals-tag'))
      :-  :*  %pass  /describe  %agent  [our.bowl %reel]  %poke  %reel-describe
            !>([(params 'token') new-meta])
          ==
      (give (manx-response:gen:server (sent-page our.bowl bait (params 'token'))))
    ==
    ::
    ++  give
      |=  =simple-payload:http
      (give-simple-payload:app:server id simple-payload)
    --
  ==
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?>  =(our.bowl src.bowl)
  ?+  path  (on-watch:def path)
    [%http-response *]  `this
  ==
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ?-    -.sign
      %watch-ack  `this
      %kick       `this
      %poke-ack   `this
      %fact
    =+  !<(=bite:reel q.cage.sign)
    ?>  =(token token.bite)
    ?>  ?=([%bite-1 *] bite)
    =/  =action:dm:chat
      :*  joiner.bite
          [joiner.bite now.bowl]
          %add
          replying=~
          author=our.bowl
          sent=now.bowl
          content=[%story `~[dm-text]]
      ==
    =/  meet
      [%meet joiner.bite (~(put in *(set @ta)) pals-tag)]
    :_  this
    :~  [%pass /dm %agent [our.bowl %chat] %poke %dm-action !>(action)]
        [%pass /meet %agent [our.bowl %pals] %poke %pals-command !>(meet)]
    ==
  ==
::
++  on-fail
  |=  [=term =tang]
  (mean ':sub +on-fail' term tang)
::
++  on-leave
  |=  =path
  `this
::
++  on-save   !>(state)
++  on-load   |=(old=vase `this(state !<(_state old)))
++  on-arvo   on-arvo:def
++  on-peek   on-peek:def
::
--

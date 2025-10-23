::  dumb-proxy: stupid stateless http proxy
::
::    serves an api endpoint at /apps/groups/~/proxy,
::    to which you can make requests at /[@uw-encoded-url-string],
::    which will trigger this agent to pass the request on to that target url
::    mostly unchanged (only changing adding in a Forwarded header), and
::    eventually respond with whatever response it got back.
::
/+  hutils=http-utils,
    logs, dbug, verb
::
|%
+$  card  card:agent:gall
::
++  fetch
  |=  $:  [for=@ta secure=?]
          =request:http
      ==
  ^-  card
  =.  header-list.request
    =-  (set-header:http 'forwarded' - header-list.request)
    ::NOTE  we intentionally don't include the originating ip address
    %+  rap  3
    :~  'for="tm-dumb-proxy";'
        'proto='  ?:(secure 'https' 'http')
    ==
  ::NOTE  outbound-config is actually meaningless,
  ::      iris doesn't do anything with it at present...
  [%pass /fetch/[for]/(scot %t url.request) %arvo %i %request request *outbound-config:iris]
::
++  l
  |_  [our=@p url=(unit @t)]
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
    :-  %flow^s+'http proxy'
    =;  l=(list (unit [@t json]))
      (murn l same)
    :~  ?~(url ~ `[%url s+u.url])
    ==
  ::
  ++  link
    |=  cad=card
    |*  [caz=(list card) etc=*]
    [[cad caz] etc]
  --
--
::
=+  log=l
::
%+  verb  |
%-  agent:dbug
::
^-  agent:gall
|_  =bowl:gall
+*  this  .
    l     log(our our.bowl)
::
++  on-save  !>(~)
::
++  on-init
  ^-  (quip card _this)
  :_  this
  [%pass /eyre/bind %arvo %e %connect [~ /apps/groups/~/proxy] dap.bowl]~
::
++  on-load
  |=  ole=vase
  ^-  (quip card _this)
  [~ this]
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?>  =(our src):bowl
  ?+  mark  ~|([%strange-mark mark=mark] !!)
      %handle-http-request
    =+  !<(order:hutils vase)
    =+  (purse:hutils url.request)
    ?.  ?=([%apps %groups %~.~ %proxy *] site)
      :_  this
      %^  spout:hutils  id
        [404 ~]
      `(as-octs:mimes:html (cat 3 'bad route into ' dap.bowl))
    =/  site  t.t.t.t.site  ::  tmi
    ?+  site
      [(spout:hutils id [404 ~] `(as-octs:mimes:html 'bad path')) this]
    ::
        [@ ~]
      =|  msg=@t
      =*  bad-req
        %-  (tell:l %warn msg url.request ~)
        [(spout:hutils id [400 ~] `(as-octs:mimes:html msg)) this]
      ?~  target=(slaw %uw i.site)
        =.  msg  'target not @uw'
        bad-req
      ?~  (de-purl:html u.target)
        =.  msg  'target not parseable'
        bad-req
      =.  url.request  u.target
      =.  header-list.request
        ::  delete cookies from the original request,
        ::  don't want to leak these
        ::
        %+  skip  header-list.request
        |=([k=@t @t] =('cookie' k))
      [[(fetch [id secure] request)]~ this]
    ==
  ==
::
++  on-arvo
  |=  [=wire sign=sign-arvo]
  =-  -(log ^l)  ::  reset any .log deets we might've set
  ^-  (quip card _this)
  ~|  [%on-arvo wire=wire sign=+<.sign]
  ?+  wire  ~|(%strange-sign-arvo !!)
      [%eyre %bind ~]
    ?>  ?=(%bound +<.sign)
    ?:  accepted.sign  [~ this]
    %-  (tell:l %crit 'failed to eyre-bind' ~)
    %-  (slog dap.bowl 'failed to eyre-bind' ~)
    [~ this]
  ::
      [%fetch @ @ ~]
    =/  eid=@ta  i.t.wire
    =/  url=@t   (slav %t i.t.t.wire)
    =.  url.log  `url
    ?>  ?=([%iris %http-response *] sign)
    =*  res  client-response.sign
    ::  %progress responses are unexpected, the runtime doesn't support them
    ::  right now. if they occur, just treat them as cancels and retry.
    ::
    %-  ?.  ?=(%progress -.res)  same
        (tell:l %warn 'strange iris %progress response' ~)
    =?  res  ?=(%progress -.res)
      ~&  [dap.bowl %strange-iris-progress-response]
      [%cancel ~]
    ::  we might get a %cancel if the runtime was restarted during our
    ::  request.
    ::
    ?:  ?=(%cancel -.res)
      :_  this
      %+  spout:hutils  eid
      :-  [502 'x-dumb-proxy'^'cancelled' ~]
      ~
    ::
    ?>  ?=(%finished -.res)
    =*  cod  status-code.response-header.res
    :_  this
    %+  spout:hutils  eid
    :-  =,  response-header.res
        :-  status-code
        (snoc headers 'x-dumb-proxy'^'finished')
    ?~  full-file.res  ~
    `data.u.full-file.res
  ==
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?>  =(our src):bowl
  ?>  ?=([%http-response @ ~] path)
  [~ this]
::
++  on-leave
  |=  =path
  ^-  (quip card _this)
  [~ this]
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ?:  =(/logs wire)  [~ this]
  %-  (tell:l %crit 'unexpected on-agent' (spat wire) -.sign ~)
  ~&  [dap.bowl %unexpected-on-agent wire=wire]
  [~ this]
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ~
::
++  on-fail
  |=  [=term =tang]
  ^-  (quip card _this)
  %-  (fail:l term tang)
  %-  (slog dap.bowl '+on-fail' term tang)
  [~ this]
--
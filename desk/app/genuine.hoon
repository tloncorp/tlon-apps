/+  default-agent, verb, dbug, server
|%
++  give-payload
  |=  [id=@ta =simple-payload:http]
  (give-simple-payload:app:server id simple-payload)
::  without removing the dots, there are intermittent mismatches when reading
::  the secret from the URL
++  serialize
  |=  eny=@uvJ
  %-  crip
  %+  skip  (trip (scot %uw eny))
  |=  =cord
  =(cord '.')
+$  card  card:agent:gall
+$  versioned-state
  $%  state-0
  ==
+$  state-0
  $:  %0
      secret=@uvJ
  ==
--
::
=|  state-0
=*  state  -
%-  agent:dbug
%+  verb  |
^-  agent:gall
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %.n) bowl)
::
++  on-init
  :_  this(secret eny.bowl)
  ~[[%pass /eyre/connect %arvo %e %connect [~ /genuine] dap.bowl]]
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+  mark  (on-poke:def mark vase)
      %rotate
    ?>  =(src.bowl our.bowl)
    `this(secret eny.bowl)
      %handle-http-request
    =+  !<([id=@ta inbound-request:eyre] vase)
    :_  this
    =/  full-line=request-line:server  (parse-request-line:server url.request)
    ?.  ?=([%genuine @ ~] site.full-line)
      (give-payload id not-found:gen:server)
    =/  line  i.t.site.full-line
    ?+  method.request  (give-payload id not-found:gen:server)
        %'GET'
      (give-payload id (json-response:gen:server b+=(line (serialize secret))))
    ==
  ==
::
++  on-agent  on-agent:def
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?+  path  (on-watch:def path)
    [%http-response *]  `this
  ==
::
++  on-fail
  |=  [=term =tang]
  (mean ':genuine +on-fail' term tang)
::
++  on-leave  on-leave:def
++  on-save  !>(state)
::
++  on-load
  |=  old-state=vase
  ^-  (quip card _this)
  =/  old  !<(versioned-state old-state)
  `this(state old)
::
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
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
    [%x %secret ~]  ``json+!>([%s (serialize secret)])
  ==
--

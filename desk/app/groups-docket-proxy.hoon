::  groups-docket-proxy: mitm glob responses
::
::NOTE  this will stop working when docket starts putting responses into
::      the eyre response cache. at that point we'll probably need to do
::      something more involved (or just wipe the cache entries)...
::
|%
++  extra-headers
  ^-  header-list:http
  :~  ['cross-origin-embedder-policy' 'require-corp']
      ['cross-origin-opener-policy' 'same-origin']
  ==
::
++  give-response
  |=  [eyre-id=@ta simple-payload:http]
  ^-  (list card)
  =+  head=http-response-header+!>(response-header)
  =+  body=http-response-data+!>(data)
  :~  [%give %fact [/http-response/[eyre-id]]~ head]
      [%give %fact [/http-response/[eyre-id]]~ body]
      [%give %kick [/http-response/[eyre-id]]~ ~]
  ==
::
+$  card  card:agent:gall
--
::
|_  =bowl:gall
+*  this  .
++  on-init
  ^-  (quip card _this)
  :_  this
  [%pass /eyre %arvo %e %connect [~ /apps/groups] dap.bowl]~
::
++  on-save  !>(~)
++  on-load  |=(* [~ this])
++  on-peek  |=(* ~)
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?>  ?=(%handle-http-request mark)
  ::NOTE  we don't check src.bowl here, docket just checks request's auth flag
  =+  !<([eyre-id=@ta *] vase)
  :_  this
  [%pass /http-request/[eyre-id] %agent [our.bowl %docket] %poke mark vase]~
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?>  ?=([%http-response @ ~] path)
  ::NOTE  we don't check src.bowl here, docket just checks request's auth flag
  [[%pass path %agent [our.bowl %docket] %watch path]~ this]
::
++  on-leave
  |=  =path
  ^-  (quip card _this)
  ?.  ?=([%http-response @ ~] path)  [~ this]
  [[%pass path %agent [our.bowl %docket] %leave ~]~ this]
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ~|  [wire -.sign]
  :_  this
  ?+  wire  !!
      [%http-request @ ~]
    =*  eyre-id  i.t.wire
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  ~
    %-  (slog (rap 3 dap.bowl ': proxied poke nacked' ~) u.p.sign)
    %^  give-response  eyre-id
      [502 ~]
    `(as-octs:mimes:html 'poke nack from docket')
  ::
      [%http-response @ ~]
    =*  eyre-id  i.t.wire
    ?-  -.sign
      %poke-ack  !!
    ::
        %watch-ack
      ?~  p.sign  ~
      %-  (slog (rap 3 dap.bowl ': proxied watch nacked' ~) u.p.sign)
      %^  give-response  eyre-id
        [502 ~]
      `(as-octs:mimes:html 'watch nack from docket')
    ::
        %fact
      ?.  ?=(%http-response-header p.cage.sign)
        [%give %fact [wire]~ cage.sign]~
      =+  !<(head=response-header:http q.cage.sign)
      ::NOTE  debatable whether this needs to use +set-header or not
      =.  headers.head  (weld headers.head extra-headers)
      [%give %fact [wire]~ p.cage.sign !>(head)]~
    ::
        %kick
      [%give %kick [wire]~ ~]~
    ==
  ==
::
++  on-arvo
  |=  [=wire sign=sign-arvo]
  ~|  [wire +<.sign]
  ?>  ?=([%eyre ~] wire)
  ?>  ?=([%eyre %bound *] sign)
  ~?  !accepted.sign
    [dap.bowl 'bind rejected' binding.sign]
  [~ this]
::
++  on-fail
  |=  [=term =tang]
  ^-  (quip card _this)
  %-  (slog (rap 3 dap.bowl ': on-fail: ' term ~) tang)
  [~ this]
--

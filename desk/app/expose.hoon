::  exposé: clearweb content rendering
::
::    copy a reference to a notebook post, then:
::    :expose [%show /that/reference/with/id/numbers/quoted/'123456789']
::    then visit in the browser:
::    /expose/that/reference/as/copied/123456789
::
/-  c=cite, d=channels, co=contacts
/+  u=channel-utils, hutils=http-utils,
    dbug, verb
::
/=  page    /app/expose/page
/=  widget  /app/expose/widget
/*  style-shared  %css  /app/expose/style/shared/css
::
|%
+$  state-0
  $:  %0
      open=(set cite:c)  ::TODO  could support ranges of msgs?
  ==
::
+$  action
  $%  [%show =path]
      [%hide =path]
  ==
::
+$  card  card:agent:gall
::
++  e  ::  expose utils
  |%
  ++  update-widget
    |=  [=bowl:gall open=(set cite:c)]
    ^-  (list card)
    ?.  .^(? %gu /(scot %p our.bowl)/profile/(scot %da now.bowl)/$)
      ~
    =;  widget=[%0 desc=@t %marl marl]
      =/  =cage  noun+!>([%command %update-widget %groups %expose-all widget])
      [%pass /profile/widget/all %agent [our.bowl %profile] %poke cage]~
    :^  %0  'Publicized content'  %marl
    (render:widget bowl open)
  --
--
::
%-  agent:dbug
%+  verb  |
^-  agent:gall
::
=|  state-0
=*  state  -
|_  =bowl:gall
+*  this  .
++  on-init
  ^-  (quip card _this)
  :_  this
  [%pass /eyre/connect %arvo %e %connect [~ /expose] dap.bowl]~
::
++  on-save  !>(state)
++  on-load
  |=  ole=vase
  ^-  (quip card _this)
  =.  state  !<(state-0 ole)
  :_  this
  ::  we must defer refreshing the cache because rendering scries
  ::
  [%pass /refresh %arvo %b %wait now.bowl]~
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+  mark  !!
      %noun
    ?+  q.vase  !!
        [?(%show %hide) *]
      =+  !<(act=action vase)
      ?-  -.act
          %show
        =/  ref=cite:c
          (parse:c path.act)
        =/  msg=(unit [=nest:g:c =post:d])
          (grab-post:cite:u bowl ref)
        ?>  ?=(^ msg)
        =/  pag=(unit manx)
          (render:page bowl u.msg)
        ?>  ?=(^ pag)
        =.  open    (~(put in open) ref)
        :_  this
        :_  (update-widget:e bowl open)
        %+  store:hutils
          (cat 3 '/expose' (spat path.act))
        `[| %payload (paint:hutils %page u.pag)]
      ::
          %hide
        =/  ref=cite:c
          (parse:c path.act)
        ?.  (~(has in open) ref)
          [~ this]
        =.  open    (~(del in open) ref)
        :_  this
        :_  (update-widget:e bowl open)
        %+  store:hutils
          (cat 3 '/expose' (spat path.act))
        :^  ~  |  %payload
        [[404 ~] `(as-octs:mimes:html 'not found')]
      ==
    ==
  ::
      %json
    ::  we intentionally slum it with in-agent conversions for now
    ::
    =+  !<(=json vase)
    =-  $(mark %noun, vase !>(`action`-))
    %.  json
    (of show+pa hide+pa ~):dejs:format
  ::
      %handle-http-request
    =+  !<([rid=@ta inbound-request:eyre] vase)
    :_  this
    =;  payload=simple-payload:http
      :_  (spout:hutils rid payload)
      ::  if we handled a request here, make sure it's cached for next time
      ::
      [%pass /eyre/cache %arvo %e %set-response url.request `[| %payload payload]]
    ?:  =('/expose/style/shared.css' url.request)
      :-  [200 ['content-type' 'text/css']~]
      `(as-octs:mimes:html style-shared)
    =/  ref=(unit cite:c)
      (rush url.request (sear purse:c ;~(pfix (jest '/expose') stap)))
    ?~  ref
      [[400 ~] `(as-octs:mimes:html 'bad request')]
    ::
    =;  bod=(unit manx)
      ?~  bod  [[404 ~] `(as-octs:mimes:html 'not found')]
      (paint:hutils %page u.bod)
    ::
    ?.  (~(has in open) u.ref)
      ~
    %+  biff
      (grab-post:cite:u bowl u.ref)
    (cury render:page bowl)
  ==
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?>  ?=([%http-response @ ~] path)
  [~ this]
::
++  on-arvo
  |=  [=wire sign=sign-arvo]
  ^-  (quip card _this)
  ~|  wire
  ?+  wire  !!
      [%eyre %connect ~]
    [~ this]  ::TODO  print if not successful
  ::
      [%refresh ~]
    :_  this
    :-  %+  store:hutils  '/expose/style/shared.css'
        =/  bod=(unit octs)
          `(as-octs:mimes:html style-shared)
        `[| %payload [200 ['content-type' 'text/css'] ~] bod]
    %+  weld
      (update-widget:e bowl open)
    %+  murn  ~(tap in open)
    |=  ref=cite:c
    ^-  (unit card)  ::TODO  or should this remove from cache also?
    ::TODO  maybe find a way to dedupe with logic in %show and %handle-http-req
    ::TODO  reconsider. if we just remove the cache entry, we'll re-render
    ::      on-demand instead of all-at-once, which may be slow.
    =/  msg=(unit [=nest:g:c =post:d])
      (grab-post:cite:u bowl ref)
    ?~  msg  ~
    =/  pag=(unit manx)
      (render:page bowl u.msg)
    ?~  pag  ~
    %-  some
    %+  store:hutils
      (cat 3 '/expose' (spat (print:c ref)))
    `[| %payload (paint:hutils %page u.pag)]
  ==
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
      [?(%x %u) %show *]
    ``loob+!>((~(has in open) (parse:c t.t.path)))
  ==
::
++  on-leave  |=(* [~ this])
++  on-agent  |=(* [~ this])
::
++  on-fail
  |=  [=term =tang]
  ^-  (quip card _this)
  %.  [~ this]
  (slog dap.bowl 'on-fail' term tang)
--

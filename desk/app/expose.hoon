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
      open=(set cite:c)
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
  ++  refresh-widget
    |=  [=bowl:gall open=(set cite:c)]
    ^-  (list card)
    ?.  .^(? %gu /(scot %p our.bowl)/profile/(scot %da now.bowl)/$)
      ~
    ::TODO  should remove widget if no published content?
    ::      or just show "nothing yet..."
    =;  widget=[%0 desc=@t %marl marl]
      =/  =cage  noun+!>([%command %update-widget %groups %expose-all widget])
      [%pass /profile/widget/all %agent [our.bowl %profile] %poke cage]~
    :^  %0  'Published content'  %marl
    (render:widget bowl open)
  ::
  ++  refresh-pages
    |=  [=bowl:gall cis=(list cite:c)]
    ^-  (list card)
    %+  turn  cis
    |=  ref=cite:c
    ^-  card
    %+  store:hutils
      (cat 3 '/expose' (spat (print:c ref)))
    ::TODO  maybe find a way to dedupe with logic in %show and %handle-http-req
    ::NOTE  for sane amounts of content, doing an all-at-once re-rendering
    ::      remains reasonably fast. scry overhead (for contacts/profile deets)
    ::      is the slowest part, and doing all pages at once means we can
    ::      memoize and only run those scries once
    =/  msg=(unit [=nest:g:c =post:d])
      (grab-post:cite:u bowl ref)
    ?~  msg
      ::  if the message (no longer) exists in the backend store, make sure to
      ::  remove it from cache also. whatever deletes the store chooses to
      ::  respect, we should respect also.
      ::
      ~
    =/  pag=(unit manx)
      (render:page bowl u.msg)
    ?~  pag
      ::  if we cannot render the page for whatever reason, we cannot guarantee
      ::  its up-to-date-ness. delete it from cache, so we don't risk serving
      ::  stale content.
      ~
    `[| %payload (paint:hutils %page u.pag)]
  ::
  ++  clear-page
    |=  ref=cite:c
    ^-  card
    (store:hutils (cat 3 '/expose' (spat (print:c ref))) ~)
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
  :~  [%pass /eyre/connect %arvo %e %connect [~ /expose] dap.bowl]
      [%pass /channels %agent [our.bowl %channels] %watch /v1]
  ==
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
        :_  (refresh-widget:e bowl open)
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
        :_  (refresh-widget:e bowl open)
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
    ~&  >>>  [dap.bowl %failed-to-eyre-connect]
    [~ this]
  ::
      [%refresh ~]
    :_  this
    :-  %+  store:hutils  '/expose/style/shared.css'
        =/  bod=(unit octs)
          `(as-octs:mimes:html style-shared)
        `[| %payload [200 ['content-type' 'text/css'] ~] bod]
    %+  weld
      (refresh-widget:e bowl open)
    (refresh-pages:e bowl ~(tap in open))
  ==
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ?.  ?=([%channels ~] wire)  [~ this]
  ?-  -.sign
    %poke-ack  !!
    %kick      [[%pass /channels %agent [our.bowl %channels] %watch /v1]~ this]
  ::
      %watch-ack
    ?~  p.sign  [~ this]
    ~&  >>>  [dap.bowl %rejected-by-channels]
    [~ this]
  ::
      %fact
    ?.  =(%channel-response-1 p.cage.sign)  [~ this]
    =+  !<(r-channels:d q.cage.sign)
    ::REVIEW  should this handle %posts also?
    ?+  -.r-channel  [~ this]
        %post
      =/  new=(unit $@(%del kind-data:d))
        ?+  -.r-post.r-channel  ~
            %set
          ?~  post.r-post.r-channel  `%del
          `kind-data.u.post.r-post.r-channel
        ::
            %essay
          `kind-data.essay.r-post.r-channel
        ==
      ?~  new  [~ this]
      ?^  u.new
        ::  post was updated, refresh the relevant page's cache entry
        ::
        :_  this
        =/  ref=cite:c
          (from-post:cite:u nest id.r-channel u.new)
        ?.  (~(has in open) ref)  ~
        %+  weld
          (refresh-widget:e bowl open)
        (refresh-pages:e bowl ref ~)
      ::  post was deleted. if we have it, clear it out.
      ::
      ::TODO  this won't hold up in a freeform-channels world...
      ::      but not sure how else we'd get the msg type info for the cite.
      =/  =kind-data:d
        ?-  -.nest
          %chat   [%chat ~]
          %diary  [%diary '' '']
          %heap   [%heap ~]
        ==
      =/  ref=cite:c
        (from-post:cite:u nest id.r-channel kind-data)
      ?.  (~(has in open) ref)  [~ this]
      =.  open  (~(del in open) ref)
      :_  this
      [(clear-page:e ref) (refresh-widget:e bowl open)]
    ==
  ==
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
      [%x %show ~]
    ``noun+!>(open)
  ::
      [?(%x %u) %show *]
    ``loob+!>((~(has in open) (parse:c t.t.path)))
  ==
::
++  on-leave  |=(* [~ this])
::
++  on-fail
  |=  [=term =tang]
  ^-  (quip card _this)
  %.  [~ this]
  (slog dap.bowl 'on-fail' term tang)
--

::  profile: public profile page engine
::
::    optionally binds to /profile, serving a small version of the host ship's
::    groups profile to the public web.
::    other apps can poke this agent with widgets of their own, and the user
::    can choose which widgets to display on their public page.
::
/-  contacts
/+  dbug, verb, sigil, hutils=http-utils
/=  stock-widgets  /app/profile/widgets
::
/*  style-shared  %css  /app/expose/style/shared/css
/*  style-page    %css  /app/profile/style/page/css
::
|%
+$  state-0
  $:  %0
      bound=_|
    ::
      widgets=(map desk (map term widget))
      layout=(list [=desk =term])
      tlon-cta=?
  ==
::
+$  widget
  $:  %0
      desc=@t
      body=[%marl =marl]
  ==
::
+$  command  ::  commands from other agents
  $%  [%update-widget =desk =term =widget]
      [%delete-widget =desk =term]
  ==
::
+$  action  ::  actions by the user
  $%  [%bind ~]
      [%unbind ~]
      [%put-widget =desk =term]
      [%del-widget =desk =term]
      [%toggle-cta set=(unit ?)]
  ==
::
+$  card  $+(card card:agent:gall)
--
::
|_  [=bowl:gall state-0]
+*  this   .
    state  +<+
++  bind
  ^-  (quip card _state)
  :_  state
  [%pass /eyre/connect %arvo %e %connect [~ /profile] dap.bowl]~
::
++  did-bind
  |=  success=?
  ^-  (quip card _state)
  ?:  success
    [update-cache state(bound &)]
  [~ state(bound |)]
::
++  unbind
  ^-  (quip card _state)
  ?.  bound  [~ state]
  =.  bound  |
  ::NOTE  at the time of writing, both eyre & the runtime serve 404s for urls
  ::      whose cache entries were deleted, rather than passing the request in
  ::      as normal. not the end of the world for us, but it does mean that
  ::      we will have made /profile unusable for dynamic content...
  :_  state
  :~  [%pass /eyre/connect %arvo %e %disconnect [~ /profile]]
      [%pass /eyre/cache %arvo %e %set-response '/profile' ~]
  ==
::
++  on-command
  |=  =command
  ^-  (quip card _state)
  ?-  -.command
      %update-widget
    =,  command
    =.  widgets
      %+  ~(put by widgets)  desk
      (~(put by (~(gut by widgets) desk ~)) term widget)
    :_  state
    ?.  ?=(^ (find [desk term]~ layout))
      ~
    update-cache
  ::
      %delete-widget
    =,  command
    =.  widgets
      =/  nu  (~(del by (~(gut by widgets) desk ~)) term)
      ?:  =(~ nu)  (~(del by widgets) desk)
      (~(put by widgets) desk nu)
    =/  spot=(unit @ud)
      (find [desk term]~ layout)
    =?  layout  ?=(^ spot)
      (oust [u.spot 1] layout)
    :_  state
    ?~  spot  ~
    update-cache
  ==
::
++  on-action
  |=  =action
  ^-  (quip card _state)
  ?-  -.action
    %bind    bind
    %unbind  unbind
  ::
      %put-widget
    =,  action
    ?^  (find [desk term]~ layout)
      [~ state]
    =.  layout  (snoc layout [desk term])
    [update-cache state]
  ::
      %del-widget
    =,  action
    ?~  spot=(find [desk term]~ layout)
      [~ state]
    =.  layout  (oust [u.spot 1] layout)
    [update-cache state]
  ::
      %toggle-cta
    =.  tlon-cta  (fall set.action !tlon-cta)
    [update-cache state]
  ==
::
++  serve
  |=  order:hutils
  ^-  (list card)
  =;  payload=simple-payload:http
    ?.  =('/profile' url.request)  (spout:hutils id payload)
    ::  if we got requested the profile page, that means it's not in cache.
    ::  serve the response, but also add it into cache.
    ::
    :-  (store:hutils '/profile' `[| %payload payload])
    (spout:hutils id payload)
  ?:  =('/profile/style/page.css' url.request)
      :-  [200 ['content-type' 'text/css']~]
      `(as-octs:mimes:html style-page)
  %-  paint:hutils
  =/  =query:hutils  (purse:hutils url.request)
  ::  if the request is not for /profile, we redirect to landscape
  ::
  ?.  ?=([%profile ~] site.query)
    [%move '/apps/landscape/']
  [%page render-page]
::
++  update-cache
  ^-  (list card)
  ?.  bound  ~
  =/  payload=simple-payload:http
    (paint:hutils %page render-page)
  [%pass /eyre/cache %arvo %e %set-response '/profile' `[| %payload payload]]~
::
++  update-group-widgets
  ^-  (quip card _state)
  =/  giz=(map term widget)  (~(gut by widgets) %groups ~)
  =.  giz  (~(uni by giz) (stock-widgets bowl))
  =.  widgets  (~(put by widgets) %groups giz)
  [update-cache state]
::
++  render-page
  ^-  manx
  =/  ours=(unit contact:contacts)
    =,  contacts
    ::NOTE  we scry for the full rolodex, because we are not guaranteed to
    ::      have an entry for ourselves, and contacts doesn't expose a "safe"
    ::      (as in crashless) endpoint for checking
    =+  .^  =rolodex
          /gx/(scot %p our.bowl)/contacts/(scot %da now.bowl)/all/contact-rolodex
        ==
    =/  =foreign  (~(gut by rolodex) our.bowl *foreign)
    ?:  ?=([[@ ^] *] foreign)
      `con.for.foreign
    ~
  |^  ;html
        ;+  head
        ;+  body
      ==
  ::
  ++  head
    =/  ship=tape  (scow %p our.bowl)
    =/  name=tape
      ?~  ours  ship
      ?:  =('' nickname.u.ours)  ship
      "{(trip nickname.u.ours)} ({ship})"
    ;head
      ;title:"{name}"
      ;link(rel "stylesheet", href "/expose/style/shared.css");
      ;link(rel "stylesheet", href "/profile/style/page.css");
      ;meta(charset "utf-8");
      ;meta(name "viewport", content "width=device-width, initial-scale=1");
    ::
      ;meta(property "og:title", content "{name}");
      ;meta(property "twitter:title", content "{name}");
      ;meta(property "og:site_name", content "Urbit");
      ;meta(property "og:type", content "article");
      ;meta(property "twitter:card", content "summary_large_image");
      ;meta(property "og:article:author:username", content "{ship}");
    ::
      ;meta(property "apple-itunes-app", content "app-id=6451392109");
    ::
      ;*  =/  bio=(unit @t)
            ?~  ours  ~
            ?~(b=(to-wain:format bio.u.ours) ~ `i.b)
          =/  desc  (trip (fall bio 'on Urbit'))
      :~  ;meta(property "og:description", content "{desc}");
          ;meta(property "twitter:description", content "{desc}");
      ==
    ::
      ;*  ?~  ours  ~
          ?~  cover.u.ours  ~
      :~  ;meta(property "og:image", content "{(trip u.cover.u.ours)}");
          ;meta(property "twitter:image", content "{(trip u.cover.u.ours)}");
      ==
    ::
      ;*  ?~  ours  ~
          ?:  =('' nickname.u.ours)  ~
          :_  ~
      ;meta(property "og:article:author:first_name", content "{(trip nickname.u.ours)}");
    ==
  ::
  ++  body
    ;body.body
      ::  render all the widgets
      ::
      ;div.widget-column
        ;div(class "widget-padding{?:(?=([* ~] layout) " solo" "")}");
        ;*  %+  murn  layout
            |=  [=desk =term]
            ?.  (~(has by (~(gut by widgets) desk ~)) term)
              ~
            %-  some
            ;div.island.widget(id "{(trip desk)}--{(trip term)}")
              ;*  marl.body:(~(got by (~(got by widgets) desk)) term)
            ==
        ==
      ;*  ?.  tlon-cta  ~
          :_  ~
      ;div.tlon-badge
        ;a(href "https://tlon.io")
          ;span
            ; Powered by Tlon
          ==
        ==
      ==
    ==
  --
--
::
%-  agent:dbug
%+  verb  |
::
=|  state-0
=*  state  -
^-  agent:gall
|_  =bowl:gall
+*  this  .
    do    ~(. +>+ bowl state)
++  on-init
  ^-  (quip card _this)
  ::NOTE  we special-case the "internal" widgets
  =.  layout  [[%groups %profile] [%groups %join-button] [%groups %profile-bio] ~]
  :_  this
  :~  [%pass /contacts/ours %agent [our.bowl %contacts] %watch /contact]
      [%pass /refresh %arvo %b %wait now.bowl]
  ==
::
++  on-save
  !>(state)
::
++  on-load
  |=  ole=vase
  ^-  (quip card _this)
  ::  a different %profile agent has been spotted in the wild. it was not
  ::  compatible with the kelvin at which this agent was first released, made
  ::  no passes beyond eyre binding, and the software suite it was a part of
  ::  (realm) has since been discontinued.
  ::  so here we detect that case, and simply discard the previous state,
  ::  starting anew.
  ::
  ?:  ?&  =(%0 -.q.ole)
          ?=(^ ((soft ,[%0 (map path mime) (set @p) (unit @t)]) q.ole))
      ==
    on-init
  =.  state  !<(state-0 ole)
  ::  delay, so we don't end up scrying during load
  ::
  [[%pass /refresh %arvo %b %wait now.bowl]~ this]
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+  mark  !!
      %noun
    ?>  =(src our):bowl
    =^  caz  state
      ?+  q.vase  !!
        [%command *]  (on-command:do ;;(command +.q.vase))
        [%action *]   (on-action:do ;;(action +.q.vase))
      ==
    [caz this]
  ::
      %json
    =-  (on-poke %noun !>([%action -]))
    %.  !<(json vase)
    =,  dejs:format
    %-  of
    :~  'bind'^ul
        'unbind'^ul
        'put-widget'^(ot 'desk'^so 'term'^so ~)
        'del-widget'^(ot 'desk'^so 'term'^so ~)
        'toggle-cta'^(pe ~ bo)
    ==
  ::
      %handle-http-request
    :_  this
    (serve:do !<(order:hutils:do vase))
  ::
      %egg-any
    =+  !<(=egg-any:gall vase)
    ?-  -.egg-any
        ?(%15 %16)
      ?.  ?=(%live +<.egg-any)
        ~&  [dap.bowl %egg-any-not-live]
        [~ this]
      (on-load -:!>(*state-0) +>.old-state.egg-any)
    ==
  ==
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?+  path  !!
    [%http-response *]  [~ this]
  ==
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ~|  wire=wire
  ?+  wire  ~|(%strange-wire !!)
      [%contacts %ours ~]
    =^  caz  state  update-group-widgets:do
    [caz this]
  ==
::
++  on-arvo
  |=  [=wire sign=sign-arvo]
  ~|  wire=wire
  ?+  wire  ~|(%strange-wire !!)
      [%refresh ~]
    ::NOTE  this also calls +update-cache for us
    =^  caz  state  update-group-widgets:do
    [caz this]
  ::
      [%eyre %connect ~]
    ~!  sign
    ?>  ?=([%eyre %bound *] sign)
    =^  caz  state  (did-bind:do accepted.sign)
    [caz this]
  ==
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
      [%x %bound ~]
    ``loob+!>(bound)
  ::
      [%x %bound %json ~]
    ``json+!>(b+bound)
  ::
      [%x %widgets %json ~]
    =;  =json  ``json+!>(json)
    =,  enjs:format
    %-  pairs
    %+  turn  ~(tap by widgets)
    |=  [=desk wis=(map term widget)]
    :-  desk
    %-  pairs
    %+  turn  ~(tap by wis)
    |=  [=term widget]
    [term s+desc]
  ::
      [%x %layout %json ~]
    =;  =json  ``json+!>(json)
    :-  %a
    %+  turn  layout
    |=  [=desk =term]
    (pairs:enjs:format 'desk'^s+desk 'term'^s+term ~)
  ==
::
++  on-leave  |=(* [~ this])
::
++  on-fail
  |=  [=term =tang]
  ^-  (quip card _this)
  %-  (slog (rap 3 dap.bowl ' failed, ' term ~) tang)
  [~ this]
--

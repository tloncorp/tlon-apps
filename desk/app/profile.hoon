::  profile: public profile page engine
::
::    optionally binds to /profile, serving a small version of the host ship's
::    groups profile to the public web.
::    other apps can poke this agent with widgets of their own, and the user
::    can choose which widgets to display on their public page.
::
/-  contacts
/+  dbug, verb, sigil
/=  stock-widgets  /app/profile/widgets
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
  |=  order:rudder
  ^-  (list card)
  =;  payload=simple-payload:http
    ?.  =('/profile' url.request)  (spout:rudder id payload)
    ::  if we got requested the profile page, that means it's not in cache.
    ::  serve the response, but also add it into cache.
    ::
    :-  [%pass /eyre/cache %arvo %e %set-response '/profile' `[| %payload payload]]
    (spout:rudder id payload)
  %-  paint:rudder
  =/  =query:rudder  (purse:rudder url.request)
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
    (paint:rudder %page render-page)
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
  ++  style
    '''
    @import url("https://fonts.cdnfonts.com/css/source-code-pro");

    .body {
      width: 100vw;
      max-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      margin: 0;
      padding: 0;
      background-color: white;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
      color: black;
      -webkit-font-smoothing: antialiased; /* Chrome, Safari */
      -moz-osx-font-smoothing: grayscale; /* Firefox */
      text-rendering: optimizeLegibility; /* General */
    }

    .widget-column {
      width: 600px;
      max-width: 85vw;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .call-to-action {
      position: fixed;
      bottom: 36px;
      left: 36px;
      border: 2px solid black;
      padding: 6px 12px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      color: black;
      background-color: white;
    }

    #call-to-action-icon-path {
      fill: black;
      fill-opacity: 1;
    }

    .call-to-action-text {
      margin: 0 0 0 8px;
      font-weight: 500;
    }

    .cta-banner {
      z-index: 9999;
      position: fixed;
      text-decoration: none;
      color: white;
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 17px;
      font-weight: 500;
      line-height: 22px;
      background-color: black;
    }

    .widget {
      position: relative;
      box-sizing: border-box;
      width: 100%;
      max-width: 345px;
      margin: 0 auto 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
      color: black;
    }

    @media (max-width: 480px) {
      .cta-banner {
        bottom: 0px;
        left: 0px;
      }

      .widget-column {
        padding-bottom: 56px;
      }
    }

    @media (prefers-color-scheme: dark) {
      .cta-banner {
        background-color: white;
        color: black;
      }

      .body {
        background-color: #000000;
      }

      .widget {
        color: white;
      }

      .call-to-action {
        border: 2px solid white;
        color: white;
        background-color: black;
        bottom: 24px;
        left: 24px;
      }

      #call-to-action-icon-path {
        fill: white;
      }
    }
    '''
  ::
  ++  head
    =/  ship=tape  (scow %p our.bowl)
    =/  name=tape
      ?~  ours  ship
      ?:  =('' nickname.u.ours)  ship
      "{(trip nickname.u.ours)} ({ship})"
    ;head
      ;title:"{name}"
      ;style:"{(trip style)}"
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
            ;div.widget(id "{(trip desk)}--{(trip term)}")
              ;*  marl.body:(~(got by (~(got by widgets) desk)) term)
            ==
        ==
      ;*  ?.  tlon-cta  ~
          :_  ~
      ;a.cta-banner(href "https://join.tlon.io")
        ;svg.hero-button-svg
          =width  "18"
          =height  "18"
          =viewBox  "0 0 18 18"
          =xmlns  "http://www.w3.org/2000/svg"
          ;path
            =d  "M15.4151 0.259814L0.497261 1.82774C0.222631 1.85661 0.0233995 2.10264 0.0522642 2.37727L0.391982 5.60946C0.420847 5.88409 0.666877 6.08332 0.941507 6.05446L5.41686 5.58408C5.96612 5.52635 6.45818 5.92482 6.51591 6.47407L6.79029 9.08469C6.84081 9.5653 6.49215 9.99585 6.01155 10.0464C5.53095 10.0969 5.10039 9.74822 5.04988 9.26762L4.85389 7.40289C4.82502 7.12826 4.57899 6.92903 4.30436 6.95789L1.07217 7.29761C0.797538 7.32648 0.598306 7.57251 0.627171 7.84714L1.56793 16.7978C1.62566 17.3471 2.11772 17.7456 2.66698 17.6878L16.5903 16.2244C17.1395 16.1667 17.538 15.6746 17.4803 15.1254L16.5395 6.17468C16.5107 5.90005 16.2646 5.70082 15.99 5.72968L12.7578 6.0694C12.4832 6.09827 12.2839 6.3443 12.3128 6.61893L12.5088 8.48366C12.5593 8.96426 12.2107 9.39481 11.73 9.44533C11.2494 9.49584 10.8189 9.14718 10.7684 8.66658L10.494 6.05596C10.4363 5.5067 10.8347 5.01464 11.384 4.95691L15.8593 4.48653C16.134 4.45767 16.3332 4.21164 16.3043 3.93701L15.9646 0.70481C15.9357 0.430181 15.6897 0.230949 15.4151 0.259814Z";
        ==
        Get a Tlon Profile
      ==
    ==
  --
::
++  rudder  ::  http request utils
  ::NOTE  most of the below are also available in /lib/server, but we
  ::      reimplement them here for independence's sake
  |%
  +$  order  [id=@ta inbound-request:eyre]
  +$  query  [trail args=(list [key=@t value=@t])]
  +$  trail  [ext=(unit @ta) site=(list @t)]
  +$  reply
    $%  [%page bod=manx]                                  ::  html page
        [%xtra hed=header-list:http bod=manx]             ::  html page w/ heads
        [%next loc=@t msg=@t]                             ::  303, succeeded
        [%move loc=@t]                                    ::  308, use other
        [%auth loc=@t]                                    ::  307, please log in
    ==
  ::
  ++  purse  ::  url cord to query
    |=  url=@t
    ^-  query
    (fall (rush url ;~(plug apat:de-purl:html yque:de-purl:html)) [[~ ~] ~])
  ::
  ++  press  ::  manx to octs
    (cork en-xml:html as-octt:mimes:html)
  ::
  ++  paint  ::  render response into payload
    |=  =reply
    ^-  simple-payload:http
    ?-  -.reply
      %page  [[200 ['content-type' 'text/html']~] `(press bod.reply)]
      %xtra  =?  hed.reply  ?=(~ (get-header:http 'content-type' hed.reply))
               ['content-type'^'text/html' hed.reply]
             [[200 hed.reply] `(press bod.reply)]
      %next  =;  loc  [[303 ['location' loc]~] ~]
             ?~  msg.reply  loc.reply
             %+  rap  3
             :~  loc.reply
                 ?:(?=(^ (find "?" (trip loc.reply))) '&' '?')
                 'rmsg='
                 (crip (en-urlt:html (trip msg.reply)))
             ==
      %move  [[308 ['location' loc.reply]~] ~]
      %auth  =/  loc  (crip (en-urlt:html (trip loc.reply)))
             [[307 ['location' (cat 3 '/~/login?redirect=' loc)]~] ~]
    ==
  ::
  ++  spout  ::  build full response cards
    |=  [eyre-id=@ta simple-payload:http]
    ^-  (list card)
    =/  =path  /http-response/[eyre-id]
    :~  [%give %fact ~[path] [%http-response-header !>(response-header)]]
        [%give %fact ~[path] [%http-response-data !>(data)]]
        [%give %kick ~[path] ~]
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
    (serve:do !<(order:rudder:do vase))
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

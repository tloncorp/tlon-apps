::  profile: public profile page engine
::
/-  contacts
/+  dbug, verb
::
|%
+$  state-0
  $:  %0
      bound=_|
      previous-home=(unit dude:gall)
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
+$  command  ::  agent command
  $%  [%update-widget =desk =term =widget]
      [%delete-widget =desk =term]
  ==
::
+$  action  ::  user action
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
  ::TODO  maybe want to serve at /, but see below
  :-  [%pass /eyre/connect %arvo %e %connect [~ /profile] dap.bowl]~
  ::  if we will be overwriting an existing binding, remember it, so that we
  ::  may restore it if we ever +unbind ourselves
  ::
  state
  ::  actually, docket serves a couple things at or somewhere / implicitly,
  ::  things that other frontends depend on. we may want to be a tad more
  ::  careful here, if we still want to serve on / ourselves...
  :: =+  .^  binds=(list [=binding:eyre * =action:eyre])
  ::       /e/(scot %p our.bowl)/bindings/(scot %da now.bowl)
  ::     ==
  :: |-
  :: ?~  binds  state
  :: ?.  ?=([[~ ~] * [%app *]] i.binds)
  ::   $(binds t.binds)
  :: state(previous-home `app.action.i.binds)
::
++  did-bind
  |=  success=?
  ^-  (quip card _state)
  ?:  success
    [~ state(bound &)]
  [~ state(bound |, previous-home ~)]
::
++  unbind
  ^-  (quip card _state)
  ?.  bound  [~ state]
  =.  bound  |
  ?~  previous-home
    :_  state
    [%pass /eyre/connect %arvo %e %disconnect [~ /profile]]~
  ::  if we had overwritten another agent's binding, restore it
  ::
  :_  state(previous-home ~)
  [%pass /eyre/connect %arvo %e %connect [~ /] u.previous-home]~
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
  ::  we bound at /, so act as a final routing catch-all. to be polite,
  ::  if the request is not for / or /profile, we redirect to landscape.
  ::
  ?.  ?=(?(~ [%profile ~]) site.query)
    [%move '/apps/landscape/']
  [%page render-page]
::
++  update-cache
  ^-  (list card)
  =/  payload=simple-payload:http
    (paint:rudder %page render-page)
  [%pass /eyre/cache %arvo %e %set-response '/profile' `[| %payload payload]]~
::
++  render-page
  ^-  manx
  =,  contacts
  =+  .^  =rolodex
        /gx/(scot %p our.bowl)/contacts/(scot %da now.bowl)/all/contact-rolodex
      ==
  =/  ours=(unit contact)
    ::NOTE  we scry for the full rolodex, because we are not guaranteed to
    ::      have an entry for ourselves, and contacts doesn't expose a "safe"
    ::      (as in crashless) endpoint for checking
    =/  =foreign  (~(gut by rolodex) our.bowl *foreign)
    ?:  ?=([[@ ^] *] foreign)
      ~!  foreign
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
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 1rem;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background-color: white;
    }

    .call-to-action {
      position: absolute;
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
    }

    .call-to-action-icon {
      position: relative;
      top: 2px;
    }

    .call-to-action-text {
      margin: 0 0 0 8px;
      font-weight: 500;
    }

    .widget {
      position: relative;
      box-sizing: border-box;
      width: 400px;
      max-width: 85vw;
      border-radius: 40px;
      margin-top: 20px;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
      color: black;
      box-shadow: 0px 10px 50px 0px rgba(0, 0, 0, 0.1),
        0px 20px 30px 0px rgba(0, 0, 0, 0.15), 0px 0px 1px 0px black;
    }

    #profile-widget {
      position: relative;
      width: 400px;
      height: 400px;
      max-width: 85vw;
      max-height: 85vw;
      border-radius: 40px;

      position: relative;
      aspect-ratio: 1 / 1;
      overflow: hidden;

      display: flex;
      justify-content: center;
      align-items: flex-end;

      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
      color: white;

      box-shadow: 0px 10px 50px 0px rgba(0, 0, 0, 0.1),
        0px 20px 30px 0px rgba(0, 0, 0, 0.15), 0px 0px 1px 0px black;

      transition: transform 0.3s ease-in-out;
    }

    .profile-background {
      width: 100%;
      height: 100%;
      object-fit: cover;
      position: absolute;
      z-index: 1;
      -webkit-user-select: none;
      -khtml-user-select: none;
      -moz-user-select: none;
      -o-user-select: none;
      user-select: none;
    }

    #profile-overlay1 {
      z-index: 6;
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 50px;

      background: rgba(0, 0, 0, 0.1);
      backdrop-filter: blur(1px);
      box-shadow: 0 -50px 16px 18px rgba(0, 0, 0, 0.1);
    }

    #profile-overlay2 {
      z-index: 7;
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 120px;

      background: rgba(0, 0, 0, 0.2);
      backdrop-filter: blur(1px);
      box-shadow: 0 -50px 16px 18px rgba(0, 0, 0, 0.2);
    }

    #profile-overlay3 {
      z-index: 8;
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 200px;

      background: rgba(0, 0, 0, 0.1);
      backdrop-filter: blur(1px);
      box-shadow: 0 -50px 16px 18px rgba(0, 0, 0, 0.1);
    }

    #profile-overlay4 {
      z-index: 9;
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 210px;

      background: rgba(0, 0, 0, 0.3);
      box-shadow: 0 -20px 30px 18px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(1px);
    }

    #profile-content {
      position: relative;
      width: 100%;
      height: 220px;

      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: start;

      padding: 0px 36px 0px 36px;
      z-index: 99;
    }

    #profile-header {
      display: flex;
      align-items: center;
      position: relative;
      z-index: 11;
    }

    #profile-avatar {
      width: 80px;
      aspect-ratio: 1 / 1;
      border-radius: 12px;
      margin-right: 16px;
      object-fit: cover;
      z-index: 3;
    }

    #profile-title {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: start;
    }

    #profile-nickname {
      margin-top: 0;
      margin-bottom: 0;
      font-size: 17px;
      font-weight: 500;
    }

    #profile-username {
      font-family: "Source Code Pro", monospace;
      margin-bottom: 0;
      font-size: 16px;
      opacity: 70%;
      margin-top: 4px;
    }

    #profile-bio {
      flex: 1;
      position: relative;
      z-index: 11;
      overflow: hidden;
      margin-top: 20px;
      display: flex;
      flex-direction: column;
    }

    #bio-title {
      font-size: 17px;
      opacity: 70%;
      display: block;
    }

    #bio-content {
      flex: 1;
      margin-top: 6px;
      font-size: 17px;
      line-height: 24px;
    }

    .fade-text {
      background: linear-gradient(
        to bottom,
        rgb(255, 255, 255) 0%,
        rgb(255, 255, 255) 20%,
        rgba(255, 255, 255, 0.1) 100%
      );
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      color: transparent;
      display: inline-block;
    }

    @media (max-width: 480px) {
      #profile-widget {
        border-radius: 40px;
      }

      #profile-overlay4 {
        height: 180px;
      }

      #profile-overlay3 {
        height: 100px;
      }

      #profile-content {
        height: 200px;
        padding: 0 30px 0px 30px;
      }

      #profile-avatar {
        width: 72px;
      }

      .fade-text {
        background: linear-gradient(
          to bottom,
          rgb(255, 255, 255) 0%,
          rgb(255, 255, 255) 5%,
          rgba(255, 255, 255, 0.1) 100%
        );
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        color: transparent;
        display: inline-block;
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
      ;meta(name "viewport", content "width=device-width, initial-scale=1");
    ::
      ;meta(property "og:title", content "{name}");
      ;meta(property "twitter:title", content "{name}");
      ;meta(property "og:site_name", content "Urbit");
      ;meta(property "og:type", content "article");
      ;meta(property "twitter:card", content "summary_large_image");
      ;meta(property "og:article:author:username", content "{ship}");
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
      ;div#profile-widget
        ;*  ?~  ours  ~
            ?~  cover.u.ours  ~
        :_  ~
        ;img#profile-background.profile-background
           =src  "{(trip u.cover.u.ours)}"
           =alt  "Background";

        ;div#profile-content
          ;div#profile-overlay1;
          ;div#profile-overlay2;
          ;div#profile-overlay3;
          ;div#profile-overlay4;
        ::
          ;div#profile-header
            ;+  ?:  &(?=(^ ours) ?=(^ avatar.u.ours) !=('' u.avatar.u.ours))
                  ;img#profile-avatar
                    =src  "{(trip u.avatar.u.ours)}"
                    =alt  "Avatar";
                =/  color=tape
                  %-  (x-co:co 6)
                  ?~(ours 0x0 color.u.ours)
                ?:  (gth our.bowl 0xffff.ffff)
                  ::  just the color, for moons and comets
                  ::
                  ;div#profile-avatar(style "background-color: #{color}");
                ::TODO  we can't control margin, color etc from this. we should
                ::      probably import sigil.hoon, that way we can support
                ::      moon and comet sigils too
                ;img#profile-avatar
                  =src  "https://azimuth.network/erc721/{+:(scow %p our.bowl)}.svg"
                  =alt  "Sigil";
          ::
            ;div#profile-title
              ;*  =*  name  (cite:title our.bowl)
                  =*  plain  ;p#profile-nickname(title "{(scow %p our.bowl)}"):"{name}"
                  ?~  ours  [plain]~
                  ?:  =('' nickname.u.ours)  [plain]~
                  :~  ;p#profile-nickname:"{(trip nickname.u.ours)}"
                      ;p#profile-username(title "{(scow %p our.bowl)}"):"{name}"
                  ==
            ==
          ==
        ::
          ;*  ?~  ours  ~
              ?:  =('' bio.u.ours)  ~
          :_  ~
          ;div#profile-bio
            ;span#bio-title:"Info"
            ;span#bio-content
              ;*  %+  join  `manx`;br;
                  %+  turn  (to-wain:format bio.u.ours)
                  |=  p=@t  ^-  manx
                  [[%$ $+[p ~] ~] ~]
            ==
          ==
        ==
      ==
      ;*  %+  turn  layout
          |=  [=desk =term]
          ;div.widget(id "{(trip desk)}--{(trip term)}")
            ;*  marl.body:(~(got by (~(got by widgets) desk)) term)
          ==
      ::TODO  maybe only display if Host header has *.tlon.network?
      ;*  ?.  tlon-cta  ~
          :_  ~
      ;a.call-to-action/"https://tlon.network/lure/~nibset-napwyn/tlon"
        ;div.call-to-action-icon
          ;svg
            =width  "18"
            =height  "18"
            =viewBox  "0 0 18 18"
            =fill  "none"
            =xmlns  "http://www.w3.org/2000/svg"
            ;path
              =d  "M15.4151 0.259814L0.497261 1.82774C0.222631 1.85661 0.0233995 2.10264 0.0522642 2.37727L0.391982 5.60946C0.420847 5.88409 0.666877 6.08332 0.941507 6.05446L5.41686 5.58408C5.96612 5.52635 6.45818 5.92482 6.51591 6.47407L6.79029 9.08469C6.84081 9.5653 6.49215 9.99585 6.01155 10.0464C5.53095 10.0969 5.10039 9.74822 5.04988 9.26762L4.85389 7.40289C4.82502 7.12826 4.57899 6.92903 4.30436 6.95789L1.07217 7.29761C0.797538 7.32648 0.598306 7.57251 0.627171 7.84714L1.56793 16.7978C1.62566 17.3471 2.11772 17.7456 2.66698 17.6878L16.5903 16.2244C17.1395 16.1667 17.538 15.6746 17.4803 15.1254L16.5395 6.17468C16.5107 5.90005 16.2646 5.70082 15.99 5.72968L12.7578 6.0694C12.4832 6.09827 12.2839 6.3443 12.3128 6.61893L12.5088 8.48366C12.5593 8.96426 12.2107 9.39481 11.73 9.44533C11.2494 9.49584 10.8189 9.14718 10.7684 8.66658L10.494 6.05596C10.4363 5.5067 10.8347 5.01464 11.384 4.95691L15.8593 4.48653C16.134 4.45767 16.3332 4.21164 16.3043 3.93701L15.9646 0.70481C15.9357 0.430181 15.6897 0.230949 15.4151 0.259814Z"
              =fill  "black"
              =style  "fill: black; fill-opacity: 1";
          ==
        ==
        ;p.call-to-action-text:"Hop on Tlon"
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
  :_  this
  [%pass /contacts/ours %agent [our.bowl %contacts] %watch /contact]~
::
++  on-save
  !>(state)
::
++  on-load
  |=  ole=vase
  ^-  (quip card _this)
  =.  state  !<(state-0 ole)
  [update-cache:do this]
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
    :-  update-cache:do
    this
  ==
::
++  on-arvo
  |=  [=wire sign=sign-arvo]
  ~|  wire=wire
  ?+  wire  ~|(%strange-wire !!)
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

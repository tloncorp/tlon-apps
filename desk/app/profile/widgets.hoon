::  profile: construct stock widgets
::
/-  contacts
/+  sigil
::
|=  =bowl:gall
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
|^  %-  ~(gas by *(map term [%0 @t %marl marl]))
    :~  [%profile %0 'Profile Header' %marl profile-widget]
        [%profile-bio %0 'Profile Bio' %marl profile-bio]
        [%join-button %0 '"Join me" button' %marl join-button]
    ==
::
++  join-button
  ^-  marl
  =/  style=@t
    '''
    .hero-button {
      position: relative;
      width: 100%;
      padding: 12px 0px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 56px;
      font-weight: 500;
      border: solid 2px black;
      outline: none;
      text-decoration: none;
      color: black;
    }

    .hero-button:active {
      background-color: black;
      color: white;
    }

    .hero-button-svg {
      height: 20px;
      width: 20px;
      margin-right: 14px;
      fill: white;
    }

    .blurred-sphere {
      z-index: 9;
      background-color: #0068D4;
      border-radius: 50%;
      opacity: 0.4;
      filter: blur(24.000255584716797px);
      height: 80px;
      width: 80px;
    }

    .sphere-1 {
      position: absolute;
      top: 8px;
      left: 14px;
    }

    .sphere-2 {
      position: absolute;
      bottom: 16px;
      right: 24px;
      height: 80px;
      width: 80px;
    }

    @media (prefers-color-scheme: dark) {
      .hero-button {
        background-color: none;
        border: solid 2px white;
        color: white;
      }

      .hero-button:active {
        background-color: white;
        color: black;
      }

      .hero-button-svg {
        fill: black;
      }
    }
    '''
  :~
    ;style:"{(trip style)}"
  ::
    ;a.hero-button/"https://join.tlon.io/dm-{(slag 1 (scow %p our.bowl))}"
      :: ;svg.hero-button-svg
      ::   =width  "18"
      ::   =height  "18"
      ::   =viewBox  "0 0 18 18"
      ::   =xmlns  "http://www.w3.org/2000/svg"
      ::   ;path
      ::     =d  "M15.4151 0.259814L0.497261 1.82774C0.222631 1.85661 0.0233995 2.10264 0.0522642 2.37727L0.391982 5.60946C0.420847 5.88409 0.666877 6.08332 0.941507 6.05446L5.41686 5.58408C5.96612 5.52635 6.45818 5.92482 6.51591 6.47407L6.79029 9.08469C6.84081 9.5653 6.49215 9.99585 6.01155 10.0464C5.53095 10.0969 5.10039 9.74822 5.04988 9.26762L4.85389 7.40289C4.82502 7.12826 4.57899 6.92903 4.30436 6.95789L1.07217 7.29761C0.797538 7.32648 0.598306 7.57251 0.627171 7.84714L1.56793 16.7978C1.62566 17.3471 2.11772 17.7456 2.66698 17.6878L16.5903 16.2244C17.1395 16.1667 17.538 15.6746 17.4803 15.1254L16.5395 6.17468C16.5107 5.90005 16.2646 5.70082 15.99 5.72968L12.7578 6.0694C12.4832 6.09827 12.2839 6.3443 12.3128 6.61893L12.5088 8.48366C12.5593 8.96426 12.2107 9.39481 11.73 9.44533C11.2494 9.49584 10.8189 9.14718 10.7684 8.66658L10.494 6.05596C10.4363 5.5067 10.8347 5.01464 11.384 4.95691L15.8593 4.48653C16.134 4.45767 16.3332 4.21164 16.3043 3.93701L15.9646 0.70481C15.9357 0.430181 15.6897 0.230949 15.4151 0.259814Z";
      :: ==
      ;span:"Message me on Tlon"
    ==
  ==
::
++  profile-bio
  ^-  marl
  =/  style=@t
      '''
      .profile-bio {
        margin-top: 8px;
        width: 345px;
      }

      .profile-bio > p {
        font-size: 17px;
        font-style: normal;
        font-weight: 400;
      }

      .profile-bio-title {
        opacity: 50%;
        margin-top: 0;
        margin-bottom: 0;
      }

      .profile-bio-content {
        margin-top: 12px;
        font-size: 17px;
        line-height: 22px;
        letter-spacing: -0.408px;

      }
      '''
  :~
    ;style:"{(trip style)}"
  ::
  ;div.profile-bio
    ;p.profile-bio-title: Info
      ;p.profile-bio-content
        ;*  =*  stand-in
              =/  class=tape
                ?-  (clan:title our.bowl)
                  %czar  "galaxy"
                  %king  "star"
                  %duke  "planet"
                  %earl  "moon"
                  %pawn  "comet"
                ==
              =/  since=tape
                =+  .^([@ud time=@da] %cw /(scot %p our.bowl)/base/1)
                =.  time  (sub time (mod time ~d1))
                (scow %da time)
              :_  ~
              ;p
                ;em:"A {class} flying through space since {since}..."
              ==
            ?~  ours  stand-in
            ?:  =('' bio.u.ours)  stand-in
            %+  join  `manx`;br;
            %+  turn  (to-wain:format bio.u.ours)
            |=  p=@t  ^-  manx
            [[%$ $+[p ~] ~] ~]
      ==
    ==
  ==
::
++  profile-widget
  ^-  marl
  =/  style=@t
    '''
    .widget-padding {
      min-height: 80px;
      width: 100%;
    }

    #profile-background {
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

    #profile-headline {
      display: flex;
      align-items: center;
      position: relative;
      z-index: 11;
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

      .widget-padding {
        min-height: 24px;
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

    #profile-with-header {
      margin: 0 auto 20px;
      position: relative;
      width: 345px;
      height: 345px;
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
    }

    .profile-headline-container {
      width: 100%;
      margin-left: 20px;
      margin-bottom: 20px;
    }

    .profile-headline {
      position: relative;
      z-index: 999;
      height: 100px;
      width: 100%;
      display: flex;
      justify-content: flex-start;
      align-items: center;
    }

    .profile-headline-avatar {
      z-index: 6;
      width: 100px;
      overflow: hidden;
      aspect-ratio: 1 / 1;
      border-radius: 12px;
      margin-right: 16px;
      object-fit: cover;
    }

    .profile-headline-avatar-sigil {
      width: 100px;
      overflow: hidden;
      aspect-ratio: 1 / 1;
      border-radius: 12px;
      margin-right: 16px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .profile-headline-avatar svg {
      width: 100% !important;
      height: 100% !important;
    }

    .profile-headline-nickname {
      z-index: 99;
      font-size: 20px;
      font-weight: 500;
      margin-top: 0;
      margin-bottom: 0;
    }

    .profile-headline-username {
      z-index: 99;
      font-size: 16px;
      margin-top: 4px;
      opacity: 60%;
      margin-top: 0;
      margin-bottom: 0;
    }
    .profile-headline-overlay {
      z-index: 5;
      position: absolute;
      width: 100%;
      height: 100px;
      bottom: 0;
      left: 0;
      backdrop-filter: blur(1px);
      background: rgba(0, 0, 0, 0.3);
      box-shadow: 0 -20px 30px 18px rgba(0, 0, 0, 0.3);
    }
    .profile-headline-overlay-2 {
      z-index: 4;
      position: absolute;
      width: 100%;
      height: 80px;
      bottom: 0;
      left: 0;
      backdrop-filter: blur(1px);
      background: rgba(0, 0, 0, 0.3);
      box-shadow: 0 -20px 30px 18px rgba(0, 0, 0, 0.3);
    }
    .profile-headline-overlay-3 {
      z-index: 4;
      position: absolute;
      width: 100%;
      height: 40px;
      bottom: 0;
      left: 0;
      backdrop-filter: blur(2px);
      background: rgba(0, 0, 0, 0.3);
      box-shadow: 0 -20px 30px 18px rgba(0, 0, 0, 0.3);
    }

    #profile-without-header {
      width: 345px;
      display: flex;
      margin-bottom: 20px;
    }
    '''
  :~
    ;style:"{(trip style)}"
  ::
    =/  src=(unit @t)
      ?~  ours  ~
      ?~  cover.u.ours  ~
      ?:  =('' u.cover.u.ours)  ~
      `u.cover.u.ours
    ?~  src
      ;div#profile-without-header
        ;div.profile-headline
          ;+  ?:  &(?=(^ ours) ?=(^ avatar.u.ours) !=('' u.avatar.u.ours))
            ;img.profile-headline-avatar
              =src  "{(trip u.avatar.u.ours)}"
              =alt  "Avatar";
          =/  value=@ux   ?~(ours 0x0 color.u.ours)
          =/  color=tape  ((x-co:co 6) value)
          ;div.profile-headline-avatar-sigil(style "background-color: #{color}")
            ;+  %.  our.bowl
            %_  sigil
              bg  '#'^color
              ::REVIEW  groups fe caps the color's lightness, instead of
              ::        choosing between white/black fg. should we, too?
              fg  "white" ::?:((gth (div (roll (rip 3 value) add) 3) 127) "black" "white")
            ==
          ==
          ::
          ;div.profile-headline-title
            ;*  =*  name  (cite:title our.bowl)
              =*  plain  ;p.profile-headline-nickname(title "{(scow %p our.bowl)}"):"{name}"
              ?~  ours  [plain]~
              ?:  =('' nickname.u.ours)  [plain]~
              :~  ;p.profile-headline-nickname:"{(trip nickname.u.ours)}"
                  ;p.profile-headline-username(title "{(scow %p our.bowl)}"):"{name}"
          ==
        ==
        ==
      ==
    ;div#profile-with-header
      ;img#profile-background
        =src  "{(trip u.src)}"
        =alt  "Background";
        ;div.profile-headline-container
          ;div.profile-headline
          ;+  ?:  &(?=(^ ours) ?=(^ avatar.u.ours) !=('' u.avatar.u.ours))
            ;img.profile-headline-avatar
              =src  "{(trip u.avatar.u.ours)}"
              =alt  "Avatar";
          =/  value=@ux   ?~(ours 0x0 color.u.ours)
          =/  color=tape  ((x-co:co 6) value)
          ;div.profile-headline-avatar(style "background-color: #{color}")
            ;+  %.  our.bowl
            %_  sigil
              size  80
              bg  '#'^color
              ::REVIEW  groups fe caps the color's lightness, instead of
              ::        choosing between white/black fg. should we, too?
              fg  "white" ::?:((gth (div (roll (rip 3 value) add) 3) 127) "black" "white")
            ==
          ==
          ::
          ;div.profile-headline-title
            ;*  =*  name  (cite:title our.bowl)
              =*  plain  ;p.profile-headline-nickname(title "{(scow %p our.bowl)}"):"{name}"
              ?~  ours  [plain]~
              ?:  =('' nickname.u.ours)  [plain]~
              :~  ;p.profile-headline-nickname:"{(trip nickname.u.ours)}"
                  ;p.profile-headline-username(title "{(scow %p our.bowl)}"):"{name}"
          ==
        ==
        ==
        ::
        ==
        ;div.profile-headline-overlay;
        ;div.profile-headline-overlay-2;
        ;div.profile-headline-overlay-3;
      ==
    ==
::
--

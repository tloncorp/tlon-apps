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
    #groups--join-button {
      width: 100%;
      background: transparent;
      padding: 0;
    }
    '''
  :~
    ;style:"{(trip style)}"
  ::
    ;a.button/"https://join.tlon.io/dm-{(slag 1 (scow %p our.bowl))}"
      ;span:"Message"
    ==
  ==
::
++  profile-bio
  ^-  marl
  =/  style=@t
      '''
      .profile-bio {}
      '''
  :~
    ;style:"{(trip style)}"
  ::
  ;div.profile-bio
    ;h2.profile-bio-title: Info
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
              ;p(style "margin-bottom: 0;")
                ;em:"A {class} flying through space since {since}..."
              ==
            ?~  ours  stand-in
            ?:  =('' bio.u.ours)  stand-in
            %+  join  `manx`;br;
            %+  turn  (to-wain:format bio.u.ours)
            |=  p=@t  ^-  manx
            [[%$ [%$ (trip p)] ~] ~]
      ==
    ==
  ==
::
++  profile-widget
  ^-  marl
  =/  style=@t
    '''
    #groups--profile {
      position: relative;
      overflow: hidden;
      background: linear-gradient(to bottom, transparent, var(--background-alt));
    }
    .profile-headline {
      display: flex;
      align-content: center;
      gap: 1em;
    }
    .profile-headline-avatar-sigil {
      border-radius: 1em;
      overflow: hidden;
    }
    .profile-headline-avatar {
      border-radius: 1em;
      object-fit: cover;
      width: 128px;
      height: 128px;
    }
    .profile-headline-title {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .profile-headline-title > p:first-child {
      margin-top: 0;
    }
    .profile-headline-nickname,
    .profile-headline-username {
      margin: 0;
    }
    .profile-without-header .profile-headline {
      margin-left: -2em;
    }
    .profile-with-header {
      aspect-ratio: 1/1;
      display: flex;
      align-items: flex-end;
    }
    #profile-background {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      z-index: -1;
      border-radius: 2em;
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
      ;div.profile-without-header
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
              =*  plain  ;h1.profile-headline-nickname(title "{(scow %p our.bowl)}"):"{name}"
              ?~  ours  [plain]~
              ?:  =('' nickname.u.ours)  [plain]~
              :~  ;h1.profile-headline-nickname:"{(trip nickname.u.ours)}"
                  ;p.profile-headline-username(title "{(scow %p our.bowl)}"):"{name}"
          ==
        ==
        ==
      ==
    ;div.profile-with-header
      ;img#profile-background
        =src  "{(trip u.src)}"
        =alt  "Background";
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
              =*  plain  ;h1.profile-headline-nickname(title "{(scow %p our.bowl)}"):"{name}"
              ?~  ours  [plain]~
              ?:  =('' nickname.u.ours)  [plain]~
              :~  ;h1.profile-headline-nickname:"{(trip nickname.u.ours)}"
                  ;p.profile-headline-username(title "{(scow %p our.bowl)}"):"{name}"
          ==
        ==
        ==
      ==
    ==
::
--

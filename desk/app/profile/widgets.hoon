::  profile: construct stock widgets
::
/-  co=contacts
/+  sigil
::
|=  =bowl:gall
=+  .^  =contact:co
      /gx/(scot %p our.bowl)/contacts/(scot %da now.bowl)/v1/self/contact-1
    ==
::NOTE  can't quite make a nice helper for this, wetness not wet enough...
=/  nickname=(unit @t)  =+  a=(~(gut by contact) %nickname %text '')
                        ?:(&(?=([%text *] a) !=('' +.a)) `+.a ~)
=/  bio=(unit @t)       =+  a=(~(gut by contact) %bio %text '')
                        ?:(&(?=([%text *] a) !=('' +.a)) `+.a ~)
=/  color=@ux           =+  a=(~(gut by contact) %color %tint 0x0)
                        ?:(?=([%tint *] a) +.a 0x0)
=/  avatar=(unit @ta)   =+  a=(~(gut by contact) %avatar %look '')
                        ?:(&(?=([%look *] a) !=('' +.a)) `+.a ~)
=/  cover=(unit @ta)    =+  a=(~(gut by contact) %cover %look '')
                        ?:(&(?=([%look *] a) !=('' +.a)) `+.a ~)
=/  phone=(unit @da)    =+  a=(~(gut by contact) %lanyard-tmp-phone-since %date *@da)
                        ?:(&(?=([%date *] a) !=(*@da +.a)) `+.a ~)
=/  phurl=(unit @t)     =+  a=(~(gut by contact) %lanyard-tmp-phone-url %text *@t)
                        ?:(&(?=([%text *] a) !=(*@t +.a)) `+.a ~)
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
            ?~  bio  stand-in
            %+  join  `manx`;br;
            %+  turn  (to-wain:format u.bio)
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
      flex-direction: column;
    }
    @media screen and (min-width: 15em) {
      .profile-headline {
        flex-direction: row;
      }
    }
    .profile-headline-avatar-sigil {
      flex-shrink: 0;
      border-radius: 1em;
      overflow: hidden;
      width: 128px;
      height: 128px;
    }
    .profile-headline-avatar {
      flex-shrink: 0;
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
      aspect-ratio: 16/10;
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
    =*  profile-inner
      ;div.profile-headline
        ;+  ?^  avatar
          ;img.profile-headline-avatar
            =src  "{(trip u.avatar)}"
            =alt  "Avatar";
        =/  color=tape  ((x-co:^co 6) color)
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
            ?~  nickname  [plain]~
            :+  ;h1.profile-headline-nickname:"{(trip u.nickname)}"
              ;p.profile-headline-username(title "{(scow %p our.bowl)}"):"{name}"
            ?~  phone  ~
            :_  ~
            =/  since=@da  (sub u.phone (mod u.phone ~d1))
            ::TODO  link to proof/attestation?
            ;a.verified/"{(trip (need phurl))}"
              =title  "verified since {(scow %da since)}"
              ; ✅
            ==
        ==
      ==
    ?~  cover
      ;div.profile-without-header
        ;+  profile-inner
      ==
    ;div.profile-with-header
      ;img#profile-background
        =src  "{(trip u.cover)}"
        =alt  "Background";
        ;+  profile-inner
      ==
    ==
::
--

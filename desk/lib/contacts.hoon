/-  *contacts, c0=contacts-0
/+  unicode
|%
::
+|  %contact
::  +is-value-empty: is value considered empty
::
++  is-value-empty
  |=  val=value
  ^-  ?
  ?+  -.val  |
    %text  =('' p.val)
    %look  =('' p.val)
    %set   ?=(~ p.val)
  ==
::  +cy: contact map engine
::
++  cy
  |_  c=contact
  ::  +typ: enforce type if value exists
  ::
  ++  typ
    |*  [key=@tas typ=value-type]
    ^-  ?
    =/  val=(unit value)  (~(get by c) key)
    ?~  val  &
    ?~  u.val  |
    ?-  typ
      %text  ?=(%text -.u.val)
      %numb  ?=(%numb -.u.val)
      %date  ?=(%date -.u.val)
      %tint  ?=(%tint -.u.val)
      %ship  ?=(%ship -.u.val)
      %look  ?=(%look -.u.val)
      %flag  ?=(%flag -.u.val)
      %set   ?=(%set -.u.val)
    ==
  ::  +get: typed get
  ::
  ++  get
    |*  [key=@tas typ=value-type]
    ^-  (unit _p:*$>(_typ value))
    =/  val=(unit value)  (~(get by c) key)
    ?~  val  ~
    ?~  u.val  !!
    ~|  "{<typ>} expected at {<key>}"
    ?-  typ
      %text  ?>(?=(%text -.u.val) (some p.u.val))
      %numb  ?>(?=(%numb -.u.val) (some p.u.val))
      %date  ?>(?=(%date -.u.val) (some p.u.val))
      %tint  ?>(?=(%tint -.u.val) (some p.u.val))
      %ship  ?>(?=(%ship -.u.val) (some p.u.val))
      %look  ?>(?=(%look -.u.val) (some p.u.val))
      %flag  ?>(?=(%flag -.u.val) (some p.u.val))
      %set   ?>(?=(%set -.u.val) (some p.u.val))
    ==
  ::  +ges: get specialized to typed set
  ::
  ::TODO  introduce more legible names, ges -> get-set etc.
  ++  ges
    |*  [key=@tas typ=value-type]
    ^-  (unit (set $>(_typ value)))
    =/  val=(unit value)  (~(get by c) key)
    ?~  val  ~
    ?.  ?=(%set -.u.val)
      ~|  "set expected at {<key>}"  !!
    %-  some
    %-  ~(run in p.u.val)
      ?-  typ
        %text  |=(v=value ?>(?=(%text -.v) v))
        %numb  |=(v=value ?>(?=(%numb -.v) v))
        %date  |=(v=value ?>(?=(%date -.v) v))
        %tint  |=(v=value ?>(?=(%tint -.v) v))
        %ship  |=(v=value ?>(?=(%ship -.v) v))
        %look  |=(v=value ?>(?=(%look -.v) v))
        %flag  |=(v=value ?>(?=(%flag -.v) v))
        %set   |=(v=value ?>(?=(%set -.v) v))
      ==
  ::  +gos: got specialized to typed set
  ::
  ++  gos
    |*  [key=@tas typ=value-type]
    ^-  (set $>(_typ value))
    =/  val=value  (~(got by c) key)
    ?.  ?=(%set -.val)
      ~|  "set expected at {<key>}"  !!
    %-  ~(run in p.val)
      ?-  typ
        %text  |=(v=value ?>(?=(%text -.v) v))
        %numb  |=(v=value ?>(?=(%numb -.v) v))
        %date  |=(v=value ?>(?=(%date -.v) v))
        %tint  |=(v=value ?>(?=(%tint -.v) v))
        %ship  |=(v=value ?>(?=(%ship -.v) v))
        %look  |=(v=value ?>(?=(%look -.v) v))
        %flag  |=(v=value ?>(?=(%flag -.v) v))
        %set   |=(v=value ?>(?=(%set -.v) v))
      ==
  ::  +gut: typed gut with default
  ::
  ++  gut
    |*  [key=@tas def=value]
    ^+  +.def
    =/  val=value  (~(gut by c) key ~)
    ?~  val
      +.def
    ~|  "{<-.def>} expected at {<key>}"
    ?-  -.val
      %text  ?>(?=(%text -.def) p.val)
      %numb  ?>(?=(%numb -.def) p.val)
      %date  ?>(?=(%date -.def) p.val)
      %tint  ?>(?=(%tint -.def) p.val)
      %ship  ?>(?=(%ship -.def) p.val)
      %look  ?>(?=(%look -.def) p.val)
      %flag  ?>(?=(%flag -.def) p.val)
      %set   ?>(?=(%set -.def) p.val)
    ==
  ::  +gub: typed gut with bunt default
  ::
  ++  gub
    |*  [key=@tas typ=value-type]
    ^+  +:*$>(_typ value)
    =/  val=value  (~(gut by c) key ~)
    ?~  val
      ?+  typ  !!
        %text  *@t
        %numb  *@ud
        %date  *@da
        %tint  *@ux
        %ship  *@p
        %look  *@t
        %flag  *flag:g
        %set   *(set value)
      ==
    ~|  "{<typ>} expected at {<key>}"
    ?-  typ
      %text  ?>(?=(%text -.val) p.val)
      %numb  ?>(?=(%numb -.val) p.val)
      %date  ?>(?=(%date -.val) p.val)
      %tint  ?>(?=(%tint -.val) p.val)
      %ship  ?>(?=(%ship -.val) p.val)
      %look  ?>(?=(%look -.val) p.val)
      %flag  ?>(?=(%flag -.val) p.val)
      %set   ?>(?=(%set -.val) p.val)
    ==
  --
::
++  do-edit-0
  |=  [c=contact-0:c0 f=field-0:c0]
  ^+  c
  ?-  -.f
    %nickname   c(nickname nickname.f)
    %bio        c(bio bio.f)
    %status     c(status status.f)
    %color      c(color color.f)
  ::
    %avatar     ~|  "cannot add a data url to avatar!"
                ?>  ?|  ?=(~ avatar.f)
                        !=('data:' (end 3^5 u.avatar.f))
                    ==
                c(avatar avatar.f)
  ::
    %cover      ~|  "cannot add a data url to cover!"
                ?>  ?|  ?=(~ cover.f)
                        !=('data:' (end 3^5 u.cover.f))
                    ==
                c(cover cover.f)
  ::
    %add-group  c(groups (~(put in groups.c) flag.f))
  ::
    %del-group  c(groups (~(del in groups.c) flag.f))
  ==
::  +sane-contact: verify contact sanity
::
::  - restrict size of the jammed noun to 10kB
::  - prohibit 'data:' URLs in image data
::  - nickname and bio must be a %text
::  - avatar and cover must be a %look
::  - groups must be a %set of %flags
::
++  sane-contact
  |=  [src=(unit @p) con=contact]
  ^-  ?
  ?~  ((soft contact) con)
    |
  ::  10kB contact ought to be enough for anybody
  ::
  ?:  (gth (met 3 (jam con)) 10.000)
    |
  ::  field restrictions
  ::
  ::  1. %nickname field: max 64 characters
  ::  2. %bio field: max 2048 characters
  ::  3. data URLs in %avatar and %cover
  ::     are forbidden
  ::
  ?.  (~(typ cy con) %nickname %text)  |
  =+  nickname=(~(get cy con) %nickname %text)
  ?:  ?&  ?=(^ nickname)
          ?|  (gth (met 3 u.nickname) 64)
              !(sane-nickname src u.nickname)
          ==
      ==
    |
  ?.  (~(typ cy con) %bio %text)  |
  =+  bio=(~(get cy con) %bio %text)
  ?:  ?&  ?=(^ bio)
          (gth (met 3 u.bio) 2.048)
      ==
    |
  ?.  (~(typ cy con) %avatar %look)  |
  =+  avatar=(~(get cy con) %avatar %look)
  ?:  ?&  ?=(^ avatar)
          =('data:' (end 3^5 u.avatar))
      ==
    |
  ?.  (~(typ cy con) %cover %look)  |
  =+  cover=(~(get cy con) %cover %look)
  ?:  ?&  ?=(^ cover)
          =('data:' (end 3^5 u.cover))
      ==
    |
  ?.  (~(typ cy con) %groups %set)  |
  =+  groups=(~(get cy con) %groups %set)
  ::  verifying the type of the first set element is enough,
  ::  set uniformity is verified by +soft above.
  ::
  ?:  ?&  ?=(^ groups)
          ?=(^ u.groups)
          !?=(%flag -.n.u.groups)
      ==
    |
  &
::  +sane-nickname: validate a nickname against network id
::
++  sane-nickname
  |=  [src=(unit @p) txt=@t]
  ^-  ?
  ?~  src  &
  =+  nom=(norm-p:confusable:unicode txt)
  =/  ship=(unit @p)
    %+  rush  nom
    ;~  sfix  ;~(pfix sig fed:ag)
      (star next)
    ==
  ?:  ?=(~ ship)  &
  =(u.src u.ship)
::  +sani-nickname: sanitize a nickname
::
++  sani-nickname
  |=  txt=@t
  ^-  @t
  (cat 3 '.' txt)
::  +do-edit: edit contact
::
::  edit .con with .mod contact map.
::  unifies the two maps, and deletes any resulting fields
::  that are null.
::
++  do-edit
  |=  [con=contact mod=(map @tas value)]
  ^+  con
  =/  don  (~(uni by con) mod)
  =/  del=(list @tas)
    %-  ~(rep by don)
    |=  [[key=@tas val=value] acc=(list @tas)]
    ?.  ?=(~ val)  acc
    [key acc]
  =?  don  !=(~ del)
    %+  roll  del
    |=  [key=@tas acc=_don]
    (~(del by acc) key)
  don
::  +from-0: legacy to new type
::
++  from-0
  |%
  ::  +contact: convert legacy to contact
  ::
  ++  contact
    |=  o=contact-0:c0
    ^-  ^contact
    =/  c=^contact
      %-  malt
      ^-  (list (pair @tas value))
      :~  nickname+text/nickname.o
          bio+text/bio.o
          status+text/status.o
          color+tint/color.o
      ==
    =?  c  ?=(^ avatar.o)
      (~(put by c) %avatar look/u.avatar.o)
    =?  c  ?=(^ cover.o)
      (~(put by c) %cover look/u.cover.o)
    =?  c  !?=(~ groups.o)
      %+  ~(put by c)  %groups
      :-  %set
      %-  ~(run in groups.o)
      |=  =flag:g
      flag/flag
    c
  ::  +profile: convert legacy to profile
  ::
  ++  profile
    |=  o=profile-0:c0
    ^-  ^profile
    [wen.o ?~(con.o ~ (contact con.o))]
  ::
  --
::  +from: legacy from new type
::
++  to-0
  |%
  ::  +contact: convert contact to legacy
  ::
  ++  contact
    |=  c=^contact
    ^-  $@(~ contact-0:c0)
    ?~  c  ~
    =|  o=contact-0:c0
    %_  o
      nickname
        (~(gub cy c) %nickname %text)
      bio
        (~(gub cy c) %bio %text)
      status
        (~(gub cy c) %status %text)
      color
        (~(gub cy c) %color %tint)
      avatar
        (~(get cy c) %avatar %look)
      cover
        (~(get cy c) %cover %look)
      groups
        =/  groups
          (~(get cy c) %groups %set)
        ?~  groups  ~
        ^-  (set flag:g)
        %-  ~(run in u.groups)
        |=  val=value
        ?>  ?=(%flag -.val)
        p.val
    ==
    ::  +profile: convert profile to legacy
    ::
    ++  profile
      |=  p=^profile
      ^-  profile-0:c0
      [wen.p (contact:to-0 con.p)]
    ::  +profile-0-mod: convert profile with contact overlay
    ::  to legacy
    ::
    ++  profile-mod
      |=  [p=^profile mod=^contact]
      ^-  profile-0:c0
      [wen.p (contact:to-0 (contact-uni con.p mod))]
    ::  +foreign: convert foreign to legacy
    ::
    ++  foreign
      |=  f=^foreign
      ^-  foreign-0:c0
      [?~(for.f ~ (profile:to-0 for.f)) sag.f]
    ::  foreign-mod: convert foreign with contact overlay
    ::  to legacy
    ::
    ++  foreign-mod
      |=  [f=^foreign mod=^contact]
      ^-  foreign-0:c0
      [?~(for.f ~ (profile-mod:to-0 for.f mod)) sag.f]
  --
::  +contact-uni: merge contacts
::
++  contact-uni
  |=  [c=contact mod=contact]
  ^-  contact
  (~(uni by c) mod)
::  +foreign-contact: get foreign contact
::
++  foreign-contact
  |=  far=foreign
  ^-  contact
  ?~(for.far ~ con.for.far)
::  +foreign-mod: modify foreign profile with user overlay
::
++  foreign-mod
  |=  [far=foreign mod=contact]
  ^-  foreign
  ?~  for.far
    far
  far(con.for (contact-uni con.for.far mod))
::  +sole-field-0: sole field is a field that does
::  not modify the groups set
::
+$  sole-field-0
  $~  nickname+''
  $<(?(%add-group %del-group) field-0:c0)
::  +to-sole-edit: convert legacy sole field to contact edit
::
::  modify any field except for groups
::
++  to-sole-edit
  |=  edit-0=(list sole-field-0)
  ^-  contact
  %+  roll  edit-0
    |=  $:  fed=sole-field-0
            acc=(map @tas value)
        ==
    ^+  acc
    ?-  -.fed
      ::
        %nickname
      %+  ~(put by acc)
        %nickname
      text/nickname.fed
      ::
        %bio
      %+  ~(put by acc)
        %bio
      text/bio.fed
      ::
        %status
      %+  ~(put by acc)
        %status
      text/status.fed
      ::
        %color
      %+  ~(put by acc)
        %color
      tint/color.fed
      ::
        %avatar
      ?~  avatar.fed  acc
      %+  ~(put by acc)
        %avatar
      look/u.avatar.fed
      ::
        %cover
      ?~  cover.fed  acc
      %+  ~(put by acc)
        %cover
      look/u.cover.fed
    ==
::  +to-self-edit: convert legacy to self edit
::
++  to-self-edit
  |=  [edit-0=(list field-0:c0) groups=(set value)]
  ^-  contact
  ::  converting v0 profile edit to v1 is non-trivial.
  ::  for field edits other than groups, we derive a contact
  ::  edition map. for group operations (%add-group, %del-group)
  ::  we need to operate directly on (existing?) groups field in
  ::  the profile.
  ::
  :: .sed: sole field edits, no group edits
  :: .ged: only group edit actions
  ::
  =*  group-type  ?(%add-group %del-group)
  =*  sole-edits  (list $<(group-type field-0:c0))
  =*  group-edits  (list $>(group-type field-0:c0))
  ::  sift edits
  ::
  =/  [sed=sole-edits ged=group-edits]
    ::
    ::  XX why is casting neccessary here?
    =-  [(flop `sole-edits`-<) (flop `group-edits`->)]
    %+  roll  edit-0
    |=  [f=field-0:c0 sed=sole-edits ged=group-edits]
    ^+  [sed ged]
    ?.  ?=(group-type -.f)
      :-  [f sed]
      ged
    :-  sed
    [f ged]
  ::  edit favourite groups
  ::
  =.  groups
    %+  roll  ged
    |=  [fav=$>(group-type field-0:c0) =_groups]
    ?-  -.fav
      %add-group
    (~(put in groups) flag/flag.fav)
      %del-group
    (~(del in groups) flag/flag.fav)
    ==
  %+  ~(put by (to-sole-edit sed))
    %groups
  set/groups
::  +to-action: convert legacy to action
::
::  convert any action except %edit.
::  %edit must be handled separately, since we need
::  access to existing groups to be able to process group edits.
::
++  to-action
  |=  o=$<(%edit action-0:c0)
  ^-  action
  ?-  -.o
    %anon  [%anon ~]
    ::
    :: old %meet is now a no-op
    %meet  [%meet ~]
    %heed  [%meet p.o]
    %drop  [%drop p.o]
    %snub  [%snub p.o]
  ==
::  +mono: tick time
::
++  mono
  |=  [old=@da new=@da]
  ^-  @da
  ?:  (lth old new)  new
  (add old ^~((rsh 3^2 ~s1)))
--

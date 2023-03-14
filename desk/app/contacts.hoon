/-  *contacts
/+  default-agent, dbug, verb
::
|%
+$  card     card:agent:gall
+$  profile  ?(~ $%([%gon wen=@da] [%hav con=contact]))
+$  state-0  [%0 rol=rolodex rof=profile]
::
+$  versioned-state
  $%  state-0
  ==
--
::
|%
++  do-edit
  |=  [c=contact f=field]
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
    %add-group  c(groups (~(put in groups.c) resource.f))
  ::
    %del-group  c(groups (~(del in groups.c) resource.f))
  ==
::
++  do-edits
  |=  [c=contact l=(list field)]
  ^-  (unit contact)
  =-  ?:(=(- c) ~ `-)
  (roll l |=([f=field c=_c] (do-edit c f)))
::
++  mono
  |=  [old=@da new=@da]
  ^-  @da
  ?:  (lth old new)  new
  (add old ^~((div ~s1 (bex 16))))
::
++  give-log
  |=  l=log
  ^-  card
  [%give %fact [/logs ~] %contact-log !>(l)]
::
++  give-update
  |=  u=update
  ^-  card
  [%give %fact [/contact ~] %contact-update-0 !>(u)]
--
::
=|  state-0
=*  state  -
%-  agent:dbug
%+  verb  &
^-  agent:gall
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)
::
++  on-init
  ?.  .^(? gu+/=contact-store=)
    `this
  =/  ful  .^(rolodex gx+/=contact-store=/all/noun)
  =/  old  (~(get by ful) our.bowl)
  ?:  |(?=(~ old) =(*@da last-updated.u.old))
    `this
  [~ this(rof [%hav u.old])]
::
++  on-save  !>(state)
::
++  on-load
  |=  old-vase=vase
  ^-  (quip card _this)
  =/  old  !<(versioned-state old-vase)
  ?-  -.old
    %0  [~ this(state old)]
  ==
::
++  on-watch
  |=  pat=(pole knot)
  ^-  (quip card _this)
  :_  this
  ?+    pat  ~|(bad-watch-path+pat !!)
      [%contacts %at wen=@ ~]
    =/  wen  (slav %da wen.pat)
    ?~  rof  ~
    ?-  -.rof
      %gon  ?:((lte wen.rof wen) ~ [(give-update %del wen.rof) ~])
      %hav  ?:((lte last-updated.con.rof wen) ~ [(give-update %set con.rof) ~])
    ==
  ::
      [%contacts ~]
    ?~  rof  ~
    ?-  -.rof
      %gon  [(give-update %del wen.rof) ~]
      %hav  [(give-update %set con.rof) ~]
    ==
  ::
      [%logs ~]  ~
  ==
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?>  (team:title our.bowl src.bowl)
  ?+  mark  (on-poke:def mark vase)
      ?(%contact-action %contact-action-0)
    =/  act  !<(action vase)
    ?-  -.act
      %drop  ?.  ?=([%hav *] rof)
               [~ this]
             :-  [(give-update %del now.bowl) ~]  :: XX debounce?
             this(rof [%gon now.bowl])
    ::
      %edit  ?~  new=(do-edits ?.(?=([%hav *] rof) *contact con.rof) p.act)
               [~ this]
              =.  last-updated.u.new  (mono last-updated.u.new now.bowl)
              :_  this(rof [%hav u.new])
              [(give-update %set u.new) ~]  :: XX debounce?
    ::
      %heed  ?:  ?|  =(our.bowl ship.act) :: XX skip comets? moons?
                     (~(has by wex.bowl) [/contact ship.act dap.bowl])
                 ==
               [~ this]
             :_  this       ::  XX track state
             [%pass /contact %agent [ship.act dap.bowl] %watch /contact]~ :: XX watch at
    ::
      %snub  ?:  ?|  =(our.bowl ship.act)
                     !(~(has by wex.bowl) [/contact ship.act dap.bowl])
                 ==
               [~ this]
             :_  this       ::  XX track state
             [%pass /contact %agent [ship.act dap.bowl] %leave ~]~
    ==
  ==
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+    path  (on-peek:def path)
      [%x %all ~]
    =/  lor=rolodex
      ?.(?=([%hav *] rof) rol (~(put by rol) our.bowl con.rof))
    ``noun+!>(lor)
  ::
      [%x %contact @ ~]
    ?~  who=`(unit @p)`(slaw %p i.t.t.path)
      [~ ~]
    =/  tac=(unit contact)
      ?:  =(our.bowl u.who)
        ?.(?=([%hav *] rof) ~ `con.rof)
      (~(get by rol) u.who)
    ?~  tac  [~ ~]
    ``[%contact !>(u.tac)]
  ==
::
++  on-leave  on-leave:def
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ?+  wire  ~|(evil-agent+wire !!)
      [%contact ~]
    ?-  -.sign
        %poke-ack   [~ this]
        %watch-ack  [~ this]
        %fact
      ?+    p.cage.sign  ~!(fake-news+p.cage.sign !!)
          ?(%contact-update %contact-update-0)
        =/  dat  !<(update q.cage.sign)
        ?-    -.dat
            %set
          =/  con  (~(get by rol) src.bowl)
          ?.  ?|  ?=(~ con)
                  (gth last-updated.c.dat last-updated.u.con)
              ==
            [~ this]
          :-  [(give-log src.bowl `c.dat) ~]
          this(rol (~(put by rol) src.bowl c.dat))
        ::
            %del
          =/  con  (~(get by rol) src.bowl)
          ?.  ?|  ?=(~ con)
                  (gth wen.dat last-updated.u.con)
              ==
            [~ this]
          :-  [(give-log src.bowl ~) ~]
          this(rol (~(del by rol) src.bowl)) :: XX track deletion state
        ==
      ==
    ::
        %kick
      =/  pat=path
        ?~  con=(~(get by rol) src.bowl)     :: XX check deletion state
          /contact
        /contact/at/(scot %da last-updated.u.con)
      :_  this                               ::  XX track subscription state
      [%pass /contact %agent [src.bowl dap.bowl] %watch pat]~
    ==
  ==
::
++  on-arvo   on-arvo:def
++  on-fail   on-fail:def
--

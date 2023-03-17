/-  *contacts
/+  default-agent, dbug, verb
::
|%
+$  card     card:agent:gall
+$  profile  ?(~ $%([%gon wen=@da] [%hav con=contact]))
+$  state-0  [%0 rol=rolodex rof=profile]
--
::
%-  agent:dbug
%+  verb  &
^-  agent:gall
=|  state-0
=*  state  -
::
=<  |_  =bowl:gall
    +*  this  .
        def   ~(. (default-agent this %|) bowl)
        cor   ~(. raw bowl)
    ::
    ++  on-init
      ^-  (quip card _this)
      =^  cards  state  abet:init:cor
      [cards this]
    ::
    ++  on-save  !>(state)
    ::
    ++  on-load
      |=  old=vase
      ^-  (quip card _this)
      =^  cards  state  abet:(load:cor old)
      [cards this]
    ::
    ++  on-watch
      |=  =path
      ^-  (quip card _this)
      =^  cards  state  abet:(peer:cor path)
      [cards this]
    ::
    ++  on-poke
      |=  [=mark =vase]
      ^-  (quip card _this)
      =^  cards  state  abet:(poke:cor mark vase)
      [cards this]
    ::
    ++  on-peek   peek:cor
    ++  on-leave  on-leave:def
    ::
    ++  on-agent
      |=  [=wire =sign:agent:gall]
      ^-  (quip card _this)
      =^  cards  state  abet:(agent:cor wire sign)
      [cards this]
    ::
    ++  on-arvo   on-arvo:def
    ++  on-fail   on-fail:def
    --
::
|%
::
+|  %help
::
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
+|  %state
::
::    namespaced to avoid accidental direct reference
::
++  raw
  =|  out=(list card)
  |_  =bowl:gall
  ::
  +|  %generic
  ::
  ++  abet  [(flop out) state]
  ++  cor   .
  ++  emit  |=(c=card cor(out [c out]))
  ++  give  |=(=gift:agent:gall (emit %give gift))
  ++  pass  |=([=wire =note:agent:gall] (emit %pass wire note))
  ::
  +|  %operations
  ::
  ++  pub
    |%
    ++  news
      |=(n=^news (give %fact [/news ~] %contact-news !>(n)))
    ::
    ++  diff
      |=  u=update  ::  XX scrape thru paths
      (give %fact [/contact ~] %contact-update-0 !>(u))
    ::
    ++  init
      =>  |%
          ++  fact
            |=(u=update (give %fact ~ %contact-update-0 !>(u)))
          --
      ::
      |=  wen=(unit @da)
      ^+  cor
      ?~  rof  cor
      ::  XX reject subscriptions for future dates?
      ::
      ?-  -.rof
        %gon  ?:  &(?=(^ wen) (lte wen.rof u.wen))
                cor
              (fact %del wen.rof)
      ::
        %hav  ?:  &(?=(^ wen) (lte last-updated.con.rof u.wen))
                cor
              (fact %set con.rof)
      ==
    --
  ::
  ++  sub
    |_  who=ship
    ::
    ++  hear
      |=  u=update
      ^+  cor
      =/  con  (~(get by rol) who)
      ?-    -.u
          %set
        ?.  |(?=(~ con) (gth last-updated.c.u last-updated.u.con))
          cor
        (news:pub(rol (~(put by rol) who c.u)) who `c.u)
      ::
          %del
        ?.  |(?=(~ con) (gth wen.u last-updated.u.con))
          cor
        (news:pub(rol (~(del by rol) src.bowl)) src.bowl ~) :: XX track deletion state
      ==
    ::
    ++  have   (~(has by wex.bowl) [/contact who dap.bowl])
    ::
    ++  meet  cor :: XX track state, don't subscribe
    ::
    ++  heed
      ^+  cor
      ?:  |(=(our.bowl who) have)  :: XX skip comets? moons?
        cor
      =/  pat=path
        :-  %contact
        ?~  con=(~(get by rol) who)  /     :: XX check deletion state
        /at/(scot %da last-updated.u.con)
      (pass /contact %agent [who dap.bowl] %watch pat) ::  XX track subscription state
    ::
    ++  drop  cor  :: XX delete & unsubscribe
    ::
    ++  snub   :: XX path?, track subscription state
      ?:  |(=(our.bowl who) !have)
        cor
      (pass /contact %agent [who dap.bowl] %leave ~)
    --
  ::
  ++  migrate
    ^+  cor
    ?.  .^(? gu+/=contact-store=)
      cor
    =/  ful  .^(rolodex gx+/=contact-store=/all/noun)
    =/  old  (~(get by ful) our.bowl)
    ::  XX migrate all
    ::
    ?:  |(?=(~ old) =(*@da last-updated.u.old))
      cor
    cor(rof [%hav u.old])
  ::
  +|  %implementation
  ::
  ++  init  migrate
  ::
  ++  load
    |=  old-vase=vase
    ^+  cor
    |^  =/  old  !<(versioned-state old-vase)
        ?-  -.old
          %0  cor(state old)
        ==
    ::
    +$  versioned-state
      $%  state-0
      ==
    --
  ::
  ++  poke
    |=  [=mark =vase]
    ^+  cor
    ?>  (team:title our.bowl src.bowl)
    ?+    mark  ~|(bad-mark+mark !!)
        ?(%contact-action %contact-action-0)
      =/  act  !<(action vase)
      ?-  -.act
        %anon  ?.  ?=([%hav *] rof)
                 cor
               =/  wen=@da  (mono last-updated.con.rof now.bowl)
               (diff:pub(rof [%gon wen]) %del wen)
      ::
        %edit   =*  old  ?.(?=([%hav *] rof) *contact con.rof)
                ?~  new=(do-edits old p.act)
                 cor
               =.  last-updated.u.new  (mono last-updated.u.new now.bowl)
               (diff:pub(rof [%hav u.new]) %set u.new)
      ::
        %meet  (roll p.act |=([who=@p acc=_cor] ~(meet sub:acc who)))
        %heed  (roll p.act |=([who=@p acc=_cor] ~(heed sub:acc who)))
        %drop  (roll p.act |=([who=@p acc=_cor] ~(drop sub:acc who)))
        %snub  (roll p.act |=([who=@p acc=_cor] ~(snub sub:acc who)))
      ==
    ==
  ::
  ++  peek
    |=  pat=(pole knot)
    ^-  (unit (unit cage))
    ?+    pat  [~ ~]
        [%x %all ~]
      =/  lor=rolodex
        ?.(?=([%hav *] rof) rol (~(put by rol) our.bowl con.rof))
      ``noun+!>(lor)
    ::
        [%x %contact her=@ ~]
      ?~  who=`(unit @p)`(slaw %p her.pat)
        [~ ~]
      =/  tac=(unit contact)
        ?:  =(our.bowl u.who)
          ?.(?=([%hav *] rof) ~ `con.rof)
        (~(get by rol) u.who)
      ?~  tac  [~ ~]
      ``[%contact !>(u.tac)]
    ==
  ::
  ++  peer
    |=  pat=(pole knot)
    ^+  cor
    ?+  pat  ~|(bad-watch-path+pat !!)
      [%contacts %at wen=@ ~]  (init:pub `(slav %da wen.pat))
      [%contacts ~]  (init:pub ~)
      [%news ~]  ~|(local-news+src.bowl ?>(=(our src):bowl cor))
    ==
  ::
  ++  agent
    |=  [=wire =sign:agent:gall]
    ^+  cor
    ?+  wire  ~|(evil-agent+wire !!)
        [%contact ~]
      ?-  -.sign
        %poke-ack   ~|(strange-poke-ack+wire !!)
        %watch-ack  cor :: XX handle
        %kick       ~(heed sub src.bowl)
        %fact       ?+    p.cage.sign  ~!(fake-news+p.cage.sign !!)
                        ?(%contact-update %contact-update-0)
                      (~(hear sub src.bowl) !<(update q.cage.sign))
      ==            ==
    ==
  --
--

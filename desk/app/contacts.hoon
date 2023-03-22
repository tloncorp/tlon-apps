/-  *contacts
/+  default-agent, dbug, verb
::
|%
++  okay  `epic`0
++  mar
  |%
  ++  base
    |%
    +$  act  %contact-action
    +$  upd  %contact-update
    --
  ++  act  `mark`^~((rap 3 *act:base '-' (scot %ud okay) ~))
  ++  upd  `mark`^~((rap 3 *upd:base '-' (scot %ud okay) ~))
  --
::
+$  card     card:agent:gall
+$  state-0  [%0 rof=profile rol=rolodex]
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
    ++  on-save  !>([state okay])
    ::
    ++  on-load
      :: =-  _`this
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
    =>  |%
        ::  if this proves to be too slow, the set of paths
        ::  should be maintained statefully: put on +init:pub,
        ::  and filtered on +load (to avoid a space leak).
        ::
        ++  subs
          ^-  (set path)
          %-  ~(rep by sup.bowl)
          |=  [[duct ship pat=path] acc=(set path)]
          ?.(?=([%contact *] pat) acc (~(put in acc) pat))
        ::
        ++  fact
          |=  [pat=(list path) u=update]
          ^-  gift:agent:gall
          [%fact pat %contact-update-0 !>(u)]
        --
    ::
    |%
    ++  news
      |=(n=^news (give %fact [/news ~] %contact-news !>(n)))
    ::
    ++  diff
      |=  con=?(~ contact)
      =/  u=update  [?~(rof now.bowl (mono wen.rof now.bowl)) con]
      (give:(news(rof u) our.bowl con) (fact ~(tap in subs) u))
    ::
    ++  init
      |=  wen=(unit @da)
      ?~  rof  cor
      ?~  wen  (give (fact ~ rof))
      ?:  =(u.wen wen.rof)  cor
      ?>((lth u.wen wen.rof) (give (fact ~ rof))) :: no future subs
    --
  ::
  ++  sub
    |^  |=  who=ship
        ^+  impl
        ?<  =(our.bowl who)
        ~(. impl who (~(gut by rol) who [~ ~]) %live)
    ::
    ++  many
      |=  [l=(list ship) f=$-(_impl _impl)]
      ^+  cor
      %+  roll  l
      |=  [who=@p acc=_cor]
      ?:  =(our.bowl who)  acc
      abet:(f (sub:acc who))
    ::
    ++  impl
      |_  [who=ship for=(pair profile ?(~ saga)) sas=?(%dead %live)]
      ::
      ++  s-cor  .
      ::
      ++  abet
        %_  cor
          rol  ?-  sas
                 %live  (~(put by rol) who for)
                 %dead  (~(del by rol) who)
        ==     ==
      ::
      ++  take
        |=  =sign:agent:gall
        ^+  s-cor
        ?-  -.sign
          %poke-ack   ~|(strange-poke-ack+wire !!)
        ::
          %watch-ack  s-cor(q.for ?~(p.sign %chi %fal)) :: XX handle with epic sub? check state?
        ::
          %kick       heed
        ::
          %fact       ?+    p.cage.sign  (odd p.cage.sign)
                          ::  incompatible changes get a mark version bump
                          ::
                          ::    XX details
                          ::
                          ?(upd:base:mar %contact-update-0)
                        (hear !<(update q.cage.sign))
        ==            ==

      ++  hear
        |=  u=update
        ^+  s-cor
        ?:  &(?=(^ p.for) (lte wen.u wen.p.for))
          s-cor
        s-cor(p.for u, cor (news:pub who con.u))
      ::
      ++  meet  s-cor  :: init key in +abet
      ::
      ++  heed
        ^+  s-cor
        ?.  ?=(~ q.for)
          s-cor  :: XX other states
        =/  pat  ?~(p.for / /at/(scot %da wen.p.for))
        %=  s-cor
          cor    (pass /contact %agent [who dap.bowl] %watch [%contact pat])
          q.for  %try
        ==
      ::
      ++  drop  snub(sas %dead)  :: XX confirm
      ::
      ++  snub
        %_  s-cor
          q.for  ~
          cor    ?+    q.for   cor
                     ?(%lev [%dex *])
                   (pass /epic %agent [who dap.bowl] %leave ~)
                 ::
                     %chi  :: XX %try? %fal?
                   (pass /contact %agent [who dap.bowl] %leave ~)
        ==       ==
      ::
      ++  odd
        |=  =mark
        ^+  s-cor
        =*  upd  *upd:base:mar
        =*  wid  ^~((met 3 upd))
        ?.  =(upd (end [3 wid] mark))
          ~|(fake-news+mark !!)
        ~|  bad-update-mark+mark
        =/  cool  (slav %ud (rsh 3^+(wid) mark))
        ?<  =(okay cool)
        peer:epic:snub(q.for ?:((lth cool okay) %lev [%dex cool]))  :: XX recheck
      ::
      ++  epic
        |%
        ++  take
          |=  =sign:agent:gall
          ^+  s-cor
          ?-  -.sign
            %poke-ack   ~|(strange-poke-ack+wire !!)
            %watch-ack  s-cor :: XX handle nack w/ failure state?
            %kick       peer
            %fact       ?+  p.cage.sign  ~|(not-epic+p.cage.sign !!) :: XX drop? set sub state?
                          %epic  (hear !<(^epic q.cage.sign))
          ==            ==
        ::
        ++  hear
          |=  =^epic
          ^+  s-cor
          ?+  q.for  ~|(%strange-epic !!)
            [%dex *]  ~!  q.for  ?>((gth epic okay) s-cor(ver.q.for epic))
          ::
            %lev      ?:  =(okay epic)
                        heed:snub :: XX switch to %chi, unsub from /epic
                      ?>((lth epic okay) s-cor)
          ==
        ::
        ++  peer  s-cor(cor (pass /epic %agent [who dap.bowl] %watch /epic))
        --
      --
    --
  ::  +migrate: from :contact-store
  ::
  ::    all known ships, non-default profiles,
  ::    no subscriptions
  ::
  ++  migrate
    =>  |%
        ++  legacy
          |%
          +$  rolodex  (map ship contact)
          +$  contact
            $:  nickname=@t
                bio=@t
                status=@t
                color=@ux
                avatar=(unit @t)
                cover=(unit @t)
                groups=(set resource)
                last-updated=@da
            ==
          --
        --
    ::
    ^+  cor
    ?.  .^(? gu+/=contact-store=)
      cor
    =/  ful  .^(rolodex:legacy gx+/=contact-store=/all/noun)
    ::
    |^  cor(rof us, rol them)
    ++  us
      ^-  profile
      ?~  old=(~(get by ful) our.bowl)  ~
      (convert u.old)
    ::
    ++  them
      ^-  rolodex
      %-  ~(rep by ful)
      |=  [[who=ship con=contact:legacy] rol=rolodex]
      (~(put by rol) who (convert con) ~)
    ::
    ++  convert
      |=  con=contact:legacy
      ^-  profile
      ?:  =(*contact:legacy con)  ~
      [last-updated.con con(|6 groups.con)]
    --
  ::
  +|  %implementation
  ::
  ++  init  migrate
  ::
  ++  load
    |=  old-vase=vase
    ^+  cor
    |^  =+  !<([old=versioned-state cool=^epic] old-vase)
        =.  state
          ?-  -.old
            %0  old
          ==
        ?>  (gte okay cool)  :: XX confirm
        ?:  =(okay cool)  cor
        bump(cor epic)
    ::
    +$  versioned-state
      $%  state-0
      ==
    ::
    ++  epic  (give %fact [/epic ~] epic+!>(okay))
    ::
    ++  bump
      ^+  cor
      %-  ~(rep by rol)
      |=  [[who=ship for=(pair profile ?(~ saga))] =_cor]
      ?.  ?&  ?=([%dex *] q.for)
              =(okay ver.q.for)
          ==
        cor
      abet:heed:snub:(sub:cor who)
    --
  ::
  ++  poke
    |=  [=mark =vase]
    ^+  cor
    ?+    mark  ~|(bad-mark+mark !!)
        ::  incompatible changes get a mark version bump
        ::
        ::    the agent should maintain compatibility by either
        ::    directly handling or upconverting old-marked pokes
        ::
        ?(act:base:mar %contact-action-0)
      ?>  =(our src):bowl
      =/  act  !<(action vase)
      ?-  -.act
        %anon  ?.  ?=([@ ^] rof)
                 cor
               (diff:pub ~)
      ::
        %edit   ?~  new=(do-edits ?.(?=([@ ^] rof) *contact con.rof) p.act)
                 cor
               (diff:pub u.new)
      ::
        %meet  (many:sub p.act |=(s=_impl:sub meet:s))
        %heed  (many:sub p.act |=(s=_impl:sub heed:s))
        %drop  (many:sub p.act |=(s=_impl:sub drop:s))
        %snub  (many:sub p.act |=(s=_impl:sub snub:s))
      ==
    ==
  ::
  ++  peek
    |=  pat=(pole knot)
    ^-  (unit (unit cage))
    ?+    pat  [~ ~]
        [%x %all ~]
      =/  lor=rolodex
        ?:  |(?=(~ rof) ?=(~ con.rof))  rol
        (~(put by rol) our.bowl rof ~)
      ``contact-rolodex+!>(lor)
    ::
        [%x %contact her=@ ~]
      ?~  who=`(unit @p)`(slaw %p her.pat)
        [~ ~]
      =/  tac=?(~ contact)
        ?:  =(our.bowl u.who)  ?~(rof ~ con.rof)
        =/  for  (~(get by rol) u.who)
        ?:  |(?=(~ for) ?=(~ p.u.for))  ~
        con.p.u.for
      ?~  tac  [~ ~]
      ``contact+!>(`contact`tac)
    ==
  ::
  ++  peer
    |=  pat=(pole knot)
    ^+  cor
    ?+  pat  ~|(bad-watch-path+pat !!)
      [%contacts %at wen=@ ~]  (init:pub `(slav %da wen.pat))
      [%contacts ~]  (init:pub ~)
      [%epic ~]  (give %fact ~ epic+!>(okay))
      [%news ~]  ~|(local-news+src.bowl ?>(=(our src):bowl cor))
    ==
  ::
  ++  agent
    |=  [=wire =sign:agent:gall]
    ^+  cor
    ?+  wire  ~|(evil-agent+wire !!)
      [%contact ~]  abet:(take:(sub src.bowl) sign)
      [%epic ~]     abet:(take:epic:(sub src.bowl) sign)
    ==
  --
--

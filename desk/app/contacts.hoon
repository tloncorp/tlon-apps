/-  *contacts
/+  default-agent, dbug, verb
::
|%
::  [compat] protocol-versioning scheme
::
::    adopted from :groups, slightly modified.
::
::    for our action/update marks, we
::      - *must* support our version (+okay)
::      - *should* support previous versions (especially actions)
::      - but *can't* support future versions
::
::    in the case of updates at unsupported protocol versions,
::    we backoff and subscribe for version changes (/epic).
::    (this alone is unlikely to help with future versions,
::    but perhaps our peer will downgrade. in the meantime,
::    we wait to be upgraded.)
::
+|  %compat
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
::  conventions
::
::    .con: a contact
::    .rof: our profile
::    .rol: our full rolodex
::    .for: foreign profile
::    .sag: foreign subscription state
::
+|  %types
+$  card     card:agent:gall
+$  state-0  [%0 rof=$@(~ profile) rol=rolodex]
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
    %add-group  c(groups (~(put in groups.c) flag.f))
  ::
    %del-group  c(groups (~(del in groups.c) flag.f))
  ==
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
  ::  |pub: publication mgmt
  ::
  ::    - /news: local updates to our profile and rolodex
  ::    - /contact: updates to our profile
  ::
  ::    as these publications are trivial, |pub does *not*
  ::    make use of the +abet pattern. the only behavior of note
  ::    is wrt the /contact/at/$date path, which exists to minimize
  ::    redundant network traffic.
  ::
  ::    /epic protocol versions are even more trivial,
  ::    published ad-hoc, elsewhere.
  ::
  ++  pub
    =>  |%
        ::  if this proves to be too slow, the set of paths
        ::  should be maintained statefully: put on +p-init:pub,
        ::  filtered at some interval (on +load?) to avoid a space leak.
        ::
        ++  subs
          ^-  (set path)
          %-  ~(rep by sup.bowl)
          |=  [[duct ship pat=path] acc=(set path)]
          ?.(?=([%contact *] pat) acc (~(put in acc) pat))
        ::
        ++  fact
          |=  [pat=(set path) u=update]
          ^-  gift:agent:gall
          [%fact ~(tap in pat) %contact-update-0 !>(u)]
        --
    ::
    |%
    ++  p-anon  ?.(?=([@ ^] rof) cor (p-diff ~))
    ::
    ++  p-edit
      |=  l=(list field)
      =/  old  ?.(?=([@ ^] rof) *contact con.rof)
      =/  new  (roll l |=([f=field c=_old] (do-edit c f)))
      ?:  =(old new)
        cor
      (p-diff:pub new)
    ::
    ++  p-diff
      |=  con=$@(~ contact)
      =/  p=profile  [?~(rof now.bowl (mono wen.rof now.bowl)) con]
      (give:(p-news(rof p) our.bowl con) (fact subs full+p))
    ::
    ++  p-init
      |=  wen=(unit @da)
      ?~  rof  cor
      ?~  wen  (give (fact ~ full+rof))
      ?:  =(u.wen wen.rof)  cor
      ?>((lth u.wen wen.rof) (give (fact ~ full+rof))) :: no future subs
    ::
    ++  p-news  |=(n=news (give %fact [/news ~] %contact-news !>(n)))
    --
  ::
  ::  +sub: subscription mgmt
  ::
  ::    /epic: foreign protocol versions, |si-epic:s-impl
  ::    /contact/*: foreign profiles, |s-impl
  ::
  ::    subscription state is tracked per peer in .sag
  ::
  ::    ~:     no subscription
  ::    %want: /contact/* being attempted
  ::    %fail: /contact/* failed, /epic being attempted
  ::    %lost: /epic failed
  ::    %chi:  /contact/* established
  ::    %lev:  we're (incompatibly) ahead of the publisher
  ::    %dex:  we're behind the publisher
  ::
  ::    for a given peer, we always have at most one subscription,
  ::    to either /contact/* or /epic.
  ::
  ++  sub
    |^  |=  who=ship
        ^+  s-impl
        ?<  =(our.bowl who)
        =/  old  (~(get by rol) who)
        ~(. s-impl who %live ?=(~ old) (fall old [~ ~]))
    ::
    ++  s-many
      |=  [l=(list ship) f=$-(_s-impl _s-impl)]
      ^+  cor
      %+  roll  l
      |=  [who=@p acc=_cor]
      ?:  =(our.bowl who)  acc
      si-abet:(f (sub:acc who))
    ::
    ++  s-impl
      |_  [who=ship sas=?(%dead %live) new=? foreign]
      ::
      ++  si-cor  .
      ::
      ++  si-abet
        ^+  cor
        ?-  sas
          %live  =.  rol  (~(put by rol) who for sag)
                 ::  NB: this assumes con.for is only set in +si-hear
                 ::
                 ?.(new cor (p-news:pub who ~))
        ::
          %dead  ?:  new  cor
                 =.  rol  (~(del by rol) who)
                 ::
                 ::  this is not quite right, reflecting *total* deletion
                 ::  as *contact* deletion. but it's close, and keeps /news simpler
                 ::
                 (p-news:pub who ~)
        ==
      ::
      ++  si-take
        |=  =sign:agent:gall
        ^+  si-cor
        ?-  -.sign
          %poke-ack   ~|(strange-poke-ack+wire !!)
        ::
          %watch-ack  ~|  strange-watch-ack+wire
                      ?>  ?=(%want sag)
                      ?~  p.sign  si-cor(sag [%chi ~])
                      %-  (slog 'contact-fail' u.p.sign)
                      pe-peer:si-epic(sag %fail)
        ::
          %kick       si-heed
        ::
        ::  [compat] we *should* maintain backcompat here
        ::
        ::    by either directly handling or upconverting
        ::    old actions. but if we don't, we'll fall back
        ::    to /epic and wait for our peer to upgrade.
        ::
        ::    %fact's from the future are also /epic,
        ::    in case our peer downgrades. if not, we'll
        ::    handle it on +load.
        ::
          %fact       ?+    p.cage.sign  (si-odd p.cage.sign)
                          ?(upd:base:mar %contact-update-0)
                        (si-hear !<(update q.cage.sign))
        ==            ==

      ++  si-hear
        |=  u=update
        ^+  si-cor
        ?:  &(?=(^ for) (lte wen.u wen.for))
          si-cor
        si-cor(for +.u, cor (p-news:pub who con.u))
      ::
      ++  si-meet  si-cor  :: init key in +si-abet
      ::
      ++  si-heed
        ^+  si-cor
        ?.  ?=(~ sag)
          si-cor
        =/  pat  [%contact ?~(for / /at/(scot %da wen.for))]
        %=  si-cor
          cor  (pass /contact %agent [who dap.bowl] %watch pat)
          sag  %want
        ==
      ::
      ++  si-drop  si-snub(sas %dead)
      ::
      ++  si-snub
        %_  si-cor
          sag  ~
          cor  ?+    sag   cor
                   ?(%fail [?(%lev %dex) *])
                 (pass /epic %agent [who dap.bowl] %leave ~)
               ::
                   ?(%want [%chi *])
                 (pass /contact %agent [who dap.bowl] %leave ~)
        ==     ==
      ::
      ++  si-odd
        |=  =mark
        ^+  si-cor
        =*  upd  *upd:base:mar
        =*  wid  ^~((met 3 upd))
        ?.  =(upd (end [3 wid] mark))
          ~&(fake-news+mark si-cor)   ::  XX unsub?
        ?~  ver=(slaw %ud (rsh 3^+(wid) mark))
          ~&(weird-news+mark si-cor)  ::  XX unsub?
        ?:  =(okay u.ver)
          ~|(odd-not-odd+mark !!)     ::  oops!
        =.  si-cor  si-snub  :: unsub before .sag update
        =.  sag  ?:((lth u.ver okay) [%lev ~] [%dex u.ver])
        pe-peer:si-epic
      ::
      ++  si-epic
        |%
        ++  pe-take
          |=  =sign:agent:gall
          ^+  si-cor
          ?-  -.sign
            %poke-ack   ~|(strange-poke-ack+wire !!)
          ::
            %watch-ack  ?~  p.sign  si-cor
                        %-  (slog 'epic-fail' u.p.sign)
                        si-cor(sag %lost)
          ::
            %kick       ?.  ?=(?(%fail [?(%dex %lev) *]) sag)
                          si-cor  :: XX strange
                        pe-peer
          ::
            %fact       ?+  p.cage.sign
                                 ~&(fact-not-epic+p.cage.sign si-cor)
                          %epic  (pe-hear !<(epic q.cage.sign))
          ==            ==
        ::
        ++  pe-hear
          |=  =epic
          ^+  si-cor
          ?.  ?=(?(%fail [?(%dex %lev) *]) sag)
            ~|(strange-epic+[okay epic] !!)  :: get %kick'd
          ?:  =(okay epic)
            ?:  ?=(%fail sag)
              si-cor(sag %lost)  :: abandon hope
            si-heed:si-snub
          ::
          ::  handled generically to support peer downgrade
          ::
          si-cor(sag ?:((gth epic okay) [%dex epic] [%lev ~]))
        ::
        ++  pe-peer
          si-cor(cor (pass /epic %agent [who dap.bowl] %watch /epic))
        --
      --
    --
  ::  +migrate: from :contact-store
  ::
  ::    all known ships, non-default profiles, no subscriptions
  ::
  ++  migrate
    =>  |%
        ++  legacy
          |%
          +$  rolodex   (map ship contact)
          +$  resource  [=entity name=term]
          +$  entity    ship
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
    =/  bas  /(scot %p our.bowl)/contact-store/(scot %da now.bowl)
    ?.  .^(? gu+bas)  cor
    =/  ful  .^(rolodex:legacy gx+(weld bas /all/noun))
    ::
    |^  cor(rof us, rol them)
    ++  us  (biff (~(get by ful) our.bowl) convert)
    ::
    ++  them
      ^-  rolodex
      %-  ~(rep by (~(del by ful) our.bowl))
      |=  [[who=ship con=contact:legacy] rol=rolodex]
      (~(put by rol) who (convert con) ~)
    ::
    ++  convert
      |=  con=contact:legacy
      ^-  $@(~ profile)
      ?:  =(*contact:legacy con)  ~
      [last-updated.con con(|6 groups.con)]
    --
  ::
  +|  %implementation
  ::
  ++  init
    (emit %pass /migrate %agent [our dap]:bowl %poke noun+!>(%migrate))
  ::
  ++  load
    |=  old-vase=vase
    ^+  cor
    |^  =+  !<([old=versioned-state cool=epic] old-vase)
        =.  state
          ?-  -.old
            %0  old
          ==
        ::  [compat] if our protocol version changed
        ::
        ::    we first tell the world, then see if we can now understand
        ::    any of our friends who were sending messages from the future.
        ::
        ?:(=(okay cool) cor l-bump(cor l-epic))
    ::
    +$  versioned-state
      $%  state-0
      ==
    ::
    ++  l-epic  (give %fact [/epic ~] epic+!>(okay))
    ::
    ++  l-bump
      ^+  cor
      %-  ~(rep by rol)
      |=  [[who=ship foreign] =_cor]
      ::  XX to fully support downgrade, we'd need to also
      ::  save an epic in %lev
      ::
      ?.  ?&  ?=([%dex *] sag)
              =(okay ver.sag)
          ==
        cor
      si-abet:si-heed:si-snub:(sub:cor who)
    --
  ::
  ++  poke
    |=  [=mark =vase]
    ^+  cor
    ::  [compat] we *should* maintain backcompat here
    ::
    ::    by either directly handling or upconverting old actions
    ::
    ?+    mark  ~|(bad-mark+mark !!)
        %noun
      ?+  q.vase  !!
        %migrate  migrate
      ==
      ::
        ?(act:base:mar %contact-action-0)
      ?>  =(our src):bowl
      =/  act  !<(action vase)
      ?-  -.act
        %anon  p-anon:pub
        %edit  (p-edit:pub p.act)
        %meet  (s-many:sub p.act |=(s=_s-impl:sub si-meet:s))
        %heed  (s-many:sub p.act |=(s=_s-impl:sub si-heed:s))
        %drop  (s-many:sub p.act |=(s=_s-impl:sub si-drop:s))
        %snub  (s-many:sub p.act |=(s=_s-impl:sub si-snub:s))
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
        =+  (~(get by rol) u.who)
        ?:  |(?=(~ -) ?=(~ for.u.-))  ~
        con.for.u.-
      ?~  tac  [~ ~]
      ``contact+!>(`contact`tac)
    ==
  ::
  ++  peer
    |=  pat=(pole knot)
    ^+  cor
    ?+  pat  ~|(bad-watch-path+pat !!)
      [%contact %at wen=@ ~]  (p-init:pub `(slav %da wen.pat))
      [%contact ~]  (p-init:pub ~)
      [%epic ~]  (give %fact ~ epic+!>(okay))
      [%news ~]  ~|(local-news+src.bowl ?>(=(our src):bowl cor))
    ==
  ::
  ++  agent
    |=  [=wire =sign:agent:gall]
    ^+  cor
    ?+  wire  ~|(evil-agent+wire !!)
      [%contact ~]  si-abet:(si-take:(sub src.bowl) sign)
      [%epic ~]     si-abet:(pe-take:si-epic:(sub src.bowl) sign)
      ::
        [%migrate ~]
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  cor
      %-  (slog leaf/"{<wire>} failed" u.p.sign)
      cor
    ==
  --
--

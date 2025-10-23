/-  activity
/+  default-agent, dbug, verb, neg=negotiate
/+  *contacts
::
::  performance, keep warm
/+  j0=contacts-json-0, j1=contacts-json-1, mark-warmer
::
|%
::  conventions
::
::    .con: a contact
::    .rof: our profile
::    .rol: [legacy] our full rolodex
::    .far: foreign peer
::    .for: foreign profile
::    .sag: foreign subscription state
::
+|  %types
+$  card  card:agent:gall
+$  state-3
  $:  %3
      rof=profile
      =book
      =peers
      retry=(map ship @da)  ::  retry sub at time
  ==
--
%-  %^  agent:neg
        notify=|
      [~.contacts^%1 ~ ~]
    [~.contacts^[~.contacts^%1 ~ ~] ~ ~]
%-  agent:dbug
%^  verb  |  %warn
^-  agent:gall
=|  state-3
=*  state  -
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
    ++  on-arvo
      |=  [=wire sign=sign-arvo]
      =^  cards  state  abet:(arvo:cor wire sign)
      [cards this]
    ::
    ++  on-fail   on-fail:def
    --

|%
::
+|  %state
::
::  namespaced to avoid accidental direct reference
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
  ++  emil  |=(c=(list card) cor(out (weld (flop c) out)))
  ++  give  |=(=gift:agent:gall (emit %give gift))
  ++  pass  |=([=wire =note:agent:gall] (emit %pass wire note))
  ::
  +|  %operations
  ::
  ++  pass-activity
    |=  [who=ship field=(pair @tas value)]
    ^-  card
    =/  =cage  activity-action+!>(`action:activity`[%add %contact who field])
    [%pass /activity %agent [our.bowl %activity] %poke cage]
  ::
  ::  +pub: publication management
  ::
  ::    - /v1/news: local updates to our profile and rolodex
  ::    - /v1/contact: updates to our profile
  ::
  ::    as these publications are trivial, |pub does *not*
  ::    make use of the +abet pattern. the only behavior of note
  ::    is wrt the /contact/at/$date path, which exists to minimize
  ::    redundant network traffic.
  ::
  ::    /epic protocol versions are even more trivial,
  ::    published ad-hoc, elsewhere.
  ::
  ::    Facts are always send in the following order:
  ::    1. [legacy] /news
  ::    2. /v1/news
  ::    3. /v1/contact
  ::
  ++  pub
    =>  |%
        ::  if this proves to be too slow, the set of paths
        ::  should be maintained statefully: put on +p-init:pub,
        ::  filtered at some interval (on +load?) to avoid a space leak.
        ::
        ::  XX number of peers is usually around 5.000.
        ::  this means that the number of subscribers is about the
        ::  same. Thus on each contact update we need to filter
        ::  over 5.000 elements: do some benchmarking.
        ::
        ++  subs
          ^-  (set path)
          %-  ~(rep by sup.bowl)
          ::  default .acc prevents invalid empty fact path in the case
          ::  of no subscribers
          ::
          |=  [[duct ship pat=path] acc=_(sy `path`/v1/contact ~)]
          ?.(?=([%v1 %contact *] pat) acc (~(put in acc) pat))
        ++  fact
          |=  [pat=(set path) u=update]
          ^-  gift:agent:gall
          [%fact ~(tap in pat) %contact-update-1 !>(u)]
        --
    ::
    |%
    ::  +p-anon: delete our profile
    ::
    ++  p-anon  ?.(?=([@ ^] rof) cor (p-commit-self ~))
    ::  +p-self: edit our profile
    ::
    ++  p-self
      |=  con=(map @tas value)
      =/  old=contact
        ?.(?=([@ ^] rof) *contact con.rof)
      =/  new=contact
        (do-edit old con)
      ?:  =(old new)
        cor
      ?>  (sane-contact `our.bowl new)
      (p-commit-self new)
    ::  +p-page-spot: add ship as a contact
    ::
    ++  p-page-spot
      |=  [who=ship mod=contact]
      ?:  (~(has by book) who)
        ~|  "peer {<who>} is already a contact"  !!
      =/  con=contact
        ~|  "peer {<who>} not found"
        =/  far=foreign
          (~(got by peers) who)
        ?~  for.far  *contact
        con.for.far
      ?>  (sane-contact ~ mod)
      (p-commit-page who con mod)
    ::  +p-page: create new contact page
    ::
    ++  p-page
      |=  [=kip mod=contact]
      ?@  kip
        (p-page-spot kip mod)
      ?:  (~(has by book) kip)
        ~|  "contact page {<cid>} already exists"  !!
      ?>  (sane-contact ~ mod)
      (p-commit-page kip ~ mod)
    ::  +p-edit: edit contact page overlay
    ::
    ++  p-edit
      |=  [=kip mod=contact]
      =/  =page
        ~|  "contact page {<kip>} does not exist"
        (~(got by book) kip)
      =/  old=contact
        mod.page
      =/  new=contact
        (do-edit old mod)
      ?:  =(old new)
        cor
      ?>  (sane-contact ?@(kip `kip ~) new)
      (p-commit-edit kip con.page new)
    ::  +p-wipe: delete a contact page
    ::
    ++  p-wipe
      |=  wip=(list kip)
      %+  roll  wip
      |=  [=kip acc=_cor]
      (p-commit-wipe kip)
    ::  +p-commit-self: publish modified profile
    ::
    ++  p-commit-self
      |=  con=contact
      =/  p=profile  [(mono wen.rof now.bowl) con]
      =.  rof  p
      =.  cor
        (p-news-0 our.bowl (contact:to-0 con))
      =.  cor
        (p-response [%self con])
      (give (fact subs [%full p]))
    ::  +p-commit-page: publish new contact page
    ::
    ++  p-commit-page
      |=  [=kip =page]
      =.  book  (~(put by book) kip page)
      (p-response [%page kip page])
    ::  +p-commit-edit: publish contact page update
    ::
    ++  p-commit-edit
      |=  [=kip =page]
      =.  book
        (~(put by book) kip page)
      (p-response [%page kip page])
    ::  +p-commit-wipe: publish contact page wipe
    ::
    ++  p-commit-wipe
      |=  =kip
      =.  book
        (~(del by book) kip)
      (p-response [%wipe kip])
    ::  +p-init: publish our profile
    ::
    ++  p-init
      |=  wen=(unit @da)
      ?~  wen  (give (fact ~ full+rof))
      ?:  =(u.wen wen.rof)  cor
      ::
      ::  no future subs
      ?>((lth u.wen wen.rof) (give (fact ~ full+rof)))
    ::  +p-news-0: [legacy] publish news
    ::
    ++  p-news-0
      |=  n=news-0:c0
      (give %fact ~[/news] %contact-news !>(n))
    ::  +p-response: publish response
    ::
    ++  p-response
      |=  r=response
      (give %fact ~[/v1/news] %contact-response-0 !>(r))
    --
  ::
  ::  +sub: subscription mgmt
  ::
  ::    /contact/*: foreign profiles, _s-impl
  ::
  ::    subscription state is tracked per peer in .sag
  ::
  ::    ~:     no subscription
  ::    %want: /contact/* requested
  ::
  ::    for a given peer, we always have at most one subscription,
  ::    to /contact/*
  ::
  ++  sub
    |^  |=  who=ship
        ^+  s-impl
        ?<  =(our.bowl who)
        =/  old  (~(get by peers) who)
        ~(. s-impl who %live ?=(~ old) (fall old *foreign))
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
          %live  =.  peers  (~(put by peers) who [for sag])
                 ?.  new  cor
                 ::  NB: this assumes con.for is only set in +si-hear
                 ::
                 =.  cor  (p-news-0:pub who ~)
                 (p-response:pub [%peer who ~])
          ::
          %dead  ?:  new  cor
                 =.  peers  (~(del by peers) who)
                 ::
                 ::  this is not quite right, reflecting *total* deletion
                 ::  as *contact* deletion. but it's close, and keeps /news simpler
                 ::
                 =.  cor  (p-news-0:pub who ~)
                 (p-response:pub [%peer who ~])
        ==
      ::
      ++  si-take
        |=  [=wire =sign:agent:gall]
        ^+  si-cor
        ?-  -.sign
          %poke-ack   ~|(strange-poke-ack+wire !!)
        ::
          %watch-ack  ~|  strange-watch-ack+wire
                      ?>  ?=(%want sag)
                      ?~  p.sign  si-cor
                      %-  (slog 'contact-fail' u.p.sign)
                      =/  wake=@da  (add now.bowl ~m30)
                      =.  retry  (~(put by retry) who wake)
                      %_  si-cor  cor
                        (pass /retry/(scot %p who) %arvo %b %wait wake)
                      ==
        ::
          %kick       si-meet(sag ~)
        ::
          %fact       ?+    p.cage.sign  ~|(strange-fact+wire !!)
                          %contact-update-1
                        (si-hear !<(update q.cage.sign))
        ==            ==
      ::
      ++  si-hear
        |=  u=update
        ^+  si-cor
        ?.  (sane-contact `src.bowl con.u)
          si-cor
        ?:  &(?=(^ for) (lte wen.u wen.for))
          si-cor
        %_  si-cor
          for  +.u
          cor  =.  cor
               (p-news-0:pub who (contact:to-0 con.u))
               =/  page=(unit page)  (~(get by book) who)
               ::  update contact book and send notification
               ::
               =?  cor  ?=(^ page)
                 ?:  =(con.u.page con.u)  cor
                 =.  book  (~(put by book) who u.page(con con.u))
                 =?  cor  ?=(^ for)  (emil (send-activity u con.u.page))
                 (p-response:pub %page who con.u mod.u.page)
               (p-response:pub %peer who con.u)
        ==
      ::
      ++  send-activity
        |=  [u=update con=contact]
        ^-  (list card)
        ?.  .^(? %gu /(scot %p our.bowl)/activity/(scot %da now.bowl)/$)
          ~
        %-  ~(rep by con.u)
        |=  [field=(pair @tas value) cards=(list card)]
        ?>  ?=(^ q.field)
        ::  do not broadcast empty changes
        ::
        ?:  (is-value-empty q.field)
          cards
        ::
        =/  val=(unit value)  (~(get by con) p.field)
        ?~  val
          [(pass-activity who field) cards]
        ?<  ?=(~ u.val)
        ::NOTE  currently shouldn't happen in practice
        ?.  =(-.q.field -.u.val)  cards
        ?:  =(p.q.field p.u.val)  cards
        ?.  ?=(%set -.q.field)
          [(pass-activity who field) cards]
        =/  diff=(set value)
          (~(dif in p.q.field) ?>(?=(%set -.u.val) p.u.val))
        ?~  diff  cards
        [(pass-activity who p.field set+diff) cards]
      ::
      ++  si-meet
        ^+  si-cor
        ::
        ::  already subscribed
        ?:  ?=(%want sag)
          si-cor
        =/  pat  [%v1 %contact ?~(for / /at/(scot %da wen.for))]
        %_  si-cor
          cor  (pass /contact %agent [who dap.bowl] %watch pat)
          sag  %want
        ==
      ::
      ++  si-retry
        ^+  si-cor
        ::
        ::XX  this works around a gall/behn bug:
        ::    the timer is identified by the duct.
        ::    it needn't be the same when gall passes our
        ::    card to behn.
        ::
        ?.  (~(has by retry) who)
          si-cor
        =.  retry  (~(del by retry) who)
        si-meet(sag ~)
      ::
      ++  si-drop  si-snub(sas %dead)
      ::
      ++  si-snub
        %_  si-cor
          sag  ~
          cor   ?.  ?=(%want sag)  cor
                ::  retry is scheduled, cancel the timer
                ::
                ?^  when=(~(get by retry) who)
                  =.  retry  (~(del by retry) who)
                  (pass /retry/(scot %p who)/cancel %arvo %b %rest u.when)
               (pass /contact %agent [who dap.bowl] %leave ~)
        ==
      --
    --
  ::
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
    ?.  .^(? gu+(weld bas /$))  cor
    =/  ful  .^(rolodex:legacy gx+(weld bas /all/noun))
    ::
    |^
    cor(rof us, peers them)
    ++  us
      %+  fall
        (bind (~(get by ful) our.bowl) convert)
      *profile
    ::
    ++  them
      ^-  ^peers
      %-  ~(rep by (~(del by ful) our.bowl))
      |=  [[who=ship con=contact:legacy] =^peers]
      (~(put by peers) who (convert con) ~)
    ::
    ++  convert
      |=  con=contact:legacy
      ^-  profile
      %-  profile:from-0
      [last-updated.con con(|6 groups.con)]
    --
  ::
  +|  %implementation
  ::
  ++  init
    =.  wen.rof  now.bowl
    (emit %pass /migrate %agent [our dap]:bowl %poke noun+!>(%migrate))
  ::
  ++  load
    |=  old-vase=vase
    ^+  cor
    |^  =+  !<([old=versioned-state cool=epic] old-vase)
        =?  cor  !=(okay cool)  l-epic
        ?-  -.old
        ::
            %3
          =.  state  old
          inflate-io
        ::
            %2
          =.  state  old(- %3)
          ::  sanitize our nickname
          ::
          =+  nick=(~(get cy con.rof) %nickname %text)
          =?  con.rof  &(?=(^ nick) !(sane-nickname `our.bowl u.nick))
            %+  ~(put by con.rof)  %nickname
            text+(sani-nickname u.nick)
          ::  sanitize peer nicknames
          ::
          =.  state
            %+  roll  ~(tap in ~(key by peers))
            |=  [her=ship =_state]
            =+  far=(~(got by peers) her)
            ::  examine peer nickname and sanitize it if needed
            ::
            ?~  for.far  state
            =+  nick=(~(get cy con.for.far) %nickname %text)
            ?~  nick  state
            ?:  (sane-nickname `her u.nick)  state
            =.  u.nick  (sani-nickname u.nick)
            =.  con.for.far
              %+  ~(put by con.for.far)  %nickname
              text+u.nick
            =.  peers.state
              (~(put by peers.state) her far)
            ::  update the entry in the contact book, if any
            ::
            ?~  page=(~(get by book) her)  state
            =.  con.u.page
              %+  ~(put by con.u.page)  %nickname
              text+u.nick
            =.  book.state
              (~(put by book.state) her u.page)
            state
          inflate-io
        ::
            %1
          =.  state  old(- %3)
          ::  fix incorrectly bunted timestamp for
          ::  an empty profile migrated from %0
          ::
          =?  cor  &(=(*@da wen.rof) ?=(~ con.rof))
            (p-commit-self:pub ~)
          inflate-io
        ::
            %0
          =.  rof  ?~(rof.old *profile (profile:from-0 rof.old))
          ::  migrate peers. for each peer
          ::  1. leave /epic, if any
          ::  2. subscribe if desired
          ::  3. put into peers
          ::
          =^  caz=(list card)  peers
            %+  roll  ~(tap by rol.old)
            |=  [[who=ship foreign-0:c0] caz=(list card) =_peers]
            ::  leave /epic if any
            ::
            =?  caz  (~(has by wex.bowl) [/epic who dap.bowl])
              :_  caz
              [%pass /epic %agent [who dap.bowl] %leave ~]
            =/  fir=$@(~ profile)
              ?~  for  ~
              (profile:from-0 for)
            ::  no intent to connect
            ::
            ?:  =(~ sag)
              :-  caz
              (~(put by peers) who fir ~)
            :_  (~(put by peers) who fir %want)
            ?:  (~(has by wex.bowl) [/contact who dap.bowl])
              caz
            =/  =path  [%v1 %contact ?~(fir / /at/(scot %da wen.fir))]
            :_  caz
            [%pass /contact %agent [who dap.bowl] %watch path]
          (emil caz)
        ==
    +$  state-0  [%0 rof=$@(~ profile-0:c0) rol=rolodex:c0]
    +$  state-1
      $:  %1
          rof=profile
          =^book
          =^peers
          retry=(map ship @da)  ::  retry sub at time
      ==
    +$  state-2
      $:  %2
          rof=profile
          =^book
          =^peers
          retry=(map ship @da)  ::  retry sub at time
      ==
    +$  versioned-state
      $%  state-3
          state-2
          state-1
          state-0
      ==
    ::
    ++  l-epic  (give %fact [/epic ~] epic+!>(okay))
    ::
    ++  inflate-io
      ^+  cor
      =/  cards
        %+  roll  ~(tap by peers)
        |=  [[who=ship foreign] caz=(list card)]
        ::  intent to connect, resubscribe
        ::
        ?:  ?&  =(%want sag)
                !(~(has by wex.bowl) [/contact who dap.bowl])
            ==
          =/  =path  [%v1 %contact ?~(for / /at/(scot %da wen.for))]
          :_  caz
          [%pass /contact %agent [who dap.bowl] %watch path]
        caz
      (emil cards)
    --
  ::
  ++  poke
    |=  [=mark =vase]
    ^+  cor
    ?+    mark  ~|(bad-mark+mark !!)
        %noun
      ?+  q.vase  !!
        %migrate  migrate
      ==
        $?  %contact-action
            %contact-action-0
            %contact-action-1
        ==
      ?>  =(our src):bowl
      =/  act=action
        ?-  mark
          ::
            %contact-action-1
          !<(action vase)
          ::  upconvert legacy %contact-action
          ::
            ?(%contact-action %contact-action-0)
          =/  act-0  !<(action-0:c0 vase)
          ?.  ?=(%edit -.act-0)
            (to-action act-0)
          ::  v0 %edit needs special handling to evaluate
          ::  groups edit
          ::
          =/  groups=(set $>(%flag value))
            ?~  con.rof  ~
            =+  set=(~(ges cy con.rof) groups+%flag)
            (fall set ~)
          [%self (to-self-edit p.act-0 groups)]
        ==
      ?-  -.act
        %anon  p-anon:pub
        %self  (p-self:pub p.act)
        ::  if we add a page for someone who is not a peer,
        ::  we meet them first
        ::
        %page  =?  cor  &(?=(ship p.act) !(~(has by peers) p.act))
                 si-abet:si-meet:(sub p.act)
               (p-page:pub p.act q.act)
        %edit  (p-edit:pub p.act q.act)
        %wipe  (p-wipe:pub p.act)
        %meet  (s-many:sub p.act |=(s=_s-impl:sub si-meet:s))
        %drop  (s-many:sub p.act |=(s=_s-impl:sub si-drop:s))
        %snub  (s-many:sub p.act |=(s=_s-impl:sub si-snub:s))
      ==
    ==
  ::  +peek: scry
  ::
  ::  v0 scries
  ::
  ::  /x/all -> $rolodex:c0
  ::  /x/contact/her=@ -> $@(~ contact-0:c0)
  ::
  ::  v1 scries
  ::
  ::  /x/v1/self -> $contact
  ::  /x/v1/book -> $book
  ::  /x/v1/book/her=@p -> $page
  ::  /x/v1/book/id/cid=@uv -> $page
  ::  /x/v1/all -> $directory
  ::  /x/v1/contact/her=@p -> $contact
  ::  /x/v1/peer/her=@p -> $contact
  ::
  ++  peek
    |=  pat=(pole knot)
    ^-  (unit (unit cage))
    ?+    pat  [~ ~]
      ::
        [%x %all ~]
      =/  rol-0=rolodex:c0
        %-  ~(urn by peers)
        |=  [who=ship far=foreign]
        ^-  foreign-0:c0
        =/  mod=contact
          ?~  page=(~(get by book) who)
            ~
          mod.u.page
        (foreign:to-0 (foreign-mod far mod))
      =/  lor-0=rolodex:c0
        ?:  ?=(~ con.rof)  rol-0
        (~(put by rol-0) our.bowl (profile:to-0 rof) ~)
      ``contact-rolodex+!>(lor-0)
      ::
        [%x %contact her=@ ~]
      ?~  who=(slaw %p her.pat)
        [~ ~]
      =/  tac=?(~ contact-0:c0)
        ?:  =(our.bowl u.who)
          ?~(con.rof ~ (contact:to-0 con.rof))
        =+  far=(~(get by peers) u.who)
        ?:  |(?=(~ far) ?=(~ for.u.far))  ~
        (contact:to-0 con.for.u.far)
      ?~  tac  [~ ~]
      ``contact+!>(`contact-0:c0`tac)
      ::
        [%x %v1 %self ~]
      ``contact-1+!>(`contact`con.rof)
      ::
        [%x %v1 %book ~]
      ``contact-book-0+!>(book)
      ::
        [%u %v1 %book her=@p ~]
      ?~  who=(slaw %p her.pat)
        [~ ~]
      ``loob+!>((~(has by book) u.who))
      ::
        [%x %v1 %book her=@p ~]
      ?~  who=(slaw %p her.pat)
        [~ ~]
      =/  page=(unit page)
        (~(get by book) u.who)
      ``contact-page-0+!>(`^page`(fall page *^page))
      ::
        [%u %v1 %book %id =cid ~]
      ?~  id=(slaw %uv cid.pat)
        [~ ~]
      ``loob+!>((~(has by book) id+u.id))
      ::
        [%x %v1 %book %id =cid ~]
      ?~  id=(slaw %uv cid.pat)
        [~ ~]
      =/  page=(unit page)
        (~(get by book) id+u.id)
      ``contact-page-0+!>(`^page`(fall page *^page))
      ::
        [%x %v1 %all ~]
      =|  dir=directory
      ::  export all ship contacts
      ::
      =.  dir
        %-  ~(rep by book)
        |=  [[=kip =page] =_dir]
        ?^  kip
          dir
        (~(put by dir) kip (contact-uni page))
      ::  export all peers
      ::
      =.  dir
        %-  ~(rep by peers)
        |=  [[who=ship far=foreign] =_dir]
        ?~  for.far  dir
        ?:  (~(has by dir) who)  dir
        (~(put by dir) who con.for.far)
      ``contact-directory-0+!>(dir)
      ::
        [%x %v1 %changes since=@ ~]
      =+  since=(slav %da since.pat)
      :^  ~  ~
        %contact-changed-contacts
      !>  ^-  (map ship profile)
      %-  ~(rep by peers)
      |=  [[who=ship foreign] out=(map ship profile)]
      ?~  for                  out
      ?:  (lte wen.for since)  out
      (~(put by out) who for)
      ::
        [%u %v1 %contact her=@p ~]
      ?~  who=(slaw %p her.pat)
        [~ ~]
      ?:  (~(has by book) u.who)
        ``loob+!>(&)
      =-  ``loob+!>(-)
      ?~  far=(~(get by peers) u.who)
        |
      ?~  for.u.far
        |
      &
      ::
        [%x %v1 %contact her=@p ~]
      ?~  who=(slaw %p her.pat)
        [~ ~]
      ?^  page=(~(get by book) u.who)
        ``contact-1+!>((contact-uni u.page))
      ?~  far=(~(get by peers) u.who)
        [~ ~]
      ?~  for.u.far
        [~ ~]
      ``contact-1+!>(con.for.u.far)
      ::
        [%u %v1 %peer her=@p ~]
      ?~  who=(slaw %p her.pat)
        [~ ~]
      ``loob+!>((~(has by peers) u.who))
      ::
        [%x %v1 %peer her=@p ~]
      ?~  who=(slaw %p her.pat)
        [~ ~]
      ?~  far=(~(get by peers) u.who)
        [~ ~]
      ``contact-foreign-0+!>(`foreign`u.far)
    ==
  ::
  ++  peer
    |=  pat=(pole knot)
    ^+  cor
    ?+  pat  ~|(bad-watch-path+pat !!)
      ::
      ::  v0
      [%news ~]  ~|(local-news+src.bowl ?>(=(our src):bowl cor))
      ::
      ::  v1
      [%v1 %contact ~]  (p-init:pub ~)
      [%v1 %contact %at wen=@ ~]  (p-init:pub `(slav %da wen.pat))
      [%v1 %news ~]  ~|(local-news+src.bowl ?>(=(our src):bowl cor))
      ::
      [%epic ~]  (give %fact ~ epic+!>(okay))
    ==
  ::
  ++  agent
    |=  [=wire =sign:agent:gall]
    ^+  cor
    ?+    wire  ~|(evil-agent+wire !!)
        [%contact ~]
      si-abet:(si-take:(sub src.bowl) wire sign)
      ::
        [%migrate ~]
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  cor
      %-  (slog leaf/"{<wire>} failed" u.p.sign)
      cor
      ::
        [%activity ~]
      cor
      ::
        [%epic ~]
      cor
    ==
  ::
  ++  arvo
    |=  [=wire sign=sign-arvo]
    ^+  cor
    ?+  wire  ~|(evil-vane+wire !!)
      ::
        [%retry her=@p ~]
      ::  XX technically, the timer could fail.
      ::  it should be ok to still retry.
      ::
      ?>  ?=([%behn %wake *] sign)
      =+  who=(slav %p i.t.wire)
      si-abet:si-retry:(sub who)
    ==
  --
--

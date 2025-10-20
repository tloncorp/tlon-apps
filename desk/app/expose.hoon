::  exposé: clearweb content rendering
::
::    copy a reference to a notebook post, then:
::    :expose [%show /that/reference/with/id/numbers/quoted/'123456789']
::    then visit in the browser:
::    /expose/that/reference/as/copied/123456789
::
/-  c=cite, d=channels, co=contacts, ci=cite
/+  u=channel-utils, hutils=http-utils,
    dbug, verb
::
/=  page    /app/expose/page
/=  widget  /app/expose/widget
::
|%
+$  state-2
  $:  %2
      open=(set cite:c)
      eager=?
  ==
::
+$  action
  $%  [%show =path]
      [%hide =path]
  ==
::
+$  card  card:agent:gall
::
++  e  ::  expose utils
  |%
  ++  refresh-widget
    |=  [=bowl:gall open=(set cite:c)]
    ^-  (unit card)
    ?.  .^(? %gu /(scot %p our.bowl)/profile/(scot %da now.bowl)/$)
      ~
    =;  widget=[%0 desc=@t %marl marl]
      =/  =cage  noun+!>([%command %update-widget %groups %expose-all widget])
      `[%pass /profile/widget/all %agent [our.bowl %profile] %poke cage]
    :^  %0  'Published content'  %marl
    (render:widget bowl open)
  ::
  ++  refresh-pages
    |=  [=bowl:gall cis=(list cite:c)]
    ^-  (list card)
    %+  turn  cis
    |=  ref=cite:c
    ^-  card
    %+  store:hutils
      (cat 3 '/expose' (spat (print:c ref)))
    ::TODO  maybe find a way to dedupe with logic in %show and %handle-http-req
    ::NOTE  for sane amounts of content, doing an all-at-once re-rendering
    ::      remains reasonably fast. scry overhead (for contacts/profile deets)
    ::      is the slowest part, and doing all pages at once means we can
    ::      memoize and only run those scries once
    =/  msg=(unit [=nest:c =post:d])
      (grab-post:cite:u bowl ref)
    ?~  msg
      ::  if the message (no longer) exists in the backend store, make sure to
      ::  remove it from cache also. whatever deletes the store chooses to
      ::  respect, we should respect also.
      ::
      ~
    =/  pag=(unit manx)
      (render:page bowl u.msg)
    ?~  pag
      ::  if we cannot render the page for whatever reason, we cannot guarantee
      ::  its up-to-date-ness. delete it from cache, so we don't risk serving
      ::  stale content.
      ~
    `[| %payload (paint:hutils %page u.pag)]
  ::
  ++  clear-page
    |=  ref=cite:c
    ^-  card
    (store:hutils (cat 3 '/expose' (spat (print:c ref))) ~)
  ::
  ++  inflate-contacts-profile
    |=  $:  [our=@p now=@da]
            open=(set cite:c)
        ==
    ^-  (unit card)
    ::  if the contacts agent isn't running, that's slightly unexpected
    ::  (but not impossible). we choose to no-op for now.
    ::
    ?.  .^(? %gu /(scot %p our)/contacts/(scot %da now)/$)
      ~
    =+  =>  [our=our now=now co=co ..lull]  ~+
        .^(orig=contact:co %gx /(scot %p our)/contacts/(scot %da now)/v1/self/contact-1)
    ::  build a new contact to submit
    ::
    =;  =contact:co
      ?:  =(orig contact)  ~
      =/  =action:co  [%self contact]
      =/  =cage      [%contact-action-1 !>(action)]
      `[%pass /contacts/set %agent [our %contacts] %poke cage]
    %-  ~(gas by *contact:co)
    ::  start by clearing out all our entries for a fresh start
    ::
    %+  weld
      %+  turn  ~(tap by orig)
      |=  [=term =value:co]
      :-  term
      ?:(=(%expose- (end 3^7 term)) ~ value)
    ^-  (list [term value:co])
    ::  then look at our state and inject as appropriate
    ::
    :_  ~
    :-  %expose-cites
    :-  %set
    %-  ~(gas in *(set value:co))
    %+  turn  ~(tap in open)
    |=  =cite:c
    [%text (spat (print:c cite))]
  --
::  +sort-cite: sort by post id, newest first
::
++  sort-cite
  |=  [a=cite:c b=cite:c]
  ::  this narrowing down matches the +grab-post:cite:u logic.
  ::  that logic is required to succeed to add a cite into .open,
  ::  so we can get away with just sorting actual posts here.
  ::TODO  support replies..?
  ::
  ?.  ?=([%chan * ?(%msg %note %curio) @ ~] a)  |
  ?.  ?=([%chan * ?(%msg %note %curio) @ ~] b)  &
  %+  gth
    (rash i.t.wer.a dum:ag)
  (rash i.t.wer.b dum:ag)
--
::
%-  agent:dbug
%^  verb  |  %warn
^-  agent:gall
::
=|  state-2
=*  state  -
|_  =bowl:gall
+*  this  .
++  on-init
  ^-  (quip card _this)
  :_  this
  :~  [%pass /eyre/connect %arvo %e %connect [~ /expose] dap.bowl]
      [%pass /channels %agent [our.bowl %channels] %watch /v1]
      [%pass /contacts/news %agent [our.bowl %contacts] %watch /v1/news]
  ==
::
++  on-save  !>(state)
++  on-load
  |^  |=  ole=vase
  ^-  (quip card _this)
  =|  caz=(list card)
  =+  !<(old=versioned-state ole)
  =+  ver=-.old
  =?  old  ?=(%0 -.old)  old(- %1)
  =?  caz  ?=(%1 -.old)
    %+  weld  caz
    ^-  (list card)
    :~  [%pass /contacts/news %agent [our.bowl %contacts] %leave ~]
        [%pass /contacts/news %agent [our.bowl %contacts] %watch /v1/news]
    ==
  =?  old  ?=(%1 -.old)  [%2 open.old &]
  ?>  ?=(%2 -.old)
  =.  state  old
  =.  caz
    %+  snoc  caz
    ::  we must defer refreshing the cache because rendering scries
    ::
    [%pass /refresh %arvo %b %wait now.bowl]
  ::  leave obsolete %contacts endpoint and connect
  ::
  =?  caz  ?=(%0 ver)
    %+  weld  caz
    ^-  (list card)
    :~  [%pass /contacts %agent [our.bowl %contacts] %leave ~]
        :: leave %conacts (sic) agent sub
        [%pass /contacts %agent [our.bowl %conacts] %leave ~]
        [%pass /contacts/news %agent [our.bowl %contacts] %watch /news]
    ==
  ::  always refresh the contacts profile
  ::
  =.  caz  (weld (drop (inflate-contacts-profile:e [our now]:bowl open)) caz)
  [caz this]
  ::
  +$  versioned-state  $%(state-2 state-1 state-0)
  +$  state-1  [%1 open=(set cite:c)]
  +$  state-0  [%0 open=(set cite:c)]
  --
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+  mark  !!
      %noun
    ?>  =(src our):bowl
    ?+  q.vase  !!
        [%eager eager=?]
      [~ this(eager eager.q.vase)]
    ::
        [?(%show %hide) *]
      =+  !<(act=action vase)
      ?-  -.act
          %show
        =/  ref=cite:c
          (parse:c path.act)
        =/  msg=(unit [=nest:c =post:d])
          (grab-post:cite:u bowl ref)
        ?>  ?=(^ msg)
        =/  pag=(unit manx)
          (render:page bowl u.msg)
        ?>  ?=(^ pag)
        =.  open    (~(put in open) ref)
        :_  this
        :_  =-  (murn - same)
            :~  (refresh-widget:e bowl open)
                (inflate-contacts-profile:e [our now]:bowl open)
            ==
        %+  store:hutils
          (cat 3 '/expose' (spat path.act))
        `[| %payload (paint:hutils %page u.pag)]
      ::
          %hide
        =/  ref=cite:c
          (parse:c path.act)
        ?.  (~(has in open) ref)
          [~ this]
        =.  open    (~(del in open) ref)
        :_  this
        :_  =-  (murn - same)
            :~  (refresh-widget:e bowl open)
                (inflate-contacts-profile:e [our now]:bowl open)
            ==
        %+  store:hutils
          (cat 3 '/expose' (spat path.act))
        :^  ~  |  %payload
        [[404 ~] `(as-octs:mimes:html 'not found')]
      ==
    ==
  ::
      %json
    ::  we intentionally slum it with in-agent conversions for now
    ::
    ?>  =(src our):bowl
    =+  !<(=json vase)
    =-  $(mark %noun, vase !>(`action`-))
    %.  json
    (of show+pa hide+pa ~):dejs:format
  ::
      %handle-http-request
    =+  !<([rid=@ta inbound-request:eyre] vase)
    :_  this
    =;  payload=simple-payload:http
      :_  (spout:hutils rid payload)
      ::  if we handled a request here, make sure it's cached for next time
      ::
      (store:hutils url.request `[| %payload payload])
    =/  ref=(unit cite:c)
      (rush url.request (sear purse:c ;~(pfix (jest '/expose') stap)))
    ?~  ref
      [[400 ~] `(as-octs:mimes:html 'bad request')]
    ::
    =;  bod=(unit manx)
      ?~  bod  [[404 ~] `(as-octs:mimes:html 'not found')]
      (paint:hutils %page u.bod)
    ::
    ?.  (~(has in open) u.ref)
      ~
    %+  biff
      (grab-post:cite:u bowl u.ref)
    (cury render:page bowl)
  ==
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?>  ?=([%http-response @ ~] path)
  [~ this]
::
++  on-arvo
  |=  [=wire sign=sign-arvo]
  ^-  (quip card _this)
  ~|  wire
  ?+  wire  !!
      [%eyre %connect ~]
    [~ this]
  ::
      [%refresh ~]
    :_  this
    %+  weld
      =-  (murn - same)
      :~  (refresh-widget:e bowl open)
          (inflate-contacts-profile:e [our now]:bowl open)
      ==
    (refresh-pages:e bowl ~(tap in open))
  ==
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ?+  wire  ~&([dap.bowl strange-wire=wire] [~ this])
      [%profile %widget *]
    ?>  ?=(%poke-ack -.sign)
    ~?  ?=(^ p.sign)
      [dap.bowl %nacked-by-profile]
    [~ this]
  ::
      [%channels ~]
    ?-  -.sign
      %poke-ack  !!
      %kick      [[%pass /channels %agent [our.bowl %channels] %watch /v1]~ this]
    ::
        %watch-ack
      ?~  p.sign  [~ this]
      ~&  >>>  [dap.bowl %rejected-by-channels]
      [~ this]
    ::
        %fact
      ?.  =(%channel-response-2 p.cage.sign)  [~ this]
      =+  !<(r-channels:v7:old:d q.cage.sign)
      ::REVIEW  should this handle %posts also?
      ?+  -.r-channel  [~ this]
          %post
        =/  new=(unit $?(%del kind-data:v7:old:d))
          ?+  -.r-post.r-channel  ~
              %set
            ?~  post.r-post.r-channel  `%del
            `kind-data.u.post.r-post.r-channel
          ::
              %essay
            `kind-data.essay.r-post.r-channel
          ==
        ?~  new  [~ this]
        ?^  u.new
          ::  post was updated, refresh the relevant page's cache entry
          ::
          :_  this
          =/  ref=cite:c
            ::TODO  just get newer type/use newer endpoint
            (from-post:cite:u nest id.r-channel /[-.u.new])
          ?.  (~(has in open) ref)  ~
          %+  weld
            (drop (refresh-widget:e bowl open))
          (refresh-pages:e bowl ref ~)
        ::  post was deleted. if we have it, clear it out.
        ::
        ::TODO  just get kind.u.post from newer type/endpoint
        =/  kind=path
          ?-  -.nest
            %chat   /chat
            %diary  /diary
            %heap   /heap
          ==
        =/  ref=cite:c
          (from-post:cite:u nest id.r-channel kind)
        ?.  (~(has in open) ref)  [~ this]
        =.  open  (~(del in open) ref)
        :_  this
        :-  (clear-page:e ref)
        =-  (murn - same)
        :~  (refresh-widget:e bowl open)
            (inflate-contacts-profile:e [our now]:bowl open)
        ==
      ==
    ==
  ::
      [%contacts %prime *]
    ::  we don't actually care what happens after we try to prime the cache,
    ::  we just no-op and assume channels agent will kick our subscription
    ::  once we hear back.
    ::
    [~ this]
  ::
      [%contacts %news ~]
    ?-  -.sign
      %poke-ack  !!
      %kick      [[%pass /contacts/news %agent [our.bowl %contacts] %watch /v1/news]~ this]
    ::
        %watch-ack
      ?~  p.sign  [~ this]
      ~&  >>>  [dap.bowl %rejected-by-contacts]
      [~ this]
    ::
        %fact
      =+  !<(=response:co q.cage.sign)
      ?+  -.response  [~ this]
          %self
        ::  our own contact details changed. assume this affects all pages
        ::  we're serving, refresh the cache.
        ::  note that we don't do this kind of reactivity for contact details
        ::  of other ships. at the extreme, reacting to that accurately in a
        ::  non-wasteful way would require trawling all content for relevance,
        ::  which in turn is slow. if we get to the point of wanting that to be
        ::  fresh(er), we should just set an hourly timer that re-render the
        ::  entire cache.
        ::
        :_  this
        %+  weld
          (drop (refresh-widget:e bowl open))
        (refresh-pages:e bowl ~(tap in open))
      ::
          %peer
        ::  someone else's contact details changed. if they have any pinned
        ::  posts, and we're eager, pre-fetch those to prime the cache.
        ::
        :_  this
        ?.  eager  ~
        ?~  piz=(~(get by con.response) %expose-cites)
          ~
        ?.  ?=(%set -.u.piz)  ~
        %+  murn  ~(tap in p.u.piz)
        |^  |=  val=value:co
            ^-  (unit card)
            ?~  plan=(value-to-plan val)  ~
            =/  =path  (plan-to-path u.plan)
            ::  if we already have a cache entry, don't do an eager
            ::  over-the-network lookup, assume it hasn't gone stale
            ::
            =+  .^  cache=(unit (unit said:d))
                  %gx  (scot %p our.bowl)  %channels  (scot %da now.bowl)
                  %v3  %said  (snoc path %noun)
                ==
            ?^  cache
              ~
            %-  some
            :+  %pass   [%contacts %prime path]
            :+  %agent  [our.bowl %channels]
            [%watch [%v3 %said (scot %p who.response) path]]
        ::
        ++  value-to-plan
          |=  val=value:co
          ^-  (unit [nest:d plan:d])
          ?.  ?=([%text @] val)                       ~
          ?~  pax=(rush p.val stap)                   ~
          ?~  cit=(purse:ci u.pax)                    ~
          ?~  pon=(ref-to-pointer:cite:u u.cit)       ~
          ?.  ?=(?(%chat %diary %heap) p.nest.u.pon)  ~
          pon
        ::
        ++  plan-to-path
          |=  [=nest:d =plan:d]
          ^-  path
          :*  kind.nest  (scot %p ship.nest)  name.nest
              %post  (scot %ud p.plan)  ?~(q.plan ~ /(scot %ud u.q.plan))
          ==
        --
      ==
    ==
  ==
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
      [%x %show ~]
    ``noun+!>(open)
  ::
      [?(%x %u) %show *]
    ``loob+!>((~(has in open) (parse:c t.t.path)))
  ==
::
++  on-leave  |=(* [~ this])
::
++  on-fail
  |=  [=term =tang]
  ^-  (quip card _this)
  %.  [~ this]
  (slog dap.bowl 'on-fail' term tang)
--

::
/-  *notify, resource, a=activity, c=channels, h=hark
/+  cu=channel-utils, default-agent, verb, dbug, agentio
::
|%
+$  card  card:agent:gall
::
+$  provider-state  (map term provider-entry)
+$  provider-entry
  $:  notify-endpoint=@t
      binding-endpoint=@t
      auth-token=@t
      clients=(map ship binding=(unit @t))
      =whitelist
  ==
++  clear-interval  ~d7
++  daily-stats-interval  ~d1
::
+$  client-state
  $:  providers=(jug @p term)
  ==
::
+$  base-state-0
  $:  =provider-state
      =client-state
  ==
+$  base-state-2
::  We set notifications to * because we had an issue with the notification type
::  definition being wrong and this wrong state made its way onto some ships.
  $:  notifications=*
      base-state-0
  ==
::
+$  base-state-3
::  We set notifications to * because we had an issue with the notification type
::  definition being wrong and this wrong state made its way onto some ships.
  $:  last-timer=time
      notifications=*
      base-state-0
  ==
::
+$  base-state-4
  $:  last-timer=time
      notifications=(map uid notification)
      base-state-0
  ==
::
+$  base-state-6
  $:  last-timer=time
      notifications=(map time-id:a event:a)
      base-state-0
  ==
::
+$  state-0
  [%0 base-state-0]
::
+$  state-1
  [%1 base-state-0]
::
+$  state-2
  [%2 base-state-2]
+$  state-3
  [%3 base-state-2]
::
+$  state-4
  [%4 base-state-3]
::
+$  state-5
  [%5 base-state-4]
::
+$  state-6
  [%6 base-state-6]
::
+$  versioned-state
  $%  state-0
      state-1
      state-2
      state-3
      state-4
      state-5
      state-6
  ==
::
+$  current-state  state-6
::
++  migrate-state
  |=  old=versioned-state
  ^-  current-state
  ?-  -.old
    %0  $(old (migrate-0-to-1 old))
    %1  $(old (migrate-1-to-2 old))
    %2  $(old (migrate-2-to-3 old))
    %3  $(old (migrate-3-to-4 old))
    %4  $(old (migrate-4-to-5 old))
    %5  $(old (migrate-5-to-6 old))
    %6  old
  ==
::
++  migrate-0-to-1
  |=  old=state-0
  ^-  state-1
  [%1 [+.old]]
::
++  migrate-1-to-2
  |=  old=state-1
  ^-  state-2
  [%2 [~ +.old]]
::
++  migrate-2-to-3
  |=  old=state-2
  ^-  state-3
  [%3 [+.old]]
::
++  migrate-3-to-4
  |=  old=state-3
  ^-  state-4
  [%4 `@da`0 [+.old]]
::
++  migrate-4-to-5
  |=  old=state-4
  ^-  state-5
  old(- %5, notifications ~)
::
++  migrate-5-to-6
  |=  old=state-5
  ^-  state-6
  old(- %6, notifications ~)
::
--
::
=|  current-state
=*  state  -
::
%-  agent:dbug
%+  verb  |
^-  agent:gall
::
=<
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %|) bowl)
      do    ~(. +> bowl)
      io    ~(. agentio bowl)
      pass  pass:io
  ::
  ++  on-init
    :_  this
    :~  (~(watch-our pass:io /activity) %activity /notifications)
        (~(wait pass:io /clear) (add now.bowl clear-interval))
        [%pass / %agent [our.bowl %notify] %poke %provider-state-message !>(0)]
    ==
  ::
  ++  on-save   !>(state)
  ++  on-load
    |=  =vase
    ^-  (quip card _this)
    =+  !<([old-state=versioned-state] vase)
    =/  migrated  (migrate-state old-state)
    :_  this(state migrated)
    :-  [%pass / %agent [our.bowl %notify] %poke %provider-state-message !>(0)]
    ?:  (~(has by wex.bowl) [/activity our.bowl %activity])
      ~
    [(~(watch-our pass:io /activity) %activity /notifications)]~
  ::
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    |^
    =^  cards  state
      ?+  mark  (on-poke:def mark vase)
        %provider-state-message  provider-state-message
        %notify-provider-action  (handle-provider-action !<(provider-action vase))
        %notify-client-action    (handle-client-action !<(client-action vase))
      ==
    [cards this]
    ::
    ++  handle-provider-action
      |=  act=provider-action
      ^-  (quip card _state)
      ?-  -.act
          %add
        ?>  (team:title our.bowl src.bowl)
        =/  new-entry=provider-entry
          :*  notify.act
              binding.act
              auth-token.act
              ~
              whitelist.act
          ==
        [~ state(provider-state (~(put by provider-state) service.act new-entry))]
      ::
          %remove
        ?>  (team:title our.bowl src.bowl)
        =/  entry=(unit provider-entry)  (~(get by provider-state) service.act)
        ?~  entry
          ~|("no such service: {<service.act>}" !!)
        :_  state(provider-state (~(del by provider-state) service.act))
        %+  turn  ~(tap by clients.u.entry)
        |=  [who=@p *]
        ^-  card
        (leave-path:pass [who %notify] /notify/(scot %p who)/[service.act])
      ::
          %client-join
        =/  entry=(unit provider-entry)  (~(get by provider-state) service.act)
        ?~  entry
          ~|("no such service: {<service.act>}" !!)
        ?.  (is-whitelisted:do src.bowl u.entry)
          ~|("permission denied" !!)
        =.  clients.u.entry  (~(put by clients.u.entry) src.bowl ~)
        =/  cards=(list card)
          :_  ~
          %:  register-binding:do
              service.act
              u.entry
              binding-endpoint.u.entry
              src.bowl
              address.act
              binding.act
          ==
        =/  =wire  /agentio-watch/notify/(scot %p src.bowl)/[service.act]
        =?  cards  !(~(has by wex.bowl) wire src.bowl %notify)
          :_  cards
          %+  watch:pass
            [src.bowl %notify]
          /notify/(scot %p src.bowl)/[service.act]
        :-  cards
        state(provider-state (~(put by provider-state) service.act u.entry))
      ::
          %client-leave
        =/  entry=(unit provider-entry)  (~(get by provider-state) service.act)
        ?~  entry
          ~|("no such service: {<service.act>}" !!)
        ?.  (is-client:do src.bowl u.entry)
          ~|("permission denied" !!)
        =/  client-info=(unit @t)  (~(got by clients.u.entry) src.bowl)
        =.  clients.u.entry        (~(del by clients.u.entry) src.bowl)
        :_  state(provider-state (~(put by provider-state) service.act u.entry))
        ?~  client-info
          :_  ~
          %+  leave-path:pass
            [src.bowl %notify]
          /notify/(scot %p src.bowl)/[service.act]
        :~  %:  remove-binding:do
                service.act
                u.entry
                src.bowl
                binding-endpoint.u.entry
                u.client-info
            ==
            %+  leave-path:pass
              [src.bowl %notify]
            /notify/(scot %p src.bowl)/[service.act]
        ==
      ==
    ::
    ++  handle-client-action
      |=  act=client-action
      ^-  (quip card _state)
      ?>  (team:title our.bowl src.bowl)
      ?-  -.act
          %connect-provider
        =*  binding  'apn'
        =.  providers.client-state
          (~(put ju providers.client-state) who.act service.act)
        =/  pact=provider-action  [%client-join service.act address.act binding]
        :_  state
        [(poke:pass [who.act %notify] %notify-provider-action !>(pact))]~
      ::
          %connect-provider-with-binding
        =.  providers.client-state
          (~(put ju providers.client-state) who.act service.act)
        =/  pact=provider-action  [%client-join service.act address.act binding.act]
        :_  state
        [(poke:pass [who.act %notify] %notify-provider-action !>(pact))]~
      ::
          %remove-provider
        =.  providers.client-state
          (~(del ju providers.client-state) who.act service.act)
        =/  pact=provider-action  [%client-leave service.act]
        :_  state
        [(poke:pass [who.act %notify] %notify-provider-action !>(pact))]~
      ==
    ::
    ++  provider-state-message
      ^-  (quip card _state)
      ~&  "provider-state-message"
      ?>  =(our.bowl ~rivfur-livmet)
      =/  now  now.bowl
      =/  time-since-last  (sub `@`last-timer `@`now)
      ~&  ['time since last daily-stats-interval' time-since-last]
      ?>  (gth time-since-last daily-stats-interval)
      ~&  [provider-state]
      =/  ps-list  ~(tap by provider-state)
      =/  total-providers  (lent ps-list)
      ~&  ['total providers' total-providers]
      =/  total-clients
        %+  roll  ps-list
          |=  [[provider=@tas =provider-entry] accumulator=@]
          ^-  @
          (add accumulator (lent ~(tap by clients.provider-entry)))
      ~&  ['total clients on all providers' total-clients]
      =/  story=story:c  [[%inline [[%bold ['BotPoast: ' ~]] 'Daily ' [%inline-code '%notify'] ' provider check-in. Total providers: ' [%bold [(scot %u total-providers) ~]] ', total clients: ' [%bold [(scot %u total-clients) ~]] '.' ~]]~]
      =/  essay=essay:c  [[story our.bowl now.bowl] [%chat ~]]
      =/  nest=nest:c  [%chat ~bitpyx-dildus %interface]
      =/  channel-action=a-channels:c  [%channel nest [%post [%add essay]]]
      =/  new-timer  (add now daily-stats-interval)
      =.  last-timer  new-timer
      :_  state
      :~  [(poke:pass [our.bowl %channels] %channel-action !>(channel-action))]
          [(~(wait pass:io /daily-timer) new-timer)]
      ==
    --
  ::
  ++  on-watch
    |=  =path
    ^-  (quip card _this)
    ?+  path  (on-watch:def path)
        [%notify @ @ ~]
      =*  service  i.t.t.path
      ?.  (~(has ju providers.client-state) src.bowl service)
        ~|("permission denied" !!)
      `this
    ==
  ::
  ++  on-leave
    |=  =path
    ^-  (quip card _this)
    `this
  ::
  ++  on-peek
    |=  =path
    ^-  (unit (unit cage))
    =/  =(pole knot)  path
    ?+  pole  [~ ~]
    ::
        [%x %note uid=@ %activity-event ~]
      =/  =uid  (need (mate (slaw %da uid.pole) (slaw %uv uid.pole)))
      =/  =event:a  (~(got by notifications) `@`uid)
      ``activity-event+!>(event)
    ::
        [%x %provider-state ~]  ``noun+!>(provider-state)
        [%x %client-state ~]    ``client-state+!>(client-state)
    ==
  ::
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    ?+  wire  (on-agent:def wire sign)
    ::
    ::  subscription from client to their own hark-store
    ::NOTE  codepath deprecated in favor of /activity
    ::
        [%hark ~]
      :_  this
      [%pass wire %agent [our.bowl %hark] %leave ~]~
    ::
        [%activity ~]
      ?+  -.sign  (on-agent:def wire sign)
          %fact
        ?.  ?=(%activity-event p.cage.sign)
          `this
        =+  !<([=time-id:a =event:a] q.cage.sign)
        :_  this(notifications (~(put by notifications) time-id event))
        =-  (zing (turn - drop))
        ^-  (list (unit card))
        :_  [(fact-all:io %notify-update !>(`update`[`@`time-id %notify]))]~
        ::  if supported, convert the event to a hark notification (yarn) and
        ::  inject it into hark, so that old clients may continue retrieving
        ::  notifications from hark, using the id this agent gives them in the
        ::  %notify-update above
        ::
        ^-  (unit card)
        =;  yarn=(unit yarn:h)
          ?~  yarn  ~
          =/  =action:h  [%add-yarn & | u.yarn]
          `[%pass /hark/copy %agent [our.bowl %hark] %poke %hark-action !>(action)]
        ?:  ?=(%chan-init -<.event)
          ~  ::  no hark precedent
        ?:  ?=(?(%flag-post %flag-reply) -<.event)
          ~  ::  not generated by any agent
        %-  some
        |^  =/  =rope:h
              ?-  -<.event
                  %post
                =,  event
                :^  `group  `channel  %groups
                (channel-path channel q.id.key ~)
              ::
                  %reply
                =,  event
                :^  `group  `channel  %groups
                (channel-path channel q.id.parent `q.id.key)
              ::
                  %dm-invite
                [~ ~ %groups (whom-path whom.event)]
              ::
                  %dm-post
                [~ ~ %groups (whom-path whom.event)]
              ::
                  %dm-reply
                [~ ~ %groups (whom-path whom.event)]
              ::
                  %group-ask
                =*  g  group.event
                [`g ~ %groups /(scot %p p.g)/[q.g]/asks]
              ::
                  %group-invite
                =*  g  group.event
                [`g ~ %groups /(scot %p p.g)/[q.g]/invites]
              ::
                  %group-join
                =*  g  group.event
                [`g ~ %groups /(scot %p p.g)/[q.g]/joins]
              ::
                  %group-kick
                =*  g  group.event
                [`g ~ %groups /(scot %p p.g)/[q.g]/leaves]
              ::
                  %group-role
                =*  g  group.event
                [`g ~ %groups /(scot %p p.g)/[q.g]/add-roles]
              ==
            :*  `@`time-id
                rope
                time-id
              ::
                ^-  (list content:h)
                ?-  -<.event
                    %post
                  =,  -.event
                  :~  [%ship p.id.key]
                      ?:(mention ' mentioned you: ' ' sent a message: ')
                      (flatten:cu content)
                  ==
                ::
                    %reply
                  =,  -.event
                  ?:  mention
                    :~  [%ship p.id.key]
                        ' mentioned you: '
                        (flatten:cu content)
                    ==
                  =*  diary-contents
                    :~  [%ship p.id.key]  ' commented on '
                        [%emph 'a notebook post']   ': '  ::REVIEW  don't have access to title.kind-data
                        [%ship p.id.key]  ': '
                        (flatten:cu content)
                    ==
                  =*  heap-contents
                    :~  [%ship p.id.key]  ' commented on '
                        [%emph 'a collection item']   ': '  ::REVIEW  don't have access to title.kind-data
                        [%ship p.id.key]  ': '
                        (flatten:cu content)
                    ==
                  ?:  =(p.id.parent our.bowl)
                    ?-  kind.channel.event
                        %diary  diary-contents
                        %heap   heap-contents
                        %chat
                      :~  [%ship p.id.key]
                          ' replied to you: '
                          (flatten:cu content)
                      ==
                    ==
                  ?-  kind.channel.event
                      %diary  diary-contents
                      %heap   heap-contents
                      %chat
                    :~  [%ship p.id.key]
                        ' sent a message: '
                        (flatten:cu content)
                    ==
                  ==
                ::
                    %dm-invite
                  ::REVIEW  'author.memo has invited you to a direct message'
                  ::TODO    maybe want [%dm-invite =whom from=@p]
                  :~  'Someone'
                      ' has invited you to a direct message'
                  ==
                ::
                    %dm-post
                  ::REVIEW  should maybe not be rendered if you haven't accepted
                  :~  [%ship p.id.key.event]
                      ': '
                      (flatten:cu content.event)
                  ==
                ::
                    %dm-reply
                  ::REVIEW  should maybe not be rendered if you haven't accepted
                  :~  [%ship p.id.key.event]
                      ': '
                      (flatten:cu content.event)
                  ==
                ::
                    ?(%group-ask %group-invite %group-join %group-kick %group-role)
                  =+  .^  =group:g:a  %gx
                        (scot %p our.bowl)
                        %groups
                        (scot %da now.bowl)
                        /groups/(scot %p p.group.event)/[q.group.event]/group
                      ==
                  ?-  -<.event
                      %group-ask
                    :~  [%ship ship.event]
                        ' has requested to join '
                        [%emph title.meta.group]
                    ==
                  ::
                      %group-invite
                    :~  [%ship ship.event]
                        ' sent you an invite to '
                        [%emph title.meta.group]
                    ==
                  ::
                      %group-join
                    :~  [%ship ship.event]
                        ' has joined '
                        [%emph title.meta.group]
                    ==
                  ::
                      %group-kick
                    :~  [%ship ship.event]
                        ' has left '
                        [%emph title.meta.group]
                    ==
                  ::
                      %group-role
                    =;  role-list
                      :~  [%ship ship.event]
                          ' is now a(n) '
                          [%emph role-list]
                      ==
                    %-  crip
                    %+  join  ', '
                    %+  turn
                      ~(tap in roles.event)
                    |=  =sect:g:a
                    ?.  (~(has by cabals.group) sect)  sect
                    =/  cabal  (~(got by cabals.group) sect)
                    title.meta.cabal
                  ==
                ==
              ::
                ?-  -<.event
                  %post   (welp (group-path group.event) %channels ted.rope)
                  %reply  (welp (group-path group.event) %channels ted.rope)
                ::
                    %dm-invite
                  (dm-path whom.event)
                ::
                  %dm-post  (dm-path whom.event)
                ::
                    %dm-reply
                  (weld (dm-path whom.event) /message/(scot %p p.id.parent.event)/(scot %ud q.id.parent.event))
                ::
                  %group-ask     (weld (group-path group.event) /edit/members)
                  %group-invite  /find
                  %group-join    (weld (group-path group.event) /edit/members)
                  %group-kick    (weld (group-path group.event) /edit/members)
                  %group-role    (weld (group-path group.event) /edit/members)
                ==
              ::
                ~
            ==
        ::
        ++  channel-path
          |=  [=nest:c =id-post:c id-reply=(unit id-reply:c)]
          ^-  ^path
          %+  weld
            `^path`/[kind.nest]/(scot %p ship.nest)/[name.nest]
          =;  base=^path
            ?~  id-reply  base
            (snoc base (rsh 4 (scot %ui u.id-reply)))
          ?-  kind.nest  ::REVIEW  technically want the -.kind-data of the post...
            %diary  /note/(rsh 4 (scot %ui id-post))
            %heap   /curio/(rsh 4 (scot %ui id-post))
            %chat   /message/(rsh 4 (scot %ui id-post))
          ==
        ::
        ++  group-path
          |=  group=flag:g:c
          /groups/(scot %p p.group)/[q.group]
        ::
        ++  whom-path
          |=  =whom:a
          ?-  -.whom
            %ship  /dm/(scot %p p.whom)
            %club  /club/(scot %uv p.whom)
          ==
        ::
        ++  dm-path
          |=  =whom:a
          =;  id=@ta  /dm/[id]
          ?-  -.whom
            %ship  (scot %p p.whom)
            %club  (scot %uv p.whom)
          ==
        --
      ::
          %kick
        :_  this
        [%pass wire %agent [our.bowl %activity] %watch /notifications]~
      ==
    ::
    ::  subscription from provider to client
    ::
        [%agentio-watch %notify @ @ ~]
      =/  who      (slav %p i.t.t.wire)
      =*  service  i.t.t.t.wire
      ?+  -.sign  (on-agent:def wire sign)
          %fact
        ?>  ?=(%notify-update p.cage.sign)
        =+  !<(=update q.cage.sign)
        :_  this
        =/  entry=(unit provider-entry)  (~(get by provider-state) service)
        ?~  entry
          ~
        [(send-notification:do u.entry who update)]~
      ::
          %kick
        :_  this
        [(watch:pass [who %notify] /notify/(scot %p who)/[service])]~
      ::
          %watch-ack
        ?~  p.sign
          `this
        ((slog u.p.sign) `this)
      ==
    ==
  ::
  ++  on-arvo
    |=  [=wire =sign-arvo]
    ^-  (quip card _this)
    ?+  wire  (on-arvo:def wire sign-arvo)
        [%daily-timer ~]
      ?>  ?=([%behn %wake *] sign-arvo)
      :_  this
      [%pass / %agent [our.bowl %notify] %poke %provider-state-message !>(0)]~
    ::
        [%register-binding @ @ @ ~]
      =/  who=@p   (slav %p i.t.wire)
      =*  service  i.t.t.wire
      ::
      ?>  ?=(%iris -.sign-arvo)
      ?>  ?=(%http-response +<.sign-arvo)
      ?>  ?=(%finished -.client-response.sign-arvo)
      ?>  ?=(^ full-file.client-response.sign-arvo)
      =/  =mime-data:iris  u.full-file.client-response.sign-arvo
      ?>  =('application/json' type.mime-data)
      =/  jon=json
        (fall (de:json:html (@t q.data.mime-data)) *json)
      =/  [sid=@t message=@t]
        %.  jon
        %-  ot:dejs:format
        :~  sid+so:dejs:format
            message+so:dejs:format
        ==
      ::
      =/  entry=(unit provider-entry)  (~(get by provider-state) service)
      :-  ~
      ?~  entry
        this
      =.  clients.u.entry  (~(put by clients.u.entry) who `sid)
      this(provider-state (~(put by provider-state) service u.entry))
    ::
        [%remove-binding *]  `this
    ::
        [%send-notification *]
      ?>  ?=(%iris -.sign-arvo)
      ?>  ?=(%http-response +<.sign-arvo)
      =*  res  client-response.sign-arvo
      ?>  ?=(%finished -.res)
      %.  `this
      =*  status  status-code.response-header.res
      ?:  =(200 status)  same
      %+  slog
        leaf/"Error sending notfication, status: {(scow %ud status)}"
      ?~  full-file.res  ~
      ~[leaf/(trip `@t`q.data.u.full-file.res)]
    ::
        [%clear ~]
      ?>  ?=([%behn %wake *] sign-arvo)
      =.  notifications  ~
      ~&  "notify/debug: cleared notifications"
      :_  this
      ~[(~(wait pass:io /clear) (add now.bowl clear-interval))]
    ==
  ::
  ++  on-fail   on-fail:def
  --
|_  bowl=bowl:gall
::
++  filter-notifications
  |=  =action:h
  ^-  (unit update)
  ?.  ?=(%add-yarn -.action)  ~
  `[id.yarn.action %notify]
::
++  is-whitelisted
  |=  [who=@p entry=provider-entry]
  ^-  ?
  |^
  ?|  public.whitelist.entry
      =(our.bowl who)
      is-kid
      (~(has in users.whitelist.entry) who)
      in-group
  ==
  ::
  ++  is-kid
    ?&  kids.whitelist.entry
        =(our.bowl (sein:title our.bowl now.bowl who))
    ==
  ::
  ++  in-group
    =/  gs  ~(tap in groups.whitelist.entry)
    |-
    ?~  gs  %.n
    =+  .^  members=(set ship)
          %gx
          (scot %p our.bowl)
          %groups
          (scot %da now.bowl)
          /groups/(scot %p entity.i.gs)/[name.i.gs]/fleet/ships/ships
        ==
    ?:  (~(has in members) who)
      %.y
    $(gs t.gs)
  --
::
++  is-client
  |=  [who=@p entry=provider-entry]
  ^-  ?
  (~(has by clients.entry) who)
::
++  post-form
  |=  [=wire url=@t auth=@t params=(list [@t @t])]
  ^-  card
  ~&  "post-form to {<url>} with {<params>}"
  =/  data
    %+  roll
      %+  sort  params
      |=  [[p=@t @t] [q=@t @t]]
      (aor p q)
    |=  [[p=@t q=@t] out=_url]
    (rap 3 out p q ~)
  =/  hmac-sig  (hmac-sha1t:hmac:crypto auth data)
  =/  b64-sig   (en:base64:mimes:html (met 3 hmac-sig) (swp 3 hmac-sig))
  =/  headers
    :~  ['X-Twilio-Signature' b64-sig]
        ['Content-Type' 'application/x-www-form-urlencoded']
    ==
  =/  form-data  (build-form-data params)
  =/  =request:http
    [%'POST' url headers `[(met 3 form-data) form-data]]
  [%pass wire %arvo %i %request request *outbound-config:iris]
::
++  build-form-data
  |=  data=(list [@t @t])
  ^-  @t
  %+  roll  data
  |=  [[p=@t q=@t] out=@t]
  ?:  =(out '')
    (rap 3 p '=' q ~)
  (rap 3 out '&' p '=' q ~)
::
++  send-notification
  |=  [entry=provider-entry who=@p =update]
  ^-  card
  ~&  "sending notification to {<who>} with {<update>} with {<notify-endpoint.entry>}"
  =/  params=(list [@t @t])
    :~  identity+(rsh [3 1] (scot %p who))
        action+`@t`action.update
        uid+(scot %uv uid.update)
        id+(scot %da uid.update)
    ==
  %:  post-form
      /send-notification/(scot %uv (sham eny.bowl))
      notify-endpoint.entry
      auth-token.entry
      params
  ==
::
++  register-binding
  |=  [service=term entry=provider-entry url=@t who=@p address=@t binding=@t]
  ^-  card
  ~&  "registering binding for {<who>} with {<address>} on {<service>} with {<binding>} with {<url>} and {<notify-endpoint.entry>}"
  =/  params=(list [@t @t])
    :~  identity+(rsh [3 1] (scot %p who))
        bindingtype+binding
        address+address
        action+'add'
    ==
  %:  post-form
      /register-binding/(scot %p who)/[service]/(scot %uv (sham eny.bowl))
      binding-endpoint.entry
      auth-token.entry
      params
  ==
::
++  remove-binding
  |=  [service=term entry=provider-entry who=@p url=@t sid=@t]
  ^-  card
  =/  params=(list [@t @t])
    :~  sid+sid
        action+'remove'
    ==
  %:  post-form
      /remove-binding/(scot %p who)/[service]/(scot %uv (sham eny.bowl))
      binding-endpoint.entry
      auth-token.entry
      params
  ==
--

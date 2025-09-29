/-  reel, groups-ver
/+  default-agent, verb, dbug, logs, *reel, s=subscriber, t=contacts
|%
+$  card  card:agent:gall
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
::  vic: URL of bait service
::  civ: @p of bait service
::  our-metadata: a mapping from nonce/token to metadata
::  open-link-requests: open requests for an existing foreign link, v0
::                      lure links only
::  open-describes: attempts to create a link waiting to be assigned a token
::  stable-id: a mapping from something the client can use to identify the
::             metadata to nonce and/or token
::
+$  state-0
  $:  %0
      vic=@t
      civ=ship
      descriptions=(map cord cord)
  ==
+$  state-1
  $:  %1
      vic=@t
      civ=ship
      our-metadata=(map cord metadata:v0:reel)
  ==
+$  state-2
  $:  %2
      vic=@t
      civ=ship
      our-metadata=(map cord metadata:v0:reel)
      outstanding-pokes=(set (pair ship cord))
  ==
+$  state-3
  $:  %3
      vic=@t
      civ=ship
      our-metadata=(map cord metadata:v0:reel)
      outstanding-pokes=(set (pair ship cord))
  ==
+$  state-4
  $:  %4
      vic=@t
      civ=ship
      our-metadata=(map token:reel metadata:v0:reel)
      open-link-requests=(set (pair ship cord))
      open-describes=(set token:reel)
      stable-id=(map cord token:reel)
  ==
+$  state-5
  $:  %5
      vic=@t
      civ=ship
      our-profile=contact:t
      our-metadata=(map token:reel metadata:v1:reel)
      open-link-requests=(set (pair ship cord))
      open-describes=(set token:reel)
      stable-id=(map cord token:reel)
      =^subs:s
  ==
+$  state-6
  $:  %6
      vic=@t
      civ=ship
      our-profile=contact:t
      our-metadata=(map token:reel metadata:v1:reel)
      open-link-requests=(set (pair ship cord))
      open-describes=(set token:reel)
      stable-id=(map cord token:reel)
      =^subs:s
  ==
::
::  url with old style token
++  url-for-token
  |=  [vic=cord token=cord]
  (cat 3 vic token)
--
=|  state-6
=*  state  -
::
%-  agent:dbug
%+  verb  |
=>
|%
::  |l: logs core
::
++  l
  |_  [=bowl:gall =log-data:logs]
  ++  fail
    |=  [desc=term =tang]
    %-  link
    %-  %-  %*(. slog pri 3)  [leaf+"fail" desc tang]
    (~(fail logs our.bowl /logs) desc tang log-data)
  ::
  ++  tell
    |=  [vol=volume:logs =echo:logs =log-data:logs]
    =/  pri
      ?-  vol
        %dbug  0
        %info  1
        %warn  2
        %crit  3
      ==
    %-  link
    %-  %-  %*(. slog pri pri)  echo
    (~(tell logs our.bowl /logs) vol echo (weld ^log-data log-data))
  ::  +deez: log message details
  ::
  :: ++  deez
  ::   ^-  (list (pair @t json))
  ::   =;  l=(list (unit (pair @t json)))
  ::     (murn l same)
  ::   :~  ?~(flow ~ `'flow'^s+u.flow)
  ::   ==
  ++  link
    |=  cad=card
    |*  [caz=(list card) etc=*]
    [[cad caz] etc]
  --
--
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)
    log   ~(. l bowl ~)
  ::
    groups-path    /v1/groups
    contacts-path  /v1/news
::
++  on-init
  ^-  (quip card _this)
  :_  this(vic 'https://tlon.network/lure/', civ ~loshut-lonreg)
  :~  [%pass /groups %agent [our.bowl %groups] %watch groups-path]
      [%pass /contacts %agent [our.bowl %contacts] %watch contacts-path]
  ==
::
++  on-save  !>(state)
++  on-load
  |=  =vase
  ^-  (quip card _this)
  =+  !<(old=versioned-state vase)
  =?  old  ?=(%0 -.old)
    [%4 'https://tlon.network/lure/' ~loshut-lonreg ~ ~ ~ ~]
  =?  old  ?=(%1 -.old)
    [%4 'https://tlon.network/lure/' ~loshut-lonreg ~ ~ ~ ~]
  =?  old  ?=(%2 -.old)
    [%4 vic.old civ.old our-metadata.old ~ ~ ~]
  =?  old  ?=(%3 -.old)
    [%4 vic.old civ.old our-metadata.old outstanding-pokes.old ~ ~]
  =?  old  ?=(%4 -.old)
    ::  normalize lure invites: we cast tokens which are not a @uv string
    ::  into a flag form.
    ::
    =^  norm-md=(map token:reel metadata:v0:reel)  stable-id
      %+  roll
        ~(tap by our-metadata.old)
      |=  [[=token:reel =metadata:v0:reel] [md=_our-metadata.old id=_stable-id]]
      ?^  (slaw %uv token)  [md id]
      ?^  (rush token flag)
        :-  md
        ?:  (~(has by id) token)  id
        (~(put by id) token token)
      =/  new  (rap 3 (scot %p our.bowl) '/' token ~)
      :-  (~(put by md) new metadata)
      (~(put by id) new new)
    ::  normalize lure invites: migrate old group fields
    ::
    :*  %5
        vic.old
        civ.old
        *contact:t  ::  profile
        (~(run by norm-md) v1:metadata:v0:conv)
        open-link-requests.old
        open-describes.old
        stable-id
        ~  ::  subs
    ==
  ::  v5 -> v6: trigger invites profile update
  ::
  =^  caz=(list card)  old
    ?.  ?=(%5 -.old)  `old
    :_  old(- %6)
    =+  wait=(~(rad og eny.bowl) ~h1)
    [%pass /load/profile %arvo %b %wait (add now.bowl wait)]~
  ?>  ?=(%6 -.old)
  =.  state  old
  :_  this
  %+  weld  caz
  %-  murn  :_  same
  ^-  (list (unit card))
  :~  ?:  (~(has by wex.bowl) /groups [our.bowl %groups])  ~
      `[%pass /groups %agent [our.bowl %groups] %watch groups-path]
    ::
      ?:  (~(has by wex.bowl) /contacts [our.bowl %contacts])  ~
      `[%pass /contacts %agent [our.bowl %contacts] %watch contacts-path]
  ==
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+    mark  (on-poke:def mark vase)
      %reel-command
    ?>  =(our.bowl src.bowl)
    =+  !<(=command:reel vase)
    ?-  -.command
        %set-service
      :_  this(vic vic.command)
      ~[[%pass /set-ship %arvo %k %fard q.byk.bowl %reel-set-ship %noun !>(vic.command)]]
        %set-ship
      ::  since we're changing providers, we need to regenerate links
      ::  we'll use whatever key we currently have as the nonce
      :_  this(civ civ.command, open-describes ~(key by our-metadata))
      %+  turn  ~(tap by our-metadata)
      |=  [token=cord =metadata:reel]
      ^-  card
      [%pass /describe %agent [civ %bait] %poke %bait-describe !>([token metadata])]
    ==
  ::
      %reel-bite
    ?>  =(civ src.bowl)
    =+  !<(=bite:reel vase)
    [[%give %fact ~[/bites] mark !>(bite)]~ this]
  ::
      %reel-describe
    ?>  =(our.bowl src.bowl)
    =+  !<([id=cord old-metadata=metadata:v0:reel] vase)
    =/  old-token  (~(get by stable-id) id)
    ::TODO when the client is cleaned up of old fields, we should
    ::     directly convert to new metadata type from json.
    ::
    =/  =metadata:reel
      (v1:metadata:v0:conv old-metadata)
    =.  fields.metadata
      %-  ~(gas by fields.metadata)
      :~  [%'bite-type' '2']
          [%'inviterUserId' (scot %p src.bowl)]
          [%'invitedGroupId' id]
      ==
    ::  the nonce here is a temporary identifier for the metadata.
    ::  a new one will be assigned by the bait provider and returned to us.
    ::
    =/  =nonce:reel  (scot %da now.bowl)
    ::  delete old metadata if we have an existing token for this id
    =?  our-metadata  ?=(^ old-token)
      (~(del by our-metadata) u.old-token)
    =.  our-metadata  (~(put by our-metadata) nonce metadata)
    =.  open-describes  (~(put in open-describes) nonce)
    =.  stable-id  (~(put by stable-id) id nonce)
    :_  this
    ~[[%pass /describe %agent [civ %bait] %poke %bait-describe !>([nonce metadata])]]
  ::
      %reel-confirmation
    ?>  =(civ src.bowl)
    =+  !<(confirmation:reel vase)
    =+  log=~(. l bowl 'flow'^s+'lure' ~)
    =.  open-describes  (~(del in open-describes) nonce)
    =/  ids=(list [id=cord =token:reel])
      %+  skim
        ~(tap by stable-id)
      |=  [key=cord =token:reel]
      =(nonce token)
    ?~  ids
      %-  %^  tell:log  %warn
            ~[leaf+"no stable id found for nonce {<nonce>}"]
          ~['event'^s+'Nonce Revoked']
      `this
    =*  id  -<.ids
    ?~  md=(~(get by our-metadata) nonce)
      %-  %^  tell:log  %crit
            ~[leaf+"no metadata for nonce {<nonce>}"]
          ~['event'^s+'Invite Creation Failed']
      `this
    ::  update the token the id points to
    =.  stable-id  (~(put by stable-id) id token)
    %-  %^  tell:log  %info
          ~[leaf+"invite link for {(trip id)} created"]
        ~['event'^s+'Invite Link Created' 'lure-id'^s+token]
    :_  %_  this  our-metadata
          ::  swap out the nonce for the token in our-metadata
          (~(put by (~(del by our-metadata) nonce)) token u.md)
        ==
    =/  url  (cat 3 vic token)
    =/  path  (stab (cat 3 '/v1/id-link/' id))
    ~[[%give %fact ~[path] %json !>(s+url)]]
  ::
      %reel-undescribe
    ?>  =(our.bowl src.bowl)
    =+  !<(=token:reel vase)
    =+  log=~(. l bowl 'flow'^s+'lure' ~)
    ::  the token here should be the actual token given to us by the provider
    %-  %^  tell:log  %info
          ~[leaf+"invite link removed"]
        ~['event'^s+'Invite Link Removed' 'lure-id'^s+token]
    :_  this(our-metadata (~(del by our-metadata) token))
    ~[[%pass /undescribe %agent [civ %bait] %poke %bait-undescribe !>(token)]]
  ::  old pokes for getting links, we no longer use these because all links
  ::  are unique to that ship/user and can be scried out
  ::
      %reel-want-token-link
    =+  !<(=token:reel vase)
    :_  this
    =/  full-token
      ?^  (rush token flag)  token
      (rap 3 (scot %p our.bowl) '/' token ~)
    =/  result=(unit [cord cord])
      ?.  (~(has by our-metadata) full-token)  `[full-token '']
      `[full-token (url-for-token vic full-token)]
    ~[[%pass [%token-link-want token ~] %agent [src dap]:bowl %poke %reel-give-token-link !>(result)]]
  ::
      %reel-give-token-link
    =+  !<(result=(unit [cord cord]) vase)
    ?~  result  `this
    :_  this
    =/  [token=cord url=cord]  u.result
    =/  path  (stab (cat 3 '/token-link/' token))
    ~[[%give %fact ~[path] %json !>(?:(=('' url) ~ s+url))]]
  ==
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  =/  =(pole knot)  wire
  ?+    pole  (on-agent:def wire sign)
      [%update %contact ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  `this
    %-  (fail:log %poke-ack 'profile update failed' u.p.sign)
    `this
  ::
      [%update %group ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  `this
    %-  (fail:log %poke-ack 'group meta update failed' u.p.sign)
    `this
  ::
      [%contacts ~]
    ?+    -.sign  (on-agent:def wire sign)
        %kick
      =^  caz=(list card)  subs
        (~(subscribe s [subs bowl]) /contacts [our.bowl %contacts] contacts-path &)
      [caz this]
    ::
        %watch-ack
      ?~  p.sign  `this
      %-  (fail:log %watch-ack 'failed to subscribe to contacts' u.p.sign)
      `this
    ::
        %fact
      =+  !<(=response:t q.cage.sign)
      ?.  ?=(%self -.response)  `this
      =*  profile  con.response
      =>
        |%
        ::  +hand: choose right and test equality
        ++  hand
          |*  [a=(unit) b=(unit)]
          ^-  [_b ?]
          ?~  a  [b ?=(~ b)]
          ?~  b  [~ ?=(~ a)]
          [b =(u.a u.b)]
        --
      ::  check profile for relevant changes
      ::
      =/  [nickname=(unit @t) axe=?]
        %+  hand
          (~(get cy:t our-profile) %nickname %text)
        (~(get cy:t profile) %nickname %text)
      =/  [avatar=(unit @t) bax=?]
        %+  hand
          (~(get cy:t our-profile) %avatar %look)
        (~(get cy:t profile) %avatar %look)
      =/  [color=(unit @ux) cax=?]
        %+  hand
          (~(get cy:t our-profile) %color %tint)
        (~(get cy:t profile) %color %tint)
      =.  our-profile  profile
      ::  nothing relevant has changed, skip the update
      ?:  &(axe bax cax)  `this
      =|  update=metadata:reel
      =.  tag.update  'groups-0'
      =.  fields.update
        %-  ~(gas by *(map field:reel cord))
        :~  %'inviterNickname'^(fall nickname '')
            %'inviterAvatarImage'^(fall avatar '')
            %'inviterColor'^?^(color (rsh [3 2] (scot %ux u.color)) '')
        ==
      ::  update our lure links with new nickname, avatar image
      ::  and color. also update open-graph metadata.
      ::
      =^  caz=(list card)  our-metadata
        %+  ~(rib by our-metadata)  *(list card)
        |=  [[=token:reel meta=metadata:reel] caz=(list card)]
        ^-  [(list card) [token:reel metadata:reel]]
        =;  [new-meta=metadata:reel new-update=_update]
          :_  [token new-meta]
          :_  caz
          [%pass /update/profile %agent [civ %bait] %poke bait-update+!>([token new-update])]
        =;  =_update
          :_  update
          meta(fields (~(uni by fields.meta) fields.update))
        =+  type=(~(get by fields.meta) %'inviteType')
        ::  by default we assume a group invite
        ::
        ?~  type
          =/  group-title=@t
            =+  til=(~(get by fields.meta) %'invitedGroupTitle')
            ?:  |(?=(~ til) =('' u.til))
              'a Groupchat'
            u.til
          =/  title=@t
            %-  crip
            ?:  |(?=(~ nickname) =('' u.nickname))
              "Tlon Messenger: You're Invited to a Groupchat"
            "Tlon Messenger: {(trip u.nickname)} invited you to {(trip group-title)}"
          =.  fields.update
            (~(put by fields.update) %'$og_title' title)
          =.  fields.update
            (~(put by fields.update) %'$twitter_title' title)
          update
        ::  non-empty inviteType, assume a personal invite
        ::
        =/  title=@t
          %-  crip
          ?:  |(?=(~ nickname) =('' u.nickname))
            "Tlon Messenger: You've Been Invited"
          "Tlon Messenger: {(trip u.nickname)} Sent You an Invite"
        =.  fields.update
          (~(put by fields.update) %'$og_title' title)
        =.  fields.update
          (~(put by fields.update) %'$twitter_title' title)
        update
      [caz this]
    ==
  ::
      [%groups ~]
    ?+    -.sign  (on-agent:def wire sign)
        %kick
      =^  caz=(list card)  subs
        (~(subscribe s [subs bowl]) /groups [our.bowl %groups] groups-path &)
      [caz this]
    ::
        %watch-ack
      ?~  p.sign  `this
      %-  (fail:log %watch-ack 'failed to subscribe to groups' u.p.sign)
      `this
    ::
        %fact
      =+  !<(=r-groups:v7:groups-ver q.cage.sign)
      =*  flag  flag.r-groups
      =+  id=(rap 3 (scot %p p.flag) '/' q.flag ~)
      =+  token=(~(get by stable-id) id)
      =|  update=metadata:reel
      =.  tag.update  'groups-0'
      =.  fields.update
        ?+    -.r-group.r-groups  ~
            %meta
          =*  meta  meta.r-group.r-groups
          =+  nickname=(~(get cy:t our-profile) %nickname %text)
          =/  group-title=@t
            ?:  =('' title.meta)  'a Groupchat'
            title.meta
          =/  title=@t
            %-  crip
            ?:  |(?=(~ nickname) =('' u.nickname))
              "Tlon Messenger: You're Invited to a Groupchat"
            "Tlon Messenger: {(trip u.nickname)} invited you to {(trip group-title)}"
          %-  ~(gas by *(map field:reel cord))
          :~  %'invitedGroupTitle'^title.meta
              %'invitedGroupDescription'^description.meta
              %'invitedGroupIconImageUrl'^image.meta
              %'$og_title'^title
              %'$twitter_title'^title
          ==
        ::
            %delete
          %-  ~(gas by *(map field:reel cord))
          :~  %'invitedGroupDeleted'^'true'
          ==
        ==
      ?:  =(~ fields.update)  `this
      ::  update our group invite link
      ::
      =?  our-metadata  ?=(^ token)
        ?~  our-meta=(~(get by our-metadata) u.token)
          our-metadata
        %+  ~(put by our-metadata)  u.token
        u.our-meta(fields (~(uni by fields.u.our-meta) fields.update))
      ::  update the bait provider if we are the group host
      ::
      ?.  =(p.flag our.bowl)  `this
      :_  this
      [%pass /update/group %agent [civ %bait] %poke bait-update-group+!>([flag update])]~
    ==
  ::
      [%token-link @ name=@ ~]
    ?+  -.sign  (on-agent:def wire sign)
        %poke-ack
      `this(open-link-requests (~(del in open-link-requests) [src.bowl name.pole]))
    ==
  ==
::
++  on-watch
  |=  =(pole knot)
  ^-  (quip card _this)
  ?>  =(our.bowl src.bowl)
  =/  any  ?(%v0 %v1)
  =?  pole  !?=([any *] pole)
    [%v0 pole]
  ?+  pole  ~|("bad pole: {<pole>}" (on-watch:def pole))
    [any %bites ~]  `this
  ::  old subscription for getting links, we no longer use these because all
  ::  links are unique to that ship/user and can be scried out
  ::
      [%v0 %token-link ship=@ token=@ ~]
    =/  ship  (slav %p ship.pole)
    =/  key  [ship token.pole]
    ?~  (~(has in open-link-requests) key)  `this
    :_  this(open-link-requests (~(put in open-link-requests) key))
    =/  =dock  [ship dap.bowl]
    =/  =cage  reel-want-token-link+!>(token.pole)
    :~  [%pass +.pole %agent dock %poke cage]
        [%pass /expire/[ship.pole]/[token.pole] %arvo %b [%wait (add ~h1 now.bowl)]]
    ==
  ::
      [%v1 %id-link id=*]
    =/  id  (crip +:(spud id.pole))
    ?~  token=(~(get by stable-id) id)  `this
    ?:  (~(has in open-describes) u.token)
      ::  when the confirmation comes back we'll send the fact
      `this
    =/  url  (cat 3 vic u.token)
    :_  this
    ~[[%give %fact ~ %json !>(s+url)]]
  ==
::
++  on-leave  on-leave:def
++  on-peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  =/  any  ?(%v0 %v1)
  =?  +.pole  !?=([any *] +.pole)
    [%v0 +.pole]
  ?+  pole  [~ ~]
    [%x any %service ~]  ``noun+!>(vic)
    [%x any %bait ~]  ``reel-bait+!>([vic civ])
  ::
      [%x %v0 %outstanding-poke ship=@ name=@ ~]
    =/  has  (~(has in open-link-requests) [(slav %p ship.pole) name.pole])
    ``json+!>([%b has])
  ::
      [%x %v1 %metadata ship=@ name=@ ~]
    =/  id  (rap 3 ship.pole '/' name.pole ~)
    =/  token  (~(get by stable-id) id)
    ?~  token  [~ ~]
    =/  =metadata:reel  (fall (~(get by our-metadata) u.token) *metadata:reel)
    ``reel-metadata+!>(metadata)
  ::
      [%x %v0 %metadata name=@ ~]
    ::  old style tokens are directly in metadata
    =/  id  (rap 3 (scot %p our.bowl) '/' name.pole ~)
    =/  =metadata:reel  (fall (~(get by our-metadata) id) *metadata:reel)
    ``reel-metadata+!>(metadata)
  ::
      [%x any %token-url token=*]
    =/  =token:reel  (crip +:(spud token.pole))
    =/  url  (url-for-token vic token)
    ``json+!>(s+url)
  ::
      [%x %v1 %id-url id=*]
    =/  id  (crip +:(spud id.pole))
    ?~  token=(~(get by stable-id) id)
      ``json+!>(s+'')
    =/  url  (cat 3 vic u.token)
    ``json+!>(s+url)
  ==
++  on-arvo
  |=  [=wire =sign-arvo]
  ^-  (quip card:agent:gall _this)
  ?+  wire  (on-arvo:def wire sign-arvo)
      [%set-ship ~]
    ?>  ?=([%khan %arow *] sign-arvo)
    ?:  ?=(%.n -.p.sign-arvo)
      %-  (tell:log %warn ~['fetch bait ship failed'] ~)
      `this
    `this
  ::
      [%expire @ @ ~]
    ?+  sign-arvo  (on-arvo:def wire sign-arvo)
        [%behn %wake *]
      =/  target  (slav %p i.t.wire)
      =/  group   i.t.t.wire
      ?~  error.sign-arvo
        :_  this(open-link-requests (~(del in open-link-requests) [target group]))
        =/  path  (welp /token-link t.wire)
        ~[[%give %kick ~[path] ~]]
      (on-arvo:def wire sign-arvo)
    ==
  ::
      [%~.~ %retry rest=*]
    =^  caz=(list card)  subs
      (~(handle-wakeup s [subs bowl]) wire)
    [caz this]
  ::
      ::
      ::  trigger invites profile update
      [%load %profile ~]
    =/  profile
      .^(contact:t %gx /(scot %p our.bowl)/contacts/(scot %da now.bowl)/v1/self/contact-1)
    (on-agent /contacts %fact contact-response-0+!>([%self profile]))
  ==
++  on-fail
  |=  [=term =tang]
  ^-  (quip card _this)
  %-  (fail:log term tang)
  `this
--

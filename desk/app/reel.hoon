::  reel: lure invites, end to end
::
::    one agent for the three lure roles that used to be split across
::    %reel, %grouper and %bait:
::
::    create  (was %reel)     register invite links with the provider and
::                            keep their metadata in sync with our profile
::                            and our groups.
::    redeem  (was %grouper)  when the provider tells us someone used one of
::                            our links (a "bite"), DM them and, for group
::                            links, invite them to the group.
::    serve   (was %bait)     on the provider ship only: mint tokens, serve
::                            /lure landing pages, and route bites back to
::                            the inviter.
::
::    the cross-ship protocol is unchanged. remote ships address these roles
::    by agent name, so %grouper and %bait remain in the bill as forwarders
::    that hand remote pokes to us with the original sender attached (see
::    the %forward noun poke). we keep poking [civ %bait] and
::    [ship %grouper] for the same reason: those names answer on every desk
::    version, old and new. see docs/backend/desk/app/reel.md.
::
/-  reel, groups-ver, c=chat, cv=chat-ver, ch=channels, story
/+  default-agent, verb, dbug, logs, server, *reel, s=subscriber,
    t=contacts, gj=groups-json
/=  ted-branch-update  /ted/branch-update
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
      state-7
      state-8
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
+$  state-7
  $:  %7
      vic=@t
      civ=ship
      our-profile=contact:t
      our-metadata=(map token:reel metadata:v1:reel)
      open-link-requests=(set (pair ship cord))
      ::
      :: outstanding describes. true when metadata had been modified.
      open-describes=(map token:reel ?)
      stable-id=(map cord token:reel)
      =^subs:s
  ==
::  state-8 adds the redeem and serve roles.
::
::  enabled-groups: our groups that accept lure joiners (was %grouper)
::  open-asks: outstanding remote "is this group enabled?" questions
::  served: token -> metadata for links we serve as provider (was %bait)
::  served-ids: group id -> tokens, to update every link for a group
::  branch-secret: branch.io key used by the branch-update thread
::
+$  state-8
  $:  %8
      vic=@t
      civ=ship
      our-profile=contact:t
      our-metadata=(map token:reel metadata:v1:reel)
      open-link-requests=(set (pair ship cord))
      open-describes=(map token:reel ?)
      stable-id=(map cord token:reel)
      =^subs:s
    ::
      enabled-groups=(set cord)
      open-asks=(set (pair ship cord))
    ::
      served=(map token:reel metadata:v1:reel)
      served-ids=(jug cord token:reel)
      branch-secret=@t
  ==
::
::  url with old style token
++  url-for-token
  |=  [vic=cord token=cord]
  (cat 3 vic token)
::  +forwardable: marks %grouper and %bait may hand us from a remote ship
::
++  forwardable
  $?  %grouper-ask-enabled
      %grouper-answer-enabled
      %bait-describe
      %bait-undescribe
      %bait-update
      %bait-update-group
  ==
::
++  landing-page
  |=  =metadata:reel
  ^-  manx
  =/  description
    ?.  =(tag.metadata 'groups-0')  ""
    (trip (~(got by fields.metadata) %'invitedGroupDescription'))
  ;html
    ;head
      ;title:"Lure"
    ==
    ;body
      ;p: {description}
      Enter your @p:
      ;form(method "post")
        ;input(type "text", name "ship", id "ship", placeholder "~sampel");
        ;button(type "submit"):"Request invite"
      ==
      ;script: ship = document.cookie.split("; ").find((row) => row.startsWith("ship="))?.split("=")[1]; document.getElementById("ship").value=(ship || "~sampel-palnet")
    ==
  ==
::
++  sent-page
  |=  invitee=ship
  ^-  manx
  ;html
    ;head
      ;title:"Lure"
    ==
    ;body
      Your invite has been sent!  Go to your ship to accept it.
      ;script: document.cookie="ship={(trip (scot %p invitee))}"
    ==
  ==
--
=|  state-8
=*  state  -
::
%-  agent:dbug
%^  verb  |  %warn
=>
|%
::  |l: logs core
::
++  l
  |_  [=bowl:gall =log-data:logs]
  ++  fail
    |=  [vol=volume:logs =echo:logs =tang]
    %-  link
    (~(fail logs bowl /logs) vol echo tang log-data)
  ::
  ++  tell
    |=  [vol=volume:logs =echo:logs =log-data:logs]
    %-  link
    (~(tell logs bowl /logs) vol echo (weld ^log-data log-data))
  ++  link
    |=  cad=card
    |*  [caz=(list card) etc=*]
    [[cad caz] etc]
  --
::  +group-og-title: render the open-graph title for a group invite.
::  empty group title falls back to "a Groupchat".
::
++  group-og-title
  |=  [nickname=(unit @t) group-title=@t]
  ^-  @t
  =/  title=@t
    ?:  =('' group-title)  'a Groupchat'
    group-title
  %-  crip
  ?:  |(?=(~ nickname) =('' u.nickname))
    "Tlon Messenger: You're Invited to {(trip title)}"
  "Tlon Messenger: {(trip u.nickname)} invited you to {(trip title)}"
::  +branch-card: refresh a served link's branch.io metadata
::
++  branch-card
  |=  [=bowl:gall =token:reel update=metadata:reel]
  ^-  card
  =/  fard=(fyrd:khan cage)
    [q.byk.bowl %branch-update noun+!>(`[token update])]
  [%pass /branch/[token] %arvo %k %fard fard]
::  +redeem: act on a bite for one of our links
::
::    DM the joiner and, for group links, invite them to the group if we
::    enabled lure joins for it. this is what %grouper did when it heard
::    a bite on our /bites path.
::
++  redeem
  |=  [=bowl:gall enabled=(set cord) =bite:reel]
  ^-  (list card)
  ?.  ?=([%bite-2 *] bite)
    =+  log=~(. l bowl 'flow'^s+'lure' ~)
    =<  -
    %.  [*(list card) ~]
    %^  tell:log  %warn
      ~[leaf+"ignoring legacy {<-.bite>}"]
    ~['event'^s+'Legacy Bite Ignored']
  =+  log=~(. l bowl 'flow'^s+'lure' 'lure-id'^s+token.bite 'lure-joiner'^s+(scot %p joiner.bite) ~)
  =>
    |%
    ++  note
      |=  [caz=(list card) =volume:logs event=@t =echo:logs]
      ^-  (list card)
      =<  -
      %.  [caz ~]
      (tell:log volume echo ~['event'^s+event])
    --
  =/  caz=(list card)
    ?~  inviter=(~(get by fields.metadata.bite) %'inviterUserId')
      (note ~ %error 'DM Invite Fail' ~['inviter field missing in lure bite'])
    ?.  =((slav %p u.inviter) our.bowl)
      (note ~ %error 'DM Invite Fail' ~[leaf+"inviter {<u.inviter>} is foreign"])
    =/  =id:c  [our now]:bowl
    =/  =memo:ch
      [~[[%inline ~[[%ship joiner.bite] ' has joined the network']]] id]
    =/  =action:dm:v7:cv
      :-  joiner.bite
      [id %add %*(. *essay:ch - memo, kind [%chat %notice ~]) ~]
    =/  =wire  /dm/(scot %p joiner.bite)/[token.bite]
    [%pass wire %agent [our.bowl %chat] %poke chat-dm-action-2+!>(action)]~
  =+  invite-type=(~(get by fields.metadata.bite) %'inviteType')
  ::  don't send group invite if this is a personal bite
  ::
  ?:  &(?=(^ invite-type) =('user' u.invite-type))
    caz
  =*  fail  'Group Invite Fail'
  ?~  group=(~(get by fields.metadata.bite) %'invitedGroupId')
    (note caz %warn fail 'group field missing' ~)
  =/  =flag:groups-ver  (flag:dejs:gj s+u.group)
  ?.  (~(has in enabled) q.flag)
    %:  note  caz  %warn  fail
      ~[leaf+"invites for group {<p.flag>}/{(trip q.flag)} not enabled"]
    ==
  ::  %tlon is the production desk.  Keep legacy desks as fallbacks for
  ::  ships that have not yet completed the desk migration (including Aqua).
  =/  tlon-prefix  /(scot %p our.bowl)/tlon/(scot %da now.bowl)
  =/  groups-prefix  /(scot %p our.bowl)/groups/(scot %da now.bowl)
  =/  prefix
    ?:  .^(? %gu (weld tlon-prefix /$))
      tlon-prefix
    ?:  .^(? %gu (weld groups-prefix /$))
      groups-prefix
    /(scot %p our.bowl)/base/(scot %da now.bowl)
  ?.  .^(? %gu (weld prefix /$))
    (note caz %warn fail '%groups not running' ~)
  ?.  .^(? %gu (weld prefix /groups/(scot %p p.flag)/[q.flag]))
    %:  note  caz  %warn  fail
      ~[leaf+"group {<p.flag>}/{(trip q.flag)} missing"]
    ==
  =/  =a-groups:v8:groups-ver
    =/  note=story:story
      ~[inline+~[(crip "lure invite {<token.bite>}")]]
    [%invite flag (sy joiner.bite ~) [~ `note]]
  =/  invite=card
    [%pass /invite %agent [our.bowl %groups] %poke group-action-4+!>(a-groups)]
  %:  note  [invite caz]  %info  'Group Invite Sent'
    ~[leaf+"{<joiner.bite>} invited to group {<p.flag>}/{(trip q.flag)}"]
  ==
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
      [%pass /eyre/connect %arvo %e %connect [~ /lure] dap.bowl]
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
  =?  old  ?=(%6 -.old)
    %=  old  -  %7
        open-describes
      %-  ~(gas by *(map token:reel ?))
      ^-  (list (pair token:reel ?))
      (turn ~(tap in open-describes.old) (late &))  ::  force sync on open describes
    ==
  ::  v7 -> v8: absorb %grouper and %bait. their state arrives by %import
  ::  pokes from their forwarders' on-load. take over the eyre bindings
  ::  %bait held in a later event: scrying eyre here would make the load
  ::  depend on eyre's state.
  ::
  =^  cuz=(list card)  old
    ?.  ?=(%7 -.old)  `old
    :_  :*  %8
            vic.old
            civ.old
            our-profile.old
            our-metadata.old
            open-link-requests.old
            open-describes.old
            stable-id.old
            subs.old
            ~  ~  ~  ~  ''
        ==
    :~  [%pass /eyre/connect %arvo %e %connect [~ /lure] dap.bowl]
        [%pass /takeover %arvo %b %wait now.bowl]
    ==
  ?>  ?=(%8 -.old)
  =.  state  old
  :_  this
  ;:  weld
    caz
    cuz
  ::
    %-  murn  :_  same
    ^-  (list (unit card))
    :~  ?:  (~(has by wex.bowl) /groups [our.bowl %groups])  ~
        `[%pass /groups %agent [our.bowl %groups] %watch groups-path]
      ::
        ?:  (~(has by wex.bowl) /contacts [our.bowl %contacts])  ~
        `[%pass /contacts %agent [our.bowl %contacts] %watch contacts-path]
    ==
  ==
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+    mark  (on-poke:def mark vase)
      %noun
    ?>  =(our.bowl src.bowl)
    ?+    q.vase  (on-poke:def mark vase)
        [%branch-secret @t]
      `this(branch-secret ;;(@t +.q.vase))
    ::
    ::  a remote poke handed over by the %grouper or %bait forwarder;
    ::  handle it as if .from had poked us directly.
    ::
        [%forward *]
      =+  !<([%forward from=ship =cage] vase)
      ?>  ?=(forwardable p.cage)
      (on-poke:this(src.bowl from) cage)
    ::
        [%import-grouper *]
      =+  ;;  $:  %import-grouper
                  enabled=(set cord)
                  asks=(set (pair ship cord))
              ==
          q.vase
      :-  ~
      %=  this
        enabled-groups  (~(uni in enabled-groups) enabled)
        open-asks       (~(uni in open-asks) asks)
      ==
    ::
        [%import-bait *]
      =+  ;;  $:  %import-bait
                  tokens=(map token:reel metadata:reel)
                  ids=(jug cord token:reel)
                  secret=@t
              ==
          q.vase
      :-  ~
      %=  this
        served         (~(uni by served) tokens)
        served-ids     (~(uni by served-ids) ids)
        branch-secret  ?:(=('' secret) branch-secret secret)
      ==
    ==
  ::
  ::  create
  ::
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
      =/  opens
        %-  ~(gas by *(map token:reel ?))
        ^-  (list (pair token:reel ?))
        (turn ~(tap in ~(key by our-metadata)) (late |))
      :_  this(civ civ.command, open-describes opens)
      %+  turn  ~(tap by our-metadata)
      |=  [token=cord =metadata:reel]
      ^-  card
      [%pass /bait %agent [civ %bait] %poke %bait-describe !>([token metadata])]
    ==
  ::
      %reel-bite
    ?>  =(civ src.bowl)
    =+  !<(=bite:reel vase)
    :_  this
    [[%give %fact ~[/bites] mark !>(bite)] (redeem bowl enabled-groups bite)]
  ::
      %reel-describe
    ?>  =(our.bowl src.bowl)
    =+  !<([id=cord =metadata:v1:reel] vase)
    =/  old-token  (~(get by stable-id) id)
    =.  fields.metadata
      %-  ~(gas by fields.metadata)
      :~  [%'bite-type' '2']
          [%'inviterUserId' (scot %p src.bowl)]
          [%'invitedGroupId' id]
      ==
    ::  gap-fill open-graph metadata from server state when the caller
    ::  didn't provide it: title / description / image from %groups,
    ::  and nickname / avatar from our cached profile. caller-provided
    ::  values take priority.
    ::
    =/  type=(unit @t)  (~(get by fields.metadata) %'inviteType')
    =?  fields.metadata  |(?=(~ type) =('group' u.type))
      =*  fields  fields.metadata
      ::  treat absent or empty-string fields as gap-fillable
      ::
      =*  is-blank
        |=  k=field:reel
        ^-  ?
        =/  v  (~(get by fields) k)
        ?|(?=(~ v) =('' u.v))
      ::  inviter fields from our-profile
      ::
      =/  nickname=(unit @t)  (~(get cy:t our-profile) %nickname %text)
      =/  avatar=(unit @t)    (~(get cy:t our-profile) %avatar %look)
      =?  fields
          ?&  ?=(^ nickname)
              !=('' u.nickname)
              (is-blank %'inviterNickname')
          ==
        (~(put by fields) %'inviterNickname' u.nickname)
      =?  fields
          ?&  ?=(^ avatar)
              !=('' u.avatar)
              (is-blank %'inviterAvatarImage')
          ==
        (~(put by fields) %'inviterAvatarImage' u.avatar)
      ::  group meta from %groups; only attempt when id parses as a flag
      ::  and the group exists locally.
      ::
      ?~  parsed=(rush id flag)  fields
      =/  base  /(scot %p our.bowl)/groups/(scot %da now.bowl)
      ?.  .^(? %gu (weld base /groups/(scot %p -.u.parsed)/[+.u.parsed]))
        fields
      =/  grp=group:v9:groups-ver
        .^  group:v9:groups-ver  %gx
          (weld base /v2/groups/(scot %p -.u.parsed)/[+.u.parsed]/group-2)
        ==
      =*  meta  meta.grp
      =?  fields
          ?&  !=('' title.meta)
              (is-blank %'invitedGroupTitle')
          ==
        (~(put by fields) %'invitedGroupTitle' title.meta)
      =?  fields
          ?&  !=('' description.meta)
              (is-blank %'invitedGroupDescription')
          ==
        (~(put by fields) %'invitedGroupDescription' description.meta)
      =?  fields
          ?&  !=('' image.meta)
              (is-blank %'invitedGroupIconImageUrl')
          ==
        (~(put by fields) %'invitedGroupIconImageUrl' image.meta)
      fields
    ::  the nonce here is a temporary identifier for the metadata.
    ::  a new one will be assigned by the bait provider and returned to us.
    ::
    =/  =nonce:reel  (scot %da now.bowl)
    ::  delete old metadata if we have an existing token for this id
    =?  our-metadata  ?=(^ old-token)
      (~(del by our-metadata) u.old-token)
    =.  our-metadata  (~(put by our-metadata) nonce metadata)
    =.  open-describes  (~(put by open-describes) nonce |)
    =.  stable-id  (~(put by stable-id) id nonce)
    :_  this
    ~[[%pass /bait %agent [civ %bait] %poke %bait-describe !>([nonce metadata])]]
  ::
      %reel-confirmation
    ?>  =(civ src.bowl)
    =+  !<(confirmation:reel vase)
    =+  log=~(. l bowl 'flow'^s+'lure' ~)
    =/  sync=?  (~(gut by open-describes) nonce |)
    =.  open-describes  (~(del by open-describes) nonce)
    =/  ids=(list [id=cord =token:reel])
      %+  skim  ~(tap by stable-id)
      |=  [key=cord =token:reel]
      =(nonce token)
    ?~  ids
      %-  %^  tell:log  %warn
            ~[leaf+"no stable id found for nonce {<nonce>}"]
          ~['event'^s+'Nonce Revoked']
      `this
    =*  id  -<.ids
    ?~  md=(~(get by our-metadata) nonce)
      %-  %^  tell:log  %error
            ~[leaf+"no metadata for nonce {<nonce>}"]
          ~['event'^s+'Invite Creation Failed']
      `this
    ::  update the token the id points to
    =.  stable-id  (~(put by stable-id) id token)
    %-  %^  tell:log  %info
          ~[leaf+"invite link for {(trip id)} created"]
        ~['event'^s+'Invite Link Created' 'lure-id'^s+token]
    :_  %_  this  our-metadata
          (~(put by (~(del by our-metadata) nonce)) token u.md)
        ==
    =/  url  (cat 3 vic token)
    =/  path  (stab (cat 3 '/v1/id-link/' id))
    ?.  sync
      [%give %fact ~[path] %json !>(s+url)]~
    :~  [%pass /bait %agent [civ %bait] %poke bait-update+!>([token u.md])]
        [%give %fact ~[path] %json !>(s+url)]
    ==
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
    ~[[%pass /bait %agent [civ %bait] %poke %bait-undescribe !>(token)]]
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
  ::
  ::  redeem
  ::
      %grouper-enable
    ?>  =(our.bowl src.bowl)
    =+  !<(name=cord vase)
    `this(enabled-groups (~(put in enabled-groups) name))
  ::
      %grouper-disable
    ?>  =(our.bowl src.bowl)
    =+  !<(name=cord vase)
    `this(enabled-groups (~(del in enabled-groups) name))
  ::
      %grouper-ask-enabled
    =+  !<(name=cord vase)
    =/  enabled  (~(has in enabled-groups) name)
    :_  this
    =/  =cage  grouper-answer-enabled+!>([name enabled])
    ~[[%pass [%ask name ~] %agent [src.bowl %grouper] %poke cage]]
  ::
      %grouper-answer-enabled
    =/  [name=cord enabled=?]  !<([cord ?] vase)
    :-  ~[[%give %fact ~[[%group-enabled (scot %p src.bowl) name ~]] %json !>(b+enabled)]]
    ?:  enabled
      this(enabled-groups (~(put in enabled-groups) name))
    this(enabled-groups (~(del in enabled-groups) name))
  ::
      %grouper-check-link
    ?>  =(our.bowl src.bowl)
    =+  !<(=(pole knot) vase)
    ?>  ?=([%check-link rest=*] pole)
    ::  it really is necessary to double-encode this, make sure we strip
    ::  the leading slash before encoding
    =/  end  (en-urlt:html (en-urlt:html +:(spud rest.pole)))
    =/  url
      ?.  =(vic 'https://tlon.network/lure/')
        (crip "{(trip vic)}{end}")
      (crip "https://tlon.network/v1/policies/lure/{end}")
    :_  this
    :~  :*  %pass  pole
          %arvo  %k  %fard
          q.byk.bowl  %lure-check-link  %noun
          !>(`[url pole])
        ==
    ==
  ::
      %grouper-link-checked
    ?>  =(our.bowl src.bowl)
    =+  !<([good=? =path] vase)
    :_  this
    ~[[%give %fact ~[path] %json !>(b+good)]]
  ::
  ::  serve
  ::
      %handle-http-request
    =+  !<([id=@ta inbound-request:eyre] vase)
    |^
    =/  full-line=request-line:server  (parse-request-line:server url.request)
    =/  line
      ?:  ?=([%lure @ *] site.full-line)
        t.site.full-line
      ?:  ?=([@ @ *] site.full-line)
        site.full-line
      !!
    ?+    method.request  [(give not-found:gen:server) this]
      %'GET'  [(get-request line) this]
    ::
        %'OPTIONS'
      :_  this
      %-  give
      =;  =header-list:http
        [[204 header-list] ~]
      :~  :-  'access-control-allow-methods'
          =-  (fall - '*')
          (get-header:http 'access-control-request-method' header-list.request)
        ::
          :-  'access-control-allow-headers'
          =-  (fall - '*')
          (get-header:http 'access-control-request-headers' header-list.request)
      ==
    ::
        %'POST'
      =*  log  ~(. l bowl 'flow'^s+'lure' ~)
      ?~  body.request
        %-  %^  tell:log  %error
              ~['POST request body not found']
            ~['event'^s+'Lure POST Fail']
        :_  this
        (give (not-found 'body not found'))
      ?.  =('ship=%7E' (end [3 8] q.u.body.request))
        %-  %^  tell:log  %error
              ~['ship not found in POST body']
            ~['event'^s+'Lure POST Fail']
        :_  this
        (give (not-found 'ship not found in body'))
      =/  joiner=@p  (slav %p (cat 3 '~' (rsh [3 8] q.u.body.request)))
      ::
      =/  token
        ?~  ext.full-line  i.line
        (crip "{(trip i.line)}.{(trip u.ext.full-line)}")
      =*  log  ~(. l bowl 'flow'^s+'lure' 'lure-id'^s+token 'lure-joiner'^s+(scot %p joiner) ~)
      =;  [bite=(unit bite:reel) inviter=(unit ship)]
        ?~  bite
          %-  %^  tell:log  %error  ~[leaf+"invite token {<token>} not found"]
              ~['event'^s+'Invite Token Missing']
          :_  this
          (give (not-found 'invite token not found'))
        ?~  inviter
          %-  %^  tell:log  %error  ~['inviter not found']
              ~['event'^s+'Inviter Not Found']
          :_  this
          (give (not-found 'inviter not found'))
        %-  %^  tell:log  %info  ~[leaf+"{<joiner>} redeemed lure invite from {<u.inviter>}"]
            ~['event'^s+'Invite Redeemed']
        :_  this
        ^-  (list card)
        :*  :*  %pass  /bite  %agent  [u.inviter %reel]
                %poke  %reel-bite  !>(u.bite)
            ==
          (give (manx-response:gen:server (sent-page joiner)))
        ==
      ?:  ?=([@ @ ~] line)
        =/  inviter  (slav %p i.line)
        =/  old-token  i.t.line
        :_  `inviter
        `[%bite-1 old-token joiner inviter]
      =/  =metadata:reel  (~(gut by served) token *metadata:reel)
      ?~  type=(~(get by fields.metadata) %'bite-type')
        [~ ~]
      ?>  =('2' u.type)
      :-  `[%bite-2 token joiner metadata]
      ?~  inviter-field=(~(get by fields.metadata) %'inviterUserId')
        ~
      `(slav %p u.inviter-field)
    ==
    ++  get-request
      |=  =(pole knot)
      ^-  (list card)
      %-  give
      ?+  pole  not-found:gen:server
          [%bait %who ~]
        (json-response:gen:server s+(scot %p our.bowl))
      ::
          [ship=@ name=@ %metadata ~]
        =/  token  (crip "{(trip ship.pole)}/{(trip name.pole)}")
        ?~  meta=(~(get by served) token)
          (not-found 'Associated group token not found')
        (json-response:gen:server (enjs-metadata u.meta))
      ::
          [token=@ %metadata ~]
        ?~  meta=(~(get by served) token.pole)
          (not-found 'Token not found')
        (json-response:gen:server (enjs-metadata u.meta))
      ::
          [token=* ~]
        =/  token  (crip (join '/' pole))
        ?~  meta=(~(get by served) token)
          (not-found 'Token not found')
        (manx-response:gen:server (landing-page u.meta))
      ==
    ::
    ++  allow
      |=  simple-payload:http
      ^-  simple-payload:http
      :_  data
      :-  status-code.response-header
      [['access-control-allow-origin' '*'] headers.response-header]
    ++  not-found
      |=  body=cord
      [[404 ~] `(as-octs:mimes:html body)]
    ++  give
      |=  =simple-payload:http
      (give-simple-payload:app:server id (allow simple-payload))
    --
  ::
      %bait-describe
    =+  !<([=nonce:reel =metadata:reel] vase)
    =/  =token:reel  (scot %uv (end [3 16] eny.bowl))
    ::  record the token metadata and add the token to the served-ids set
    ::  if the group field exists.
    ::
    =.  served  (~(put by served) token metadata)
    =+  id=(~(get by fields.metadata) %'invitedGroupId')
    =?  served-ids  &(?=(^ id) !=(u.id '~zod/personal-invite-link'))
      (~(put ju served-ids) u.id token)
    :_  this
    =/  =cage  reel-confirmation+!>([nonce token])
    ~[[%pass /confirm/[nonce] %agent [src.bowl %reel] %poke cage]]
  ::
      %bait-undescribe
    =+  !<(token=cord vase)
    =+  metadata=(~(get by served) token)
    =.  served  (~(del by served) token)
    =?  served-ids  ?=(^ metadata)
      ?~  id=(~(get by fields.u.metadata) %'invitedGroupId')
        served-ids
      (~(del ju served-ids) u.id token)
    `this
  ::
      ::  update an invite by token
      ::
      %bait-update
    =+  !<([=token:reel update=metadata:reel] vase)
    ?.  (~(has by served) token)
      `this
    =.  served
      %+  ~(jab by served)  token
      |=  =metadata:reel
      metadata(fields (~(uni by fields.metadata) fields.update))
    [~[(branch-card bowl token update)] this]
  ::
      ::  update invites associated with a group
      ::
      %bait-update-group
    =+  !<([=flag:groups-ver update=metadata:reel] vase)
    =+  id=(rap 3 (scot %p p.flag) '/' q.flag ~)
    ::  only the group host is allowed to update associated invites
    ?.  =(p.flag src.bowl)
      `this
    =/  tokens  ~(tap in (~(get ju served-ids) id))
    =.  served
      %+  roll  tokens
      |=  [=token:reel =_served]
      ?~  metadata=(~(get by served) token)
        served
      %+  ~(put by served)  token
      u.metadata(fields (~(uni by fields.u.metadata) fields.update))
    :_  this
    %+  roll  tokens
    |=  [=token:reel caz=(list card)]
    ?.  (~(has by served) token)  caz
    [(branch-card bowl token update) caz]
  ::
      %bind-slash
    ?>  =(our.bowl src.bowl)
    :_  this
    ~[[%pass /eyre/connect %arvo %e %connect [~ /] dap.bowl]]
  ::
      %unbind-slash
    ?>  =(our.bowl src.bowl)
    :_  this
    ~[[%pass /eyre/connect %arvo %e %connect [~ /] %docket]]
  ==
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  =/  =(pole knot)  wire
  ?+    pole  (on-agent:def wire sign)
      [%update ?(%contact %profile) ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  `this
    %-  (fail:log %error ~['profile update failed'] u.p.sign)
    `this
  ::
      [%bait ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  `this
    %-  (fail:log %error ~['bait operation failed'] u.p.sign)
    `this
  ::
      [%dm joiner=@ token=@ ~]
    ?>  ?=(%poke-ack -.sign)
    =+  log=~(. l bowl 'flow'^s+'lure' 'lure-id'^s+token.pole 'lure-joiner'^s+joiner.pole ~)
    ?~  p.sign
      %-  %^  tell:log  %info
            ~[leaf+"{(trip joiner.pole)} invited to DM"]
          ~['event'^s+'DM Invite Sent']
      `this
    %-  (fail:log %error ~['DM invite failed'] u.p.sign)
    `this
  ::
      [%group-enabled @ name=@ ~]
    ?.  ?=(%poke-ack -.sign)  (on-agent:def wire sign)
    `this(open-asks (~(del in open-asks) [src.bowl name.pole]))
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
      %-  (fail:log %error ~['failed to subscribe to contacts'] u.p.sign)
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
      =*  token-update  ,[token:reel metadata:reel]
      =^  updates=(list token-update)  our-metadata
        %+  ~(rib by our-metadata)  *(list token-update)
        |=  [[=token:reel meta=metadata:reel] ups=(list token-update)]
        ^-  [(list token-update) [token:reel metadata:reel]]
        =;  new-update=_update
          :_  :-  token
              meta(fields (~(uni by fields.meta) fields.new-update))
          :_  ups
          [token new-update]
        ::  insert open-graph metadata into update
        ::
        =+  type=(~(get by fields.meta) %'inviteType')
        ?:  |(?=(~ type) =('group' u.type))
          =/  title=@t
            %+  group-og-title  nickname
            (fall (~(get by fields.meta) %'invitedGroupTitle') '')
          =.  fields.update
            (~(put by fields.update) %'$og_title' title)
          =.  fields.update
            (~(put by fields.update) %'$twitter_title' title)
          update
        ?:  =('user' u.type)
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
        ::  unknown invite type, ignore
        update
      =^  caz=(list card)  open-describes
        %+  roll  updates
        |=  [[=token:reel update=metadata:reel] caz=(list card) =_open-describes]
        =/  cad=card
          [%pass /bait %agent [civ %bait] %poke bait-update+!>([token update])]
        :-  [cad caz]
        ?.  (~(has by ^open-describes) token)
          open-describes
        (~(put by open-describes) token &)
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
      %-  (fail:log %error ~['failed to subscribe to groups'] u.p.sign)
      `this
    ::
        %fact
      =+  !<(=r-groups:v9:groups-ver q.cage.sign)
      =*  flag  flag.r-groups
      =+  id=(rap 3 (scot %p p.flag) '/' q.flag ~)
      =+  token=(~(get by stable-id) id)
      =|  update=metadata:reel
      =.  tag.update  'groups-0'
      =.  fields.update
        ?+    -.r-group.r-groups  ~
            %meta
          =*  meta  meta.r-group.r-groups
          =/  title=@t
            %-  group-og-title
            [(~(get cy:t our-profile) %nickname %text) title.meta]
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
      ?.  =(p.flag our.bowl)
        `this
      :_  this
      [%pass /bait %agent [civ %bait] %poke bait-update-group+!>([flag update])]~
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
  ::  serve: eyre's response channel for /lure requests. eyre subscribes
  ::  as the request's session identity, a guest for public lure pages,
  ::  so this comes before the ownership check.
  ::
  ?:  ?=([%http-response *] pole)  `this
  ?>  =(our.bowl src.bowl)
  ::  redeem: ask another ship whether lure joins are enabled for a group
  ::
  ?:  ?=([%group-enabled ship=@ name=@ ~] pole)
    =/  target  (slav %p ship.pole)
    =/  key  [target name.pole]
    ?:  (~(has in open-asks) key)  `this
    :_  this(open-asks (~(put in open-asks) key))
    =/  =cage  grouper-ask-enabled+!>(name.pole)
    :~  [%pass pole %agent [target %grouper] %poke cage]
        [%pass /ask-expire/[ship.pole]/[name.pole] %arvo %b [%wait (add ~h1 now.bowl)]]
    ==
  ?:  ?=([%check-link @ @ ~] pole)
    :_  this
    ~[[%pass pole %agent [our dap]:bowl %poke %grouper-check-link !>(`path`pole)]]
  ?:  ?=([%v1 %check-link url=@ ~] pole)
    =/  url  (slav %t url.pole)
    :_  this
    :~  :*  %pass  pole
          %arvo  %k  %fard
          q.byk.bowl  %lure-check-link  %noun
          !>(`[url `path`pole])
        ==
    ==
  ::  create
  ::
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
    ?:  (~(has by open-describes) u.token)
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
  ::  redeem
  ::
      [%x %v1 %enabled name=@ ~]
    ``json+!>([%b (~(has in enabled-groups) name.pole)])
  ::  serve
  ::
      [%x %v1 %served ~]
    ``noun+!>(served)
  ::
      [%x %v1 %served token=@ ~]
    ?~  meta=(~(get by served) token.pole)
      [~ ~]
    ``noun+!>(u.meta)
  ::
      [%x %v1 %branch-secret ~]
    ``noun+!>(branch-secret)
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
      [%ask-expire @ @ ~]
    ?>  ?=([%behn %wake *] sign-arvo)
    =/  target  (slav %p i.t.wire)
    `this(open-asks (~(del in open-asks) [target i.t.t.wire]))
  ::
      ::  lure-check-link reports by poking us; nothing to do on completion
      ::
      ?([%check-link *] [%v1 %check-link *])
    ?>  ?=([%khan %arow *] sign-arvo)
    ?:  ?=(%& -.p.sign-arvo)  `this
    %-  (fail:log %warn ~['lure link check failed'] tang.p.p.sign-arvo)
    `this
  ::
      [%branch token=@ ~]
    ?>  ?=([%khan %arow *] sign-arvo)
    ?:  ?=(%& -.p.sign-arvo)  `this
    =*  token  i.t.wire
    =*  goof  p.p.sign-arvo
    =+  log=~(. l bowl 'flow'^s+'lure' ~)
    %-  (fail:log %error ~['failed to update lure invite branch metadata' token mote.goof] tang.goof)
    `this
  ::
      [%eyre %connect ~]
    ?>  ?=([%eyre %bound *] sign-arvo)
    ~?  !accepted.sign-arvo
      [dap.bowl 'eyre bind rejected!' binding.sign-arvo]
    `this
  ::
      ::  take over every eyre binding %bait held, so /lure (and / on a
      ::  provider) reach us. eyre replaces a binding when another agent
      ::  connects the same path.
      ::
      [%takeover ~]
    ?>  ?=([%behn %wake *] sign-arvo)
    =/  bindings=(list [binding:eyre duct action:eyre])
      .^((list [binding:eyre duct action:eyre]) %e (scot %p our.bowl) %bindings (scot %da now.bowl) ~)
    :_  this
    %+  murn  bindings
    |=  [=binding:eyre * =action:eyre]
    ?.  ?=([%app %bait] action)  ~
    `[%pass /eyre/connect %arvo %e %connect binding dap.bowl]
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
  :_  this
  [(~(on-fail logs bowl /logs) term tang)]~
--

/-  meta, e=epic, s=story
|%
::  $flag: id for a group
::
+$  flag  (pair ship term)
::
::  $nest: id for a channel, {app}/{ship}/{name}
::TODO with custom channels, should $nest in %channels
::     should be relaxed
::
+$  nest  (pair term flag)
::  $section-id: section id
::
+$  section-id  term
::  $section: channel section metadata
::
+$  section
  $:  meta=data:meta
      order=(list nest)
  ==
::  $seat: group membership (formerly $vessel)
::
::  .roles: set of roles assigned to a seat
::  .joined: time the ship joined TODO rename to time
::
+$  seat
  $:  roles=(set role-id)
      joined=time
  ==
::  $role-id: group member role
::
+$  role-id  term
::  $role-meta: role metadata
::
+$  role  [meta=data:meta ~]
::  $admins: set of privileged roles
::
::    roles in this set are allowed to make modifications to the group
::    and its various metadata and permissions
::
+$  admins  (set role-id)
::  $channel-preview: channel preview
::
::  .nest: channel id
::  .meta: channel metadata
::  .preview: group preview
::
+$  channel-preview
  $:  =nest
      meta=data:meta
      =preview
  ==
::  $channel: a collection of metadata about a channel
::
::  .meta: channel description
::  .added: time channel was added
::  .section: channel section
::  .readers: roles with read permissions. empty set
::            means the channel is accessible by everyone.
::  .join: should the channel be joined by new members
::
+$  channel
  $:  meta=data:meta
      added=time
      section=section-id
      readers=(set role-id)
      join=?
  ==
::  $admissions: group entry policy
::
::  .privacy: determines group visibility
::  .banned: ships and ranks blacklist
::  .requests: entry requests
::  .tokens: access tokens
::  .referrals: token attribution
::  .invited: invited guest list
::
::  sync semantics
::
::  privacy    global
::  banned     global
::  requests   partial
::  tokens     partial. forever and limited tokens
::             are shared between admins, while personal
::             tokens are shared with admins and the requesting ship.
::  referrals  partial
::  invited    local
::
+$  admissions
  $:  =privacy
      =banned
      requests=(map ship (unit story:s))
      tokens=(map token token-meta)
      referrals=(jug ship token)
      invited=(map ship [at=@da token=(unit token)])
  ==
::  $token: group access token
+$  token  @uv
::  $token-meta: token metadata
::
::  .scheme: claim scheme
::  .expiry: expiration date
::  .label: optional label
::
+$  token-meta
  $:  scheme=claim-scheme
      expiry=@da
      label=(unit @t)
      ::TODO add attribution or reverse lookup in admissions
  ==
::  $claim-scheme: token claim scheme
::
::  %forever: unlimited claims
::  %limited: limited number of claims
::  %personal: single claim by the named
::
+$  claim-scheme
  $%  [%forever ~]
      [%limited count=@ud]
      [%personal =ship]
  ==
::  $banned: blacklist
::
+$  banned  [ships=(set ship) ranks=(set rank:title)]
::  $privacy: group privacy
::
::  %public: group is indexed and open to public
::  %private: group is indexed and invite-only
::  %secret: group is hidden and invite-only
::
+$  privacy  ?(%public %private %secret)
::  $invite: group invitation
::
::  .flag: target group
::  .time: time received
::  .token: access token
::  .from: inviter ship
::  .note: letter
::  .preview: group preview
::  .sign: preview host signature
::
::  TODO: group invitation should be attested
::        for by the group host, who should sign
::        the [token from preview] triple.
::
+$  invite
  $:  =flag
      =time
      from=ship
      token=(unit token)
      note=(unit story:s)
      =preview
  ==
::  $progress: group join in progress
::
::  %ask: asking for entry
::  %join: joining with token
::  %watch: waiting for a subscription
::  %done: subscribed to the group
::  %error: error occured
::
+$  progress  ?(%ask %join %watch %done %error)
::  $foreign: view of a foreign group
::
::  .invites: received invites
::  .preview: group preview
::  .progress: join in progress
::  .token: join token
::
+$  foreign
  $:  invites=(list invite)
      preview=(unit preview)
      progress=(unit progress)
      token=(unit token)
  ==
+$  foreigns  (map flag foreign)
::  $group: collection of people and the pathways in which they interact
::
::    group holds all data around members, permissions, channel
::    organization, and its own metadata to represent the group
::
::  .meta: group metadata
::  .admissions: entry policy
::  .seats: members
::  .roles: member roles
::  .admins: administrators
::  .channels: group channels
::  .active-channels: joined channels
::  .sections: channel sections
::  .section-order: sections order
::  .flagged-content: flagged content
::
::  sync semantics
::
::  .meta             global
::  .admissions       partial
::  .seats            global
::  .roles            global
::  .admins           global
::  .channels         global
::  .active-channels  local
::  .sections         global
::  .section-order    global
::  .flagged-content  global
::
+$  group
  $:  meta=data:meta
    ::
      =admissions
      seats=(map ship seat)
    ::
      roles=(map role-id role)
      =admins
    ::
      channels=(map nest channel)
      active-channels=(set nest)
    ::
      sections=(map section-id section)
      section-order=(list section-id)
    ::
      =flagged-content
  ==
::
+$  group-ui
  $:  =group
      init=?
      member-count=@ud
  ==
::  $net: an indicator of whether we are a host or a subscriber
::
+$  net
  $~  [%pub ~]
  $%  [%pub =log]
      [%sub =time]
  ==
::
+$  groups-ui
  (map flag group-ui)
+$  groups
  (map flag group)
+$  net-groups
  (map flag [net group])
::  $preview: a group preview
::
::  .flag: group flag
::  .meta: group metadata
::  .time: preview timestamp
::  .member-count: group member count
::  .public: whether group is public
::
+$  preview
  $:  =flag
      meta=data:meta
      =time
      member-count=@ud
      =privacy
  ==
::  $previews: collection of group previews
::
+$  previews  (map flag preview)
::  $preview-update: group preview update
::
+$  preview-update  (unit preview)
::  $create-group: a request to create a group
::
::  .name: group name
::  .meta: group meteadata
::  .privacy: admission privacy
::  .banned: admission restrictions
::  .guests: list of ships to invite
::
+$  create-group
  $:  name=term
      meta=data:meta
      =privacy
      =banned
      guests=(set ship)
  ==
::XX use $plan from channels
+$  post-key  [post=time reply=(unit time)]
::
+$  flaggers  (set ship)
::  $flagged-content: flagged posts and replies that need admin review
::
+$  flagged-content  (map nest (map post-key flaggers))
::
::  %groups acur interface
::
::  a-* actions
::    actions are requests to the agent
::    as a group client. most actions
::    become commands which are then passed
::    on to the group host. actions can
::    only originate locally.
::
::  c-* commands
::    commands are requests to the agent
::    as a group host. they are checked
::    for permissions.
::
::  u-* updates
::    updates are generated in response to
::    a group change and disseminated to
::    group members.
::
::  r-* responses
::    responses are generated in response
::    to a group change, and are disseminated
::    to subscribers. most updates also trigger
::    a response.
::
::  $a-groups: groups actions
::
::  %group: operate on a group
::  %invite: send an invite
::
+$  a-groups
  $%  [%group =flag =a-group]
      [%invite =flag =a-invite]
  ==
+$  a-group
  $%  [%meta meta=data:meta]
      [%entry =a-entry]
      [%seat ships=(set ship) =a-seat]
      [%role roles=(set role-id) =a-role]
      [%channel =nest =a-channel]
      [%section =section-id =a-section]
      [%flag-content =nest =post-key src=ship]
      [%leave ~]
  ==
::  $a-invite: invite a ship
+$  a-invite
  $:  =ship
      token=(unit token)
      note=(unit story:s)
  ==
+$  a-entry  c-entry
+$  a-seat  c-seat
+$  a-role  c-role
+$  a-channel  c-channel
+$  a-section  c-section
::  $c-groups: group commands
::
::   %create: create a new group
::   %group: modify group state
::   %ask: request to join a group
::   %join: join a group with token
::   %leave: leave a group
::
+$  c-groups
  $%  [%create =create-group]
      [%group =flag =c-group]
    ::
      [%ask =flag story=(unit story:s)]
      [%join =flag token=(unit token)]
    ::
      [%leave =flag]
  ==
+$  c-group
  $%  [%meta meta=data:meta]
      [%entry =c-entry]
      [%seat ships=(set ship) =c-seat]
      [%role roles=(set role-id) =c-role]
      [%channel =nest =c-channel]
      [%section =section-id =c-section]
      [%flag-content =nest =post-key src=ship]
      [%delete ~]
  ==
+$  c-entry
  $%  [%privacy =privacy]
      [%ban =c-ban]
      [%token =c-token]
      [%ask ships=(set ship) c-ask=?(%approve %deny)]
  ==
+$  c-ban
  $%  [%set ships=(set ship) ranks=(set rank:title)]
    ::
      [%add-ships ships=(set ship)]
      [%del-ships ships=(set ship)]
    ::
      [%add-ranks ranks=(set rank:title)]
      [%del-ranks ranks=(set rank:title)]
  ==
+$  c-token
  $%  [%add =c-token-add]
      [%del =token]
  ==
+$  c-token-add
  $:  scheme=claim-scheme
      expiry=(unit @dr)
      label=(unit @t)
      referral=?
  ==
::  $c-role: role command
::
::  %add: add role
::  %edit: edit the role metadata
::  %del: delete the role
::  %set-admin: grant admin privileges
::  %del-admin: rescind admin priveleges
::
+$  c-role
  $%  [%add meta=data:meta]
      [%edit meta=data:meta]
      [%del ~]
      [%set-admin ~]
      [%del-admin ~]
  ==
::  $c-seat: membership command
::
::  %add: add a group member
::  %del: remove a group member
::  %add-roles: add member to roles
::  %del-roles: remove member from roles
::
+$  c-seat
  $%  [%add ~]
      [%del ~]
      [%add-roles roles=(set role-id)]
      [%del-roles roles=(set role-id)]
  ==
::  $c-channel: channel command
::
::  %add: add a channel
::  %edit: edit the channel
::  %del: delete the channel
::  %add-readers: add roles to readers set
::  %del-readers: delete roles from readers set
::  %section: assign the channel to a section
::
+$  c-channel
  $%  [%add =channel]
      [%edit =channel]
      [%del ~]
    ::
      [%add-readers roles=(set role-id)]
      [%del-readers roles=(set role-id)]
    ::
      [%section =section-id]
  ==
::  $c-section: section command
::
::  %add: create a new section
::  %edit: modify the section metadata
::  %del: delete the section
::  %move: reorder the section within a group
::  %move-nest: reorders a channel within a section
::
+$  c-section
  $%  [%add meta=data:meta]
      [%edit meta=data:meta]
      [%del ~]
      [%move idx=@ud]
      [%move-nest =nest idx=@ud]
  ==
+$  update  [=time =u-group]
+$  u-groups  [=flag =u-group]
+$  u-group
  $%  [%create =group]
      [%meta =data:meta]
      [%entry =u-entry]
      [%seat ships=(set ship) =u-seat]
      [%role roles=(set role-id) =u-role]
      [%channel =nest =u-channel]
      [%section =section-id =u-section]
      [%flag-content =nest =post-key src=ship]
      [%delete ~]
  ==
+$  u-entry
  $%  [%privacy =privacy]
      [%ban =u-ban]
      [%ask =u-ask]
      [%token =u-token]
  ==
+$  u-ban
  $%  [%set ships=(set ship) ranks=(set rank:title)]
    ::
      [%add-ships ships=(set ship)]
      [%del-ships ships=(set ship)]
    ::
      [%add-ranks ranks=(set rank:title)]
      [%del-ranks ranks=(set rank:title)]
  ==
+$  u-ask
  $%  [%add =ship story=(unit story:s)]
      [%del =ship]
  ==
+$  u-token
  $%  [%add =token meta=token-meta]
      [%del =token]
  ==
+$  u-role
  $%  [%add meta=data:meta]
      [%edit meta=data:meta]
      [%del ~]
      [%set-admin ~]
      [%del-admin ~]
  ==
+$  u-seat
  $%  [%add =seat]
      [%del ~]
      [%add-roles roles=(set role-id)]
      [%del-roles roles=(set role-id)]
  ==
+$  u-channel
  $%  [%add =channel]
      [%edit =channel]
      [%del ~]
      [%add-readers roles=(set role-id)]
      [%del-readers roles=(set role-id)]
      [%section section=section-id]
  ==
+$  u-section
  $%  [%add meta=data:meta]
      [%edit meta=data:meta]
      [%del ~]
      [%move idx=@ud]
      [%move-nest idx=@ud =nest]
  ==
+$  r-groups  [=flag =r-group]
+$  r-group
  $%  [%create =group]
      [%meta meta=data:meta]
      [%entry =r-entry]
      [%seat ships=(set ship) =r-seat]
      [%role roles=(set role-id) =r-role]
      [%channel =nest =r-channel]
      [%section =section-id =r-section]
      [%flag-content =nest =post-key src=ship]
      [%delete ~]
  ==
+$  r-entry
  $%  [%privacy =privacy]
      [%ban =r-ban]
      [%ask =r-ask]
      [%token =r-token]
  ==
+$  r-ban  u-ban
+$  r-ask  u-ask
+$  r-token  u-token
+$  r-seat  u-seat
+$  r-role  u-role
+$  r-channel  u-channel
+$  r-section  u-section
::  $a-foreigns: foreigns action
::TODO simply to +$  a-foreign
+$  a-foreigns
  $%  [%foreign =flag =a-foreign]
  ==
::  $a-foreign: foreign group action
::
::  %join: join the group
::  %ask: ask for entry
::  %cancel: cancel a join or an ask in progress
::  %invite: receive an invitation
::  %decline: decline an invitation
::
+$  a-foreign
  $%  [%join token=(unit token)]
      [%ask story=(unit story:s)]
      [%cancel ~]
    ::
      [%invite =invite]
      [%decline token=(unit token)]
  ==
::  $init: initial group update
::
+$  init  [=time =group]
::
+$  log  ((mop time u-group) lte)
::
++  log-on  ((on time u-group) lte)
::  +okay: protocol version, defunct
::
++  okay  `epic:e`4
::
::  version aliases
::
++  v7  v7:ver
++  v6  v6:ver
++  v5  v5:ver
++  v2  v2:ver
++  v0  v0:ver
::
++  ver
  |%
  ++  v7  .
  ++  v6
    =,  v5
    |%
    ::
    +$  preview-response
      (each preview access-error)
    ::
    +$  access-error  ?(%missing %forbidden)
    ::
    +$  gang
      $:  cam=(unit claim)
          pev=(unit preview)
          vit=(unit invite)
          err=(unit access-error)
      ==
    ::
    +$  gangs  (map flag gang)
    --
  ::
  ++  v5
    =,  v2
    |%
    ++  channel
      |^  channel
      ::
      +$  preview
        $:  =nest
            meta=data:meta
            group=^preview
        ==
      ::
      +$  channels  (map nest channel)
      ::
      +$  channel
        $:  meta=data:meta
            added=time
            =zone
            join=?
            readers=(set sect)
        ==
      ::
      +$  diff
        $%  [%add =channel]
            [%edit =channel]
            [%del ~]
          ::
            [%add-sects sects=(set sect)]
            [%del-sects sects=(set sect)]
          ::
            [%zone =zone]
          ::
            [%join join=_|]
        ==
      --
    ::
    +$  diff
      $%  [%fleet p=(set ship) q=diff:fleet]
          [%cabal p=sect q=diff:cabal]
          [%channel p=nest q=diff:channel]
          [%bloc p=diff:bloc]
          [%cordon p=diff:cordon]
          [%zone p=diff:zone]
          [%meta p=data:meta]
          [%secret p=?]
          [%create p=group]
          [%del ~]
          [%flag-content =nest =post-key src=ship]
      ==
    ::
    +$  action
      (pair flag update)
    ::
    +$  update
    (pair time diff)
    ::
    +$  group
      $:  =fleet
          cabals=(map sect cabal)
          zones=(map zone realm:zone)
          zone-ord=(list zone)
          =bloc
          =channels:channel
          active-channels=(set nest)
          imported=(set nest)
          =cordon
          secret=?
          meta=data:meta
          =flagged-content
      ==
    ::
    +$  init  [=time =group]
    +$  group-ui  [group init=? count=@ud]
    +$  groups-ui  (map flag group-ui)
    +$  groups  (map flag group)
    +$  net-groups  (map flag [net group])
    ::
    +$  log
      ((mop time diff) lte)
    ::
    ++  log-on
      ((on time diff) lte)
    ::
    +$  net
      $~  [%pub ~]
      $%  [%pub p=log]
          [%sub p=time load=_|]
      ==
    ::
    +$  progress
      $?  %knocking
          %adding
          %watching
          %error
      ==
    ::
    +$  claim
      $:  join-all=?
          =progress
      ==
    ::
    +$  preview
      $:  =flag
          meta=data:meta
          =cordon
          =time
          secret=?
          count=@ud
      ==
    +$  previews  (map flag preview)
    ::
    +$  gang
      $:  cam=(unit claim)
          pev=(unit preview)
          vit=(unit invite)
      ==
    ::
    +$  gangs  (map flag gang)
    --
    ::
    ++  v2
      =,  v0
      |%
      ::
      +$  group
        $:  =fleet
            cabals=(map sect cabal)
            zones=(map zone realm:zone)
            zone-ord=(list zone)
            =bloc
            =channels:channel
            imported=(set nest)
            =cordon
            secret=?
            meta=data:meta
            =flagged-content
        ==
      ::
      +$  group-ui  [group saga=(unit saga:e)]
      ::
      +$  diff
      $%  [%fleet p=(set ship) q=diff:fleet]
          [%cabal p=sect q=diff:cabal]
          [%channel p=nest q=diff:channel]
          [%bloc p=diff:bloc]
          [%cordon p=diff:cordon]
          [%zone p=diff:zone]
          [%meta p=data:meta]
          [%secret p=?]
          [%create p=group]
          [%del ~]
          [%flag-content =nest =post-key src=ship]
      ==
    ::
    +$  net
      $~  [%pub ~]
      $%  [%pub p=log]
          [%sub p=time load=_| =saga:e]
      ==
    ::
    +$  action
      (pair flag update)
    ::
    +$  update
      (pair time diff)
    ::
    +$  init  [=time =group]
    ::
    +$  groups-ui
      (map flag group-ui)
    ::
    +$  groups
      (map flag group)
    ::
    +$  net-groups
      (map flag [net group])
    ::
    +$  log
      ((mop time diff) lte)
    ::
    ++  log-on
      ((on time diff) lte)
    ::
    --
  ::
  ++  v0
    |%
    ::
    +$  sect  term
    ::
    ++  zone
      |^  zone
      ::
      +$  zone  @tas
      +$  realm
        $:  met=data:meta
            ord=(list nest)
        ==
      +$  diff  (pair zone delta)
      ::
      +$  delta
        $%  [%add meta=data:meta]
            [%del ~]
            [%edit meta=data:meta]
            [%mov idx=@ud]
            [%mov-nest =nest idx=@ud]
        ==
      --
    ::
    ++  fleet
      |^  fleet
      ::
      +$  fleet  (map ship vessel)
      +$  vessel
        $:  sects=(set sect)
            joined=time
        ==
      +$  diff
        $%  [%add ~]
            [%del ~]
            [%add-sects sects=(set sect)]
            [%del-sects sects=(set sect)]
        ==
      --
    ::
    +$  preview
      $:  =flag
          meta=data:meta
          =cordon
          =time
          secret=?
      ==
    ::
    +$  previews  (map flag preview)
    ::
    ++  channel
      |^  channel
      ::
      +$  preview
        $:  =nest
            meta=data:meta
            group=^preview
        ==
      ::
      +$  channels  (map nest channel)
      ::
      +$  channel
        $:  meta=data:meta
            added=time
            =zone
            join=?
            readers=(set sect)
        ==
      ::
      +$  diff
        $%  [%add =channel]
            [%edit =channel]
            [%del ~]
          ::
            [%add-sects sects=(set sect)]
            [%del-sects sects=(set sect)]
          ::
            [%zone =zone]
          ::
            [%join join=_|]
        ==
      --
    ::
    ++  cabal
      |^  cabal
      ::
      +$  cabal
        [meta=data:meta ~]
      ::
      +$  diff
        $%  [%add meta=data:meta]
            [%edit meta=data:meta]
            [%del ~]
        ==
      --
    ::
    ++  cordon
      |^  cordon
      ++  open
        |%
        +$  ban  [ships=(set ship) ranks=(set rank:title)]
        +$  diff
          $%  [%add-ships p=(set ship)]
              [%del-ships p=(set ship)]
            ::
              [%add-ranks p=(set rank:title)]
              [%del-ranks p=(set rank:title)]
          ==
        --
      ::
      ++  shut
        |%
        +$  state  [pend=(set ship) ask=(set ship)]
        +$  kind  ?(%ask %pending)
        +$  diff
          $%  [%add-ships p=kind q=(set ship)]
              [%del-ships p=kind q=(set ship)]
          ==
        --
      ::
      +$  cordon
        $%  [%open =ban:open]
            [%shut state:shut]
            [%afar =flag =path desc=@t]
        ==
      ::
      +$  diff
        $%  [%open p=diff:open]
            [%shut p=diff:shut]
            [%swap p=cordon]
        ==
      --
    ::
    ++  bloc
      |^  bloc
      ::
      +$  bloc  (set sect)
      +$  diff
        $%  [%add p=(set sect)]
            [%del p=(set sect)]
        ==
      --
    +$  group
      $:  =fleet
          cabals=(map sect cabal)
          zones=(map zone realm:zone)
          zone-ord=(list zone)
          =bloc
          =channels:channel
          imported=(set nest)
          =cordon
          secret=?
          meta=data:meta
      ==
    ::
    +$  create
      $:  name=term
          title=cord
          description=cord
          image=cord
          cover=cord
          =cordon
          members=(jug ship sect)
          secret=?
      ==
    ::
    +$  group-ui  [group saga=(unit saga:e)]
    +$  init  [=time =group]
    ::
    +$  groups-ui
      (map flag group-ui)
    +$  groups
      (map flag group)
    +$  net-groups
      (map flag [net group])
    ::
    +$  log
      ((mop time diff) lte)
    ::
    ++  log-on
      ((on time diff) lte)
    ::
    +$  net
      $~  [%pub ~]
      $%  [%pub p=log]
          [%sub p=time load=_| =saga:e]
      ==
    ::
    +$  diff
      $%  [%fleet p=(set ship) q=diff:fleet]
          [%cabal p=sect q=diff:cabal]
          [%channel p=nest q=diff:channel]
          [%bloc p=diff:bloc]
          [%cordon p=diff:cordon]
          [%zone p=diff:zone]
          [%meta p=data:meta]
          [%secret p=?]
          [%create p=group]
          [%del ~]
      ==
    ::
    +$  action
      (pair flag update)
    ::
    +$  update
      (pair time diff)
    ::
    +$  join
      $:  =flag
          join-all=?
      ==
    +$  knock  flag
    ::
    +$  invite  (pair flag ship)
    ::
    +$  progress
      ?(%knocking %adding %watching %done %error)
    ::
    +$  claim
      $:  join-all=?
          =progress
      ==
    ::
    +$  gang
      $:  cam=(unit claim)
          pev=(unit preview)
          vit=(unit invite)
      ==
    ::
    +$  gangs  (map flag gang)
    --
  --
--

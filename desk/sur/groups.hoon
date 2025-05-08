/-  meta, e=epic, s=story
|%
::  $flag: id for a group
::
+$  flag  (pair ship term)
::
::  $nest: id for a channel, {app}/{ship}/{name}
::TODO with custom channels, the $nest in %channels
::     should be relaxed this type
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
+$  channel-preview  [=nest meta=data:meta]
::  $channel: a collection of metadata about a channel
::
::  .meta: channel description
::  .added: time channel was added
::  .section: channel section
::  .join: should the channel be joined by new members
::  .readers: roles with read permissions. empty set
::            means the channel is accessible by everyone.
::
+$  channel
  $:  meta=data:meta
      ::XX this was never filled; make sure we set this.
      added=time
      section=section-id
      join=?
      readers=(set role-id)
  ==
::  $admissions: group entry policy
::
::  .privacy: determines group visibility
::  .banned: ships and ranks blacklist
::  .requests: entry requests 
::  .tokens: access tokens
::  .referrals: token attribution
::  .invited: invited guest list
::  .public-token: public access token
::
+$  admissions
  $:  =privacy
      =banned
      requests=(map ship (unit story:s))
      tokens=(map token token-meta)
      referrals=(map ship token)
      invited=(map ship [at=@da =token])
      public-token=(unit token)
  ==
::  $token: access token
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
  ==
::  $claim-scheme: token claim scheme
::
::  .forever: unlimited claims
::  .limited: limited number of claims
::  .once: single claim
::
+$  claim-scheme
  $%  [%forever ~]
      [%limited remaining=@ud]
      [%once ~]
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
::  .flag: group invitation
::  .token: access token
::  .from: inviter ship
::  .note: letter
::  .preview: group preview
::
+$  invite
  $:  =flag
      =token
      from=ship
      note=(unit story:s)
      =preview
  ==
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
      [%sub =time init=_|]
  ==
::
+$  groups-ui
  (map flag group-ui)
+$  groups
  (map flag group)
+$  net-groups
  (map flag [net group])
::  $preview: group preview
::
::  .flag: group flag
::  .meta: group metadata
::  .time: preview timestamp
::  .member-count: group member count
::  .public-token: public access token
::
+$  preview
  $:  =flag
      meta=data:meta
      =time
      member-count=@ud
      public-token=(unit token)
  ==
::  $previews: collection of group previews
::
+$  previews  (map flag preview)
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
::XX use id-post
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
::XX  consider whether it is better 
::    to have separate %group-join, %group-invite pokes
::
+$  a-groups
  $%  [%join =flag =token]
      :: [%invite =a-invite]
      [%group =flag =a-group]
  ==
+$  a-group
  $%  [%meta meta=data:meta]
      [%entry =a-entry]
      [%seat ships=(set ship) =a-seat]
      [%role =role-id =a-role]
      [%channel =nest =a-channel]
      [%section =section-id =a-section]
      [%flag-content =nest =post-key src=ship]
      [%leave ~]
  ==
+$  a-entry  c-entry
+$  a-seat  c-seat
+$  a-role  c-role
+$  a-channel  c-channel
+$  a-section  c-section
::
+$  c-groups
  $%  [%create =create-group]
      [%join =flag =token]
      [%group =flag =c-group]
  ==
+$  c-group
  $%  [%meta meta=data:meta]
      [%entry =c-entry]
      [%seat ships=(set ship) =c-seat]
      [%role =role-id =c-role]
      [%channel =nest =c-channel]
      [%section =section-id =c-section]
      [%flag-content =nest =post-key src=ship]
      [%delete ~]
  ==
+$  c-entry
  $%  [%privacy =privacy]
      [%ban =c-ban]
      [%token =c-token]
  ==
+$  c-ban
  $%  [%add-ships ships=(set ship)]
      [%del-ships ships=(set ship)]
      [%add-ranks ranks=(set rank:title)]
      [%del-ranks ranks=(set rank:title)]
  ==
+$  c-token
  $%  [%add scheme=claim-scheme expiry=(unit @dr) referral=?]
      [%del =token]
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
::  %del: remove the group member
::  %add-roles: add the member to roles
::  %del-roles: remove the member from roles
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
::  %add-roles: add roles to readers set
::  %del-roles: delete roles from readers set
::  %section: assign the channel to a section
::
+$  c-channel
  $%  [%add =channel]
      [%edit =channel]
      [%del ~]
    ::
      [%add-roles roles=(set role-id)]
      [%del-roles roles=(set role-id)]
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
  $%  [%meta =data:meta]
      [%entry =u-entry]
      ::XX consider allowing a batch ships update
      ::   like in c-group.
      [%seat =ship =u-seat]
      [%role =role-id =u-role]
      [%channel =nest =u-channel]
      [%section =section-id =u-section]
      [%flag-content =nest =post-key src=ship]
      [%del ~]
  ==
+$  u-entry
  $%  [%privacy =privacy]
      [%ban =u-ban]
      [%token =u-token]
  ==
+$  u-ban
  $%  [%add-ships ships=(set ship)]
      [%del-ships ships=(set ship)]
      [%add-ranks ranks=(set rank:title)]
      [%del-ranks ranks=(set rank:title)]
  ==
+$  u-token
  $%  [%add scheme=claim-scheme expiry=(unit @dr) label=(unit @t)]
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
      [%add-roles roles=(set role-id)]
      [%del-roles roles=(set role-id)]
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
  $%  [%meta =data:meta]
      [%entry =r-entry]
      [%seat =ship =r-seat]
      [%role =role-id =r-role]
      [%channel =nest =r-channel]
      [%section =section-id =r-section]
      [%flag-content =nest =post-key src=ship]
      [%del ~]
      [%leave ~]
  ==
+$  r-entry  u-entry
+$  r-seat  u-seat
+$  r-role  u-role
+$  r-channel  u-channel
+$  r-section  u-section
::  $group-update: a group update with timestamp
::
+$  group-update  [=time =u-group]
::  $preview-update: group preview update
::
+$  preview-update  (unit preview)
::  $init: initial group update
::
+$  init  [=time =group]
::
+$  log  ((mop time update) lte)
::
++  log-on  ((on time update) lte)
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

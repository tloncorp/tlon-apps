/-  meta, e=epic, s=story
|%
::  +okay: protocol version, defunct
++  okay  `epic:e`4
::  $flag: id for a group
::
+$  flag  (pair ship term)
::  $nest: id for a channel
+$  nest  (pair term flag)
::  $plan: index into channel state
::    p: post being referred to
::    q: reply being referred to, if any
::
+$  plan
  (pair time (unit time))
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
::  .roles: the set of roles assigned to a seat
::  .joined: the time a ship has joined
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
::  $channels-index: channels group ownership index
+$  channels-index  (map nest flag)
::  $admissions: group entry policy
::
::  .privacy: determines group visibility
::  .banned: ships and ranks blacklist
::  .pending: pending ships
::  .requests: entry requests
::  .tokens: access tokens
::  .referrals: token attribution
::  .invited: invited guest list
::
+$  admissions
  $:  =privacy
      =banned
      pending=(jug ship role-id)
      requests=(map ship [at=@da note=(unit story:s)])
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
      valid=?
  ==
::  $progress: group join in progress
::
::  %ask: asking for entry
::  %join: joining with a token
::  %watch: waiting for the subscription
::  %done: subscribed to the group
::  %error: error occured
::
+$  progress  ?(%ask %join %watch %done %error)
::  $lookup: preview in progress
::
::  %preview: waiting for preview
::  %done: preview update received
::  %error: error occured
::
+$  lookup  ?(%preview %done %error)
::  $foreign: view of a foreign group
::
::  .invites: received invites
::  .lookup: preview in progress
::  .preview: preview result
::  .progress: join in progress
::  .token: join token
::
+$  foreign
  $:  invites=(list invite)
      lookup=(unit lookup)
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
::  .members: group members and their roles
::
+$  create-group
  $:  name=term
      meta=data:meta
      =privacy
      =banned
      members=(jug ship role-id)
  ==
::  $flagged-content: flagged posts and replies that need admin review
::
+$  flagged-content  (map nest (jug plan ship))
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
::  %leave: leave a group
::
+$  a-groups
  $%  [%group =flag =a-group]
      [%invite =flag ships=(set ship) =a-invite]
      [%leave =flag]
  ==
+$  a-group
  $%  [%meta meta=data:meta]
      [%entry =a-entry]
      [%seat ships=(set ship) =a-seat]
      [%role roles=(set role-id) =a-role]
      [%channel =nest =a-channel]
      [%section =section-id =a-section]
      [%navigation =a-navigation]
      [%flag-content =nest =plan src=ship]
  ==
::  $a-invite: invite a ship
+$  a-invite
  $:  token=(unit token)
      note=(unit story:s)
  ==
+$  a-entry  c-entry
+$  a-seat  c-seat
+$  a-role  c-role
+$  a-channel  c-channel
+$  a-section  c-section
::  $a-navigation: specify the group navigation
::
::  group navigation is determined by the order of sections,
::  and, within each section, the order of channels.
::
::  the navigation structure supplied here can be partial, and will
::  be applied as far as possible by the server. for instance,
::  this action can be used to only modify a certain section by
::  supplying it in .sections.
::
+$  a-navigation
  $:  sections=(map section-id section)
      order=(list section-id)
  ==
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
::  $c-group: group command
::
::  %meta: update the metadata
::  %entry: update the entry policy
::  %seat: update seats
::  %role: update roles
::  %update: update a channel
::  %section: update a section
::  %flag-content: flag a post
::  %delete: delete the group
::
+$  c-group
  $%  [%meta meta=data:meta]
      [%entry =c-entry]
      [%seat ships=(set ship) =c-seat]
      [%role roles=(set role-id) =c-role]
      [%channel =nest =c-channel]
      [%section =section-id =c-section]
      [%section-order order=(list section-id)]
      [%flag-content =nest =plan src=ship]
      [%delete ~]
  ==
+$  c-entry
  $%  [%privacy =privacy]
      [%ban =c-ban]
      [%token =c-token]
      [%pending ships=(set ship) =c-pending]
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
+$  c-pending
  $%  [%add roles=(set role-id)]
      [%edit roles=(set role-id)]
      [%del ~]
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
::  %join: set the join flag
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
    ::
      [%join join=_|]
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
      [%set order=(list nest)]
  ==
+$  update  [=time =u-group]
+$  u-group
  $%  [%create =group]
      [%meta =data:meta]
      [%entry =u-entry]
      [%seat ships=(set ship) =u-seat]
      [%role roles=(set role-id) =u-role]
      [%channel =nest =u-channel]
      [%section =section-id =u-section]
      [%section-order order=(list section-id)]
      [%flag-content =nest =plan src=ship]
      [%delete ~]
  ==
+$  u-entry
  $%  [%privacy =privacy]
      [%ban =u-ban]
      [%token =u-token]
      [%pending =u-pending]
      [%ask =u-ask]
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
+$  u-token
  $%  [%add =token meta=token-meta]
      [%del =token]
  ==
+$  u-pending
  $%  [%add ships=(set ship) roles=(set role-id)]
      [%edit ships=(set ship) roles=(set role-id)]
      [%del ships=(set ship)]
  ==
+$  u-ask
  $%  [%add =ship at=@da story=(unit story:s)]
      [%del ships=(set ship)]
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
      [%join join=_|]
  ==
+$  u-section
  $%  [%add meta=data:meta]
      [%edit meta=data:meta]
      [%del ~]
      [%move idx=@ud]
      [%move-nest =nest idx=@ud]
      [%set order=(list nest)]
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
      [%section-order order=(list section-id)]
      [%flag-content =nest =plan src=ship]
      [%delete ~]
  ==
+$  r-entry
  $%  [%privacy =privacy]
      [%ban =r-ban]
      [%token =r-token]
      [%pending =r-pending]
      [%ask =r-ask]
  ==
+$  r-ban      u-ban
+$  r-token    u-token
+$  r-pending  u-pending
+$  r-ask      u-ask
+$  r-seat     u-seat
+$  r-role     u-role
+$  r-channel  u-channel
+$  r-section  u-section
::  $a-foreigns: foreign action
::
::  %reject: ask request rejection
::
+$  a-foreigns
  $%  [%foreign =flag =a-foreign]
      [%invite =invite]
      [%revoke =flag token=(unit token)]
      [%reject =flag]
  ==
::  $a-foreign: foreign group action
::
::  %join: join the group
::  %ask: ask for entry
::  %cancel: cancel a join or an ask in progress
::  %decline: decline an invitation
::
+$  a-foreign
  $%  [%join token=(unit token)]
      [%ask story=(unit story:s)]
      [%cancel ~]
      [%decline token=(unit token)]
  ==
::  $init: initial group update
::
+$  init  [=time =group]
::
+$  log  ((mop time u-group) lte)
::
++  log-on  ((on time u-group) lte)
--

::  Group administration and invitation workflows: one durable native effect.
/-  g=groups-ver
/+  spec=harness-tlon-tool, policy=harness-tlon-group-policy
|_  bowl=bowl:gall
::
++  handles
  |=  action=@t
  =/  actions=(list @t)
    :~  'create_group'
        'list_roles'
        'create_role'
        'update_role'
        'assign_role'
        'remove_role'
        'promote_member'
        'demote_member'
        'set_group_privacy'
        'list_group_requests'
        'approve_join_request'
        'reject_join_request'
        'revoke_group_invite'
        'list_group_invites'
        'request_group_invite'
        'accept_group_invite'
        'decline_group_invite'
        'cancel_group_join'
        'delete_group'
        'delete_channel'
        'delete_role'
        'kick_member'
        'ban_member'
        'unban_member'
        'add_channel_readers'
        'remove_channel_readers'
    ==
  (lien actions |=(value=@t =(value action)))
::
++  groups
  ^-  groups:v9:g
  .^(groups:v9:g %gx /(scot %p our.bowl)/groups/(scot %da now.bowl)/v2/groups/noun)
::
++  foreigns
  ^-  foreigns:v8:g
  .^(foreigns:v8:g %gx /(scot %p our.bowl)/groups/(scot %da now.bowl)/v1/foreigns/noun)
::
++  group-id
  |=  flag=[@p @tas]
  (rap 3 (scot %p -.flag) '/' +.flag ~)
::
++  invited
  |=  foreign=foreign:v8:g
  (lien invites.foreign |=(invite=invite:v8:g valid.invite))
::
++  run
  |=  [args=json wire=wire]
  ^-  [body=@t effect=(unit card:agent:gall)]
  ?>  .^(? %gu /(scot %p our.bowl)/groups/(scot %da now.bowl)/$)
  =/  action  (required:spec args 'action' 32)
  ?>  (handles action)
  ?:  =('list_group_invites' action)
    (list-invites args)
  ?:  |(=('list_roles' action) =('list_group_requests' action))
    =/  flag  (flag:spec (required:spec args 'group' 256))
    =/  group  (~(got by groups) flag)
    ?:  =('list_roles' action)
      (list-roles args group)
    (list-requests args flag group)
  ::  The policy refuses a taken name outright; say why, or the model takes
  ::  over the group that holds the name instead of creating its own.
  ?:  ?&  =('create_group' action)
          (~(has by groups) [our.bowl (slug:spec (required:spec args 'name' 64))])
      ==
    :_  ~
    %+  rap  3
    :~  'error: this ship already has a group named '  (required:spec args 'name' 64)
        '; choose a name no group uses. An existing group is not a stand-in for a new one.'
    ==
  =/  =card:agent:gall  (command args wire action)
  =/  body
    %+  rap  3
    :~  'accepted: local Tlon acknowledged '
        action
        '; verify with list_roles/list_members/list_group_requests/list_group_invites; remote completion is not confirmed'
    ==
  [body `card]
::
++  list-invites
  |=  args=json
  ^-  [body=@t effect=(unit card:agent:gall)]
  =/  rows  ~(tap by foreigns)
  =/  items
    %+  turn  rows
    |=  [flag=[@p @tas] foreign=foreign:v8:g]
    %-  pairs:enjs:format
    :~  ['group' %s (group-id flag)]
        ['title' %s ?~(preview.foreign '' title.meta.u.preview.foreign)]
        ['has_invite' %b (invited foreign)]
        ['progress' ?~(progress.foreign ~ [%s u.progress.foreign])]
    ==
  [(en:json:html (directory:spec args items)) ~]
::
++  list-roles
  |=  [args=json group=group:v9:g]
  ^-  [body=@t effect=(unit card:agent:gall)]
  =/  rows  ~(tap by roles.group)
  =/  items
    %+  turn  rows
    |=  [id=@tas role=role:v9:g]
    %-  pairs:enjs:format
    :~  ['role' %s id]
        ['title' %s title.meta.role]
        ['description' %s description.meta.role]
        ['admin' %b (~(has in admins.group) id)]
    ==
  [(en:json:html (directory:spec args items)) ~]
::
++  list-requests
  |=  [args=json flag=[@p @tas] group=group:v9:g]
  ^-  [body=@t effect=(unit card:agent:gall)]
  ?>  (admin:policy our.bowl -.flag group)
  ::  Never expose invitation tokens, referral links or request bodies.
  =/  pending  ~(tap in ~(key by pending.admissions.group))
  =/  requests  ~(tap in ~(key by requests.admissions.group))
  =/  invites  ~(tap in ~(key by invited.admissions.group))
  =/  ships
    |=  rows=(list @p)
    :-  %a
    %+  turn  (scag 100 (slag (offset:spec args) rows))
    |=  who=@p
    [%s (scot %p who)]
  =/  result
    =/  next-offset  (add (offset:spec args) 100)
    =/  more
      ?|  (gth (lent pending) next-offset)
          (gth (lent requests) next-offset)
          (gth (lent invites) next-offset)
      ==
    %-  pairs:enjs:format
    :~  ['pending' (ships pending)]
        ['requests' (ships requests)]
        ['invited' (ships invites)]
        ['has_more' %b more]
        ['next_offset' ?:(more [%s (scot %ud next-offset)] ~)]
    ==
  [(en:json:html result) ~]
::
++  command
  |=  [args=json wire=wire action=@t]
  ^-  card:agent:gall
  ?:  =('create_group' action)
    :*  %pass  wire  %agent  [our.bowl %groups]  %poke  %group-command
        !>(`c-groups:v8:g`[%create (create:policy args our.bowl groups)])
    ==
  =/  flag  (flag:spec (required:spec args 'group' 256))
  ?:  =('request_group_invite' action)
    ?>  !(~(has by groups) flag)
    [%pass wire %agent [our.bowl %groups] %poke %group-knock !>(flag)]
  ?:  ?|  =('accept_group_invite' action)
          =('decline_group_invite' action)
          =('cancel_group_join' action)
      ==
    ?>  !(~(has by groups) flag)
    =/  foreign  (~(got by foreigns) flag)
    ?:  =('cancel_group_join' action)
      ?>  ?=(^ progress.foreign)
      [%pass wire %agent [our.bowl %groups] %poke %group-cancel !>(flag)]
    ?>  (invited foreign)
    ?:  =('accept_group_invite' action)
      [%pass wire %agent [our.bowl %groups] %poke %group-join !>([flag &])]
    [%pass wire %agent [our.bowl %groups] %poke %invite-decline !>(flag)]
  =/  group  (~(got by groups) flag)
  :*  %pass  wire  %agent  [our.bowl %groups]  %poke  %group-action-4
      !>(`a-groups:v8:g`[%group flag (manage:policy args our.bowl flag group)])
  ==
--

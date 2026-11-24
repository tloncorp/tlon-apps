::  Pure group command construction. Role names never imply admin authority.
/-  g=groups-ver, meta
/+  spec=harness-tlon-tool
|%
::
++  admin
  |=  [who=@p host=@p group=group:v9:g]
  ^-  ?
  ?:  =(who host)  &
  =/  seat  (~(get by seats.group) who)
  ?~  seat  |
  !=(~ (~(int in roles.u.seat) admins.group))
::
++  create
  |=  [args=json our=@p known=groups:v9:g]
  ^-  create-group:v8:g
  =/  name  (slug:spec (required:spec args 'name' 64))
  ::  Native %create replaces a same-named group. Never allow that here.
  ?>  !(~(has by known) [our name])
  =/  privacy  (string:spec args 'privacy' 'secret' 16)
  ?>  ?=(?(%secret %private %public) privacy)
  =/  members=(jug @p @tas)
    ?.  (has:spec args 'owner')  ~
    =/  owner  (ship:spec (required:spec args 'owner' 128))
    (~(put ju *(jug @p @tas)) owner %admin)
  :*  name
      [(required:spec args 'title' 128) (string:spec args 'description' '' 1.024) '' '']
      privacy  [~ ~]  members
  ==
::
++  manage
  |=  [args=json our=@p flag=[@p @tas] group=group:v9:g]
  ^-  a-group:v8:g
  ::  Every management command starts from current native admin membership.
  ?>  (admin our -.flag group)
  =/  action  (required:spec args 'action' 32)
  ?:  =('delete_group' action)
    ?>  =(our -.flag)
    ?>  =((required:spec args 'confirm' 256) (required:spec args 'group' 256))
    [%delete ~]
  ?:  =('delete_role' action)
    =/  role  (slug:spec (required:spec args 'role' 64))
    ?>  (~(has by roles.group) role)
    ?>  !(~(has in admins.group) role)
    ?>  =(role (required:spec args 'confirm' 256))
    [%role (silt ~[role]) %del ~]
  ?:  ?|  =('delete_channel' action)
          =('add_channel_readers' action)
          =('remove_channel_readers' action)
      ==
    (manage-channel args action group)
  ?:  =('set_group_privacy' action)
    =/  privacy  (required:spec args 'privacy' 16)
    ?>  ?=(?(%secret %private %public) privacy)
    [%entry %privacy privacy]
  ?:  |(=('create_role' action) =('update_role' action))
    (manage-role args action group)
  (manage-member args action flag group)
::
++  manage-channel
  |=  [args=json action=@t group=group:v9:g]
  ^-  a-group:v8:g
  =/  nest  (group-nest:spec (required:spec args 'channel' 256))
  ?>  (~(has by channels.group) nest)
  ?:  =('delete_channel' action)
    ?>  =((required:spec args 'confirm' 256) (required:spec args 'channel' 256))
    [%channel nest %del ~]
  =/  role  (slug:spec (required:spec args 'role' 64))
  ?>  (~(has by roles.group) role)
  ?:  =('add_channel_readers' action)
    [%channel nest %add-readers (silt ~[role])]
  [%channel nest %del-readers (silt ~[role])]
::
++  manage-role
  |=  [args=json action=@t group=group:v9:g]
  ^-  a-group:v8:g
  =/  role  (slug:spec (required:spec args 'role' 64))
  =/  existing  (~(get by roles.group) role)
  ?:  =('create_role' action)
    ?>  ?=(~ existing)
    =/  metadata=data:meta
      [(required:spec args 'title' 128) (string:spec args 'description' '' 1.024) '' '']
    [%role (silt ~[role]) %add metadata]
  ?>  ?=(^ existing)
  ?>  |((has:spec args 'title') (has:spec args 'description'))
  =/  title  (string:spec args 'title' title.meta.u.existing 128)
  ?>  !=('' title)
  =/  metadata
    %*  .  meta.u.existing
      title  title
      description  (string:spec args 'description' description.meta.u.existing 1.024)
    ==
  [%role (silt ~[role]) %edit metadata]
::
++  manage-member
  |=  [args=json action=@t flag=[@p @tas] group=group:v9:g]
  ^-  a-group:v8:g
  =/  who  (ship:spec (required:spec args 'ship' 128))
  =/  ships  (silt ~[who])
  ?:  ?|  =('kick_member' action)
          =('ban_member' action)
          =('unban_member' action)
      ==
    ?>  !=(who -.flag)
    ?>  =(who (ship:spec (required:spec args 'confirm' 128)))
    ?:  =('kick_member' action)
      ?>  (~(has by seats.group) who)
      [%seat ships %del ~]
    ?:  =('ban_member' action)  [%entry %ban %add-ships ships]
    [%entry %ban %del-ships ships]
  ?:  |(=('approve_join_request' action) =('reject_join_request' action))
    ?>  (~(has by requests.admissions.group) who)
    [%entry %ask ships ?:(=('approve_join_request' action) %approve %deny)]
  ?:  =('revoke_group_invite' action)
    ?>  ?|  (~(has by pending.admissions.group) who)
            (~(has by invited.admissions.group) who)
        ==
    [%entry %pending ships %del ~]
  ?>  (~(has by seats.group) who)
  ?:  =('demote_member' action)
    ::  The host cannot be demoted. Remove all admin roles in one command,
    ::  so a self-demotion cannot stop halfway through multiple effects.
    ?>  !=(who -.flag)
    [%seat ships %del-roles admins.group]
  ?:  =('promote_member' action)
    =/  candidates  (~(int in admins.group) ~(key by roles.group))
    ?>  !=(~ candidates)
    =/  role
      ?:  (has:spec args 'role')  (slug:spec (required:spec args 'role' 64))
      ?:  (~(has in candidates) %admin)  %admin
      (snag 0 ~(tap in candidates))
    ?>  (~(has in candidates) role)
    [%seat ships %add-roles (silt ~[role])]
  ?>  |(=('assign_role' action) =('remove_role' action))
  =/  role  (slug:spec (required:spec args 'role' 64))
  ?>  (~(has by roles.group) role)
  :+  %seat  ships
  ?:  =('assign_role' action)  [%add-roles (silt ~[role])]
  [%del-roles (silt ~[role])]
--

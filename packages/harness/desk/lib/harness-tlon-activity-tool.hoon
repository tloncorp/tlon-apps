::  This ship's own read state and notification levels. Levels use the
::  app's named presets so a chat looks the same in Tlon Messenger after a
::  change; the tables follow getVolumeMap in @tloncorp/api.
/-  a=activity-ver, g=groups-ver
/+  spec=harness-tlon-tool, group-tool=harness-tlon-group-tool
|_  bowl=bowl:gall
+$  level  ?(%loud %medium %soft %hush)
::
++  handles
  |=  action=@t
  =/  actions=(list @t)
    :~  'mark_read'
        'mute'
        'unmute'
        'set_notification_level'
        'get_notification_levels'
    ==
  (lien actions |=(value=@t =(value action)))
::
++  run
  |=  [args=json wire=wire]
  ^-  [body=@t effect=(unit card:agent:gall)]
  ?>  .^(? %gu /(scot %p our.bowl)/activity/(scot %da now.bowl)/$)
  =/  action  (required:spec args 'action' 32)
  ?>  (handles action)
  ?:  =('get_notification_levels' action)  [(en:json:html (levels args)) ~]
  =/  [act=action:v10:a done=@t]  (command args action)
  :-  (rap 3 'accepted: local Tlon acknowledged ' action '; ' done ~)
  `[%pass wire %agent [our.bowl %activity] %poke %activity-action-2 !>(act)]
::
++  command
  |=  [args=json action=@t]
  ^-  [action:v10:a @t]
  ?:  =('mark_read' action)
    ?:  =('all' (string:spec args 'scope' '' 8))
      :-  [%read [%base ~] [%all ~ &]]
      'every chat on this ship is marked read; verify with activity_inbox filter=unreads'
    :-  [%read (source args &) [%all ~ &]]
    'that chat is marked read on this ship; verify with activity_inbox filter=unreads'
  ?:  &(=('set_notification_level' action) =('base' (string:spec args 'scope' '' 8)))
    =/  wanted  (preset (required:spec args 'level' 16))
    ::  The app offers only these three for its app-wide setting.
    ?>  ?=(?(%medium %soft %hush) wanted)
    :-  [%adjust [%base ~] `(volumes wanted)]
    (cat 3 'the app-wide level is now ' (describe wanted))
  =/  target  (source args |)
  ?:  =('unmute' action)
    [[%adjust target ~] 'that chat follows its inherited level again']
  =/  wanted=?(level %default)
    ?:  =('mute' action)
      ::  Muting a group keeps mentions and replies, as the app does.
      ?:(?=(%group -.target) %soft %hush)
    ?>  =('set_notification_level' action)
    (preset (required:spec args 'level' 16))
  ::  DMs offer only these in the app.
  ?>  |(!?=(%dm -.target) ?=(?(%medium %hush %default) wanted))
  ?:  ?=(%default wanted)
    [[%adjust target ~] 'that chat follows its inherited level again']
  :-  [%adjust target `(volumes wanted)]
  (cat 3 'that chat is now ' (describe wanted))
::
::  +source: exactly one of ship, club, group or channel. Notes channels are
::  notebook sources; levels for them are not offered, as in the CLI.
::
++  source
  |=  [args=json notes=?]
  ^-  source:v10:a
  =/  given
    %+  skim  `(list @t)`~['ship' 'club' 'group' 'channel']
    |=(key=@t (has:spec args key))
  ?>  ?=([@ ~] given)
  ?:  =('ship' i.given)  [%dm %ship (ship:spec (required:spec args 'ship' 128))]
  ?:  =('club' i.given)  [%dm %club (slav %uv (required:spec args 'club' 128))]
  =/  groups  groups:~(. group-tool bowl)
  ?:  =('group' i.given)
    =/  flag  (flag:spec (required:spec args 'group' 256))
    ?>  (~(has by groups) flag)
    [%group flag]
  =/  id  (required:spec args 'channel' 256)
  =/  nest  (group-nest:spec id)
  =/  hosts
    %+  murn  ~(tap by groups)
    |=  [flag=[@p @tas] group=group:v9:g]
    ?.((~(has by channels.group) nest) ~ `flag)
  ?>  ?=([^ ~] hosts)
  ?:  ?=(%notes kind.nest)
    ?>  notes
    [%notebook [ship.nest name.nest] `i.hosts]
  [%channel (nest:spec id) i.hosts]
::
++  preset
  |=  value=@t
  ^-  ?(level %default)
  ?>  ?=(?(%loud %medium %soft %hush %default) value)
  value
::
++  describe
  |=  value=level
  ^-  @t
  ?-  value
    %loud  'loud (all activity notifies)'
    %medium  'medium (posts, mentions and replies notify)'
    %soft  'soft (only mentions and replies notify)'
    %hush  'hush (nothing notifies)'
  ==
::
::  +notify-on: events that notify at medium and soft. +notify-off never do
::  below loud. +notify-medium are posts, reactions and notes, which notify
::  at medium but not soft.
::
++  notify-on
  ^-  (list event-type:v10:a)
  :~  %post-mention  %reply-mention  %dm-invite  %dm-post  %dm-post-mention
      %dm-reply  %dm-reply-mention  %group-ask  %group-invite  %flag-post
      %flag-reply
  ==
++  notify-off
  ^-  (list event-type:v10:a)
  ~[%reply %group-join %group-kick %group-role]
++  notify-medium
  ^-  (list event-type:v10:a)
  ~[%post %react %dm-react %note-create %note-edit]
::
++  volumes
  |=  value=level
  ^-  volume-map:v10:a
  %-  ~(gas by *(map event-type:v10:a volume:v10:a))
  %+  turn  :(weld notify-on notify-off notify-medium)
  |=  event=event-type:v10:a
  ::  Reactions never count toward unread badges.
  :+  event  !?=(?(%react %dm-react) event)
  ?-  value
    %loud  &
    %hush  |
    %medium  !(lien notify-off |=(off=event-type:v10:a =(off event)))
    %soft  (lien notify-on |=(on=event-type:v10:a =(on event)))
  ==
::
::  +named: the preset a stored map matches, as getLevelFromVolumeMap reads it.
::
++  named
  |=  map=volume-map:v10:a
  ^-  level
  =/  entries  ~(tap by map)
  ?:  (levy entries |=([* volume:v10:a] notify))  %loud
  ?:  (levy entries |=([* volume:v10:a] !notify))  %hush
  =/  medium
    %+  levy  entries
    |=  [event=event-type:v10:a =volume:v10:a]
    ?:  ?|  =(%post event)
            (lien notify-on |=(on=event-type:v10:a =(on event)))
        ==
      notify.volume
    ?:  (lien notify-off |=(off=event-type:v10:a =(off event)))
      !notify.volume
    &
  ?:(medium %medium %soft)
::
++  levels
  |=  args=json
  ^-  json
  =/  settings
    .^  volume-settings:v10:a  %gx
      /(scot %p our.bowl)/activity/(scot %da now.bowl)/v6/volume-settings/noun
    ==
  =/  base  (named (~(gut by settings) [%base ~] default-volumes:v10:a))
  =/  rows
    %+  murn  ~(tap by settings)
    |=  [=source:v10:a map=volume-map:v10:a]
    ^-  (unit json)
    =/  fields=(unit (list [@t json]))
      ?+  -.source  ~
        %group  `~[['group' %s (flag-id flag.source)]]
        %channel  `~[['channel' %s (nest-id nest.source)] ['group' %s (flag-id group.source)]]
          %dm
        ?:  ?=(%ship -.whom.source)  `~[['ship' %s (scot %p p.whom.source)]]
        `~[['club' %s (scot %uv p.whom.source)]]
      ==
    ?~  fields  ~
    `(pairs:enjs:format (snoc u.fields ['level' %s (named map)]))
  %-  pairs:enjs:format
  :~  ['base' %s base]
      ['overrides' (directory:spec args rows)]
      :*  'note'  %s
          'Levels are this ship\'s own notifications. Chats without an override follow base.'
      ==
  ==
::
++  flag-id
  |=  flag=[@p @tas]
  (rap 3 (scot %p -.flag) '/' +.flag ~)
++  nest-id
  |=  nest=[@tas @p @tas]
  (rap 3 -.nest '/' (flag-id +.nest) ~)
--

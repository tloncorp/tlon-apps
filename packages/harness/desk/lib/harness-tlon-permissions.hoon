::  One revision-checked conversation policy for native and hosted settings.
/-  t=harness-tlon, g=groups-ver, c=channels
/+  p=harness-tlon-policy, j=harness-workspace-json, paths=harness-tlon-paths
|%
::
++  revision
  |=  [policy=policy:t epoch=@ud]
  (scot %uv (sham [policy epoch]))
::
++  view
  |=  [policy=policy:t epoch=@ud]
  ^-  json
  =/  ships  (~(uni in allowed.policy) ~(key by trusted.policy))
  %-  pairs:enjs:format
  :~  ['revision' %s (revision policy epoch)]
      ['enabled' %b enabled.policy]
      ['owner' ?~(owner.policy ~ [%s (scot %p u.owner.policy)])]
      ['allowedShips' %a (turn ~(tap in ships) |=(who=@p [%s (scot %p who)]))]
      ['response' %s response.policy]
      ['channels' (channels-json:p channels.policy)]
  ==
::
++  apply
  |=  [policy=policy:t epoch=@ud args=json]
  ^-  (each policy:t [status=@ud error=@t])
  ?.  ?=(%o -.args)  [%| 400 'Expected permission settings.']
  =/  fields  (silt ~['revision' 'enabled' 'allowedShips' 'response' 'channels'])
  ?.  %+  levy  ~(tap by p.args)
      |=  [key=@t value=json]
      (~(has in fields) key)
    [%| 400 'Unknown permission setting.']
  ?.  =(`[%s (revision policy epoch)] (get:j args 'revision'))
    [%| 409 'Permissions changed. Reload before saving.']
  =/  parsed
    %-  mole
    |.
    =,  dejs:format
    =/  value=[enabled=? ships=(list @p) response=@t channels=(map nest:c channel-rule:t)]
      %-  %-  ot
          :~  ['enabled' bo]  ['allowedShips' (ar (se %p))]  ['response' so]
              ['channels' json-channels:p]
          ==
      args
    ?>  (lte (lent ships.value) 64)
    =/  ships  (silt ships.value)
    ?>  =(~(wyt in ships) (lent ships.value))
    ?>  ?=(?(%off %mentions %all) response.value)
    ::  Retain explicit resource grants; adding a ship grants no peer access.
    =/  trusted
      %-  my
      %+  skim  ~(tap by trusted.policy)
      |=  [who=@p tools=*]
      (~(has in ships) who)
    %*  .  policy
      enabled  enabled.value
      allowed  (~(dif in ships) ~(key by trusted))
      trusted  trusted
      response  response.value
      channels  channels.value
    ==
  ?~  parsed  [%| 400 'Use unique ship names and valid channel response rules.']
  [%& u.parsed]
::
++  envelope
  |=  [status=@ud body=json]
  (pairs:enjs:format ~[['status' (numb:enjs:format status)] ['body' body]])
::
++  chat-ships
  |=  policy=policy:t
  =/  ships  (~(uni in allowed.policy) ~(key by trusted.policy))
  ?~(owner.policy ships (~(put in ships) u.owner.policy))
::
++  chat-view
  |=  policy=policy:t
  ^-  json
  =/  ships  [%a (turn ~(tap in (chat-ships policy)) |=(who=@p [%s (scot %p who)]))]
  =/  rules
    %+  murn  ~(tap by channels.policy)
    |=  [nest=nest:c rule=channel-rule:t]
    ?:  =(%off response.rule)  ~
    :-  ~
    :-  (address:p [%channel nest ~])
    %-  pairs:enjs:format
    :~  ['mode' %s ?:(everyone.rule 'open' 'allowlist')]
        ['allowedShips' ?:(everyone.rule [%a ~] ships)]
    ==
  %-  pairs:enjs:format
  :~  ['dmAllowlist' ships]
      ['defaultAuthorizedShips' ships]
      ['groupInviteAllowlist' ships]
      ['autoAcceptDmInvites' %b &]
      ['autoDiscoverChannels' %b &]
      ['fromDefaults' %b |]
      ['channelRules' (pairs:enjs:format rules)]
      ['groupChannels' %a (turn rules |=([name=@t value=json] [%s name]))]
  ==
::
++  chat-apply
  |=  [policy=policy:t args=json]
  ^-  (each policy:t [status=@ud error=@t])
  ::  The mobile wire format describes the same native policy. Unsupported
  ::  distinctions fail closed instead of silently granting broader access.
  =/  parsed
    %-  mole
    |.
    ?>  ?=(%o -.args)
    =/  fields
      %-  silt
      :~  'dmAllowlist'
          'defaultAuthorizedShips'
          'groupInviteAllowlist'
          'autoAcceptDmInvites'
          'autoDiscoverChannels'
          'channelRules'
          'groupChannels'
      ==
    ?>  %+  levy  ~(tap by p.args)
        |=  [key=@t value=json]
        (~(has in fields) key)
    =/  original  (chat-ships policy)
    =/  selected  (get:j args 'dmAllowlist')
    =/  ships=(set @p)
      ?~  selected  original
      (silt ((ar:dejs:format (se:dejs:format %p)) u.selected))
    ?>  (lte ~(wyt in ships) 64)
    ::  All three lists describe the same native permission set.
    ?>  %+  levy  `(list @t)`~['defaultAuthorizedShips' 'groupInviteAllowlist']
        |=  key=@t
        =/  value  (get:j args key)
        ?~  value  &
        =(ships (silt ((ar:dejs:format (se:dejs:format %p)) u.value)))
    ?>  %+  levy  `(list @t)`~['autoAcceptDmInvites' 'autoDiscoverChannels']
        |=  key=@t
        =/  value  (get:j args key)
        ?~  value  &
        =(u.value [%b &])
    =/  rules  (get:j args 'channelRules')
    =/  channels  channels.policy
    =?  channels  ?=(^ rules)
      (chat-channels channels ships u.rules)
    =/  trusted
      %-  my
      %+  skim  ~(tap by trusted.policy)
      |=  [who=@p tools=*]
      (~(has in ships) who)
    %*  .  policy
      allowed  ?:(=(ships original) allowed.policy (~(dif in ships) ~(key by trusted)))
      trusted  trusted
      channels  channels
    ==
  ?~  parsed
    :*  %|  400
        'Harness uses one allowed-ships list for DMs and invitations, with automatic channel discovery. Channel rules allow those ships or everyone; separate ship lists and channel models are unavailable.'
    ==
  [%& u.parsed]
::
++  chat-channels
  |=  [channels=(map nest:c channel-rule:t) ships=(set @p) rules=json]
  ^-  (map nest:c channel-rule:t)
  ?>  ?=(%o -.rules)
  =/  rows
    %+  turn  ~(tap by p.rules)
    |=  [name=@t value=json]
    =/  mode  (string:j value 'mode')
    ?>  |(=('open' mode) =('allowlist' mode))
    ?>  ?|  =('open' mode)
            .=  ships
            (silt ((ar:dejs:format (se:dejs:format %p)) (need (get:j value 'allowedShips'))))
        ==
    %-  pairs:enjs:format
    :~  ['channel' %s name]
        ['response' %s 'mentions']
        ['everyone' %b =('open' mode)]
    ==
  =/  wanted  (json-channels:p [%a rows])
  ::  Omitted channels turn off; retained channels keep their all mode.
  =/  kept=(list [p=nest:c q=channel-rule:t])
    %+  turn  ~(tap by channels)
    |=  [nest=nest:c rule=channel-rule:t]
    =/  replacement  (~(get by wanted) nest)
    ?~  replacement  [nest rule(response %off)]
    [nest u.replacement(response ?:(=(%all response.rule) %all %mentions))]
  (~(uni by wanted) (my kept))
::
++  error
  |=  [status=@ud message=@t]
  (envelope status (pairs:enjs:format ~[['error' %s message]]))
::
++  directory
  |_  bowl=bowl:gall
  ++  groups
    ^-  groups:v9:g
    .^(groups:v9:g %gx /(scot %p our.bowl)/groups/(scot %da now.bowl)/v2/groups/noun)
  ++  channels
    ^-  json
    =/  rows=(list json)
      %-  zing
      %+  turn  ~(tap by groups)
      |=  [flag=flag:g group=group:v9:g]
      ?~  seat=(~(get by seats.group) our.bowl)  ~
      ?:  =(0 joined.u.seat)  ~
      %+  murn  ~(tap in active-channels.group)
      |=  nest=nest:g
      ?.  ?=(?(%chat %diary %heap) p.nest)  ~
      =/  channel  (~(get by channels.group) nest)
      :-  ~
      %-  pairs:enjs:format
      :~  ['channel' %s (address:p [%channel nest ~])]
          ['title' %s ?~(channel q.q.nest title.meta.u.channel)]
          ['group' %s title.meta.group]
      ==
    [%a rows]
  ++  can-read
    |=  [who=@p nest=nest:g]
    ^-  ?
    %+  lien  ~(tap by groups)
    |=  [flag=flag:g group=group:v9:g]
    ?.  (~(has by channels.group) nest)  |
    ?~  seat=(~(get by seats.group) who)  |
    ?:  =(0 joined.u.seat)  |
    =/  native=$-([@p nest:g] ?)
      .^  $-([@p nest:g] ?)  %gx
        (group-can-read:~(. paths [our now]:bowl) flag)
      ==
    (native who nest)
  --
--

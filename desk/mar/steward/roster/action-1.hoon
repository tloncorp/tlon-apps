::  %steward-roster-action-1: mint / configure / retire a bot moon
::
::    minting is driven by the owner from the host frontend, which talks
::    HTTP, so unlike most other steward marks this grab supports json (in
::    addition to noun for local/agent-to-agent pokes).
::
/-  r=steward-roster
|_  =action:v1:r
++  grad  %noun
++  grow
  |%
  ++  noun  action
  ++  json
    =,  enjs:format
    ?-  -.action
        %mint
      %-  frond  :-  'mint'
      %-  pairs
      :~  ['nickname' s+nickname.action]
          :-  'avatar'
          ?~(avatar.action ~ s+u.avatar.action)
          ['model' s+model.action]
          ['harness' s+harness.action]
          ['persona' s+persona.action]
      ==
    ::
        %configure
      %-  frond  :-  'configure'
      %-  pairs
      :~  ['ship' s+(scot %p ship.action)]
          ['nickname' s+nickname.action]
          :-  'avatar'
          ?~(avatar.action ~ s+u.avatar.action)
          ['model' s+model.action]
          ['harness' s+harness.action]
          ['persona' s+persona.action]
      ==
    ::
        %retire
      %-  frond  :-  'retire'
      %-  frond  :-  'ship'
      s+(scot %p ship.action)
    ==
  --
++  grab
  |%
  ++  noun  action:v1:r
  ++  json
    =,  dejs:format
    %-  of
    :~  :-  %mint
        %-  ot
        :~  nickname+so
            avatar+(mu so)
            model+so
            harness+so
            persona+so
        ==
      ::
        :-  %configure
        %-  ot
        :~  ship+(se %p)
            nickname+so
            avatar+(mu so)
            model+so
            harness+so
            persona+so
        ==
      ::
        [%retire (ot ship+(se %p) ~)]
    ==
  --
--

::  %steward-roster-action-1: mint / configure / profile-edit / retire a
::  bot moon
::
::    minting is driven by the owner from the host frontend, which talks
::    HTTP, so unlike most other steward marks this grab supports json (in
::    addition to noun for local/agent-to-agent pokes).
::
/-  r=steward-roster
|_  =action:v2:r
++  grad  %noun
++  grow
  |%
  ++  noun  action
  ++  json
    =,  enjs:format
    |^
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
          ['model' (from-unit model.action)]
          ['harness' (from-unit harness.action)]
          ['persona' (from-unit persona.action)]
      ==
    ::
        %profile
      %-  frond  :-  'profile'
      %-  pairs
      :~  ['ship' s+(scot %p ship.action)]
          :-  'edits'
          %-  pairs
          %+  turn  ~(tap by edits.action)
          |=  [key=@tas val=(unit @t)]
          [key ?~(val ~ s+u.val)]
      ==
    ::
        %retire
      %-  frond  :-  'retire'
      %-  frond  :-  'ship'
      s+(scot %p ship.action)
    ==
    ++  from-unit
      |=  val=(unit @t)
      ?~(val ~ s+u.val)
    --
  --
++  grab
  |%
  ++  noun  action:v2:r
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
            model+(mu so)
            harness+(mu so)
            persona+(mu so)
        ==
      ::
        :-  %profile
        %-  ot
        :~  ship+(se %p)
            edits+(om (mu so))
        ==
      ::
        [%retire (ot ship+(se %p) ~)]
    ==
  --
--

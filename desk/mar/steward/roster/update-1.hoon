::  %steward-roster-update-1: roster facts for runner (openclaw) watchers
::
::    jsn captures the real $json type in an outer core so the +json arms
::    below (including bot-json's own type cast) don't shadow it -- see the
::    same pattern in mar/steward/lens/action-1.hoon.
::
/-  r=steward-roster
=>  |%
    +$  jsn  json
    --
|_  upd=update:v2:r
++  grad  %noun
++  grow
  |%
  ++  noun  upd
  ++  json
    =,  enjs:format
    |^
    ?-  -.upd
        %init
      %-  frond  :-  'init'
      %-  pairs
      %+  turn  ~(tap by bots.upd)
      ::  NB: .who is @p, not =ship -- inside =,  enjs:format, ++ship is a
      ::  gate (json-from-ship), so a `=ship` sample here would resolve the
      ::  mold to that gate instead of the ship aura.
      ::
      |=  [who=@p =bot:v2:r]
      [(scot %p who) (bot-json bot)]
    ::
        %minted
      %-  frond  :-  'minted'
      %-  pairs
      :~  ['ship' s+(scot %p ship.upd)]
          ['bot' (bot-json bot.upd)]
      ==
    ::
        %configured
      %-  frond  :-  'configured'
      %-  pairs
      :~  ['ship' s+(scot %p ship.upd)]
          ['bot' (bot-json bot.upd)]
      ==
    ::
        %retired
      %-  frond  :-  'retired'
      %-  frond  :-  'ship'
      s+(scot %p ship.upd)
    ==
    ++  bot-json
      |=  =bot:v2:r
      ^-  jsn
      %-  pairs
      :~  ['nickname' s+nickname.bot]
          :-  'avatar'
          ?~(avatar.bot ~ s+u.avatar.bot)
          ['model' s+model.bot]
          ['harness' s+harness.bot]
          ['persona' s+persona.bot]
          ['created' s+(scot %da created.bot)]
      ==
    --
  --
++  grab
  |%
  ++  noun  update:v2:r
  --
--

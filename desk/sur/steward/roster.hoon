::  steward roster module: minted bot moons and their runner config
::
::    steward "mints" a bot: spawn+reserve a moon under us, classify it %bot
::    in vouch, publish its profile via contacts, and record its runner
::    config here so the runner (openclaw) can pick it up. all actions are
::    local only -- an owner mints its own bots.
::
|%
::  $bot: a minted moon's runner-facing config.
::
::    .nickname/.avatar: mirrored into the moon's %contacts profile on every
::            mint/configure so the bot's identity is consistent everywhere.
::    .model/.harness/.persona: opaque (to steward) runner configuration --
::            which model backs the bot, which harness runs it, which
::            persona/prompt it uses. steward stores these but never
::            interprets them.
::    .created: when this moon was minted. preserved across %configure.
::
+$  bot
  $:  nickname=@t
      avatar=(unit @t)
      model=@t
      harness=@t
      persona=@t
      created=@da
  ==
::  $state: roster module state -- every bot moon we've minted, live or
::  retired-from-vouch's perspective (retiring only drops it from .bots; see
::  %retire below).
::
+$  state  [bots=(map ship bot)]
::  $action: roster module inbound actions. all local-only (the owner mints
::  its own bots) -- enforced in the app, not per-variant, since every shape
::  here expects the same src.
::
::    %mint: spawn+reserve a fresh moon under us and mint it as a bot: vouch
::            it %bot, publish its %contacts profile, and record .config.
::    %configure: update an existing bot's runner config (and re-publish its
::            %contacts profile). .created is preserved.
::    %retire: drop a bot from the roster. does NOT touch vouch -- the moon
::            stays classified %bot forever, so history involving it stays
::            routable/attributable.
::
+$  action
  $%  [%mint nickname=@t avatar=(unit @t) model=@t harness=@t persona=@t]
      [%configure =ship nickname=@t avatar=(unit @t) model=@t harness=@t persona=@t]
      [%retire =ship]
  ==
::  $update: facts on /v1/roster for runner (openclaw) watchers.
::
::    %init: the full roster, given on every new subscription.
::    %minted / %configured: a bot was minted / reconfigured.
::    %retired: a bot was dropped from the roster (including a rollback when
::            a %mint's jael registration itself failed).
::
+$  update
  $%  [%init bots=(map ship bot)]
      [%minted =ship =bot]
      [%configured =ship =bot]
      [%retired =ship]
  ==
++  v1  .
--

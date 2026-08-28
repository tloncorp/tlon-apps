::  steward roster module: minted bot moons and their runner config
::
::    steward "mints" a bot: spawn+reserve a moon under us, classify it %bot
::    in vouch, publish its profile via contacts, and record its runner
::    config here so the runner (openclaw) can pick it up. all actions are
::    local only -- an owner mints its own bots.
::
::    steward is the sole arbiter of bot data in %contacts: the %bots claim
::    field on our own profile is a projection of .claimed (written whole,
::    never read-modify-written), and every bot profile write goes through
::    steward's %profile action. identity fields (nickname/avatar) are NOT
::    stored here -- the bot's contact profile is the single copy, joined
::    into $bot views at read time.
::
|%
::  $rig: a minted moon's stored runner config.
::
::    .model/.harness/.persona: opaque (to steward) runner configuration --
::            which model backs the bot, which harness runs it, which
::            persona/prompt it uses. steward stores these but never
::            interprets them.
::    .created: when this moon was minted. preserved across %configure.
::
+$  rig
  $:  model=@t
      harness=@t
      persona=@t
      created=@da
  ==
::  $bot: the runner-facing view of a bot -- .rig joined with the identity
::  fields from the moon's %contacts profile. this is what /v1/roster
::  facts and peeks carry; it is never stored.
::
+$  bot
  $:  nickname=@t
      avatar=(unit @t)
      model=@t
      harness=@t
      persona=@t
      created=@da
  ==
::  $state: roster module state.
::
::    .bots: every bot moon we manage, live only (%retire deletes).
::    .claimed: every bot moon we have EVER minted. grow-only -- %retire
::            does not remove (a retired bot stays claimed so peers keep
::            routing DMs to it through us instead of peer-to-peer into a
::            never-booted void; same rationale as vouch's permanent %bot
::            record). our own profile's %bots field is a pure projection
::            of this set.
::
+$  state  [bots=(map ship rig) claimed=(set ship)]
::  $action: roster module inbound actions. all local-only (the owner mints
::  its own bots) -- enforced in the app, not per-variant, since every shape
::  here expects the same src.
::
::    %mint: spawn+reserve a fresh moon under us and mint it as a bot: vouch
::            it %bot, publish its %contacts profile (seeded from
::            .nickname/.avatar), claim it, and record its rig.
::    %configure: update an existing bot's runner config. ~ fields keep
::            their current value. identity edits go through %profile.
::    %profile: edit an existing bot's contact profile. steward validates
::            the field names, types the values, and forwards to %contacts
::            as a merge -- ~ deletes a field, absent fields are untouched.
::    %retire: drop a bot from the roster. does NOT touch vouch or the
::            claim -- the moon stays classified %bot and claimed forever,
::            so history involving it stays routable/attributable.
::
+$  action
  $%  [%mint nickname=@t avatar=(unit @t) model=@t harness=@t persona=@t]
      [%configure =ship model=(unit @t) harness=(unit @t) persona=(unit @t)]
      [%profile =ship edits=(map @tas (unit @t))]
      [%retire =ship]
  ==
::  $update: facts on /v1/roster for runner (openclaw) watchers.
::
::    %init: the full roster, given on every new subscription.
::    %minted / %configured: a bot was minted / its rig or profile changed.
::    %retired: a bot was dropped from the roster (including a rollback when
::            a %mint's jael registration itself failed).
::
+$  update
  $%  [%init bots=(map ship bot)]
      [%minted =ship =bot]
      [%configured =ship =bot]
      [%retired =ship]
  ==
++  v2  .
::  v1: the pre-arbiter shapes, kept only for state migration. v1 stored
::  nickname/avatar in the roster (duplicating the contact profile) and had
::  no .claimed set (the %bots field was read-modify-written instead).
::
++  v1
  |%
  +$  bot
    $:  nickname=@t
        avatar=(unit @t)
        model=@t
        harness=@t
        persona=@t
        created=@da
    ==
  +$  state  [bots=(map ship bot)]
  --
--

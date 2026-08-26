::  steward prompts module: durable, ship-owned gateway system prompts
::
::    the harness composes its system prompt from workspace files
::    (AGENTS.md, SOUL.md, ...). the container those files live in is
::    ephemeral; this module makes the owner's edits durable on the ship
::    and mirrors the effective set to the owner ship so any client can
::    read and edit them without talking to the gateway.
::
|%
::  $name: prompt file name as the gateway knows it, e.g. 'SOUL.md'
::
+$  name  @t
::  $prompt: one stored prompt
::
::    .text: full file contents
::    .updated: when this text was last stored here
::
+$  prompt  [text=@t updated=@da]
+$  prompts  (map name prompt)
::  $state: prompts module state.
::
::    .own: canonical prompt set for the bot this ship hosts (bot role).
::          written by gateway %seed and owner %set; the gateway re-applies
::          it to the workspace on every boot.
::    .mirror: per-bot mirror of each bot's canonical set (owner role),
::          fanned in via %sync so clients can scry it locally.
::
+$  state
  $:  own=prompts
      mirror=(map bot=ship prompts)
  ==
::  $action: prompts module inbound actions.
::
::    %set: owner edits one prompt. carries .bot so the owner's steward can
::          relay cross-ship when bot != our — owner -> bot, mirroring the
::          lens %retry relay.
::    %seed: the local gateway reports the full effective prompt set (file
::          contents) after applying any stored edits. src=our only.
::    %sync: bot -> owner fan-out of the bot's canonical set. accepted from
::          ships in the owner-side trusted-bots set.
::
+$  action
  $%  [%set bot=ship =name text=@t]
      [%seed prompts=(map name @t)]
      [%sync =prompts]
  ==
::  $update: prompts subscription / scry update.
::
::    %prompts: a bot's full prompt set. scry result, and facted on
::          /v1/prompts whenever a set changes (owner role, and bot role
::          after a %seed).
::    %set: a single stored edit, facted on /v1/prompts on the bot ship;
::          the local gateway applies it and restarts.
::
+$  update
  $%  [%prompts bot=ship =prompts]
      [%set =name =prompt]
  ==
++  v1  .
--

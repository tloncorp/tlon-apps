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
::    .edited: true when the text came from an owner %set. edited entries
::            are pinned owner intent: the gateway re-applies them to the
::            workspace on boot and a %seed never overwrites them. un-edited
::            entries just mirror the gateway's effective files, so upstream
::            prompt-set updates keep flowing through.
::
+$  prompt  [text=@t updated=@da edited=?]
+$  prompts  (map name prompt)
::  $state: prompts module state.
::
::    .own: canonical prompt set for the bot this ship hosts (bot role).
::          written by gateway %seed and owner %set; the gateway re-applies
::          it to the workspace on every boot.
::    .mirror: per-bot mirror of each bot's canonical set (owner role),
::          fanned in via %sync so clients can scry it locally.
::    .stale: former owners whose %revoke has not been confirmed (the
::          initial revoke can be nacked while the former owner's agent is
::          restarting). re-issued once per gateway boot until one acks;
::          a redundant %revoke is a no-op at the receiver, so retries
::          converge.
::    .pending: bots whose %request (sent on %trust-bot) was nacked, with
::          the attempt count. a nack means the bot's steward ran and
::          refused — mid-restart, or it does not consider us its owner —
::          and nothing else would make it re-fan until its gateway next
::          boots, so the request is retried on a behn timer, bounded.
::    .resync: attempts so far at re-fanning our canonical set to the owner
::          after a nacked %sync. the %set or %request that triggered the
::          fan-out has already acked, so nothing else would retry it —
::          without this the owner's mirror stays stale until the gateway
::          happens to re-seed. bounded, like .pending.
::    .sync-tag: id of the newest armed %sync retry timer, carried on its
::          wire and checked on wake. monotonic across owner eras, which
::          .resync is not — it restarts at 0 for a new owner, so an
::          attempt count alone can match a timer armed two nacks earlier
::          for a different owner and fan out ahead of the retry delay.
::
+$  state
  $:  own=prompts
      mirror=(map bot=ship prompts)
      stale=(set ship)
      pending=(map bot=ship tries=@ud)
      resync=@ud
      sync-tag=@ud
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
::    %request: owner asks the bot to re-fan its canonical set (sent
::          automatically on %trust-bot, since a %sync delivered before
::          trust was granted has already been nacked and won't retry).
::          accepted from the configured owner.
::    %revoke: a bot tells a former owner to drop its mirror (sent when the
::          bot's configured owner changes). accepted from any ship that
::          has a mirror entry with us — a ship can only drop its own.
::    %clear: the local gateway declares prompt sync inactive for this ship
::          (its account lost prompt-syncing authority): wipe the canonical
::          set and fan the now-empty set to the owner, so the owner's
::          client stops offering an editor whose edits nothing applies.
::          src=our only.
::
+$  action
  $%  [%set bot=ship =name text=@t]
      [%seed prompts=(map name @t)]
      [%sync =prompts]
      [%request ~]
      [%revoke ~]
      [%clear ~]
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

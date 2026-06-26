::  steward: cross-cutting (non-module) protocol types
::
::    module-specific types live in their own, independently-versioned
::    files: sur/steward/lens.hoon, sur/steward/gateway.hoon.
::
|%
::  $action: cross-cutting (non-module) inbound actions. all self-only.
::
::    %configure: set the shared owner — the bot's owner ship, used across
::            modules (lens send target, gateway owner-DM tracking).
::    %trust-bot / %untrust-bot: add/remove a ship from the owner-side
::            trusted-bots set. only ships in this set may send lens %entry
::            pokes cross-ship. trust is explicit and ship-class-agnostic
::            (planet/moon/star/comet/galaxy all eligible) — moon
::            sponsorship is NOT an auto-trust.
::
+$  action
  $%  [%configure owner=ship]
      [%trust-bot ship=ship]
      [%untrust-bot ship=ship]
  ==
++  v1  .
--

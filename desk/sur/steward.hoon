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
::    %unconfigure: clear the shared owner (the gateway's config no longer
::            names one). also revokes the former owner's prompt mirror so
::            the bot stops appearing owned/editable there.
::    %trust-bot / %untrust-bot: add/remove a ship from the owner-side
::            trusted-bots set. only ships in this set may send lens %entry
::            pokes cross-ship. trust is explicit and ship-class-agnostic
::            (planet/moon/star/comet/galaxy all eligible) — moon
::            sponsorship is NOT an auto-trust.
::
+$  action
  $%  [%configure owner=ship]
      [%unconfigure ~]
      [%trust-bot ship=ship]
      [%untrust-bot ship=ship]
  ==
++  v1  .
--

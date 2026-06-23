::  steward: cross-cutting (non-module) protocol types
::
::    module-specific types live in their own, independently-versioned
::    files: sur/steward/lens.hoon, sur/steward/gateway.hoon.
::
|%
::  $action: set the shared owner — the bot's owner ship, used across
::  modules (lens fan-out target, gateway owner-DM tracking).
::
+$  action  [%configure owner=ship]
++  v1  .
--

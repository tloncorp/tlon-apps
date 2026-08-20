::  apps: structured state for app channels
::
::    an app channel is a group channel whose contents are one opaque
::    JSON document rather than a stream of posts. its nest kind is
::    %apps, so %groups routes join/leave through the generic
::    channel-host convention and this agent hosts the documents. see
::    docs/backend/channel-hosts.md for the contract and docs/apps.md
::    for this agent.
::
::    channels are identified by flag (host ship + name). the nest kind
::    is always %apps, so the agent rebuilds the nest where %groups
::    wants one rather than carrying it around.
::
::    the document body is opaque here on purpose. typing it would
::    couple the protocol to whichever kit owns the surface — the same
::    reasoning as interactive surfaces on post blobs, whose revision
::    and idempotency semantics this mirrors with the channel as the
::    store instead of a message (docs/tlon-apps/interactive-surfaces.md).
::
/-  g=groups
|%
::  $nest: channel id as %groups sees it, with an unrestricted kind.
::
::    sur/channels.hoon pins its $kind to ?(%diary %heap %chat), and the
::    %channel arm of %groups' own action type uses that, so casting an
::    %apps nest to `a-groups:g` fails to compile even though %groups
::    accepts the noun perfectly well. %notes defines its own nest for
::    exactly this reason; so do we, and the pokes below carry it.
::
+$  nest  [kind=@tas host=@p name=@tas]
::  channel-host poke payloads, in both directions.
::
::    $channel-join / $channel-leave are what %groups pokes us with as a
::    group's fleet and permissions change. $group-add / $group-del are
::    what we poke %groups with to register and remove the listing, and
::    $channel-active reports whether a channel is live for us.
::
+$  channel-join   [=nest group=flag:g]
+$  channel-leave  [=nest]
+$  channel-active  [group=flag:g =nest joined=?]
+$  group-channel
  $:  meta=[title=@t description=@t image=@t cover=@t]
      created=@da
      section=@tas
      readers=(set role-id:g)
      join=?
  ==
+$  group-add
  $:  %group
      group=flag:g
      %channel
      =nest
      %add
      channel=group-channel
  ==
+$  group-del
  $:  %group
      group=flag:g
      %channel
      =nest
      %del
      ~
  ==
::  +max-applied: cap on remembered write ids per document
::
::    the list replicates to every subscriber on every change, so it is
::    bounded rather than complete. past the cap a very old retry can
::    apply twice; the revision check catches most of that, since a
::    stale retry usually carries a stale .expected too.
::
++  max-applied  128
::  $doc: one app channel's state
::
::    .group: the group whose membership governs this channel. every
::            document has one — there is no ungoverned app channel,
::            which is what makes the permission story total.
::    .writers: roles that may write, empty meaning any reader may.
::              mirrors a %channels channel's writers.
::    .revision: bumped by exactly 1 per applied write. a write carrying
::               a stale .expected is a conflict and changes nothing.
::    .body: the opaque JSON document.
::    .applied: ids of writes already applied, newest first, capped at
::              +max-applied. the idempotency key.
::
+$  doc
  $:  group=flag:g
      writers=(set role-id:g)
      revision=@ud
      body=@t
      applied=(list @t)
      updated=@da
  ==
::  $action: inbound pokes
::
::    %create: host-only. mints the document and registers the channel
::             listing with %groups, carrying .readers so the group's
::             can-read gates the channel.
::    %write: replace the body. .id is the idempotency key; .expected is
::            the revision the writer was looking at, or ~ to opt into
::            last-write-wins. accepted from a remote member, who is
::            checked against the group; a member's own ship forwards to
::            the host.
::    %delete: host-only. drops the document and the group listing.
::
+$  action
  $%  $:  %create
          name=term
          group=flag:g
          title=@t
          description=@t
          readers=(list role-id:g)
          writers=(list role-id:g)
          body=@t
      ==
      [%write chan=flag:g id=@t expected=(unit @ud) body=@t]
      [%delete chan=flag:g]
  ==
::  $update: facts and scry results
::
::    %conflict: the write was rejected for a stale .expected. carries
::               the revision actually stored so the writer can re-read
::               rather than guess.
::
+$  update
  $%  [%doc =flag:g =doc]
      [%docs docs=(map flag:g doc)]
      [%deleted =flag:g]
      [%conflict =flag:g revision=@ud]
  ==
++  v1  .
--

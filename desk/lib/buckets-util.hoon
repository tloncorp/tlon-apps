::  buckets-util: pure helpers for the %buckets agent.
::
::  Everything here is a function of its arguments alone -- no bowl, no agent
::  state, no scries -- which is what lets it be tested directly rather than
::  through a standing agent. Two groups live here: reading the manifest
::  (entries, their parents and their descendants), and reading what the
::  storage broker said back.
::
/-  b=buckets
|%
::  +entry-file: the file an entry holds. Crashes on a folder, which every
::  caller has already ruled out by construction.
::
++  entry-file
  |=  ent=entry:b
  ^-  file:b
  ?-  -.kind.ent
    %folder  ~|(%entry-is-a-folder !!)
    %file    +.kind.ent
  ==
::  +valid-parent: ~ is the root and always valid; anything else must name a
::  folder that exists.
::
++  valid-parent
  |=  [st=bucket-state:b parent=(unit @ud)]
  ^-  ?
  ?~  parent  &
  ?~  ent=(~(get by entries.st) u.parent)  |
  =(%folder -.kind.u.ent)
::  +valid-mime: a content type must be present and look like type/subtype.
::  Memex refuses anything else, so refuse it here before committing state.
::
++  valid-mime
  |=  mime=@t
  ^-  ?
  =/  txt=tape  (trip mime)
  ?~  txt  |
  ?~  cut=(find "/" txt)  |
  &(!=(0 u.cut) !=(+(u.cut) (lent txt)))
::  +descendant: is .candidate at or beneath .ancestor?
::
::  Walks up from the candidate rather than down from the ancestor, so it
::  costs the depth of one branch. A cycle would not terminate, which nothing
::  can build: a move that would close one is refused by this same arm.
::
++  descendant
  |=  [st=bucket-state:b ancestor=@ud candidate=@ud]
  ^-  ?
  =/  cur=(unit @ud)  `candidate
  |-
  ?~  cur  |
  ?:  =(u.cur ancestor)  &
  ?~  ent=(~(get by entries.st) u.cur)  |
  $(cur parent.u.ent)
::  +descendants: an entry and everything beneath it.
::
::  The parent-to-children index is built once rather than per node. Walking
::  the whole entry map to find one node's children made a recursive delete
::  quadratic in the manifest, and the client deletes each ready file on its
::  own before the folder, so every one of those paid for a full scan too --
::  enough for a large bucket to hold the agent through a routine delete.
::
++  descendants
  |=  [st=bucket-state:b root=@ud]
  ^-  (set @ud)
  ?>  (~(has by entries.st) root)
  =/  kids=(jug @ud @ud)
    %-  ~(rep by entries.st)
    |=  [[id=@ud ent=entry:b] acc=(jug @ud @ud)]
    ?~  parent.ent  acc
    (~(put ju acc) u.parent.ent id)
  =/  acc=(set @ud)  (silt ~[root])
  =/  queue=(list @ud)  ~[root]
  |-
  ?~  queue  acc
  =/  next=(list @ud)  ~(tap in (~(get ju kids) i.queue))
  %=  $
    queue  (weld t.queue next)
    acc    (~(gas in acc) next)
  ==
::  +apply-update: fold one update into a replica's copy of a bucket.
::
::  The host runs the same verbs against its own state through se-core; this
::  is the subscriber's side of the identical transition, which is why it is
::  worth being able to test the two against each other.
::
++  apply-update
  |=  [st=bucket-state:b upd=u-bucket:b]
  ^-  bucket-state:b
  ?-  -.upd
      %create   st(bucket bucket.upd)
      %delete   st
      %meta     st(bucket bucket.upd)
      %writers  st(writers writers.upd)
  ::
      %entry
    st(entries (~(put by entries.st) id.upd entry.u-entry.upd))
  ::
      %entries-deleted
    =.  entries.st
      %-  ~(rep in (silt ids.upd))
      |=  [key=@ud acc=_entries.st]
      (~(del by acc) key)
    st
  ==
::  +reader-status: the one place a reader record's state is decided.
::
::  Expiry dominates everything else: past it the token the record names can
::  no longer be used, so there is nothing left to owe, serve or retry
::  whatever the revisions say. A refusal settles it next -- the broker will
::  answer the same way again -- then being level with the broker, and
::  anything else is still owed.
::
++  reader-status
  |=  [sync=reader-sync:b now=@da]
  ^-  reader-status:b
  ?:  (lte expires.sync now)  %lapsed
  ?:  failed.sync  %refused
  ?:  (gte synced.sync revision.sync)  %settled
  %owed
::  +ship-text: a ship as the broker spells it, without the leading sig.
::
++  ship-text
  |=  who=ship
  ^-  @t
  (crip (slag 1 (trip (scot %p who))))
::  +url-encode: percent-encode one path segment.
::
++  url-encode
  |=  txt=@t
  ^-  @t
  (crip (en-urlt:html (trip txt)))
::  +from-unix-ms: the broker speaks milliseconds; arvo speaks @da.
::
++  from-unix-ms
  |=  ms=@ud
  ^-  @da
  (from-unix:chrono:userlib (div ms 1.000))
::  +broker-body: the JSON object a broker answer carries, if it carries one.
::
++  broker-body
  |=  res=client-response:iris
  ^-  (unit (map @t json))
  ?.  ?=(%finished -.res)  ~
  ?~  full-file.res  ~
  ?~  jon=(de:json:html q.data.u.full-file.res)  ~
  ?.  ?=([%o *] u.jon)  ~
  `p.u.jon
::  +broker-headers: the headers the broker requires on the signed PUT.
::
++  broker-headers
  |=  body=(map @t json)
  ^-  (list [@t @t])
  ?~  got=(~(get by body) 'requiredHeaders')  ~
  ?.  ?=([%a *] u.got)  ~
  %+  murn  p.u.got
  |=  =json
  ^-  (unit [@t @t])
  ?.  ?=([%a [%s *] [%s *] ~] json)  ~
  `[p.i.p.json p.i.t.p.json]
::  +broker-message: what the broker said went wrong, if it said anything.
::
++  broker-message
  |=  res=client-response:iris
  ^-  @t
  ?~  body=(broker-body res)  'storage refused the upload'
  ?~  got=(~(get by u.body) 'message')  'storage refused the upload'
  ?.(?=([%s *] u.got) 'storage refused the upload' p.u.got)
::  +broker-applied: whether the broker took the write, as it reported it.
::
::  The receipt says so outright, and inferring it from revisions instead gets
::  the equal case wrong: a reader whose record was pruned at its expiry opens
::  again at revision 1 while the broker still retains 1, which it answers 200
::  and does not apply. A body we cannot read tells us nothing, and the
::  revision comparison remains the fallback.
::
++  broker-applied
  |=  res=client-response:iris
  ^-  (unit ?)
  ?~  body=(broker-body res)  ~
  ?~  got=(~(get by u.body) 'applied')  ~
  ?.  ?=([%b *] u.got)  ~
  `p.u.got
::  +broker-revision: the revision the broker says it currently holds.
::
++  broker-revision
  |=  res=client-response:iris
  ^-  (unit @ud)
  ?~  body=(broker-body res)  ~
  ?~  got=(~(get by u.body) 'currentRevision')  ~
  ?.  ?=([%n *] u.got)  ~
  `(rash p.u.got dem)
::  +broker-retryable: whether the broker says another attempt could work.
::
::  It marks a validation failure retryable:false and a service failure
::  retryable:true. Absent, we assume it is worth another go -- a transport
::  failure carries no body at all, and those are exactly the retryable ones.
::
++  broker-retryable
  |=  res=client-response:iris
  ^-  ?
  ?~  body=(broker-body res)  &
  ?~  got=(~(get by u.body) 'retryable')  &
  ?.  ?=([%b *] u.got)  &
  p.u.got
--

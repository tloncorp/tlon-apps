::  Hand-independent coordinates in the Harness corpus. A scope is an
::  immutable incarnation of a conversation, not its mutable title. The
::  event address and optional part identify retained source material.
/-  h=harness
|%
+$  scope  @uv
+$  ref  [scope=scope at=@ud part=(unit @ud)]
+$  cursor  [sent=@da id=@ud]
+$  hit  [=cursor =ref sent=@da author=@t snippet=@t]
+$  page
  $:  hits=(list hit)
      next=(unit cursor)
      complete=?
      indexed=@ud
      built-at=(unit @da)
  ==
::  Standard map/set nouns and generic ordered mops are intentional: the
::  search hot path uses the runtime's native implementations of these arms.
++  cursor-lte
  |=  [a=cursor b=cursor]
  ?:  =(sent.a sent.b)  (lte id.a id.b)
  (lte sent.a sent.b)
+$  posting  ((mop cursor @ud) cursor-lte)
+$  document  [=ref author=@t]
+$  event-key  [scope=scope at=@ud]
+$  segment
  $:  docs=(map @ud document)
      postings=(map @t posting)
      count=@ud
  ==
+$  index
  $:  segments=(map @ud segment)
      directory=(map @t (set @ud))
      prefixes=(map @t (set @t))
      live=(map event-key (map (unit @ud) @ud))
      count=@ud
      live-count=@ud
      built-at=(unit @da)
  ==
+$  record
  $:  kind=?(%message %context %tool %summary %note)
      role=@t
      body=@t
      source=(unit input-source:h)
      sent=@da
      author=@t
  ==
::  These are rebuildable projections, never another admission authority.
::  Reverse the frozen log in bounded batches before indexing oldest-first.
::  New events wait in incoming, so backfill cannot reorder or lose them.
+$  conversation
  $:  sid=session-id:h
      seen=(list event:h)
      reverse=(list event:h)
      forward=(list event:h)
      incoming=(list event:h)
      view=view:h
      source=(unit input-source:h)
      sent=@da
      author=@t
      records=(map @ud record)
      count=@ud
  ==
+$  state
  $:  index=index
      names=(map session-id:h scope)
      scopes=(map scope conversation)
      next=@uv
      front=(list scope)
      back=(list scope)
      queued=(set scope)
      count=@ud
  ==
--

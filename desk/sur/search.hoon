::  search: shared types for the global full-text index
::
::    %search keeps one inverted index over content owned by other agents
::    in this desk. producing agents (%channels, %chat, %notes) never hand
::    over their own data structures — they submit flat $entry records and
::    identify content with a $target built only from stable identity
::    fields. that keeps the index decoupled from the heavily-versioned
::    content types those agents pass over the network.
::
|%
::  $source: the agent that owns a document
::
+$  source  ?(%channels %chat %notes)
::  identity fields, structurally identical to their owners' types
::
::    they are restated here rather than imported so a kelvin bump in
::    $nest:channels or $whom:chat can't force an index migration. the
::    owners' types nest under these, so producers pass theirs directly.
::
+$  nest  [kind=@tas host=ship name=@tas]
+$  whom  $%([%ship p=ship] [%club p=@uvH])
+$  book  [=ship name=@tas]
+$  mid   [=ship =time]
::  $target: a pointer to one indexed document
::
::    .reply is the reply's own id when the document is a reply; the
::    post/message id stays in the parent field so a client can route to
::    the thread either way.
::
+$  target
  $%  [%channel =nest post=@da reply=(unit @da)]
      [%chat =whom id=mid reply=(unit mid)]
      [%note =book id=@ud]
  ==
::  $tid: target digest, the index's internal document key
::
+$  tid  @uvH
::  $key: a normalized search term
::
+$  key  @t
::  $gram: a three-character slice of a $key
::
+$  gram  @t
::  $rank: a term's weight within one document
::
+$  rank  @ud
::  $doc: what the index retains about a document
::
::    the index stores no full text. .snippet is a leading slice kept for
::    result display; clients resolve .target against the owning agent
::    for anything richer.
::
+$  doc
  $:  =target
      title=@t
      context=@t
      snippet=@t
      author=(unit ship)
      time=@da
  ==
::  $entry: an indexing submission from a producing agent
::
::    .title is the document's own headline — a note's or diary post's
::    title, empty for a chat message — and is indexed at high weight.
::    .context is the container it lives in (channel, notebook, dm) and is
::    kept for display only: indexing it would make every message in a
::    channel called "design" a strong match for "design".
::
::    .text is the flattened body. producers flatten their own content so
::    %search never learns their content formats.
::
+$  entry
  $:  =target
      title=@t
      context=@t
      text=@t
      author=(unit ship)
      time=@da
  ==
::  $postings: documents containing a term, and that term's weight in each
::
+$  postings  (map tid rank)
::  $index: the inverted index
::
::    .terms  term -> documents containing it
::    .grams  trigram -> terms containing it, for fuzzy and prefix matching
::    .trail  document -> its terms, so a document can be fully retracted
::    .docs   document -> its stored record
::    .kids   post/message -> its replies, which are documents in their own
::            right; deleting the parent has to take them with it, or a
::            delete leaves results pointing at nothing
::
+$  index
  $:  terms=(map key postings)
      grams=(jug gram key)
      trail=(map tid (set key))
      docs=(map tid doc)
      kids=(jug tid tid)
  ==
::  $job: one queued unit of deferred index work
::
+$  job
  $%  [%touch =entry]
      [%erase =target]
  ==
::  $action: inbound poke protocol
::
::    %touch and %erase are the hot path and do no work beyond queueing.
::    %rebuild asks producers to resubmit everything they own; %wipe drops
::    one source's documents; %reset empties the index.
::
+$  action
  $%  [%touch entries=(list entry)]
      [%erase targets=(list target)]
      [%rebuild sources=(set source)]
      [%wipe =source]
      [%reset ~]
  ==
::  $hit: a scored result
::
+$  hit  [=doc score=@ud]
::  $result: a page of results
::
+$  result
  $:  query=@t
      hits=(list hit)
      total=@ud
      skip=@ud
  ==
::  $status: index health, for clients and debugging
::
+$  status
  $:  docs=@ud
      keys=@ud
      pending=@ud
      last-indexed=@da
  ==
::
++  v1  .
--

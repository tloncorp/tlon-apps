::  Native Notes projection and request preparation. This is an adapter, not
::  a second document engine: all accepted bodies/history come from Notes.
/-  n=notes, w=harness-workspace, hn=harness-notes
/+  codec=harness-workspace-json, work=harness-workspace
|%
::
++  owns
  |=  action=@t
  ^-  ?
  %+  lien
    `(list @t)`~['artifact-create' 'artifact-save' 'artifact-rename' 'publish' 'unpublish']
  |=(value=@t =(action value))
::
++  accepts
  |=  [action=@t args=json]
  ^-  ?
  ?:  (owns action)  &
  &(=('review' action) (boolean:codec args 'accept' |))
::
++  needs-notes
  |=  action=@t
  ^-  ?
  ?:  =('task-reply' action)  &
  ::  Lists use the watched metadata projection; opening content refreshes Notes.
  %+  lien
    ^-  (list @t)
    :~  'artifact'  'revisions'  'revision'  'proposal'  'preview'  'artifact-create'
        'artifact-save'  'artifact-archive'  'artifact-rename'  'propose'  'review'  'publish'
        'unpublish'
    ==
  |=(item=@t =(action item))
::
++  public-path
  |=  [book=flag:n note=@ud]
  ^-  @t
  (rap 3 '/notes/pub/' (scot %p ship.book) '/' name.book '/' (scot %ud note) ~)
::
++  decorate
  |=  [native=state:hn value=json]
  ^-  json
  ?~  value  ~
  ?:  ?=(%a -.value)  [%a (turn p.value |=(item=json (decorate native item)))]
  ?.  ?=(%o -.value)  value
  =/  mapped=(map @t json)
    %+  roll  ~(tap by p.value)
    |=  [[key=@t item=json] updated=(map @t json)]
    (~(put by updated) key (decorate native item))
  =.  value  [%o mapped]
  ?.  &((~(has by p.value) 'head') ?=(^ book.native))  value
  =/  id  (optional:codec value 'id')
  ?~  id  value
  =/  link  (~(get by links.native) u.id)
  ?~  link  value
  =/  book  u.book.native
  =/  info
    %-  pairs:enjs:format
    :~  ['notebook' %s (rap 3 (scot %p ship.book) '/' name.book ~)]
        ['noteId' %s (scot %ud note.u.link)]
        ['path' %s (public-path book note.u.link)]
    ==
  [%o (~(put by p.value) 'notes' info)]
::
++  request-id
  |=  pending=pending:hn
  ^-  @uv
  (sham [id.pending stage.pending])
::
++  revision
  |=  [link=link:hn number=@ud at=@da author=@p title=@t body=@t]
  ^-  revision:w
  =/  writer=actor:w  (fall (~(get by authors.link) number) [0v0 (scot %p author)])
  [at writer [title body (fall (~(get by sources.link) number) ~)]]
::
++  project-note
  |=  [artifact=artifact:w link=link:hn note=note:n history=(list note-revision:n)]
  ^-  artifact:w
  =/  revisions=(map @ud revision:w)
    %+  roll  history
    |=  [old=note-revision:n updated=(map @ud revision:w)]
    %+  ~(put by updated)
      +(rev.old)
    (revision link +(rev.old) at.old author.old title.old body-md.old)
  =.  revisions
    %+  ~(put by revisions)
      +(revision.note)
    (revision link +(revision.note) updated-at.note updated-by.note title.note body-md.note)
  %=  artifact
    label  title.note
    head  +(revision.note)
    revisions  revisions
  ==
::  Deleting a native note removes its read projection and recency together.
::  The link and native delivery bookkeeping remain owned by the caller.
::
++  remove-projection
  |=  [db=state:w id=@t]
  ^-  state:w
  %=  db
    artifacts  (~(del by artifacts.db) id)
    recency  (~(del by recency.db) [%artifact id])
    writes  +(writes.db)
  ==
::
++  project-book
  |=  [db=state:w native=state:hn book=notebook-state:n]
  ^-  state:w
  %+  roll  ~(tap by links.native)
  |=  [[id=@t link=link:hn] updated=_db]
  =/  artifact  (~(get by artifacts.updated) id)
  ?~  artifact  updated
  =/  note  (~(get by notes.book) note.link)
  ?~  note  (remove-projection updated id)
  =/  history  (fall (~(get by history.book) note.link) ~)
  =/  next  (project-note u.artifact link u.note history)
  ?:  =(next u.artifact)  updated
  %^  touch:work
    updated(artifacts (~(put by artifacts.updated) id next), writes +(writes.updated))
    [%artifact id]
  updated-at.u.note
::
++  project-update
  |=  [db=state:w native=state:hn update=u-notebook:n]
  ^-  state:w
  ?.  ?=(%note -.update)  db
  %+  roll  ~(tap by links.native)
  |=  [[id=@t link=link:hn] updated=_db]
  ?.  =(note.link id.update)  updated
  =/  artifact  (~(get by artifacts.updated) id)
  ?~  artifact  updated
  ?:  ?=(%deleted -.u-note.update)
    (remove-projection updated id)
  =/  next=artifact:w
    ?:  ?=(%updated -.u-note.update)
      =/  note  note.u-note.update
      =/  current
        %:  revision
          link
          +(revision.note)
          updated-at.note
          updated-by.note
          title.note
          body-md.note
        ==
      %=  u.artifact
        label  title.note
        head  +(revision.note)
        revisions  (~(put by revisions.u.artifact) +(revision.note) current)
      ==
    ?:  ?=(%history-archived -.u-note.update)
      =/  old  note-revision.u-note.update
      %=  u.artifact  revisions
          %+  ~(put by revisions.u.artifact)
            +(rev.old)
          (revision link +(rev.old) at.old author.old title.old body-md.old)
      ==
    u.artifact
  ?:  =(next u.artifact)  updated
  =/  latest  (~(get by revisions.next) head.next)
  =/  at=@da  ?~(latest `@da`0 at.u.latest)
  %^  touch:work
    updated(artifacts (~(put by artifacts.updated) id next), writes +(writes.updated))
    [%artifact id]
  at
::
++  prepare
  |=  $:  db=state:w  native=state:hn  reply=reply:hn  action=@t  args=json  fallback=@t  now=@da
          request=@uv
      ==
  ^-  (each pending:hn @t)
  ?^  pending.native
    :*  %|
        'A Notes operation is still in progress. Inspect its result before submitting another document change.'
    ==
  =/  target  (fall (optional:codec args 'id') fallback)
  =/  owner=authority:w  [& [0v0 'Owner'] 0v0]
  =/  value=content:w  *content:w
  =/  writer=actor:w  by.owner
  =/  proposal=(unit @t)  ~
  =/  pending
    %*  .  *pending:hn
      id  request
      reply  reply
      action  action
      args  args
      artifact  target
      value  value
      by  writer
      proposal  proposal
      stage  %write
      sent  |
      uncertain  |
    ==
  ?:  =('artifact-rename' action)
    (prepare-rename db native pending)
  =/  decoded  (mule |.((decode:codec db action args fallback)))
  ?.  ?=(%& -.decoded)  [%| 'Invalid Notes action or parameters']
  =/  change  p.decoded
  ::  Pure work validation supplies project access and proposal fences.
  ::  Its hypothetical document mutation is never persisted or served.
  =/  checked  (apply:work db owner change now)
  ?.  ?=(%& -.checked)  [%| p.checked]
  =?  target  ?=(%review -.change)
    artifact:(~(got by proposals.db) id.change)
  =/  candidate  (~(got by artifacts.p.checked) target)
  =?  value  ?=(%review -.change)
    value:(~(got by proposals.db) id.change)
  =?  writer  ?=(%review -.change)
    by:(~(got by proposals.db) id.change)
  =?  proposal  ?=(%review -.change)  `id.change
  =?  value  ?=(?(%artifact-create %artifact-save) -.change)
    ?:  ?=(%artifact-create -.change)  value.change
    ?>  ?=(%artifact-save -.change)
    value.change
  =/  link  (~(get by links.native) target)
  =/  creating  ?=(~ link)
  ?.  |(creating ?=(^ book.native))  [%| 'Native Notes notebook is unavailable']
  =/  command=a-notes:n
    ?~  book.native  [%create-notebook 'Harness artifacts']
    :-  %notebook
    :-  u.book.native
    ?:  creating  [%create-note folder.native title.value body.value]
    :-  %note
    :-  note:(need link)
    ?:  ?=(%publish -.change)  [%publish html.change]
    ?:  ?=(%unpublish -.change)  [%unpublish ~]
    ::  Titles are native metadata, not body revisions. Never turn a body
    ::  proposal into an unfenced rename or a hidden two-command save.
    [%update body.value (dec head:(~(got by artifacts.db) target))]
  ?:  ?&  !creating  ?=(?(%artifact-save %review) -.change)
          !=(title.value label:(~(got by artifacts.db) target))
      ==
    :*  %|
        'Titles are separate Notes metadata. Rename the document explicitly; body saves and proposals must retain its current title.'
    ==
  :-  %&
  %*  .  pending
    artifact  target
    candidate  candidate(revisions ~)
    value  value
    by  writer
    proposal  proposal
    stage  ?:(?=(~ book.native) %book %write)
    command  command
  ==
::
++  prepare-rename
  |=  [db=state:w native=state:hn pending=pending:hn]
  ^-  (each pending:hn @t)
  =/  artifact  (~(get by artifacts.db) artifact.pending)
  =/  link  (~(get by links.native) artifact.pending)
  ?.  &(?=(^ artifact) ?=(^ link) ?=(^ book.native))  [%| 'Native Notes document not found']
  ?:  archived.u.artifact  [%| 'Restore the artifact before renaming']
  =/  title  (string:codec args.pending 'title')
  ?.  &((gth (met 3 title) 0) (lte (met 3 title) 256))
    [%| 'Title must contain 1–256 UTF-8 bytes']
  :-  %&
  %*  .  pending
    candidate  u.artifact
    command  [%notebook u.book.native %note note.u.link %rename title]
  ==
::
++  complete
  |=  [db=state:w native=state:hn note=note:n history=(list note-revision:n) number=@ud now=@da]
  ^-  [db=state:w native=state:hn]
  =/  pending  (need pending.native)
  =/  id  artifact.pending
  =/  =link:hn  (fall (~(get by links.native) id) [id.note ~ ~])
  =?  link
    |(=('artifact-create' action.pending) =('artifact-save' action.pending) ?=(^ proposal.pending))
    %=  link
      sources  (~(put by sources.link) number sources.value.pending)
      authors  (~(put by authors.link) number by.pending)
    ==
  =/  candidate  candidate.pending
  =?  publication.candidate  ?=(^ publication.candidate)
    `u.publication.candidate(slug (public-path (need book.native) id.note), html '')
  =/  artifact  (project-note candidate link note history)
  =?  proposals.db  ?=(^ proposal.pending)
    =/  proposal-id  u.proposal.pending
    =/  proposal  (~(got by proposals.db) proposal-id)
    =.  proposal
      %=  proposal
        status  %accepted
        decided  `now
        decision  (fall (optional:codec args.pending 'reason') '')
        revision  `number
      ==
    (~(put by proposals.db) proposal-id proposal)
  =.  db
    %=  db
      artifacts  (~(put by artifacts.db) id artifact)
      writes  +(writes.db)
      history  [[now by.pending action.pending id] (scag 2.047 history.db)]
    ==
  =.  db  (touch:work db [%artifact id] now)
  =?  bytes.db  |(=('artifact-create' action.pending) =('artifact-save' action.pending))
    (add bytes.db (content-size:work value.pending))
  [db native(links (~(put by links.native) id link), pending ~)]
::
++  reader
  |_  bowl=bowl:gall
  ::
  ++  note
    |=  [book=flag:n id=@ud]
    ^-  note:n
    .^  note:n  %gx
      %+  weld  /(scot %p our.bowl)/notes/(scot %da now.bowl)/v0/note
      /(scot %p ship.book)/[name.book]/(scot %ud id)/noun
    ==
  ::
  ++  history
    |=  [book=flag:n id=@ud]
    ^-  (list note-revision:n)
    .^  (list note-revision:n)  %gx
      %+  weld  /(scot %p our.bowl)/notes/(scot %da now.bowl)/v0/note-history
      /(scot %p ship.book)/[name.book]/(scot %ud id)/noun
    ==
  ::
  ++  published
    ^-  (list published-record:n)
    .^  (list published-record:n)  %gx
      /(scot %p our.bowl)/notes/(scot %da now.bowl)/v0/published/notes-published
    ==
  ::
  ++  visible
    |=  [book=flag:n id=@ud]
    (lien published |=(item=published-record:n &(=(book flag.item) =(id note-id.item))))
  ::  Capability readers supply a prefiltered workspace and native link map.
  ::  Read exact native note identities, never the notebook-wide body listing.
  ::  A missing/unavailable note fails the enclosing read instead of serving a
  ::  cached private body. This projection is not persisted by client requests.
  ::
  ++  refresh-scoped
    |=  [db=state:w native=state:hn]
    ^-  state:w
    ?~  book.native  db
    ?:  =(~ links.native)  db
    =/  book  u.book.native
    =/  pages  published
    %+  roll  ~(tap by links.native)
    |=  [[id=@t link=link:hn] updated=_db]
    =/  artifact  (~(get by artifacts.updated) id)
    ?~  artifact  updated
    =/  current  (note book note.link)
    =/  public
      %+  lien
        pages
      |=(item=published-record:n &(=(book flag.item) =(note.link note-id.item)))
    =?  artifact  !=(public ?=(^ publication.u.artifact))
      :-  ~
      %=  u.artifact  publication  ?:(public `[0 (public-path book note.link) '' now.bowl] ~)
        exposure  +(exposure.u.artifact)
      ==
    =?  updated  !=(artifact (~(get by artifacts.updated) id))
      %^  touch:work
        updated
        [%artifact id]
      now.bowl
    =.  artifacts.updated  (~(put by artifacts.updated) id u.artifact)
    =/  last  (~(get by revisions.u.artifact) +(revision.current))
    ?:  ?&  ?=(^ last)
            =(head.u.artifact +(revision.current))
            =(title.current label.u.artifact)
            =(body-md.current body.value.u.last)
        ==
      updated
    =/  next  (project-note u.artifact link current (history book note.link))
    %^  touch:work
      updated(artifacts (~(put by artifacts.updated) id next))
      [%artifact id]
    updated-at.current
  ::
  ++  refresh
    |=  [db=state:w native=state:hn]
    ^-  state:w
    ?~  book.native  db
    =/  book  u.book.native
    =/  rows=(list note:n)
      .^  (list note:n)  %gx
        /(scot %p our.bowl)/notes/(scot %da now.bowl)/v0/notes/(scot %p ship.book)/[name.book]/noun
      ==
    =/  pages  published
    %+  roll  ~(tap by links.native)
    |=  [[id=@t link=link:hn] updated=_db]
    =/  artifact  (~(get by artifacts.updated) id)
    ?~  artifact  updated
    =/  public
      %+  lien
        pages
      |=(item=published-record:n &(=(book flag.item) =(note.link note-id.item)))
    =?  artifact  !=(public ?=(^ publication.u.artifact))
      :-  ~
      %=  u.artifact  publication  ?:(public `[0 (public-path book note.link) '' now.bowl] ~)
        exposure  +(exposure.u.artifact)
      ==
    =?  writes.updated  !=(artifact (~(get by artifacts.updated) id))  +(writes.updated)
    =?  updated  !=(artifact (~(get by artifacts.updated) id))
      %^  touch:work
        updated
        [%artifact id]
      now.bowl
    =.  artifacts.updated  (~(put by artifacts.updated) id u.artifact)
    =/  found  (skim rows |=(item=note:n =(id.item note.link)))
    ?~  found  (remove-projection updated id)
    =/  current  i.found
    =/  last  (~(get by revisions.u.artifact) +(revision.current))
    ::  Only changed notes require a history scry and projection rebuild.
    ?:  ?&  ?=(^ last)
            =(head.u.artifact +(revision.current))
            =(title.current label.u.artifact)
            =(body-md.current body.value.u.last)
        ==
      updated
    =/  next  (project-note u.artifact link current (history book note.link))
    %^  touch:work
      updated(artifacts (~(put by artifacts.updated) id next), writes +(writes.updated))
      [%artifact id]
    updated-at.current
  --
--

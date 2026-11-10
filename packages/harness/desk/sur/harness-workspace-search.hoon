::  Disposable full-text index. Artifact revisions are postings inside one
::  document group, so pagination never splits a document into duplicate hits.
|%
+$  key  [kind=?(%artifact %project %task) id=@t]
+$  address  [=key revision=@ud]
+$  matches  (map key (set @ud))
+$  record  [signature=@uv words=(set @t) at=@da]
+$  state
  $~  [| ~ ~ ~ ~ ~ ~ 0]
  $:  initialized=?
      documents=(map address record)
      terms=(map @t matches)
      prefixes=(map @t (set @t))
      front=(list address)
      back=(list address)
      queued=(map address @da)
      epoch=@ud
  ==
--

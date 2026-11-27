::  workspace-config: read-modify-write of a group's workspace config, the
::  JSON document in its blob
::
::    mirrors packages/api/src/client/workspaceConfig.ts and follows
::    docs/tlon-apps/workspace-config.md: unknown keys survive every edit,
::    empty known fields are dropped, a document left holding only its
::    version is written as null, and a blob this writer can't read (a
::    newer version, or not a workspace config at all) is never
::    overwritten.
::
|%
::  +edit: apply .f to the document in .blob. ~ when the blob can't be
::  edited; otherwise the blob to write
::
++  edit
  |=  [blob=(unit @t) f=$-((map @t json) (map @t json))]
  ^-  (unit (unit @t))
  =/  doc  (read blob)
  ?~  doc  ~
  =/  out=(map @t json)  (compact (f u.doc))
  ?:  =(~ (~(del by out) 'version'))  [~ ~]
  ``(en:json:html o+out)
::  +read: the document in .blob; an empty one when the blob is unset
::
++  read
  |=  blob=(unit @t)
  ^-  (unit (map @t json))
  ?:  |(?=(~ blob) =('' u.blob))  `(my ~[['version' n+~.2]])
  =/  jon=(unit json)  (de:json:html u.blob)
  ?.  ?=([~ %o *] jon)  ~
  ?.  =(`n+~.2 (~(get by p.u.jon) 'version'))  ~
  `p.u.jon
::  +compact: pin the version and drop known fields left empty
::
++  compact
  |=  doc=(map @t json)
  ^-  (map @t json)
  =/  known  (silt `(list @t)`~['bot' 'instructions' 'defaults' 'kits'])
  =/  kept=(list [@t json])
    %+  skip  ~(tap by doc)
    |=([k=@t v=json] &((~(has in known) k) (empty v)))
  (~(put by (malt kept)) 'version' n+~.2)
++  empty
  |=  v=json
  ^-  ?
  ?|(=(~ v) =(s+'' v) =(a+~ v) =(o+~ v))
::
::  kit provenance
::
::  +add-kit: name .bot unless one is named, append .text to the
::  instructions, and record the kit, replacing any entry with its ref
::
++  add-kit
  |=  [bot=@p text=@t ref=@t places=(map @tas @t)]
  |=  doc=(map @t json)
  ^-  (map @t json)
  =?  doc  !(~(has by doc) 'bot')
    (~(put by doc) 'bot' s+(scot %p bot))
  =?  doc  !=('' text)
    =/  old=@t
      =/  cur  (~(get by doc) 'instructions')
      ?.(?=([~ %s *] cur) '' p.u.cur)
    (~(put by doc) 'instructions' s+?:(=('' old) text (rap 3 old '\0a\0a' text ~)))
  =/  entry=json
    %-  pairs:enjs:format
    :~  ['ref' s+ref]
        ['places' o+(~(run by places) |=(n=@t s+n))]
    ==
  (~(put by doc) 'kits' a+(snoc (other-kits doc ref) entry))
::  +set-place: record .name -> .nest in the places of the kit .ref
::
++  set-place
  |=  [ref=@t name=@tas nest=@t]
  |=  doc=(map @t json)
  ^-  (map @t json)
  %+  ~(put by doc)  'kits'
  :-  %a
  %+  turn  (kits doc)
  |=  entry=json
  ?.  (is-kit ref entry)  entry
  ?>  ?=([%o *] entry)
  =/  places=(map @t json)
    =/  cur  (~(get by p.entry) 'places')
    ?.(?=([~ %o *] cur) ~ p.u.cur)
  o+(~(put by p.entry) 'places' o+(~(put by places) name s+nest))
::  +del-kit: drop the entry for the kit .ref
::
++  del-kit
  |=  ref=@t
  |=  doc=(map @t json)
  ^-  (map @t json)
  (~(put by doc) 'kits' a+(other-kits doc ref))
::
++  kits
  |=  doc=(map @t json)
  ^-  (list json)
  =/  cur  (~(get by doc) 'kits')
  ?.(?=([~ %a *] cur) ~ p.u.cur)
::
++  other-kits
  |=  [doc=(map @t json) ref=@t]
  ^-  (list json)
  (skip (kits doc) (cury is-kit ref))
::
++  is-kit
  |=  [ref=@t entry=json]
  ^-  ?
  ?.  ?=([%o *] entry)  |
  =(`s+ref (~(get by p.entry) 'ref'))
--

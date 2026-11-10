/-  h=harness
/+  *test, content=harness-hosted-content, defaults=harness-defaults, j=harness-workspace-json
|%
++  config
  builtin-config:defaults
++  test-soul-read-and-write-preserve-other-defaults
  =/  cfg  config
  =.  system.cfg  'Initial instructions'
  =/  read  (apply-soul:content cfg [%o ~])
  =/  body  (need (get:j response.read 'body'))
  =/  args
    %-  pairs:enjs:format
    ~[['revision' (need (get:j body 'revision'))] ['body' %s 'New instructions']]
  =/  saved  (apply-soul:content cfg args)
  ;:  weld
      (expect-eq !>(cfg) !>(config.read))
      (expect-eq !>('Initial instructions') !>((string:j body 'body')))
      (expect-eq !>(cfg(system 'New instructions')) !>(config.saved))
      (expect-eq !>(200) !>((number:j response.saved 'status' 0)))
      (expect-eq !>('New instructions') !>((string:j (need (get:j response.saved 'body')) 'body')))
  ==
++  test-soul-conflict-and-unknown-fields-do-not-write
  =/  cfg  config
  =/  stale
    %+  apply-soul:content
      cfg
    (pairs:enjs:format ~[['revision' %s 'stale'] ['body' %s 'No']])
  =/  missing  (apply-soul:content cfg (pairs:enjs:format ~[['body' %s 'No']]))
  =/  unknown  (apply-soul:content cfg (pairs:enjs:format ~[['system' %s 'No']]))
  ;:  weld
      (expect-eq !>(cfg) !>(config.stale))
      (expect-eq !>(cfg) !>(config.missing))
      (expect-eq !>(cfg) !>(config.unknown))
      (expect-eq !>(409) !>((number:j response.stale 'status' 0)))
      (expect-eq !>(409) !>((number:j response.missing 'status' 0)))
      (expect-eq !>(400) !>((number:j response.unknown 'status' 0)))
  ==
++  test-soul-empty-and-size-limit
  =/  cfg  config
  =/  args  (pairs:enjs:format ~[['revision' %s (soul-revision:content system.cfg)] ['body' %s '']])
  =/  cleared  (apply-soul:content cfg args)
  ?>  ?=(%o -.args)
  =/  large  (fil 3 65.537 'x')
  =.  p.args  (~(put by p.args) 'body' [%s large])
  =/  rejected  (apply-soul:content cfg args)
  ;:  weld
      (expect-eq !>('') !>(system.config.cleared))
      (expect-eq !>(200) !>((number:j response.cleared 'status' 0)))
      (expect-eq !>(cfg) !>(config.rejected))
      (expect-eq !>(400) !>((number:j response.rejected 'status' 0)))
  ==
++  test-skill-list-detail-create-and-update-share-revisions
  =/  skills=(map @t skill:h)  (my ~[['keep' ['Unchanged' 'Keep these instructions']]])
  =/  args
    %-  pairs:enjs:format
    ~[['name' %s 'new'] ['desc' %s 'Purpose'] ['body' %s 'Instructions'] ['revision' %s '']]
  =/  created  (apply-skills:content skills args)
  =/  read  (apply-skills:content skills.created (pairs:enjs:format ~[['name' %s 'new']]))
  =/  catalog  (apply-skills:content skills.created [%o ~])
  =/  body  (need (get:j response.read 'body'))
  =/  list  (need (get:j response.catalog 'body'))
  ?>  ?=(%a -.list)
  ?>  ?=(%o -.args)
  =.  p.args  (~(put by p.args) 'revision' (need (get:j body 'revision')))
  =.  p.args  (~(put by p.args) 'body' [%s 'Revised instructions'])
  =/  saved  (apply-skills:content skills.created args)
  ;:  weld
      (expect-eq !>(200) !>((number:j response.created 'status' 0)))
      (expect-eq !>('Instructions') !>((string:j body 'body')))
      (expect-eq !>((scot %uv (sham ['Purpose' 'Instructions']))) !>((string:j body 'revision')))
      (expect-eq !>(2) !>((lent p.list)))
      (expect !>((levy p.list |=(row=json ?=(~ (get:j row 'body'))))))
      (expect-eq !>(`skill:h`['Purpose' 'Revised instructions']) !>((~(got by skills.saved) 'new')))
      (expect-eq !>((~(get by skills) 'keep')) !>((~(get by skills.saved) 'keep')))
  ==
++  test-skill-missing-conflicts-and-invalid-fields-preserve-map
  =/  skills=(map @t skill:h)  (my ~[['keep' ['Purpose' 'Instructions']]])
  =/  args
    %-  pairs:enjs:format
    ~[['name' %s 'keep'] ['desc' %s 'No'] ['body' %s 'No'] ['revision' %s '']]
  =/  stale  (apply-skills:content skills args)
  =/  missing  (apply-skills:content skills (pairs:enjs:format ~[['name' %s 'missing']]))
  =/  unknown
    %+  apply-skills:content
      skills
    (pairs:enjs:format ~[['name' %s 'keep'] ['delete' %b &]])
  ;:  weld
      (expect-eq !>(skills) !>(skills.stale))
      (expect-eq !>(skills) !>(skills.missing))
      (expect-eq !>(skills) !>(skills.unknown))
      (expect-eq !>(409) !>((number:j response.stale 'status' 0)))
      (expect-eq !>(404) !>((number:j response.missing 'status' 0)))
      (expect-eq !>(400) !>((number:j response.unknown 'status' 0)))
  ==
++  test-skill-bounds-and-malformed-body
  =/  args
    %-  pairs:enjs:format
    ~[['name' %s 'new'] ['desc' %s ''] ['body' %s ''] ['revision' %s '']]
  =/  empty  (apply-skills:content ~ args)
  ?>  ?=(%o -.args)
  =.  p.args  (~(put by p.args) 'body' [%s (fil 3 65.537 'x')])
  =/  large  (apply-skills:content ~ args)
  =.  p.args  (~(put by p.args) 'body' [%b &])
  =/  malformed  (mule |.((apply-skills:content ~ args)))
  ;:  weld
      (expect-eq !>(~) !>(skills.empty))
      (expect-eq !>(~) !>(skills.large))
      (expect-eq !>(400) !>((number:j response.empty 'status' 0)))
      (expect-eq !>(400) !>((number:j response.large 'status' 0)))
      (expect !>(?=(%| -.malformed)))
  ==
--
